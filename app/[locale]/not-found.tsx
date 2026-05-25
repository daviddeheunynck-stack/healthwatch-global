import Link from "next/link";
import { Activity, AlertTriangle } from "lucide-react";
import { getLocale } from "next-intl/server";

const LABELS: Record<string, { title: string; subtitle: string; cta: string }> = {
  en: { title: "Page not found", subtitle: "The page you're looking for doesn't exist or has been moved.", cta: "Back to dashboard" },
  fr: { title: "Page introuvable", subtitle: "La page que vous cherchez n'existe pas ou a été déplacée.", cta: "Retour au tableau de bord" },
  es: { title: "Página no encontrada", subtitle: "La página que busca no existe o ha sido trasladada.", cta: "Volver al panel" },
  ar: { title: "الصفحة غير موجودة", subtitle: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.", cta: "العودة إلى لوحة التحكم" },
  id: { title: "Halaman tidak ditemukan", subtitle: "Halaman yang Anda cari tidak ada atau telah dipindahkan.", cta: "Kembali ke dasbor" },
};

export default async function LocaleNotFound() {
  const locale = await getLocale();
  const l = LABELS[locale] ?? LABELS.en;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex items-center gap-2.5 text-gray-400">
        <Activity className="w-6 h-6 text-red-500" />
        <span className="font-bold text-white text-lg">HealthWatch Global</span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <AlertTriangle className="w-14 h-14 text-red-500/60" />
        <p className="text-8xl font-black text-white tracking-tight">404</p>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">{l.title}</h1>
        <p className="text-gray-400 mt-2 max-w-md">{l.subtitle}</p>
      </div>

      <Link
        href={`/${locale}`}
        className="bg-red-600 hover:bg-red-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-sm"
      >
        {l.cta}
      </Link>
    </div>
  );
}
