import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolvedPlan } from "@/lib/resolved-plan";
import { getOutbreaks, pickFeaturedDiseases, isFreeFeaturedRow, magnitudeBand } from "@/lib/outbreaks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url       = new URL(req.url);
  const event_id  = url.searchParams.get("event_id");
  const exclude   = url.searchParams.get("exclude");

  if (!event_id) return NextResponse.json({ outbreaks: [] });

  let query = supabase
    .from("outbreaks")
    .select("id, disease, disease_en, disease_ar, country, country_en, country_ar, risk_level, cases, deaths, date, region")
    .eq("event_id", event_id)
    .eq("active", true);

  if (exclude) query = query.neq("id", exclude);

  const { data, error } = await query
    .order("risk_level", { ascending: true })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Same mask as every other surface. Unlike its sibling panels this one
  // renders for FREE accounts too (OutbreakDetailModal has no `isPaid`
  // guard around <OutbreakCluster>), so it can't simply be gated — a free
  // viewer is meant to see the linked outbreaks, just not their exact
  // figures. Latent rather than live when written on 2026-09-06: `event_id`
  // is null on all 296 rows, so the panel never renders today and nothing
  // leaked through it. Closed now so the class doesn't reopen silently the
  // day a cron starts populating that column.
  const { data: profile } = user
    ? await supabase.from("profiles").select("plan, trial_ends_at, stripe_subscription_id").eq("id", user.id).single()
    : { data: null };
  const isPaid = ["starter", "pro", "team", "enterprise"].includes(resolvedPlan(profile));

  const featuredDiseaseByRegion = isPaid
    ? new Map<string, string>()
    : pickFeaturedDiseases((await getOutbreaks()).filter((o) => o.active));

  return NextResponse.json({
    outbreaks: (data ?? []).map((o) => {
      const unlocked = isPaid || isFreeFeaturedRow(o, featuredDiseaseByRegion);
      return {
        ...o,
        cases:  unlocked ? o.cases  : 0,
        deaths: unlocked ? o.deaths : null,
        is_free_featured: unlocked,
        cases_band: unlocked ? null : magnitudeBand(o.cases),
      };
    }),
  });
}
