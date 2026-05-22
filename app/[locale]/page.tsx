import { useTranslations } from "next-intl";
import { Activity, Globe, Bell, AlertTriangle } from "lucide-react";
import { LIVE_OUTBREAKS, getStats } from "@/lib/outbreaks";
import StatsCard from "@/components/StatsCard";
import RiskBadge from "@/components/RiskBadge";
import WorldMap from "@/components/WorldMap";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const stats = getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
        <p className="text-gray-400 mt-1">{t("subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label={t("activeOutbreaks")}
          value={stats.activeOutbreaks}
          icon={<Activity className="w-5 h-5" />}
          color="red"
        />
        <StatsCard
          label={t("countriesAffected")}
          value={stats.countriesAffected}
          icon={<Globe className="w-5 h-5" />}
          color="blue"
        />
        <StatsCard
          label={t("alertsToday")}
          value={stats.alertsToday}
          icon={<Bell className="w-5 h-5" />}
          color="orange"
        />
        <StatsCard
          label={t("highRisk")}
          value={stats.highRisk}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="yellow"
        />
      </div>

      {/* Map */}
      <WorldMap outbreaks={LIVE_OUTBREAKS} />

      {/* Recent alerts table */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">{t("recentAlerts")}</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Maladie</th>
                <th className="text-left px-4 py-3">Pays</th>
                <th className="text-left px-4 py-3">Cas</th>
                <th className="text-left px-4 py-3">Décès</th>
                <th className="text-left px-4 py-3">{t("riskLevel")}</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {LIVE_OUTBREAKS.sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.riskLevel] - order[b.riskLevel];
              }).map((outbreak, i) => (
                <tr
                  key={outbreak.id}
                  className={`border-t border-gray-800 hover:bg-gray-800/50 transition-colors ${
                    i % 2 === 0 ? "bg-gray-900/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-white">{outbreak.disease}</td>
                  <td className="px-4 py-3 text-gray-300">{outbreak.country}</td>
                  <td className="px-4 py-3 text-gray-300">{outbreak.cases.toLocaleString()}</td>
                  <td className="px-4 py-3 text-red-400">{outbreak.deaths.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={outbreak.riskLevel} />
                  </td>
                  <td className="px-4 py-3 text-gray-400">{outbreak.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
