"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown, Download, Lock, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import Link from "next/link";
import OutbreakDetailModal from "@/components/OutbreakDetailModal";
import SavedFilters from "@/components/SavedFilters";
import WatchlistButton from "@/components/WatchlistButton";
import { track } from "@vercel/analytics/react";

type SortKey = "risk" | "cases" | "deaths" | "cfr" | "date";
type SortDir = "asc" | "desc";
import { getLocalizedDisease, getLocalizedCountry, isNewOutbreak, staleOutbreakDays, sourceStatus, sourceName, computeRiskScore } from "@/lib/outbreaks";
import { diseaseToSlug, normalizeDisease } from "@/lib/disease-data";
import { countryToSlug } from "@/lib/country-utils";
import type { Outbreak } from "@/lib/outbreaks";
import type { OutbreakTrend } from "@/lib/outbreak-trend";
import RiskBadge from "@/components/RiskBadge";
import LockedUpgradeButton from "@/components/LockedUpgradeButton";
import { useUpgradeModal } from "@/lib/upgrade-modal-context";
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
  // CFR filter
  allCfr: string;
  // Locked CTA
  lockedCta: string;
  // Export
  exportCsv: string;
  // Source verification badges
  illustrativeBadge: string;
  illustrativeTooltip: string;
  officialBadge: string;
  officialTooltip: string;
  donBadge: string;
  donTooltip: string;
  allSources: string;
}

type Region       = "all" | "africa" | "asia" | "europe" | "americas" | "oceania";
type Risk         = "all" | "high" | "medium" | "low";
type CfrFilter    = "all" | "critical" | "elevated" | "low" | "nodata";
type SourceFilter = "all" | "don" | "official" | "unverified";

const REGIONS:        readonly Region[]       = ["all", "africa", "asia", "europe", "americas", "oceania"];
const RISKS:          readonly Risk[]         = ["all", "high", "medium", "low"];
const CFR_FILTERS:    readonly CfrFilter[]    = ["all", "critical", "elevated", "low", "nodata"];
const SOURCE_FILTERS: readonly SourceFilter[] = ["all", "don", "official", "unverified"];

// Saved filters round-trip through localStorage as loose strings — validate
// against the known union members so stale/corrupted entries fall back to
// "all" instead of silently becoming an invalid filter value (replaces two
// `as any` casts and one untyped-string `as CfrFilter` cast in loadFilter()).
function asEnum<T extends string>(value: string | undefined, members: readonly T[], fallback: T): T {
  return (members as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

const RISK_COLORS: Record<string, string> = {
  high:   "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25",
  medium: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25",
  low:    "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25",
};

// 7-day directional signal — qualitative only (no exact figures), so it's shown
// to every visitor, free or Pro, exactly like RiskBadge. Renders nothing until
// outbreak_snapshots has accumulated enough history (direction === "unknown"),
// so today this is invisible everywhere and lights up on its own once the data matures.
function TrendBadge({ trend }: { trend?: OutbreakTrend }) {
  if (!trend || trend.direction === "unknown") return null;
  if (trend.direction === "stable") {
    return <Minus className="w-3 h-3 text-gray-600 shrink-0" aria-hidden />;
  }
  const up = trend.direction === "up";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold whitespace-nowrap ${up ? "text-red-400" : "text-green-400"}`}
      title={`${up ? "+" : ""}${trend.deltaPercent}% (${trend.daysBack}d)`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden />
      {up ? "+" : ""}{trend.deltaPercent}%
    </span>
  );
}

function RiskScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 8 ? "bg-red-900/40 border-red-700/50 text-red-300" :
    score >= 5 ? "bg-orange-900/30 border-orange-700/40 text-orange-300" :
    score >= 3 ? "bg-yellow-900/25 border-yellow-700/35 text-yellow-400" :
                 "bg-gray-800 border-gray-700 text-gray-400";
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded border text-[10px] font-bold tabular-nums shrink-0 ${cls}`}
      title={`Risk score ${score}/10`}
    >
      {score}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  outbreaks: Outbreak[];
  locale: string;
  isPaid: boolean;
  labels: OutbreakTableLabels;
  trends?: Record<string, OutbreakTrend>;
}

// Module-level (not redefined every render): React was remounting this on each
// keystroke/sort-change because a function declared inside the component body
// is a "new" component type each render — losing its identity, forcing a
// fresh mount, and tripping the react-hooks/static-components lint rule.
// Takes the active sort state as explicit props instead of closing over it.
function SortIcon({ col, activeKey, dir }: { col: SortKey; activeKey: SortKey; dir: SortDir }) {
  if (activeKey !== col) return <ChevronsUpDown className="inline w-3 h-3 ml-1 text-gray-600" />;
  return dir === "asc"
    ? <ChevronUp   className="inline w-3 h-3 ml-1 text-red-400" />
    : <ChevronDown className="inline w-3 h-3 ml-1 text-red-400" />;
}

export default function OutbreakTable({ outbreaks, locale, isPaid, labels: l, trends }: Props) {
  const { openModal } = useUpgradeModal();
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [search,   setSearch]    = useState("");
  const [region,   setRegion]    = useState<Region>("all");
  const [country,  setCountry]   = useState<string>("all");
  const [dateFrom, setDateFrom]  = useState<string>("");
  const [dateTo,   setDateTo]    = useState<string>("");
  const [selected, setSelected]  = useState<Outbreak | null>(null);
  const [risk,         setRisk]         = useState<Risk>("all");
  const [cfrFilter,    setCfrFilter]    = useState<CfrFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortKey,   setSortKey]   = useState<SortKey>("risk");
  const [sortDir,   setSortDir]   = useState<SortDir>("asc");

  // Load watchlist IDs on mount (Pro users only)
  useEffect(() => {
    if (!isPaid) return;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d) => { if (d.watchlist) setWatchlist(new Set(d.watchlist)); })
      .catch(() => {});
  }, [isPaid]);

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
      setSortDir(key === "date" || key === "cfr" ? "desc" : "asc");
    }
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
      if (cfrFilter !== "all") {
        const cfr = o.cases > 0 ? (o.deaths / o.cases * 100) : null;
        if (cfrFilter === "critical" && !(cfr !== null && cfr > 10))              return false;
        if (cfrFilter === "elevated" && !(cfr !== null && cfr >= 3 && cfr <= 10)) return false;
        if (cfrFilter === "low"      && !(cfr !== null && cfr < 3))               return false;
        if (cfrFilter === "nodata"   && cfr !== null)                             return false;
      }
      if (sourceFilter !== "all" && sourceStatus(o) !== sourceFilter) return false;
      if (q && !getLocalizedDisease(o, locale).toLowerCase().includes(q) &&
               !getLocalizedCountry(o, locale).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [outbreaks, region, country, risk, cfrFilter, sourceFilter, dateFrom, dateTo, search, locale]);

  const sorted = useMemo(() => {
    const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "risk")   cmp = (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3);
      if (sortKey === "cases")  cmp = a.cases  - b.cases;
      if (sortKey === "deaths") cmp = a.deaths - b.deaths;
      if (sortKey === "cfr") {
        const cfrA = a.cases > 0 ? a.deaths / a.cases : null;
        const cfrB = b.cases > 0 ? b.deaths / b.cases : null;
        if (cfrA === null && cfrB === null) cmp = 0;
        else if (cfrA === null) return 1;   // outbreaks without case data always sink to the bottom…
        else if (cfrB === null) return -1;  // …regardless of sort direction
        else cmp = cfrA - cfrB;
      }
      if (sortKey === "date")   cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const hasFilters = search !== "" || region !== "all" || country !== "all" || risk !== "all" || cfrFilter !== "all" || sourceFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const downloadCsv = useCallback(() => {
    const esc = (s: string | number | null | undefined) => {
      const str = String(s ?? "");
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const headers = ["disease", "country", "region", "cases", "deaths", "cfr_%", "risk_level", "date", "source_tier", "source_url", "description"];
    const rows = sorted.map((o) => [
      esc(o.disease_en || o.disease),
      esc(o.country_en || o.country),
      esc(o.region),
      o.cases,
      o.deaths,
      o.cases > 0 ? (o.deaths / o.cases * 100).toFixed(1) : "",
      esc(o.risk_level),
      esc(o.date),
      esc(sourceStatus(o) === 'don' ? "WHO DON" : sourceStatus(o) === 'official' ? "Official" : "Unverified"),
      esc(o.source),
      esc(o.description),
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

  function loadFilter(f: { search: string; region: string; country: string; risk: string; dateFrom: string; dateTo: string; cfrFilter?: string; sourceFilter?: string }) {
    setSearch(f.search);
    setRegion(asEnum(f.region, REGIONS, "all"));
    setCountry(f.country);
    setRisk(asEnum(f.risk, RISKS, "all"));
    setDateFrom(f.dateFrom);
    setDateTo(f.dateTo);
    setCfrFilter(asEnum(f.cfrFilter, CFR_FILTERS, "all"));
    setSourceFilter(asEnum(f.sourceFilter, SOURCE_FILTERS, "all"));
  }

  const clearFilters = () => {
    setSearch("");
    setRegion("all");
    setCountry("all");
    setRisk("all");
    setCfrFilter("all");
    setSourceFilter("all");
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
            title={`${l.exportCsv} (${sorted.length})`}
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
          {regions.map(({ key, label }) => {
            const locked = !isPaid && key !== "all";
            return (
              <button
                key={key}
                onClick={() => locked ? openModal("list") : setRegion(key)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                  locked
                    ? "border-gray-800 text-gray-600 cursor-pointer hover:border-amber-700/50 hover:text-amber-500/70"
                    : region === key
                      ? "bg-gray-700 border-gray-500 text-white"
                      : "bg-transparent border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                }`}
              >
                {locked && <Lock className="w-2.5 h-2.5" />}
                {label}
              </button>
            );
          })}
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

          {/* CFR dropdown */}
          <select
            value={cfrFilter}
            onChange={(e) => setCfrFilter(e.target.value as CfrFilter)}
            className={`text-xs px-3 py-1 rounded-full border bg-gray-900 hover:border-gray-600 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer ${
              cfrFilter !== "all"
                ? "border-amber-700/50 text-amber-400"
                : "border-gray-800 text-gray-400"
            }`}
          >
            <option value="all">{l.allCfr}</option>
            <option value="critical">&gt;10%</option>
            <option value="elevated">3–10%</option>
            <option value="low">&lt;3%</option>
            <option value="nodata">{l.noData}</option>
          </select>

          {/* Source dropdown */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className={`text-xs px-3 py-1 rounded-full border bg-gray-900 hover:border-gray-600 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer ${
              sourceFilter === "don"
                ? "border-blue-700/50 text-blue-400"
                : sourceFilter === "official"
                ? "border-amber-700/50 text-amber-400"
                : sourceFilter === "unverified"
                ? "border-gray-600 text-gray-400"
                : "border-gray-800 text-gray-400"
            }`}
          >
            <option value="all">{l.allSources}</option>
            <option value="don">{l.donBadge}</option>
            <option value="official">{l.officialBadge}</option>
            <option value="unverified">{l.illustrativeBadge}</option>
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

      {/* ── Saved filters ──────────────────────────────────────────────── */}
      <SavedFilters
        locale={locale}
        currentFilters={{ search, region, country, risk, dateFrom, dateTo, cfrFilter, sourceFilter }}
        hasActiveFilters={hasFilters}
        onLoad={loadFilter}
      />

      {/* ── Upgrade banner ─────────────────────────────────────────────── */}
      {!isPaid && (
        <div className="rounded-xl border border-amber-700/40 bg-gradient-to-r from-amber-950/50 via-amber-900/20 to-transparent p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Search className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-amber-300">
                {locale === "fr" ? "Cas confirmés · Décès · Rapports PDF · Alertes instantanées"
                : locale === "es" ? "Casos confirmados · Fallecidos · Informes PDF · Alertas instantáneas"
                : locale === "ar" ? "الحالات المؤكدة · الوفيات · تقارير PDF · تنبيهات فورية"
                : locale === "id" ? "Kasus terkonfirmasi · Kematian · Laporan PDF · Peringatan instan"
                : "Confirmed cases · Deaths · PDF reports · Instant alerts"}
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
                  {l.cases}<SortIcon col="cases" activeKey={sortKey} dir={sortDir} />
                </th>
                <th
                  className="text-left px-4 py-3 hidden sm:table-cell cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
                  onClick={() => handleSort("deaths")}
                >
                  {l.deaths}<SortIcon col="deaths" activeKey={sortKey} dir={sortDir} />
                </th>
                <th
                  className="text-left px-4 py-3 hidden sm:table-cell text-amber-500/80 cursor-pointer hover:text-amber-400 select-none whitespace-nowrap"
                  onClick={() => handleSort("cfr")}
                >
                  {l.cfr}<SortIcon col="cfr" activeKey={sortKey} dir={sortDir} />
                </th>
                <th
                  className="text-left px-4 py-3 cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
                  onClick={() => handleSort("risk")}
                >
                  {l.riskLevel}<SortIcon col="risk" activeKey={sortKey} dir={sortDir} />
                </th>
                <th
                  className="text-left px-4 py-3 hidden md:table-cell cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
                  onClick={() => handleSort("date")}
                >
                  {l.date}<SortIcon col="date" activeKey={sortKey} dir={sortDir} />
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        href={`/${locale}/disease/${diseaseToSlug(normalizeDisease(outbreak.disease_en || outbreak.disease).name_en)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-red-400 transition-colors"
                      >
                        {getLocalizedDisease(outbreak, locale)}
                      </Link>
                      {isNewOutbreak(outbreak) && (
                        <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-900/50 border border-green-700/50 text-green-300 shrink-0 animate-pulse">
                          {{ fr: "NOUVEAU", en: "NEW", es: "NUEVO", ar: "جديد", id: "BARU" }[locale] ?? "NEW"}
                        </span>
                      )}
                      {outbreak.is_pheic && (
                        <span title="PHEIC — Public Health Emergency of International Concern" className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-900/50 border border-purple-700/50 text-purple-300 shrink-0 cursor-help">
                          🚨 PHEIC
                        </span>
                      )}
                      {sourceStatus(outbreak) === 'don' && (
                        <span title={l.donTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-700/50 text-blue-400 shrink-0 cursor-help whitespace-nowrap">
                          {l.donBadge}
                        </span>
                      )}
                      {sourceStatus(outbreak) === 'official' && (
                        <span title={l.officialTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/50 text-amber-400 shrink-0 cursor-help whitespace-nowrap">
                          {sourceName(outbreak.source)}
                        </span>
                      )}
                      {sourceStatus(outbreak) === 'unverified' && (
                        <span title={l.illustrativeTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 shrink-0 cursor-help whitespace-nowrap">
                          {l.illustrativeBadge}
                        </span>
                      )}
                      {(() => {
                        const d = staleOutbreakDays(outbreak);
                        if (!d) return null;
                        const label = { fr: `SANS MAJ · ${d}j`, en: `NO UPDATE · ${d}d`, es: `SIN ACTU. · ${d}d`, ar: `${d}د · بلا تحديث`, id: `TK ADA UPDATE · ${d}h` }[locale] ?? `NO UPDATE · ${d}d`;
                        const tip   = { fr: `Aucun bulletin officiel depuis ${d} jours — foyer peut-être résolu ou non rapporté`, en: `No official bulletin in ${d} days — may be resolved or unreported`, es: `Sin boletín oficial en ${d} días — puede estar resuelto o sin reporte`, ar: `لا يوجد نشرة رسمية منذ ${d} يوماً`, id: `Tidak ada buletin resmi dalam ${d} hari` }[locale] ?? `No official update in ${d} days`;
                        return (
                          <span title={tip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-900/30 border border-orange-700/50 text-orange-400 shrink-0 cursor-help whitespace-nowrap">
                            ⚠ {label}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    <Link
                      href={`/${locale}/country/${countryToSlug(outbreak.country_en ?? outbreak.country ?? "")}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-white transition-colors"
                    >
                      {getLocalizedCountry(outbreak, locale)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    <div className="flex items-center gap-1.5">
                      {isPaid ? (
                        outbreak.cases > 0 ? outbreak.cases.toLocaleString("en") : <span className="text-gray-600 italic text-xs">{l.noData}</span>
                      ) : (
                        <span className="blur-sm select-none text-gray-500 cursor-pointer" onClick={() => openModal("cases")}>
                          {outbreak.cases.toLocaleString("en")}
                        </span>
                      )}
                      {outbreak.cases > 0 && <TrendBadge trend={trends?.[outbreak.id]} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-red-400 hidden sm:table-cell">
                    {isPaid ? (
                      outbreak.cases > 0 ? outbreak.deaths.toLocaleString("en") : <span className="text-gray-600 italic text-xs">{l.noData}</span>
                    ) : (
                      <span className="blur-sm select-none text-gray-500 cursor-pointer" onClick={() => openModal("cases")}>
                        {outbreak.deaths.toLocaleString("en")}
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
                      <button
                        onClick={() => openModal("cases")}
                        className="flex items-center gap-1 text-xs text-amber-500/70 hover:text-amber-400 transition-colors"
                      >
                        <Lock className="w-3 h-3" />
                        Pro
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <RiskBadge level={outbreak.risk_level} />
                      <RiskScoreBadge score={computeRiskScore(outbreak, trends?.[outbreak.id])} />
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-gray-400 text-sm">
                      {(() => {
                        const [y, m, d] = outbreak.date.split("-").map(Number);
                        const localeMap: Record<string, string> = { fr: "fr-FR", es: "es-ES", ar: "ar-SA", id: "id-ID" };
                        const formatted = new Date(y, m - 1, d).toLocaleDateString(
                          localeMap[locale] ?? "en-GB",
                          { day: "numeric", month: "short", year: "numeric" }
                        );
                        return locale === "fr" ? `au ${formatted}` : locale === "ar" ? `بتاريخ ${formatted}` : formatted;
                      })()}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-0.5">
                      <WatchlistButton
                        outbreakId={outbreak.id}
                        initialWatched={watchlist.has(outbreak.id)}
                        isPaid={isPaid}
                        locale={locale}
                      />
                      <ShareOutbreakButton
                        disease={getLocalizedDisease(outbreak, locale)}
                        country={getLocalizedCountry(outbreak, locale)}
                        cases={outbreak.cases}
                        riskLevel={outbreak.risk_level}
                        locale={locale}
                        outbreakId={outbreak.id}
                      />
                      <Link
                        href={`/${locale}/outbreak/${outbreak.id}`}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        title={{ fr: "Voir la fiche", en: "View full page", es: "Ver página", ar: "عرض الصفحة", id: "Lihat halaman" }[locale] ?? "View"}
                        className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
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

      {/* Data note */}
      <p className="text-xs text-gray-700 mt-1">
        {{
          fr: "Cas et décès issus des sources officielles (OMS, ECDC, PAHO). Les guéris ne sont pas publiés par l'OMS dans un format structuré.",
          es: "Casos y muertes según fuentes oficiales (OMS, ECDC, PAHO). Los recuperados no son publicados por la OMS en formato estructurado.",
          ar: "الحالات والوفيات من مصادر رسمية (WHO، ECDC، PAHO). لا تنشر منظمة الصحة العالمية بيانات المتعافين بصيغة منظمة.",
          id: "Kasus dan kematian dari sumber resmi (WHO, ECDC, PAHO). Data sembuh tidak dipublikasikan WHO dalam format terstruktur.",
          en: "Cases and deaths from official sources (WHO, ECDC, PAHO). Recovered figures are not published by WHO in a structured format.",
        }[locale] ?? "Cases and deaths from official sources (WHO, ECDC, PAHO). Recovered figures are not published by WHO in a structured format."}
      </p>

      {/* Detail modal */}
      <OutbreakDetailModal
        outbreak={selected}
        locale={locale}
        isPaid={isPaid}
        trend={selected ? trends?.[selected.id] : undefined}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
