"use client";
import { useEffect, useState, useCallback } from "react";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";

const L: Record<string, { on: string; off: string; max: string }> = {
  fr: { on: "En veille",       off: "Surveiller",  max: "Limite atteinte (20)" },
  en: { on: "Watching",        off: "Watch",        max: "Limit reached (20)" },
  es: { on: "Vigilando",       off: "Vigilar",      max: "Límite alcanzado (20)" },
  ar: { on: "قيد المتابعة",   off: "متابعة",       max: "الحد الأقصى (20)" },
  id: { on: "Dipantau",        off: "Pantau",       max: "Batas tercapai (20)" },
};

export default function WatchButton({
  outbreakId,
  locale,
}: {
  outbreakId: string;
  locale: string;
}) {
  const [watched, setWatched] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxTip, setMaxTip] = useState(false);
  const lb = L[locale] ?? L.en;
  const { openModal } = useUpgradeModal();

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.watchlist) setWatched(d.watchlist.includes(outbreakId));
      })
      .catch(() => {});
  }, [outbreakId]);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy || watched === null) return;
      setBusy(true);
      try {
        const res = await fetch("/api/watchlist", {
          method: watched ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outbreak_id: outbreakId }),
        });
        if (res.ok) {
          setWatched(!watched);
        } else if (res.status === 403) {
          openModal("watchlist");
        } else {
          setMaxTip(true);
          setTimeout(() => setMaxTip(false), 2500);
        }
      } catch {}
      setBusy(false);
    },
    [watched, busy, outbreakId, openModal],
  );

  if (watched === null) return null;

  return (
    <div className="relative">
      <button
        onClick={toggle}
        disabled={busy}
        aria-label={watched ? lb.on : lb.off}
        aria-pressed={watched}
        title={watched ? lb.on : lb.off}
        className={`p-1.5 rounded-lg transition-all ${
          watched
            ? "text-yellow-400 hover:text-yellow-300"
            : "text-gray-600 hover:text-gray-400"
        } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={watched ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      </button>
      {maxTip && (
        <div className="absolute bottom-full right-0 mb-1 px-2 py-1 text-xs bg-gray-800 border border-gray-700 text-white rounded whitespace-nowrap pointer-events-none z-20">
          {lb.max}
        </div>
      )}
    </div>
  );
}
