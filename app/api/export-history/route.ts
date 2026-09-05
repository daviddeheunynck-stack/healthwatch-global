import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createService } from "@supabase/supabase-js";
import { resolvedPlan } from "@/lib/resolved-plan";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/track-event";

export const dynamic = "force-dynamic";

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

// Daily case/death history for a single outbreak — the raw series behind the
// in-app epidemic curve (OutbreakCasesChart), which until now could only be
// looked at, never taken offline. Same 90-day cap as /api/outbreak-history,
// which already feeds that chart from the same table.
const HISTORY_DAYS_LIMIT = 90;

export async function GET(request: NextRequest) {
  // Rate limit: 20 exports / IP / hour — same budget as /api/export
  const ip = getClientIp(request);
  const rl = await rateLimit(`export-history:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized — please sign in", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, trial_ends_at, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  const isPaid = ["starter", "pro", "team", "enterprise"].includes(resolvedPlan(profile));
  if (!isPaid) return new NextResponse("Upgrade to Pro to export data", { status: 403 });

  const { searchParams } = new URL(request.url);
  const outbreakId = searchParams.get("outbreak_id");
  const format = searchParams.get("format");
  if (!outbreakId) return new NextResponse("Missing outbreak_id", { status: 400 });
  // outbreak_snapshots.outbreak_id is a uuid column — anything else fails the
  // query at the Postgres type-cast layer and surfaces as a bare 500. Never
  // reachable from the app's own UI (always a real outbreak.id), but a
  // hand-edited URL shouldn't get an opaque server error for an invalid id.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(outbreakId))
    return new NextResponse("Invalid outbreak_id", { status: 400 });

  // outbreak_snapshots has RLS with no public policy — needs service role,
  // same as /api/outbreak-history.
  const service = createService(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  );

  const { data: snapshots, error } = await service
    .from("outbreak_snapshots")
    .select("cases, deaths, snapped_at")
    .eq("outbreak_id", outbreakId)
    .order("snapped_at", { ascending: true })
    .limit(HISTORY_DAYS_LIMIT);

  if (error) return new NextResponse("Failed to load history", { status: 500 });

  trackEvent(user.id, "csv_export_history", { format: format ?? "csv", outbreak_id: outbreakId });

  const date = new Date().toISOString().split("T")[0];
  const records = (snapshots ?? []).map((s) => ({
    date:   s.snapped_at,
    cases:  s.cases,
    deaths: s.deaths,
  }));

  if (format === "json") {
    return new NextResponse(JSON.stringify({ outbreak_id: outbreakId, data: records, count: records.length, exported_at: new Date().toISOString() }, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="healthwatch-history-${outbreakId}-${date}.json"`,
        "Cache-Control": "no-store, no-cache",
      },
    });
  }

  const escape = (v: string | number | null | undefined) => {
    const str = String(v ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const headers = ["date", "cases", "deaths"];
  const rows    = records.map((r) => headers.map((h) => escape(r[h as keyof typeof r])));
  const csv     = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="healthwatch-history-${outbreakId}-${date}.csv"`,
      "Cache-Control": "no-store, no-cache",
    },
  });
}
