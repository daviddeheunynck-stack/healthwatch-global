"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown, Download, Lock } from "lucide-react";
import OutbreakDetailModal from "@/components/OutbreakDetailModal";
import { track } from "@vercel/analytics/react";

type SortKey = "risk" | "cases" | "deaths" | "date";
type SortDir = "asc" | "desc";
import { getLocalizedDisease, getLocalizedCountry } from "@/lib/outbreaks";
import type { Outbreak } from "@/lib/outbreaks";
import RiskBadge from "@/components/RiskBadge";
import LockedUpgradeButton from "@/components/LockedUpgradeButton";
import ShareOutbreakButton from "@/components/ShareOutbreakButton";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OutbreakTableLabels {
  // Column headers
  disease: string;
  country: string;
  cases: string;
  deaths: string;
  cfr: string;           // Case Fatality Rate
  riskLevel: string;
  date: string;
  // Filters
  searchPlaceholder: string;
  allRegions: string;
  allCountries: string;  // country filter
  allRisks: string;
  dateFrom: string;      // date range "from"
  dateTo: string;        // date range "to"
  noResults: string;
  noData: string;        // "N/D" when data unavailable
  // Region names
  africa: string;
  asia: string;
  europe: string;
  americas: string;
  oceania: string;
  // Risk levels
  high: string;
  medium: string;
  low: string;
  // Locked CTA
  lockedCta: string;
  // Export
  exportCsv: string;
  exportRows: (n: number) => string;
}

type Region = "all" | "africa" | "asia" | "europe" | "americas" | "oceania";
type Risk   = "all" | "high" | "medium" | "low";

const RISK_COLORS: Record<string, string> = {
  high:   "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25",
  medium: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25",
  low:    "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  outbreaks: Outbreak[];
  locale: string;
  isPaid: boolean;
  labels: OutbreakTableLabels;
}

export default function OutbreakTable({ outbreaks, locale, isPaid, labels: l }: Props) {
  const [search,   setSearch]    = useState("");
  const [region,   setRegion]    = useState<Region>("all");
  const [country,  setCountry]   = useState<string>("all");
  const [dateFrom, setDateFrom]  = useState<string>("");
  const [dateTo,   setDateTo]    = useState<string>("");
  const [selected, setSelected]  = useState<Outbreak | null>(null);
  const [risk,     setRisk]      = useState<Risk>("all");
  const [sortKey,  setSortKey] = useState<SortKey>("risk");
  const [sortDir,  setSortDir] = useState<SortDir>("asc");

  // Unique sorted country list from current outbreaks
  const countryOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { key: string; label: string }[] = [];
    for (const o of outbreaks) {
      const name = getLocalizedCountry(o, locale);
      if (o.country_en && !seen.has(o.country_en)) {
        seen.add(o.country_en);
        list.push({ key: o.country_en, label: name ?? o.country_en });
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [outbreaks, locale]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="inline w-3 h-3 ml-1 text-gray-600" />;
    return sortDir === "asc"
      ? <ChevronUp   className="inline w-3 h-3 ml-1 text-red-400" />
      : <ChevronDown className="inline w-3 h-3 ml-1 text-red-400" />;
  }

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return outbreaks.filter((o) => {
      if (region  !== "all" && o.region     !== region)  return false;
      if (country !== "all" && o.country_en !== country) return false;
      if (risk    !== "all" && o.risk_level !== risk)    return false;
      if (dateFrom && o.date < dateFrom)                 return false;
      if (dateTo   && o.date > dateTo)                   return false;
      if (q && !getLocalizedDisease(o, locale).toLowerCase().includes(q) &&
               !getLocalizedCountry(o, locale).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [outbreaks, region, country, risk, dateFrom, dateTo, search, locale]);

  const sorted = useMemo(() => {
    const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "risk")   cmp = (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3);
      if (sortKey === "cases")  cmp = a.cases  - b.cases;
      if (sortKey === "deaths") cmp = a.deaths - b.deaths;
      if (sortKey === "date")   cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const hasFilters = search !== "" || region !== "all" || country !== "all" || risk !== "all" || dateFrom !== "" || dateTo !== "";

  const downloadCsv = useCallback(() => {
    const esc = (s: string | number | null | undefined) => {
      const str = String(s ?? "");
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const headers = ["disease", "country", "region", "cases", "deaths", "cfr_%", "risk_level", "date", "source"];
    const rows = sorted.map((o) => [
      esc(o.disease_en || o.disease),
      esc(o.country_en || o.country),
      esc(o.region),
      o.cases,
      o.deaths,
      o.cases > 0 ? (o.deaths / o.cases * 100).toFixed(1) : "",
      esc(o.risk_level),
      esc(o.date),
      esc(o.source),
    ]);
    const csv  = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `healthwatch-${new Date().toISOString().split("T")[0]}-${sorted.length}rows.csv`;
    a.click();
    URL.revokeObjectURL(url);
    track("csv_export_filtered", { rows: sorted.length, locale });
  }, [sorted, locale]);

  const clearFilters = () => {
    setSearch("");
    setRegion("all");
    setCountry("all");
    setRisk("all");
    setDateFrom("");
    setDateTo("");
  };

  // ── Region pills ──────────────────────────────────────────────────────────
  const regions: { key: Region; label: string }[] = [
    { key: "all",      label: l.allRegions },
    { key: "africa",   label: l.africa     },
    { key: "asia",     label: l.asia       },
    { key: "americas", label: l.americas   },
    { key: "europe",   label: l.europe     },
    { key: "oceania",  label: l.oceania    },
  ];

  const risks: { key: Risk; label: string }[] = [
    { key: "all",    label: l.allRisks },
    { key: "high",   label: l.high     },
    { key: "medium", label: l.medium   },
    { key: "low",    label: l.low      },
  ];

  return (
    <div className="space-y-3">

      {/* ── Filter bar + Export ────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Search + Export button */}
        <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={l.searchPlaceholder}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-9 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Export button */}
        {isPaid ? (
          <button
            onClick={downloadCsv}
            title={l.exportRows(sorted.length)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{l.exportCsv}</span>
            <span className="text-gray-500">({sorted.length})</span>
          </button>
        ) : (
          <button
            disabled
            title={l.lockedCta}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 border border-gray-800 text-gray-600 rounded-lg text-xs shrink-0 cursor-not-allowed"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        )}
        </div>

        {/* Region + Risk pills in two rows */}
        <div className="flex flex-wrap gap-1.5">
          {regions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRegion(key)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                region === key
                  ? "bg-gray-700 border-gray-500 text-white"
                  : "bg-transparent border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {risks.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRisk(key)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                risk === key && key !== "all"
                  ? RISK_COLORS[key]
                  : risk === key && key === "all"
                  ? "bg-gray-700 border-gray-500 text-white"
                  : "bg-transparent border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}

          {/* Country dropdown */}
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="text-xs px-3 py-1 rounded-full border border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
          >
            <option value="all">{l.allCountries}</option>
            {countryOptions.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="hidden sm:inline">{l.dateFrom}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg border border-gray-800 bg-gray-900 text-gray-400 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer w-32"
            />
            <span>–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg border border-gray-800 bg-gray-900 text-gray-400 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer w-32"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Upgrade banner ─────────────────────────────────────────────── */}
      {!isPaid && (
        <div className="rounded-xl border border-amber-700/40 bg-gradient-to-r from-amber-950/50 via-amber-900/20 to-transparent p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Search className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-amber-300">
                {locale === "fr" ? "Cas confirmés · Décès · Rapports PDF · Alertes temps réel"
                : locale === "es" ? "Casos confirmados · Fallecidos · Informes PDF · Alertas en tiempo real"
                : locale === "ar" ? "الحالات المؤكدة · الوفيات · تقارير PDF · تنبيهات فورية"
                : locale === "id" ? "Kasus terkonfirmasi · Kematian · Laporan PDF · Peringatan real-time"
                : "Confirmed cases · Deaths · PDF reports · Real-time alerts"}
              </p>
            </div>
            <LockedUpgradeButton feature="cases" label={l.lockedCta} variant="banner" />
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 overflow-hidden overflow-x-auto">
        {sorted.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            {l.noResults}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">{l.disease}</th>
                <th className="text-left px-4 py-3">{l.country}</th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
                  onClick={() => handleSort("cases")}
                >
                  {l.cases}<SortIcon col="cases" />
                </th>
                <th
                  className="text-left px-4 py-3 hidden sm:table-cell cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
                  onClick={() => handleSort("deaths")}
                >
                  {l.deaths}<SortIcon col="deaths" />
                </th>
                <th className="text-left px-4 py-3 hidden sm:table-cell text-amber-500/80 whitespace-nowrap">
                  {l.cfr}
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
                  onClick={() => handleSort("risk")}
                >
                  {l.riskLevel}<SortIcon col="risk" />
                </th>
                <th
                  className="text-left px-4 py-3 hidden md:table-cell cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
                  onClick={() => handleSort("date")}
                >
                  {l.date}<SortIcon col="date" />
                </th>
                <th className="px-2 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((outbreak, i) => (
                <tr
                  key={outbreak.id}
                  onClick={() => setSelected(outbreak)}
                  className={`border-t border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer ${
                    i % 2 === 0 ? "bg-gray-900/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {getLocalizedDisease(outbreak, locale)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {getLocalizedCountry(outbreak, locale)}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {isPaid ? (
                      outbreak.cases > 0 ? outbreak.cases.toLocaleString() : <span className="text-gray-600 italic text-xs">{l.noData}</span>
                    ) : (
                      <span className="blur-sm select-none text-gray-500">
                        {outbreak.cases.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-red-400 hidden sm:table-cell">
                    {isPaid ? (
                      outbreak.cases > 0 ? outbreak.deaths.toLocaleString() : <span className="text-gray-600 italic text-xs">{l.noData}</span>
                    ) : (
                      <span className="blur-sm select-none text-gray-500">
                        {outbreak.deaths.toLocaleString()}
                      </span>
                    )}
                  </td>
                  {/* CFR */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {isPaid ? (
                      outbreak.cases > 0 ? (
                        <span className={`text-sm font-medium ${
                          (outbreak.deaths / outbreak.cases) > 0.1 ? "text-red-400" :
                          (outbreak.deaths / outbreak.cases) > 0.03 ? "text-amber-400" : "text-gray-400"
                        }`}>
                          {(outbreak.deaths / outbreak.cases * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-600 italic text-xs">{l.noData}</span>
                      )
                    ) : (
                      <span className="blur-sm select-none text-gray-500">12.3%</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge level={outbreak.risk_level} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {outbreak.date}
                  </td>
                  <td className="px-2 py-3">
                    <ShareOutbreakButton
                      disease={getLocalizedDisease(outbreak, locale)}
                      country={getLocalizedCountry(outbreak, locale)}
                      cases={outbreak.cases}
                      riskLevel={outbreak.risk_level}
                      locale={locale}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Result count */}
      {hasFilters && sorted.length > 0 && (
        <p className="text-xs text-gray-600 text-right">
          {sorted.length} / {outbreaks.length}
        </p>
      )}

      {/* Detail modal */}
      <OutbreakDetailModal
        outbreak={selected}
        locale={locale}
        isPaid={isPaid}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
