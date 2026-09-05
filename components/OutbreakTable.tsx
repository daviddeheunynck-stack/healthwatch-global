"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown, Download, Lock, TrendingUp, TrendingDown, Minus, ExternalLink, SlidersHorizontal, Share2, CheckCircle, Info } from "lucide-react";
import Link from "next/link";
import OutbreakDetailModal from "@/components/OutbreakDetailModal";
import SavedFilters from "@/components/SavedFilters";
import WatchlistButton from "@/components/WatchlistButton";
import { track } from "@vercel/analytics/react";
import { getEpiWeek } from "@/lib/epi-week";

type SortKey = "risk" | "cases" | "deaths" | "cfr" | "date";
type SortDir = "asc" | "desc";
import { getLocalizedDisease, getLocalizedCountry, isNewOutbreak, staleOutbreakDays, freshOutbreakHours, isSourceConfirmed, lastVerifiedIso, sourceStatus, sourceName, publishableSourceName, publishableSourceUrl, computeRiskScore, hasRealAdmin1 } from "@/lib/outbreaks";
import { diseaseToSlug, matchDisease } from "@/lib/disease-data";
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
  pressBadge: string;
  pressTooltip: string;
  donBadge: string;
  donTooltip: string;
  allSources: string;
}

type Region       = "all" | "africa" | "asia" | "europe" | "americas" | "oceania";
type Risk         = "all" | "high" | "medium" | "low";
type CfrFilter    = "all" | "critical" | "elevated" | "low" | "nodata";
type SourceFilter = "all" | "don" | "official" | "press" | "unverified";

const REGIONS:        readonly Region[]       = ["all", "africa", "asia", "europe", "americas", "oceania"];
const RISKS:          readonly Risk[]         = ["all", "high", "medium", "low"];
const CFR_FILTERS:    readonly CfrFilter[]    = ["all", "critical", "elevated", "low", "nodata"];
const SOURCE_FILTERS: readonly SourceFilter[] = ["all", "don", "official", "press", "unverified"];

// Saved filters round-trip through localStorage as loose strings — validate
// against the known union members so stale/corrupted entries fall back to
// "all" instead of silently becoming an invalid filter value (replaces two
// `as any` casts and one untyped-string `as CfrFilter` cast in loadFilter()).
function asEnum<T extends string>(value: string | undefined, members: readonly T[], fallback: T): T {
  return (members as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

const REPORT_LOCALE: Record<string, string> = { fr: "fr-FR", es: "es-ES", ar: "ar-SA", id: "id-ID", en: "en-GB" };
const PDF_RISK: Record<string, Record<string, string>> = {
  high:   { fr: "ÉLEVÉ",  es: "ALTO",    ar: "مرتفع", id: "TINGGI", en: "HIGH"   },
  medium: { fr: "MODÉRÉ", es: "MODERADO", ar: "متوسط", id: "SEDANG", en: "MEDIUM" },
  low:    { fr: "FAIBLE", es: "BAJO",     ar: "منخفض", id: "RENDAH", en: "LOW"    },
};
const PDF_H: Record<string, string[]> = {
  fr: ["Maladie",    "Pays",    "Cas",    "Décès",     "CFR", "Risque", "Date bulletin", "Source primaire"],
  es: ["Enfermedad", "País",    "Casos",  "Fallecidos", "CFR", "Riesgo", "Fecha boletín", "Fuente primaria"],
  ar: ["المرض",      "الدولة", "الحالات", "الوفيات",   "CFR", "الخطر", "تاريخ التقرير", "المصدر الأساسي"],
  id: ["Penyakit",   "Negara",  "Kasus",  "Kematian",  "CFR", "Risiko", "Tanggal laporan", "Sumber utama"],
  en: ["Disease",    "Country", "Cases",  "Deaths",    "CFR", "Risk",   "Report date",    "Primary source"],
};
const PDF_COUNT: Record<string, string> = { fr: "foyer(s) actif(s)", es: "brote(s) activo(s)", ar: "تفشٍّ نشط", id: "wabah aktif", en: "active outbreak(s)" };
const REPORT_TITLE:  Record<string, string> = {
  fr: "Rapport Situation Sanitaire Mondiale",
  es: "Informe Situación Sanitaria Mundial",
  ar: "تقرير الوضع الصحي العالمي",
  id: "Laporan Situasi Kesehatan Global",
  en: "Global Health Situation Report",
};

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

function TrendBar({ trend }: { trend?: OutbreakTrend }) {
  if (!trend || trend.direction === "unknown") {
    return <span className="text-gray-700 text-[10px]">—</span>;
  }
  const fillW = Math.round(Math.min(100, Math.abs(trend.deltaPercent) * 2) * 40 / 100);
  const color  = trend.direction === "up" ? "#f87171" : trend.direction === "down" ? "#4ade80" : "#6b7280";
  return (
    <svg width="40" height="10" viewBox="0 0 40 10" className="shrink-0" aria-hidden>
      <rect x="0" y="2" width="40" height="6" rx="2" fill="#1e293b" />
      {fillW > 0 && <rect x="0" y="2" width={fillW} height="6" rx="2" fill={color} fillOpacity="0.75" />}
    </svg>
  );
}

// Client-only: staleDays comes from Date.now(), which can differ between the
// SSR pass (possibly served stale by ISR) and hydration. Deferring it to an
// effect keeps the server and first client render both at "null" (no badge),
// avoiding a server/client markup mismatch — same pattern as FreshnessBadge.
function StaleDaysBadge({ referenceIso, locale }: { referenceIso: string; locale: string }) {
  const [staleDays, setStaleDays] = useState<number | null>(null);

  useEffect(() => {
    setStaleDays(Math.floor((Date.now() - new Date(referenceIso).getTime()) / 86_400_000));
  }, [referenceIso]);

  if (staleDays === null || staleDays < 3) return null;
  const cls = staleDays < 7 ? "text-amber-400" : "text-orange-500";
  const tip = ({ fr: `Dernier bulletin de la source il y a ${staleDays}j`, en: `Source bulletin ${staleDays}d old`, es: `Último boletín de la fuente hace ${staleDays}d`, ar: `آخر نشرة من المصدر: ${staleDays} أيام`, id: `Buletin sumber ${staleDays} hari lalu` }[locale]) ?? `${staleDays}d ago`;
  return <span title={tip} className={`text-[10px] cursor-help shrink-0 ${cls}`}>⏰{staleDays}d</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DefaultFilters {
  region:  Region;
  country: string;
  risk?:   Risk;
}

interface Props {
  outbreaks:       Outbreak[];
  locale:          string;
  isPaid:          boolean;
  labels:          OutbreakTableLabels;
  trends?:         Record<string, OutbreakTrend>;
  defaultFilters?: DefaultFilters;
  diseaseWatchlist?: string[];
  countryTags?:    Record<string, string>; // country_en → label
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

export default function OutbreakTable({ outbreaks, locale, isPaid, labels: l, trends, defaultFilters, diseaseWatchlist, countryTags = {} }: Props) {
  const { openModal } = useUpgradeModal();
  const numLocale = locale === "ar" ? "ar-SA" : (locale || "en");
  const router = useRouter();
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [search,   setSearch]    = useState("");
  const [region,   setRegion]    = useState<Region>(defaultFilters?.region  ?? "all");
  const [country,  setCountry]   = useState<string>(defaultFilters?.country ?? "all");
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [dateFrom, setDateFrom]  = useState<string>("");
  const [dateTo,   setDateTo]    = useState<string>("");
  const [selected, setSelected]  = useState<Outbreak | null>(null);
  const [risk,         setRisk]         = useState<Risk>(defaultFilters?.risk ?? "all");
  const [cfrFilter,    setCfrFilter]    = useState<CfrFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortKey,          setSortKey]          = useState<SortKey>("risk");
  const [sortDir,          setSortDir]          = useState<SortDir>("asc");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [watchlistOnly,    setWatchlistOnly]    = useState(false);
  const [ihrOnly,          setIhrOnly]          = useState(false);
  const [lastCases,        setLastCases]        = useState<Record<string, number>>({});
  const [admin1Filter,     setAdmin1Filter]     = useState("");
  const [epiWeekMode,      setEpiWeekMode]      = useState(false);
  const [ageMode,          setAgeMode]          = useState(false);
  const [copied,           setCopied]           = useState(false);

  // Sync region + risk to URL so shared links preserve filter state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (region !== "all") params.set("region", region); else params.delete("region");
    if (risk   !== "all") params.set("risk",   risk);   else params.delete("risk");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [region, risk]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load watchlist IDs on mount (Pro users only)
  useEffect(() => {
    if (!isPaid) return;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d) => { if (d.watchlist) setWatchlist(new Set(d.watchlist)); })
      .catch(() => {});
  }, [isPaid]);

  // P3 — load previous cases snapshot from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("hwg_cases_snapshot");
      if (raw) setLastCases(JSON.parse(raw) as Record<string, number>);
    } catch { /* ignore */ }
  }, []);

  // P3 — save snapshot on beforeunload and every 30 s
  useEffect(() => {
    const save = () => {
      try {
        const snapshot: Record<string, number> = {};
        for (const o of outbreaks) snapshot[o.id] = o.cases;
        localStorage.setItem("hwg_cases_snapshot", JSON.stringify(snapshot));
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", save);
    const timer = setInterval(save, 30_000);
    return () => { window.removeEventListener("beforeunload", save); clearInterval(timer); };
  }, [outbreaks]);

  // P4 — auto-open modal when ?outbreak=ID is in the URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("outbreak");
    if (!id) return;
    const o = outbreaks.find((x) => x.id === id);
    if (o) setSelected(o);
  }, [outbreaks]);

  // URL sync — read filter params on mount so shared links restore filters
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const q = p.get("q"); if (q) setSearch(q);
    const r = p.get("region");
    if (r && ["africa","asia","americas","europe","oceania"].includes(r)) setRegion(r as Region);
    const c = p.get("country"); if (c) setCountry(c);
    const rk = p.get("risk");
    if (rk && ["high","medium","low"].includes(rk)) setRisk(rk as Risk);
    const df = p.get("from"); if (df) setDateFrom(df);
    const dt = p.get("to");   if (dt) setDateTo(dt);
  }, []);

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
        const cfr = o.cases > 0 && o.deaths !== null ? (o.deaths / o.cases * 100) : null;
        if (cfrFilter === "critical" && !(cfr !== null && cfr > 10))              return false;
        if (cfrFilter === "elevated" && !(cfr !== null && cfr >= 3 && cfr <= 10)) return false;
        if (cfrFilter === "low"      && !(cfr !== null && cfr < 3))               return false;
        if (cfrFilter === "nodata"   && cfr !== null)                             return false;
      }
      if (sourceFilter !== "all" && sourceStatus(o) !== sourceFilter) return false;
      if (admin1Filter) {
        const q = admin1Filter.toLowerCase();
        if (!(o.admin1 ?? "").toLowerCase().includes(q)) return false;
      }
      if (ihrOnly && !o.ihr_event_id) return false;
      if (watchlistOnly && (diseaseWatchlist?.length ?? 0) > 0) {
        const dl = diseaseWatchlist!.map((d) => d.toLowerCase());
        const den = (o.disease_en ?? "").toLowerCase();
        if (!dl.some((d) => den.includes(d) || d.includes(den))) return false;
      }
      if (q && !getLocalizedDisease(o, locale).toLowerCase().includes(q) &&
               !getLocalizedCountry(o, locale).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [outbreaks, region, country, risk, cfrFilter, sourceFilter, dateFrom, dateTo, search, locale, watchlistOnly, ihrOnly, diseaseWatchlist, admin1Filter]);

  const sorted = useMemo(() => {
    const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "risk")   cmp = (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3);
      if (sortKey === "cases")  cmp = a.cases  - b.cases;
      if (sortKey === "deaths") {
        if (a.deaths === null && b.deaths === null) cmp = 0;
        else if (a.deaths === null) cmp = 1;
        else if (b.deaths === null) cmp = -1;
        else cmp = a.deaths - b.deaths;
      }
      if (sortKey === "cfr") {
        const cfrA = a.cases > 0 && a.deaths !== null ? a.deaths / a.cases : null;
        const cfrB = b.cases > 0 && b.deaths !== null ? b.deaths / b.cases : null;
        if (cfrA === null && cfrB === null) cmp = 0;
        else if (cfrA === null) return 1;   // outbreaks without case data always sink to the bottom…
        else if (cfrB === null) return -1;  // …regardless of sort direction
        else cmp = cfrA - cfrB;
      }
      if (sortKey === "date")   cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const hasFilters = search !== "" || region !== "all" || country !== "all" || risk !== "all" || cfrFilter !== "all" || sourceFilter !== "all" || dateFrom !== "" || dateTo !== "" || watchlistOnly || ihrOnly || admin1Filter !== "";

  useEffect(() => {
    const highCount = sorted.filter((o) => o.risk_level === "high").length;
    document.title = highCount > 0
      ? `(${highCount} HIGH) HealthWatch Global`
      : "HealthWatch Global";
    return () => { document.title = "HealthWatch Global"; };
  }, [sorted]);

  // URL sync — write filter params so the link is always shareable
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (search) p.set("q", search); else p.delete("q");
    if (region  !== "all") p.set("region", region);  else p.delete("region");
    if (country !== "all") p.set("country", country); else p.delete("country");
    if (risk    !== "all") p.set("risk",    risk);    else p.delete("risk");
    if (dateFrom) p.set("from", dateFrom); else p.delete("from");
    if (dateTo)   p.set("to",   dateTo);   else p.delete("to");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [search, region, country, risk, dateFrom, dateTo]);

  // P2: multi-country event clusters — how many countries share the same event_id
  const eventClusters = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of outbreaks) {
      if (o.event_id) map.set(o.event_id, (map.get(o.event_id) ?? 0) + 1);
    }
    return map;
  }, [outbreaks]);

  // P3: countries with ≥2 simultaneous active high-risk outbreaks
  const compoundCrisisCountries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of outbreaks) {
      if (o.risk_level === "high" && o.country_en) {
        counts.set(o.country_en, (counts.get(o.country_en) ?? 0) + 1);
      }
    }
    const result = new Set<string>();
    for (const [c, n] of counts) { if (n >= 2) result.add(c); }
    return result;
  }, [outbreaks]);

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
      o.cases > 0 && o.deaths !== null ? (o.deaths / o.cases * 100).toFixed(1) : "",
      esc(o.risk_level),
      esc(o.date),
      esc({ don: "WHO DON", official: "Official", press: "Press", unverified: "Unverified" }[sourceStatus(o)]),
      // `source_tier` reste renseigné, `source_url` se vide : le tier dit ce que
      // vaut la ligne, l'URL cite un éditeur — et un éditeur interdit ne se cite
      // pas, pas même dans un CSV que le client réexporte ailleurs.
      esc(publishableSourceUrl(o.source) ?? ""),
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

  const generatePdf = useCallback(() => {
    const today = new Date().toLocaleDateString(REPORT_LOCALE[locale] ?? "en-GB", { dateStyle: "long" });
    const title  = REPORT_TITLE[locale] ?? REPORT_TITLE.en;
    const numLocale = REPORT_LOCALE[locale] ?? (locale || "en-GB");
    const hdr = PDF_H[locale] ?? PDF_H.en;
    const rows = sorted.map((o) => {
      const cfr = o.cases > 0 && o.deaths !== null ? `${(o.deaths / o.cases * 100).toFixed(1)}%` : "—";
      const tag = countryTags[o.country_en ?? ""] ? ` <span class="tag">${countryTags[o.country_en ?? ""]}</span>` : "";
      const riskCls = o.risk_level === "high" ? "#f87171" : o.risk_level === "medium" ? "#fbbf24" : "#4ade80";
      const riskLbl = PDF_RISK[o.risk_level]?.[locale] ?? o.risk_level.toUpperCase();
      // Ni le nom ni le lien pour un éditeur interdit : la cellule retombe sur le
      // même tiret qu'une ligne sans source (voir publishableSource* dans
      // lib/source-trust.ts).
      const srcUrl   = publishableSourceUrl(o.source);
      const srcLabel = publishableSourceName(o.source) ?? "—";
      const srcCell  = srcUrl ? `<a href="${srcUrl}" style="color:#2563eb;text-decoration:none">${srcLabel} ↗</a>` : srcLabel;
      return `<tr>
        <td>${o.disease_en ?? o.disease}</td>
        <td>${o.country_en ?? o.country}${tag}</td>
        <td style="text-align:right">${o.cases.toLocaleString(numLocale)}</td>
        <td style="text-align:right">${o.deaths !== null ? o.deaths.toLocaleString(numLocale) : "—"}</td>
        <td style="text-align:right">${cfr}</td>
        <td><span style="color:${riskCls};font-weight:700;text-transform:uppercase;font-size:10px">${riskLbl}</span></td>
        <td>${o.date}</td>
        <td>${srcCell}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #111; font-size: 11px; margin: 32px; }
  h1 { font-size: 16px; font-weight: 700; margin: 0 0 2px; }
  .meta { color: #666; font-size: 10px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .tag { background: #dbeafe; color: #1d4ed8; border-radius: 4px; padding: 1px 5px; font-size: 9px; font-weight: 600; margin-left: 4px; }
  .footer { margin-top: 16px; font-size: 9px; color: #94a3b8; }
  @media print { body { margin: 16px; } }
</style></head><body>
  <h1>${title}</h1>
  <p class="meta">HealthWatch Global &nbsp;·&nbsp; ${today} &nbsp;·&nbsp; ${sorted.length} ${PDF_COUNT[locale] ?? PDF_COUNT.en}</p>
  <table>
    <thead><tr>
      <th>${hdr[0]}</th>
      <th>${hdr[1]}</th>
      <th style="text-align:right">${hdr[2]}</th>
      <th style="text-align:right">${hdr[3]}</th>
      <th style="text-align:right">CFR</th>
      <th>${hdr[5]}</th>
      <th>${hdr[6]}</th>
      <th>${hdr[7]}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">Generated by HealthWatch Global · https://healthwatch-global.com · ${new Date().toISOString()}</p>
  <script>window.onload=function(){window.print();}<\/script>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    track("pdf_export", { rows: sorted.length, locale });
  }, [sorted, locale, countryTags]);

  const generateIhrReport = useCallback(() => {
    const ihrEvents = sorted.filter((o) => !!o.ihr_event_id);
    if (!ihrEvents.length) return;
    const today = new Date().toISOString().split("T")[0];
    const title = { fr: "Résumé des Événements RSI Actifs", en: "Active IHR Events Summary", es: "Resumen de Eventos RSI Activos", ar: "ملخص أحداث اللوائح الصحية الدولية النشطة", id: "Ringkasan Acara IHR Aktif" }[locale] ?? "Active IHR Events Summary";
    const rows = ihrEvents.map((o, i) => {
      const cfr = o.cases > 0 && o.deaths !== null && o.deaths > 0 ? ` · CFR ${(o.deaths / o.cases * 100).toFixed(1)}%` : "";
      const pheic = o.is_pheic ? " [PHEIC]" : "";
      return `<tr>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0">${i + 1}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0"><strong>${o.ihr_event_id}</strong></td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0">${o.disease_en ?? o.disease}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0">${o.country_en ?? o.country}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${o.cases.toLocaleString(REPORT_LOCALE[locale] ?? locale)}${cfr}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;color:${o.risk_level === "high" ? "#dc2626" : o.risk_level === "medium" ? "#d97706" : "#16a34a"}">${(PDF_RISK[o.risk_level]?.[locale] ?? o.risk_level ?? "").toUpperCase()}${pheic}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0">${o.date}</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #111; font-size: 11px; margin: 32px; }
  h1 { font-size: 15px; font-weight: 700; margin: 0 0 2px; }
  .meta { color: #666; font-size: 10px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f172a; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  .footer { margin-top: 16px; font-size: 9px; color: #94a3b8; }
  @media print { body { margin: 16px; } }
</style></head><body>
  <h1>${title}</h1>
  <p class="meta">HealthWatch Global &nbsp;·&nbsp; ${today} &nbsp;·&nbsp; ${ihrEvents.length} IHR event${ihrEvents.length > 1 ? "s" : ""} &nbsp;·&nbsp; Source: WHO International Health Regulations</p>
  <table>
    <thead><tr>
      <th>#</th>
      <th>IHR Event ID</th>
      <th>${{ fr: "Maladie", en: "Disease", es: "Enfermedad", ar: "المرض", id: "Penyakit" }[locale] ?? "Disease"}</th>
      <th>${{ fr: "Pays", en: "Country", es: "País", ar: "الدولة", id: "Negara" }[locale] ?? "Country"}</th>
      <th style="text-align:right">${{ fr: "Cas", en: "Cases", es: "Casos", ar: "الحالات", id: "Kasus" }[locale] ?? "Cases"}</th>
      <th>${{ fr: "Risque", en: "Risk", es: "Riesgo", ar: "الخطر", id: "Risiko" }[locale] ?? "Risk"}</th>
      <th>${{ fr: "Date", en: "Date", es: "Fecha", ar: "التاريخ", id: "Tanggal" }[locale] ?? "Date"}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">Generated by HealthWatch Global · IHR Event data from WHO · ${new Date().toISOString()}</p>
  <script>window.onload=function(){window.print();}<\/script>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    track("ihr_export", { rows: ihrEvents.length, locale });
  }, [sorted, locale]);

  const downloadHtml = useCallback(() => {
    const today = new Date().toLocaleDateString(REPORT_LOCALE[locale] ?? "en-GB", { dateStyle: "long" });
    const title  = REPORT_TITLE[locale] ?? REPORT_TITLE.en;
    const numLocale = REPORT_LOCALE[locale] ?? (locale || "en-GB");
    const hdr = PDF_H[locale] ?? PDF_H.en;
    const rows = sorted.map((o) => {
      const cfr = o.cases > 0 && o.deaths !== null ? `${(o.deaths / o.cases * 100).toFixed(1)}%` : "—";
      const tag = countryTags[o.country_en ?? ""] ? ` <span class="tag">${countryTags[o.country_en ?? ""]}</span>` : "";
      const riskCls = o.risk_level === "high" ? "#f87171" : o.risk_level === "medium" ? "#fbbf24" : "#4ade80";
      const riskLbl = PDF_RISK[o.risk_level]?.[locale] ?? o.risk_level.toUpperCase();
      // Ni le nom ni le lien pour un éditeur interdit : la cellule retombe sur le
      // même tiret qu'une ligne sans source (voir publishableSource* dans
      // lib/source-trust.ts).
      const srcUrl   = publishableSourceUrl(o.source);
      const srcLabel = publishableSourceName(o.source) ?? "—";
      const srcCell  = srcUrl ? `<a href="${srcUrl}" style="color:#2563eb;text-decoration:none">${srcLabel} ↗</a>` : srcLabel;
      return `<tr>
        <td>${o.disease_en ?? o.disease}</td>
        <td>${o.country_en ?? o.country}${tag}</td>
        <td style="text-align:right">${o.cases.toLocaleString(numLocale)}</td>
        <td style="text-align:right">${o.deaths !== null ? o.deaths.toLocaleString(numLocale) : "—"}</td>
        <td style="text-align:right">${cfr}</td>
        <td><span style="color:${riskCls};font-weight:700;text-transform:uppercase;font-size:10px">${riskLbl}</span></td>
        <td>${o.date}</td>
        <td>${srcCell}</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #111; font-size: 11px; margin: 32px; }
  h1 { font-size: 16px; font-weight: 700; margin: 0 0 2px; }
  .meta { color: #666; font-size: 10px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e293b; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .tag { background: #dbeafe; color: #1d4ed8; border-radius: 4px; padding: 1px 5px; font-size: 9px; font-weight: 600; margin-left: 4px; }
  .footer { margin-top: 16px; font-size: 9px; color: #94a3b8; }
</style></head><body>
  <h1>${title}</h1>
  <p class="meta">HealthWatch Global &nbsp;·&nbsp; ${today} &nbsp;·&nbsp; ${sorted.length} ${PDF_COUNT[locale] ?? PDF_COUNT.en}</p>
  <table>
    <thead><tr>
      <th>${hdr[0]}</th>
      <th>${hdr[1]}</th>
      <th style="text-align:right">${hdr[2]}</th>
      <th style="text-align:right">${hdr[3]}</th>
      <th style="text-align:right">CFR</th>
      <th>${hdr[5]}</th>
      <th>${hdr[6]}</th>
      <th>${hdr[7]}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">Generated by HealthWatch Global · https://healthwatch-global.com · ${new Date().toISOString()}</p>
</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `healthwatch-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    track("html_export", { rows: sorted.length, locale });
  }, [sorted, locale, countryTags]);

  const downloadGeoJson = useCallback(() => {
    const features = sorted.map((o) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [
          o.admin1_lng ?? o.lng,
          o.admin1_lat ?? o.lat,
        ],
      },
      properties: {
        disease:    o.disease_en ?? o.disease,
        country:    o.country_en ?? o.country,
        region:     o.region,
        cases:      o.cases,
        deaths:     o.deaths,
        cfr_pct:    o.cases > 0 && o.deaths !== null ? parseFloat((o.deaths / o.cases * 100).toFixed(1)) : null,
        risk_level: o.risk_level,
        is_pheic:   o.is_pheic,
        date:       o.date,
        admin1:     hasRealAdmin1(o.admin1) ? o.admin1 : null,
        id:         o.id,
      },
    }));
    const geojson = { type: "FeatureCollection" as const, features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `healthwatch-${new Date().toISOString().split("T")[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    track("geojson_export", { rows: features.length, locale });
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
    setWatchlistOnly(false);
    setAdmin1Filter("");
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
        {/* Export buttons */}
        {isPaid ? (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={downloadCsv}
              title={`${l.exportCsv} (${sorted.length})`}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{l.exportCsv}</span>
              <span className="text-gray-500">({sorted.length})</span>
            </button>
            <button
              onClick={generatePdf}
              title="PDF"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={downloadHtml}
              title="HTML"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">HTML</span>
            </button>
            <button
              onClick={downloadGeoJson}
              title="GeoJSON (QGIS / ArcGIS)"
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GeoJSON</span>
            </button>
            {sorted.some((o) => o.ihr_event_id) && (
              <button
                onClick={generateIhrReport}
                title="IHR/RSI Events PDF"
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-900/40 hover:bg-teal-800/50 border border-teal-700/50 text-teal-300 hover:text-teal-200 rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">IHR PDF</span>
              </button>
            )}
          </div>
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
        {/* Share this view — copies current URL with active filters, visible to all */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          title={{ fr: "Copier le lien de cette vue", en: "Copy link to this view", es: "Copiar enlace de esta vista", ar: "نسخ رابط هذه العرض", id: "Salin tautan tampilan ini" }[locale] ?? "Copy link to this view"}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-lg text-xs transition-colors shrink-0"
        >
          {copied
            ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            : <Share2 className="w-3.5 h-3.5" />
          }
          <span className="hidden sm:inline">
            {copied
              ? ({ fr: "Copié !", en: "Copied!", es: "¡Copiado!", ar: "تم!", id: "Disalin!" }[locale] ?? "Copied!")
              : ({ fr: "Partager", en: "Share", es: "Compartir", ar: "مشاركة", id: "Bagikan" }[locale] ?? "Share")
            }
          </span>
        </button>
        </div>

        {/* Mobile filter toggle — hidden on sm+ where filters are always visible */}
        <div className="flex items-center justify-between sm:hidden">
          <button
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              mobileFiltersOpen
                ? "bg-gray-700 border-gray-500 text-white"
                : "border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {{ fr: "Filtres", en: "Filters", es: "Filtros", ar: "الفلاتر", id: "Filter" }[locale] ?? "Filters"}
            {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
          </button>
        </div>

        {/* Region pills — always visible (primary filter) */}
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

        {/* Risk pills + dropdowns — collapsible on mobile */}
        <div className={`${mobileFiltersOpen ? "block" : "hidden"} sm:block`}>
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
                : sourceFilter === "press"
                ? "border-violet-700/50 text-violet-400"
                : sourceFilter === "unverified"
                ? "border-gray-600 text-gray-400"
                : "border-gray-800 text-gray-400"
            }`}
          >
            <option value="all">{l.allSources}</option>
            <option value="don">{l.donBadge}</option>
            <option value="official">{l.officialBadge}</option>
            <option value="press">{l.pressBadge}</option>
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

          {/* Admin1 / province filter */}
          <input
            type="text"
            value={admin1Filter}
            onChange={(e) => setAdmin1Filter(e.target.value)}
            placeholder={locale === "fr" ? "Province / région…" : locale === "es" ? "Provincia / región…" : "Province / admin1…"}
            className="text-xs px-2 py-1 rounded-lg border border-gray-800 bg-gray-900 text-gray-400 placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors w-36"
          />

          {/* Epi-week toggle */}
          <button
            onClick={() => setEpiWeekMode((v) => !v)}
            title={epiWeekMode ? "Switch to calendar date" : "Switch to epidemiological week (ISO)"}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors whitespace-nowrap ${
              epiWeekMode
                ? "border-teal-700/50 bg-teal-900/20 text-teal-300"
                : "border-gray-800 text-gray-600 hover:border-gray-600 hover:text-gray-400"
            }`}
          >
            {{ fr: "S. épi", en: "Epi wk", es: "S. epi", ar: "أ. وبائي", id: "Mgg epi" }[locale] ?? "Epi wk"}
          </button>

          {/* Age / duration toggle */}
          <button
            onClick={() => setAgeMode((v) => !v)}
            title={ageMode ? "Switch to report date" : "Show outbreak duration (days since report date)"}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors whitespace-nowrap ${
              ageMode
                ? "border-orange-700/50 bg-orange-900/20 text-orange-300"
                : "border-gray-800 text-gray-600 hover:border-gray-600 hover:text-gray-400"
            }`}
          >
            {{ fr: "Âge", en: "Age", es: "Edad", ar: "العمر", id: "Usia" }[locale] ?? "Age"}
          </button>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        </div>{/* end collapsible filters */}
      </div>

      {/* ── Disease watchlist toggle ───────────────────────────────────── */}
      {(diseaseWatchlist?.length ?? 0) > 0 && (
        <button
          onClick={() => setWatchlistOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-colors ${
            watchlistOnly
              ? "bg-blue-900/40 border-blue-700/50 text-blue-300"
              : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
          }`}
        >
          🔬 {watchlistOnly
            ? ({ fr: "Maladies prioritaires actif", en: "Priority diseases active", es: "Enfermedades prioritarias activo", ar: "الأمراض ذات الأولوية مفعَّل", id: "Penyakit prioritas aktif" }[locale] ?? "Priority diseases active")
            : ({ fr: `${diseaseWatchlist!.length} maladies prioritaires`, en: `${diseaseWatchlist!.length} priority diseases`, es: `${diseaseWatchlist!.length} enf. prioritarias`, ar: `${diseaseWatchlist!.length} أمراض ذات أولوية`, id: `${diseaseWatchlist!.length} penyakit prioritas` }[locale] ?? `${diseaseWatchlist!.length} priority diseases`)
          }
        </button>
      )}

      {/* ── IHR/RSI event filter ──────────────────────────────────────── */}
      {isPaid && outbreaks.some((o) => o.ihr_event_id) && (
        <button
          onClick={() => setIhrOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-colors ${
            ihrOnly
              ? "bg-teal-900/40 border-teal-700/50 text-teal-300"
              : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
          }`}
        >
          📋 {ihrOnly
            ? ({ fr: "Évén. RSI actif", en: "IHR events active", es: "Eventos RSI activo", ar: "أحداث اللوائح مفعَّل", id: "Acara IHR aktif" }[locale] ?? "IHR events active")
            : ({ fr: "Filtrer par évén. RSI", en: "IHR events only", es: "Solo eventos RSI", ar: "أحداث اللوائح فقط", id: "Hanya acara IHR" }[locale] ?? "IHR events only")}
        </button>
      )}

      {/* ── Saved filters ──────────────────────────────────────────────── */}
      <SavedFilters
        locale={locale}
        currentFilters={{ search, region, country, risk, dateFrom, dateTo, cfrFilter, sourceFilter }}
        hasActiveFilters={hasFilters}
        onLoad={loadFilter}
      />

      {/* ── Default workspace (Pro) ────────────────────────────────────── */}
      {isPaid && (region !== "all" || country !== "all") && (
        <button
          onClick={async () => {
            await fetch("/api/display-prefs", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ region, country }),
            });
            setDefaultSaved(true);
            setTimeout(() => setDefaultSaved(false), 2000);
          }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-400 transition-colors"
        >
          {defaultSaved ? (
            <span className="text-green-400">
              {{ fr: "Vue par défaut enregistrée", en: "Default view saved", es: "Vista guardada", ar: "تم حفظ العرض", id: "Tampilan disimpan" }[locale] ?? "Default view saved"}
            </span>
          ) : (
            <>
              <span>⊙</span>
              {{ fr: "Définir comme vue par défaut", en: "Set as default view", es: "Establecer como vista predeterminada", ar: "تعيين كعرض افتراضي", id: "Jadikan tampilan default" }[locale] ?? "Set as default view"}
            </>
          )}
        </button>
      )}

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
                  title={{ fr: "Cas confirmés + probables — agrégés OMS, ECDC, OPAS et Africa CDC. Peut différer du sitrep OMS (cas confirmés uniquement).", en: "Confirmed + probable cases — aggregated from WHO, ECDC, PAHO & Africa CDC. May differ from WHO sitrep (lab-confirmed only).", es: "Casos confirmados + probables — agregados OMS, ECDC, PAHO y Africa CDC. Puede diferir del sitrep OMS (solo confirmados).", ar: "الحالات المؤكدة + المحتملة — مجمّعة من WHO وECDC وPAHO وAfrica CDC. قد تختلف عن تقارير WHO (المؤكدة مخبرياً فقط).", id: "Kasus terkonfirmasi + probable — agregat dari WHO, ECDC, PAHO & Africa CDC. Mungkin berbeda dari sitrep WHO (hanya terkonfirmasi lab)." }[locale] ?? "Confirmed + probable cases — aggregated from WHO, ECDC, PAHO & Africa CDC. May differ from WHO sitrep (lab-confirmed only)."}
                >
                  <span className="inline-flex items-center gap-1">
                    {l.cases}
                    <Info className="w-3 h-3 text-gray-600 shrink-0" />
                  </span>
                  <SortIcon col="cases" activeKey={sortKey} dir={sortDir} />
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
                <th className="px-2 py-3 hidden lg:table-cell text-gray-600 text-left text-[10px] uppercase tracking-wide whitespace-nowrap">
                  {{ fr: "Tend.", en: "Trend", es: "Tend.", ar: "اتجاه", id: "Tren" }[locale] ?? "Trend"}
                </th>
                <th
                  className="text-left px-4 py-3 hidden md:table-cell cursor-pointer hover:text-gray-200 select-none whitespace-nowrap"
                  onClick={() => handleSort("date")}
                  title={{ fr: "Date du dernier bulletin officiel (WHO, ECDC, PAHO ou Africa CDC) — pas nécessairement la date de début du foyer", en: "Date of the latest official bulletin (WHO, ECDC, PAHO or Africa CDC) — not necessarily the outbreak start date", es: "Fecha del último boletín oficial (OMS, ECDC, PAHO o Africa CDC) — no necesariamente la fecha de inicio del brote", ar: "تاريخ آخر نشرة رسمية (WHO أو ECDC أو PAHO أو Africa CDC) — لا يمثل بالضرورة تاريخ بداية التفشي", id: "Tanggal buletin resmi terbaru (WHO, ECDC, PAHO atau Africa CDC) — bukan tanggal mulai wabah" }[locale] ?? "Date of latest official bulletin"}
                >
                  {ageMode
                    ? ({ fr: "Âge", en: "Age", es: "Edad", ar: "العمر", id: "Usia" }[locale] ?? "Age")
                    : epiWeekMode
                    ? ({ fr: "S. épi.", en: "Epi wk", es: "S. epi.", ar: "أسبوع وبائي", id: "Mgg epi" }[locale] ?? "Epi wk")
                    : l.date
                  }
                  <SortIcon col="date" activeKey={sortKey} dir={sortDir} />
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
                      {matchDisease(outbreak.disease_en || outbreak.disease).matched ? (
                        <Link
                          href={`/${locale}/disease/${diseaseToSlug(matchDisease(outbreak.disease_en || outbreak.disease).info.name_en)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-red-400 transition-colors"
                        >
                          {getLocalizedDisease(outbreak, locale)}
                        </Link>
                      ) : (
                        <span>{getLocalizedDisease(outbreak, locale)}</span>
                      )}
                      {isNewOutbreak(outbreak) && (
                        <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-900/50 border border-green-700/50 text-green-300 shrink-0 animate-pulse">
                          {{ fr: "NOUVEAU", en: "NEW", es: "NUEVO", ar: "جديد", id: "BARU" }[locale] ?? "NEW"}
                        </span>
                      )}
                      {!isPaid && outbreak.is_free_featured && (
                        <span
                          title={{ fr: "Chiffres réels débloqués — un foyer vedette par continent", en: "Real figures unlocked — one showcase outbreak per continent", es: "Cifras reales desbloqueadas — un brote destacado por continente", ar: "أرقام حقيقية غير مقيّدة — بؤرة بارزة واحدة لكل قارة", id: "Angka asli terbuka — satu wabah unggulan per benua" }[locale] ?? "Real figures unlocked — one showcase outbreak per continent"}
                          className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-700/50 text-emerald-300 shrink-0 cursor-help"
                        >
                          {{ fr: "APERÇU GRATUIT", en: "FREE SAMPLE", es: "MUESTRA GRATIS", ar: "عرض مجاني", id: "CONTOH GRATIS" }[locale] ?? "FREE SAMPLE"}
                        </span>
                      )}
                      {outbreak.is_pheic && (
                        <span title="PHEIC — Public Health Emergency of International Concern" className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-900/50 border border-purple-700/50 text-purple-300 shrink-0 cursor-help">
                          🚨 PHEIC
                        </span>
                      )}
                      {outbreak.verification_status === "under_investigation" && (
                        <span
                          title={{ fr: "Foyer en cours d'investigation — données préliminaires", en: "Under investigation — preliminary data", es: "En investigación — datos preliminares", ar: "قيد التحقيق — بيانات أولية", id: "Dalam penyelidikan — data awal" }[locale] ?? "Under investigation — preliminary data"}
                          className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-900/40 border border-orange-700/50 text-orange-300 shrink-0 cursor-help whitespace-nowrap"
                        >
                          {{ fr: "ENQUÊTE", en: "INVESTIG.", es: "INVESTIG.", ar: "تحقيق", id: "INVESTIGASI" }[locale] ?? "INVESTIG."}
                        </span>
                      )}
                      {outbreak.response_phase === "active_response" && (
                        <span
                          title={{ fr: "Réponse active déployée — équipes terrain mobilisées", en: "Active response deployed — field teams mobilised", es: "Respuesta activa desplegada — equipos de campo movilizados", ar: "استجابة نشطة — فِرق ميدانية منتشرة", id: "Respons aktif dikerahkan — tim lapangan dimobilisasi" }[locale] ?? "Active response deployed"}
                          className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-900/40 border border-red-700/50 text-red-300 shrink-0 cursor-help whitespace-nowrap"
                        >
                          {{ fr: "RÉPONSE", en: "RESPONSE", es: "RESPUESTA", ar: "استجابة", id: "RESPONS" }[locale] ?? "RESPONSE"}
                        </span>
                      )}
                      {outbreak.response_phase === "contained" && (
                        <span
                          title={{ fr: "Foyer contenu — propagation limitée par les mesures de contrôle", en: "Contained — spread limited by control measures", es: "Contenido — propagación limitada por medidas de control", ar: "محتوَى — انتشار محدود بإجراءات السيطرة", id: "Terkendali — penyebaran dibatasi oleh langkah pengendalian" }[locale] ?? "Contained — spread limited"}
                          className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-900/40 border border-teal-700/50 text-teal-300 shrink-0 cursor-help whitespace-nowrap"
                        >
                          {{ fr: "CONTENU", en: "CONTAINED", es: "CONTENIDO", ar: "محتوَى", id: "TERKENDALI" }[locale] ?? "CONTAINED"}
                        </span>
                      )}
                      {sourceStatus(outbreak) === 'don' && (
                        publishableSourceUrl(outbreak.source) ? (
                          <a href={publishableSourceUrl(outbreak.source)!} target="_blank" rel="noopener noreferrer" title={l.donTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-700/50 text-blue-400 shrink-0 cursor-pointer whitespace-nowrap hover:bg-blue-900/60 transition-colors">
                            {l.donBadge} ↗
                          </a>
                        ) : (
                          <span title={l.donTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-700/50 text-blue-400 shrink-0 cursor-help whitespace-nowrap">
                            {l.donBadge}
                          </span>
                        )
                      )}
                      {sourceStatus(outbreak) === 'official' && (
                        publishableSourceUrl(outbreak.source) ? (
                          <a href={publishableSourceUrl(outbreak.source)!} target="_blank" rel="noopener noreferrer" title={l.officialTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/50 text-amber-400 shrink-0 cursor-pointer whitespace-nowrap hover:bg-amber-900/60 transition-colors">
                            {sourceName(outbreak.source)} ↗
                          </a>
                        ) : (
                          <span title={l.officialTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/50 text-amber-400 shrink-0 cursor-help whitespace-nowrap">
                            {sourceName(outbreak.source)}
                          </span>
                        )
                      )}
                      {sourceStatus(outbreak) === 'press' && (
                        publishableSourceUrl(outbreak.source) ? (
                          <a href={publishableSourceUrl(outbreak.source)!} target="_blank" rel="noopener noreferrer" title={l.pressTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-900/30 border border-violet-700/50 text-violet-400 shrink-0 cursor-pointer whitespace-nowrap hover:bg-violet-900/60 transition-colors">
                            {sourceName(outbreak.source)} ↗
                          </a>
                        ) : (
                          <span title={l.pressTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-900/30 border border-violet-700/50 text-violet-400 shrink-0 cursor-help whitespace-nowrap">
                            {sourceName(outbreak.source)}
                          </span>
                        )
                      )}
                      {sourceStatus(outbreak) === 'unverified' && (
                        <span title={l.illustrativeTooltip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 shrink-0 cursor-help whitespace-nowrap">
                          {l.illustrativeBadge}
                        </span>
                      )}
                      {(() => {
                        const h = freshOutbreakHours(outbreak);
                        if (h === null) return null;
                        const label = h < 24
                          ? { fr: `MàJ · ${h}h`, en: `Updated · ${h}h`, es: `Actu. · ${h}h`, ar: `تحديث · ${h}س`, id: `Update · ${h}j` }[locale] ?? `Updated · ${h}h`
                          : { fr: `MàJ · ${Math.floor(h / 24)}j`, en: `Updated · ${Math.floor(h / 24)}d`, es: `Actu. · ${Math.floor(h / 24)}d`, ar: `تحديث · ${Math.floor(h / 24)}ي`, id: `Update · ${Math.floor(h / 24)}h` }[locale] ?? `Updated · ${Math.floor(h / 24)}d`;
                        const tip = h < 24
                          ? { fr: `Synchronisé il y a ${h}h avec la source officielle`, en: `Synced ${h}h ago with the official source`, es: `Sincronizado hace ${h}h con la fuente oficial`, ar: `تمت المزامنة قبل ${h} ساعة مع المصدر الرسمي`, id: `Disinkronkan ${h}j lalu dengan sumber resmi` }[locale] ?? `Synced ${h}h ago with the official source`
                          : { fr: `Synchronisé il y a ${Math.floor(h / 24)}j avec la source officielle`, en: `Synced ${Math.floor(h / 24)}d ago with the official source`, es: `Sincronizado hace ${Math.floor(h / 24)}d con la fuente oficial`, ar: `تمت المزامنة قبل ${Math.floor(h / 24)} يوماً مع المصدر الرسمي`, id: `Disinkronkan ${Math.floor(h / 24)}h lalu dengan sumber resmi` }[locale] ?? `Synced ${Math.floor(h / 24)}d ago with the official source`;
                        return (
                          <span title={tip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/50 text-emerald-400 shrink-0 cursor-help whitespace-nowrap">
                            ✓ {label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const d = staleOutbreakDays(outbreak);
                        if (!d) return null;
                        // A row can be old AND verified: isSourceConfirmed means a human
                        // already opened the primary source and confirmed it genuinely
                        // stopped publishing (not a reporting gap). Until this existed,
                        // the badge below couldn't tell the two apart — see
                        // isSourceConfirmed (lib/outbreaks.ts) and migration 20260822120000.
                        if (isSourceConfirmed(outbreak)) {
                          const clabel = { fr: `SOURCE CONFIRMÉE · ${d}j`, en: `SOURCE CONFIRMED · ${d}d`, es: `FUENTE CONFIRMADA · ${d}d`, ar: `${d}د · تم تأكيد المصدر`, id: `SUMBER DIKONFIRMASI · ${d}h` }[locale] ?? `SOURCE CONFIRMED · ${d}d`;
                          const ctip   = { fr: `Source officielle vérifiée directement — aucune édition plus récente, pas un trou de données`, en: `Primary source checked directly — no newer edition exists, not a data gap`, es: `Fuente oficial verificada directamente — no existe edición más reciente, no es una laguna de datos`, ar: `تم التحقق من المصدر الرسمي مباشرة — لا توجد نشرة أحدث، وليس فجوة بيانات`, id: `Sumber resmi diperiksa langsung — tidak ada edisi lebih baru, bukan celah data` }[locale] ?? `Primary source checked directly — no newer edition exists, not a data gap`;
                          return (
                            <span title={ctip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800/50 border border-slate-600/50 text-slate-300 shrink-0 cursor-help whitespace-nowrap">
                              ✓ {clabel}
                            </span>
                          );
                        }
                        const label = { fr: `SANS MAJ · ${d}j`, en: `NO UPDATE · ${d}d`, es: `SIN ACTU. · ${d}d`, ar: `${d}د · بلا تحديث`, id: `TK ADA UPDATE · ${d}h` }[locale] ?? `NO UPDATE · ${d}d`;
                        const tip   = { fr: `Aucun bulletin officiel depuis ${d} jours — foyer peut-être résolu ou non rapporté`, en: `No official bulletin in ${d} days — may be resolved or unreported`, es: `Sin boletín oficial en ${d} días — puede estar resuelto o sin reporte`, ar: `لا يوجد نشرة رسمية منذ ${d} يوماً`, id: `Tidak ada buletin resmi dalam ${d} hari` }[locale] ?? `No official update in ${d} days`;
                        return (
                          <span title={tip} className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-900/30 border border-orange-700/50 text-orange-400 shrink-0 cursor-help whitespace-nowrap">
                            ⚠ {label}
                          </span>
                        );
                      })()}
                      {/* P2: multi-country event cluster badge */}
                      {outbreak.event_id && (eventClusters.get(outbreak.event_id) ?? 0) > 1 && (
                        <span
                          title={{ fr: `Événement multi-pays (${eventClusters.get(outbreak.event_id)} foyers liés)`, en: `Multi-country event (${eventClusters.get(outbreak.event_id)} linked outbreaks)`, es: `Evento multipaís (${eventClusters.get(outbreak.event_id)} focos vinculados)`, ar: `حدث متعدد الدول (${eventClusters.get(outbreak.event_id)} بؤر مرتبطة)`, id: `Kejadian multi-negara (${eventClusters.get(outbreak.event_id)} wabah terhubung)` }[locale] ?? `Multi-country event`}
                          className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-900/30 border border-cyan-700/40 text-cyan-400 shrink-0 cursor-help whitespace-nowrap"
                        >
                          🌍 {eventClusters.get(outbreak.event_id)}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* P3 compound crisis + P4 admin1 */}
                  <td className="px-4 py-3 text-gray-300">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/${locale}/country/${countryToSlug(outbreak.country_en ?? outbreak.country ?? "")}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-white transition-colors"
                        >
                          {getLocalizedCountry(outbreak, locale)}
                        </Link>
                        {compoundCrisisCountries.has(outbreak.country_en ?? "") && (
                          <span
                            title={{ fr: "≥ 2 foyers à haut risque simultanés dans ce pays", en: "≥ 2 simultaneous high-risk outbreaks in this country", es: "≥ 2 brotes de alto riesgo simultáneos en este país", ar: "≥ تفشيَّان عاليا الخطورة في نفس الوقت في هذا البلد", id: "≥ 2 wabah risiko tinggi simultan di negara ini" }[locale] ?? "Compound crisis"}
                            className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-700/40 text-red-400 whitespace-nowrap cursor-help"
                          >
                            {{ fr: "crise composée", en: "compound crisis", es: "crisis compuesta", ar: "أزمة مركبة", id: "krisis majemuk" }[locale] ?? "compound crisis"}
                          </span>
                        )}
                        {countryTags[outbreak.country_en ?? ""] && (
                          <span className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded bg-blue-900/30 border border-blue-700/40 text-blue-300 whitespace-nowrap max-w-[120px] truncate">
                            {countryTags[outbreak.country_en ?? ""]}
                          </span>
                        )}
                      </div>
                      {hasRealAdmin1(outbreak.admin1) && (
                        <p className="text-[10px] text-gray-600 leading-tight">{outbreak.admin1}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    <div className="flex items-center gap-1.5">
                      {(isPaid || outbreak.is_free_featured) ? (
                        outbreak.cases > 0 ? outbreak.cases.toLocaleString(numLocale) : <span className="text-gray-600 italic text-xs">{l.noData}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 cursor-pointer" onClick={() => openModal("cases")} title="Pro — click to unlock">
                          <span className="blur-sm select-none text-gray-500 pointer-events-none">{outbreak.cases.toLocaleString(numLocale).replace(/\d/g, "•")}</span>
                          <Lock className="w-2.5 h-2.5 text-amber-500/60 pointer-events-none shrink-0" />
                        </span>
                      )}
                      {outbreak.cases > 0 && <TrendBadge trend={trends?.[outbreak.id]} />}
                      {isPaid && (() => {
                        const d24 = trends?.[outbreak.id]?.delta24h;
                        if (d24 === null || d24 === undefined || d24 === 0) return null;
                        return (
                          <span className="text-[10px] text-sky-400 font-semibold whitespace-nowrap">
                            {d24 > 0 ? "+" : ""}{d24.toLocaleString(numLocale)}/24h
                          </span>
                        );
                      })()}
                      {isPaid && (() => {
                        const prev = lastCases[outbreak.id];
                        if (!prev || outbreak.cases <= prev) return null;
                        const delta = outbreak.cases - prev;
                        return <span className="text-[10px] text-amber-400 font-semibold whitespace-nowrap">+{delta.toLocaleString(numLocale)}</span>;
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-red-400 hidden sm:table-cell">
                    {(isPaid || outbreak.is_free_featured) ? (
                      outbreak.deaths !== null
                        ? outbreak.deaths.toLocaleString(numLocale)
                        : <span className="text-gray-500 text-sm" title="Non rapporté dans cette source">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 cursor-pointer" onClick={() => openModal("cases")} title="Pro — click to unlock">
                        <span className="blur-sm select-none text-gray-500 pointer-events-none">{(outbreak.deaths ?? 0).toLocaleString(numLocale).replace(/\d/g, "•")}</span>
                        <Lock className="w-2.5 h-2.5 text-amber-500/60 pointer-events-none shrink-0" />
                      </span>
                    )}
                  </td>
                  {/* CFR */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {(isPaid || outbreak.is_free_featured) ? (
                      outbreak.cases > 0 && outbreak.deaths !== null ? (
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
                      outbreak.cases > 0 && outbreak.deaths !== null ? (
                        <span className="inline-flex items-center gap-1 cursor-pointer" onClick={() => openModal("cases")} title="Pro — click to unlock">
                          <span className="blur-sm select-none text-gray-500 pointer-events-none text-sm font-medium">{(outbreak.deaths / outbreak.cases * 100).toFixed(1).replace(/\d/g, "•")}%</span>
                          <Lock className="w-2.5 h-2.5 text-amber-500/60 pointer-events-none shrink-0" />
                        </span>
                      ) : (
                        <button
                          onClick={() => openModal("cases")}
                          className="flex items-center gap-1 text-xs text-amber-500/70 hover:text-amber-400 transition-colors"
                        >
                          <Lock className="w-3 h-3" />
                          Pro
                        </button>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <RiskBadge level={outbreak.risk_level} />
                      <RiskScoreBadge score={computeRiskScore(outbreak, trends?.[outbreak.id])} />
                    </div>
                  </td>
                  <td className="px-2 py-3 hidden lg:table-cell">
                    <TrendBar trend={trends?.[outbreak.id]} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1 text-gray-400 text-sm tabular-nums">
                      <span>
                        {ageMode ? (() => {
                          const days = Math.round((Date.now() - new Date(outbreak.date).getTime()) / 86_400_000);
                          const cls  = days < 14 ? "text-green-400" : days < 30 ? "text-amber-400" : "text-red-400";
                          return <span className={`text-xs font-semibold tabular-nums ${cls}`}>{days}d</span>;
                        })() : epiWeekMode ? (
                          <span className="text-teal-400/80">{getEpiWeek(outbreak.date)}</span>
                        ) : (() => {
                          const [y, m, d] = outbreak.date.split("-").map(Number);
                          const localeMap: Record<string, string> = { fr: "fr-FR", es: "es-ES", ar: "ar-SA", id: "id-ID" };
                          const formatted = new Date(y, m - 1, d).toLocaleDateString(
                            localeMap[locale] ?? "en-GB",
                            { day: "numeric", month: "short", year: "numeric" }
                          );
                          return locale === "fr" ? `au ${formatted}` : locale === "ar" ? `بتاريخ ${formatted}` : formatted;
                        })()}
                      </span>
                      {/* Lisait `updated_at` jusqu'au 2026-08-25 : sur une meme ligne le tableau
                          pouvait afficher "SOURCE CONFIRMEE · 60j" a cote de "⏰3d", parce que les
                          pastilles voisines etaient passees sur `date` en aout et pas celle-ci.
                          Desormais adossee a lastVerifiedIso, et rendue seulement dans la bande que
                          les autres pastilles laissent muette (ni "MàJ · Nh" a moins de 7j, ni
                          "SANS MAJ · Nj" a plus de 60j, ni source confirmee) — sans quoi elle
                          doublerait un signal deja donne. */}
                      {!ageMode && !epiWeekMode
                        && freshOutbreakHours(outbreak) === null
                        && !staleOutbreakDays(outbreak)
                        && !isSourceConfirmed(outbreak) && (
                        <StaleDaysBadge referenceIso={lastVerifiedIso(outbreak)} locale={locale} />
                      )}
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
