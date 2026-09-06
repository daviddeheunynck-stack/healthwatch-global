"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { resolvedPlan } from "@/lib/resolved-plan";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import { MagnitudeDots, SeverityWord, type CfrSeverityBand } from "@/components/MagnitudeIndicator";

// "loading" = auth check in flight (don't blur yet to avoid flash for Pro users)
// "anon"    = no session
// "free"    = logged in but never had a paid plan
// "expired" = logged in, trial ended, no active subscription
// "paid"    = active Pro/Trial/Team/Enterprise
type AuthStatus = "loading" | "anon" | "free" | "expired" | "paid";

interface Props {
  outbreakId: string;
  // This outbreak is the one free "showcase" disease for its continent (see
  // pickFeaturedDiseases in lib/outbreaks.ts) — `realCases`/`realDeaths`/
  // `realCfr` are already the real figures in that case (safe: same page
  // already embeds them in its shared cache for every visitor), so never
  // blur them, matching how the dashboard leaves a featured row unlocked.
  isFeatured: boolean;
  hasData: boolean;
  realCases: string | null;
  realDeaths: string | null;
  realCfr: string | null;
  // Qualitative substitutes for a non-featured row — a dot scale / severity
  // word, never a rounded number (see magnitudeBand's doc comment: even a
  // plausible-but-fake round figure is real, extractable data once it's a
  // prop on a page shared across every visitor).
  casesBand: number | null;
  deathsBand: number | null;
  cfrBand: CfrSeverityBand | null;
  labels: {
    cases: string;
    deaths: string;
    cfr: string;
    ctaTitle: string;
    ctaSub: string;
    ctaProBtn: string;
    ctaFree: string;
  };
  locale: string;
}

const SUBSCRIBE_LABEL: Record<string, string> = {
  fr: "S'abonner à Pro →",
  es: "Suscribirse a Pro →",
  ar: "← الاشتراك في Pro",
  id: "Berlangganan Pro →",
  en: "Subscribe to Pro →",
};

export default function OutbreakStatsGrid({
  outbreakId, isFeatured, hasData, realCases, realDeaths, realCfr,
  casesBand, deathsBand, cfrBand, labels, locale,
}: Props) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  // Real figures for a paid, non-featured viewer — fetched here client-side,
  // only once `status` is confirmed "paid", from the Pro-gated
  // /api/outbreak-stats/[id]. Never present in the page's own shared cache.
  const [fetchedStats, setFetchedStats] = useState<{ cases: number; deaths: number | null } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setStatus("anon"); return; }
      supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          const p = resolvedPlan(data);
          const trialExpired = (data?.plan || "free") !== "free" && p === "free";
          const isPaid = ["starter", "pro", "team", "enterprise"].includes(p);
          if (isPaid) setStatus("paid");
          else if (trialExpired) setStatus("expired");
          else setStatus("free");
        });
    });
  }, []);

  useEffect(() => {
    if (status !== "paid" || isFeatured) return; // featured rows already carry the real figures
    fetch(`/api/outbreak-stats/${outbreakId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setFetchedStats({ cases: d.cases, deaths: d.deaths }); })
      .catch(() => {});
  }, [status, outbreakId, isFeatured]);

  const unlocked = isFeatured || status === "paid";
  const numLocale = locale === "ar" ? "ar-SA" : locale;

  const fetchedCfr = fetchedStats && fetchedStats.cases > 0 && fetchedStats.deaths !== null
    ? ((fetchedStats.deaths / fetchedStats.cases) * 100).toFixed(1) + "%"
    : null;

  const ctaBtn =
    status === "expired"
      ? (SUBSCRIBE_LABEL[locale] ?? SUBSCRIBE_LABEL.en)
      : labels.ctaProBtn;

  const noData = <span className="text-gray-600 text-sm italic">—</span>;

  // Featured: the real figures were always safe to embed in this page's
  // shared cache (see the page's comment), so use them directly. Paid, not
  // featured: show the band while /api/outbreak-stats/[id]'s fetch is still
  // in flight, then the real figure once it resolves. Anything else: the
  // band, permanently, with the upgrade CTA below.
  const tiles: { label: string; content: React.ReactNode }[] = [
    {
      label: labels.cases,
      content: isFeatured
        ? (realCases ?? noData)
        : status === "paid"
          ? (fetchedStats ? fetchedStats.cases.toLocaleString(numLocale) : <MagnitudeDots band={casesBand} locale={locale} />)
          : (hasData ? <MagnitudeDots band={casesBand} locale={locale} /> : noData),
    },
    {
      label: labels.deaths,
      content: isFeatured
        ? (realDeaths ?? noData)
        : status === "paid"
          ? (fetchedStats ? (fetchedStats.deaths !== null ? fetchedStats.deaths.toLocaleString(numLocale) : noData) : <MagnitudeDots band={deathsBand} locale={locale} />)
          : (deathsBand !== null ? <MagnitudeDots band={deathsBand} locale={locale} /> : noData),
    },
    {
      label: labels.cfr,
      content: isFeatured
        ? (realCfr ?? noData)
        : status === "paid"
          ? (fetchedStats ? (fetchedCfr ?? noData) : <MagnitudeDots band={null} locale={locale} />)
          : (cfrBand ? <SeverityWord band={cfrBand} locale={locale} /> : noData),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {tiles.map(({ label, content }, i) => (
          <div key={label} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
            <div
              className={`text-2xl font-bold ${i === 1 ? "text-red-400" : i === 2 ? "text-amber-400" : "text-white"} ${
                unlocked ? "" : "cursor-pointer"
              }`}
            >
              {content}
            </div>
          </div>
        ))}
      </div>

      {!unlocked && (
        <div className="mb-6 p-5 rounded-xl border border-red-500/20 bg-gray-900/60 text-center space-y-3">
          <p className="text-sm font-semibold text-gray-200">{labels.ctaTitle}</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <CheckoutButton
              plan="pro"
              billing="monthly"
              locale={locale}
              label={ctaBtn}
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
            />
            {status === "anon" && (
              <Link
                href={`/${locale}/signup`}
                className="text-sm text-gray-400 underline hover:text-gray-300 transition-colors"
              >
                {labels.ctaFree}
              </Link>
            )}
          </div>
          <p className="text-xs text-gray-500">{labels.ctaSub}</p>
        </div>
      )}
    </>
  );
}
