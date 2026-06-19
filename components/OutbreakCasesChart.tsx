"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Snapshot {
  snapped_at: string;
  cases: number;
  deaths: number;
}

interface Props {
  snapshots: Snapshot[];
  riskLevel: string;
  locale: string;
}

const RISK_COLOR: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#22c55e",
};

const LABEL: Record<string, { cases: string; deaths: string; noData: string }> = {
  fr: { cases: "Cas",     deaths: "Décès",    noData: "Données insuffisantes (< 7 jours)" },
  en: { cases: "Cases",   deaths: "Deaths",   noData: "Insufficient data (< 7 days)" },
  es: { cases: "Casos",   deaths: "Muertes",  noData: "Datos insuficientes (< 7 días)" },
  ar: { cases: "الحالات", deaths: "الوفيات",  noData: "بيانات غير كافية (< 7 أيام)" },
  id: { cases: "Kasus",   deaths: "Kematian", noData: "Data tidak cukup (< 7 hari)" },
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function formatNum(n: number) {
  return n.toLocaleString("en");
}

export default function OutbreakCasesChart({ snapshots, riskLevel, locale }: Props) {
  const l = LABEL[locale] ?? LABEL.en;
  const color = RISK_COLOR[riskLevel] ?? "#ef4444";

  if (snapshots.length < 2) {
    return (
      <p className="text-xs text-gray-500 text-center py-4">{l.noData}</p>
    );
  }

  const data = snapshots.map((s) => ({
    date: formatDate(s.snapped_at),
    cases: s.cases,
    deaths: s.deaths,
  }));

  // Show every Nth tick to avoid overcrowding
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${riskLevel}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fill: "#6b7280", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatNum}
          width={55}
        />
        <Tooltip
          contentStyle={{
            background: "#1f2937",
            border: "1px solid #374151",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#f9fafb",
          }}
          labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
          formatter={(value, name) => [
            typeof value === "number" ? formatNum(value) : String(value ?? ""),
            name === "cases" ? l.cases : l.deaths,
          ]}
        />
        <Area
          type="monotone"
          dataKey="cases"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${riskLevel})`}
          dot={false}
          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
