import { getTranslations, getLocale } from "next-intl/server";
import { Activity, Globe, Bell, AlertTriangle, Lock } from "lucide-react";
import { getOutbreaks, getStats, getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import { createClient } from "@/lib/supabase-server";
import StatsCard from "@/components/StatsCard";
import RiskBadge from "@/components/RiskBadge";
import WorldMap from "@/components/WorldMap";
import { Suspense } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function DashboardContent() {
  const locale = await getLocale();
  const t = await getTranslations("dashboard");
  const tRisk = await getTranslations("risk");

  // Check user plan
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let plan = "free";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    plan = profile?.plan || "free";
  }

  const isPaid = plan === "starter" || plan === "pro";

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

  const sortedOutbreaks = [...outbreaks].sort(
    (a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk_level] - { high: 0, medium: 1, low: 2 }[b.risk_level])
  );

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

        {/* Upgrade banner for free users */}
        {!isPaid && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-3 flex items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <Lock className="w-4 h-4 shrink-0" />
              <span>{t("lockedDesc")}</span>
            </div>
            <Link
              href={`/${locale}/pricing`}
              className="shrink-0 text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {t("lockedCta")}
            </Link>
          </div>
        )}

        <div className="rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">{t("disease")}</th>
                <th className="text-left px-4 py-3">{t("country")}</th>
                <th className="text-left px-4 py-3">{t("cases")}</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">{t("deaths")}</th>
                <th className="text-left px-4 py-3">{t("riskLevel")}</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">{t("date")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedOutbreaks.map((outbreak, i) => (
                <tr
                  key={outbreak.id}
                  className={`border-t border-gray-800 hover:bg-gray-800/50 transition-colors ${i % 2 === 0 ? "bg-gray-900/30" : ""}`}
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {getLocalizedDisease(outbreak, locale)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {getLocalizedCountry(outbreak, locale)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {isPaid ? (
                      outbreak.cases.toLocaleString()
                    ) : (
                      <span className="blur-sm select-none text-gray-500">
                        {outbreak.cases.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-red-400 hidden sm:table-cell">
                    {isPaid ? (
                      outbreak.deaths.toLocaleString()
                    ) : (
                      <span className="blur-sm select-none text-gray-500">
                        {outbreak.deaths.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge level={outbreak.risk_level} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{outbreak.date}</td>
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
