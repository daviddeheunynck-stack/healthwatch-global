"use client";

// Client-side paid-unlock wrapper for ShareOutbreakButton on the outbreak
// permalink page (ISR-cached, same HTML for every visitor regardless of
// plan). A featured outbreak's real cases/deaths are already safe to embed
// server-side (see the page's own isFeatured — same value shown to every
// visitor already); for anyone else the button was simply absent until now
// — this instead mirrors OutbreakStatsGrid's own status/fetch pair so a
// genuinely paid viewer still gets to share the real figure, fetched from
// the Pro-gated /api/outbreak-stats/[id] rather than ever appearing as a
// prop in the page's own shared cache.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { resolvedPlan } from "@/lib/resolved-plan";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";

interface Props {
  outbreakId: string;
  isFeatured: boolean;
  disease: string;
  country: string;
  cases: number;   // real, safe to pass through only when isFeatured
  deaths?: number;
  riskLevel: string;
  locale: string;
  compact?: boolean;
  updatedAt?: string;
  reportDate?: string;
}

export default function ShareOutbreakButtonGate({
  outbreakId, isFeatured, disease, country, cases, deaths, riskLevel, locale, compact, updatedAt, reportDate,
}: Props) {
  const [fetched, setFetched] = useState<{ cases: number; deaths: number | null } | null>(null);

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
            .then((d) => { if (!cancelled && d) setFetched({ cases: d.cases, deaths: d.deaths }); })
            .catch(() => {});
        });
    });
    return () => { cancelled = true; };
  }, [isFeatured, outbreakId]);

  if (!isFeatured && !fetched) return null;

  const realCases  = isFeatured ? cases : fetched!.cases;
  const realDeaths = isFeatured ? deaths : (fetched!.deaths ?? undefined);

  return (
    <ShareOutbreakButton
      disease={disease}
      country={country}
      cases={realCases}
      deaths={realDeaths}
      riskLevel={riskLevel}
      locale={locale}
      outbreakId={outbreakId}
      compact={compact}
      updatedAt={updatedAt}
      reportDate={reportDate}
    />
  );
}
