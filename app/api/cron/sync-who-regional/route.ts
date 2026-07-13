// Endemic / high-burden disease surveillance not systematically covered by WHO DON.
// 120 disease × country targets; 31 have a working fetcher (see below). The rest
// have none and fall through to queryReliefWeb(), which is HARD-DISABLED for legal
// reasons (reliefWebOk = false) — those entries are retained only as a record of
// desired coverage, not as working code.
// Fetchers:
//   - Malaria / Measles / Polio / Yellow Fever / Leishmaniasis / Diphtheria: WHO GHO
//     OData API (ghoapi.azureedge.net)
//   - Dengue (all countries except Brazil, Philippines): WHO Global Dengue
//     Surveillance API (xmart-api-public.who.int) — see fetchDengueGlobalSurveillance
//   - Dengue/Brazil: MANUAL, see note below — never auto-fetch
//   - Dengue/Philippines: no fetcher yet, absent from the WHO dataset above
// Schedule: 0 8 * * 2,5  (Tuesday and Friday 08:00 UTC)
// maxDuration: 300s (Vercel Pro cron; ~120 targets, many skipped early on no-fetcher)
//
// Never overwrites rows whose source URL is from who.int/emergencies
// (those are owned by the WHO DON daily sync).

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // ~100 targets × ~2s each; Vercel Pro allows 300s for crons

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const RELIEFWEB_APPNAME = clean(process.env.RELIEFWEB_APPNAME) || "healthwatch-global";
const RELIEFWEB_BASE    = "https://api.reliefweb.int/v2/reports";

// ── Helpers ───────────────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Shared result type ────────────────────────────────────────────────────────

interface Found {
  cases:       number;
  deaths:      number;
  date:        string;
  source:      string;
  description: string;
}

// ── Brazil Dengue — MANUAL, do NOT auto-fetch ────────────────────────────────
// The former InfoDengue per-city fetcher was removed 2026-07-08. It summed only 12
// municipalities via /api/alertcity and wrote the result as Brazil's NATIONAL total —
// a structural undercount (178k vs the official ~407k) that silently overwrote the
// verified figure on every daily run. The authoritative national count is the
// Ministério da Saúde "Painel de Arboviroses" (gov.br), a JS/PowerBI dashboard that
// no fetcher can read. Brazil dengue is therefore maintained MANUALLY from that
// dashboard and must never be auto-overwritten. There is intentionally no Brazil
// entry in TARGETS below — see project_scripts_cleanup_and_dengue_malaria_fixes_2026_07_07.

// ── WHO GHO malaria fetcher ───────────────────────────────────────────────────
// WHO Global Health Observatory OData API — public, no auth required.
// Indicator MALARIA_EST_CASES: WHO-estimated annual malaria cases by country.
// Data typically lags 1–2 years (e.g. 2024 data published mid-2025).

const GHO_MALARIA_ISO3: Record<string, string> = {
  "Nigeria":                          "NGA",
  "Uganda":                           "UGA",
  "Ghana":                            "GHA",
  "Tanzania":                         "TZA",
  "Kenya":                            "KEN",
  "Ethiopia":                         "ETH",
  "Mozambique":                       "MOZ",
  "Democratic Republic of the Congo": "COD",
  "Burkina Faso":                     "BFA",
  "India":                            "IND",
};

function fetchMalariaGHO(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = GHO_MALARIA_ISO3[country_en];
    if (!iso3) return null;
    try {
      const ua = "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)";
      const casesUrl  = `https://ghoapi.azureedge.net/api/MALARIA_EST_CASES?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
      const deathsUrl = `https://ghoapi.azureedge.net/api/MALARIA_EST_DEATHS?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
      const [casesRes, deathsRes] = await Promise.all([
        fetch(casesUrl,  { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(10_000) }),
        fetch(deathsUrl, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(10_000) }),
      ]);
      if (!casesRes.ok) return null;
      type GHORec = { SpatialDim: string; TimeDim: number; NumericValue: number | null };
      const casesJson = await casesRes.json() as { value: GHORec[] };
      const rec = casesJson.value?.[0];
      if (!rec?.NumericValue) return null;
      const cases = Math.round(rec.NumericValue);
      const year  = rec.TimeDim;

      let deaths = 0;
      if (deathsRes.ok) {
        const deathsJson = await deathsRes.json() as { value: GHORec[] };
        // Use deaths from same year as cases when available
        const deathRec = deathsJson.value?.find(r => r.TimeDim === year) ?? deathsJson.value?.[0];
        if (deathRec?.NumericValue) deaths = Math.round(deathRec.NumericValue);
      }

      const date = `${year}-01-01`;
      const src  = "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/estimated-number-of-malaria-cases";
      const deathsPart = deaths > 0 ? ` and an estimated ${deaths.toLocaleString("en")} deaths` : "";
      return {
        cases,
        deaths,
        date,
        source: src,
        description: `Malaria in ${country_en} — WHO estimated ${cases.toLocaleString("en")} cases${deathsPart} in ${year}. Source: WHO Global Health Observatory (GHO / World Malaria Report ${year}).`,
      };
    } catch {
      return null;
    }
  };
}

// ── WHO GHO measles fetcher ───────────────────────────────────────────────────
// Indicator WHS3_62: WHO-reported annual measles cases by country.
// Data typically lags 1–2 years (e.g. 2024 data available mid-2025).

const GHO_MEASLES_ISO3: Record<string, string> = {
  "Democratic Republic of the Congo": "COD",
  "Ethiopia":                         "ETH",
  "Nigeria":                          "NGA",
  "Yemen":                            "YEM",
  "Somalia":                          "SOM",
  "Pakistan":                         "PAK",
  "Ukraine":                          "UKR",
  "South Sudan":                      "SSD",
  "Myanmar":                          "MMR",
  "Philippines":                      "PHL",
  "Romania":                          "ROU",
  "France":                           "FRA",
  "Italy":                            "ITA",
};

function fetchMeaslesGHO(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = GHO_MEASLES_ISO3[country_en];
    if (!iso3) return null;
    try {
      const url = `https://ghoapi.azureedge.net/api/WHS3_62?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      type GHORec = { SpatialDim: string; TimeDim: number; NumericValue: number | null };
      const json = await res.json() as { value: GHORec[] };
      const rec  = json.value?.[0];
      if (!rec?.NumericValue) return null;
      const cases = Math.round(rec.NumericValue);
      const year  = rec.TimeDim;
      return {
        cases,
        deaths: 0,
        date:   `${year}-01-01`,
        source: "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/incidence-of-measles",
        description: `Measles in ${country_en} — WHO reported ${cases.toLocaleString("en")} confirmed cases in ${year}. Source: WHO Global Health Observatory (GHO).`,
      };
    } catch {
      return null;
    }
  };
}

// ── WHO GHO wild poliovirus fetcher ──────────────────────────────────────────
// Indicator VACCINEPREVENTABLE_WILDPOLIO: cases of poliovirus by WPV type.
// Only PAK and AFG still have endemic WPV transmission; other targets use ReliefWeb.

const GHO_WPV_ISO3: Record<string, string> = {
  "Pakistan":    "PAK",
  "Afghanistan": "AFG",
};

function fetchPolioGHO(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = GHO_WPV_ISO3[country_en];
    if (!iso3) return null;
    try {
      const url = `https://ghoapi.azureedge.net/api/VACCINEPREVENTABLE_WILDPOLIO?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      type GHORec = { SpatialDim: string; TimeDim: number; NumericValue: number | null };
      const json = await res.json() as { value: GHORec[] };
      const rec  = json.value?.[0];
      if (!rec?.NumericValue) return null;
      const cases = Math.round(rec.NumericValue);
      const year  = rec.TimeDim;
      return {
        cases,
        deaths: 0,
        date:   `${year}-01-01`,
        source: "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/number-of-reported-cases-of-poliomyelitis-by-wild-poliovirus-(wpv)",
        description: `Poliomyelitis (wild poliovirus) in ${country_en} — ${cases} confirmed WPV case${cases > 1 ? "s" : ""} in ${year}. Source: WHO Global Health Observatory / GPEI.`,
      };
    } catch {
      return null;
    }
  };
}

// ── WHO GHO yellow fever fetcher ─────────────────────────────────────────────
// Indicator WHS3_50: WHO-reported annual yellow fever cases by country.

const GHO_YF_ISO3: Record<string, string> = {
  "Nigeria":  "NGA",
  "Cameroon": "CMR",
};

function fetchYellowFeverGHO(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = GHO_YF_ISO3[country_en];
    if (!iso3) return null;
    try {
      const url = `https://ghoapi.azureedge.net/api/WHS3_50?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      type GHORec = { SpatialDim: string; TimeDim: number; NumericValue: number | null };
      const json = await res.json() as { value: GHORec[] };
      const rec  = json.value?.[0];
      if (!rec?.NumericValue) return null;
      const cases = Math.round(rec.NumericValue);
      const year  = rec.TimeDim;
      return {
        cases,
        deaths: 0,
        date:   `${year}-01-01`,
        source: "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/yellow-fever-number-of-reported-cases",
        description: `Yellow Fever in ${country_en} — ${cases} confirmed case${cases > 1 ? "s" : ""} reported in ${year}. Source: WHO Global Health Observatory (GHO).`,
      };
    } catch {
      return null;
    }
  };
}

// ── WHO GHO visceral leishmaniasis fetcher ────────────────────────────────────
// Indicator NTD_LEISHVNUM: WHO-reported annual visceral leishmaniasis cases.
// 2024 data available for Sudan (4,808) and Ethiopia (1,434).

const GHO_LEISH_ISO3: Record<string, string> = {
  "Sudan":    "SDN",
  "Ethiopia": "ETH",
};

function fetchLeishmaniasisGHO(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = GHO_LEISH_ISO3[country_en];
    if (!iso3) return null;
    try {
      const url = `https://ghoapi.azureedge.net/api/NTD_LEISHVNUM?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      type GHORec = { SpatialDim: string; TimeDim: number; NumericValue: number | null };
      const json = await res.json() as { value: GHORec[] };
      const rec  = json.value?.[0];
      if (!rec?.NumericValue) return null;
      const cases = Math.round(rec.NumericValue);
      const year  = rec.TimeDim;
      return {
        cases,
        deaths: 0,
        date:   `${year}-01-01`,
        source: "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/number-of-cases-of-visceral-leishmaniasis-reported",
        description: `Leishmaniasis (visceral) in ${country_en} — ${cases.toLocaleString("en")} cases reported in ${year}. Source: WHO Global Health Observatory (GHO / NTD programme).`,
      };
    } catch {
      return null;
    }
  };
}

// ── WHO GHO diphtheria fetcher ────────────────────────────────────────────────
// Indicator WHS3_41: WHO-reported annual diphtheria cases by country.
// 2024 data: Haiti 75 cases, Yemen 190 cases.

const GHO_DIPHTHERIA_ISO3: Record<string, string> = {
  "Haiti": "HTI",
  "Yemen": "YEM",
};

function fetchDiphtheriaGHO(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = GHO_DIPHTHERIA_ISO3[country_en];
    if (!iso3) return null;
    try {
      const url = `https://ghoapi.azureedge.net/api/WHS3_41?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      type GHORec = { SpatialDim: string; TimeDim: number; NumericValue: number | null };
      const json = await res.json() as { value: GHORec[] };
      const rec  = json.value?.[0];
      if (!rec?.NumericValue) return null;
      const cases = Math.round(rec.NumericValue);
      const year  = rec.TimeDim;
      return {
        cases,
        deaths: 0,
        date:   `${year}-01-01`,
        source: "https://www.who.int/data/gho/data/indicators/indicator-details/GHO/diphtheria-number-of-reported-cases",
        description: `Diphtheria in ${country_en} — ${cases} confirmed case${cases > 1 ? "s" : ""} reported in ${year}. Source: WHO Global Health Observatory (GHO).`,
      };
    } catch {
      return null;
    }
  };
}

// ── WHO Global Dengue Surveillance fetcher ────────────────────────────────────
// WHO's public xmart API (ARBOV/V_DENGUE_GLOBAL_VALIDATED_PUBLIC) — same OData
// family as GHO, documented with a public curl example on WHO's own "Global
// dengue surveillance" dashboard (worldhealthorg.shinyapps.io/dengue_global).
// Reports weekly/monthly case counts per country; this sums every non-null
// period within the current calendar year into a cumulative year-to-date total
// (cross-checked against the WHO SEARO Epidemiological Bulletin: summing India's
// Jan-Apr 2026 monthly rows gives 12,566, matching the bulletin's stated figure
// for the same period exactly).
// Philippines has no rows in this dataset at all; Brazil is deliberately excluded
// (MANUAL, see note above) — neither gets an entry in DENGUE_ISO3.

const DENGUE_ISO3: Record<string, string> = {
  "India":      "IND",
  "Bangladesh": "BGD",
  "Colombia":   "COL",
  "Indonesia":  "IDN",
  "Vietnam":    "VNM",
  "Thailand":   "THA",
  "Malaysia":   "MYS",
  "Peru":       "PER",
  "Myanmar":    "MMR",
  "Argentina":  "ARG",
  "Ecuador":    "ECU",
  "Bolivia":    "BOL",
  "Paraguay":   "PRY",
  "Venezuela":  "VEN",
  "Cambodia":   "KHM",
  "Laos":       "LAO",
  "Sri Lanka":  "LKA",
  "Mexico":     "MEX",
  "Cuba":       "CUB",
  "Haiti":      "HTI",
  "Nicaragua":  "NIC",
  "Guatemala":  "GTM",
};

function fetchDengueGlobalSurveillance(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = DENGUE_ISO3[country_en];
    if (!iso3) return null;

    const ua   = "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)";
    const base = "https://xmart-api-public.who.int/ARBOV/V_DENGUE_GLOBAL_VALIDATED_PUBLIC";
    type Rec = { START_DATE: string; CASES: number | null; DEATHS: number | null; YEAR?: number };

    async function sumYear(year: number): Promise<Found | null> {
      const url =
        `${base}?%24filter=ISO3%20eq%20'${iso3}'%20and%20YEAR%20eq%20${year}%20and%20CASES%20ne%20null` +
        `&%24orderby=START_DATE%20asc&%24top=100&excludeSysColumns=0`;
      const res = await fetch(url, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const json = await res.json() as { value: Rec[] };
      const rows = json.value ?? [];
      if (rows.length === 0) return null;

      let cases = 0, deaths = 0, latestDate = "";
      for (const r of rows) {
        cases  += r.CASES  ?? 0;
        deaths += r.DEATHS ?? 0;
        if (r.START_DATE > latestDate) latestDate = r.START_DATE;
      }
      if (cases <= 0 || !latestDate) return null;

      return {
        cases,
        deaths,
        date:   latestDate,
        source: "https://worldhealthorg.shinyapps.io/dengue_global/",
        description: `Dengue in ${country_en} — WHO reported ${cases.toLocaleString("en")} cumulative case${cases > 1 ? "s" : ""}${deaths > 0 ? ` and ${deaths.toLocaleString("en")} death${deaths > 1 ? "s" : ""}` : ""} in ${year} as of the period starting ${latestDate}. Source: WHO Global Dengue Surveillance.`,
      };
    }

    try {
      const current = await sumYear(new Date().getFullYear());
      if (current) return current;

      // No data yet for the current year — reporting lag into this WHO dataset
      // varies a lot by country (some are over a year behind). Fall back to the
      // most recent year with any data at all, so the row still reflects a real
      // (if dated) WHO figure instead of silently reporting nothing; the resulting
      // old `date` correctly surfaces via data-quality's staleness check rather
      // than hiding the gap.
      const latestUrl =
        `${base}?%24filter=ISO3%20eq%20'${iso3}'%20and%20CASES%20ne%20null` +
        `&%24orderby=START_DATE%20desc&%24top=1&excludeSysColumns=0`;
      const latestRes = await fetch(latestUrl, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(10_000) });
      if (!latestRes.ok) return null;
      const latestJson = await latestRes.json() as { value: Rec[] };
      const lastYear = latestJson.value?.[0]?.YEAR;
      return lastYear ? await sumYear(lastYear) : null;
    } catch {
      return null;
    }
  };
}

// ── WHO Global Mpox Surveillance fetcher ──────────────────────────────────────
// Same xmart platform as Dengue, different mart: MPX/V_MPX_VALIDATED_DAILY (not
// "MPOX" — confirmed 404; also note a wrong view name in this mart returns
// HTTP 200 with an error message body, e.g. V_MPX_GLOBAL_PUBLIC — a status-code
// check alone would silently accept a broken URL, so this checks the JSON shape).
// Unlike dengue, TOTAL_CONF_CASES/TOTAL_CONF_DEATHS are already a cumulative
// snapshot as of DATE — no summing across periods needed, just take the latest.

const MPOX_ISO3: Record<string, string> = {
  "Rwanda":  "RWA",
  "Uganda":  "UGA",
  "Burundi": "BDI",
  "Kenya":   "KEN",
};

function fetchMpoxGlobalSurveillance(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = MPOX_ISO3[country_en];
    if (!iso3) return null;
    try {
      const url =
        `https://xmart-api-public.who.int/MPX/V_MPX_VALIDATED_DAILY` +
        `?%24filter=ISO3%20eq%20'${iso3}'&%24orderby=DATE%20desc&%24top=1&excludeSysColumns=0`;
      const res = await fetch(url, {
        headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      type Rec = { DATE: string; TOTAL_CONF_CASES: number | null; TOTAL_PROB_CASES: number | null; TOTAL_CONF_DEATHS: number | null };
      const json = await res.json() as { value?: Rec[] };
      const rec = json.value?.[0];
      if (!rec?.DATE) return null;

      const cases  = (rec.TOTAL_CONF_CASES ?? 0) + (rec.TOTAL_PROB_CASES ?? 0);
      const deaths = rec.TOTAL_CONF_DEATHS ?? 0;
      if (cases <= 0) return null;

      return {
        cases,
        deaths,
        date:   rec.DATE,
        source: "https://worldhealthorg.shinyapps.io/mpx_global/",
        description: `Mpox in ${country_en} — WHO reported ${cases.toLocaleString("en")} cumulative case${cases > 1 ? "s" : ""}${deaths > 0 ? ` and ${deaths.toLocaleString("en")} death${deaths > 1 ? "s" : ""}` : ""} as of ${rec.DATE}. Source: WHO Global Mpox Surveillance.`,
      };
    } catch {
      return null;
    }
  };
}

// ── WHO Global Cholera Surveillance fetcher ───────────────────────────────────
// WHO's own weekly cholera feed, hosted on ArcGIS Online (services.arcgis.com),
// not the xmart platform used for Dengue/Mpox — a different public REST/JSON API,
// no auth, confirmed live 2026 data (item description: "Weekly cholera data for
// 2026. © World Health Organization 2026.", owner World Health Organization).
// Rows are WEEKLY new cases (not cumulative), so — same as Dengue — this sums
// every week within the current year into a year-to-date total; cross-checked
// against WHO's own monthly Cholera Epidemiological Update PDF (Afghanistan
// Jan-May 2026: summing this feed's weekly rows gives ~46,021 vs the PDF's
// stated 43,292 — same ballpark, the small gap is expected page-to-feed timing
// and revision lag, not a parsing error).
// Countries with no current outbreak (Cameroon, Syria, Lebanon, Nepal) return
// null today and need no further code change — they'll start populating
// automatically the moment WHO's feed has real data for them.

const CHOLERA_ISO3: Record<string, string> = {
  "Somalia":                       "SOM",
  "Zimbabwe":                      "ZWE",
  "Afghanistan":                   "AFG",
  "Mozambique":                    "MOZ",
  "Kenya":                         "KEN",
  "Cameroon":                      "CMR",
  "Syria":                         "SYR",
  "Malawi":                        "MWI",
  "Lebanon":                       "LBN",
  "Central African Republic":      "CAF",
  "Nepal":                         "NPL",
  "Nigeria":                       "NGA",
  "Tanzania":                      "TZA",
  "Zambia":                        "ZMB",
};

function fetchCholeraGlobalSurveillance(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = CHOLERA_ISO3[country_en];
    if (!iso3) return null;

    const ua   = "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)";
    const base = "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/cholera_adm0_week_view/FeatureServer/0/query";
    type Feature = { attributes: { date_wk: number; cases: number | null; deaths: number | null } };

    async function sumYear(year: number): Promise<Found | null> {
      // ArcGIS's SQL dialect needs a TIMESTAMP literal for date comparisons —
      // a raw epoch-ms integer (what the field's own JSON values look like)
      // silently returns HTTP 200 with a JSON {error:...} body, not a 4xx.
      const where = `iso_3_code='${iso3}' AND date_wk>=TIMESTAMP '${year}-01-01 00:00:00' AND date_wk<TIMESTAMP '${year + 1}-01-01 00:00:00'`;
      const url   = `${base}?where=${encodeURIComponent(where)}&outFields=date_wk,cases,deaths&orderByFields=date_wk+ASC&resultRecordCount=100&f=json`;
      const res = await fetch(url, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const json = await res.json() as { features?: Feature[]; error?: unknown };
      const features = json.features ?? [];
      if (json.error || features.length === 0) return null;

      let cases = 0, deaths = 0, latestMs = 0;
      for (const f of features) {
        cases  += f.attributes.cases  ?? 0;
        deaths += f.attributes.deaths ?? 0;
        if (f.attributes.date_wk > latestMs) latestMs = f.attributes.date_wk;
      }
      if (cases <= 0 || !latestMs) return null;
      const date = new Date(latestMs).toISOString().substring(0, 10);

      return {
        cases,
        deaths,
        date,
        source: "https://www.who.int/emergencies/situations/multi-country-outbreak-of-cholera",
        description: `Cholera in ${country_en} — WHO reported ${cases.toLocaleString("en")} cumulative case${cases > 1 ? "s" : ""}${deaths > 0 ? ` and ${deaths.toLocaleString("en")} death${deaths > 1 ? "s" : ""}` : ""} in ${year} as of the week starting ${date}. Source: WHO Global Cholera Surveillance.`,
      };
    }

    try {
      const current = await sumYear(new Date().getFullYear());
      if (current) return current;

      // No 2026 activity yet for this country (e.g. an outbreak that ended, or
      // hasn't started) — same reasoning as the Dengue fetcher's fallback: a
      // dated real figure from the most recent year with any data is more useful
      // than silence, and correctly surfaces as stale via data-quality rather
      // than hiding the gap.
      const probeUrl = `${base}?where=${encodeURIComponent(`iso_3_code='${iso3}'`)}&outFields=date_wk&orderByFields=date_wk+DESC&resultRecordCount=1&f=json`;
      const probeRes = await fetch(probeUrl, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(10_000) });
      if (!probeRes.ok) return null;
      const probeJson = await probeRes.json() as { features?: Feature[] };
      const lastMs = probeJson.features?.[0]?.attributes.date_wk;
      return lastMs ? await sumYear(new Date(lastMs).getUTCFullYear()) : null;
    } catch {
      return null;
    }
  };
}

// ── WHO AFRO Meningitis Bulletin fetcher ──────────────────────────────────────
// WHO AFRO's weekly meningitis-belt bulletin has NO reliable "latest edition"
// index: editions are published under inconsistent CDN folder paths (at least
// 3 different ones confirmed within 2026 alone), so there's no way to construct
// next week's URL from a fixed pattern the way the other fetchers above can.
// This searches a bounded window of recent ISO weeks across the known folder
// patterns, and only trusts a parsed table if its country rows sum to EXACTLY
// the bulletin's own printed regional Total — this is the real safety net (not
// the HTTP status), since a URL guess that happens to 200 but serves an
// unrelated or differently-shaped document would just fail the checksum and
// get skipped rather than silently feeding wrong numbers into `outbreaks`.
// Table layout: bilingual FR/EN, columns are Country | Cases | Deaths | CFR% |
// Districts-in-Alert | Districts-in-Epidemic | Weeks-reported | Completeness%.
// A country's name and its numbers sometimes print on the same PDF text line,
// sometimes 1-3 points of Y apart (WHO's own layout, not a scan artifact) —
// recovered by clustering text items within a small Y tolerance rather than
// assuming one fixed label/data offset.

const MENINGITIS_FOLDERS = [
  "default-source/documents/emergencies/health-topics---meningitis",
  "default-source/_sage-{year}",
  "default-source/documents/health-topics/meningitis",
];

const MENINGITIS_LABELS: Record<string, string> = {
  "Nigeria":      "Nigeria",
  "Tchad":        "Chad",
  "Burkina Faso": "Burkina Faso",
  "South Sudan":  "South Sudan",
};

function isoWeekEndDate(year: number, week: number): string {
  const jan4      = new Date(Date.UTC(year, 0, 4));
  const jan4Day   = (jan4.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
  const week1Mon  = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - jan4Day);
  const sunday = new Date(week1Mon);
  sunday.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7 + 6);
  return sunday.toISOString().substring(0, 10);
}

function currentIsoWeek(): { year: number; week: number } {
  const now = new Date();
  const d   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + (firstThursday.getUTCDay() + 6) % 7) / 7);
  return { year: d.getUTCFullYear(), week };
}

interface MeningitisTextItem { str: string; x: number; y: number }
type PdfPageLike = {
  pageIndex: number;
  getTextContent: (opts: object) => Promise<{ items: Array<{ str: string; transform: number[] }> }>;
};

async function extractMeningitisTable(buf: Buffer): Promise<Map<string, { cases: number; deaths: number }> | null> {
  const pages: MeningitisTextItem[][] = [];
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
    (buf: Buffer, opts?: {
      max?: number;
      pagerender?: (pageData: PdfPageLike) => Promise<string>;
    }) => Promise<{ text: string }>;

  await pdfParse(buf, {
    max: 25,
    pagerender: async (pageData: PdfPageLike) => {
      const tc = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
      pages[pageData.pageIndex] = tc.items.map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] }));
      return "";
    },
  });

  // "CountryName  1449  61  4.2  4  0  01-25  93.3" or "CountryName  -  -  -  -  -  -  -"
  // All 8 columns (through the week-range field) are required — the bulletin
  // ALSO contains a separate weekly-only table with just 6 columns and no
  // week-range field, which has its own internally-consistent Total and would
  // otherwise checksum-verify just as "successfully" as the real cumulative
  // table, silently returning the wrong (much smaller) numbers.
  const rowRe = /^([A-Za-zÀ-ÿ'’. ]+?)\s+(-|\d[\d,]*)\s+(-|\d[\d,]*)\s+(-|[\d.]+)\s+(-|\d+)\s+(-|\d+)\s+(-|\d{1,2}-\d{1,2})\s+(-|[\d.]+)\s*$/;

  for (const items of pages) {
    if (!items || items.length === 0) continue;

    const sorted = [...items].sort((a, b) => b.y - a.y);
    const clusters: MeningitisTextItem[][] = [];
    for (const it of sorted) {
      const last = clusters[clusters.length - 1];
      // Compare to the most recently added item, not the cluster's first item —
      // a country's label and its numbers are sometimes bridged by an empty
      // blank-line text item in between; anchoring to the cluster's first Y
      // would let that blank "use up" the tolerance and wrongly split the
      // label from its own data row.
      if (last && Math.abs(last[last.length - 1].y - it.y) <= 4) last.push(it);
      else clusters.push([it]);
    }

    const results = new Map<string, { cases: number; deaths: number }>();
    let total: { cases: number; deaths: number } | null = null;

    for (const cluster of clusters) {
      const text = cluster.sort((a, b) => a.x - b.x).map((i) => i.str).join("").replace(/\s+/g, " ").trim();
      const m = rowRe.exec(text);
      if (!m) continue;
      const country = m[1].trim();
      if (m[2] === "-" || m[3] === "-") continue;
      const cases  = parseInt(m[2].replace(/,/g, ""), 10);
      const deaths = parseInt(m[3].replace(/,/g, ""), 10);
      if (isNaN(cases) || isNaN(deaths)) continue;
      if (/^total$/i.test(country)) { total = { cases, deaths }; continue; }
      results.set(country, { cases, deaths });
    }

    if (!total || results.size === 0) continue;
    let sumCases = 0, sumDeaths = 0;
    for (const r of results.values()) { sumCases += r.cases; sumDeaths += r.deaths; }
    if (sumCases === total.cases && sumDeaths === total.deaths) return results; // checksum passed — this is the table
  }
  return null;
}

function fetchMeningitisAFRO(country_en: string): () => Promise<Found | null> {
  return async () => {
    const label = Object.entries(MENINGITIS_LABELS).find(([, en]) => en === country_en)?.[0];
    if (!label) return null;

    const ua = "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)";
    const { year: curYear, week: curWeek } = currentIsoWeek();
    const LOOKBACK = 6;

    const candidates: Array<{ year: number; week: number }> = [];
    for (let w = curWeek; w > Math.max(0, curWeek - LOOKBACK); w--) candidates.push({ year: curYear, week: w });
    // Meningitis-belt season spans Nov-Jun across the year boundary — early in
    // a new year, the latest real edition may still be numbered in the 40s-50s
    // of the previous year.
    if (curWeek <= 8) for (let w = 53; w >= 44; w--) candidates.push({ year: curYear - 1, week: w });

    for (const { year, week } of candidates) {
      const wk = String(week).padStart(2, "0");
      for (const folderTpl of MENINGITIS_FOLDERS) {
        const folder = folderTpl.replace("{year}", String(year));
        const url = `https://cdn.who.int/media/docs/${folder}/meningitis_bulletin_${year}_week_${wk}.pdf`;
        try {
          const res = await fetch(url, { headers: { "User-Agent": ua }, signal: AbortSignal.timeout(15_000) });
          if (!res.ok) continue;
          const table = await extractMeningitisTable(Buffer.from(await res.arrayBuffer()));
          if (!table) continue;
          const row = table.get(label);
          if (!row || row.cases <= 0) return null; // verified table, but no data for this country this edition
          return {
            cases:  row.cases,
            deaths: row.deaths,
            date:   isoWeekEndDate(year, week),
            source: url,
            description: `Meningitis in ${country_en} — WHO AFRO reported ${row.cases.toLocaleString("en")} cumulative case${row.cases > 1 ? "s" : ""}${row.deaths > 0 ? ` and ${row.deaths.toLocaleString("en")} death${row.deaths > 1 ? "s" : ""}` : ""}, weeks 1-${week} of ${year}. Source: WHO AFRO Meningitis Weekly Bulletin (cross-checked against the bulletin's own printed regional total).`,
          };
        } catch {
          continue;
        }
      }
    }
    return null;
  };
}

// ── ReliefWeb query ───────────────────────────────────────────────────────────

interface Target {
  disease_en: string;                        // must match a pattern in normalizeDisease()
  country_en: string;                        // must match findCountry() key
  minCases:   number;                        // minimum to avoid low-count false positives
  fetcher?:   () => Promise<Found | null>;   // custom data source (overrides ReliefWeb)
}

async function queryReliefWeb(target: Target): Promise<Found | null> {
  const year = new Date().getFullYear();
  const url  = new URL(RELIEFWEB_BASE);
  url.searchParams.set("appname", RELIEFWEB_APPNAME);
  url.searchParams.set("query[value]",
    `${target.disease_en} ${target.country_en} cases situation report ${year}`);
  // append keeps multiple values for the same key (unlike set which overwrites)
  url.searchParams.append("fields[include][]", "title");
  url.searchParams.append("fields[include][]", "date");
  url.searchParams.append("fields[include][]", "url");
  url.searchParams.append("fields[include][]", "body");
  url.searchParams.set("sort[]", "date:desc");
  url.searchParams.set("limit", "3");

  type RWReport = {
    fields?: {
      title?: string;
      date?:  { created?: string };
      url?:   string;
      body?:  string;
    };
  };

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
        "Accept":     "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 403) {
      console.error(`[regional] ReliefWeb 403 — appname "${RELIEFWEB_APPNAME}" not approved. Register at apidoc.reliefweb.int`);
      return null;
    }
    if (!res.ok) return null;

    const json = await res.json() as { data?: RWReport[] };

    const diseaseToken  = target.disease_en.toLowerCase().split(/\s+/)[0];
    const countryTokens = target.country_en.toLowerCase().split(/\s+/).slice(0, 2);

    for (const item of json.data ?? []) {
      const f = item.fields;
      if (!f?.body) continue;

      const text       = htmlToText(f.body);
      const lower      = text.toLowerCase();
      const titleLower = (f.title ?? "").toLowerCase();

      if (!lower.includes(diseaseToken)) continue;
      const mentionsCountry = countryTokens.some(
        (t) => lower.includes(t) || titleLower.includes(t)
      );
      if (!mentionsCountry) continue;

      const { cases, deaths } = extractNumbers(text);
      if (cases < target.minCases) continue;

      const date        = f.date?.created?.substring(0, 10) ?? new Date().toISOString().substring(0, 10);
      const source      = f.url ?? url.toString();
      const description = text.substring(0, 500).trim();

      return { cases, deaths, date, source, description };
    }
  } catch (e) {
    console.warn(`[regional] ReliefWeb ${target.disease_en}/${target.country_en}:`, errorMessage(e));
  }

  return null;
}

// ── Target list ───────────────────────────────────────────────────────────────

const TARGETS: Target[] = [
  // ── Dengue — Brazil is maintained MANUALLY (MoH Painel de Arboviroses, not
  //    machine-readable). Do NOT add a Brazil auto-fetcher here (see note above).
  //    Others via ReliefWeb.
  { disease_en: "Dengue", country_en: "India",      minCases: 100, fetcher: fetchDengueGlobalSurveillance("India") },
  { disease_en: "Dengue", country_en: "Bangladesh", minCases: 100, fetcher: fetchDengueGlobalSurveillance("Bangladesh") },
  { disease_en: "Dengue", country_en: "Colombia",   minCases: 100, fetcher: fetchDengueGlobalSurveillance("Colombia") },
  { disease_en: "Dengue", country_en: "Indonesia",  minCases: 100, fetcher: fetchDengueGlobalSurveillance("Indonesia") },
  { disease_en: "Dengue", country_en: "Vietnam",    minCases: 100, fetcher: fetchDengueGlobalSurveillance("Vietnam") },
  { disease_en: "Dengue", country_en: "Thailand",   minCases: 100, fetcher: fetchDengueGlobalSurveillance("Thailand") },
  { disease_en: "Dengue", country_en: "Malaysia",   minCases: 100, fetcher: fetchDengueGlobalSurveillance("Malaysia") },
  { disease_en: "Dengue", country_en: "Peru",       minCases: 100, fetcher: fetchDengueGlobalSurveillance("Peru") },
  // ── Cholera — endemic in fragile/conflict states ──────────────────────────────
  { disease_en: "Cholera",       country_en: "Democratic Republic of the Congo", minCases: 100    },
  { disease_en: "Cholera",       country_en: "Haiti",                            minCases: 100    },
  { disease_en: "Cholera", country_en: "Somalia", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Somalia") },
  { disease_en: "Cholera",       country_en: "Sudan",                            minCases: 100    },
  { disease_en: "Cholera",       country_en: "Yemen",                            minCases: 100    },
  { disease_en: "Cholera", country_en: "Zimbabwe",    minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Zimbabwe") },
  { disease_en: "Cholera", country_en: "Afghanistan", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Afghanistan") },
  { disease_en: "Cholera", country_en: "Mozambique",  minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Mozambique") },
  { disease_en: "Cholera", country_en: "Kenya",       minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Kenya") },
  { disease_en: "Cholera", country_en: "Cameroon",    minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Cameroon") },
  { disease_en: "Cholera", country_en: "Syria",       minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Syria") },
  { disease_en: "Cholera", country_en: "Malawi",      minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Malawi") },
  // ── Measles — high-burden countries not consistently in WHO DON ───────────────
  { disease_en: "Measles", country_en: "Democratic Republic of the Congo", minCases: 1_000, fetcher: fetchMeaslesGHO("Democratic Republic of the Congo") },
  { disease_en: "Measles", country_en: "Ethiopia",                         minCases:   500, fetcher: fetchMeaslesGHO("Ethiopia")  },
  { disease_en: "Measles", country_en: "Nigeria",                          minCases:   500, fetcher: fetchMeaslesGHO("Nigeria")   },
  { disease_en: "Measles", country_en: "Yemen",                            minCases:   100, fetcher: fetchMeaslesGHO("Yemen")     },
  { disease_en: "Measles", country_en: "Somalia",                          minCases:   100, fetcher: fetchMeaslesGHO("Somalia")   },
  { disease_en: "Measles", country_en: "Pakistan",                         minCases:   100, fetcher: fetchMeaslesGHO("Pakistan")  },
  { disease_en: "Measles", country_en: "Ukraine",                          minCases:    50, fetcher: fetchMeaslesGHO("Ukraine")   },
  // ── Yellow Fever — any confirmed case is epidemiologically significant ─────────
  { disease_en: "Yellow Fever", country_en: "Nigeria",  minCases: 1, fetcher: fetchYellowFeverGHO("Nigeria")  },
  { disease_en: "Yellow Fever", country_en: "Cameroon", minCases: 1, fetcher: fetchYellowFeverGHO("Cameroon") },
  // ── Meningitis — meningitis belt extended coverage ────────────────────────────
  { disease_en: "Meningitis",    country_en: "Niger",                            minCases:  10    },
  { disease_en: "Meningitis", country_en: "Nigeria", minCases: 10, fetcher: fetchMeningitisAFRO("Nigeria") },
  { disease_en: "Meningitis", country_en: "Chad", minCases: 10, fetcher: fetchMeningitisAFRO("Chad") },
  { disease_en: "Meningitis",    country_en: "Ethiopia",                         minCases:  10    },
  // ── MERS-CoV — sporadic but ongoing; any case is significant ──────────────────
  { disease_en: "MERS-CoV",     country_en: "Saudi Arabia",                      minCases:   1    },
  // ── Typhoid — XDR strain active since 2016 ────────────────────────────────────
  { disease_en: "Typhoid",      country_en: "Pakistan",                          minCases: 100    },
  // ── Polio — wild and vaccine-derived poliovirus ────────────────────────────────
  { disease_en: "Polio", country_en: "Pakistan",    minCases: 1, fetcher: fetchPolioGHO("Pakistan")    },
  { disease_en: "Polio", country_en: "Afghanistan", minCases: 1, fetcher: fetchPolioGHO("Afghanistan") },
  // ── Hepatitis E — outbreak-prone conflict/displacement settings ───────────────
  { disease_en: "Hepatitis E",  country_en: "Sudan",                             minCases:  50    },
  { disease_en: "Hepatitis E",  country_en: "Somalia",                           minCases:  50    },
  { disease_en: "Hepatitis E",  country_en: "Nigeria",                           minCases: 100    },
  // ── Diphtheria — resurgent in fragile states ──────────────────────────────────
  { disease_en: "Diphtheria", country_en: "Haiti",  minCases: 10, fetcher: fetchDiphtheriaGHO("Haiti") },
  { disease_en: "Diphtheria", country_en: "Yemen",  minCases: 10, fetcher: fetchDiphtheriaGHO("Yemen") },
  // ── Leishmaniasis — visceral form, east Africa / conflict settings ────────────
  { disease_en: "Leishmaniasis", country_en: "Sudan",    minCases: 100, fetcher: fetchLeishmaniasisGHO("Sudan")    },
  { disease_en: "Leishmaniasis", country_en: "Ethiopia", minCases: 100, fetcher: fetchLeishmaniasisGHO("Ethiopia") },
  // ── Lassa fever — endemic West African reservoir; under-reported globally ─────
  { disease_en: "Lassa",         country_en: "Nigeria",                           minCases:  10    },
  { disease_en: "Lassa",         country_en: "Sierra Leone",                      minCases:  10    },
  { disease_en: "Lassa",         country_en: "Guinea",                            minCases:  10    },
  { disease_en: "Lassa",         country_en: "Liberia",                           minCases:  10    },
  // ── Crimean-Congo Hemorrhagic Fever — endemic in Balkans, Caucasus, SW Asia ──
  { disease_en: "Crimean-Congo", country_en: "Turkey",                            minCases:   1    },
  { disease_en: "Crimean-Congo", country_en: "Iraq",                              minCases:   1    },
  { disease_en: "Crimean-Congo", country_en: "Pakistan",                          minCases:   1    },
  // ── Nipah virus — sporadic zoonotic, India/Bangladesh hotspots ───────────────
  { disease_en: "Nipah",         country_en: "India",                             minCases:   1    },
  { disease_en: "Nipah",         country_en: "Bangladesh",                        minCases:   1    },
  // ── Rift Valley fever — periodic outbreaks, East and Southern Africa ─────────
  { disease_en: "Rift Valley",   country_en: "Kenya",                             minCases:  10    },
  // ── Cholera — additional high-burden countries ────────────────────────────────
  { disease_en: "Cholera", country_en: "Lebanon", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Lebanon") },
  { disease_en: "Cholera",       country_en: "South Sudan",                       minCases: 100    },
  { disease_en: "Cholera", country_en: "Central African Republic", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Central African Republic") },
  // ── Measles — additional high-burden countries ────────────────────────────────
  { disease_en: "Measles", country_en: "South Sudan", minCases: 100, fetcher: fetchMeaslesGHO("South Sudan") },
  { disease_en: "Measles", country_en: "Myanmar",     minCases: 100, fetcher: fetchMeaslesGHO("Myanmar")    },
  // ── Dengue — Myanmar (rising burden, conflict-affected surveillance) ──────────
  { disease_en: "Dengue", country_en: "Myanmar", minCases: 100, fetcher: fetchDengueGlobalSurveillance("Myanmar") },
  // ── Meningitis — extended belt into the Sahel ────────────────────────────────
  { disease_en: "Meningitis", country_en: "Burkina Faso", minCases: 10, fetcher: fetchMeningitisAFRO("Burkina Faso") },
  { disease_en: "Meningitis", country_en: "South Sudan", minCases: 10, fetcher: fetchMeningitisAFRO("South Sudan") },
  // ── Mpox — DRC clade I ongoing (WHO DON dedup guard handles overlap) ──────────
  { disease_en: "Mpox",         country_en: "Democratic Republic of the Congo",  minCases: 100    },

  // ── Europe — measles endemic tracking (ECDC RSS covers emerging threats;
  //    these targets add systematic ReliefWeb back-fill for high-burden EU countries) ──
  // Romania: consistently highest measles burden in EU — ECDC/WHO publish on ReliefWeb
  { disease_en: "Measles", country_en: "Romania", minCases: 50, fetcher: fetchMeaslesGHO("Romania") },
  // France, Italy: periodic sub-national outbreaks documented in WHO/ECDC ReliefWeb reports
  { disease_en: "Measles", country_en: "France",  minCases: 50, fetcher: fetchMeaslesGHO("France") },
  { disease_en: "Measles", country_en: "Italy",   minCases: 50, fetcher: fetchMeaslesGHO("Italy")  },
  // West Nile: already in disease-data.ts; ECDC RSS is primary source; ReliefWeb as fallback
  { disease_en: "West Nile fever", country_en: "Italy",                            minCases:  10    },
  { disease_en: "West Nile fever", country_en: "Greece",                           minCases:   5    },
  { disease_en: "West Nile fever", country_en: "Romania",                          minCases:   5    },

  // ── South America — dengue & malaria (previously under-covered) ──────────────
  // Argentina: solid national surveillance (SIVILA); 2024 epidemic ~330k cases documented on PAHO/ReliefWeb
  { disease_en: "Dengue", country_en: "Argentina", minCases: 100, fetcher: fetchDengueGlobalSurveillance("Argentina") },
  // Ecuador, Bolivia, Paraguay: seasonal dengue well documented in PAHO sitreps on ReliefWeb
  { disease_en: "Dengue", country_en: "Ecuador",  minCases: 100, fetcher: fetchDengueGlobalSurveillance("Ecuador") },
  { disease_en: "Dengue", country_en: "Bolivia",  minCases: 100, fetcher: fetchDengueGlobalSurveillance("Bolivia") },
  { disease_en: "Dengue", country_en: "Paraguay", minCases: 100, fetcher: fetchDengueGlobalSurveillance("Paraguay") },
  // Venezuela: national surveillance has collapsed; figures are WHO extrapolations — treat as approximate
  { disease_en: "Dengue", country_en: "Venezuela", minCases: 100, fetcher: fetchDengueGlobalSurveillance("Venezuela") },
  { disease_en: "Malaria",       country_en: "Venezuela",                         minCases:    100 },
  // Colombia: significant endemic malaria burden beyond the dengue row already present
  { disease_en: "Malaria",       country_en: "Colombia",                          minCases:  5_000 },

  // ── Asia — WHO SEARO / WPRO gap-fill ─────────────────────────────────────────
  // Philippines: DOH + WHO WPRO publish regularly on ReliefWeb; 100-200k dengue cases/year typical
  { disease_en: "Dengue",        country_en: "Philippines",                       minCases: 10_000 },
  { disease_en: "Measles", country_en: "Philippines", minCases: 100, fetcher: fetchMeaslesGHO("Philippines") },
  // Cambodia, Laos, Sri Lanka: present on ReliefWeb via WPRO/SEARO — conservative thresholds
  { disease_en: "Dengue", country_en: "Cambodia",  minCases: 100, fetcher: fetchDengueGlobalSurveillance("Cambodia") },
  { disease_en: "Dengue", country_en: "Laos",      minCases: 100, fetcher: fetchDengueGlobalSurveillance("Laos") },
  { disease_en: "Dengue", country_en: "Sri Lanka", minCases: 100, fetcher: fetchDengueGlobalSurveillance("Sri Lanka") },
  // Bangladesh cholera: WHO SEARO publishes; ReliefWeb has good coverage
  { disease_en: "Cholera",       country_en: "Bangladesh",                        minCases:    100 },
  // Nepal cholera: monsoon-seasonal, well documented in ReliefWeb SEARO reports
  { disease_en: "Cholera", country_en: "Nepal", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Nepal") },
  // Myanmar malaria: WHO SEARO + OCHA publish; conflict limits surveillance but ReliefWeb has estimates
  { disease_en: "Malaria",       country_en: "Myanmar",                           minCases:  1_000 },
  // China avian influenza: human H5N1 cases are usually in WHO DON (dedup guard applies);
  // this catches events before DON publication or sub-threshold clusters on ReliefWeb
  { disease_en: "Avian Influenza", country_en: "China",                           minCases:      1 },

  // ── Avian Influenza — additional endemic/active countries ────────────────────
  // Egypt: H5N1 has circulated endemically in poultry since 2006; regular human cases
  { disease_en: "Avian Influenza", country_en: "Egypt",                           minCases:      1 },
  // Cambodia: recurring H5N1 human cases, WHO WPRO publishes situation reports on ReliefWeb
  { disease_en: "Avian Influenza", country_en: "Cambodia",                        minCases:      1 },
  // Vietnam: re-emerging H5N1 clusters; WHO SEARO + WPRO cover on ReliefWeb
  { disease_en: "Avian Influenza", country_en: "Vietnam",                         minCases:      1 },

  // ── Malaria — high-burden countries absent from WHO DON (endemic, not outbreak) ─
  // WHO GHO fetcher provides annual estimated case counts (public API, no auth).
  { disease_en: "Malaria", country_en: "Nigeria",                                 minCases: 10_000, fetcher: fetchMalariaGHO("Nigeria") },
  { disease_en: "Malaria", country_en: "Uganda",                                  minCases:  5_000, fetcher: fetchMalariaGHO("Uganda") },
  { disease_en: "Malaria", country_en: "Ghana",                                   minCases: 10_000, fetcher: fetchMalariaGHO("Ghana") },
  { disease_en: "Malaria", country_en: "Tanzania",                                minCases: 50_000, fetcher: fetchMalariaGHO("Tanzania") },
  { disease_en: "Malaria", country_en: "Kenya",                                   minCases:  5_000, fetcher: fetchMalariaGHO("Kenya") },
  { disease_en: "Malaria", country_en: "Ethiopia",                                minCases:  5_000, fetcher: fetchMalariaGHO("Ethiopia") },
  { disease_en: "Malaria", country_en: "Mozambique",                              minCases: 50_000, fetcher: fetchMalariaGHO("Mozambique") },
  { disease_en: "Malaria", country_en: "Democratic Republic of the Congo",        minCases: 50_000, fetcher: fetchMalariaGHO("Democratic Republic of the Congo") },
  { disease_en: "Malaria", country_en: "Burkina Faso",                            minCases: 10_000, fetcher: fetchMalariaGHO("Burkina Faso") },
  { disease_en: "Malaria", country_en: "India",                                   minCases: 50_000, fetcher: fetchMalariaGHO("India") },

  // ── Mpox — Clade I/Ib expansion beyond DRC (declared PHEIC August 2024) ─────
  // Rwanda: large clade Ib outbreak confirmed late 2024; WHO DON dedup guard applies
  { disease_en: "Mpox", country_en: "Rwanda", minCases: 1, fetcher: fetchMpoxGlobalSurveillance("Rwanda") },
  // Uganda: cross-border transmission from DRC; sporadic confirmed cases
  { disease_en: "Mpox", country_en: "Uganda", minCases: 5, fetcher: fetchMpoxGlobalSurveillance("Uganda") },
  // Burundi: active transmission documented in WHO/AFRO bulletins on ReliefWeb
  { disease_en: "Mpox", country_en: "Burundi", minCases: 5, fetcher: fetchMpoxGlobalSurveillance("Burundi") },
  // Kenya: imported cases; WHO DON dedup guard handles official DON; ReliefWeb catches sub-threshold
  { disease_en: "Mpox", country_en: "Kenya", minCases: 1, fetcher: fetchMpoxGlobalSurveillance("Kenya") },

  // ── Rift Valley Fever — expansion beyond Kenya ────────────────────────────────
  // Rwanda: large RVF outbreak in livestock and humans 2024–2025; WHO AFRO + OCHA on ReliefWeb
  { disease_en: "Rift Valley", country_en: "Rwanda",                              minCases:      1 },
  { disease_en: "Rift Valley", country_en: "Uganda",                              minCases:      1 },
  { disease_en: "Rift Valley", country_en: "Tanzania",                            minCases:      1 },

  // ── Polio — cVDPV2 expansion beyond endemic Pakistan/Afghanistan ─────────────
  // Nigeria: vaccine-derived poliovirus type 2 ongoing; WHO DON dedup guard handles published DON
  { disease_en: "Polio", country_en: "Nigeria",                                   minCases:      1 },
  // DRC: cVDPV2 circulating; WHO DON dedup guard handles published DON
  { disease_en: "Polio", country_en: "Democratic Republic of the Congo",          minCases:      1 },

  // ── Cholera — additional high-burden countries ────────────────────────────────
  // Nigeria: frequent cholera outbreaks during rainy season; OCHA/WHO AFRO publish on ReliefWeb
  { disease_en: "Cholera", country_en: "Nigeria", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Nigeria") },
  // Ethiopia: Oromia + Somali region outbreaks, WHO AFRO bulletins on ReliefWeb
  { disease_en: "Cholera", country_en: "Ethiopia",                                minCases:     50 },
  // Tanzania: coastal and island outbreaks (Zanzibar), WHO AFRO on ReliefWeb
  { disease_en: "Cholera", country_en: "Tanzania", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Tanzania") },
  // Zambia: major outbreak 2024 (Lusaka), OCHA/WHO published on ReliefWeb
  { disease_en: "Cholera", country_en: "Zambia", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Zambia") },

  // ── Dengue — Americas gap-fill (PAHO sitreps published on ReliefWeb) ─────────
  { disease_en: "Dengue", country_en: "Mexico",    minCases: 100, fetcher: fetchDengueGlobalSurveillance("Mexico") },
  { disease_en: "Dengue", country_en: "Cuba",      minCases: 100, fetcher: fetchDengueGlobalSurveillance("Cuba") },
  { disease_en: "Dengue", country_en: "Haiti",     minCases: 100, fetcher: fetchDengueGlobalSurveillance("Haiti") },
  { disease_en: "Dengue", country_en: "Nicaragua", minCases: 100, fetcher: fetchDengueGlobalSurveillance("Nicaragua") },
  { disease_en: "Dengue", country_en: "Guatemala", minCases: 100, fetcher: fetchDengueGlobalSurveillance("Guatemala") },

  // ── Typhoid — XDR/resistant strain spread beyond Pakistan ─────────────────────
  // India: high burden of typhoid; WHO SEARO + OCHA publish on ReliefWeb
  { disease_en: "Typhoid", country_en: "India",                                   minCases:  1_000 },
  // Zimbabwe: XDR typhoid documented since 2019; WHO AFRO on ReliefWeb
  { disease_en: "Typhoid", country_en: "Zimbabwe",                                minCases:    100 },

  // ── Hepatitis E — displacement/conflict settings beyond current targets ───────
  // South Sudan: mass displacement → large HepatE outbreaks in camps; OCHA/WHO on ReliefWeb
  { disease_en: "Hepatitis E", country_en: "South Sudan",                         minCases:     50 },
  // Ethiopia: IDP camps (Tigray, Afar); WHO AFRO + OCHA publish on ReliefWeb
  { disease_en: "Hepatitis E", country_en: "Ethiopia",                            minCases:     50 },
];

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today    = new Date().toISOString().substring(0, 10);

  // ── ReliefWeb HARD-DISABLED — legal (non-commercial terms) ─────────────────────
  // ReliefWeb's terms of use grant reuse for "personal, non-commercial use" only,
  // with no right to resell, redistribute, or create derivative works, and its
  // reports are third-party copyrighted material (WHO/OCHA/NGO partners). HealthWatch
  // Global is a commercial product, so ingesting ReliefWeb via its API would breach
  // those terms — the same legal shape as the ProMED cease-and-desist (June 2026).
  // Verified 2026-07-06: reliefweb.int ToS = non-commercial; DB had 0 ReliefWeb rows.
  //
  // Kept hard-off (not just "awaiting appname approval") so registering an approved
  // appname can NEVER silently start commercial ingestion. The non-fetcher targets
  // below are retained only as a record of desired coverage, to be wired from the
  // ORIGINAL government / IGO sources directly (WHO, PAHO, Africa CDC, national
  // ministries) — which is where legally-clean coverage expansion must come from.
  const reliefWebOk = false;

  // Load existing outbreaks (active + recently deactivated to avoid ghost dups)
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) {
    await logCronRun(supabase, "sync-who-regional", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  // Index by "disease_en|country_en" — prefer active row when duplicates exist
  type Row = NonNullable<typeof existing>[number];
  const byDC = new Map<string, Row>();
  for (const row of existing ?? []) {
    const k    = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

  const results = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  // Process each target
  for (const target of TARGETS) {
    const diseaseInfo = normalizeDisease(target.disease_en);
    const countryInfo = findCountry(target.country_en);
    if (!countryInfo) {
      log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "country not in geo-data" });
      results.skipped++;
      continue;
    }

    const dcKey       = `${diseaseInfo.name_en.toLowerCase()}|${countryInfo.name_en.toLowerCase()}`;
    const existingRow = byDC.get(dcKey)
      ?? byDC.get(`${target.disease_en.toLowerCase()}|${target.country_en.toLowerCase()}`);

    // Never overwrite rows managed by the WHO DON daily sync
    if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "owned by WHO DON sync" });
      results.skipped++;
      continue;
    }

    if (!target.fetcher) await delay(300); // rate-limit ReliefWeb; InfoDengue self-paces internally

    const found = await (target.fetcher ? target.fetcher() : (reliefWebOk ? queryReliefWeb(target) : null));

    if (!found) {
      const source = target.fetcher ? "custom fetcher" : "ReliefWeb";
      log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: `no ${source} data with cases ≥ ${target.minCases}` });
      results.skipped++;
      continue;
    }

    // Sanity guard
    if (found.date > today || found.cases <= 0) {
      log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: `implausible (${found.cases} cases, date ${found.date})` });
      results.skipped++;
      continue;
    }

    // Annual GHO reference data (custom fetcher with a placeholder AAAA-01-01 date)
    // is endemic reference — an annual estimate, NOT a time-limited outbreak event.
    // It is ingested INACTIVE so it never shows on the "active outbreaks" map
    // (misleading for an epidemiologist audience, and it was the source of a
    // recurring cleanup loop — see project_is_seed_design_conflict). It is still
    // refreshed + kept is_seed so sync-outbreaks' stale-deactivation (.neq is_seed
    // true) leaves it alone and no duplicates are created.
    // Detected by the placeholder date itself (Jan 1st), not by age — every GHO
    // annual fetcher above always produces a "${year}-01-01" date, while periodic
    // fetchers (e.g. fetchDengueGlobalSurveillance's real weekly/monthly dates)
    // almost never land exactly on Jan 1st, so they correctly stay active even
    // when the underlying source has some real reporting lag.
    // ReliefWeb-sourced rows (recent sitreps: dengue/cholera/…) stay active as before.
    const isAnnualRef = !!target.fetcher && /-01-01$/.test(found.date);
    const activeFlag  = !isAnnualRef;

    if (existingRow) {
      const isNewer    = found.date > existingRow.date;
      const casesDiff  = found.cases  !== existingRow.cases;
      const deathsDiff = found.deaths !== existingRow.deaths;

      if (!isNewer && !casesDiff && !deathsDiff) {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "data unchanged" });
        results.skipped++;
        continue;
      }

      const { error } = await supabase
        .from("outbreaks")
        .update({
          cases:           found.cases,
          deaths:          found.deaths,
          date:            found.date,
          source:          found.source,
          description:     found.description,
          risk_level:      assessRisk(target.disease_en, found.description, found.cases, found.deaths),
          active:          activeFlag,
          is_seed:         isAnnualRef,
          source_priority: 5,
        })
        .eq("id", existingRow.id)
        .lte("source_priority", 5);

      if (error) {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "updated", detail: `${found.cases} cases / ${found.deaths} deaths (${found.date})` });
        results.updated++;
      }
    } else {
      // Safety net: the `existing` map is filtered to active + 90-day window.
      // Annual GHO rows (date 1-3 years ago) can fall outside that window once
      // deactivated, causing the cron to re-insert on every run.
      // Do a direct lookup by disease+country before inserting to catch these.
      //
      // Tiebreaker matters: duplicate rows for the same disease+country+date exist
      // in prod (2026-06-30 backfill created 2-5 rows per GHO target — see
      // project_polio_duplicate_rows_audit memory, 2026-07-05). Without a
      // deterministic order, "date desc" alone ties on identical dates and
      // .limit(1) picks whichever row the query planner happens to return first —
      // confirmed to silently reactivate the wrong (lower-quality) duplicate in
      // production. Prefer is_seed rows, then higher source_priority, then the
      // most recently created row.
      const { data: directCheck } = await supabase
        .from("outbreaks")
        .select("id, cases, deaths, date, active")
        .eq("disease_en", diseaseInfo.name_en)
        .eq("country_en", countryInfo.name_en)
        .order("is_seed", { ascending: false })
        .order("source_priority", { ascending: false })
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (directCheck) {
        // Row already exists (likely deactivated + old) — reactivate and update
        const { error } = await supabase
          .from("outbreaks")
          .update({ cases: found.cases, deaths: found.deaths, date: found.date,
                    source: found.source, description: found.description,
                    active: activeFlag, is_seed: isAnnualRef,
                    risk_level: assessRisk(target.disease_en, found.description, found.cases, found.deaths),
                    source_priority: 5 })
          .eq("id", directCheck.id)
          .lte("source_priority", 5);
        if (error) {
          log.push({ label: `${target.disease_en}/${target.country_en}`, status: "error", detail: error.message });
          results.errors++;
        } else {
          log.push({ label: `${target.disease_en}/${target.country_en}`, status: "updated", detail: isAnnualRef ? `refreshed (endemic ref, inactive)` : `reactivated (was missed by cache)` });
          results.updated++;
        }
        continue;
      }

      const { error } = await supabase.from("outbreaks").insert({
        disease:     diseaseInfo.name_fr,
        disease_en:  diseaseInfo.name_en,
        disease_ar:  diseaseInfo.name_ar,
        country:     countryInfo.name_fr,
        country_en:  countryInfo.name_en,
        country_ar:  countryInfo.name_ar,
        region:      countryInfo.region,
        lat:         countryInfo.lat,
        lng:         countryInfo.lng,
        cases:       found.cases,
        deaths:      found.deaths,
        risk_level:  assessRisk(target.disease_en, found.description, found.cases, found.deaths),
        date:        found.date,
        source:      found.source,
        description: found.description,
        active:      activeFlag,
        is_seed:     isAnnualRef,
        source_priority: 5,
      });

      if (error) {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "inserted", detail: `${found.cases} cases / ${found.deaths} deaths (${found.date})` });
        results.inserted++;
      }
    }
  }

  console.log("[regional] Done:", results, log);
  await logCronRun(supabase, "sync-who-regional", "ok", results.inserted ?? 0);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    targets:   TARGETS.length,
    ...results,
    log,
  });
}
