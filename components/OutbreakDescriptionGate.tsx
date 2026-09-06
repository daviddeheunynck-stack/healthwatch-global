"use client";

// Client-side paid-unlock wrapper for the bulletin description paragraph on
// the outbreak permalink page (ISR-cached, same HTML for every visitor
// regardless of plan). Found 2026-09-06: a masked row's description text
// ("WHO reported 15,310 cumulative cases and 54 deaths...") states the same
// real figures the numeric mask (magnitudeBand/cfrSeverityBand) exists to
// hide — rendering it unconditionally defeated that mask in prose form for
// every non-featured outbreak. Mirrors ShareOutbreakButtonGate/
// OutbreakStatsGrid's own status/fetch pair: real immediately for a
// featured row (already public on this page for every visitor), otherwise
// hidden until a client-side auth+plan check confirms a paid viewer, then
// fetched from the Pro-gated /api/outbreak-stats/[id] rather than ever
// appearing as a prop in the page's own shared cache.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { resolvedPlan } from "@/lib/resolved-plan";

interface DescriptionFields {
  description: string;
  description_fr: string | null;
  description_es: string | null;
  description_ar: string | null;
  description_id: string | null;
}

function pickLocalized(o: DescriptionFields, locale: string): string {
  if (locale === "fr" && o.description_fr) return o.description_fr;
  if (locale === "es" && o.description_es) return o.description_es;
  if (locale === "ar" && o.description_ar) return o.description_ar;
  if (locale === "id" && o.description_id) return o.description_id;
  return o.description;
}

interface Props {
  outbreakId: string;
  isFeatured: boolean;
  // Real, safe to pass through only when isFeatured — see maskOutbreakRow's
  // doc comment in lib/outbreaks.ts for why this can't be a prop otherwise.
  featuredDescription: string;
  locale: string;
}

export default function OutbreakDescriptionGate({ outbreakId, isFeatured, featuredDescription, locale }: Props) {
  const [fetched, setFetched] = useState<DescriptionFields | null>(null);

  useEffect(() => {
    if (isFeatured) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (cancelled) return;
          const isPaid = ["starter", "pro", "team", "enterprise"].includes(resolvedPlan(data));
          if (!isPaid) return;
          fetch(`/api/outbreak-stats/${outbreakId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (!cancelled && d) setFetched(d); })
            .catch(() => {});
        });
    });
    return () => { cancelled = true; };
  }, [isFeatured, outbreakId]);

  const text = isFeatured ? featuredDescription : (fetched ? pickLocalized(fetched, locale) : "");
  if (!text) return null;

  return (
    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 mb-6">
      <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
