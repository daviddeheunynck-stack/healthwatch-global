import { useTranslations } from "next-intl";
import { Activity, Globe, Bell, AlertTriangle } from "lucide-react";
import { getOutbreaks, getStats } from "@/lib/outbreaks";
import StatsCard from "@/components/StatsCard";
import RiskBadge from "@/components/RiskBadge";
import WorldMap from "@/components/WorldMap";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function DashboardContent() {
  const outbreaks = await getOutbreaks();
  const stats = getStats(outbreaks);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard label="Épidémies Actives" value={stats.activeOutbreaks} icon={<Activity className="w-5 h-5" />} color="red" />
        <StatsCard label="Pays Touchés" value={stats.countriesAffected} icon={<Globe className="w-5 h-5" />} color="blue" />
        <StatsCard label="Alertes (7j)" value={stats.alertsToday} icon={<Bell className="w-5 h-5" />} color="orange" />
        <StatsCard label="Risque Élevé" value={stats.highRisk} icon={<AlertTriangle className="w-5 h-5" />} color="yellow" />
      </div>

      <WorldMap outbreaks={outbreaks} />

      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Alertes récentes</h2>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Maladie</th>
                <th className="text-left px-4 py-3">Pays</th>
                <th className="text-left px-4 py-3">Cas</th>
                <th className="text-left px-4 py-3">Décès</th>
                <th className="text-left px-4 py-3">Risque</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {outbreaks
                .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.risk_level] - { high: 0, medium: 1, low: 2 }[b.risk_level]))
                .map((outbreak, i) => (
                  <tr key={outbreak.id} className={`border-t border-gray-800 hover:bg-gray-800/50 transition-colors ${i % 2 === 0 ? "bg-gray-900/30" : ""}`}>
                    <td className="px-4 py-3 font-medium text-white">{outbreak.disease}</td>
                    <td className="px-4 py-3 text-gray-300">{outbreak.country}</td>
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

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Surveillance Sanitaire Mondiale</h1>
        <p className="text-gray-400 mt-1">Suivi en temps réel des épidémies dans le monde</p>
      </div>
      <Suspense fallback={
        <div className="flex items-center justify-center py-20 text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3" />
          Chargement des données...
        </div>
      }>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
