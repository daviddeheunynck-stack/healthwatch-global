"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import CheckoutButton from "@/components/CheckoutButton";
import { getMarketingPriceDisplay } from "@/lib/pricing";

const CTA_CLASS = "inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors";

const EXPIRED_COPY: Record<string, { btn: string; sub: string }> = {
  fr: { btn: "S'abonner à Pro →", sub: "Accédez aux alertes, rapports PDF et données complètes." },
  en: { btn: "Subscribe to Pro →", sub: "Get back access to alerts, PDF reports and full data." },
  es: { btn: "Suscribirse a Pro →", sub: "Recupere el acceso a alertas, informes PDF y datos completos." },
  ar: { btn: "← الاشتراك في Pro", sub: "استعد الوصول إلى التنبيهات وتقارير PDF والبيانات الكاملة." },
  id: { btn: "Berlangganan Pro →", sub: "Dapatkan kembali akses ke peringatan, laporan PDF, dan data lengkap." },
};

// Shown to an already-active Pro trial instead of the default "start your free
// trial" copy above — see OutbreakBottomCta below for why that was wrong for
// this audience. Pilots (is_pilot=true) get a "reply to discuss" mailto instead
// of self-serve checkout, same framing as UpgradeModal's pilot branch: their
// conversion path is a personal Team-plan quote, not a Stripe self-checkout.
const TRIAL_COPY: Record<string, {
  btn: string;
  sub: (daysLeft: number) => string;
  pilotBtn: string;
  pilotSub: string;
}> = {
  fr: {
    btn: "Passer en illimité maintenant →",
    sub: (d) => {
      const p = getMarketingPriceDisplay("fr");
      return `Il vous reste ${d} jour${d > 1 ? "s" : ""} d'essai Pro. Ensuite : ${p.proMonthly}/mois ou ${p.proAnnual}/an.`;
    },
    pilotBtn: "Répondre pour en discuter →",
    pilotSub: "Votre accès pilote est actif. Pour la suite, répondez à l'email reçu — on cale un tarif Team adapté.",
  },
  en: {
    btn: "Upgrade now →",
    sub: (d) => {
      const p = getMarketingPriceDisplay("en");
      return `${d} day${d > 1 ? "s" : ""} left on your Pro trial. After that: ${p.proMonthly}/month or ${p.proAnnual}/year.`;
    },
    pilotBtn: "Reply to discuss →",
    pilotSub: "Your pilot access is active. To continue after it, just reply to the email you received — we'll set up a Team plan that fits.",
  },
  es: {
    btn: "Actualizar ahora →",
    sub: (d) => {
      const p = getMarketingPriceDisplay("es");
      return `Le queda${d > 1 ? "n" : ""} ${d} día${d > 1 ? "s" : ""} de prueba Pro. Después: ${p.proMonthly}/mes o ${p.proAnnual}/año.`;
    },
    pilotBtn: "Responder para hablar →",
    pilotSub: "Su acceso piloto está activo. Para continuar, responda al email recibido.",
  },
  ar: {
    btn: "← الترقية الآن",
    sub: (d) => {
      const p = getMarketingPriceDisplay("ar");
      return `تبقّى لديك ${d} ${d === 1 ? "يوم" : "أيام"} من تجربة Pro. بعد ذلك: ${p.proMonthly}/شهر أو ${p.proAnnual}/سنة.`;
    },
    pilotBtn: "← الرد للمناقشة",
    pilotSub: "وصولك التجريبي نشط. للاستمرار، فقط ردّ على البريد الذي تلقيته.",
  },
  id: {
    btn: "Tingkatkan sekarang →",
    sub: (d) => {
      const p = getMarketingPriceDisplay("id");
      return `${d} hari tersisa pada uji coba Pro Anda. Setelah itu: ${p.proMonthly}/bulan atau ${p.proAnnual}/tahun.`;
    },
    pilotBtn: "Balas untuk berdiskusi →",
    pilotSub: "Akses pilot Anda aktif. Untuk melanjutkan, balas email yang Anda terima.",
  },
};

interface Props {
  locale: string;
  ctaTitle: string;
  ctaSub: string;
  ctaProBtn: string;
  ctaFree: string;
}

interface TrialInfo {
  daysLeft: number;
  isPilot: boolean;
  pilotOrganization: string | null;
}

export default function OutbreakBottomCta({ locale, ctaTitle, ctaSub, ctaProBtn, ctaFree }: Props) {
  // null = pending, "paid" = hide, "trial" = active Pro trial, "free" | "anon" | "expired" = show default
  const [state, setState] = useState<"pending" | "paid" | "free" | "anon" | "expired" | "trial">("pending");
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setState("anon"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id, is_pilot, pilot_organization")
        .eq("id", session.user.id)
        .single();
      const plan = profile?.plan ?? "free";
      const isPaidPlan = ["starter", "pro", "team", "enterprise"].includes(plan);
      const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : null;
      const hasSub = !!profile?.stripe_subscription_id;

      if (isPaidPlan && hasSub) {
        setState("paid");
      } else if (isPaidPlan && trialEndsAt && trialEndsAt < Date.now() && !hasSub) {
        setState("expired");
      } else if (isPaidPlan && trialEndsAt && trialEndsAt >= Date.now() && !hasSub) {
        // Active trial — was previously falling through to "free" below, which
        // showed "Start your free trial" to someone already mid-trial (all 3
        // real active accounts on the site were in exactly this state).
        setTrialInfo({
          daysLeft: Math.max(1, Math.ceil((trialEndsAt - Date.now()) / 86_400_000)),
          isPilot: !!profile?.is_pilot,
          pilotOrganization: (profile?.pilot_organization as string | null) ?? null,
        });
        setState("trial");
      } else {
        setState("free");
      }
    });
  }, []);

  // Keep visible while pending (SSR fallback) and for non-paid users
  if (state === "paid") return null;

  const exp = EXPIRED_COPY[locale] ?? EXPIRED_COPY.en;
  const trial = TRIAL_COPY[locale] ?? TRIAL_COPY.en;

  let subText = ctaSub;
  let cta: React.ReactNode = <CheckoutButton plan="pro" locale={locale} label={ctaProBtn} className={CTA_CLASS} />;
  let showFreeLink = state !== "expired";

  if (state === "expired") {
    subText = exp.sub;
    cta = <CheckoutButton plan="pro" locale={locale} label={exp.btn} className={CTA_CLASS} />;
  } else if (state === "trial" && trialInfo?.isPilot) {
    subText = trial.pilotSub;
    const org = trialInfo.pilotOrganization || (locale === "fr" ? "votre organisation" : "your organization");
    const subject = locale === "fr" ? `Suite du pilote — ${org}` : `Following up on our pilot — ${org}`;
    cta = (
      <a href={`mailto:david.deheunynck@gmail.com?subject=${encodeURIComponent(subject)}`} className={CTA_CLASS}>
        {trial.pilotBtn}
      </a>
    );
    showFreeLink = false;
  } else if (state === "trial" && trialInfo) {
    subText = trial.sub(trialInfo.daysLeft);
    cta = <CheckoutButton plan="pro" locale={locale} label={trial.btn} className={CTA_CLASS} />;
    showFreeLink = false;
  }

  return (
    <div className="mt-10 p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center space-y-4">
      <div>
        <p className="text-white font-semibold">{ctaTitle}</p>
        <p className="text-xs text-gray-400 mt-1">{subText}</p>
      </div>
      {cta}
      {showFreeLink && (
        <p className="text-xs text-gray-500">
          <Link href={`/${locale}/signup`} className="underline hover:text-gray-300 transition-colors">
            {ctaFree}
          </Link>
        </p>
      )}
    </div>
  );
}
