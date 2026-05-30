"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { AlertCircle, RefreshCw } from "lucide-react";

const LABELS: Record<string, { title: string; body: string; retry: string; home: string }> = {
  fr: {
    title: "Une erreur est survenue",
    body:  "Une erreur inattendue s'est produite. Notre équipe a été notifiée.",
    retry: "Réessayer",
    home:  "Retour à l'accueil",
  },
  en: {
    title: "Something went wrong",
    body:  "An unexpected error occurred. Our team has been notified.",
    retry: "Try again",
    home:  "Go home",
  },
  es: {
    title: "Algo salió mal",
    body:  "Se produjo un error inesperado. Nuestro equipo ha sido notificado.",
    retry: "Reintentar",
    home:  "Ir al inicio",
  },
  ar: {
    title: "حدث خطأ ما",
    body:  "حدث خطأ غير متوقع. تم إخطار فريقنا.",
    retry: "إعادة المحاولة",
    home:  "الصفحة الرئيسية",
  },
  id: {
    title: "Terjadi kesalahan",
    body:  "Terjadi kesalahan tak terduga. Tim kami telah diberitahu.",
    retry: "Coba lagi",
    home:  "Ke beranda",
  },
};

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const l = LABELS[locale] ?? LABELS.en;

  useEffect(() => {
    console.error("[HealthWatch] Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">{l.title}</h1>
        <p className="text-gray-400 mt-2 max-w-md">
          {l.body}
          {error.digest && (
            <span className="block text-xs text-gray-600 mt-1">
              ID : {error.digest}
            </span>
          )}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          {l.retry}
        </button>
        <a
          href={`/${locale}`}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
        >
          {l.home}
        </a>
      </div>
    </div>
  );
}
