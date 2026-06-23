"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";

interface BenchmarkData {
  current_cases:           number;
  historical_median_cases: number;
  ratio:                   number | null;
  episodes_count:          number;
}

const COPY: Record<string, {
  title: string;
  episodes: (n: number) => string;
  median: string;
  current: string;
  above: (p: number) => string;
  below: (p: number) => string;
  similar: string;
}> = {
  fr: {
    title: "Benchmark historique",
    episodes: (n) => `${n} épisode${n > 1 ? "s" : ""} précédent${n > 1 ? "s" : ""}`,
    median: "Médiane historique",
    current: "Épisode actuel",
    above: (p) => `+${p}% au-dessus de la médiane`,
    below: (p) => `−${p}% en dessous de la médiane`,
    similar: "Comparable à la médiane historique",
  },
  en: {
    title: "Historical benchmark",
    episodes: (n) => `${n} previous episode${n > 1 ? "s" : ""}`,
    median: "Historical median",
    current: "Current episode",
    above: (p) => `+${p}% above median`,
    below: (p) => `−${p}% below median`,
    similar: "Comparable to historical median",
  },
  es: {
    title: "Referencia histórica",
    episodes: (n) => `${n} episodio${n > 1 ? "s" : ""} anterior${n > 1 ? "es" : ""}`,
    median: "Mediana histórica",
    current: "Episodio actual",
    above: (p) => `+${p}% sobre la mediana`,
    below: (p) => `−${p}% bajo la mediana`,
    similar: "Comparable a la mediana histórica",
  },
  ar: {
    title: "مرجع تاريخي",
    episodes: (n) => `${n} حلقة سابقة`,
    median: "الوسيط التاريخي",
    current: "الحلقة الحالية",
    above: (p) => `+${p}% فوق الوسيط`,
    below: (p) => `−${p}% تحت الوسيط`,
    similar: "مشابه للوسيط التاريخي",
  },
  id: {
    title: "Referensi historis",
    episodes: (n) => `${n} episode sebelumnya`,
    median: "Median historis",
    current: "Episode saat ini",
    above: (p) => `+${p}% di atas median`,
    below: (p) => `−${p}% di bawah median`,
    similar: "Sebanding dengan median historis",
  },
};

interface Props {
  outbreakId:   string;
  currentCases: number;
  locale:       string;
}

export default function OutbreakBenchmark({ outbreakId, currentCases, locale }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const numLocale = locale === "ar" ? "ar-SA" : locale;
  const [data,    setData]    = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(null);
    setLoading(true);
    fetch(`/api/outbreak-benchmark?outbreak_id=${outbreakId}`)
      .then((r) => r.json())
      .then((d) => { if (d.benchmark) setData(d.benchmark); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [outbreakId]);

  if (loading) {
    return (
      <div className="px-5 pb-3">
        <div className="h-3 w-40 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!data || data.episodes_count === 0 || currentCases <= 0) return null;

  const pctDiff = data.ratio !== null ? Math.round(Math.abs((data.ratio - 1) * 100)) : null;
  const isAbove  = data.ratio !== null && data.ratio > 1.1;
  const isBelow  = data.ratio !== null && data.ratio < 0.9;

  const maxVal       = Math.max(data.current_cases, data.historical_median_cases);
  const currentWidth = maxVal > 0 ? (data.current_cases / maxVal * 100) : 0;
  const medianWidth  = maxVal > 0 ? (data.historical_median_cases / maxVal * 100) : 0;

  return (
    <div className="px-5 pb-4 space-y-2">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.title}</p>
        <span className="text-[10px] text-gray-600">· {c.episodes(data.episodes_count)}</span>
      </div>

      <p className={`text-xs font-medium ${
        isAbove ? "text-red-400" : isBelow ? "text-green-400" : "text-gray-400"
      }`}>
        {pctDiff !== null && isAbove ? c.above(pctDiff) :
         pctDiff !== null && isBelow ? c.below(pctDiff) :
         c.similar}
      </p>

      <div className="space-y-1.5">
        {/* Current episode bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-28 shrink-0 truncate">{c.current}</span>
          <div className="flex-1 bg-gray-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                isAbove ? "bg-red-500" : isBelow ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${currentWidth}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-300 w-16 text-right shrink-0">
            {data.current_cases.toLocaleString(numLocale)}
          </span>
        </div>
        {/* Median bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-28 shrink-0 truncate">{c.median}</span>
          <div className="flex-1 bg-gray-800 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-gray-600 transition-all"
              style={{ width: `${medianWidth}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 w-16 text-right shrink-0">
            {data.historical_median_cases.toLocaleString(numLocale)}
          </span>
        </div>
      </div>
    </div>
  );
}
