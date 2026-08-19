"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics/react";
import { Check, Zap, Shield, Users, RefreshCw, Sparkles, Clock, AlertTriangle, Building2 } from "lucide-react";
import CheckoutButton from "@/components/CheckoutButton";
import { createClient } from "@/lib/supabase-browser";
import { PRICE_DISPLAY } from "@/lib/pricing";

type Billing = "monthly" | "annual";

// Localized copy
const COPY: Record<string, {
  toggleMonthly: string;
  toggleAnnual: string;
  saveLabel: string;
  perMonth: string;
  perYear: string;
  billedAnnually: string;
  trial: string;
  guarantee: string;
  starterDesc: string;
  proDesc: string;
  teamDesc: string;
  contactUs: string;
  getStarted: string;
  popular: string;
  forOrgs: string;
  freeBadge: string;
  teamSeats: string;
  starterFeatures: string[];
  proFeatures: string[];
  teamFeatures: string[];
}> = {
  fr: {
    toggleMonthly: "Mensuel",
    toggleAnnual: "Annuel",
    saveLabel: "-28%",
    perMonth: "/mois",
    perYear: "/an",
    billedAnnually: "facturé annuellement",
    trial: "14 jours gratuits · carte requise, aucun débit avant la fin de l'essai",
    guarantee: "Sans engagement · Remboursement 14 jours",
    starterDesc: "Pour découvrir la plateforme sans engagement.",
    proDesc: "Pour les professionnels de santé qui suivent l'épidémiologie mondiale.",
    teamDesc: "Votre équipe de surveillance travaille depuis une vue unique classifiée — sans croiser plusieurs sources. 5 sièges Pro, une seule facture institutionnelle.",
    contactUs: "Nous contacter",
    getStarted: "Commencer →",
    popular: "Le plus populaire",
    forOrgs: "Pour organisations",
    freeBadge: "Gratuit",
    teamSeats: "5 sièges",
    starterFeatures: ["Carte mondiale interactive", "1 région surveillée", "Données OMS (sync ≤6h)", "Digest hebdomadaire gratuit", "Tableau de bord multilingue"],
    proFeatures: ["Toutes les régions mondiales", "Graphiques de tendance + comparaison", "Alertes instantanées", "Alertes par maladie (Mpox, Ebola, Choléra...)", "Rapports PDF & export CSV", "Intégration Slack / Teams", "Support prioritaire"],
    teamFeatures: ["5 sièges inclus", "Toutes les régions mondiales", "Alertes instantanées", "Rapports PDF · Export CSV", "Intégration Slack / Teams", "Une seule facture institutionnelle", "SLA 99,9 % écrit + DPA disponible"],
  },
  en: {
    toggleMonthly: "Monthly",
    toggleAnnual: "Annual",
    saveLabel: "-28%",
    perMonth: "/month",
    perYear: "/year",
    billedAnnually: "billed annually",
    trial: "14-day free trial · card required, no charge until it ends",
    guarantee: "No commitment · 14-day refund",
    starterDesc: "Explore the platform with no commitment.",
    proDesc: "For health professionals tracking global epidemiology.",
    teamDesc: "Your surveillance team works from one classified view — no cross-referencing across sources. 5 Pro seats, single institutional invoice.",
    contactUs: "Contact us",
    getStarted: "Get started →",
    popular: "Most popular",
    forOrgs: "For organizations",
    freeBadge: "Free",
    teamSeats: "5 seats",
    starterFeatures: ["Interactive world map", "1 monitored region", "WHO data (sync ≤6h)", "Free weekly digest", "Multilingual dashboard"],
    proFeatures: ["All global regions", "Case trend charts + comparison", "Instant alerts", "Disease-specific alerts (Mpox, Ebola, Cholera...)", "PDF reports & CSV export", "Slack / Teams integration", "Priority support"],
    teamFeatures: ["5 seats included", "All global regions", "Instant alerts", "PDF reports · CSV export", "Slack / Teams integration", "Single institutional invoice", "Written 99.9% SLA + DPA available"],
  },
  es: {
    toggleMonthly: "Mensual",
    toggleAnnual: "Anual",
    saveLabel: "-28%",
    perMonth: "/mes",
    perYear: "/año",
    billedAnnually: "facturado anualmente",
    trial: "14 días gratis · tarjeta requerida, sin cobro hasta que termine",
    guarantee: "Sin compromiso · Reembolso 14 días",
    starterDesc: "Explore la plataforma sin compromiso.",
    proDesc: "Para profesionales de salud que siguen la epidemiología global.",
    teamDesc: "Su equipo de vigilancia trabaja desde una vista clasificada única — sin cruzar fuentes. 5 puestos Pro, una sola factura institucional.",
    contactUs: "Contáctenos",
    getStarted: "Empezar →",
    popular: "Más popular",
    forOrgs: "Para organizaciones",
    freeBadge: "Gratis",
    teamSeats: "5 puestos",
    starterFeatures: ["Mapa mundial interactivo", "1 región monitoreada", "Datos OMS (sync ≤6h)", "Digest semanal gratuito", "Panel multilingüe"],
    proFeatures: ["Todas las regiones", "Gráficos de tendencia + comparación", "Alertas instantáneas", "Alertas por enfermedad (Mpox, Ébola, Cólera...)", "Informes PDF y CSV", "Integración Slack / Teams", "Soporte prioritario"],
    teamFeatures: ["5 puestos incluidos", "Todas las regiones", "Alertas instantáneas", "Informes PDF · CSV", "Integración Slack / Teams", "Una sola factura institucional", "SLA 99,9% escrito + DPA disponible"],
  },
  ar: {
    toggleMonthly: "شهري",
    toggleAnnual: "سنوي",
    saveLabel: "‎-28%",
    perMonth: "/شهر",
    perYear: "/سنة",
    billedAnnually: "يُفوتر سنوياً",
    trial: "14 يوماً مجاناً · البطاقة مطلوبة، لا خصم قبل انتهاء التجربة",
    guarantee: "بدون التزام · استرداد 14 يوماً",
    starterDesc: "استكشف المنصة دون أي التزام.",
    proDesc: "للمختصين الصحيين الذين يتابعون الأوبئة العالمية.",
    teamDesc: "فريق المراقبة لديك يعمل من عرض موحد ومصنّف — دون الحاجة لمقاطعة المصادر. 5 مقاعد Pro في فاتورة مؤسسية واحدة.",
    contactUs: "اتصل بنا",
    getStarted: "ابدأ الآن ←",
    popular: "الأكثر شعبية",
    forOrgs: "للمؤسسات",
    freeBadge: "مجاني",
    teamSeats: "5 مقاعد",
    starterFeatures: ["خريطة العالم التفاعلية", "منطقة مراقبة واحدة", "بيانات WHO (sync ≤6س)", "ملخص أسبوعي مجاني", "لوحة تحكم متعددة اللغات"],
    proFeatures: ["جميع المناطق العالمية", "مخططات الاتجاه + المقارنة", "تنبيهات فورية", "تنبيهات خاصة بالأمراض (Mpox، إيبولا، كوليرا...)", "تقارير PDF وتصدير CSV", "تكامل Slack / Teams", "دعم ذو أولوية"],
    teamFeatures: ["5 مقاعد مشمولة", "جميع المناطق العالمية", "تنبيهات فورية", "تقارير PDF · تصدير CSV", "تكامل Slack / Teams", "فاتورة مؤسسية واحدة", "SLA 99.9% مكتوب + DPA متاحة"],
  },
  id: {
    toggleMonthly: "Bulanan",
    toggleAnnual: "Tahunan",
    saveLabel: "-28%",
    perMonth: "/bulan",
    perYear: "/tahun",
    billedAnnually: "ditagih tahunan",
    trial: "14 hari gratis · kartu diperlukan, tidak ada tagihan sebelum berakhir",
    guarantee: "Tanpa komitmen · Pengembalian 14 hari",
    starterDesc: "Jelajahi platform tanpa komitmen.",
    proDesc: "Untuk profesional kesehatan yang memantau epidemiologi global.",
    teamDesc: "Tim surveilans Anda bekerja dari satu tampilan terklasifikasi — tanpa perlu menyilangkan berbagai sumber. 5 kursi Pro, satu faktur institusional.",
    contactUs: "Hubungi kami",
    getStarted: "Mulai →",
    popular: "Paling populer",
    forOrgs: "Untuk organisasi",
    freeBadge: "Gratis",
    teamSeats: "5 kursi",
    starterFeatures: ["Peta dunia interaktif", "1 wilayah dipantau", "Data WHO (sync ≤6j)", "Digest mingguan gratis", "Dasbor multibahasa"],
    proFeatures: ["Semua wilayah global", "Grafik tren + perbandingan wabah", "Peringatan instan", "Peringatan per penyakit (Mpox, Ebola, Kolera...)", "Laporan PDF & ekspor CSV", "Integrasi Slack / Teams", "Dukungan prioritas"],
    teamFeatures: ["5 kursi termasuk", "Semua wilayah global", "Peringatan instan", "Laporan PDF · Ekspor CSV", "Integrasi Slack / Teams", "Satu faktur institusional", "SLA 99,9% tertulis + DPA tersedia"],
  },
};

const TRIAL_COPY: Record<string, {
  daysLeft: (n: number) => string;
  trialExpired: string;
  upgradeNow: string;
  subscribed: string;
}> = {
  fr: {
    daysLeft: (n) => `${n} jour${n > 1 ? "s" : ""} restant${n > 1 ? "s" : ""} dans votre essai Pro`,
    trialExpired: "Votre essai a expiré — réactivez l'accès maintenant",
    upgradeNow: "Activer mon abonnement →",
    subscribed: "Votre plan actuel ✓",
  },
  en: {
    daysLeft: (n) => `${n} day${n > 1 ? "s" : ""} left in your Pro trial`,
    trialExpired: "Your trial has ended — reactivate now",
    upgradeNow: "Activate subscription →",
    subscribed: "Your current plan ✓",
  },
  es: {
    daysLeft: (n) => `Quedan ${n} día${n > 1 ? "s" : ""} en su prueba Pro`,
    trialExpired: "Su prueba ha caducado — reactive ahora",
    upgradeNow: "Activar suscripción →",
    subscribed: "Su plan actual ✓",
  },
  ar: {
    daysLeft: (n) => `تبقّى ${n} يوم في تجربتك المجانية`,
    trialExpired: "انتهت تجربتك المجانية — جدّد الاشتراك الآن",
    upgradeNow: "تفعيل الاشتراك ←",
    subscribed: "خطتك الحالية ✓",
  },
  id: {
    daysLeft: (n) => `${n} hari tersisa dalam uji coba Pro Anda`,
    trialExpired: "Uji coba Anda telah berakhir — aktifkan kembali sekarang",
    upgradeNow: "Aktifkan langganan →",
    subscribed: "Paket Anda saat ini ✓",
  },
};

// To update prices, edit lib/pricing.ts only.
const PRICES: Record<string, {
  proMonthly: string; proAnnual: string; proAnnualTotal: string; proAnnualPerMonth: string;
  teamMonthly: string; teamAnnual: string; teamAnnualTotal: string; teamAnnualPerMonth: string;
}> = {
  fr: { proMonthly: PRICE_DISPLAY.fr.proMonthly, proAnnual: PRICE_DISPLAY.fr.proAnnual, proAnnualTotal: `économisez ${PRICE_DISPLAY.fr.proAnnualSavings}`, proAnnualPerMonth: "21 €", teamMonthly: PRICE_DISPLAY.fr.teamMonthly, teamAnnual: PRICE_DISPLAY.fr.teamAnnual, teamAnnualTotal: `économisez ${PRICE_DISPLAY.fr.teamAnnualSavings}`, teamAnnualPerMonth: "108 €" },
  en: { proMonthly: PRICE_DISPLAY.en.proMonthly, proAnnual: PRICE_DISPLAY.en.proAnnual, proAnnualTotal: `save ${PRICE_DISPLAY.en.proAnnualSavings}`,         proAnnualPerMonth: "$21",   teamMonthly: PRICE_DISPLAY.en.teamMonthly, teamAnnual: PRICE_DISPLAY.en.teamAnnual, teamAnnualTotal: `save ${PRICE_DISPLAY.en.teamAnnualSavings}`,   teamAnnualPerMonth: "$119" },
  es: { proMonthly: PRICE_DISPLAY.es.proMonthly, proAnnual: PRICE_DISPLAY.es.proAnnual, proAnnualTotal: `ahorre ${PRICE_DISPLAY.es.proAnnualSavings}`,       proAnnualPerMonth: "€21",   teamMonthly: PRICE_DISPLAY.es.teamMonthly, teamAnnual: PRICE_DISPLAY.es.teamAnnual, teamAnnualTotal: `ahorre ${PRICE_DISPLAY.es.teamAnnualSavings}`,   teamAnnualPerMonth: "€108" },
  ar: { proMonthly: PRICE_DISPLAY.ar.proMonthly, proAnnual: PRICE_DISPLAY.ar.proAnnual, proAnnualTotal: `وفّر ${PRICE_DISPLAY.ar.proAnnualSavings}`,          proAnnualPerMonth: "€21",   teamMonthly: PRICE_DISPLAY.ar.teamMonthly, teamAnnual: PRICE_DISPLAY.ar.teamAnnual, teamAnnualTotal: `وفّر ${PRICE_DISPLAY.ar.teamAnnualSavings}`,    teamAnnualPerMonth: "€108" },
  id: { proMonthly: PRICE_DISPLAY.id.proMonthly, proAnnual: PRICE_DISPLAY.id.proAnnual, proAnnualTotal: `hemat ${PRICE_DISPLAY.id.proAnnualSavings}`,         proAnnualPerMonth: "€21",   teamMonthly: PRICE_DISPLAY.id.teamMonthly, teamAnnual: PRICE_DISPLAY.id.teamAnnual, teamAnnualTotal: `hemat ${PRICE_DISPLAY.id.teamAnnualSavings}`,    teamAnnualPerMonth: "€108" },
};

export default function PricingCards({ locale }: { locale: string }) {
  const [billing, setBilling] = useState<Billing>("annual");
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [pilotInfo, setPilotInfo] = useState<{ isPilot: boolean; organization: string | null } | null>(null);
  const c = COPY[locale] ?? COPY.en;
  const p = PRICES[locale] ?? PRICES.en;
  const tc = TRIAL_COPY[locale] ?? TRIAL_COPY.en;
  const isAnnual = billing === "annual";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id, is_pilot, pilot_organization")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.stripe_subscription_id) {
            setCurrentPlan(data.plan ?? "pro");
            return;
          }
          if (data?.trial_ends_at && data?.plan !== "free") {
            const daysLeft = Math.max(0, Math.ceil(
              (new Date(data.trial_ends_at).getTime() - Date.now()) / 86_400_000
            ));
            if (daysLeft > 0) setTrialDaysLeft(daysLeft);
            else setTrialExpired(true);
          }
          // Institutional pilot without billing yet — same "reply to discuss
          // Team plan" framing as the account page / TrialBanner / UpgradeModal
          // / FreePlanBanner, instead of a self-serve checkout on either card.
          if (data?.is_pilot) {
            setPilotInfo({ isPilot: true, organization: (data.pilot_organization as string | null) ?? null });
          }
        });
    });
  }, []);

  const isProSubscribed  = currentPlan === "pro";
  const isTeamSubscribed = currentPlan === "team";
  const isPilotPending   = !!pilotInfo?.isPilot;
  const pilotOrg = pilotInfo?.organization || (locale === "fr" ? "votre organisation" : "your organization");
  const pilotMailtoHref = "mailto:david.deheunynck@gmail.com?subject=" + encodeURIComponent(
    locale === "fr" ? `Suite du pilote — ${pilotOrg}` : `Following up on our pilot — ${pilotOrg}`
  );
  const pilotCtaLabel =
    locale === "fr" ? "Répondre pour en discuter →" :
    locale === "es" ? "Responder para hablar →" :
    locale === "ar" ? "← الرد للمناقشة" :
    locale === "id" ? "Balas untuk berdiskusi →" :
    "Reply to discuss →";

  return (
    <div className="space-y-6">

      {/* ── Billing toggle ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit mx-auto">
        <button
          onClick={() => { setBilling("monthly"); track("pricing_billing_toggle", { billing: "monthly" }); }}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            billing === "monthly"
              ? "bg-gray-700 text-white shadow"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {c.toggleMonthly}
        </button>
        <button
          onClick={() => { setBilling("annual"); track("pricing_billing_toggle", { billing: "annual" }); }}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            billing === "annual"
              ? "bg-gray-700 text-white shadow"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {c.toggleAnnual}
          <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full border border-green-500/30">
            {c.saveLabel}
          </span>
        </button>
      </div>

      {/* ── Cards ───────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6 items-start">

        {/* Free */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-semibold text-sm uppercase tracking-wide">{c.freeBadge}</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">0 €</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">{c.starterDesc}</p>
          </div>
          <ul className="space-y-3">
            {c.starterFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
          <a
            href={`/${locale}/signup`}
            className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {c.getStarted}
          </a>
        </div>

        {/* Pro — highlighted */}
        <div className="bg-gray-900 border-2 border-red-500 rounded-2xl p-6 space-y-6 relative">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="bg-red-600 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
              {c.popular}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-semibold text-sm uppercase tracking-wide">Pro</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">
                {isAnnual ? p.proAnnual : p.proMonthly}
              </span>
              <span className="text-gray-400 mb-1">{isAnnual ? c.perYear : c.perMonth}</span>
            </div>
            {isAnnual && (
              <>
                <p className="text-xs text-green-400 mt-1">{p.proAnnualPerMonth}{c.perMonth} · {p.proAnnualTotal}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.billedAnnually}</p>
              </>
            )}
            <p className="text-gray-400 text-sm mt-2">{c.proDesc}</p>
          </div>
          <ul className="space-y-3">
            {c.proFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>

          {/* Trial badge / countdown / expired */}
          {trialExpired ? (
            <div className="flex items-center gap-2 bg-red-600/15 border border-red-500/40 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-300 font-semibold">{tc.trialExpired}</span>
            </div>
          ) : trialDaysLeft !== null ? (
            <div className={`flex items-center gap-2 rounded-xl p-3 border ${
              trialDaysLeft <= 3
                ? "bg-red-600/15 border-red-500/40"
                : "bg-amber-500/10 border-amber-500/25"
            }`}>
              <Clock className={`w-4 h-4 shrink-0 ${trialDaysLeft <= 3 ? "text-red-400" : "text-amber-400"}`} />
              <span className={`text-xs font-semibold ${trialDaysLeft <= 3 ? "text-red-300" : "text-amber-300"}`}>
                {tc.daysLeft(trialDaysLeft)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <Sparkles className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-300 font-medium">{c.trial}</span>
            </div>
          )}

          {isProSubscribed ? (
            <div className="w-full flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/25 text-green-400 font-semibold py-2.5 rounded-lg text-sm">
              <Check className="w-4 h-4" />
              {tc.subscribed}
            </div>
          ) : isPilotPending ? (
            <a
              href={pilotMailtoHref}
              className="w-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {pilotCtaLabel}
            </a>
          ) : (
            <CheckoutButton
              plan="pro"
              locale={locale}
              label={trialDaysLeft !== null || trialExpired ? tc.upgradeNow : c.getStarted}
              billing={billing}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
            />
          )}

          {/* Guarantee */}
          <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl p-3 text-xs text-gray-400 border border-gray-700/50">
            <RefreshCw className="w-3.5 h-3.5 text-green-400 shrink-0" />
            {c.guarantee}
          </div>
        </div>

        {/* Team */}
        <div className="bg-gray-900 border-2 border-amber-600/60 rounded-2xl p-6 space-y-6 relative">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span className="bg-amber-700 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
              {c.forOrgs}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-semibold text-sm uppercase tracking-wide">Team</span>
              <span className="text-xs text-amber-600 font-medium bg-amber-900/20 border border-amber-700/30 px-2 py-0.5 rounded-full">{c.teamSeats}</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">
                {isAnnual ? p.teamAnnual : p.teamMonthly}
              </span>
              <span className="text-gray-400 mb-1">{isAnnual ? c.perYear : c.perMonth}</span>
            </div>
            {isAnnual && (
              <>
                <p className="text-xs text-green-400 mt-1">{p.teamAnnualPerMonth}{c.perMonth} · {p.teamAnnualTotal}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.billedAnnually}</p>
              </>
            )}
            <p className="text-gray-400 text-sm mt-2">{c.teamDesc}</p>
          </div>
          <ul className="space-y-3">
            {c.teamFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>

          {/* Trial badge / countdown — same mechanism as the Pro card above:
              trial_ends_at only ever gets set alongside plan="pro" (see
              lib/activate-trial.ts, app/api/admin/invite/route.ts), so a
              trialDaysLeft !== null here means a Pro-trial user considering
              Team, and tc.daysLeft's "your Pro trial" copy is accurate. */}
          {trialExpired ? (
            <div className="flex items-center gap-2 bg-red-600/15 border border-red-500/40 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-300 font-semibold">{tc.trialExpired}</span>
            </div>
          ) : trialDaysLeft !== null ? (
            <div className={`flex items-center gap-2 rounded-xl p-3 border ${
              trialDaysLeft <= 3
                ? "bg-red-600/15 border-red-500/40"
                : "bg-amber-500/10 border-amber-500/25"
            }`}>
              <Clock className={`w-4 h-4 shrink-0 ${trialDaysLeft <= 3 ? "text-red-400" : "text-amber-400"}`} />
              <span className={`text-xs font-semibold ${trialDaysLeft <= 3 ? "text-red-300" : "text-amber-300"}`}>
                {tc.daysLeft(trialDaysLeft)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-300 font-medium">{c.trial}</span>
            </div>
          )}

          {isTeamSubscribed ? (
            <div className="w-full flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/25 text-green-400 font-semibold py-2.5 rounded-lg text-sm">
              <Check className="w-4 h-4" />
              {tc.subscribed}
            </div>
          ) : isPilotPending ? (
            <a
              href={pilotMailtoHref}
              className="w-full flex items-center justify-center bg-amber-700 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {pilotCtaLabel}
            </a>
          ) : (
            <CheckoutButton
              plan="team"
              locale={locale}
              label={c.getStarted}
              billing={billing}
              className="w-full bg-amber-700 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
            />
          )}

          <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl p-3 text-xs text-gray-400 border border-gray-700/50">
            <RefreshCw className="w-3.5 h-3.5 text-green-400 shrink-0" />
            {c.guarantee}
          </div>
        </div>
      </div>

      {/* ── Enterprise strip ─────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-purple-400 shrink-0" />
          <div>
            <span className="text-purple-400 font-semibold text-sm">Enterprise</span>
            <span className="text-gray-500 text-sm"> — </span>
            <span className="text-gray-400 text-sm">
              {locale === "fr" ? "API REST · déploiement on-premise · SLA 99,9 % · account manager dédié" :
               locale === "es" ? "API REST · despliegue on-premise · SLA 99,9% · gestor de cuenta dedicado" :
               locale === "ar" ? "API REST · نشر محلي · ضمان SLA 99.9% · مدير حساب مخصص" :
               locale === "id" ? "API REST · penerapan on-premise · SLA 99,9% · manajer akun khusus" :
               "REST API · on-premise deployment · 99.9% SLA · dedicated account manager"}
            </span>
          </div>
        </div>
        <Link
          href={`/${locale}/contact`}
          className="shrink-0 text-sm bg-purple-700 hover:bg-purple-600 text-white font-semibold px-5 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {c.contactUs}
        </Link>
      </div>
    </div>
  );
}
