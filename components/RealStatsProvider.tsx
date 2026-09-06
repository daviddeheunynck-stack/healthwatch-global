"use client";

// Shares ONE client-side "is this viewer actually paid, and if so what are
// the real cases/deaths behind every masked row on this page" fetch across
// however many small display cells (CasesDisplay.tsx) sit inside it — a
// context, not a render-prop, because a render-prop (a function as
// `children`) can't cross the Server→Client boundary: only serializable
// data can be passed as props into a "use client" component, and a
// closure over the page's own data isn't. The masked page itself (disease/
// country/region hub pages, all ISR-cached and therefore identical for
// every visitor) keeps computing bands server-side exactly as before;
// this only adds a client-side upgrade path for a viewer who turns out to
// be genuinely paid, mirroring OutbreakStatsGrid's own status/fetch pair
// for the single-outbreak permalink page.
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { resolvedPlan } from "@/lib/resolved-plan";

export type RealStats = Map<string, { cases: number; deaths: number | null }>;

const RealStatsContext = createContext<RealStats | null>(null);

export function useRealStats(): RealStats | null {
  return useContext(RealStatsContext);
}

export default function RealStatsProvider({ ids, children }: { ids: string[]; children: React.ReactNode }) {
  const [real, setReal] = useState<RealStats | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
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
          fetch(`/api/outbreak-stats?ids=${ids.join(",")}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (cancelled || !d?.stats) return;
              setReal(new Map(Object.entries(d.stats as Record<string, { cases: number; deaths: number | null }>)));
            })
            .catch(() => {});
        });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids is a fresh array every render; compare by content, not identity
  }, [ids.join(",")]);

  return <RealStatsContext.Provider value={real}>{children}</RealStatsContext.Provider>;
}
