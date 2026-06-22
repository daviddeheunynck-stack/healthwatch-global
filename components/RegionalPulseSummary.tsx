"use client";

import { useState } from "react";
import type { Outbreak } from "@/lib/outbreaks";
import { ChevronDown, ChevronUp } from "lucide-react";

const REGION_LABELS: Record<string, Record<string, string>> = {
  fr: { africa: "Afrique", asia: "Asie", europe: "Europe", americas: "Amériques", oceania: "Océanie" },
  en: { africa: "Africa", asia: "Asia", europe: "Europe", americas: "Americas", oceania: "Oceania" },
  es: { africa: "África", asia: "Asia", europe: "Europa", americas: "Américas", oceania: "Oceanía" },
  ar: { africa: "أفريقيا", asia: "آسيا", europe: "أوروبا", americas: "الأمريكتين", oceania: "أوقيانوسيا" },
  id: { africa: "Afrika", asia: "Asia", europe: "Eropa", americas: "Amerika", oceania: "Oseania" },
};

const REGION_ORDER = ["africa", "asia", "americas", "europe", "oceania"] as const;

const CASE_LABEL: Record<string, string> = { fr: "cas", es: "casos", ar: "حالة", id: "kasus", en: "cases" };
const OB_LABEL: Record<string, string>   = { fr: "foyers", es: "focos", ar: "بؤر", id: "wabah", en: "outbreaks" };

interface Props { outbreaks: Outbreak[]; locale: string }

export default function RegionalPulseSummary({ outbreaks, locale }: Props) {
  const [open, setOpen] = useState(true);
  const rl = REGION_LABELS[locale] ?? REGION_LABELS.en;

  interface RegionStat { region: string; label: string; count: number; totalCases: number; highCount: number; medCount: number }
  const stats: RegionStat[] = [];
  for (const region of REGION_ORDER) {
    const regional = outbreaks.filter((o) => o.region === region);
    if (regional.length === 0) continue;
    stats.push({
      region,
      label:      rl[region] ?? region,
      count:      regional.length,
      totalCases: regional.reduce((s, o) => s + o.cases, 0),
      highCount:  regional.filter((o) => o.risk_level === "high").length,
      medCount:   regional.filter((o) => o.risk_level === "medium").length,
    });
  }

  if (stats.length === 0) return null;

  const title = { fr: "Pouls régional", en: "Regional pulse", es: "Pulso regional", ar: "النبض الإقليمي", id: "Denyut regional" }[locale] ?? "Regional pulse";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-800/30 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-600 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {stats.map(({ region, label, count, totalCases, highCount, medCount }) => (
            <div key={region} className="flex items-center gap-2.5 border border-gray-800 rounded-lg px-3 py-2 bg-gray-950/60">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-300 whitespace-nowrap">{label}</p>
                <p className="text-[10px] text-gray-600 whitespace-nowrap">
                  {count} {OB_LABEL[locale] ?? "outbreaks"} · {totalCases.toLocaleString("en")} {CASE_LABEL[locale] ?? "cases"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {highCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-900/30 border border-red-700/40 text-red-400 whitespace-nowrap">
                    {highCount} HIGH
                  </span>
                )}
                {medCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/20 border border-amber-700/30 text-amber-500 whitespace-nowrap">
                    {medCount} MED
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
