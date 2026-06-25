"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import Link from "next/link";

const COPY: Record<string, { title: string; body: string; cta: string }> = {
  fr: {
    title: "Configurez vos alertes email",
    body: "Aucune région activée. Sélectionnez vos zones pour recevoir les nouveaux foyers directement en boîte mail.",
    cta: "Configurer mes alertes →",
  },
  en: {
    title: "Set up your outbreak alerts",
    body: "No alert regions enabled yet. Select your areas to receive new outbreaks directly by email.",
    cta: "Set up alerts →",
  },
  es: {
    title: "Configura tus alertas de brotes",
    body: "No has activado ninguna región. Selecciona tus áreas para recibir nuevos brotes directamente por email.",
    cta: "Configurar alertas →",
  },
  ar: {
    title: "إعداد تنبيهات التفشيات",
    body: "لم تُفعّل أي منطقة بعد. اختر مناطقك لتلقي التفشيات الجديدة مباشرة عبر البريد الإلكتروني.",
    cta: "← إعداد التنبيهات",
  },
  id: {
    title: "Siapkan peringatan wabah Anda",
    body: "Belum ada wilayah yang diaktifkan. Pilih area Anda untuk menerima wabah baru langsung melalui email.",
    cta: "Atur peringatan →",
  },
};

const STORAGE_KEY = "hw_alert_setup_dismissed_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export default function AlertSetupBanner({ locale }: { locale: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const at = parseInt(stored, 10);
      if (!isNaN(at) && Date.now() - at < TTL_MS) return;
    }
    setDismissed(false);
  }, []);

  if (dismissed) return null;

  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div
      className="rounded-xl border border-amber-700/40 bg-gradient-to-r from-amber-950/50 via-amber-900/20 to-transparent p-4"
      dir={isRtl ? "rtl" : undefined}
    >
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Bell className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-300">{c.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.body}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/${locale}/account`}
            className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            onClick={dismiss}
          >
            {c.cta}
          </Link>
          <button
            onClick={dismiss}
            className="text-gray-600 hover:text-gray-400 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
