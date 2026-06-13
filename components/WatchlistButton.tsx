"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";

interface Props {
  outbreakId: string;
  initialWatched: boolean;
  isPaid: boolean;
  locale: string;
}

const TOOLTIP: Record<string, { add: string; remove: string; locked: string }> = {
  fr: { add: "Surveiller ce foyer", remove: "Ne plus surveiller", locked: "Alertes Pro — cliquez pour activer" },
  en: { add: "Watch this outbreak", remove: "Unwatch", locked: "Pro alerts — click to enable" },
  es: { add: "Seguir este brote", remove: "Dejar de seguir", locked: "Alertas Pro — clic para activar" },
  ar: { add: "متابعة هذا التفشي", remove: "إلغاء المتابعة", locked: "تنبيهات Pro — انقر للتفعيل" },
  id: { add: "Pantau wabah ini", remove: "Berhenti memantau", locked: "Peringatan Pro — klik untuk aktifkan" },
};

export default function WatchlistButton({ outbreakId, initialWatched, isPaid, locale }: Props) {
  const [watched, setWatched] = useState(initialWatched);
  const [loading, setLoading] = useState(false);
  const { openModal } = useUpgradeModal();
  const t = TOOLTIP[locale] ?? TOOLTIP.en;

  if (!isPaid) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); openModal("realtime"); }}
        title={t.locked}
        className="p-1.5 rounded text-gray-600 hover:text-amber-400 hover:bg-gray-700 transition-colors"
      >
        <Star className="w-3.5 h-3.5" />
      </button>
    );
  }

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation(); // don't open modal
    setLoading(true);
    try {
      await fetch("/api/watchlist", {
        method: watched ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outbreak_id: outbreakId }),
      });
      setWatched(!watched);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={watched ? t.remove : t.add}
      className={`p-1.5 rounded transition-colors ${
        watched
          ? "text-amber-400 hover:text-amber-300"
          : "text-gray-600 hover:text-amber-400 hover:bg-gray-700"
      }`}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Star className={`w-3.5 h-3.5 ${watched ? "fill-amber-400" : ""}`} />
      }
    </button>
  );
}
