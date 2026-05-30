"use client";

import { useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { track } from "@vercel/analytics/react";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";

const LABELS: Record<string, { download: string; locked: string; error: string }> = {
  fr: { download: "Exporter CSV", locked: "Exporter CSV",  error: "Échec du téléchargement" },
  en: { download: "Export CSV",   locked: "Export CSV",    error: "Download failed"          },
  es: { download: "Exportar CSV", locked: "Exportar CSV",  error: "Error de descarga"        },
  ar: { download: "تصدير CSV",    locked: "تصدير CSV",     error: "فشل التنزيل"              },
  id: { download: "Ekspor CSV",   locked: "Ekspor CSV",    error: "Gagal mengunduh"          },
};

interface Props {
  isPaid: boolean;
  locale: string;
}

export default function CsvExportButton({ isPaid, locale }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { openModal } = useUpgradeModal();
  const l = LABELS[locale] ?? LABELS.en;

  // ── Locked — free users ───────────────────────────────────────────────────
  if (!isPaid) {
    return (
      <button
        onClick={() => openModal("csv")}
        className="flex items-center gap-2 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 px-3 py-2 rounded-lg transition-colors"
      >
        <Lock className="w-3.5 h-3.5" />
        {l.locked}
      </button>
    );
  }

  // ── Paid — trigger download ───────────────────────────────────────────────
  const handleDownload = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `healthwatch-outbreaks-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      track("csv_export", { locale });
    } catch {
      setError(l.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-60 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-colors"
      >
        {loading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Download className="w-3.5 h-3.5" />}
        {l.download}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
