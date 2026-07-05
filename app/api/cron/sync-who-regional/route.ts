// Endemic / high-burden disease surveillance not systematically covered by WHO DON.
// 66 disease × country targets across 5 disease categories:
//   Dengue (9), Cholera (12), Measles (9), Meningitis (6), Polio (2), Typhoid (1),
//   MERS-CoV (1), Hepatitis E (3), Diphtheria (2), Leishmaniasis (2), Lassa (4),
//   CCHF (3), Nipah (2), Rift Valley fever (1), Mpox (1), Yellow Fever (2), Dengue-Myanmar (1)
// Sources:
//   - Brazil dengue: InfoDengue / Fiocruz / PROCC (open JSON API, no auth)
//   - All others:    ReliefWeb API v2 (UN OCHA) — requires registered appname
//     → Register at https://apidoc.reliefweb.int/ ; update RELIEFWEB_APPNAME below
// Schedule: 0 8 * * 2,5  (Tuesday and Friday 08:00 UTC)
// maxDuration: 150s (Vercel Pro cron; ~66 targets × 2s avg, many skipped early)
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

// ── Brazil Dengue via InfoDengue (Fiocruz / PROCC) ───────────────────────────
// Open API with per-city weekly surveillance data for Brazil.
// We sum notif_accum_year (YTD accumulated cases) from 12 major cities.

const INFODENGUE_CITIES: Array<{ geocode: number; name: string }> = [
  { geocode: 3550308, name: "São Paulo"      },
  { geocode: 3304557, name: "Rio de Janeiro" },
  { geocode: 3106200, name: "Belo Horizonte" },
  { geocode: 2304400, name: "Fortaleza"      },
  { geocode: 1302603, name: "Manaus"         },
  { geocode: 2927408, name: "Salvador"       },
  { geocode: 4106902, name: "Curitiba"       },
  { geocode: 2611606, name: "Recife"         },
  { geocode: 4314902, name: "Porto Alegre"   },
  { geocode: 1501402, name: "Belém"          },
  { geocode: 5208707, name: "Goiânia"        },
  { geocode: 5300108, name: "Brasília"       },
];

async function fetchBrazilDengue(): Promise<Found | null> {
  const year = new Date().getFullYear();

  type InfoDengueRecord = {
    data_iniSE:       number; // week-start Unix timestamp in milliseconds
    notif_accum_year: number; // YTD accumulated probable case count for this city
  };

  let totalCases  = 0;
  let latestDateMs = 0;
  const citySummary: string[] = [];

  for (const city of INFODENGUE_CITIES) {
    try {
      const url = `https://info.dengue.mat.br/api/alertcity?geocode=${city.geocode}&disease=dengue&format=json&ew_start=1&ew_end=52&ey_start=${year}&ey_end=${year}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" },
        signal:  AbortSignal.timeout(8_000),
      });
      if (!res.ok) { await delay(120); continue; }

      const data = await res.json() as InfoDengueRecord[];
      if (!Array.isArray(data) || data.length === 0) { await delay(120); continue; }

      // The InfoDengue API returns records in descending chronological order
      // (newest first), so data[data.length-1] is the OLDEST week, not the newest.
      // Find the record with the highest data_iniSE (= most recent epidemiological week).
      const latest     = data.reduce((best, r) => (r.data_iniSE ?? 0) > (best.data_iniSE ?? 0) ? r : best, data[0]);
      const cityCases  = latest.notif_accum_year ?? 0;
      totalCases      += cityCases;

      if ((latest.data_iniSE ?? 0) > latestDateMs) latestDateMs = latest.data_iniSE;
      if (cityCases > 0) citySummary.push(`${city.name} (${cityCases.toLocaleString("en")})`);
    } catch {
      // skip city on network error
    }
    await delay(120);
  }

  if (totalCases < 50_000) return null;

  const date   = latestDateMs
    ? new Date(latestDateMs).toISOString().substring(0, 10)
    : new Date().toISOString().substring(0, 10);
  const source = "https://info.dengue.mat.br/";

  const preview = citySummary.slice(0, 4).join(", ");
  const more    = citySummary.length > 4 ? ` and ${citySummary.length - 4} other cities` : "";
  const description = `Dengue fever surveillance in Brazil — ${totalCases.toLocaleString("en")} probable cases reported year-to-date in ${year} across 12 major cities: ${preview}${more}. Source: InfoDengue surveillance platform (Fiocruz / PROCC / SVS-MS).`;

  return { cases: totalCases, deaths: 0, date, source, description };
}

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
  // ── Dengue — Brazil via InfoDengue (Fiocruz); others via ReliefWeb ────────────
  { disease_en: "Dengue",        country_en: "Brazil",                           minCases: 50_000, fetcher: fetchBrazilDengue },
  { disease_en: "Dengue",        country_en: "India",                            minCases: 50_000 },
  { disease_en: "Dengue",        country_en: "Bangladesh",                       minCases: 1_000  },
  { disease_en: "Dengue",        country_en: "Colombia",                         minCases: 5_000  },
  { disease_en: "Dengue",        country_en: "Indonesia",                        minCases: 10_000 },
  { disease_en: "Dengue",        country_en: "Vietnam",                          minCases: 5_000  },
  { disease_en: "Dengue",        country_en: "Thailand",                         minCases: 5_000  },
  { disease_en: "Dengue",        country_en: "Malaysia",                         minCases: 1_000  },
  { disease_en: "Dengue",        country_en: "Peru",                             minCases: 1_000  },
  // ── Cholera — endemic in fragile/conflict states ──────────────────────────────
  { disease_en: "Cholera",       country_en: "Democratic Republic of the Congo", minCases: 100    },
  { disease_en: "Cholera",       country_en: "Haiti",                            minCases: 100    },
  { disease_en: "Cholera",       country_en: "Somalia",                          minCases: 100    },
  { disease_en: "Cholera",       country_en: "Sudan",                            minCases: 100    },
  { disease_en: "Cholera",       country_en: "Yemen",                            minCases: 100    },
  { disease_en: "Cholera",       country_en: "Zimbabwe",                         minCases:  50    },
  { disease_en: "Cholera",       country_en: "Afghanistan",                      minCases: 100    },
  { disease_en: "Cholera",       country_en: "Mozambique",                       minCases:  50    },
  { disease_en: "Cholera",       country_en: "Kenya",                            minCases:  50    },
  { disease_en: "Cholera",       country_en: "Cameroon",                         minCases:  50    },
  { disease_en: "Cholera",       country_en: "Syria",                            minCases:  50    },
  { disease_en: "Cholera",       country_en: "Malawi",                           minCases:  50    },
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
  { disease_en: "Meningitis",    country_en: "Nigeria",                          minCases:  10    },
  { disease_en: "Meningitis",    country_en: "Chad",                             minCases:  10    },
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
  { disease_en: "Cholera",       country_en: "Lebanon",                           minCases:  50    },
  { disease_en: "Cholera",       country_en: "South Sudan",                       minCases: 100    },
  { disease_en: "Cholera",       country_en: "Central African Republic",          minCases:  50    },
  // ── Measles — additional high-burden countries ────────────────────────────────
  { disease_en: "Measles", country_en: "South Sudan", minCases: 100, fetcher: fetchMeaslesGHO("South Sudan") },
  { disease_en: "Measles", country_en: "Myanmar",     minCases: 100, fetcher: fetchMeaslesGHO("Myanmar")    },
  // ── Dengue — Myanmar (rising burden, conflict-affected surveillance) ──────────
  { disease_en: "Dengue",        country_en: "Myanmar",                           minCases: 1_000  },
  // ── Meningitis — extended belt into the Sahel ────────────────────────────────
  { disease_en: "Meningitis",    country_en: "Burkina Faso",                      minCases:  10    },
  { disease_en: "Meningitis",    country_en: "South Sudan",                       minCases:  10    },
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
  { disease_en: "Dengue",        country_en: "Argentina",                         minCases: 10_000 },
  // Ecuador, Bolivia, Paraguay: seasonal dengue well documented in PAHO sitreps on ReliefWeb
  { disease_en: "Dengue",        country_en: "Ecuador",                           minCases:  1_000 },
  { disease_en: "Dengue",        country_en: "Bolivia",                           minCases:  1_000 },
  { disease_en: "Dengue",        country_en: "Paraguay",                          minCases:  1_000 },
  // Venezuela: national surveillance has collapsed; figures are PAHO extrapolations — treat as approximate
  { disease_en: "Dengue",        country_en: "Venezuela",                         minCases:  5_000 },
  { disease_en: "Malaria",       country_en: "Venezuela",                         minCases:    100 },
  // Colombia: significant endemic malaria burden beyond the dengue row already present
  { disease_en: "Malaria",       country_en: "Colombia",                          minCases:  5_000 },

  // ── Asia — WHO SEARO / WPRO gap-fill ─────────────────────────────────────────
  // Philippines: DOH + WHO WPRO publish regularly on ReliefWeb; 100-200k dengue cases/year typical
  { disease_en: "Dengue",        country_en: "Philippines",                       minCases: 10_000 },
  { disease_en: "Measles", country_en: "Philippines", minCases: 100, fetcher: fetchMeaslesGHO("Philippines") },
  // Cambodia, Laos, Sri Lanka: present on ReliefWeb via WPRO/SEARO — conservative thresholds
  { disease_en: "Dengue",        country_en: "Cambodia",                          minCases:  1_000 },
  { disease_en: "Dengue",        country_en: "Laos",                              minCases:    500 },
  { disease_en: "Dengue",        country_en: "Sri Lanka",                         minCases:  1_000 },
  // Bangladesh cholera: WHO SEARO publishes; ReliefWeb has good coverage
  { disease_en: "Cholera",       country_en: "Bangladesh",                        minCases:    100 },
  // Nepal cholera: monsoon-seasonal, well documented in ReliefWeb SEARO reports
  { disease_en: "Cholera",       country_en: "Nepal",                             minCases:     50 },
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
  { disease_en: "Mpox", country_en: "Rwanda",                                     minCases:      1 },
  // Uganda: cross-border transmission from DRC; sporadic confirmed cases
  { disease_en: "Mpox", country_en: "Uganda",                                     minCases:      5 },
  // Burundi: active transmission documented in WHO/AFRO bulletins on ReliefWeb
  { disease_en: "Mpox", country_en: "Burundi",                                    minCases:      5 },
  // Kenya: imported cases; WHO DON dedup guard handles official DON; ReliefWeb catches sub-threshold
  { disease_en: "Mpox", country_en: "Kenya",                                      minCases:      1 },

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
  { disease_en: "Cholera", country_en: "Nigeria",                                 minCases:    100 },
  // Ethiopia: Oromia + Somali region outbreaks, WHO AFRO bulletins on ReliefWeb
  { disease_en: "Cholera", country_en: "Ethiopia",                                minCases:     50 },
  // Tanzania: coastal and island outbreaks (Zanzibar), WHO AFRO on ReliefWeb
  { disease_en: "Cholera", country_en: "Tanzania",                                minCases:     50 },
  // Zambia: major outbreak 2024 (Lusaka), OCHA/WHO published on ReliefWeb
  { disease_en: "Cholera", country_en: "Zambia",                                  minCases:     50 },

  // ── Dengue — Americas gap-fill (PAHO sitreps published on ReliefWeb) ─────────
  { disease_en: "Dengue", country_en: "Mexico",                                   minCases:  5_000 },
  { disease_en: "Dengue", country_en: "Cuba",                                     minCases:    500 },
  { disease_en: "Dengue", country_en: "Haiti",                                    minCases:    100 },
  { disease_en: "Dengue", country_en: "Nicaragua",                                minCases:  1_000 },
  { disease_en: "Dengue", country_en: "Guatemala",                                minCases:  1_000 },

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

  // Probe ReliefWeb once — 403 means appname not approved; skip all non-custom targets
  let reliefWebOk = true;
  try {
    const probe = await fetch(
      `${RELIEFWEB_BASE}?appname=${encodeURIComponent(RELIEFWEB_APPNAME)}&limit=1&fields[include][]=title`,
      { headers: { "User-Agent": "HealthWatch-Global/1.0 (contact@healthwatch-global.com)" },
        signal: AbortSignal.timeout(8_000) }
    );
    if (probe.status === 403) {
      reliefWebOk = false;
      console.warn(`[regional] ReliefWeb 403 — appname "${RELIEFWEB_APPNAME}" not approved — awaiting approval at apidoc.reliefweb.int`);
    }
  } catch {
    // Network error — attempt anyway, individual targets will fail gracefully
  }

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
          active:          true,
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
      // Annual GHO data (date > 60 days old) is endemic reference data, not a time-limited
      // outbreak event. Mark as is_seed so sync-outbreaks' stale deactivation doesn't
      // cycle it out and create duplicates on the next run.
      const SIXTY_DAYS_AGO = new Date(Date.now() - 60 * 86_400_000).toISOString().substring(0, 10);
      const isAnnualRef = !!target.fetcher && found.date < SIXTY_DAYS_AGO;

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
                    active: true, is_seed: isAnnualRef,
                    risk_level: assessRisk(target.disease_en, found.description, found.cases, found.deaths) })
          .eq("id", directCheck.id)
          .lte("source_priority", 5);
        if (error) {
          log.push({ label: `${target.disease_en}/${target.country_en}`, status: "error", detail: error.message });
          results.errors++;
        } else {
          log.push({ label: `${target.disease_en}/${target.country_en}`, status: "updated", detail: `reactivated (was missed by cache)` });
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
        active:      true,
        is_seed:     isAnnualRef,
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
