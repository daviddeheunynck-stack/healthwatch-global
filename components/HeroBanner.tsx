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
    badge: "4 official sources · 195 countries · 5 languages",
    headline: "Epidemic surveillance for health organizations",
    sub: "HealthWatch Global gives your surveillance team one classified view of WHO, ECDC, PAHO and Africa CDC signals — so they can act immediately without cross-referencing sources.",
    ctaPrimary: "Create free account",
    ctaSecondary: "See pricing",
    proof: "Field health coordinators · National IHR Focal Points · Public health teams without GPHIN access",
    f1: "WHO, ECDC, PAHO & Africa CDC alerts",
    f2: "Risk scoring per pathogen",
    f3: "Weekly email digest by region",
  },
  fr: {
    badge: "4 sources officielles · 195 pays · 5 langues",
    headline: "Surveillance épidémique pour les organisations de santé",
    sub: "HealthWatch Global donne à votre équipe de surveillance une vue unifiée et classifiée des signaux OMS, ECDC, PAHO et Africa CDC — pour agir immédiatement sans croiser plusieurs sources.",
    ctaPrimary: "Créer un compte gratuit",
    ctaSecondary: "Voir les tarifs",
    proof: "Coordinateurs santé terrain · Points focaux nationaux RSI · Équipes sans accès GPHIN",
    f1: "Alertes OMS, ECDC, OPAS & Africa CDC",
    f2: "Score de risque par pathogène",
    f3: "Digest email hebdomadaire par région",
  },
  es: {
    badge: "4 fuentes oficiales · 195 países · 5 idiomas",
    headline: "Vigilancia epidémica para organizaciones de salud",
    sub: "HealthWatch Global da a su equipo de vigilancia una vista clasificada única de las señales OMS, ECDC, PAHO y Africa CDC — para actuar de inmediato sin cruzar fuentes.",
    ctaPrimary: "Crear cuenta gratuita",
    ctaSecondary: "Ver precios",
    proof: "Coordinadores de salud en campo · Puntos focales nacionales RSI · Equipos sin acceso GPHIN",
    f1: "Alertas OMS, ECDC, PAHO & Africa CDC",
    f2: "Puntuación de riesgo por patógeno",
    f3: "Resumen semanal por email y región",
  },
  ar: {
    badge: "4 مصادر رسمية · 195 دولة · 5 لغات",
    headline: "مراقبة وبائية للمنظمات الصحية",
    sub: "توفر HealthWatch Global لفريق مراقبتك رؤية موحدة ومصنّفة لإشارات WHO وECDC وPAHO وAfrica CDC — للتصرف فوراً دون الحاجة لمقاطعة المصادر.",
    ctaPrimary: "إنشاء حساب مجاني",
    ctaSecondary: "عرض الأسعار",
    proof: "منسقو الصحة الميدانيون · نقاط الاتصال الوطنية RSI · فرق الصحة العامة دون وصول GPHIN",
    f1: "تنبيهات WHO وECDC وPAHO وAfrica CDC",
    f2: "تقييم المخاطر لكل مسبب مرض",
    f3: "ملخص أسبوعي عبر البريد الإلكتروني حسب المنطقة",
  },
  id: {
    badge: "4 sumber resmi · 195 negara · 5 bahasa",
    headline: "Surveilans epidemi untuk organisasi kesehatan",
    sub: "HealthWatch Global memberi tim surveilans Anda satu tampilan terklasifikasi dari sinyal WHO, ECDC, PAHO dan Africa CDC — agar bisa bertindak langsung tanpa perlu menyilangkan berbagai sumber.",
    ctaPrimary: "Buat akun gratis",
    ctaSecondary: "Lihat harga",
    proof: "Koordinator kesehatan lapangan · Focal Point Nasional IHR · Tim tanpa akses GPHIN",
    f1: "Peringatan WHO, ECDC, PAHO & Africa CDC",
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
