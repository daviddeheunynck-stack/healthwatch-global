"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase-browser";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { getIncidenceRate } from "@/lib/population-data";
import RiskBadge from "@/components/RiskBadge";
import type { Outbreak } from "@/lib/outbreaks";
import { ArrowLeftRight, TrendingUp, Users, Skull, Activity, Globe, Calendar, AlertTriangle } from "lucide-react";

const LABELS: Record<string, {
  title: string; subtitle: string; selectA: string; selectB: string;
  all: string; compare: string; clear: string;
  cases: string; deaths: string; cfr: string; incidence: string;
  date: string; region: string; source: string; pheic: string;
  corroborated: string; noData: string; winner: string; lower: string;
  selectBoth: string;
}> = {
  fr: {
    title: "Comparer des foyers", subtitle: "Analysez deux épidémies côte à côte",
    selectA: "Foyer A", selectB: "Foyer B", all: "Choisir un foyer…",
    compare: "Comparer", clear: "Effacer",
    cases: "Cas confirmés", deaths: "Décès", cfr: "Taux de létalité",
    incidence: "Incidence / 100 000", date: "Date du rapport", region: "Région",
    source: "Source OMS", pheic: "PHEIC déclaré", corroborated: "WHO + ProMED",
    noData: "N/D", winner: "Moins élevé ↓", lower: "↑ Plus élevé",
    selectBoth: "Sélectionnez deux foyers pour lancer la comparaison.",
  },
  en: {
    title: "Compare outbreaks", subtitle: "Analyse two epidemics side by side",
    selectA: "Outbreak A", selectB: "Outbreak B", all: "Choose an outbreak…",
    compare: "Compare", clear: "Clear",
    cases: "Confirmed cases", deaths: "Deaths", cfr: "Case fatality rate",
    incidence: "Incidence / 100,000", date: "Report date", region: "Region",
    source: "WHO source", pheic: "PHEIC declared", corroborated: "WHO + ProMED",
    noData: "N/A", winner: "Lower ↓", lower: "Higher ↑",
    selectBoth: "Select two outbreaks to start comparing.",
  },
  es: {
    title: "Comparar brotes", subtitle: "Analice dos epidemias lado a lado",
    selectA: "Brote A", selectB: "Brote B", all: "Elige un brote…",
    compare: "Comparar", clear: "Limpiar",
    cases: "Casos confirmados", deaths: "Fallecidos", cfr: "Tasa de letalidad",
    incidence: "Incidencia / 100.000", date: "Fecha del informe", region: "Región",
    source: "Fuente OMS", pheic: "PHEIC declarado", corroborated: "WHO + ProMED",
    noData: "N/D", winner: "Más bajo ↓", lower: "↑ Más alto",
    selectBoth: "Seleccione dos brotes para iniciar la comparación.",
  },
  ar: {
    title: "مقارنة التفشيات", subtitle: "تحليل وباءين جنباً إلى جنب",
    selectA: "التفشي A", selectB: "التفشي B", all: "اختر تفشياً…",
    compare: "مقارنة", clear: "مسح",
    cases: "الحالات المؤكدة", deaths: "الوفيات", cfr: "معدل الوفيات",
    incidence: "معدل الإصابة / 100,000", date: "تاريخ التقرير", region: "المنطقة",
    source: "مصدر OMS", pheic: "إعلان PHEIC", corroborated: "WHO + ProMED",
    noData: "غ/م", winner: "أقل ↓", lower: "↑ أعلى",
    selectBoth: "اختر تفشيين لبدء المقارنة.",
  },
  id: {
    title: "Bandingkan Wabah", subtitle: "Analisis dua epidemi secara berdampingan",
    selectA: "Wabah A", selectB: "Wabah B", all: "Pilih wabah…",
    compare: "Bandingkan", clear: "Hapus",
    cases: "Kasus terkonfirmasi", deaths: "Kematian", cfr: "Tingkat kematian",
    incidence: "Insidensi / 100.000", date: "Tanggal laporan", region: "Wilayah",
    source: "Sumber WHO", pheic: "PHEIC dinyatakan", corroborated: "WHO + ProMED",
    noData: "T/S", winner: "Lebih rendah ↓", lower: "↑ Lebih tinggi",
    selectBoth: "Pilih dua wabah untuk memulai perbandingan.",
  },
};

function StatRow({ label, valA, valB, icon, higherIsBad = true }: {
  label: string; valA: number | null; valB: number | null;
  icon: React.ReactNode; higherIsBad?: boolean;
}) {
  const both = valA !== null && valB !== null && valA > 0 && valB > 0;
  const aIsWorse = both && higherIsBad ? valA > valB : both && !higherIsBad ? valA < valB : false;
  const bIsWorse = both && higherIsBad ? valB > valA : both && !higherIsBad ? valB < valA : false;

  return (
    <tr className="border-b border-gray-800">
      <td className="px-4 py-3 text-gray-500 text-sm">
        <div className="flex items-center gap-2">{icon}{label}</div>
      </td>
      <td className={`px-4 py-3 text-center font-bold text-lg ${aIsWorse ? "text-red-400" : bIsWorse ? "text-green-400" : "text-white"}`}>
        {valA !== null && valA > 0 ? valA.toLocaleString() : "—"}
      </td>
      <td className="px-4 py-3 text-center text-gray-600 text-xs">vs</td>
      <td className={`px-4 py-3 text-center font-bold text-lg ${bIsWorse ? "text-red-400" : aIsWorse ? "text-green-400" : "text-white"}`}>
        {valB !== null && valB > 0 ? valB.toLocaleString() : "—"}
      </td>
    </tr>
  );
}

export default function ComparePage() {
  const locale = useLocale();
  const l = LABELS[locale] ?? LABELS.en;
  const isRtl = locale === "ar";

  const [outbreaks, setOutbreaks] = useState<Outbreak[]>([]);
  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");

  useEffect(() => {
    const sb = createClient();
    sb.from("outbreaks")
      .select("*")
      .eq("active", true)
      .order("risk_level")
      .limit(100)
      .then(({ data }) => setOutbreaks((data as unknown as Outbreak[]) ?? []));
  }, []);

  const oA = outbreaks.find((o) => o.id === idA) ?? null;
  const oB = outbreaks.find((o) => o.id === idB) ?? null;

  const cfrA = oA && oA.cases > 0 ? (oA.deaths / oA.cases * 100) : null;
  const cfrB = oB && oB.cases > 0 ? (oB.deaths / oB.cases * 100) : null;
  const incA = oA ? getIncidenceRate(oA.cases, oA.country_en) : null;
  const incB = oB ? getIncidenceRate(oB.cases, oB.country_en) : null;

  const options = outbreaks.map((o) => ({
    id: o.id,
    label: `${getLocalizedDisease(o, locale) ?? o.disease} — ${getLocalizedCountry(o, locale) ?? o.country}`,
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir={isRtl ? "rtl" : undefined}>
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ArrowLeftRight className="w-6 h-6 text-red-400" />
          {l.title}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{l.subtitle}</p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: l.selectA, value: idA, set: setIdA, other: idB },
          { label: l.selectB, value: idB, set: setIdB, other: idA },
        ].map(({ label, value, set, other }) => (
          <div key={label} className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
            <select
              value={value}
              onChange={(e) => set(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
            >
              <option value="">{l.all}</option>
              {options
                .filter((o) => o.id !== other)
                .map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
            </select>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {(!oA || !oB) && (
        <div className="text-center py-16 text-gray-600 text-sm">
          <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 opacity-20" />
          {l.selectBoth}
        </div>
      )}

      {/* Comparison table */}
      {oA && oB && (
        <div className="space-y-4">
          {/* Header row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-2xl p-4 space-y-2">
              <RiskBadge level={oA.risk_level as any} />
              <h3 className="text-white font-bold text-lg leading-tight">
                {getLocalizedDisease(oA, locale)}
              </h3>
              <p className="text-gray-400 text-sm">
                📍 {getLocalizedCountry(oA, locale)}
              </p>
              {oA.is_pheic && <span className="text-xs text-purple-400">🚨 {l.pheic}</span>}
            </div>

            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-gray-500" />
              </div>
            </div>

            <div className="bg-amber-900/20 border border-amber-700/30 rounded-2xl p-4 space-y-2">
              <RiskBadge level={oB.risk_level as any} />
              <h3 className="text-white font-bold text-lg leading-tight">
                {getLocalizedDisease(oB, locale)}
              </h3>
              <p className="text-gray-400 text-sm">
                📍 {getLocalizedCountry(oB, locale)}
              </p>
              {oB.is_pheic && <span className="text-xs text-purple-400">🚨 {l.pheic}</span>}
            </div>
          </div>

          {/* Stats table */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase w-1/3"></th>
                  <th className="px-4 py-3 text-center text-blue-400 font-bold text-sm">A</th>
                  <th className="px-4 py-3 text-center w-12"></th>
                  <th className="px-4 py-3 text-center text-amber-400 font-bold text-sm">B</th>
                </tr>
              </thead>
              <tbody>
                <StatRow label={l.cases}    valA={oA.cases}    valB={oB.cases}    icon={<Users  className="w-3.5 h-3.5" />} higherIsBad />
                <StatRow label={l.deaths}   valA={oA.deaths}   valB={oB.deaths}   icon={<Skull  className="w-3.5 h-3.5" />} higherIsBad />
                <StatRow label={l.cfr}      valA={cfrA}        valB={cfrB}        icon={<TrendingUp className="w-3.5 h-3.5" />} higherIsBad />
                <StatRow label={l.incidence} valA={incA}        valB={incB}        icon={<Activity className="w-3.5 h-3.5" />} higherIsBad />
                {/* Date */}
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />{l.date}</div>
                  </td>
                  <td className="px-4 py-3 text-center text-white text-sm">{oA.date}</td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">vs</td>
                  <td className="px-4 py-3 text-center text-white text-sm">{oB.date}</td>
                </tr>
                {/* Region */}
                <tr className="border-b border-gray-800">
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    <div className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" />{l.region}</div>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300 text-sm capitalize">{oA.region}</td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">vs</td>
                  <td className="px-4 py-3 text-center text-gray-300 text-sm capitalize">{oB.region}</td>
                </tr>
                {/* Badges */}
                <tr>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    <div className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" />Status</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {oA.is_pheic && <span className="text-xs text-purple-400">🚨 PHEIC</span>}
                      {oA.corroborated && <span className="text-xs text-blue-400">🔁 {l.corroborated}</span>}
                      {!oA.is_pheic && !oA.corroborated && <span className="text-gray-600 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      {oB.is_pheic && <span className="text-xs text-purple-400">🚨 PHEIC</span>}
                      {oB.corroborated && <span className="text-xs text-blue-400">🔁 {l.corroborated}</span>}
                      {!oB.is_pheic && !oB.corroborated && <span className="text-gray-600 text-xs">—</span>}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Color legend */}
          <p className="text-xs text-gray-600 text-center">
            🟢 = {l.winner} &nbsp;·&nbsp; 🔴 = {l.lower}
          </p>
        </div>
      )}
    </div>
  );
}
