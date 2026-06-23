"use client";

import { useState, useEffect } from "react";
import { Globe, Loader2, RefreshCw } from "lucide-react";
import type { ScorecardCountry } from "@/app/api/country-scorecard/route";

const COPY: Record<string, {
  title: string; outbreaks: string; cases: string; lastUpdate: string;
  empty: string; refresh: string; pheic: string; filter: string;
  sortRisk: string; sortAlpha: string; sortCases: string;
  risk: Record<string, string>;
}> = {
  fr: { title: "Vue par pays", outbreaks: "foyer(s)", cases: "cas", lastUpdate: "mis à jour", empty: "Aucune donnée", refresh: "Rafraîchir", pheic: "USPPI", filter: "Filtrer…", sortRisk: "Par risque", sortAlpha: "A–Z", sortCases: "Par cas",
    risk: { high: "ÉLEVÉ", medium: "MOYEN", low: "FAIBLE" } },
  en: { title: "Country view",  outbreaks: "outbreak(s)", cases: "cases", lastUpdate: "updated", empty: "No data", refresh: "Refresh", pheic: "PHEIC", filter: "Filter…", sortRisk: "By risk", sortAlpha: "A–Z", sortCases: "By cases",
    risk: { high: "HIGH", medium: "MED", low: "LOW" } },
  es: { title: "Vista por país", outbreaks: "brote(s)", cases: "casos", lastUpdate: "actualizado", empty: "Sin datos", refresh: "Actualizar", pheic: "ESPII", filter: "Filtrar…", sortRisk: "Por riesgo", sortAlpha: "A–Z", sortCases: "Por casos",
    risk: { high: "ALTO", medium: "MEDIO", low: "BAJO" } },
  ar: { title: "عرض الدول", outbreaks: "تفشٍّ", cases: "حالات", lastUpdate: "آخر تحديث", empty: "لا بيانات", refresh: "تحديث", pheic: "طوارئ صحية", filter: "تصفية…", sortRisk: "حسب الخطر", sortAlpha: "أ–ي", sortCases: "حسب الحالات",
    risk: { high: "مرتفع", medium: "متوسط", low: "منخفض" } },
  id: { title: "Tampilan negara", outbreaks: "wabah", cases: "kasus", lastUpdate: "diperbarui", empty: "Tidak ada data", refresh: "Perbarui", pheic: "KKMMD", filter: "Filter…", sortRisk: "Berdasar risiko", sortAlpha: "A–Z", sortCases: "Berdasar kasus",
    risk: { high: "TINGGI", medium: "SEDANG", low: "RENDAH" } },
};

const RISK_BADGE: Record<string, string> = {
  high:   "bg-red-900/40 border-red-700/50 text-red-300",
  medium: "bg-amber-900/30 border-amber-700/40 text-amber-300",
  low:    "bg-green-900/30 border-green-700/40 text-green-300",
};

function computeTHI(country: ScorecardCountry): number {
  let score = 10;
  score -= country.max_risk === "high" ? 3 : country.max_risk === "medium" ? 1 : 0;
  score -= country.has_pheic ? 2 : 0;
  score -= Math.min(3, Math.floor(country.outbreak_count / 2));
  return Math.max(1, Math.min(10, score));
}

function THIBadge({ score }: { score: number }) {
  const cls =
    score >= 8 ? "bg-green-900/30 border-green-700/40 text-green-300"
    : score >= 5 ? "bg-amber-900/20 border-amber-700/30 text-amber-300"
    : "bg-red-900/30 border-red-700/40 text-red-300";
  return (
    <span
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${cls}`}
      title="Travel Health Index (1–10) — computed from active risk levels, outbreak count, and PHEIC status"
    >
      THI {score}
    </span>
  );
}

function timeSince(iso: string, locale: string): string {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1)   return locale === "fr" ? "< 1h" : "< 1h";
  if (h < 24)  return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function CountryScorecardTab({ locale }: { locale: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [countries, setCountries] = useState<ScorecardCountry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("");
  const [sort,      setSort]      = useState<"risk" | "alpha" | "cases">("risk");

  const RISK_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/country-scorecard");
      const data = await res.json() as { countries: ScorecardCountry[] };
      setCountries(data.countries ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = filter
    ? countries.filter((co) => co.country_en.toLowerCase().includes(filter.toLowerCase()))
    : countries;

  const visible = [...filtered].sort((a, b) => {
    if (sort === "alpha") return a.country_en.localeCompare(b.country_en);
    if (sort === "cases") return b.total_cases - a.total_cases;
    if (a.has_pheic !== b.has_pheic) return a.has_pheic ? -1 : 1;
    const ra = RISK_ORDER[a.max_risk] ?? 0;
    const rb = RISK_ORDER[b.max_risk] ?? 0;
    if (ra !== rb) return rb - ra;
    return b.outbreak_count - a.outbreak_count;
  });

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.title}</p>
          <span className="text-[10px] text-gray-600">({countries.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px]">
            {(["risk", "alpha", "cases"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSort(v)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  sort === v
                    ? "bg-gray-700 text-gray-300"
                    : "text-gray-600 hover:text-gray-400"
                }`}
              >
                {v === "risk" ? c.sortRisk : v === "alpha" ? c.sortAlpha : c.sortCases}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={c.filter}
            className="text-xs px-2 py-1 rounded-lg border border-gray-800 bg-gray-900 text-gray-400 placeholder-gray-600 focus:outline-none focus:border-gray-600 w-24"
          />
          <button onClick={load} disabled={loading} className="p-1 text-gray-600 hover:text-gray-300 disabled:opacity-40 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-600 italic text-center py-8">{c.empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-800/50">
          {visible.map((country) => (
            <div key={country.country_en} className="bg-gray-900/60 p-3 space-y-1.5 hover:bg-gray-800/40 transition-colors">
              {/* Country name + PHEIC */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-semibold text-white leading-tight">{country.country_en}</p>
                {country.has_pheic && (
                  <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/50 border border-purple-700/50 text-purple-300">
                    🚨 {c.pheic}
                  </span>
                )}
              </div>

              {/* Risk + counts + THI */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${RISK_BADGE[country.max_risk] ?? RISK_BADGE.low}`}>
                  {c.risk[country.max_risk] ?? country.max_risk.toUpperCase()}
                </span>
                <span className="text-[10px] text-gray-400 tabular-nums">{country.outbreak_count} {c.outbreaks}</span>
                {country.total_cases > 0 && (
                  <span className="text-[10px] text-gray-500 tabular-nums">{country.total_cases.toLocaleString(locale === "ar" ? "ar-SA" : locale)} {c.cases}</span>
                )}
                <THIBadge score={computeTHI(country)} />
              </div>

              {/* Diseases */}
              <p className="text-[10px] text-gray-600 leading-snug truncate" title={country.diseases.join(", ")}>
                {country.diseases.slice(0, 3).join(", ")}{country.diseases.length > 3 ? ` +${country.diseases.length - 3}` : ""}
              </p>

              {/* Last update */}
              {country.last_updated && (
                <p className="text-[9px] text-gray-700">
                  {c.lastUpdate} {timeSince(country.last_updated, locale)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
