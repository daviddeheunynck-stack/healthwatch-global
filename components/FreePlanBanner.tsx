"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { track } from "@vercel/analytics/react";
import CheckoutButton from "@/components/CheckoutButton";
import { PRICE_DISPLAY } from "@/lib/pricing";

const COPY: Record<string, {
  title: string; sub: string; cta: string; trial: string;
  titleExpired: string; ctaExpired: string; trialExpired: string;
  missed: (n: number) => string;
}> = {
  fr: {
    title: "Passez à Pro — essai 14 jours gratuit",
    sub: "Chiffres exacts de cas & décès · Alertes instantanées · Rapports PDF · Export CSV",
    missed: (n) => `🔔 ${n} alerte${n > 1 ? "s" : ""} ont été envoyées aux utilisateurs Pro dans votre région cette semaine — vous les auriez reçues sous 8h.`,
    cta: "Commencer l'essai gratuit →",
    trial: "Sans carte bancaire",
    titleExpired: "Votre essai est terminé — passez à Pro",
    ctaExpired: "S'abonner à Pro →",
    trialExpired: `À partir de ${PRICE_DISPLAY.fr.proMonthly}/mois ou ${PRICE_DISPLAY.fr.proAnnual}/an`,
  },
  en: {
    title: "Upgrade to Pro — 14-day free trial",
    sub: "Exact case & death figures · Instant alerts · PDF reports · CSV export",
    missed: (n) => `🔔 ${n} alert${n > 1 ? "s" : ""} fired in your region this week — Pro users were notified within 8h.`,
    cta: "Start free trial →",
    trial: "No credit card",
    titleExpired: "Your trial ended — subscribe to keep Pro access",
    ctaExpired: "Subscribe to Pro →",
    trialExpired: `From ${PRICE_DISPLAY.en_eur.proMonthly}/month or ${PRICE_DISPLAY.en_eur.proAnnual}/year`,
  },
  es: {
    title: "Pasa a Pro — 14 días de prueba gratis",
    sub: "Cifras exactas de casos y fallecidos · Alertas instantáneas · Informes PDF · Exportación CSV",
    missed: (n) => `🔔 ${n} alerta${n > 1 ? "s" : ""} en tu región esta semana — usuarios Pro notificados en menos de 8h.`,
    cta: "Iniciar prueba gratuita →",
    trial: "Sin tarjeta de crédito",
    titleExpired: "Tu prueba ha terminado — suscríbete a Pro",
    ctaExpired: "Suscribirse a Pro →",
    trialExpired: `Desde ${PRICE_DISPLAY.es.proMonthly}/mes o ${PRICE_DISPLAY.es.proAnnual}/año`,
  },
  ar: {
    title: "انتقل إلى Pro — تجربة 14 يوماً مجاناً",
    sub: "أرقام دقيقة للحالات والوفيات · تنبيهات فورية · تقارير PDF · تصدير CSV",
    missed: (n) => `🔔 ${n} تنبيه${n > 1 ? "ات" : ""} في منطقتك هذا الأسبوع — أُرسلت لمستخدمي Pro خلال 8 ساعات.`,
    cta: "← ابدأ التجربة المجانية",
    trial: "بدون بطاقة بنكية",
    titleExpired: "انتهت تجربتك — اشترك في Pro للاستمرار",
    ctaExpired: "← الاشتراك في Pro",
    trialExpired: `ابتداءً من ${PRICE_DISPLAY.ar.proMonthly} شهرياً أو ${PRICE_DISPLAY.ar.proAnnual} سنوياً`,
  },
  id: {
    title: "Upgrade ke Pro — uji coba 14 hari gratis",
    sub: "Angka kasus & kematian tepat · Peringatan instan · Laporan PDF · Ekspor CSV",
    missed: (n) => `🔔 ${n} peringatan di wilayah Anda minggu ini — pengguna Pro menerima notifikasi dalam 8 jam.`,
    cta: "Mulai uji coba gratis →",
    trial: "Tanpa kartu kredit",
    titleExpired: "Uji coba Anda berakhir — langganan Pro untuk melanjutkan",
    ctaExpired: "Berlangganan Pro →",
    trialExpired: `Mulai ${PRICE_DISPLAY.id.proMonthly}/bulan atau ${PRICE_DISPLAY.id.proAnnual}/tahun`,
  },
};

const STORAGE_KEY = "hw_free_banner_dismissed_v2";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export default function FreePlanBanner({ locale, trialExpired = false, missedAlerts = 0 }: { locale: string; trialExpired?: boolean; missedAlerts?: number }) {
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

  const title = trialExpired ? c.titleExpired : c.title;
  const cta   = trialExpired ? c.ctaExpired   : c.cta;
  const note  = trialExpired ? c.trialExpired  : c.trial;

  return (
    <div
      className="rounded-xl border border-red-700/40 bg-gradient-to-r from-red-950/50 via-red-900/20 to-transparent p-4"
      dir={isRtl ? "rtl" : undefined}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-300">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          {missedAlerts > 0 && (
            <p className="text-xs text-amber-400 mt-1.5 font-medium">{c.missed(missedAlerts)}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div onClick={() => track("free_banner_cta", { locale, trialExpired })}>
            <CheckoutButton
              plan="pro"
              locale={locale}
              label={cta}
              className="text-xs bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            />
            <p className="text-center text-xs text-gray-600 mt-1">{note}</p>
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
