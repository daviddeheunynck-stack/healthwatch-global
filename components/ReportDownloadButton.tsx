"use client";

import { Download, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";
import { track } from "@vercel/analytics/react";

interface ReportData {
  region: string;
  regionLabel: string;
  date: string;
  activeOutbreaks: number;
  totalCases: number;
  highRisk: number;
  diseases: Array<{
    name: string;
    country: string;
    cases: number;
    deaths: number;
    risk: string;
  }>;
}

interface Props {
  data: ReportData;
  label: string;
  isPaid: boolean;
  locale: string;
  lockedLabel: string;
}

export default function ReportDownloadButton({
  data,
  label,
  isPaid,
  locale,
  lockedLabel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { openModal } = useUpgradeModal();

  // ── Locked state — free users ───────────────────────────────────────────────
  if (!isPaid) {
    return (
      <button
        onClick={() => openModal("pdf")}
        className="flex items-center gap-1.5 text-xs bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/40 text-amber-400 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Lock className="w-3.5 h-3.5" />
        {lockedLabel}
      </button>
    );
  }

  // ── Paid — server-side download (no window.print, works on mobile) ──────────
  const handleDownload = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/report/${data.region}?locale=${encodeURIComponent(locale)}`
      );

      if (!response.ok) {
        setError(`Error ${response.status}`);
        setLoading(false);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `healthwatch-${data.region}-${new Date().toISOString().split("T")[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      track("pdf_download", { region: data.region, locale });
    } catch {
      setError("Download failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {label}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
