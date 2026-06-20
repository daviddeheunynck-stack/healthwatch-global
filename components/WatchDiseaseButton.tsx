"use client";
import { useEffect, useState, useCallback } from "react";

const L: Record<string, { on: string; off: string; pro: string; max: string }> = {
  fr: { on: "Alertes actives",        off: "Alertes maladie",       pro: "Fonctionnalité Pro", max: "Limite atteinte (10)" },
  en: { on: "Disease alerts on",      off: "Alert me",              pro: "Pro plan required",  max: "Limit reached (10)" },
  es: { on: "Alertas activas",        off: "Alertarme",             pro: "Plan Pro requerido", max: "Límite alcanzado (10)" },
  ar: { on: "التنبيهات نشطة",         off: "تنبيهات المرض",         pro: "يتطلب خطة Pro",     max: "الحد الأقصى (10)" },
  id: { on: "Peringatan aktif",       off: "Aktifkan peringatan",   pro: "Perlu paket Pro",    max: "Batas tercapai (10)" },
};

export default function WatchDiseaseButton({
  diseaseName,
  locale,
}: {
  diseaseName: string;
  locale: string;
}) {
  const [watching, setWatching] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const lb = L[locale] ?? L.en;

  useEffect(() => {
    fetch("/api/alert-diseases")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.subscribed) setWatching(d.subscribed.includes(diseaseName));
      })
      .catch(() => {});
  }, [diseaseName]);

  const toggle = useCallback(async () => {
    if (busy || watching === null) return;
    setBusy(true);
    try {
      const res = await fetch("/api/alert-diseases", {
        method: watching ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disease_en: diseaseName }),
      });
      if (res.ok) {
        setWatching(!watching);
      } else {
        const msg = res.status === 403 ? lb.pro : lb.max;
        setTip(msg);
        setTimeout(() => setTip(null), 2500);
      }
    } catch {}
    setBusy(false);
  }, [watching, busy, diseaseName, lb]);

  if (watching === null) return null;

  return (
    <div className="relative">
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={watching}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
          watching
            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
            : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600"
        } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={watching ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          className="w-3.5 h-3.5 shrink-0"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {watching ? lb.on : lb.off}
      </button>
      {tip && (
        <div className="absolute bottom-full left-0 mb-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 text-white rounded whitespace-nowrap pointer-events-none z-20">
          {tip}
        </div>
      )}
    </div>
  );
}
