"use client";

import { useEffect } from "react";
import { X, ExternalLink, AlertTriangle, TrendingUp, Users, Skull, Calendar, Globe, Clock, Activity, ImageDown } from "lucide-react";
import WatchlistButton from "@/components/WatchlistButton";
import { getIncidenceRate } from "@/lib/population-data";
import type { Outbreak } from "@/lib/outbreaks";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import RiskBadge from "@/components/RiskBadge";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";

const COPY: Record<string, {
  cases: string; deaths: string; cfr: string; incidence: string; date: string;
  source: string; description: string; close: string;
  noData: string; cfrFull: string; region: string;
  partialData: string; dataAge: (d: number) => string; fresh: string; stale: string;
  incidencePer100k: string;
}> = {
  fr: { cases: "Cas confirmés", deaths: "Décès", cfr: "Létalité", incidence: "Incidence", date: "Rapport du", source: "Bulletin OMS original", description: "Résumé", close: "Fermer", noData: "N/D", cfrFull: "Taux de létalité (CFR)", region: "Région", partialData: "Données partielles — chiffres non disponibles dans ce rapport OMS", dataAge: (d) => `Il y a ${d} jour${d > 1 ? "s" : ""}`, fresh: "Données récentes", stale: "Rapport ancien", incidencePer100k: "pour 100 000 hab." },
  en: { cases: "Confirmed cases", deaths: "Deaths", cfr: "CFR", incidence: "Incidence", date: "Report date", source: "Original WHO bulletin", description: "Summary", close: "Close", noData: "N/A", cfrFull: "Case fatality rate (CFR)", region: "Region", partialData: "Partial data — figures not available in this WHO report", dataAge: (d) => `${d} day${d > 1 ? "s" : ""} ago`, fresh: "Recent data", stale: "Old report", incidencePer100k: "per 100,000 pop." },
  es: { cases: "Casos confirmados", deaths: "Fallecidos", cfr: "Letalidad", incidence: "Incidencia", date: "Informe del", source: "Boletín OMS original", description: "Resumen", close: "Cerrar", noData: "N/D", cfrFull: "Tasa de letalidad (CFR)", region: "Región", partialData: "Datos parciales — cifras no disponibles en este informe OMS", dataAge: (d) => `Hace ${d} día${d > 1 ? "s" : ""}`, fresh: "Datos recientes", stale: "Informe antiguo", incidencePer100k: "por 100.000 hab." },
  ar: { cases: "الحالات المؤكدة", deaths: "الوفيات", cfr: "معدل الوفيات", incidence: "معدل الإصابة", date: "تاريخ التقرير", source: "النشرة الرسمية لـ OMS", description: "ملخص", close: "إغلاق", noData: "غ/م", cfrFull: "معدل إماتة الحالات (CFR)", region: "المنطقة", partialData: "بيانات جزئية — الأرقام غير متوفرة في هذا التقرير", dataAge: (d) => `منذ ${d} يوم`, fresh: "بيانات حديثة", stale: "تقرير قديم", incidencePer100k: "لكل 100,000 ساكن" },
  id: { cases: "Kasus terkonfirmasi", deaths: "Kematian", cfr: "CFR", incidence: "Insidensi", date: "Tanggal laporan", source: "Buletin WHO asli", description: "Ringkasan", close: "Tutup", noData: "T/S", cfrFull: "Tingkat kematian kasus (CFR)", region: "Wilayah", partialData: "Data parsial — angka tidak tersedia dalam laporan WHO ini", dataAge: (d) => `${d} hari lalu`, fresh: "Data terbaru", stale: "Laporan lama", incidencePer100k: "per 100.000 penduduk" },
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
  watchlist?: Set<string>;
  onClose: () => void;
}

export default function OutbreakDetailModal({ outbreak, locale, isPaid, watchlist, onClose }: Props) {
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
  const hasData    = outbreak.cases > 0;
  const cfr        = hasData ? (outbreak.deaths / outbreak.cases * 100).toFixed(1) : null;
  const incidence  = getIncidenceRate(outbreak.cases, outbreak.country_en);

  // Data freshness
  const daysSince = Math.floor((Date.now() - new Date(outbreak.date).getTime()) / 86_400_000);
  const isFresh   = daysSince <= 7;
  const isStale   = daysSince > 30;

  // DON reference from source URL (e.g., "2026-DON603")
  const donRef = outbreak.source?.match(/item\/([\w-]+)/)?.[1] ?? null;

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
              {outbreak.is_pheic && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-700/50 text-purple-300 font-bold">
                  🚨 PHEIC
                </span>
              )}
              {outbreak.corroborated && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/40 text-blue-300 font-medium">
                  🔁 WHO + ProMED
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{disease}</h2>
            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{country}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {/* Watchlist star */}
            <WatchlistButton
              outbreakId={outbreak.id}
              initialWatched={watchlist?.has(outbreak.id) ?? false}
              isPaid={isPaid}
              locale={locale}
            />
            {/* Download card image */}
            <a
              href={`/api/outbreak-card/${outbreak.id}?locale=${locale}`}
              target="_blank"
              rel="noopener noreferrer"
              title={locale === "fr" ? "Télécharger comme image" :
                     locale === "es" ? "Descargar como imagen" :
                     locale === "ar" ? "تنزيل كصورة" :
                     locale === "id" ? "Unduh sebagai gambar" :
                     "Download as image"}
              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ImageDown className="w-4 h-4" />
            </a>
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
        <div className={`grid ${incidence !== null ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-3 p-5`}>
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

          {/* Incidence rate */}
          {incidence !== null && (
            <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
              <Activity className="w-4 h-4 text-purple-400 mx-auto" />
              <p className="text-xs text-gray-500">{c.incidence}</p>
              {isPaid ? (
                <div>
                  <p className={`text-lg font-bold ${
                    incidence > 100 ? "text-red-400" :
                    incidence > 10  ? "text-amber-400" : "text-gray-300"
                  }`}>
                    {incidence < 0.01 ? "<0.01" : incidence.toFixed(incidence < 1 ? 2 : 1)}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{c.incidencePer100k}</p>
                </div>
              ) : (
                <p className="text-lg font-bold blur-sm select-none text-gray-300">0.36</p>
              )}
            </div>
          )}
        </div>

        {/* PHEIC banner */}
        {outbreak.is_pheic && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-purple-900/20 border border-purple-700/30 rounded-xl p-3 text-xs text-purple-300">
            <span className="shrink-0 text-base">🚨</span>
            <span>
              {locale === "fr" ? "Urgence de Santé Publique de Portée Internationale (USPPI) — déclarée par le Directeur Général de l'OMS. Niveau d'alerte maximal." :
               locale === "es" ? "Emergencia de Salud Pública de Importancia Internacional (ESPII) — declarada por el Director General de la OMS." :
               locale === "ar" ? "طوارئ الصحة العمومية التي تثير قلقاً دولياً — أعلنها المدير العام لمنظمة الصحة العالمية." :
               locale === "id" ? "Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (KKMMD) — dinyatakan oleh Direktur Jenderal WHO." :
               "Public Health Emergency of International Concern (PHEIC) — declared by the WHO Director-General. Highest global health alert level."}
            </span>
          </div>
        )}

        {/* Partial data warning */}
        {!hasData && (
          <div className="mx-5 mb-3 flex items-start gap-2 bg-amber-900/20 border border-amber-800/30 rounded-xl p-3 text-xs text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {c.partialData}
          </div>
        )}

        {/* Meta */}
        <div className="px-5 pb-3 space-y-2 text-sm">
          {/* Report date + freshness */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-gray-400">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{c.date}</span>
              <span className="text-gray-300 font-medium">{outbreak.date}</span>
              {donRef && (
                <span className="text-gray-600 text-xs">· {donRef}</span>
              )}
            </div>
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border shrink-0 ${
              isFresh ? "bg-green-900/20 border-green-800/30 text-green-400" :
              isStale ? "bg-red-900/20 border-red-800/30 text-red-400" :
                        "bg-amber-900/20 border-amber-800/30 text-amber-400"
            }`}>
              <Clock className="w-3 h-3" />
              {isFresh ? c.fresh : isStale ? c.stale : c.dataAge(daysSince)}
            </span>
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

        {/* Source links */}
        <div className="px-5 pb-5 space-y-2">
          {outbreak.source && (
            <a
              href={outbreak.source}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              {c.source} →
            </a>
          )}
          {outbreak.promed_source && (
            <a
              href={outbreak.promed_source}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              ProMED →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
