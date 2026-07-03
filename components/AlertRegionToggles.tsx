"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import LockedUpgradeButton from "@/components/LockedUpgradeButton";

// ─── Types ────────────────────────────────────────────────────────────────────

const REGIONS = ["africa", "asia", "americas", "europe", "oceania"] as const;
type Region = (typeof REGIONS)[number];

export interface AlertRegionLabels {
  title: string;
  desc: string;
  locked: string;
  upgrade: string;
  error: string;
  emptyHint?: string;
  regionLabels: Record<string, string>;
  minRiskLabel: string;
  minRiskOptions: Record<string, string>;
}

interface Props {
  isPaid: boolean;
  initialRegions: string[];
  initialMinRisk?: Record<string, string>;
  labels: AlertRegionLabels;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertRegionToggles({ isPaid, initialRegions, initialMinRisk, labels: l }: Props) {
  const [enabled, setEnabled] = useState<Set<Region>>(
    new Set(
      initialRegions.filter((r): r is Region =>
        (REGIONS as readonly string[]).includes(r)
      )
    )
  );
  const [minRisk, setMinRisk] = useState<Record<string, string>>(initialMinRisk ?? {});
  const [pending, setPending] = useState<Region | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const changeMinRisk = async (region: Region, value: string) => {
    const prev = minRisk[region] ?? "low";
    setMinRisk((m) => ({ ...m, [region]: value }));
    try {
      const res = await fetch("/api/alert-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, minRisk: value }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setMinRisk((m) => ({ ...m, [region]: prev }));
      setError(l.error);
    }
  };

  const toggle = async (region: Region) => {
    if (!isPaid || pending) return;
    const turningOn = !enabled.has(region);

    // Optimistic update
    setEnabled((prev) => {
      const s = new Set(prev);
      if (turningOn) s.add(region); else s.delete(region);
      return s;
    });
    setPending(region);
    setError(null);

    try {
      const res = await fetch("/api/alert-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, enabled: turningOn }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      // Revert on failure
      setEnabled((prev) => {
        const s = new Set(prev);
        if (turningOn) s.delete(region); else s.add(region);
        return s;
      });
      setError(l.error);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">

      {/* Locked banner for free users */}
      {!isPaid && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-700/30">
          <p className="text-sm text-gray-400 flex-1">{l.locked}</p>
          <LockedUpgradeButton feature="realtime" label={l.upgrade} variant="banner" />
        </div>
      )}

      {/* Empty state — Pro user, no regions selected yet */}
      {isPaid && enabled.size === 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-900/20 border border-amber-700/30">
          <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300/80">
            {l.emptyHint ?? "Turn on at least one region to receive outbreak alert emails."}
          </p>
        </div>
      )}

      {/* Region toggles */}
      <div className="space-y-2">
        {REGIONS.map((region) => {
          const on      = enabled.has(region);
          const loading = pending === region;

          return (
            <div
              key={region}
              className={`w-full rounded-xl border transition-all text-sm ${
                !isPaid
                  ? "opacity-40 border-gray-800 bg-transparent"
                  : on
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-gray-800 bg-transparent hover:border-gray-600 hover:bg-gray-800/30"
              }`}
            >
              <button
                onClick={() => toggle(region)}
                disabled={!isPaid || loading}
                className={`w-full flex items-center justify-between px-4 py-3 ${
                  !isPaid ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Bell
                    className={`w-4 h-4 ${
                      on && isPaid ? "text-red-400" : "text-gray-500"
                    }`}
                  />
                  <span className={on && isPaid ? "text-white" : "text-gray-400"}>
                    {l.regionLabels[region]}
                  </span>
                </span>

                {/* Toggle pill */}
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    loading ? "opacity-50" : ""
                  } ${on && isPaid ? "bg-red-500" : "bg-gray-700"}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      on ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </span>
              </button>

              {/* Severity threshold — only meaningful once the region is on */}
              {on && isPaid && (
                <div className="flex items-center justify-between gap-3 px-4 pb-3 -mt-1">
                  <span className="text-xs text-gray-500">{l.minRiskLabel}</span>
                  <select
                    value={minRisk[region] ?? "low"}
                    onChange={(e) => changeMinRisk(region, e.target.value)}
                    className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300 focus:outline-none focus:border-red-500/50"
                  >
                    <option value="high">{l.minRiskOptions.high}</option>
                    <option value="medium">{l.minRiskOptions.medium}</option>
                    <option value="low">{l.minRiskOptions.low}</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
