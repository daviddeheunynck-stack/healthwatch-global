"use client";

import { useState, useEffect } from "react";
import { Microscope, X } from "lucide-react";
import Link from "next/link";

const COPY: Record<string, { title: string; body: string; cta: string }> = {
  fr: {
    title: "Alertes maladie non configurées",
    body:  "Recevez un email dès qu'un foyer de Mpox, Ebola ou Choléra est détecté, où qu'il survienne. Jusqu'à 10 maladies suivies.",
    cta:   "Configurer mes alertes maladie →",
  },
  en: {
    title: "Disease-specific alerts not set up",
    body:  "Get notified when Mpox, Ebola, Cholera or any disease you choose is detected anywhere. Up to 10 diseases.",
    cta:   "Set up disease alerts →",
  },
  es: {
    title: "Alertas de enfermedad no configuradas",
    body:  "Reciba un email cuando se detecte Mpox, Ébola, Cólera o cualquier enfermedad que elija, en cualquier lugar. Hasta 10 enfermedades.",
    cta:   "Configurar alertas de enfermedad →",
  },
  ar: {
    title: "لم تُعد تنبيهات الأمراض بعد",
    body:  "تلقَّ بريداً إلكترونياً فور اكتشاف تفشٍّ لـ Mpox أو إيبولا أو الكوليرا أو أي مرض تختاره. حتى 10 أمراض.",
    cta:   "← إعداد تنبيهات الأمراض",
  },
  id: {
    title: "Peringatan penyakit belum dikonfigurasi",
    body:  "Dapatkan email saat Mpox, Ebola, Kolera, atau penyakit pilihan Anda terdeteksi di mana saja. Hingga 10 penyakit.",
    cta:   "Atur peringatan penyakit →",
  },
};

const STORAGE_KEY = "hw_disease_setup_dismissed_v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export default function DiseaseAlertSetupBanner({ locale }: { locale: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const at = parseInt(stored, 10);
      if (!isNaN(at) && Date.now() - at < TTL_MS) return;
    }
    fetch("/api/alert-diseases")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.subscribed) && data.subscribed.length === 0) {
          setShow(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShow(false);
  };

  return (
    <div
      className="rounded-xl border border-teal-700/40 bg-gradient-to-r from-teal-950/50 via-teal-900/20 to-transparent p-4"
      dir={isRtl ? "rtl" : undefined}
    >
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Microscope className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-teal-300">{c.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.body}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/${locale}/account#disease-alerts`}
            className="text-xs bg-teal-700 hover:bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
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
