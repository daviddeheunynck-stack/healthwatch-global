import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getOutbreaks, magnitudeBand, cfrSeverityBand, pickFeaturedDiseases } from "@/lib/outbreaks";
import { resolvedPlan } from "@/lib/resolved-plan";

export const dynamic = "force-dynamic";

// Backs app/[locale]/compare/page.tsx. That page used to query the
// `outbreaks` table directly from the browser (anon key) and mask
// cases/deaths/CFR only with a CSS blur afterward — the exact figures were
// already in the network response and the DOM for a free or anonymous
// visitor regardless of what the UI drew on top, same leak class fixed
// elsewhere on 2026-09-05. This route does the masking server-side instead,
// reusing the same one-featured-disease-per-continent policy as the
// dashboard, so a visitor never receives the real figure for a non-featured
// outbreak in the first place — cases/deaths are zeroed out (never a
// rounded number) and cases_band/deaths_band/cfr_band carry a qualitative
// substitute. A rounded figure is still real, plausible-looking data; once
// extracted (`curl` on this very route) and compared to the real number —
// already public elsewhere on the site — it reads as a bug or a lie, not a
// gate (David, 2026-09-06, see magnitudeBand's doc comment).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isPaid = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, trial_ends_at, stripe_subscription_id")
      .eq("id", user.id)
      .single();
    isPaid = ["starter", "pro", "team", "enterprise"].includes(resolvedPlan(profile));
  }

  const outbreaks = await getOutbreaks();
  const active = outbreaks.filter((o) => o.active);
  const featuredDiseaseByRegion = isPaid ? new Map<string, string>() : pickFeaturedDiseases(active);
  const isFreeFeatured = (o: (typeof active)[number]) =>
    featuredDiseaseByRegion.get(o.region) === (o.disease_en || o.disease);

  const payload = active.map((o) => {
    const unlocked = isPaid || isFreeFeatured(o);
    return {
      id: o.id,
      disease: o.disease, disease_en: o.disease_en, disease_ar: o.disease_ar,
      country: o.country, country_en: o.country_en, country_ar: o.country_ar,
      region: o.region,
      risk_level: o.risk_level,
      is_pheic: o.is_pheic,
      date: o.date,
      cases: unlocked ? o.cases : 0,
      deaths: unlocked ? o.deaths : null,
      cases_band: unlocked ? null : magnitudeBand(o.cases),
      deaths_band: unlocked ? null : (o.deaths === null ? null : magnitudeBand(o.deaths)),
      cfr_band: unlocked ? null : cfrSeverityBand(o.cases, o.deaths),
      is_free_featured: !isPaid && isFreeFeatured(o),
    };
  });

  return NextResponse.json({ outbreaks: payload, isPaid });
}
