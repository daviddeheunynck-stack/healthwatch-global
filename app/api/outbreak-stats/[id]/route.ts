import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// Exact cases/deaths for one outbreak, Pro-gated — the client-side
// counterpart to app/[locale]/outbreak/[id]/page.tsx, which is ISR-cached
// (revalidate=3600) and therefore serves the SAME rendered HTML to every
// visitor regardless of plan. That page can only ever embed a bucketed
// figure (see magnitudeBucket in lib/outbreaks.ts); OutbreakStatsGrid calls
// this route client-side to fill in the real numbers for a paid viewer
// without the cached HTML itself ever carrying them.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return NextResponse.json({ error: "Invalid outbreak id" }, { status: 400 });

  const service = createService(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  );

  const { data, error } = await service
    .from("outbreaks")
    .select("cases, deaths")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ cases: data.cases, deaths: data.deaths });
}
