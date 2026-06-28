import { TrendingUp, TrendingDown, Minus, CheckCircle } from "lucide-react";
import type { OutbreakTrend } from "@/lib/outbreak-trend";

const LABELS: Record<string, Record<string, string>> = {
  expanding: { fr: "En expansion", en: "Expanding",           es: "En expansión",          ar: "في تصاعد",        id: "Berkembang"          },
  declining:  { fr: "En déclin",   en: "Declining",           es: "En declive",             ar: "في تراجع",        id: "Menurun"             },
  stable:     { fr: "Stable",      en: "Stable",              es: "Estable",                ar: "مستقر",            id: "Stabil"              },
  resolved:   { fr: "Poss. résolu",en: "Possibly resolved",   es: "Pos. resuelto",          ar: "ربما محسوم",      id: "Mungkin selesai"     },
};

type PhaseKey = "expanding" | "declining" | "stable" | "resolved";

export function getPhaseKey(
  trend: OutbreakTrend | undefined,
  staleDays: number | null
): PhaseKey | null {
  if (staleDays !== null)                         return "resolved";
  if (!trend || trend.direction === "unknown")    return null;
  if (trend.direction === "up")                   return "expanding";
  if (trend.direction === "down")                 return "declining";
  return "stable";
}

const STYLES: Record<PhaseKey, string> = {
  expanding: "bg-red-500/10 border-red-500/30 text-red-400",
  declining:  "bg-green-500/10 border-green-500/30 text-green-400",
  stable:     "bg-gray-600/20 border-gray-500/30 text-gray-400",
  resolved:   "bg-blue-500/10 border-blue-500/30 text-blue-400",
};

const ICONS: Record<PhaseKey, React.ElementType> = {
  expanding: TrendingUp,
  declining:  TrendingDown,
  stable:     Minus,
  resolved:   CheckCircle,
};

export default function PhaseBadge({
  trend,
  staleDays,
  locale,
}: {
  trend?: OutbreakTrend;
  staleDays: number | null;
  locale: string;
}) {
  const key = getPhaseKey(trend, staleDays);
  if (!key) return null;

  const label = LABELS[key][locale] ?? LABELS[key].en;
  const Icon  = ICONS[key];

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${STYLES[key]}`}>
      <Icon className="w-3 h-3 shrink-0" />
      {label}
    </span>
  );
}
