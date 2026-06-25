"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { track } from "@vercel/analytics/react";

const PH_URL = "https://www.producthunt.com/products/healthwatch-global?launch=healthwatch-global-2";

// PH launch day window (UTC) — show the bar on June 25 and 26, 2026
const LAUNCH_START = new Date("2026-06-25T00:00:00Z");
const LAUNCH_END   = new Date("2026-06-26T23:59:59Z");

const COPY: Record<string, {
  launchDay:  { text: string; cta: string };
  fromPH:     { text: string; cta: string };
}> = {
  en: {
    launchDay: { text: "🚀 HealthWatch Global is live on Product Hunt today!", cta: "Support us →" },
    fromPH:    { text: "👋 Thanks for visiting from Product Hunt!", cta: "Upvote us →" },
  },
  fr: {
    launchDay: { text: "🚀 HealthWatch Global est en ligne sur Product Hunt aujourd'hui !", cta: "Nous soutenir →" },
    fromPH:    { text: "👋 Merci de nous rendre visite depuis Product Hunt !", cta: "Voter pour nous →" },
  },
  es: {
    launchDay: { text: "🚀 HealthWatch Global está hoy en Product Hunt.", cta: "Apóyanos →" },
    fromPH:    { text: "👋 ¡Gracias por visitarnos desde Product Hunt!", cta: "Vótanos →" },
  },
  ar: {
    launchDay: { text: "🚀 HealthWatch Global متاح اليوم على Product Hunt!", cta: "← ادعمنا" },
    fromPH:    { text: "👋 شكراً لزيارتك من Product Hunt!", cta: "← صوّت لنا" },
  },
  id: {
    launchDay: { text: "🚀 HealthWatch Global kini live di Product Hunt hari ini!", cta: "Dukung kami →" },
    fromPH:    { text: "👋 Terima kasih telah mengunjungi dari Product Hunt!", cta: "Upvote kami →" },
  },
};

type Mode = "launch-day" | "from-ph" | null;

export default function PHLaunchBar({ locale }: { locale: string }) {
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    if (sessionStorage.getItem("ph-bar-dismissed")) return;

    const now = new Date();
    const fromPH =
      document.referrer.includes("producthunt.com") ||
      new URLSearchParams(window.location.search).get("ref") === "producthunt";
    const isLaunchDay = now >= LAUNCH_START && now <= LAUNCH_END;

    if (fromPH) {
      setMode("from-ph");
      track("ph_bar_shown", { mode: "from-ph", locale });
    } else if (isLaunchDay) {
      setMode("launch-day");
      track("ph_bar_shown", { mode: "launch-day", locale });
    }
  }, [locale]);

  if (!mode) return null;

  const c = (COPY[locale] ?? COPY.en)[mode === "launch-day" ? "launchDay" : "fromPH"];
  const isRtl = locale === "ar";

  const handleDismiss = () => {
    sessionStorage.setItem("ph-bar-dismissed", "1");
    setMode(null);
  };

  const handleClick = () => {
    track("ph_bar_click", { mode, locale });
  };

  return (
    <div
      dir={isRtl ? "rtl" : undefined}
      className="bg-[#ff6154] text-white text-sm px-4 py-2.5 flex items-center justify-between gap-3 w-full"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="truncate">{c.text}</span>
        <a
          href={PH_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="shrink-0 bg-white/20 hover:bg-white/30 font-semibold px-3 py-1 rounded-full transition-colors whitespace-nowrap text-xs"
        >
          {c.cta}
        </a>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-white/70 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
