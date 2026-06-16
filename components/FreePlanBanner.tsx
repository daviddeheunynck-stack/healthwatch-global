"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import CheckoutButton from "@/components/CheckoutButton";

const COPY: Record<string, { title: string; sub: string; cta: string; trial: string }> = {
  fr: {
    title: "Passez à Pro — essai 14 jours gratuit",
    sub: "Chiffres exacts de cas & décès · Alertes instantanées · Rapports PDF · Export CSV",
    cta: "Commencer l'essai gratuit →",
    trial: "Sans carte bancaire",
  },
  en: {
    title: "Upgrade to Pro — 14-day free trial",
    sub: "Exact case & death figures · Instant alerts · PDF reports · CSV export",
    cta: "Start free trial →",
    trial: "No credit card",
  },
  es: {
    title: "Pasa a Pro — 14 días de prueba gratis",
    sub: "Cifras exactas de casos y fallecidos · Alertas instantáneas · Informes PDF · Exportación CSV",
    cta: "Iniciar prueba gratuita →",
    trial: "Sin tarjeta de crédito",
  },
  ar: {
    title: "انتقل إلى Pro — تجربة 14 يوماً مجاناً",
    sub: "أرقام دقيقة للحالات والوفيات · تنبيهات فورية · تقارير PDF · تصدير CSV",
    cta: "← ابدأ التجربة المجانية",
    trial: "بدون بطاقة بنكية",
  },
  id: {
    title: "Upgrade ke Pro — uji coba 14 hari gratis",
    sub: "Angka kasus & kematian tepat · Peringatan instan · Laporan PDF · Ekspor CSV",
    cta: "Mulai uji coba gratis →",
    trial: "Tanpa kartu kredit",
  },
};

const STORAGE_KEY = "hw_free_banner_dismissed_v2";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export default function FreePlanBanner({ locale }: { locale: string }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const dismissedAt = parseInt(stored, 10);
      if (!isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS) {
        setDismissed(true);
      }
    }
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
      className="rounded-xl border border-red-700/40 bg-gradient-to-r from-red-950/50 via-red-900/20 to-transparent p-4"
      dir={isRtl ? "rtl" : undefined}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-300">{c.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div>
            <CheckoutButton
              plan="pro"
              locale={locale}
              label={c.cta}
              className="text-xs bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            />
            <p className="text-center text-xs text-gray-600 mt-1">{c.trial}</p>
          </div>
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
