"use client";

import { useState } from "react";
import { Check, Zap, Shield, Building2, Mail, RefreshCw, Sparkles } from "lucide-react";
import CheckoutButton from "@/components/CheckoutButton";

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
  enterpriseDesc: string;
  contactUs: string;
  getStarted: string;
  popular: string;
  custom: string;
  starterFeatures: string[];
  proFeatures: string[];
  enterpriseFeatures: string[];
}> = {
  fr: {
    toggleMonthly: "Mensuel",
    toggleAnnual: "Annuel",
    saveLabel: "-28%",
    perMonth: "/mois",
    perYear: "/an",
    billedAnnually: "facturé annuellement",
    trial: "14 jours gratuits · sans CB",
    guarantee: "Sans engagement · Remboursement 14 jours",
    starterDesc: "Pour découvrir la plateforme sans engagement.",
    proDesc: "Pour les professionnels de santé qui suivent l'épidémiologie mondiale.",
    enterpriseDesc: "Pour les gouvernements et grands groupes pharmaceutiques.",
    contactUs: "Nous contacter",
    getStarted: "Commencer →",
    popular: "Le plus populaire",
    custom: "Sur devis",
    starterFeatures: ["Carte mondiale interactive", "1 région surveillée", "Données OMS en direct", "Digest hebdomadaire gratuit", "Tableau de bord multilingue"],
    proFeatures: ["Toutes les régions mondiales", "Alertes en temps réel", "Rapports PDF automatiques", "Intégration Slack / Teams", "Export CSV illimité", "Support prioritaire"],
    enterpriseFeatures: ["Tout le plan Pro", "Accès API REST + docs", "Déploiement on-premise", "SLA 99,9 % garanti", "Account manager dédié", "Support dédié 24/7"],
  },
  en: {
    toggleMonthly: "Monthly",
    toggleAnnual: "Annual",
    saveLabel: "-28%",
    perMonth: "/month",
    perYear: "/year",
    billedAnnually: "billed annually",
    trial: "14-day free trial · no CC required",
    guarantee: "No commitment · 14-day refund",
    starterDesc: "Explore the platform with no commitment.",
    proDesc: "For health professionals tracking global epidemiology.",
    enterpriseDesc: "For governments and large pharmaceutical groups.",
    contactUs: "Contact us",
    getStarted: "Get started →",
    popular: "Most popular",
    custom: "Custom",
    starterFeatures: ["Interactive world map", "1 monitored region", "Live WHO data", "Free weekly digest", "Multilingual dashboard"],
    proFeatures: ["All global regions", "Real-time alerts", "Automatic PDF reports", "Slack / Teams integration", "Unlimited CSV export", "Priority support"],
    enterpriseFeatures: ["Everything in Pro", "REST API access + docs", "On-premise deployment", "99.9% SLA guarantee", "Dedicated account manager", "24/7 dedicated support"],
  },
  es: {
    toggleMonthly: "Mensual",
    toggleAnnual: "Anual",
    saveLabel: "-28%",
    perMonth: "/mes",
    perYear: "/año",
    billedAnnually: "facturado anualmente",
    trial: "14 días gratis · sin tarjeta",
    guarantee: "Sin compromiso · Reembolso 14 días",
    starterDesc: "Explore la plataforma sin compromiso.",
    proDesc: "Para profesionales de salud que siguen la epidemiología global.",
    enterpriseDesc: "Para gobiernos y grandes grupos farmacéuticos.",
    contactUs: "Contáctenos",
    getStarted: "Empezar →",
    popular: "Más popular",
    custom: "A medida",
    starterFeatures: ["Mapa mundial interactivo", "1 región monitoreada", "Datos OMS en vivo", "Digest semanal gratuito", "Panel multilingüe"],
    proFeatures: ["Todas las regiones", "Alertas en tiempo real", "Informes PDF automáticos", "Integración Slack / Teams", "Exportación CSV ilimitada", "Soporte prioritario"],
    enterpriseFeatures: ["Todo lo de Pro", "Acceso API REST + docs", "Implementación on-premise", "SLA 99,9% garantizado", "Gestor de cuenta dedicado", "Soporte 24/7 dedicado"],
  },
  ar: {
    toggleMonthly: "شهري",
    toggleAnnual: "سنوي",
    saveLabel: "‎-28%",
    perMonth: "/شهر",
    perYear: "/سنة",
    billedAnnually: "يُفوتر سنوياً",
    trial: "14 يوماً مجاناً · بدون بطاقة",
    guarantee: "بدون التزام · استرداد 14 يوماً",
    starterDesc: "استكشف المنصة دون أي التزام.",
    proDesc: "للمختصين الصحيين الذين يتابعون الأوبئة العالمية.",
    enterpriseDesc: "للحكومات وكبرى مجموعات الأدوية.",
    contactUs: "اتصل بنا",
    getStarted: "ابدأ الآن ←",
    popular: "الأكثر شعبية",
    custom: "حسب الطلب",
    starterFeatures: ["خريطة العالم التفاعلية", "منطقة مراقبة واحدة", "بيانات WHO المباشرة", "ملخص أسبوعي مجاني", "لوحة تحكم متعددة اللغات"],
    proFeatures: ["جميع المناطق العالمية", "تنبيهات فورية", "تقارير PDF تلقائية", "تكامل Slack / Teams", "تصدير CSV غير محدود", "دعم ذو أولوية"],
    enterpriseFeatures: ["كل ما في Pro", "الوصول لـ REST API + التوثيق", "نشر محلي", "ضمان SLA 99.9%", "مدير حساب مخصص", "دعم مخصص 24/7"],
  },
  id: {
    toggleMonthly: "Bulanan",
    toggleAnnual: "Tahunan",
    saveLabel: "-28%",
    perMonth: "/bulan",
    perYear: "/tahun",
    billedAnnually: "ditagih tahunan",
    trial: "14 hari gratis · tanpa kartu",
    guarantee: "Tanpa komitmen · Pengembalian 14 hari",
    starterDesc: "Jelajahi platform tanpa komitmen.",
    proDesc: "Untuk profesional kesehatan yang memantau epidemiologi global.",
    enterpriseDesc: "Untuk pemerintah dan kelompok farmasi besar.",
    contactUs: "Hubungi kami",
    getStarted: "Mulai →",
    popular: "Paling populer",
    custom: "Kustom",
    starterFeatures: ["Peta dunia interaktif", "1 wilayah dipantau", "Data WHO langsung", "Digest mingguan gratis", "Dasbor multibahasa"],
    proFeatures: ["Semua wilayah global", "Peringatan real-time", "Laporan PDF otomatis", "Integrasi Slack / Teams", "Ekspor CSV tak terbatas", "Dukungan prioritas"],
    enterpriseFeatures: ["Semua fitur Pro", "Akses REST API + dokumentasi", "Penerapan on-premise", "Jaminan SLA 99,9%", "Manajer akun khusus", "Dukungan 24/7 khusus"],
  },
};

// Pro: €29/month | Annual (−28%): €249/year — saves €99/year vs monthly
const PRICES: Record<string, { proMonthly: string; proAnnual: string; proAnnualTotal: string }> = {
  fr: { proMonthly: "29 €",  proAnnual: "249 €", proAnnualTotal: "économisez 99 €"  },
  en: { proMonthly: "€29",   proAnnual: "€249",  proAnnualTotal: "save €99"          },
  es: { proMonthly: "€29",   proAnnual: "€249",  proAnnualTotal: "ahorre €99"        },
  ar: { proMonthly: "€29",   proAnnual: "€249",  proAnnualTotal: "وفّر 99 €"         },
  id: { proMonthly: "€29",   proAnnual: "€249",  proAnnualTotal: "hemat €99"         },
};

export default function PricingCards({ locale }: { locale: string }) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const c = COPY[locale] ?? COPY.en;
  const p = PRICES[locale] ?? PRICES.en;
  const isAnnual = billing === "annual";

  return (
    <div className="space-y-6">

      {/* ── Billing toggle ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit mx-auto">
        <button
          onClick={() => setBilling("monthly")}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            billing === "monthly"
              ? "bg-gray-700 text-white shadow"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {c.toggleMonthly}
        </button>
        <button
          onClick={() => setBilling("annual")}
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
              <span className="text-green-400 font-semibold text-sm uppercase tracking-wide">Free</span>
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
              <p className="text-xs text-green-400 mt-1">{p.proAnnualTotal} · {c.billedAnnually}</p>
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

          {/* Trial badge */}
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <Sparkles className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-xs text-red-300 font-medium">{c.trial}</span>
          </div>

          <CheckoutButton
            plan="pro"
            locale={locale}
            label={c.getStarted}
            billing={billing}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
          />

          {/* Guarantee */}
          <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl p-3 text-xs text-gray-400 border border-gray-700/50">
            <RefreshCw className="w-3.5 h-3.5 text-green-400 shrink-0" />
            {c.guarantee}
          </div>
        </div>

        {/* Enterprise */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-semibold text-sm uppercase tracking-wide">Enterprise</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">{c.custom}</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">{c.enterpriseDesc}</p>
          </div>
          <ul className="space-y-3">
            {c.enterpriseFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
          <a
            href={`mailto:contact@healthwatch-global.com?subject=Enterprise Plan - HealthWatch Global`}
            className="flex items-center justify-center gap-2 w-full bg-purple-700 hover:bg-purple-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            {c.contactUs}
          </a>
        </div>
      </div>
    </div>
  );
}
