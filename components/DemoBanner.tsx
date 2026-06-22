import Link from "next/link";
import { Eye } from "lucide-react";

const COPY: Record<string, { badge: string; text: string; cta: string; signin: string }> = {
  fr: {
    badge:   "🟢 Données en direct",
    text:    "Vous consultez des données épidémiques officielles en temps réel — sans compte.",
    cta:     "Créer un compte gratuit →",
    signin:  "Se connecter",
  },
  en: {
    badge:   "🟢 Live data",
    text:    "You're viewing real, official outbreak data — no account required.",
    cta:     "Create free account →",
    signin:  "Sign in",
  },
  es: {
    badge:   "🟢 Datos en directo",
    text:    "Está viendo datos oficiales de brotes en tiempo real — sin cuenta.",
    cta:     "Crear cuenta gratuita →",
    signin:  "Iniciar sesión",
  },
  ar: {
    badge:   "🟢 بيانات مباشرة",
    text:    "أنت تستعرض بيانات تفشيات رسمية وحقيقية — دون حساب.",
    cta:     "← إنشاء حساب مجاني",
    signin:  "تسجيل الدخول",
  },
  id: {
    badge:   "🟢 Data langsung",
    text:    "Anda melihat data wabah resmi secara real-time — tanpa akun.",
    cta:     "Buat akun gratis →",
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
      <div className="flex items-center gap-3">
        <Eye className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-xs bg-blue-800/60 text-blue-300 font-semibold px-2 py-0.5 rounded-full">
          {c.badge}
        </span>
        <p className="text-sm text-blue-200">{c.text}</p>
      </div>
      <div className="flex items-center gap-3">
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
