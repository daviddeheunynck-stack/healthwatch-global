"use client";

import { useState } from "react";
import { Bell, Mail, Code2, Users } from "lucide-react";
import CategoryAlertPanel    from "@/components/CategoryAlertPanel";
import DiseaseWatchlistPanel from "@/components/DiseaseWatchlistPanel";
import GeofenceAlertPanel    from "@/components/GeofenceAlertPanel";
import CountryRiskAlertPanel from "@/components/CountryRiskAlertPanel";
import AlertLocalePanel      from "@/components/AlertLocalePanel";
import DigestPanel           from "@/components/DigestPanel";
import DigestRegionPanel     from "@/components/DigestRegionPanel";
import ScheduledReportPanel  from "@/components/ScheduledReportPanel";
import DataAccessPanel       from "@/components/DataAccessPanel";
import WebhookPanel          from "@/components/WebhookPanel";
import OrgPanel              from "@/components/OrgPanel";

type TabKey = "alerts" | "notifications" | "integration" | "team";

const TAB_LABELS: Record<string, Record<TabKey, string>> = {
  en: { alerts: "Alerts",        notifications: "Notifications", integration: "Integration", team: "Team"   },
  fr: { alerts: "Alertes",       notifications: "Notifications", integration: "Intégration", team: "Équipe" },
  es: { alerts: "Alertas",       notifications: "Notificaciones",integration: "Integración", team: "Equipo" },
  ar: { alerts: "التنبيهات",     notifications: "الإشعارات",     integration: "التكامل",     team: "الفريق" },
  id: { alerts: "Peringatan",    notifications: "Notifikasi",    integration: "Integrasi",   team: "Tim"    },
};

const TABS: { key: TabKey; icon: React.ElementType }[] = [
  { key: "alerts",        icon: Bell   },
  { key: "notifications", icon: Mail   },
  { key: "integration",   icon: Code2  },
  { key: "team",          icon: Users  },
];

export default function SettingsTabs({
  locale,
  userEmail,
  initialWatchlist,
  initialTab = "alerts",
}: {
  locale: string;
  userEmail: string | null;
  initialWatchlist: string[];
  initialTab?: string;
}) {
  const safeTab = (["alerts", "notifications", "integration", "team"] as TabKey[]).includes(initialTab as TabKey)
    ? (initialTab as TabKey)
    : "alerts";
  const [active, setActive] = useState<TabKey>(safeTab);
  const labels = TAB_LABELS[locale] ?? TAB_LABELS.en;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
        {TABS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              active === key
                ? "border-blue-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {labels[key]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        {active === "alerts" && (
          <>
            <CategoryAlertPanel    locale={locale} userEmail={userEmail ?? undefined} />
            <DiseaseWatchlistPanel locale={locale} initialWatchlist={initialWatchlist} />
            <GeofenceAlertPanel    locale={locale} userEmail={userEmail ?? undefined} />
            <CountryRiskAlertPanel locale={locale} userEmail={userEmail ?? undefined} />
            <AlertLocalePanel      locale={locale} />
          </>
        )}
        {active === "notifications" && (
          <>
            <DigestPanel          locale={locale} />
            <DigestRegionPanel    locale={locale} />
            <ScheduledReportPanel locale={locale} />
          </>
        )}
        {active === "integration" && (
          <>
            <DataAccessPanel locale={locale} />
            <WebhookPanel    locale={locale} />
          </>
        )}
        {active === "team" && (
          <OrgPanel locale={locale} />
        )}
      </div>
    </div>
  );
}
