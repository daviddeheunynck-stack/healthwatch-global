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

export default function OutbreakStatsGrid({ cases, deaths, cfr, labels, locale }: Props) {
  const [status, setStatus] = useState<AuthStatus>("loading");

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

  const blurred = status === "anon" || status === "free" || status === "expired";

  const ctaBtn =
    status === "expired"
      ? (SUBSCRIBE_LABEL[locale] ?? SUBSCRIBE_LABEL.en)
      : labels.ctaProBtn;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {([
          { label: labels.cases,  value: cases,  cls: "text-white"     },
          { label: labels.deaths, value: deaths, cls: "text-red-400"   },
          { label: labels.cfr,    value: cfr,    cls: "text-amber-400" },
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
