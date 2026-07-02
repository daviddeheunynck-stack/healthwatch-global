"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";

const EXPIRED_COPY: Record<string, { btn: string; sub: string }> = {
  fr: { btn: "S'abonner à Pro →", sub: "Accédez aux alertes, rapports PDF et données complètes." },
  en: { btn: "Subscribe to Pro →", sub: "Get back access to alerts, PDF reports and full data." },
  es: { btn: "Suscribirse a Pro →", sub: "Recupere el acceso a alertas, informes PDF y datos completos." },
  ar: { btn: "← الاشتراك في Pro", sub: "استعد الوصول إلى التنبيهات وتقارير PDF والبيانات الكاملة." },
  id: { btn: "Berlangganan Pro →", sub: "Dapatkan kembali akses ke peringatan, laporan PDF, dan data lengkap." },
};

interface Props {
  locale: string;
  ctaTitle: string;
  ctaSub: string;
  ctaProBtn: string;
  ctaFree: string;
}

export default function OutbreakBottomCta({ locale, ctaTitle, ctaSub, ctaProBtn, ctaFree }: Props) {
  // null = pending, "paid" = hide, "free" | "anon" | "expired" = show
  const [state, setState] = useState<"pending" | "paid" | "free" | "anon" | "expired">("pending");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setState("anon"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id")
        .eq("id", session.user.id)
        .single();
      const plan = profile?.plan ?? "free";
      const isPaidPlan = ["starter", "pro", "team", "enterprise"].includes(plan);
      // Hide for Stripe subscribers; show for trial users (let them upgrade to annual)
      // and free users (nudge to start a trial)
      if (isPaidPlan && !!profile?.stripe_subscription_id) {
        setState("paid");
      } else if (
        isPaidPlan &&
        profile?.trial_ends_at &&
        new Date(profile.trial_ends_at).getTime() < Date.now() &&
        !profile?.stripe_subscription_id
      ) {
        setState("expired");
      } else {
        setState("free");
      }
    });
  }, []);

  // Keep visible while pending (SSR fallback) and for non-paid users
  if (state === "paid") return null;

  const exp = EXPIRED_COPY[locale] ?? EXPIRED_COPY.en;

  return (
    <div className="mt-10 p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center space-y-4">
      <div>
        <p className="text-white font-semibold">{ctaTitle}</p>
        <p className="text-xs text-gray-400 mt-1">{state === "expired" ? exp.sub : ctaSub}</p>
      </div>
      <CheckoutButton
        plan="pro"
        locale={locale}
        label={state === "expired" ? exp.btn : ctaProBtn}
        className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
      />
      {state !== "expired" && (
        <p className="text-xs text-gray-500">
          <Link href={`/${locale}/signup`} className="underline hover:text-gray-300 transition-colors">
            {ctaFree}
          </Link>
        </p>
      )}
    </div>
  );
}
