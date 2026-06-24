import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

const PAID_PLANS = ["starter", "pro", "team", "enterprise"];

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single();
  if (!PAID_PLANS.includes(resolvedPlan(profile)))
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const url = new URL(req.url);
  const outbreakId = url.searchParams.get("outbreak_id");
  if (!outbreakId) return NextResponse.json({ error: "Missing outbreak_id" }, { status: 400 });

  const { data: current } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, date")
    .eq("id", outbreakId)
    .single();

  if (!current || !current.disease_en || !current.country_en || current.cases <= 0)
    return NextResponse.json({ benchmark: null });

  const { data: historical } = await supabase
    .from("outbreaks")
    .select("id, cases, date, deaths")
    .eq("disease_en", current.disease_en)
    .eq("country_en", current.country_en)
    .neq("id", outbreakId)
    .gt("cases", 0)
    .order("date", { ascending: false })
    .limit(20);

  if (!historical || historical.length === 0)
    return NextResponse.json({ benchmark: null });

  const sorted = [...historical].sort((a, b) => a.cases - b.cases);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1].cases + sorted[mid].cases) / 2
    : sorted[mid].cases;

  const ratio = median > 0 ? parseFloat((current.cases / median).toFixed(2)) : null;

  return NextResponse.json({
    benchmark: {
      current_cases:           current.cases,
      historical_median_cases: Math.round(median),
      ratio,
      episodes_count:          historical.length,
    },
  });
}
