import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 200;

// Bulk sibling of /api/outbreak-stats/[id] — same Pro gate, same purpose
// (fill in real cases/deaths client-side for a paid viewer of an ISR-cached
// page that serves identical HTML to every visitor regardless of plan), but
// for the disease/country/region hub pages, which render many outbreaks at
// once rather than the permalink page's single row. One request per page
// load instead of one per row.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const isPaid = ["starter", "pro", "team", "enterprise"].includes(resolvedPlan(profile));
  if (!isPaid) return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = [...new Set(idsParam.split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s)))].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ stats: {} });

  const service = createService(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  );

  const { data, error } = await service
    .from("outbreaks")
    .select("id, cases, deaths")
    .in("id", ids);

  if (error) return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });

  const stats: Record<string, { cases: number; deaths: number | null }> = {};
  for (const row of data ?? []) stats[row.id] = { cases: row.cases, deaths: row.deaths };

  return NextResponse.json({ stats });
}
