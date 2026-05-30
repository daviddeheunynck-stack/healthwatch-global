"use client";

import { useState } from "react";
import { Bell, Lock } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

const REGIONS = ["africa", "asia", "americas", "europe", "oceania"] as const;
type Region = (typeof REGIONS)[number];

export interface AlertRegionLabels {
  title: string;
  desc: string;
  locked: string;
  upgrade: string;
  upgradeHref: string;
  error: string;
  regionLabels: Record<string, string>;
}

interface Props {
  isPaid: boolean;
  initialRegions: string[];
  labels: AlertRegionLabels;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertRegionToggles({ isPaid, initialRegions, labels: l }: Props) {
  const [enabled, setEnabled] = useState<Set<Region>>(
    new Set(
      initialRegions.filter((r): r is Region =>
        (REGIONS as readonly string[]).includes(r)
      )
    )
  );
  const [pending, setPending] = useState<Region | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const toggle = async (region: Region) => {
    if (!isPaid || pending) return;
    const turningOn = !enabled.has(region);

    // Optimistic update
    setEnabled((prev) => {
      const s = new Set(prev);
      turningOn ? s.add(region) : s.delete(region);
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
        turningOn ? s.delete(region) : s.add(region);
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
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-gray-400 flex-1">{l.locked}</p>
          <Link
            href={l.upgradeHref}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
          >
            {l.upgrade} →
          </Link>
        </div>
      )}

      {/* Region toggles */}
      <div className="space-y-2">
        {REGIONS.map((region) => {
          const on      = enabled.has(region);
          const loading = pending === region;

          return (
            <button
              key={region}
              onClick={() => toggle(region)}
              disabled={!isPaid || loading}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm ${
                !isPaid
                  ? "opacity-40 cursor-not-allowed border-gray-800 bg-transparent"
                  : on
                  ? "border-red-500/40 bg-red-500/10 cursor-pointer hover:bg-red-500/15"
                  : "border-gray-800 bg-transparent cursor-pointer hover:border-gray-600 hover:bg-gray-800/30"
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
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
