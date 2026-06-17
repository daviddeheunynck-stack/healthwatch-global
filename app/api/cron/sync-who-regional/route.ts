// High-burden endemic disease situations not covered by WHO DON
// Sources:
//   - Brazil dengue: InfoDengue / Fiocruz / PROCC (open JSON API, no auth)
//   - All others:    ReliefWeb API v2 (UN OCHA) — requires registered appname
//     → Register at https://apidoc.reliefweb.int/ ; update RELIEFWEB_APPNAME below
// Schedule: 0 8 * * 2,5  (Tuesday and Friday 08:00 UTC)
//
// Never overwrites rows whose source URL is from who.int/emergencies
// (those are owned by the WHO DON daily sync).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 45 targets × ~2s each; Vercel Pro allows 300s for crons

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

// TODO: replace with approved appname once ReliefWeb registration is confirmed
const RELIEFWEB_APPNAME = "healthwatch-global";
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

      // Last record = most recent reported week; notif_accum_year = YTD total
      const last       = data[data.length - 1];
      const cityCases  = last.notif_accum_year ?? 0;
      totalCases      += cityCases;

      if ((last.data_iniSE ?? 0) > latestDateMs) latestDateMs = last.data_iniSE;
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
  { disease_en: "Measles",       country_en: "Democratic Republic of the Congo", minCases: 1_000  },
  { disease_en: "Measles",       country_en: "Ethiopia",                         minCases: 500    },
  { disease_en: "Measles",       country_en: "Nigeria",                          minCases: 500    },
  { disease_en: "Measles",       country_en: "Yemen",                            minCases: 100    },
  { disease_en: "Measles",       country_en: "Somalia",                          minCases: 100    },
  { disease_en: "Measles",       country_en: "Pakistan",                         minCases: 100    },
  { disease_en: "Measles",       country_en: "Ukraine",                          minCases:  50    },
  // ── Yellow Fever — any confirmed case is epidemiologically significant ─────────
  { disease_en: "Yellow Fever",  country_en: "Nigeria",                          minCases:   1    },
  { disease_en: "Yellow Fever",  country_en: "Cameroon",                         minCases:   1    },
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
  { disease_en: "Polio",        country_en: "Pakistan",                          minCases:   1    },
  { disease_en: "Polio",        country_en: "Afghanistan",                       minCases:   1    },
  // ── Hepatitis E — outbreak-prone conflict/displacement settings ───────────────
  { disease_en: "Hepatitis E",  country_en: "Sudan",                             minCases:  50    },
  { disease_en: "Hepatitis E",  country_en: "Somalia",                           minCases:  50    },
  { disease_en: "Hepatitis E",  country_en: "Nigeria",                           minCases: 100    },
  // ── Diphtheria — resurgent in fragile states ──────────────────────────────────
  { disease_en: "Diphtheria",   country_en: "Haiti",                             minCases:  10    },
  { disease_en: "Diphtheria",   country_en: "Yemen",                             minCases:  10    },
  // ── Leishmaniasis — visceral form, east Africa / conflict settings ────────────
  { disease_en: "Leishmaniasis", country_en: "Sudan",                            minCases: 100    },
  { disease_en: "Leishmaniasis", country_en: "Ethiopia",                         minCases: 100    },
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
  // ── Mpox — DRC clade I ongoing (WHO DON dedup guard handles overlap) ──────────
  { disease_en: "Mpox",         country_en: "Democratic Republic of the Congo",  minCases: 100    },
];

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today    = new Date().toISOString().substring(0, 10);

  // Load existing outbreaks (active + recently deactivated to avoid ghost dups)
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

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

    const found = await (target.fetcher ? target.fetcher() : queryReliefWeb(target));

    if (!found) {
      const source = target.fetcher ? "InfoDengue" : "ReliefWeb";
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
          cases:       found.cases,
          deaths:      found.deaths,
          date:        found.date,
          source:      found.source,
          description: found.description,
          risk_level:  assessRisk(target.disease_en, found.description, found.cases, found.deaths),
          active:      true,
        })
        .eq("id", existingRow.id);

      if (error) {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "updated", detail: `${found.cases} cases / ${found.deaths} deaths (${found.date})` });
        results.updated++;
      }
    } else {
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
        is_seed:     false,
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

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    targets:   TARGETS.length,
    ...results,
    log,
  });
}
