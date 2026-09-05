import Link from "next/link";
import { Eye } from "lucide-react";

const COPY: Record<string, { badge: string; text: string; locked: string; cta: string; signin: string }> = {
  fr: {
    badge:   "🟢 Données en direct · OMS · PAHO · ECDC · Africa CDC",
    text:    "Cas et décès masqués dans cette vue.",
    locked:  "Essai Pro 7 jours gratuit — sans carte bancaire",
    cta:     "Débloquer les données →",
    signin:  "Se connecter",
  },
  en: {
    badge:   "🟢 Live data · WHO · PAHO · ECDC · Africa CDC",
    text:    "Cases and deaths are blurred in this view.",
    locked:  "7-day free Pro trial — no credit card",
    cta:     "Unlock all data →",
    signin:  "Sign in",
  },
  es: {
    badge:   "🟢 Datos en directo · OMS · PAHO · ECDC · Africa CDC",
    text:    "Los casos y fallecidos están ocultos en esta vista.",
    locked:  "Prueba Pro 7 días gratis — sin tarjeta",
    cta:     "Desbloquear datos →",
    signin:  "Iniciar sesión",
  },
  ar: {
    badge:   "🟢 بيانات مباشرة · WHO · PAHO · ECDC · Africa CDC",
    text:    "الحالات والوفيات مخفية في هذا العرض.",
    locked:  "تجربة Pro 7 أيام مجاناً — بدون بطاقة",
    cta:     "← إلغاء قفل البيانات",
    signin:  "تسجيل الدخول",
  },
  id: {
    badge:   "🟢 Data langsung · WHO · PAHO · ECDC · Africa CDC",
    text:    "Kasus dan kematian disamarkan dalam tampilan ini.",
    locked:  "Uji coba Pro 7 hari gratis — tanpa kartu",
    cta:     "Buka semua data →",
    signin:  "Masuk",
  },
};

export default function DemoBanner({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  return (
    <div
      dir={isRtl ? "rtl" : undefined}
      className="bg-blue-950/60 border border-blue-700/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between"
    >
      <div className="flex items-start gap-3 min-w-0">
        <Eye className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <span className="text-[10px] bg-blue-800/60 text-blue-300 font-semibold px-2 py-0.5 rounded-full">
            {c.badge}
          </span>
          <p className="text-sm text-blue-200 mt-1">
            {c.text}{" "}
            <span className="text-blue-400 font-medium">{c.locked}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href={`/${locale}/signup`}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {c.cta}
        </Link>
        <Link
          href={`/${locale}/login`}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
        >
          {c.signin}
        </Link>
      </div>
    </div>
  );
}
