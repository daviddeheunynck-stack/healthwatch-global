"use client";

import { useTranslations } from "next-intl";

interface RiskBadgeProps {
  level: "high" | "medium" | "low";
}

const styles = {
  high: "bg-red-500/20 text-red-400 border border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border border-green-500/30",
};

export default function RiskBadge({ level }: RiskBadgeProps) {
  const t = useTranslations("risk");
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[level]}`}>
      {t(level)}
    </span>
  );
}
