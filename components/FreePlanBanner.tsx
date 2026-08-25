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
  missedNames: (names: string) => string;
  pilotCta: string;
  pilotDesc: (org: string) => string;
}> = {
  fr: {
    title: "Passez à Pro — essai 14 jours gratuit",
    sub: "Chiffres exacts de cas & décès · Alertes instantanées · Rapports PDF · Export CSV",
    missed: (n) => `🔔 ${n} alerte${n > 1 ? "s" : ""} ont été envoyées aux utilisateurs Pro cette semaine — vous les auriez reçues sous 8h.`,
    missedNames: (names) => `🔔 Alertes manquées cette semaine : ${names}`,
    cta: "Commencer l'essai gratuit →",
    trial: "Carte requise, aucun débit avant la fin de l'essai",
    titleExpired: "Votre essai est terminé — passez à Pro",
    ctaExpired: "S'abonner à Pro →",
    trialExpired: `À partir de ${PRICE_DISPLAY.fr.proMonthly}/mois ou ${PRICE_DISPLAY.fr.proAnnual}/an`,
    pilotCta: "Répondre pour en discuter →",
    pilotDesc: (org) => `Pour continuer au-delà du pilote pour ${org}, répondez à l'email reçu.`,
  },
  en: {
    title: "Upgrade to Pro — 14-day free trial",
    sub: "Exact case & death figures · Instant alerts · PDF reports · CSV export",
    missed: (n) => `🔔 ${n} alert${n > 1 ? "s" : ""} fired this week — Pro users were notified within 8h.`,
    missedNames: (names) => `🔔 Missed alerts this week: ${names}`,
    cta: "Start free trial →",
    trial: "Card required, no charge until trial ends",
    titleExpired: "Your trial ended — subscribe to keep Pro access",
    ctaExpired: "Subscribe to Pro →",
    trialExpired: `From ${PRICE_DISPLAY.en_eur.proMonthly}/month or ${PRICE_DISPLAY.en_eur.proAnnual}/year`,
    pilotCta: "Reply to discuss →",
    pilotDesc: (org) => `To continue beyond the pilot for ${org}, just reply to the email you received.`,
  },
  es: {
    title: "Pasa a Pro — 14 días de prueba gratis",
    sub: "Cifras exactas de casos y fallecidos · Alertas instantáneas · Informes PDF · Exportación CSV",
    missed: (n) => `🔔 ${n} alerta${n > 1 ? "s" : ""} esta semana — usuarios Pro notificados en menos de 8h.`,
    missedNames: (names) => `🔔 Alertas perdidas esta semana: ${names}`,
    cta: "Iniciar prueba gratuita →",
    trial: "Tarjeta requerida, sin cobro hasta que termine la prueba",
    titleExpired: "Tu prueba ha terminado — suscríbete a Pro",
    ctaExpired: "Suscribirse a Pro →",
    trialExpired: `Desde ${PRICE_DISPLAY.es.proMonthly}/mes o ${PRICE_DISPLAY.es.proAnnual}/año`,
    pilotCta: "Responder para hablar →",
    pilotDesc: (org) => `Para continuar más allá del piloto para ${org}, responda al email recibido.`,
  },
  ar: {
    title: "انتقل إلى Pro — تجربة 14 يوماً مجاناً",
    sub: "أرقام دقيقة للحالات والوفيات · تنبيهات فورية · تقارير PDF · تصدير CSV",
    missed: (n) => `🔔 ${n} تنبيه${n > 1 ? "ات" : ""} هذا الأسبوع — أُرسلت لمستخدمي Pro خلال 8 ساعات.`,
    missedNames: (names) => `🔔 تنبيهات فائتة هذا الأسبوع: ${names}`,
    cta: "← ابدأ التجربة المجانية",
    trial: "البطاقة مطلوبة، لا خصم قبل انتهاء التجربة",
    titleExpired: "انتهت تجربتك — اشترك في Pro للاستمرار",
    ctaExpired: "← الاشتراك في Pro",
    trialExpired: `ابتداءً من ${PRICE_DISPLAY.ar.proMonthly} شهرياً أو ${PRICE_DISPLAY.ar.proAnnual} سنوياً`,
    pilotCta: "← الرد للمناقشة",
    pilotDesc: (org) => `للاستمرار بعد التجربة لـ ${org}، فقط ردوا على البريد الذي تلقيتموه.`,
  },
  id: {
    title: "Upgrade ke Pro — uji coba 14 hari gratis",
    sub: "Angka kasus & kematian tepat · Peringatan instan · Laporan PDF · Ekspor CSV",
    missed: (n) => `🔔 ${n} peringatan minggu ini — pengguna Pro menerima notifikasi dalam 8 jam.`,
    missedNames: (names) => `🔔 Peringatan yang terlewat minggu ini: ${names}`,
    cta: "Mulai uji coba gratis →",
    trial: "Kartu diperlukan, tidak ada tagihan sebelum uji coba berakhir",
    titleExpired: "Uji coba Anda berakhir — langganan Pro untuk melanjutkan",
    ctaExpired: "Berlangganan Pro →",
    trialExpired: `Mulai ${PRICE_DISPLAY.id.proMonthly}/bulan atau ${PRICE_DISPLAY.id.proAnnual}/tahun`,
    pilotCta: "Balas untuk berdiskusi →",
    pilotDesc: (org) => `Untuk melanjutkan setelah pilot untuk ${org}, balas email yang Anda terima.`,
  },
};

const STORAGE_KEY = "hw_free_banner_dismissed_v2";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface MissedAlertName { disease: string; country: string; delta24h: number | null }

export default function FreePlanBanner({
  locale,
  trialExpired = false,
  missedAlerts = 0,
  missedAlertNames = [],
  isPilot = false,
  pilotOrganization = null,
}: {
  locale: string;
  trialExpired?: boolean;
  missedAlerts?: number;
  missedAlertNames?: MissedAlertName[];
  isPilot?: boolean;
  pilotOrganization?: string | null;
}) {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    // Expired trials always show — the user needs to act now
    if (trialExpired) { setDismissed(false); return; }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const dismissedAt = parseInt(stored, 10);
      if (!isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_TTL_MS) return;
    }
    setDismissed(false);
  }, [trialExpired]);

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
  const pilotOrg = pilotOrganization || (locale === "fr" ? "votre organisation" : "your organization");
  const pilotMailtoHref = "mailto:david.deheunynck@gmail.com?subject=" + encodeURIComponent(
    locale === "fr" ? `Suite du pilote — ${pilotOrg}` : `Following up on our pilot — ${pilotOrg}`
  );

  return (
    <div
      className="rounded-xl border border-red-700/40 bg-gradient-to-r from-red-950/50 via-red-900/20 to-transparent p-4"
      dir={isRtl ? "rtl" : undefined}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-300">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
          {missedAlerts > 0 && missedAlertNames.length > 0 ? (
            <p className="text-xs text-amber-400 mt-1.5 font-medium">
              {c.missedNames(
                missedAlertNames.map(a =>
                  a.delta24h && a.delta24h > 0
                    ? `${a.disease} ${a.country} (+${a.delta24h.toLocaleString(locale === "ar" ? "ar-SA" : locale)}/24h)`
                    : `${a.disease} ${a.country}`
                ).join(" · ")
              )}
            </p>
          ) : missedAlerts > 0 ? (
            <p className="text-xs text-amber-400 mt-1.5 font-medium">{c.missed(missedAlerts)}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div onClick={() => track("free_banner_cta", { locale, trialExpired, is_pilot: isPilot })}>
            {isPilot ? (
              <>
                <a
                  href={pilotMailtoHref}
                  className="text-xs bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  {c.pilotCta}
                </a>
                <p className="text-center text-xs text-gray-600 mt-1 max-w-[180px]">{c.pilotDesc(pilotOrg)}</p>
              </>
            ) : (
              <>
                <CheckoutButton
                  billing="monthly"
                  plan="pro"
                  locale={locale}
                  label={cta}
                  className="text-xs bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                />
                <p className="text-center text-xs text-gray-600 mt-1">{note}</p>
              </>
            )}
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
