"use client";

import { useState, useEffect } from "react";
import { Check, CheckCircle, Circle, ChevronRight, X } from "lucide-react";
import Link from "next/link";

const COPY: Record<string, {
  title: string;
  steps: [string, string, string, string];
  dismiss: string;
  done: string;
  doneSub: string;
  doneNext: string;
}> = {
  fr: {
    title: "Démarrage rapide",
    steps: [
      "Configurez vos alertes email",
      "Téléchargez un rapport PDF",
      "Suivez un foyer en watchlist",
      "Abonnez-vous à une maladie spécifique",
    ],
    dismiss: "Fermer",
    done:    "Configuration terminée.",
    doneSub: "Votre compte Pro est entièrement prêt.",
    doneNext: "Voir mes alertes",
  },
  en: {
    title: "Quick start",
    steps: [
      "Set up your email alerts",
      "Download a PDF report",
      "Star an outbreak to track it",
      "Subscribe to a specific disease",
    ],
    dismiss: "Close",
    done:    "Setup complete.",
    doneSub: "Your Pro account is fully configured.",
    doneNext: "View my alerts",
  },
  es: {
    title: "Inicio rápido",
    steps: [
      "Configure sus alertas de email",
      "Descargue un informe PDF",
      "Siga un brote en su lista de vigilancia",
      "Suscríbase a una enfermedad específica",
    ],
    dismiss: "Cerrar",
    done:    "Configuración completa.",
    doneSub: "Su cuenta Pro está completamente lista.",
    doneNext: "Ver mis alertas",
  },
  ar: {
    title: "البداية السريعة",
    steps: [
      "إعداد تنبيهات البريد الإلكتروني",
      "تنزيل تقرير PDF",
      "تابع تفشياً في قائمة المراقبة",
      "اشترك في مرض محدد",
    ],
    dismiss: "إغلاق",
    done:    "الإعداد مكتمل.",
    doneSub: "حسابك Pro جاهز تماماً.",
    doneNext: "عرض تنبيهاتي",
  },
  id: {
    title: "Mulai cepat",
    steps: [
      "Atur peringatan email Anda",
      "Unduh laporan PDF",
      "Pantau wabah di watchlist Anda",
      "Berlangganan penyakit tertentu",
    ],
    dismiss: "Tutup",
    done:    "Konfigurasi selesai.",
    doneSub: "Akun Pro Anda sudah siap sepenuhnya.",
    doneNext: "Lihat peringatan saya",
  },
};

const storageKey = (uid: string) => `hw_qs_${uid}_v1`;

type State = { s1: boolean; s2: boolean; s3: boolean; s4: boolean; dismissed: boolean };

export default function ProQuickStart({
  locale,
  userId,
  hasAlerts,
}: {
  locale: string;
  userId: string;
  hasAlerts: boolean;
}) {
  const [st, setSt] = useState<State | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId));
      const saved: Partial<State> = raw ? JSON.parse(raw) : {};
      setSt({
        s1: hasAlerts || !!saved.s1,
        s2: !!saved.s2,
        s3: !!saved.s3,
        s4: !!saved.s4,
        dismissed: !!saved.dismissed,
      });
    } catch {
      setSt({ s1: hasAlerts, s2: false, s3: false, s4: false, dismissed: false });
    }
  }, [userId, hasAlerts]);

  const save = (next: State) => {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
    setSt(next);
  };

  if (!st || st.dismissed) return null;

  const allDone = st.s1 && st.s2 && st.s3 && st.s4;
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";
  const completed = [st.s1, st.s2, st.s3, st.s4].filter(Boolean).length;
  const pct = Math.round((completed / 4) * 100);

  const steps = [
    {
      key: "s1" as const,
      label: c.steps[0],
      href: `/${locale}/account#regional-alerts`,
      done: st.s1,
      onComplete: undefined,
    },
    {
      key: "s2" as const,
      label: c.steps[1],
      href: `/${locale}/reports`,
      done: st.s2,
      onComplete: () => save({ ...st, s2: true }),
    },
    {
      key: "s3" as const,
      label: c.steps[2],
      href: `/${locale}/`,
      done: st.s3,
      onComplete: () => save({ ...st, s3: true }),
    },
    {
      key: "s4" as const,
      label: c.steps[3],
      href: `/${locale}/account#disease-alerts`,
      done: st.s4,
      onComplete: () => save({ ...st, s4: true }),
    },
  ];

  if (allDone) return (
    <div
      className="rounded-xl border border-green-700/40 bg-green-900/10 px-4 py-3 flex items-center justify-between gap-3"
      dir={isRtl ? "rtl" : undefined}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-green-400">{c.done}</p>
          <p className="text-xs text-gray-500">{c.doneSub}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href={`/${locale}/notifications`}
          className="text-xs text-green-400 hover:text-green-300 transition-colors whitespace-nowrap"
        >
          {c.doneNext} →
        </Link>
        <button
          onClick={() => save({ ...st, dismissed: true })}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          aria-label={c.dismiss}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="rounded-xl border border-gray-700/60 bg-gray-900/50 overflow-hidden"
      dir={isRtl ? "rtl" : undefined}
    >
      {/* Progress bar */}
      <div className="h-0.5 bg-gray-800">
        <div
          className="h-full bg-red-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {c.title}
            </span>
            <span className="text-xs text-gray-600">{completed}/4</span>
          </div>
          <button
            onClick={() => save({ ...st, dismissed: true })}
            className="text-gray-600 hover:text-gray-400 transition-colors"
            aria-label={c.dismiss}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map(({ key, label, href, done, onComplete }) => (
            <div key={key} className="flex items-center gap-2.5">
              {done ? (
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              )}
              {done ? (
                <span className="text-xs text-gray-600 line-through">{label}</span>
              ) : (
                <Link
                  href={href}
                  onClick={onComplete}
                  className="flex items-center gap-1 text-xs text-gray-300 hover:text-white transition-colors"
                >
                  {label}
                  <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
