"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { resolvedPlan } from "@/lib/resolved-plan";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";

// "loading" = auth check in flight (don't blur yet to avoid flash for Pro users)
// "anon"    = no session
// "free"    = logged in but never had a paid plan
// "expired" = logged in, trial ended, no active subscription
// "paid"    = active Pro/Trial/Team/Enterprise
type AuthStatus = "loading" | "anon" | "free" | "expired" | "paid";

interface Props {
  outbreakId: string;
  // This outbreak is the one free "showcase" disease for its continent (see
  // pickFeaturedDiseases in lib/outbreaks.ts) — the `cases`/`deaths`/`cfr`
  // props are already the real figures in that case (safe: same page already
  // embeds them in its shared cache for every visitor), so never blur them,
  // matching how the dashboard leaves a featured row unlocked.
  isFeatured: boolean;
  cases: string;
  deaths: string;
  cfr: string;
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

export default function OutbreakStatsGrid({ outbreakId, isFeatured, cases, deaths, cfr, labels, locale }: Props) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  // Real figures — this component's `cases`/`deaths`/`cfr` props are a
  // magnitude-bucketed placeholder (the page that renders them is ISR-cached
  // and shared across every visitor, see app/[locale]/outbreak/[id]/page.tsx),
  // fetched here client-side, only once `status` is confirmed "paid", from
  // the Pro-gated /api/outbreak-stats/[id].
  const [realStats, setRealStats] = useState<{ cases: number; deaths: number | null } | null>(null);

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
    if (status !== "paid" || isFeatured) return; // featured rows already carry the real figures in `cases`/`deaths`/`cfr`
    fetch(`/api/outbreak-stats/${outbreakId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setRealStats({ cases: d.cases, deaths: d.deaths }); })
      .catch(() => {});
  }, [status, outbreakId, isFeatured]);

  const blurred = !isFeatured && (status === "anon" || status === "free" || status === "expired");

  const numLocale = locale === "ar" ? "ar-SA" : locale;
  const realCfr = realStats && realStats.cases > 0 && realStats.deaths !== null
    ? ((realStats.deaths / realStats.cases) * 100).toFixed(1) + "%"
    : null;
  const displayCases  = realStats ? realStats.cases.toLocaleString(numLocale) : cases;
  // Falls back to the original (bucketed-or-noData) prop when the real value
  // is null — that prop already correctly distinguishes "0 deaths reported"
  // from "not reported" (see hasData/o.deaths handling in the parent page).
  const displayDeaths = realStats && realStats.deaths !== null ? realStats.deaths.toLocaleString(numLocale) : deaths;
  const displayCfr    = realStats ? (realCfr ?? cfr) : cfr;

  const ctaBtn =
    status === "expired"
      ? (SUBSCRIBE_LABEL[locale] ?? SUBSCRIBE_LABEL.en)
      : labels.ctaProBtn;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {([
          { label: labels.cases,  value: displayCases,  cls: "text-white"     },
          { label: labels.deaths, value: displayDeaths, cls: "text-red-400"   },
          { label: labels.cfr,    value: displayCfr,    cls: "text-amber-400" },
        ] as const).map(({ label, value, cls }) => (
          <div key={label} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
            <div
              className={`text-2xl font-bold ${cls} transition-[filter] duration-200 ${
                blurred ? "blur-sm select-none cursor-default" : ""
              }`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {blurred && (
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
