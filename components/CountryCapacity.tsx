"use client";

import { getJEEProfile } from "@/lib/jee-data";
import { ShieldCheck } from "lucide-react";

const COPY: Record<string, {
  title: string;
  overall: string;
  surveillance: string;
  laboratory: string;
  emergency: string;
  icu: string;
  icuUnit: string;
  source: string;
  noData: string;
  levels: Record<number, string>;
}> = {
  fr: {
    title: "Capacité sanitaire pays",
    overall: "Score global",
    surveillance: "Surveillance", laboratory: "Laboratoire", emergency: "Réponse urgence",
    icu: "Lits SI", icuUnit: "/100 000 hab.",
    source: "Source : OMS JEE",
    noData: "Données JEE non disponibles pour ce pays",
    levels: { 1: "Inexistante", 2: "Limitée", 3: "Développée", 4: "Démontrée", 5: "Pérenne" },
  },
  en: {
    title: "Country health capacity",
    overall: "Overall score",
    surveillance: "Surveillance", laboratory: "Laboratory", emergency: "Emergency response",
    icu: "ICU beds", icuUnit: "per 100k pop.",
    source: "Source: WHO JEE",
    noData: "JEE data not available for this country",
    levels: { 1: "No capacity", 2: "Limited", 3: "Developed", 4: "Demonstrated", 5: "Sustainable" },
  },
  es: {
    title: "Capacidad sanitaria del país",
    overall: "Puntuación global",
    surveillance: "Vigilancia", laboratory: "Laboratorio", emergency: "Respuesta emergencia",
    icu: "Camas UCI", icuUnit: "por 100k hab.",
    source: "Fuente: OMS JEE",
    noData: "Datos JEE no disponibles para este país",
    levels: { 1: "Sin capacidad", 2: "Limitada", 3: "Desarrollada", 4: "Demostrada", 5: "Sostenible" },
  },
  ar: {
    title: "القدرة الصحية للبلد",
    overall: "الدرجة الإجمالية",
    surveillance: "المراقبة", laboratory: "المختبر", emergency: "الاستجابة للطوارئ",
    icu: "أسرة العناية المركزة", icuUnit: "لكل 100 ألف",
    source: "المصدر: منظمة الصحة العالمية JEE",
    noData: "بيانات JEE غير متاحة لهذا البلد",
    levels: { 1: "لا قدرة", 2: "محدودة", 3: "متطورة", 4: "موضحة", 5: "مستدامة" },
  },
  id: {
    title: "Kapasitas kesehatan negara",
    overall: "Skor keseluruhan",
    surveillance: "Surveilans", laboratory: "Laboratorium", emergency: "Respons darurat",
    icu: "Tempat tidur ICU", icuUnit: "per 100rb penduduk",
    source: "Sumber: WHO JEE",
    noData: "Data JEE tidak tersedia untuk negara ini",
    levels: { 1: "Tidak ada", 2: "Terbatas", 3: "Berkembang", 4: "Terbukti", 5: "Berkelanjutan" },
  },
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 4 ? "bg-green-500" :
    score >= 3 ? "bg-amber-400" :
    score >= 2 ? "bg-orange-500" :
                 "bg-red-600";
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-sm transition-colors ${i <= score ? color : "bg-gray-700"}`}
        />
      ))}
    </div>
  );
}

interface Props {
  countryEn: string | null;
  locale:    string;
}

export default function CountryCapacity({ countryEn, locale }: Props) {
  const c       = COPY[locale] ?? COPY.en;
  const profile = getJEEProfile(countryEn);

  if (!profile) return null;

  const overall = parseFloat(
    ((profile.surveillance + profile.laboratory + profile.emergency_response) / 3).toFixed(1)
  );
  const overallRound = Math.round(overall);

  const overallColor =
    overall >= 4 ? "text-green-400" :
    overall >= 3 ? "text-amber-400" :
    overall >= 2 ? "text-orange-400" :
                   "text-red-400";

  const domains = [
    { label: c.surveillance, score: profile.surveillance },
    { label: c.laboratory,   score: profile.laboratory   },
    { label: c.emergency,    score: profile.emergency_response },
  ];

  return (
    <div className="px-5 pb-4 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.title}</p>
        <span className="text-[10px] text-gray-600">· WHO JEE {profile.jee_year}</span>
      </div>

      <div className="bg-white/5 rounded-xl p-3 space-y-2.5">
        {/* Overall score row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">{c.overall}</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${overallColor}`}>{overall}/5</span>
            <span className={`text-[10px] ${overallColor}`}>
              {c.levels[overallRound] ?? ""}
            </span>
          </div>
        </div>

        {/* Domain bars */}
        {domains.map((d) => (
          <div key={d.label} className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">{d.label}</span>
              <span className="text-gray-400">{d.score}/5</span>
            </div>
            <ScoreBar score={d.score} />
          </div>
        ))}

        {/* ICU beds */}
        {profile.icu_per_100k !== undefined && (
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            <span className="text-[10px] text-gray-500">{c.icu}</span>
            <span className="text-[10px] text-gray-300 font-medium">
              {profile.icu_per_100k} <span className="text-gray-600">{c.icuUnit}</span>
            </span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-700">{c.source}</p>
    </div>
  );
}
