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
    saveLabel: "-20%",
    perMonth: "/mois",
    perYear: "/an",
    billedAnnually: "facturé annuellement",
    trial: "14 jours gratuits · sans CB",
    guarantee: "Sans engagement · Remboursement 14 jours",
    starterDesc: "Pour les ONG locales et hôpitaux régionaux.",
    proDesc: "Pour les ministères de la santé et ONG internationales.",
    enterpriseDesc: "Pour les gouvernements et grands groupes pharmaceutiques.",
    contactUs: "Nous contacter",
    getStarted: "Commencer →",
    popular: "Le plus populaire",
    custom: "Sur devis",
    starterFeatures: ["3 régions surveillées", "Alertes email régionales", "Export CSV des données", "Tableau de bord multilingue", "Données OMS + CDC"],
    proFeatures: ["Toutes les régions mondiales", "Alertes en temps réel", "Rapports PDF automatiques", "Intégration Slack / Teams", "Export CSV illimité", "Support prioritaire"],
    enterpriseFeatures: ["Tout le plan Pro", "Accès API REST + docs", "Déploiement on-premise", "SLA 99,9 % garanti", "Account manager dédié", "Support dédié 24/7"],
  },
  en: {
    toggleMonthly: "Monthly",
    toggleAnnual: "Annual",
    saveLabel: "-20%",
    perMonth: "/month",
    perYear: "/year",
    billedAnnually: "billed annually",
    trial: "14-day free trial · no CC required",
    guarantee: "No commitment · 14-day refund",
    starterDesc: "For local NGOs and regional hospitals.",
    proDesc: "For health ministries and international NGOs.",
    enterpriseDesc: "For governments and large pharmaceutical groups.",
    contactUs: "Contact us",
    getStarted: "Get started →",
    popular: "Most popular",
    custom: "Custom",
    starterFeatures: ["3 monitored regions", "Regional email alerts", "CSV data export", "Multilingual dashboard", "WHO + CDC data"],
    proFeatures: ["All global regions", "Real-time alerts", "Automatic PDF reports", "Slack / Teams integration", "Unlimited CSV export", "Priority support"],
    enterpriseFeatures: ["Everything in Pro", "REST API access + docs", "On-premise deployment", "99.9% SLA guarantee", "Dedicated account manager", "24/7 dedicated support"],
  },
  es: {
    toggleMonthly: "Mensual",
    toggleAnnual: "Anual",
    saveLabel: "-20%",
    perMonth: "/mes",
    perYear: "/año",
    billedAnnually: "facturado anualmente",
    trial: "14 días gratis · sin tarjeta",
    guarantee: "Sin compromiso · Reembolso 14 días",
    starterDesc: "Para ONG locales y hospitales regionales.",
    proDesc: "Para ministerios de salud y ONG internacionales.",
    enterpriseDesc: "Para gobiernos y grandes grupos farmacéuticos.",
    contactUs: "Contáctenos",
    getStarted: "Empezar →",
    popular: "Más popular",
    custom: "A medida",
    starterFeatures: ["3 regiones monitoreadas", "Alertas email regionales", "Exportación CSV", "Panel multilingüe", "Datos OMS + CDC"],
    proFeatures: ["Todas las regiones", "Alertas en tiempo real", "Informes PDF automáticos", "Integración Slack / Teams", "Exportación CSV ilimitada", "Soporte prioritario"],
    enterpriseFeatures: ["Todo lo de Pro", "Acceso API REST + docs", "Implementación on-premise", "SLA 99,9% garantizado", "Gestor de cuenta dedicado", "Soporte 24/7 dedicado"],
  },
  ar: {
    toggleMonthly: "شهري",
    toggleAnnual: "سنوي",
    saveLabel: "‎-20%",
    perMonth: "/شهر",
    perYear: "/سنة",
    billedAnnually: "يُفوتر سنوياً",
    trial: "14 يوماً مجاناً · بدون بطاقة",
    guarantee: "بدون التزام · استرداد 14 يوماً",
    starterDesc: "للمنظمات غير الحكومية المحلية والمستشفيات الإقليمية.",
    proDesc: "لوزارات الصحة والمنظمات غير الحكومية الدولية.",
    enterpriseDesc: "للحكومات وكبرى مجموعات الأدوية.",
    contactUs: "اتصل بنا",
    getStarted: "ابدأ الآن ←",
    popular: "الأكثر شعبية",
    custom: "حسب الطلب",
    starterFeatures: ["3 مناطق مراقبة", "تنبيهات بريدية إقليمية", "تصدير CSV", "لوحة تحكم متعددة اللغات", "بيانات WHO + CDC"],
    proFeatures: ["جميع المناطق العالمية", "تنبيهات فورية", "تقارير PDF تلقائية", "تكامل Slack / Teams", "تصدير CSV غير محدود", "دعم ذو أولوية"],
    enterpriseFeatures: ["كل ما في Pro", "الوصول لـ REST API + التوثيق", "نشر محلي", "ضمان SLA 99.9%", "مدير حساب مخصص", "دعم مخصص 24/7"],
  },
  id: {
    toggleMonthly: "Bulanan",
    toggleAnnual: "Tahunan",
    saveLabel: "-20%",
    perMonth: "/bulan",
    perYear: "/tahun",
    billedAnnually: "ditagih tahunan",
    trial: "14 hari gratis · tanpa kartu",
    guarantee: "Tanpa komitmen · Pengembalian 14 hari",
    starterDesc: "Untuk LSM lokal dan rumah sakit regional.",
    proDesc: "Untuk kementerian kesehatan dan LSM internasional.",
    enterpriseDesc: "Untuk pemerintah dan kelompok farmasi besar.",
    contactUs: "Hubungi kami",
    getStarted: "Mulai →",
    popular: "Paling populer",
    custom: "Kustom",
    starterFeatures: ["3 wilayah dipantau", "Peringatan email regional", "Ekspor data CSV", "Dasbor multibahasa", "Data WHO + CDC"],
    proFeatures: ["Semua wilayah global", "Peringatan real-time", "Laporan PDF otomatis", "Integrasi Slack / Teams", "Ekspor CSV tak terbatas", "Dukungan prioritas"],
    enterpriseFeatures: ["Semua fitur Pro", "Akses REST API + dokumentasi", "Penerapan on-premise", "Jaminan SLA 99,9%", "Manajer akun khusus", "Dukungan 24/7 khusus"],
  },
};

// Prices per locale
const PRICES: Record<string, { starterMonthly: string; starterAnnual: string; starterAnnualTotal: string; proMonthly: string; proAnnual: string; proAnnualTotal: string }> = {
  // Monthly: Starter €29 / Pro €79 | Annual (−20%): Starter €23 / Pro €63
  fr: { starterMonthly: "29 €",  starterAnnual: "23 €",  starterAnnualTotal: "276 €/an",   proMonthly: "79 €",  proAnnual: "63 €",  proAnnualTotal: "756 €/an"   },
  en: { starterMonthly: "$29",   starterAnnual: "$23",   starterAnnualTotal: "$276/yr",     proMonthly: "$79",   proAnnual: "$63",   proAnnualTotal: "$756/yr"    },
  es: { starterMonthly: "$29",   starterAnnual: "$23",   starterAnnualTotal: "$276/año",    proMonthly: "$79",   proAnnual: "$63",   proAnnualTotal: "$756/año"   },
  ar: { starterMonthly: "29$",   starterAnnual: "23$",   starterAnnualTotal: "276$/سنة",    proMonthly: "79$",   proAnnual: "63$",   proAnnualTotal: "756$/سنة"   },
  id: { starterMonthly: "$29",   starterAnnual: "$23",   starterAnnualTotal: "$276/thn",    proMonthly: "$79",   proAnnual: "$63",   proAnnualTotal: "$756/thn"   },
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

        {/* Starter */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-semibold text-sm uppercase tracking-wide">Starter</span>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-white">
                {isAnnual ? p.starterAnnual : p.starterMonthly}
              </span>
              <span className="text-gray-400 mb-1">{c.perMonth}</span>
            </div>
            {isAnnual && (
              <p className="text-xs text-green-400 mt-1">{p.starterAnnualTotal} · {c.billedAnnually}</p>
            )}
            <p className="text-gray-400 text-sm mt-2">{c.starterDesc}</p>
          </div>
          <ul className="space-y-3">
            {c.starterFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
          <CheckoutButton
            plan="starter"
            locale={locale}
            label={c.getStarted}
            billing={billing}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
          />
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
              <span className="text-gray-400 mb-1">{c.perMonth}</span>
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
