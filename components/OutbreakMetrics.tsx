"use client";

import { computeEpidemicMetrics, getSerialInterval } from "@/lib/epidemic-metrics";

interface Snapshot { snapped_at: string; cases: number; }

const COPY: Record<string, {
  title: string;
  doublingTime: string; halvingTime: string; growth: string;
  rt: string; growing: string; declining: string; stable: string;
  days: (n: number) => string;
  disclaimer: string;
  si: (n: number) => string;
}> = {
  fr: {
    title: "Dynamique de transmission",
    doublingTime: "Temps de doublement", halvingTime: "Temps de demi-vie", growth: "Δ/jour",
    rt: "Rt estimé", growing: "progression", declining: "déclin", stable: "stable",
    days: (n) => `${n} jours de données`,
    disclaimer: "Estimation préliminaire — modèle exponentiel, délais de déclaration non pris en compte.",
    si: (n) => `IS supposé : ${n} j`,
  },
  en: {
    title: "Transmission dynamics",
    doublingTime: "Doubling time", halvingTime: "Halving time", growth: "Δ/day",
    rt: "Estimated Rt", growing: "spreading", declining: "declining", stable: "stable",
    days: (n) => `${n} days of data`,
    disclaimer: "Preliminary estimate — exponential model, reporting delays not accounted for.",
    si: (n) => `Assumed SI: ${n} d`,
  },
  es: {
    title: "Dinámica de transmisión",
    doublingTime: "Tiempo de duplicación", halvingTime: "Tiempo de semivida", growth: "Δ/día",
    rt: "Rt estimado", growing: "propagación", declining: "declive", stable: "estable",
    days: (n) => `${n} días de datos`,
    disclaimer: "Estimación preliminar — modelo exponencial, sin retrasos de notificación.",
    si: (n) => `IS asumido: ${n} d`,
  },
  ar: {
    title: "ديناميكيات الانتقال",
    doublingTime: "زمن المضاعفة", halvingTime: "زمن نصف الإزالة", growth: "Δ/يوم",
    rt: "Rt المُقدَّر", growing: "انتشار", declining: "تراجع", stable: "مستقر",
    days: (n) => `بيانات ${n} أيام`,
    disclaimer: "تقدير أولي — نموذج أسي، دون احتساب تأخيرات الإبلاغ.",
    si: (n) => `الفترة التسلسلية: ${n} يوماً`,
  },
  id: {
    title: "Dinamika transmisi",
    doublingTime: "Waktu penggandaan", halvingTime: "Waktu paruh", growth: "Δ/hari",
    rt: "Rt perkiraan", growing: "menyebar", declining: "menurun", stable: "stabil",
    days: (n) => `data ${n} hari`,
    disclaimer: "Perkiraan awal — model eksponensial, tanpa keterlambatan pelaporan.",
    si: (n) => `SI diasumsikan: ${n} h`,
  },
};

interface Props {
  snapshots: Snapshot[];
  diseaseEn?: string | null;
  locale: string;
}

export default function OutbreakMetrics({ snapshots, diseaseEn, locale }: Props) {
  const c = COPY[locale] ?? COPY.en;
  if (snapshots.length < 2) return null;

  const m = computeEpidemicMetrics(snapshots, diseaseEn);
  if (m.trend === "insufficient_data") return null;

  const rtColor =
    m.rtEstimate === null ? "text-gray-400" :
    m.rtEstimate > 1.5    ? "text-red-400"   :
    m.rtEstimate > 1.0    ? "text-amber-400" : "text-green-400";

  const rtBg =
    m.rtEstimate === null ? "border-gray-800 bg-white/5" :
    m.rtEstimate > 1.5    ? "border-red-700/40 bg-red-900/20"     :
    m.rtEstimate > 1.0    ? "border-amber-700/40 bg-amber-900/20" :
                            "border-green-700/40 bg-green-900/20";

  const growthColor =
    (m.dailyGrowthPct ?? 0) > 0  ? "text-red-400"   :
    (m.dailyGrowthPct ?? 0) < 0  ? "text-green-400" : "text-gray-400";

  const si = getSerialInterval(diseaseEn);

  return (
    <div className="px-5 pb-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{c.title}</p>

      <div className="grid grid-cols-3 gap-2">
        {/* Doubling / halving time */}
        <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
          <p className="text-[10px] text-gray-500 leading-tight">
            {m.trend === "declining" ? c.halvingTime : c.doublingTime}
          </p>
          <p className={`text-base font-bold ${
            m.trend === "declining" ? "text-green-400" :
            m.trend === "growing"   ? "text-red-400"   : "text-gray-400"
          }`}>
            {m.trend === "growing"  && m.doublingTimeDays !== null ? `${m.doublingTimeDays}j` :
             m.trend === "declining" && m.halvingTimeDays !== null  ? `${m.halvingTimeDays}j` :
             c.stable}
          </p>
        </div>

        {/* Rt */}
        <div className={`rounded-xl p-3 text-center space-y-1 border ${rtBg}`}>
          <p className="text-[10px] text-gray-500">{c.rt}</p>
          <p className={`text-base font-bold ${rtColor}`}>
            {m.rtEstimate !== null ? m.rtEstimate.toFixed(2) : "—"}
          </p>
          <p className={`text-[10px] ${rtColor} opacity-70`}>
            {m.trend === "growing"  ? `↑ ${c.growing}`  :
             m.trend === "declining" ? `↓ ${c.declining}` :
             `→ ${c.stable}`}
          </p>
        </div>

        {/* Growth rate */}
        <div className="bg-white/5 rounded-xl p-3 text-center space-y-1">
          <p className="text-[10px] text-gray-500">{c.growth}</p>
          <p className={`text-base font-bold ${growthColor}`}>
            {m.dailyGrowthPct !== null
              ? `${m.dailyGrowthPct > 0 ? "+" : ""}${m.dailyGrowthPct}%`
              : "—"}
          </p>
        </div>
      </div>

      <p
        className="text-[10px] text-gray-600 mt-2 leading-snug"
        title={c.disclaimer}
      >
        {c.days(m.basedOnDays)} · {c.si(si)} · {c.disclaimer}
      </p>
    </div>
  );
}
