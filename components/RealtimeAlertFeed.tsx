"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Radio, Zap, ArrowUpCircle, PlusCircle, Lock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import RiskBadge from "@/components/RiskBadge";
import type { Outbreak } from "@/lib/outbreaks";

type AlertEvent = {
  id: string;
  type: "INSERT" | "UPDATE";
  data: Outbreak;
  receivedAt: Date;
};

export default function RealtimeAlertFeed() {
  const t = useTranslations("alerts");
  const locale = useLocale();
  const { openModal } = useUpgradeModal();
  const [plan, setPlan] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);

  // Fetch user plan
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setPlan("guest"); return; }
      supabase
        .from("profiles")
        .select("plan, trial_ends_at, stripe_subscription_id")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          let p = data?.plan || "free";
          if (
            p !== "free" &&
            data?.trial_ends_at &&
            new Date(data.trial_ends_at).getTime() < Date.now() &&
            !data?.stripe_subscription_id
          ) {
            p = "free";
          }
          setPlan(p);
        });
    });
  }, []);

  // Connect to Supabase Realtime (Pro/Enterprise only)
  useEffect(() => {
    if (plan !== "pro" && plan !== "enterprise") return;

    const supabase = createClient();
    const channel = supabase
      .channel("outbreaks-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "outbreaks" },
        (payload) => {
          setAlerts((prev) =>
            [{ id: crypto.randomUUID(), type: "INSERT" as const, data: payload.new as Outbreak, receivedAt: new Date() }, ...prev].slice(0, 30)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "outbreaks" },
        (payload) => {
          if (!(payload.new as Outbreak).active) return;
          setAlerts((prev) =>
            [{ id: crypto.randomUUID(), type: "UPDATE" as const, data: payload.new as Outbreak, receivedAt: new Date() }, ...prev].slice(0, 30)
          );
        }
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, [plan]);

  // Still loading plan
  if (plan === null) return null;

  // Not logged in
  if (plan === "guest") {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
        <Lock className="w-8 h-8 text-gray-600" />
        <p className="text-gray-400 text-sm">{t("realtimeLoginRequired")}</p>
        <Link
          href={`/${locale}/login`}
          className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
        >
          {t("realtimeLogin")} →
        </Link>
      </div>
    );
  }

  // Free or Starter plan — upgrade prompt
  if (plan !== "pro" && plan !== "enterprise") {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
        <Zap className="w-8 h-8 text-yellow-500" />
        <p className="text-white font-semibold">{t("realtimeProOnly")}</p>
        <p className="text-gray-400 text-sm">{t("realtimeProDesc")}</p>
        <button
          onClick={() => openModal("realtime")}
          className="mt-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {t("realtimeUpgrade")}
        </button>
      </div>
    );
  }

  // Pro/Enterprise — live feed
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-red-500" />
          <span className="text-white font-semibold text-sm">{t("realtimeTitle")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-gray-600"}`} />
          <span className="text-xs text-gray-400">
            {connected ? t("realtimeConnected") : t("realtimeConnecting")}
          </span>
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">
            {connected ? t("realtimeWaiting") : t("realtimeConnecting")}
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-800/50 transition-colors">
              <div className="mt-0.5 shrink-0">
                {alert.type === "INSERT"
                  ? <PlusCircle className="w-4 h-4 text-green-500" />
                  : <ArrowUpCircle className="w-4 h-4 text-blue-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium truncate">
                    {getLocalizedDisease(alert.data, locale)}
                  </span>
                  <RiskBadge level={alert.data.risk_level as "high" | "medium" | "low"} />
                  <span className="text-xs text-gray-500 ml-auto shrink-0">
                    {alert.receivedAt.toLocaleTimeString(locale)}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">
                  {getLocalizedCountry(alert.data, locale)} ·{" "}
                  {alert.data.cases.toLocaleString()} {t("realtimeCases")} ·{" "}
                  {alert.data.deaths.toLocaleString()} {t("realtimeDeaths")}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
