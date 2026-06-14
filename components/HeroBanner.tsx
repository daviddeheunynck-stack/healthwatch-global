"use client";

import Link from "next/link";
import { Activity, ShieldCheck, Globe, Bell, ArrowRight, Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

const COPY: Record<string, {
  badge: string; headline: string; sub: string;
  ctaPrimary: string; ctaSecondary: string;
  proof: string; f1: string; f2: string; f3: string;
}> = {
  en: {
    badge: "Live WHO data · 195 countries · 5 languages",
    headline: "Daily epidemic surveillance for health organizations",
    sub: "HealthWatch Global aggregates official WHO Disease Outbreak News into a multilingual dashboard your teams can act on immediately.",
    ctaPrimary: "Create free account",
    ctaSecondary: "See pricing",
    proof: "Built for NGOs, health ministries and international organizations.",
    f1: "WHO-sourced alerts, auto-synced",
    f2: "Risk scoring per pathogen",
    f3: "Weekly email digest by region",
  },
  fr: {
    badge: "Données OMS en direct · 195 pays · 5 langues",
    headline: "Surveillance épidémique quotidienne pour les organisations de santé",
    sub: "HealthWatch Global agrège les bulletins officiels Disease Outbreak News de l'OMS dans un tableau de bord multilingue sur lequel vos équipes peuvent agir immédiatement.",
    ctaPrimary: "Créer un compte gratuit",
    ctaSecondary: "Voir les tarifs",
    proof: "Conçu pour les ONG, ministères de la santé et organisations internationales.",
    f1: "Alertes OMS, synchronisation automatique",
    f2: "Score de risque par pathogène",
    f3: "Digest email hebdomadaire par région",
  },
  es: {
    badge: "Datos OMS en vivo · 195 países · 5 idiomas",
    headline: "Vigilancia epidémica diaria para organizaciones de salud",
    sub: "HealthWatch Global agrega los boletines oficiales Disease Outbreak News de la OMS en un panel multilingüe sobre el que sus equipos pueden actuar de inmediato.",
    ctaPrimary: "Crear cuenta gratuita",
    ctaSecondary: "Ver precios",
    proof: "Diseñado para ONG, ministerios de salud y organizaciones internacionales.",
    f1: "Alertas OMS, sincronización automática",
    f2: "Puntuación de riesgo por patógeno",
    f3: "Resumen semanal por email y región",
  },
  ar: {
    badge: "بيانات منظمة الصحة العالمية مباشرة · 195 دولة · 5 لغات",
    headline: "مراقبة وبائية يومية للمنظمات الصحية",
    sub: "تجمع HealthWatch Global نشرات Disease Outbreak News الرسمية لمنظمة الصحة العالمية في لوحة تحكم متعددة اللغات يمكن لفرقك التصرف بناءً عليها فوراً.",
    ctaPrimary: "إنشاء حساب مجاني",
    ctaSecondary: "عرض الأسعار",
    proof: "مصمم للمنظمات غير الحكومية ووزارات الصحة والمنظمات الدولية.",
    f1: "تنبيهات منظمة الصحة العالمية، مزامنة تلقائية",
    f2: "تقييم المخاطر لكل مسبب مرض",
    f3: "ملخص أسبوعي عبر البريد الإلكتروني حسب المنطقة",
  },
  id: {
    badge: "Data WHO langsung · 195 negara · 5 bahasa",
    headline: "Pemantauan epidemi harian untuk organisasi kesehatan",
    sub: "HealthWatch Global menggabungkan buletin resmi WHO Disease Outbreak News ke dalam dasbor multibahasa yang bisa langsung ditindaklanjuti oleh tim Anda.",
    ctaPrimary: "Buat akun gratis",
    ctaSecondary: "Lihat harga",
    proof: "Dirancang untuk LSM, kementerian kesehatan, dan organisasi internasional.",
    f1: "Peringatan WHO, sinkronisasi otomatis",
    f2: "Penilaian risiko per patogen",
    f3: "Digest email mingguan per wilayah",
  },
};

export default function HeroBanner() {
  const locale = useLocale();
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-gray-800 bg-gray-900/60 mb-8"
      dir={isRtl ? "rtl" : undefined}
    >
      {/* Subtle glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-red-600/5 blur-3xl rounded-full" />
      </div>

      <div className="relative px-6 py-10 md:px-12 md:py-14 space-y-8">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-600/20 rounded-full px-3 py-1 text-xs text-red-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          {c.badge}
        </div>

        {/* Headline */}
        <div className="space-y-3 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
            {c.headline}
          </h1>
          <p className="text-gray-400 text-base md:text-lg leading-relaxed">
            {c.sub}
          </p>
        </div>

        {/* CTA row */}
        <div className="flex flex-wrap gap-3 items-center">
          <Link
            href={`/${locale}/signup`}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shadow-lg shadow-red-900/30"
          >
            {c.ctaPrimary}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            {c.ctaSecondary}
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-3 pt-2">
          {[
            { icon: ShieldCheck, text: c.f1 },
            { icon: Globe,       text: c.f2 },
            { icon: Bell,        text: c.f3 },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-full px-3 py-1.5 text-xs text-gray-300"
            >
              <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {text}
            </div>
          ))}
        </div>

        {/* Social proof */}
        <p className="text-xs text-gray-600 flex items-center gap-1.5">
          <Lock className="w-3 h-3" />
          {c.proof}
        </p>

      </div>
    </div>
  );
}
