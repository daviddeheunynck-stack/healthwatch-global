"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";

const STORAGE_KEY = "hwg_founding_dismissed";
const TOTAL_SPOTS  = 50;

// In production: replace with a real-time count from your DB or a simple env var.
// For launch, hardcode — update manually as spots fill up.
const SPOTS_REMAINING = 50;

const COPY: Record<string, {
  badge:   string;
  text:    string;
  spots:   (n: number) => string;
  cta:     string;
  dismiss: string;
}> = {
  fr: {
    badge:   "Offre fondateur",
    text:    "Accès Pro à vie au prix de lancement —",
    spots:   (n) => `${n} places restantes sur ${TOTAL_SPOTS}`,
    cta:     "En profiter →",
    dismiss: "Fermer",
  },
  en: {
    badge:   "Founding member",
    text:    "Pro access at launch price, locked in forever —",
    spots:   (n) => `${n} of ${TOTAL_SPOTS} spots remaining`,
    cta:     "Claim yours →",
    dismiss: "Dismiss",
  },
  es: {
    badge:   "Miembro fundador",
    text:    "Acceso Pro al precio de lanzamiento para siempre —",
    spots:   (n) => `${n} de ${TOTAL_SPOTS} plazas restantes`,
    cta:     "Aprovechar →",
    dismiss: "Cerrar",
  },
  ar: {
    badge:   "عضو مؤسس",
    text:    "وصول Pro بسعر الإطلاق مدى الحياة —",
    spots:   (n) => `${n} من ${TOTAL_SPOTS} أماكن متبقية`,
    cta:     "← احجز مكانك",
    dismiss: "إغلاق",
  },
  id: {
    badge:   "Anggota pendiri",
    text:    "Akses Pro dengan harga peluncuran seumur hidup —",
    spots:   (n) => `${n} dari ${TOTAL_SPOTS} tempat tersisa`,
    cta:     "Dapatkan →",
    dismiss: "Tutup",
  },
};

export default function FoundingMemberBanner({ locale, pricingHref }: {
  locale:      string;
  pricingHref: string;
}) {
  const [visible, setVisible] = useState(false);
  const c = COPY[locale] ?? COPY.en;

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="bg-gradient-to-r from-amber-900/80 via-amber-800/70 to-amber-900/80 border-b border-amber-700/50">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">

        <div className="flex items-center gap-3 flex-wrap">
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-0.5 text-xs font-bold text-amber-300 shrink-0">
            <Sparkles className="w-3 h-3" />
            {c.badge}
          </span>

          {/* Text */}
          <p className="text-sm text-amber-100">
            {c.text}{" "}
            <span className="font-bold text-white">29 €/mois à vie</span>
            {" · "}
            <span className="text-amber-300 text-xs">{c.spots(SPOTS_REMAINING)}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={pricingHref}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-1.5 rounded-full transition-colors whitespace-nowrap"
          >
            {c.cta}
          </Link>
          <button
            onClick={dismiss}
            aria-label={c.dismiss}
            className="text-amber-400 hover:text-amber-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
