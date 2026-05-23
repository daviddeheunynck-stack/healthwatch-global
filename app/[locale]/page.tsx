import { getTranslations, getLocale } from "next-intl/server";
import { Activity, Globe, Bell, AlertTriangle } from "lucide-react";
import { getOutbreaks, getStats, getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import StatsCard from "@/components/StatsCard";
import RiskBadge from "@/components/RiskBadge";
import WorldMap from "@/components/WorldMap";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function DashboardContent() {
  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tRisk = await getTranslations("risk");
  const outbreaks = await getOutbreaks();
  const stats = getStats(outbreaks);

  const popupLabels = {
    cases: t("cases"),
    deaths: t("deaths"),
    source: "Source",
    date: t("date"),
  };

  const riskLabels = {
    high: tRisk("high"),
    medium: tRisk("medium"),
    low: tRisk("low"),
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard label={t("activeOutbreaks")} value={stats.activeOutbreaks} icon={<Activity className="w-5 h-5" />} color="red" />
        <StatsCard label={t("countriesAffected")} value={stats.countriesAffected} icon={<Globe className="w-5 h-5" />} color="blue" />
        <StatsCard label={t("alertsToday")} value={stats.alertsToday} icon={<Bell className="w-5 h-5" />} color="orange" />
        <StatsCard label={t("highRisk")} value={stats.highRisk} icon={<AlertTriangle className="w-5 h-5" />} color="yellow" />
      </div>

      <WorldMap outbreaks={outbreaks} locale={locale} popupLabels={popupLabels} riskLabels={riskLabels} />

      <div>
        <h2 className="text-xl font-semibold text-white mb-4">{t("recentAlerts")}</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">{t("disease")}</th>
                <th className="text-left px-4 py-3">{t("country")}</th>
                <th className="text-left px-4 py-3">{t("cases")}</th>
                <th className="text-left px-4 py-3">{t("deaths")}</th>
                <th className="text-left px-4 py-3">{t("riskLevel")}</th>
                <th className="text-left px-4 py-3">{t("date")}</th>
              </tr>
            </thead>
            <tbody>
              {outbreaks
                .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk_level] - { high: 0, medium: 1, low: 2 }[b.risk_level]))
                .map((outbreak, i) => (
                  <tr key={outbreak.id} className={`border-t border-gray-800 hover:bg-gray-800/50 transition-colors ${i % 2 === 0 ? "bg-gray-900/30" : ""}`}>
                    <td className="px-4 py-3 font-medium text-white">{getLocalizedDisease(outbreak, locale)}</td>
                    <td className="px-4 py-3 text-gray-300">{getLocalizedCountry(outbreak, locale)}</td>
                    <td className="px-4 py-3 text-gray-300">{outbreak.cases.toLocaleString()}</td>
                    <td className="px-4 py-3 text-red-400">{outbreak.deaths.toLocaleString()}</td>
                    <td className="px-4 py-3"><RiskBadge level={outbreak.risk_level} /></td>
                    <td className="px-4 py-3 text-gray-400">{outbreak.date}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
        <p className="text-gray-400 mt-1">{t("subtitle")}</p>
      </div>
      <Suspense fallback={
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3" />
          {t("loading")}
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
