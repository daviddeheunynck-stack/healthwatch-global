// High-burden endemic disease situations not covered by WHO DON
// Source: ReliefWeb API (UN OCHA — open data, no auth required)
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
export const maxDuration = 60;

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const RELIEFWEB_APPNAME = "healthwatch-global";
const RELIEFWEB_BASE    = "https://api.reliefweb.int/v1/reports";

// ── Target list ───────────────────────────────────────────────────────────────

interface Target {
  disease_en: string;   // must match a pattern in normalizeDisease()
  country_en: string;   // must match findCountry() key
  minCases:   number;   // minimum to avoid low-count false positives
}

const TARGETS: Target[] = [
  // Dengue — annually tens/hundreds of thousands of cases in each country
  { disease_en: "Dengue",       country_en: "Brazil",                          minCases: 50_000 },
  { disease_en: "Dengue",       country_en: "India",                           minCases: 50_000 },
  { disease_en: "Dengue",       country_en: "Bangladesh",                      minCases: 1_000  },
  { disease_en: "Dengue",       country_en: "Colombia",                        minCases: 5_000  },
  { disease_en: "Dengue",       country_en: "Indonesia",                       minCases: 10_000 },
  { disease_en: "Dengue",       country_en: "Vietnam",                         minCases: 5_000  },
  // Cholera — endemic in fragile/conflict states
  { disease_en: "Cholera",      country_en: "Democratic Republic of the Congo", minCases: 100   },
  { disease_en: "Cholera",      country_en: "Haiti",                            minCases: 100   },
  { disease_en: "Cholera",      country_en: "Somalia",                          minCases: 100   },
  { disease_en: "Cholera",      country_en: "Sudan",                            minCases: 100   },
  { disease_en: "Cholera",      country_en: "Yemen",                            minCases: 100   },
  { disease_en: "Cholera",      country_en: "Zimbabwe",                         minCases:  50   },
  // Yellow Fever — any confirmed case is epidemiologically significant
  { disease_en: "Yellow Fever", country_en: "Nigeria",                          minCases:   1   },
  { disease_en: "Yellow Fever", country_en: "Cameroon",                         minCases:   1   },
  // Meningitis — meningitis belt countries
  { disease_en: "Meningitis",   country_en: "Niger",                            minCases:  10   },
  { disease_en: "Meningitis",   country_en: "Nigeria",                          minCases:  10   },
  // MERS-CoV — sporadic but ongoing; any case is significant
  { disease_en: "MERS-CoV",    country_en: "Saudi Arabia",                      minCases:   1   },
  // Typhoid — XDR strain active since 2016
  { disease_en: "Typhoid",     country_en: "Pakistan",                          minCases: 100   },
  // Mpox — DRC clade I ongoing (may also be in WHO DON; dedup logic handles overlap)
  { disease_en: "Mpox",        country_en: "Democratic Republic of the Congo",  minCases: 100   },
];

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

// ── ReliefWeb query ───────────────────────────────────────────────────────────

interface Found {
  cases:       number;
  deaths:      number;
  date:        string;
  source:      string;
  description: string;
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

    // Match tokens: first word of disease ("dengue", "cholera", "yellow", "mpox"…)
    // and first word of country ("brazil", "democratic", "haiti"…)
    const diseaseToken  = target.disease_en.toLowerCase().split(/\s+/)[0];
    const countryTokens = target.country_en.toLowerCase().split(/\s+/).slice(0, 2);

    for (const item of json.data ?? []) {
      const f = item.fields;
      if (!f?.body) continue;

      const text  = htmlToText(f.body);
      const lower = text.toLowerCase();
      const titleLower = (f.title ?? "").toLowerCase();

      // Report must mention the disease
      if (!lower.includes(diseaseToken)) continue;
      // Report must mention the country (in body or title)
      const mentionsCountry = countryTokens.some(
        (t) => lower.includes(t) || titleLower.includes(t)
      );
      if (!mentionsCountry) continue;

      const { cases, deaths } = extractNumbers(text);
      if (cases < target.minCases) continue;

      const date    = f.date?.created?.substring(0, 10) ?? new Date().toISOString().substring(0, 10);
      const source  = f.url ?? url.toString();
      // Trim body to a concise description
      const description = text.substring(0, 500).trim();

      return { cases, deaths, date, source, description };
    }
  } catch (e) {
    console.warn(`[regional] ReliefWeb ${target.disease_en}/${target.country_en}:`, errorMessage(e));
  }

  return null;
}

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

  // ── Load existing outbreaks (active + recently deactivated to avoid ghost dups)
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  // Index by "disease_en|country_en" — keep active row if multiple
  type Row = NonNullable<typeof existing>[number];
  const byDC = new Map<string, Row>();
  for (const row of existing ?? []) {
    const k   = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

  const results = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  // ── Process each target ───────────────────────────────────────────────────
  for (const target of TARGETS) {
    const diseaseInfo  = normalizeDisease(target.disease_en);
    const countryInfo  = findCountry(target.country_en);
    if (!countryInfo) {
      log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "country not in geo-data" });
      results.skipped++;
      continue;
    }

    const dcKey       = `${diseaseInfo.name_en.toLowerCase()}|${countryInfo.name_en.toLowerCase()}`;
    const existingRow = byDC.get(dcKey)
      // Also try the raw disease/country names (for diseases whose normalizedName differs)
      ?? byDC.get(`${target.disease_en.toLowerCase()}|${target.country_en.toLowerCase()}`);

    // Never overwrite rows managed by the WHO DON daily sync
    if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "owned by WHO DON sync" });
      results.skipped++;
      continue;
    }

    await delay(300);
    const found = await queryReliefWeb(target);

    if (!found) {
      log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "no ReliefWeb report with cases ≥ " + target.minCases });
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
      // Only update if the report is more recent and brings new data
      const isNewer    = found.date > existingRow.date;
      const casesDiff  = found.cases !== existingRow.cases;
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
      // New row — build full outbreak record
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
    targets:  TARGETS.length,
    ...results,
    log,
  });
}
