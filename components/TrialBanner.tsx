"use client";

import { useEffect, useState } from "react";
import { Zap, AlertTriangle } from "lucide-react";
import BillingPortalButton from "@/components/BillingPortalButton";

// ─── Copy ─────────────────────────────────────────────────────────────────────

const COPY: Record<string, {
  title: (days: number) => string;
  desc: string;
  cta: string;
  today: string;
}> = {
  fr: {
    title: (d) => d <= 0 ? "Votre essai Pro se termine aujourd'hui" : d === 1 ? "Il reste 1 jour sur votre essai Pro" : `Il reste ${d} jours sur votre essai Pro`,
    desc: "Ajoutez un moyen de paiement pour conserver l'accès aux alertes temps réel, rapports PDF et export CSV.",
    cta: "Activer mon abonnement",
    today: "Ajoutez un moyen de paiement maintenant pour ne pas perdre l'accès.",
  },
  en: {
    title: (d) => d <= 0 ? "Your Pro trial ends today" : d === 1 ? "1 day left on your Pro trial" : `${d} days left on your Pro trial`,
    desc: "Add a payment method to keep access to real-time alerts, PDF reports and CSV export.",
    cta: "Activate my subscription",
    today: "Add a payment method now to avoid losing access.",
  },
  es: {
    title: (d) => d <= 0 ? "Su prueba Pro termina hoy" : d === 1 ? "Queda 1 día en su prueba Pro" : `Quedan ${d} días en su prueba Pro`,
    desc: "Añada un método de pago para conservar el acceso a alertas en tiempo real, informes PDF y exportación CSV.",
    cta: "Activar mi suscripción",
    today: "Añada un método de pago ahora para no perder el acceso.",
  },
  ar: {
    title: (d) => d <= 0 ? "تجربتك Pro تنتهي اليوم" : d === 1 ? "يوم واحد متبقٍّ في تجربة Pro" : `${d} أيام متبقية في تجربة Pro`,
    desc: "أضف طريقة دفع للاحتفاظ بالوصول إلى التنبيهات الفورية وتقارير PDF وتصدير CSV.",
    cta: "تفعيل اشتراكي",
    today: "أضف طريقة دفع الآن لتجنب فقدان الوصول.",
  },
  id: {
    title: (d) => d <= 0 ? "Uji coba Pro Anda berakhir hari ini" : d === 1 ? "Sisa 1 hari uji coba Pro Anda" : `Sisa ${d} hari uji coba Pro Anda`,
    desc: "Tambahkan metode pembayaran untuk mempertahankan akses ke peringatan real-time, laporan PDF, dan ekspor CSV.",
    cta: "Aktifkan langganan saya",
    today: "Tambahkan metode pembayaran sekarang agar tidak kehilangan akses.",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  trialEndsAt: string;   // ISO timestamp
  locale: string;
}

export default function TrialBanner({ trialEndsAt, locale }: Props) {
  // BUG FIX: this used to be `useMemo(..., [trialEndsAt])`. Since trialEndsAt
  // is a fixed timestamp that never changes during a trial, that memo computed
  // Date.now() exactly ONCE on mount and then froze forever — a banner opened
  // on day 1 could still claim "13 jours restants" on day 5 in a long-lived tab.
  // A countdown has to track the *current* moment, so we tick once a minute to
  // force a fresh read — the same "live clock" pattern any relative-time UI needs.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // A live countdown must read the current moment on every render — setTick
  // above forces that re-render once a minute, so this impurity is intentional
  // (the disable must sit directly above the flagged line, or ESLint reports
  // it as unused and the rule still fires on the real line below).
  // eslint-disable-next-line react-hooks/purity
  const daysLeft   = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000);
  const isUrgent   = daysLeft <= 3;
  const isCritical = daysLeft <= 1;

  const c = COPY[locale] ?? COPY.en;

  const colors = isCritical
    ? { border: "border-red-700/50",    bg: "from-red-950/60 via-red-900/20",    icon: "text-red-400",    dot: "bg-red-400" }
    : isUrgent
    ? { border: "border-amber-700/50",  bg: "from-amber-950/60 via-amber-900/20", icon: "text-amber-400",  dot: "bg-amber-400" }
    : { border: "border-blue-700/40",   bg: "from-blue-950/50 via-blue-900/20",  icon: "text-blue-400",   dot: "bg-blue-400" };

  const Icon = isCritical ? AlertTriangle : Zap;

  return (
    <div
      className={`rounded-xl border ${colors.border} bg-gradient-to-r ${colors.bg} to-transparent p-4`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-white/5 border border-white/10`}>
            <Icon className={`w-4 h-4 ${colors.icon}`} />
          </div>

          {/* Text */}
          <div>
            <p className={`text-sm font-bold ${colors.icon}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors.dot} mr-1.5 mb-0.5 ${isCritical ? "animate-pulse" : ""}`} />
              {c.title(daysLeft)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isCritical ? c.today : c.desc}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0">
          <BillingPortalButton locale={locale} label={c.cta} />
        </div>
      </div>
    </div>
  );
}
