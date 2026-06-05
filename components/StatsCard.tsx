"use client";

interface StatsCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: "red" | "orange" | "yellow" | "blue" | "purple" | "gray";
}

const colorMap: Record<string, string> = {
  red:    "border-red-500 bg-red-500/10 text-red-400",
  orange: "border-orange-500 bg-orange-500/10 text-orange-400",
  yellow: "border-yellow-500 bg-yellow-500/10 text-yellow-400",
  blue:   "border-blue-500 bg-blue-500/10 text-blue-400",
  purple: "border-purple-500 bg-purple-500/10 text-purple-400",
  gray:   "border-gray-700 bg-gray-800/40 text-gray-500",
};

export default function StatsCard({ label, value, icon, color }: StatsCardProps) {
  const cls = colorMap[color] ?? colorMap.gray; // safe fallback
  return (
    <div className={`border rounded-xl p-5 ${cls}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
