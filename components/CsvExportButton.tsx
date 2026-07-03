"use client";

import { useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { track } from "@vercel/analytics/react";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";

const LABELS: Record<string, Record<"csv" | "json", { download: string; locked: string; error: string }>> = {
  fr: {
    csv:  { download: "Exporter CSV",  locked: "Exporter CSV",  error: "Échec du téléchargement" },
    json: { download: "Exporter JSON", locked: "Exporter JSON", error: "Échec du téléchargement" },
  },
  en: {
    csv:  { download: "Export CSV",  locked: "Export CSV",  error: "Download failed" },
    json: { download: "Export JSON", locked: "Export JSON", error: "Download failed" },
  },
  es: {
    csv:  { download: "Exportar CSV",  locked: "Exportar CSV",  error: "Error de descarga" },
    json: { download: "Exportar JSON", locked: "Exportar JSON", error: "Error de descarga" },
  },
  ar: {
    csv:  { download: "تصدير CSV",  locked: "تصدير CSV",  error: "فشل التنزيل" },
    json: { download: "تصدير JSON", locked: "تصدير JSON", error: "فشل التنزيل" },
  },
  id: {
    csv:  { download: "Ekspor CSV",  locked: "Ekspor CSV",  error: "Gagal mengunduh" },
    json: { download: "Ekspor JSON", locked: "Ekspor JSON", error: "Gagal mengunduh" },
  },
};

interface Props {
  isPaid: boolean;
  locale: string;
  format?: "csv" | "json";
}

export default function CsvExportButton({ isPaid, locale, format = "csv" }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { openModal } = useUpgradeModal();
  const l = (LABELS[locale] ?? LABELS.en)[format];

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
      const res = await fetch(format === "json" ? "/api/export?format=json" : "/api/export");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `healthwatch-outbreaks-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      track(format === "json" ? "json_export" : "csv_export", { locale });
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
