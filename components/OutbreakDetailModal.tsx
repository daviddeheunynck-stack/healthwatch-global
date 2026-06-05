"use client";

import { useEffect } from "react";
import { X, ExternalLink, AlertTriangle, TrendingUp, Users, Skull, Calendar, Globe } from "lucide-react";
import type { Outbreak } from "@/lib/outbreaks";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import RiskBadge from "@/components/RiskBadge";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";

const COPY: Record<string, {
  cases: string; deaths: string; cfr: string; date: string;
  source: string; description: string; close: string;
  noData: string; cfrFull: string; region: string;
}> = {
  fr: { cases: "Cas confirmés", deaths: "Décès", cfr: "Taux de létalité", date: "Date du rapport", source: "Bulletin OMS", description: "Résumé", close: "Fermer", noData: "Non disponible", cfrFull: "Taux de létalité (CFR)", region: "Région" },
  en: { cases: "Confirmed cases", deaths: "Deaths", cfr: "Case fatality rate", date: "Report date", source: "WHO bulletin", description: "Summary", close: "Close", noData: "Not available", cfrFull: "Case fatality rate (CFR)", region: "Region" },
  es: { cases: "Casos confirmados", deaths: "Fallecidos", cfr: "Tasa de letalidad", date: "Fecha del informe", source: "Boletín OMS", description: "Resumen", close: "Cerrar", noData: "No disponible", cfrFull: "Tasa de letalidad (CFR)", region: "Región" },
  ar: { cases: "الحالات المؤكدة", deaths: "الوفيات", cfr: "معدل الوفيات", date: "تاريخ التقرير", source: "نشرة OMS", description: "ملخص", close: "إغلاق", noData: "غير متاح", cfrFull: "معدل إماتة الحالات (CFR)", region: "المنطقة" },
  id: { cases: "Kasus terkonfirmasi", deaths: "Kematian", cfr: "Tingkat kematian", date: "Tanggal laporan", source: "Buletin WHO", description: "Ringkasan", close: "Tutup", noData: "Tidak tersedia", cfrFull: "Tingkat kematian kasus (CFR)", region: "Wilayah" },
};

const RISK_BG: Record<string, string> = {
  high:   "from-red-950/60 border-red-800/40",
  medium: "from-amber-950/60 border-amber-800/40",
  low:    "from-green-950/60 border-green-800/40",
};

interface Props {
  outbreak: Outbreak | null;
  locale: string;
  isPaid: boolean;
  onClose: () => void;
}

export default function OutbreakDetailModal({ outbreak, locale, isPaid, onClose }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const isRtl = locale === "ar";

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!outbreak) return null;

  const disease = getLocalizedDisease(outbreak, locale);
  const country = getLocalizedCountry(outbreak, locale) ?? outbreak.country_en;
  const hasData = outbreak.cases > 0;
  const cfr     = hasData ? (outbreak.deaths / outbreak.cases * 100).toFixed(1) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={`relative bg-gray-900 border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto
          bg-gradient-to-b ${RISK_BG[outbreak.risk_level] ?? RISK_BG.low}`}
        dir={isRtl ? "rtl" : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <RiskBadge level={outbreak.risk_level as "high" | "medium" | "low"} />
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{disease}</h2>
            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{country}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <ShareOutbreakButton
              disease={disease}
              country={country ?? ""}
              cases={outbreak.cases}
              riskLevel={outbreak.risk_level}
              locale={locale}
            />
            <button
              onClick={onClose}
              aria-label={c.close}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 p-5">
          {/* Cases */}
          <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
            <Users className="w-4 h-4 text-blue-400 mx-auto" />
            <p className="text-xs text-gray-500">{c.cases}</p>
            <p className="text-lg font-bold text-white">
              {isPaid
                ? (hasData ? outbreak.cases.toLocaleString() : <span className="text-gray-600 text-sm italic">{c.noData}</span>)
                : <span className="blur-sm select-none">12345</span>
              }
            </p>
          </div>

          {/* Deaths */}
          <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
            <Skull className="w-4 h-4 text-red-400 mx-auto" />
            <p className="text-xs text-gray-500">{c.deaths}</p>
            <p className="text-lg font-bold text-red-400">
              {isPaid
                ? (hasData ? outbreak.deaths.toLocaleString() : <span className="text-gray-600 text-sm italic">{c.noData}</span>)
                : <span className="blur-sm select-none">234</span>
              }
            </p>
          </div>

          {/* CFR */}
          <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
            <TrendingUp className="w-4 h-4 text-amber-400 mx-auto" />
            <p className="text-xs text-gray-500">{c.cfr}</p>
            <p className={`text-lg font-bold ${
              cfr && parseFloat(cfr) > 10 ? "text-red-400" :
              cfr && parseFloat(cfr) > 3  ? "text-amber-400" : "text-gray-300"
            }`}>
              {isPaid
                ? (cfr ? `${cfr}%` : <span className="text-gray-600 text-sm italic">{c.noData}</span>)
                : <span className="blur-sm select-none">9.9%</span>
              }
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="px-5 pb-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{c.date} :</span>
            <span className="text-gray-300">{outbreak.date}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{c.region} :</span>
            <span className="text-gray-300 capitalize">{outbreak.region}</span>
          </div>
        </div>

        {/* Description */}
        {outbreak.description && (
          <div className="px-5 pb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{c.description}</p>
            <p className="text-sm text-gray-400 leading-relaxed">{outbreak.description}</p>
          </div>
        )}

        {/* CFR interpretation */}
        {isPaid && cfr && (
          <div className={`mx-5 mb-4 rounded-xl p-3 text-xs border ${
            parseFloat(cfr) > 10
              ? "bg-red-900/20 border-red-800/30 text-red-300"
              : parseFloat(cfr) > 3
              ? "bg-amber-900/20 border-amber-800/30 text-amber-300"
              : "bg-gray-800/50 border-gray-700/30 text-gray-400"
          }`}>
            {parseFloat(cfr) > 10
              ? `⚠️ CFR ${cfr}% — taux de létalité critique. Ebola typique : 25-90%.`
              : parseFloat(cfr) > 3
              ? `⚠️ CFR ${cfr}% — taux de létalité élevé. Surveillance renforcée recommandée.`
              : `CFR ${cfr}% — taux de létalité modéré.`
            }
          </div>
        )}

        {/* Source link */}
        {outbreak.source && (
          <div className="px-5 pb-5">
            <a
              href={outbreak.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              {c.source} →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
