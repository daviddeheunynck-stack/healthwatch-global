"use client";

// Client-side paid-unlock wrapper for OutbreakCasesChart on the outbreak
// permalink page. The daily snapshot series is real, unbucketed history
// (same data as the Pro-gated /api/outbreak-history) — for a non-featured
// outbreak it can't be a prop on this ISR-cached page any more than the
// headline stat can, so it's fetched here client-side only once a paid
// session is confirmed, exactly like OutbreakStatsGrid's own real-cases
// fetch for the stat tiles above this chart.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { resolvedPlan } from "@/lib/resolved-plan";
import OutbreakCasesChart from "@/components/OutbreakCasesChart";

interface Snapshot { snapped_at: string; cases: number; deaths: number; }

interface Props {
  outbreakId: string;
  isFeatured: boolean;
  featuredSnapshots: Snapshot[]; // real, safe to embed when isFeatured
  riskLevel: string;
  locale: string;
  lockedLabel: string;
}

export default function OutbreakCasesChartGate({ outbreakId, isFeatured, featuredSnapshots, riskLevel, locale, lockedLabel }: Props) {
  const [fetchedSnapshots, setFetchedSnapshots] = useState<Snapshot[] | null>(null);

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
          fetch(`/api/outbreak-history?outbreak_id=${outbreakId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (!cancelled && d?.snapshots) setFetchedSnapshots(d.snapshots); })
            .catch(() => {});
        });
    });
    return () => { cancelled = true; };
  }, [isFeatured, outbreakId]);

  if (isFeatured) return <OutbreakCasesChart snapshots={featuredSnapshots} riskLevel={riskLevel} locale={locale} />;
  if (fetchedSnapshots) return <OutbreakCasesChart snapshots={fetchedSnapshots} riskLevel={riskLevel} locale={locale} />;
  return <p className="text-sm text-gray-500 py-6 text-center">{lockedLabel}</p>;
}
