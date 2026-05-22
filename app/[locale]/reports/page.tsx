import { useTranslations } from "next-intl";
import { FileText, Download } from "lucide-react";
import { LIVE_OUTBREAKS } from "@/lib/outbreaks";

const REGIONS = ["africa", "asia", "americas", "europe", "oceania"] as const;

export default function ReportsPage() {
  const t = useTranslations("reports");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <FileText className="text-red-500 w-8 h-8" />
          {t("title")}
        </h1>
        <p className="text-gray-400 mt-2">{t("subtitle")}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {REGIONS.map((region) => {
          const regionOutbreaks = LIVE_OUTBREAKS.filter((o) => o.region === region);
          const totalCases = regionOutbreaks.reduce((sum, o) => sum + o.cases, 0);
          const highRisk = regionOutbreaks.filter((o) => o.riskLevel === "high").length;

          return (
            <div
              key={region}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white capitalize">{region}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t("generated")} {new Date().toLocaleDateString()}
                  </p>
                </div>
                <button className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                  <Download className="w-3.5 h-3.5" />
                  {t("download")}
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Épidémies actives</span>
                  <span className="text-white font-medium">{regionOutbreaks.length}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Total cas rapportés</span>
                  <span className="text-white font-medium">{totalCases.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Alertes risque élevé</span>
                  <span className="text-red-400 font-medium">{highRisk}</span>
                </div>
              </div>

              {regionOutbreaks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-1">
                  {regionOutbreaks.map((o) => (
                    <div key={o.id} className="text-xs text-gray-400 flex justify-between">
                      <span>{o.disease}</span>
                      <span className={o.riskLevel === "high" ? "text-red-400" : "text-yellow-400"}>
                        {o.country}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
