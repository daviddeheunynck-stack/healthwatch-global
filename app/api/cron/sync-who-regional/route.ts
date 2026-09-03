// Endemic / high-burden disease surveillance not systematically covered by WHO DON.
// 131 disease × country targets; 44 have a working fetcher (see below). The rest
// have none and fall through to queryReliefWeb(), which is HARD-DISABLED for legal
// reasons (reliefWebOk = false) — those entries are retained only as a record of
// desired coverage, not as working code.
// Fetchers:
//   - Malaria / Measles / Yellow Fever / Leishmaniasis / Diphtheria: WHO GHO
//     OData API (ghoapi.azureedge.net)
//   - Polio, wild poliovirus (Pakistan/Afghanistan only): WHO GHO OData API,
//     see fetchPolioGHO
//   - Polio, cVDPV (Nigeria + 12 other African countries): GPEI's weekly prose
//     bulletin, see fetchPolioGPEIThisWeek — no structured API exists for this
//   - Dengue (all countries except Brazil, Philippines): WHO Global Dengue
//     Surveillance API (xmart-api-public.who.int) — see fetchDengueGlobalSurveillance
//   - Dengue/Brazil: MANUAL, see note below — never auto-fetch
//   - Dengue/Philippines: no fetcher yet, absent from the WHO dataset above
// Schedule: 5 8 * * *  (daily 08:05 UTC — see vercel.json; this comment
// previously said "Tuesday and Friday", stale since at least 2026-07-19)
// maxDuration: 300s (Vercel Pro cron; ~131 targets, many skipped early on no-fetcher)
//
// Never overwrites rows whose source URL is from who.int/emergencies
// (those are owned by the WHO DON daily sync).
//
// Fetches WHO's own regional/GHO statistics APIs, so this cron can write onto
// rows locked at source_priority=10 (ceiling raised 2026-08-19 alongside
// sync-who-afro/emro — see project_source_priority_is_ownership_not_freeze_
// 2026_08_19). lockedRowRegressionGuard, added below, refuses any decrease on
// a locked row — safe here because annual-reference GHO rows (isAnnualRef)
// are always written inactive (active:false, see below), so they're outside
// the "27 active locked rows" this fix targets; every locked row this cron
// can actually touch while active is a weekly/cumulative outbreak-style
// target (e.g. the WHO ArcGIS cholera_adm0_week_view feed — the same shape
// as the six Cholera rows found frozen at 52 days on 2026-08-19), where
// "never decreases" is the correct model, same as everywhere else.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry, isCountryName } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";
import { fetchWithRetry } from "@/lib/fetch-retry";
import * as Sentry from "@sentry/nextjs";
import { truncateAtSentence } from "@/lib/truncate-text";
import { dateFloorGuard, spikeGuard, collapseGuard, zeroCaseGuard, zeroDeathGuard, lockedRowRegressionGuard, lockedRowIsFreezing } from "@/lib/outbreak-guards";
import { stampSourceConfirmed } from "@/lib/source-confirmed";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // ~100 targets × ~2s each; Vercel Pro allows 300s for crons

// Overall wall-clock budget for the per-target fetch loop — same pattern as
// ARTICLE_LOOP_BUDGET_MS in sync-who-afro, added here 2026-09-02 after this
// cron was found to have no equivalent guard at all: 139 sequential targets,
// several sharing one host (21 on ghoapi.azureedge.net, 27 on
// xmart-api-public.who.int, 18 on ArcGIS), each with its own 10-15s
// AbortSignal.timeout. A systemic outage on any ONE of those hosts already
// pushes that host's targets alone to 180-270s — close to maxDuration=300
// with zero safety margin, and a Vercel hard-kill mid-loop loses every row
// not yet upserted, not just the ones hit by the outage. This bails out
// cleanly instead: whatever was processed is still logged/upserted, and the
// remaining targets are picked up on tomorrow's run.
const TARGET_LOOP_BUDGET_MS = 220_000;

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
  // null = no source feature reported a death figure at all (ArcGIS's
  // cholera layer uses null for "not reported", 0 for "confirmed zero" — see
  // fetchCholeraGlobalSurveillance). Distinct from the guard chain's
  // GuardedIncoming.deaths (always a concrete number): call sites that feed
  // the guards/assessRisk coalesce with `?? 0` locally rather than widening
  // those shared types, since a "no data this week" 0 is the same
  // conservative worst-case a guard should already treat a real zero as.
  deaths:      number | null;
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
    const url = `https://ghoapi.azureedge.net/api/WHS3_62?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
    // fetchWithRetry: 2 attempts, 5s each — worst case ~10.5s, about the same
    // total wait as the original single 10s attempt, so a fully-down host
    // doesn't meaningfully change how fast TARGET_LOOP_BUDGET_MS is consumed;
    // a brief blip now recovers instead of costing this target the whole day.
    // See lib/fetch-retry.ts (2026-09-02) — safe here now that the loop has
    // a time budget to fall back on.
    const { response: res } = await fetchWithRetry(
      url, { headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" } },
      { attempts: 2, timeoutMs: 5000, backoffMs: [500] },
    );
    if (!res || !res.ok) return null;
    try {
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
    const url = `https://ghoapi.azureedge.net/api/VACCINEPREVENTABLE_WILDPOLIO?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
    // fetchWithRetry: 2 attempts, 5s each — see fetchMeaslesGHO above and
    // lib/fetch-retry.ts (2026-09-02).
    const { response: res } = await fetchWithRetry(
      url, { headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" } },
      { attempts: 2, timeoutMs: 5000, backoffMs: [500] },
    );
    if (!res || !res.ok) return null;
    try {
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

// ── GPEI "Polio This Week" cVDPV fetcher — African cVDPV countries ───────────
// Added 2026-08-28 after the DRC/Nigeria cVDPV rows were found 8 days behind
// their own source (a WHO Incident Manager pointed it out in a LinkedIn DM
// before any cron did) — root cause: polioeradication.org was a
// MANUAL_WEEKLY_SOURCE (see app/api/cron/data-quality/route.ts §4f), refreshed
// only by one-off scripts (add-cvdpv-africa-gpei-2026-08-22.mjs and friends)
// whenever someone happened to notice. Same page data-quality already reads
// for its coverage probe (§4j), but that check only ever compares dates — it
// never had a write path, by design at the time. This does.
//
// No structured API exists for cVDPV: unlike WPV1 (GHO indicator
// VACCINEPREVENTABLE_WILDPOLIO, fetchPolioGHO above), GPEI's cVDPV count page
// (polioeradication.org/circulating-vaccine-derived-poliovirus-count/) is a
// Power BI iframe embed, not scrapable without a headless browser and Power
// BI's own API — ruled out as disproportionate for this. The weekly bulletin's
// prose "Country updates" section is the only practical source, same one
// data-quality already trusts (its own comment: markup changes with every
// WordPress theme bump, but the two section anchors have been stable "for
// years").
//
// IMPORTANT — this bulletin only narrates countries with NEW activity that
// week ("more information on the countries that have reported cases and/or
// environmental samples this week"). A tracked country absent from a given
// week's page is not stale, it simply has nothing new — the fetcher correctly
// returns null and the existing row is left untouched (same "skip" path as
// any other target with no fresh data), exactly mirroring what a human
// checking the bulletin by hand would conclude. This bounds the true lag to
// GPEI's own publication cadence (~weekly) rather than removing it outright.
//
// Fails closed throughout: a changed page structure, an unrecognized country
// block, or a case count GPEI wrote as a word this parser doesn't recognize
// all return null rather than a partial/guessed figure — same standard as
// parseGPEIThisWeek in data-quality/route.ts, which this deliberately does
// NOT share code with (route-local, matching every other fetcher in this
// file; the two parsers reading the same section for different purposes — a
// dated coverage/lag check there, a case-count extraction here — isn't reason
// enough to introduce a shared module).

const GPEI_THIS_WEEK_URL = "https://polioeradication.org/about-polio/polio-this-week/";

// Serotype scope per country, fixed at the original 2026-08-22 ingestion
// (add-cvdpv-africa-gpei-2026-08-22.mjs) — each row was scoped to whichever
// serotype(s) GPEI reported active for that country at the time, and stays
// scoped to the same set here so an update never silently narrows or widens
// what a row represents. Bulletin country names are GPEI's own spelling.
const GPEI_CVDPV_TARGETS: Record<string, string[]> = {
  "Nigeria":                          ["cVDPV2", "cVDPV3"],
  "Democratic Republic of the Congo": ["cVDPV2"],
  "Chad":                             ["cVDPV2", "cVDPV3"],
  "Sudan":                            ["cVDPV2"],
  "Central African Republic":         ["cVDPV2"],
  "Somalia":                          ["cVDPV2"],
  "South Sudan":                      ["cVDPV1"],
  "Ethiopia":                         ["cVDPV1"],
  "Niger":                            ["cVDPV3"],
  "Togo":                             ["cVDPV2"],
  "Mali":                             ["cVDPV2"],
  "Angola":                           ["cVDPV2"],
  "Madagascar":                       ["cVDPV1"],
};

// GPEI's "Country updates" narrative spells small numbers out ("seven", "one")
// and large ones as digits ("34", "66") inconsistently within the same
// sentence — this covers what the bulletin actually uses, not a general
// English number parser. An unrecognized word returns undefined, which the
// caller treats as a parse failure (fail closed, see above).
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
function parseCountOrWord(raw: string): number | undefined {
  const digits = raw.replace(/,/g, "").match(/^\d+$/);
  if (digits) return Number(digits[0]);
  return NUMBER_WORDS[raw.trim().toLowerCase()];
}

function htmlToLines(rawHtml: string): string[] {
  return rawHtml
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|li|div|h[1-6]|tr)\s*>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// Section runs from "Country updates as of <date>" to the site's footer
// navigation — bounded by the first known nav line rather than a fixed
// length, since the number of country blocks (and so the section's length)
// changes every week. "Who we are" is the first footer item on every fetch
// checked while building this (2026-08-28); if a redesign moves it, the
// bound below simply isn't found and the whole parse fails closed.
function extractGPEICountryUpdates(rawHtml: string): { asOf: string | null; lines: string[] } | null {
  const lines = htmlToLines(rawHtml);
  const asOfIdx = lines.findIndex((l) => /country updates as of/i.test(l));
  if (asOfIdx < 0) return null;
  let endIdx = lines.findIndex((l, i) => i > asOfIdx && /^who we are$/i.test(l));
  if (endIdx < 0) endIdx = lines.length;

  let asOf: string | null = null;
  const asOfMatch = lines[asOfIdx].match(/as of\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (asOfMatch) {
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const month = months.indexOf(asOfMatch[2].toLowerCase());
    if (month >= 0) asOf = `${asOfMatch[3]}-${String(month + 1).padStart(2, "0")}-${asOfMatch[1].padStart(2, "0")}`;
  }
  return { asOf, lines: lines.slice(asOfIdx + 1, endIdx) };
}

// Isolates one country's paragraph block: from its own name line (an exact
// match against GPEI's spelling — country names in this section are never
// prefixed/suffixed with other text) up to the next line that is ITSELF a
// country heading, or the end of the section.
//
// The boundary must be ANY country, not just the 13 this cron tracks (plus a
// hardcoded Afghanistan, which is how this read on 2026-08-28 — the day the
// bulletin happened to narrate only Afghanistan, DRC and Nigeria). GPEI's
// "Country updates" also narrates Pakistan and whichever other cVDPV
// countries reported that week (Guinea, Kenya, Yemen, Côte d'Ivoire,
// Zimbabwe, Papua New Guinea…), interleaved with the tracked ones. An
// untracked country following a tracked one was not a boundary, so its
// paragraphs were absorbed into the tracked country's block — and since the
// serotype lookup below fails closed only when NO matching line exists in the
// block, a neighbour's "The number of cVDPV2 cases in 2026 is N" could supply
// the line the tracked country itself did not restate that week, writing
// another country's case count onto this row. Same class of defect as the
// "Guatemala on Measles/Mexico" leak: an extraction bounded to shared text
// rather than to the row's own content.
//
// isCountryName (lib/geo-data.ts) is exact-match-only by design — a narrative
// sentence merely *mentioning* a country never matches, only a line that IS a
// country name, which is exactly what a heading in this section looks like.
// The tracked-name set is kept as a fallback for any GPEI spelling geo-data
// does not carry.
function extractCountryBlock(sectionLines: string[], countryName: string): string[] | null {
  const nameIdx = sectionLines.findIndex((l) => l.toLowerCase() === countryName.toLowerCase());
  if (nameIdx < 0) return null;
  const knownNames = new Set(Object.keys(GPEI_CVDPV_TARGETS).map((n) => n.toLowerCase()));
  let end = sectionLines.length;
  for (let i = nameIdx + 1; i < sectionLines.length; i++) {
    const line = sectionLines[i];
    if (isCountryName(line) || knownNames.has(line.toLowerCase())) { end = i; break; }
  }
  return sectionLines.slice(nameIdx + 1, end);
}

// Module-level cache for the ONE GPEI weekly-page fetch shared by all 13
// cVDPV country targets — before 2026-09-02 each target refetched the exact
// same URL independently every run (13 requests for 1 page). Reset at the
// top of runSyncWhoRegional() so a warm serverless container never serves a
// previous run's cached page across days.
let gpeiSectionCache: Promise<{ asOf: string | null; lines: string[] } | null> | null = null;

async function getGpeiSection(): Promise<{ asOf: string | null; lines: string[] } | null> {
  if (!gpeiSectionCache) {
    gpeiSectionCache = (async () => {
      // fetchWithRetry: 2 attempts, 5s each — safe to add now that this runs
      // once per run instead of once per target. See lib/fetch-retry.ts
      // (2026-09-02).
      const { response: res } = await fetchWithRetry(
        GPEI_THIS_WEEK_URL, { headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" } },
        { attempts: 2, timeoutMs: 5000, backoffMs: [500] },
      );
      if (!res || !res.ok) return null;
      try {
        return extractGPEICountryUpdates(await res.text());
      } catch {
        return null;
      }
    })();
  }
  return gpeiSectionCache;
}

function fetchPolioGPEIThisWeek(country_en: string): () => Promise<Found | null> {
  return async () => {
    const serotypes = GPEI_CVDPV_TARGETS[country_en];
    if (!serotypes) return null;
    const section = await getGpeiSection();
    if (!section?.asOf) return null;
    try {
      const block = extractCountryBlock(section.lines, country_en);
      if (!block) return null; // country not narrated this week — nothing new, not stale

      const year = new Date().getUTCFullYear();
      let total = 0;
      const perSerotype: string[] = [];
      for (const sero of serotypes) {
        const line = block.find((l) => new RegExp(`number of ${sero}\\b.*\\bin ${year}\\b`, "i").test(l));
        if (!line) return null; // configured serotype not restated this week's block — fail closed rather than undercount
        const m = line.match(new RegExp(`number of ${sero}\\b[^.]*\\bin ${year}\\s+is\\s+([A-Za-z0-9,]+)`, "i"));
        const count = m ? parseCountOrWord(m[1]) : undefined;
        if (count === undefined) return null;
        total += count;
        perSerotype.push(`${count} ${sero}`);
      }
      if (total <= 0) return null;

      return {
        cases: total,
        deaths: 0,
        date: section.asOf,
        source: `${GPEI_THIS_WEEK_URL} (GPEI, Country updates as of ${section.asOf})`,
        description: `Circulating vaccine-derived poliovirus (${serotypes.join(" and ")}) in ${country_en} — ${total} confirmed AFP (acute flaccid paralysis) case${total > 1 ? "s" : ""} reported since the start of ${year} (${perSerotype.join(", ")}), per GPEI's public weekly update (country data as of ${section.asOf}).`,
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
    const url = `https://ghoapi.azureedge.net/api/WHS3_50?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
    // fetchWithRetry: 2 attempts, 5s each — see fetchMeaslesGHO above and
    // lib/fetch-retry.ts (2026-09-02).
    const { response: res } = await fetchWithRetry(
      url, { headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" } },
      { attempts: 2, timeoutMs: 5000, backoffMs: [500] },
    );
    if (!res || !res.ok) return null;
    try {
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
    const url = `https://ghoapi.azureedge.net/api/NTD_LEISHVNUM?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
    // fetchWithRetry: 2 attempts, 5s each — see fetchMeaslesGHO above and
    // lib/fetch-retry.ts (2026-09-02).
    const { response: res } = await fetchWithRetry(
      url, { headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" } },
      { attempts: 2, timeoutMs: 5000, backoffMs: [500] },
    );
    if (!res || !res.ok) return null;
    try {
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
    const url = `https://ghoapi.azureedge.net/api/WHS3_41?%24filter=SpatialDim%20eq%20'${iso3}'&%24orderby=TimeDim%20desc&%24top=1`;
    // fetchWithRetry: 2 attempts, 5s each — see fetchMeaslesGHO above and
    // lib/fetch-retry.ts (2026-09-02).
    const { response: res } = await fetchWithRetry(
      url, { headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" } },
      { attempts: 2, timeoutMs: 5000, backoffMs: [500] },
    );
    if (!res || !res.ok) return null;
    try {
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

// Ceiling on how old the best-available data point is allowed to be before this
// fetcher gives up and returns null instead of a stale "Found". Without this,
// a country whose WHO xmart data has gone silent for years (found 2026-07-28:
// Haiti, zero real CASES rows since 2022) kept getting upserted `active: true`
// with the same multi-year-old figure on every run — this write path sets
// `active` unconditionally (see `activeFlag` below), so returning the stale
// data here doesn't just leave a row unrefreshed, it actively reactivates one
// a human just deactivated, or inserts a fresh duplicate (the existing-row
// lookup a few hundred lines up only covers `active=true OR date within 90
// days`, which an old, just-deactivated row fails on both counts). Matches
// data-quality's own DASHBOARD_SOURCES ceiling for this same source, so the
// two systems agree on what counts as too stale to show.
const DENGUE_STALE_CEILING_DAYS = 180;

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
      // fetchWithRetry: 2 attempts, 5s each — see fetchMeaslesGHO above and
      // lib/fetch-retry.ts (2026-09-02). Worst-case wait per call stays close
      // to the original single 10s attempt (this function can make up to 2
      // such calls per target on a full sumYear→latestUrl fallback).
      const { response: res } = await fetchWithRetry(url, { headers: { "User-Agent": ua } }, { attempts: 2, timeoutMs: 5000, backoffMs: [500] });
      if (!res || !res.ok) return null;
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

    const withinCeiling = (found: Found | null): Found | null => {
      if (!found) return null;
      const daysSince = Math.round((Date.now() - new Date(found.date).getTime()) / 86_400_000);
      return daysSince <= DENGUE_STALE_CEILING_DAYS ? found : null;
    };

    try {
      const current = await sumYear(new Date().getFullYear());
      if (current) return current; // this year's own data is never stale enough to hit the ceiling

      // No data yet for the current year — reporting lag into this WHO dataset
      // varies a lot by country (some are over a year behind). Fall back to the
      // most recent year with any data at all, so the row still reflects a real
      // WHO figure instead of silently reporting nothing — but only up to
      // DENGUE_STALE_CEILING_DAYS old; past that, WHO has effectively stopped
      // covering this country in this dataset and returning null (no write at
      // all) is more honest than reactivating a multi-year-old figure.
      const latestUrl =
        `${base}?%24filter=ISO3%20eq%20'${iso3}'%20and%20CASES%20ne%20null` +
        `&%24orderby=START_DATE%20desc&%24top=1&excludeSysColumns=0`;
      const { response: latestRes } = await fetchWithRetry(latestUrl, { headers: { "User-Agent": ua } }, { attempts: 2, timeoutMs: 5000, backoffMs: [500] });
      if (!latestRes || !latestRes.ok) return null;
      const latestJson = await latestRes.json() as { value: Rec[] };
      const lastYear = latestJson.value?.[0]?.YEAR;
      return withinCeiling(lastYear ? await sumYear(lastYear) : null);
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
  "Rwanda":     "RWA",
  "Uganda":     "UGA",
  "Burundi":    "BDI",
  "Kenya":      "KEN",
  "Madagascar": "MDG",
};

function fetchMpoxGlobalSurveillance(country_en: string): () => Promise<Found | null> {
  return async () => {
    const iso3 = MPOX_ISO3[country_en];
    if (!iso3) return null;
    const url =
      `https://xmart-api-public.who.int/MPX/V_MPX_VALIDATED_DAILY` +
      `?%24filter=ISO3%20eq%20'${iso3}'&%24orderby=DATE%20desc&%24top=1&excludeSysColumns=0`;
    // fetchWithRetry: 2 attempts, 5s each — see fetchMeaslesGHO above and
    // lib/fetch-retry.ts (2026-09-02).
    const { response: res } = await fetchWithRetry(
      url, { headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" } },
      { attempts: 2, timeoutMs: 5000, backoffMs: [500] },
    );
    if (!res || !res.ok) return null;
    try {
      type Rec = { DATE: string; TOTAL_CONF_CASES: number | null; TOTAL_PROB_CASES: number | null; TOTAL_CONF_DEATHS: number | null };
      const json = await res.json() as { value?: Rec[] };
      const rec = json.value?.[0];
      if (!rec?.DATE) return null;

      const cases  = (rec.TOTAL_CONF_CASES ?? 0) + (rec.TOTAL_PROB_CASES ?? 0);
      const deaths = rec.TOTAL_CONF_DEATHS ?? 0;
      if (cases <= 0) return null;

      // Same ceiling as fetchDengueGlobalSurveillance's DENGUE_STALE_CEILING_DAYS,
      // same reasoning: this always takes WHO's single latest datapoint regardless
      // of age, and the write path below sets `active: true` unconditionally — no
      // live incident found here today (all 4 Mpox rows were within ~4 months as
      // of 2026-07-28), but the exact same silent-reactivation risk exists if this
      // WHO feed ever goes quiet for a country the way the Dengue one did for Haiti.
      const daysSince = Math.round((Date.now() - new Date(rec.DATE).getTime()) / 86_400_000);
      if (daysSince > DENGUE_STALE_CEILING_DAYS) return null;

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
  // Ajoutés le 2026-08-24 après le premier audit de couverture
  // (scripts/coverage-cholera.mjs). La couche ArcGIS déclare 27 pays pour 2026 ;
  // cette liste en câblait 14, dont 11 seulement présents dans la couche. Angola
  // et Yémen étaient dans le pire cas possible : une cible existait pour le Yémen
  // mais SANS fetcher (donc sur le repli ReliefWeb, un parseur de prose), l'Angola
  // n'avait aucune cible, et les deux lignes se sont retrouvées désactivées,
  // arrêtées au 31/05, pendant que l'OMS continuait de publier — Angola jusqu'au
  // 13/07 (5 361 cas / 117 décès), Yémen jusqu'au 29/06 (5 196 / 7). Des épidémies
  // en cours affichées comme closes : un défaut visible côté client, pas un simple
  // trou de fraîcheur.
  //
  // Les autres pays déclarés et non câblés ne sont volontairement PAS ajoutés ici
  // dans le même lot — voir le commentaire au-dessus de la cible Angola.
  "Angola":                        "AGO",
  "Yemen":                         "YEM",
  // Pakistan / Burundi : aucune ligne en base, aucune cible, alors que l'OMS déclare
  // 4 184 cas (dernière semaine 06/07) et 1 537 cas / 4 décès (06/07). Deux épidémies
  // réelles, entièrement absentes du produit — le cas que le contrôle de fraîcheur ne
  // peut par construction jamais voir, puisqu'il n'y a pas de ligne à trouver périmée.
  "Pakistan":                      "PAK",
  "Burundi":                       "BDI",
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
      // fetchWithRetry: 2 attempts, 5s each — see fetchMeaslesGHO above and
      // lib/fetch-retry.ts (2026-09-02). Worst-case wait per call stays close
      // to the original single 10s attempt (this function can make up to 2
      // such calls per target on a full sumYear→probeUrl fallback).
      const { response: res } = await fetchWithRetry(url, { headers: { "User-Agent": ua } }, { attempts: 2, timeoutMs: 5000, backoffMs: [500] });
      if (!res || !res.ok) return null;
      const json = await res.json() as { features?: Feature[]; error?: unknown };
      const features = json.features ?? [];
      if (json.error || features.length === 0) return null;

      let cases = 0, deaths = 0, latestMs = 0, anyDeathsReported = false;
      for (const f of features) {
        cases += f.attributes.cases ?? 0;
        // ?? 0 here would silently equate "not reported" with "confirmed
        // zero" — exactly what let a fresh 0 overwrite a manually-verified
        // NULL on Pakistan/cholera on 2026-08-24/25 (the write-time guard
        // that should have blocked it, zeroDeathGuard, also coerces existing
        // NULL to 0 via `?? 0`, so it never saw a difference to refuse).
        // Tracking whether ANY feature carried a real figure lets a whole
        // year of unreported deaths surface as null instead of 0.
        if (f.attributes.deaths != null) { deaths += f.attributes.deaths; anyDeathsReported = true; }
        if (f.attributes.date_wk > latestMs) latestMs = f.attributes.date_wk;
      }
      if (cases <= 0 || !latestMs) return null;
      const date = new Date(latestMs).toISOString().substring(0, 10);
      const finalDeaths = anyDeathsReported ? deaths : null;

      return {
        cases,
        deaths: finalDeaths,
        date,
        // Old URL (emergencies/situations/multi-country-outbreak-of-cholera) 404s as of
        // 2026-07-14 — WHO restructured the page. This one was live-verified same day.
        source: "https://www.who.int/emergencies/surveillance/cholera-cases-and-deaths",
        description: `Cholera in ${country_en} — WHO reported ${cases.toLocaleString("en")} cumulative case${cases > 1 ? "s" : ""}${finalDeaths ? ` and ${finalDeaths.toLocaleString("en")} death${finalDeaths > 1 ? "s" : ""}` : ""} in ${year} as of the week starting ${date}. Source: WHO Global Cholera Surveillance.`,
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
      const { response: probeRes } = await fetchWithRetry(probeUrl, { headers: { "User-Agent": ua } }, { attempts: 2, timeoutMs: 5000, backoffMs: [500] });
      if (!probeRes || !probeRes.ok) return null;
      const probeJson = await probeRes.json() as { features?: Feature[] };
      const lastMs = probeJson.features?.[0]?.attributes.date_wk;
      return lastMs ? await sumYear(new Date(lastMs).getUTCFullYear()) : null;
    } catch {
      return null;
    }
  };
}

// ── ECDC West Nile virus weekly surveillance ──────────────────────────────────
// The weekly WNV page (wnv-weekly.ecdc.europa.eu) looks JS-rendered at first
// glance — a plain fetch through data-quality's own DON verifier-style logic
// returns junk (EXIF/XML-looking noise) when run through a markdown-conversion
// tool — but it's actually a static R/Quarto-generated page: the full per-area
// data table is embedded as JSON inside a single `<script type="application/
// json">` tag (a serialized DT::datatable htmlwidget, COLUMN-major: one array
// per column — country/NUTS code/area/first-reported/probable/confirmed/total —
// not one array per row, confirmed by inspecting a live fetch 2026-08-12: the
// country column repeats "Italy" 36 times in a row before switching to the next
// country, matching Italy's 36 affected areas exactly). No headless browser
// needed despite puppeteer-core/@sparticuz/chromium being available as deps.
// Season total + per-country breakdown verified 2026-08-12 against the live
// rendered page (browser tool, JS executed): Italy 139/36 areas, Greece 61/9,
// Spain 17/2, North Macedonia 13/3, Romania 6/6, France 4/2, Germany 1/1 —
// exact match against this fetcher's plain-fetch parse of the raw HTML.
const ECDC_MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};
function parseEcdcDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!m) return null;
  const mm = ECDC_MONTHS[m[2].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

interface WnvSeason {
  weekMatch:     RegExpMatchArray;
  producedMatch: RegExpMatchArray;
  date:          string;
  byCountry:     Map<string, { cases: number; areas: number }>;
  sorted:        [string, { cases: number; areas: number }][];
  totalCases:    number;
  totalAreas:    number;
  countryList:   string;
}

// Module-level cache for the ONE WNV weekly-page fetch AND parse shared by
// all 7 European country targets — before 2026-09-02 each target refetched
// AND reparsed the exact same page independently (the season totals below
// are identical for every country, since they aggregate across all of them).
// Reset at the top of runSyncWhoRegional() so a warm serverless container
// never serves a previous run's cached page across days.
let wnvSeasonCache: Promise<WnvSeason | null> | null = null;

async function getWnvSeason(): Promise<WnvSeason | null> {
  if (!wnvSeasonCache) {
    wnvSeasonCache = (async () => {
      // fetchWithRetry: 2 attempts, 7.5s each (worst case ~16s, close to the
      // original single 15s attempt) — safe to add now that this runs once
      // per run instead of once per target. See lib/fetch-retry.ts
      // (2026-09-02).
      const { response: res } = await fetchWithRetry(
        "https://wnv-weekly.ecdc.europa.eu/",
        { headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)", "Accept": "text/html,*/*" } },
        { attempts: 2, timeoutMs: 7500, backoffMs: [1000] },
      );
      if (!res || !res.ok) return null;
      try {
        const html = await res.text();

        // "Week 32, 2026" / "Produced on 7 August 2026 at 10:00, based on data
        // submitted up until and including 5 August 2026." The exact data-cutoff
        // date (the second one) didn't survive a plain regex reliably — some markup
        // splits that specific phrase — so `date` uses the produced-on date
        // instead, which is always present and only ever 1-2 days later.
        const weekMatch     = html.match(/Week\s+(\d+),\s*(\d{4})/);
        const producedMatch = html.match(/Produced on\s+(\d{1,2}\s+\w+\s+\d{4})/);
        if (!weekMatch || !producedMatch) return null;
        const date = parseEcdcDate(producedMatch[1]);
        if (!date) return null;

        const jsonMatch = html.match(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
        if (!jsonMatch) return null;
        let data: unknown;
        try { data = (JSON.parse(jsonMatch[1]) as { x?: { data?: unknown } })?.x?.data; } catch { return null; }
        if (!Array.isArray(data) || data.length < 7) return null;
        const countries = data[0] as unknown[];
        const totals    = data[6] as unknown[];
        if (!Array.isArray(countries) || !Array.isArray(totals) || countries.length !== totals.length) return null;

        const byCountry = new Map<string, { cases: number; areas: number }>();
        for (let i = 0; i < countries.length; i++) {
          const c = countries[i];
          if (typeof c !== "string" || typeof totals[i] !== "number") continue;
          const cur = byCountry.get(c) ?? { cases: 0, areas: 0 };
          cur.cases += totals[i] as number;
          cur.areas += 1;
          byCountry.set(c, cur);
        }

        const sorted = [...byCountry.entries()].sort((a, b) => b[1].cases - a[1].cases);
        let totalCases = 0, totalAreas = 0;
        for (const [, v] of sorted) { totalCases += v.cases; totalAreas += v.areas; }
        const countryList = sorted.map(([c, v]) => `${c} ${v.cases}`).join(", ");

        return { weekMatch, producedMatch, date, byCountry, sorted, totalCases, totalAreas, countryList };
      } catch {
        return null;
      }
    })();
  }
  return wnvSeasonCache;
}

function fetchWNVEcdc(countryEn: string): () => Promise<Found | null> {
  return async () => {
    const season = await getWnvSeason();
    if (!season) return null;
    const target = season.byCountry.get(countryEn);
    // Country absent from this week's table (season not started yet there, or
    // over) — return null and let the row hold its last real value rather than
    // guess; this source has no "outbreak declared over" signal to auto-
    // deactivate on, unlike the WHO DON pages section 4e of data-quality reads.
    if (!target || target.cases <= 0) return null;

    return {
      cases:  target.cases,
      // Not tracked by this source at all (no deaths column or mention
      // anywhere on the page) — 0 means "unreported", same convention as every
      // other fetcher here that only has a case figure. zeroDeathGuard still
      // protects a real future death count from being overwritten by this
      // permanently-0 value.
      deaths: 0,
      date: season.date,
      source: "https://wnv-weekly.ecdc.europa.eu/",
      description: `West Nile virus, ${season.weekMatch[2]} European transmission season: ${target.cases} locally acquired human cases reported in ${countryEn} as at ${season.producedMatch[1]}, across ${target.areas} affected area${target.areas === 1 ? "" : "s"}. Season total across ${season.sorted.length} European countries: ${season.totalCases} cases in ${season.totalAreas} affected areas (${season.countryList}). Source: ECDC, Surveillance of West Nile Virus infections in humans in Europe, weekly report, week ${season.weekMatch[1]}, produced ${season.producedMatch[1]}.`,
    };
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

interface MeningitisBulletin {
  table: Map<string, { cases: number; deaths: number }>;
  year:  number;
  week:  number;
  url:   string;
}

// Module-level cache for the ONE candidate-week/folder search shared by all 4
// meningitis-belt targets — before 2026-09-02 each target independently
// re-ran the same up-to-18-URL search (candidates × MENINGITIS_FOLDERS) from
// scratch, even though the discovered edition and its table are identical for
// every country (only the final `table.get(label)` lookup differs). Reset at
// the top of runSyncWhoRegional() so a warm serverless container never serves
// a previous run's cached edition across days.
let meningitisCache: Promise<MeningitisBulletin | null> | null = null;

async function getMeningitisBulletin(): Promise<MeningitisBulletin | null> {
  if (!meningitisCache) {
    meningitisCache = (async () => {
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
          // fetchWithRetry: 2 attempts, 7.5s each. Safe on every one of up to
          // 18 candidates — most misses here are a deliberate 404 (guessing
          // which week/folder is the real edition), and fetchWithRetry never
          // retries 4xx, so the worst case stays close to the original single
          // 15s attempt per candidate. Only a genuine transient blip on the
          // URL that WOULD have worked gets the extra try. See
          // lib/fetch-retry.ts (2026-09-02).
          const { response: res } = await fetchWithRetry(url, { headers: { "User-Agent": ua } }, { attempts: 2, timeoutMs: 7500, backoffMs: [500] });
          if (!res || !res.ok) continue;
          try {
            const table = await extractMeningitisTable(Buffer.from(await res.arrayBuffer()));
            if (!table) continue;
            return { table, year, week, url };
          } catch {
            continue;
          }
        }
      }
      return null;
    })();
  }
  return meningitisCache;
}

function fetchMeningitisAFRO(country_en: string): () => Promise<Found | null> {
  return async () => {
    const label = Object.entries(MENINGITIS_LABELS).find(([, en]) => en === country_en)?.[0];
    if (!label) return null;

    const bulletin = await getMeningitisBulletin();
    if (!bulletin) return null;
    const row = bulletin.table.get(label);
    if (!row || row.cases <= 0) return null; // verified table, but no data for this country this edition
    return {
      cases:  row.cases,
      deaths: row.deaths,
      date:   isoWeekEndDate(bulletin.year, bulletin.week),
      source: bulletin.url,
      description: `Meningitis in ${country_en} — WHO AFRO reported ${row.cases.toLocaleString("en")} cumulative case${row.cases > 1 ? "s" : ""}${row.deaths > 0 ? ` and ${row.deaths.toLocaleString("en")} death${row.deaths > 1 ? "s" : ""}` : ""}, weeks 1-${bulletin.week} of ${bulletin.year}. Source: WHO AFRO Meningitis Weekly Bulletin (cross-checked against the bulletin's own printed regional total).`,
    };
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
      const description = truncateAtSentence(text.trim(), 500);

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
  // Angola / Yémen : passés au fetcher ArcGIS le 2026-08-24 (audit de couverture,
  // scripts/coverage-cholera.mjs). Le Yémen était déjà une cible mais sans fetcher,
  // donc servi par le repli ReliefWeb — extraction de chiffres dans de la prose de
  // sitrep. Ce repli a cessé de produire, la ligne a vieilli puis a été désactivée
  // par le balayage de fraîcheur, et personne ne l'a vu : une ligne close ne
  // déclenche aucun contrôle de fraîcheur. L'Angola n'avait même pas de cible.
  //
  // Les deux lignes existent en base, inactives à source_priority=0 : le chemin de
  // réactivation (`directCheck` plus bas) les retrouvera par disease+country et les
  // repassera à active=true, sp=5, avec les chiffres OMS. Les gardes s'appliquent
  // normalement — les deux pays sont en hausse par rapport à ce qui est stocké, donc
  // ni collapseGuard ni dateFloorGuard ne s'y opposent.
  //
  // Pourquoi ce lot s'arrête là. L'audit a relevé 16 pays déclarés non câblés, mais
  // ils ne se valent pas :
  //   · Éthiopie — dernière semaine OMS le 09/03, la base porte 50 cas au 31/05.
  //     La base est DEVANT et l'événement est éteint : la ligne est close à raison,
  //     et dateFloorGuard refuserait de toute façon d'écrire une date plus ancienne.
  //   · Somalie, Cameroun, RCA, Tanzanie, Tchad — la base est également devant la
  //     couche ArcGIS (Somalie 233 contre 151, couche arrêtée au 12/01 ; Tanzanie
  //     113 contre 54, arrêtée au 19/01). Toutes sont à sp=10, tenues à la main.
  //     Les câbler ne dégraderait rien — lockedRowRegressionGuard refuse toute
  //     baisse — mais chaque refus part dans lockedGuardBlocked, ce qui marquerait
  //     ce cron EN ERREUR à chaque passage et enverrait une alerte Sentry. Du bruit
  //     permanent pour ne rien gagner.
  //   · Soudan du Sud, Soudan, Congo, RD Congo — l'ArcGIS a bien de l'avance sur les
  //     chiffres WER appliqués à la main (SSD 12 411 contre 10 526), mais ces quatre
  //     lignes forment le cluster de seeds DON579 et le payload de ce cron écrit
  //     `is_seed: isAnnualRef`, donc `false` : les câbler les SORTIRAIT du cluster,
  //     que la section 4a de morning-don-check compte à 4 pays. Décision produit,
  //     pas correctif — laissée ouverte.
  //   · Myanmar 258, Namibie 188, Rwanda 58, Inde 36, Afrique du Sud 2 — volumes
  //     trop faibles pour justifier une ligne. ⚠️ À savoir si on les câble un jour :
  //     `minCases` n'est PAS appliqué aux résultats de fetcher (seul queryReliefWeb
  //     le teste), malgré le message de log qui prétend le contraire. Le Kenya, câblé
  //     à 40 cas pour un minCases de 50, en dépend — ne pas « corriger » ça sans
  //     vérifier qui d'autre en vit.
  { disease_en: "Cholera", country_en: "Angola", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Angola") },
  { disease_en: "Cholera", country_en: "Yemen",  minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Yemen")  },
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
  // Ajoutés le 2026-08-24 (audit de couverture). Contrairement à l'Angola et au Yémen,
  // ces deux-là n'ont AUCUNE ligne en base : le chemin d'insertion s'appliquera, pas
  // celui de réactivation. C'est le trou que rien dans le dépôt ne pouvait signaler —
  // toute la machinerie de fraîcheur part d'une ligne existante, et on ne peut pas
  // trouver périmée une ligne qui n'existe pas.
  { disease_en: "Cholera", country_en: "Pakistan", minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Pakistan") },
  { disease_en: "Cholera", country_en: "Burundi",  minCases: 50, fetcher: fetchCholeraGlobalSurveillance("Burundi")  },
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
  // West Nile: already in disease-data.ts. These 7 had no working fetcher at all
  // until 2026-08-12 (Italy/Greece/Romania listed here with no `fetcher`, so they
  // silently fell through to ReliefWeb; Spain/North Macedonia weren't even
  // listed) — data-quality flagged Spain/N.Macedonia/Romania/Greece as 3-week
  // stale, and it turned out there was no cron keeping any of them current, just
  // one-off manual inserts. fetchWNVEcdc (above) now covers the current season's
  // full country set — see that function's own comment for how it reads ECDC's
  // page. If a new country appears in a future season, add it here the same way.
  { disease_en: "West Nile fever", country_en: "Italy",           minCases: 10, fetcher: fetchWNVEcdc("Italy") },
  { disease_en: "West Nile fever", country_en: "Greece",          minCases:  5, fetcher: fetchWNVEcdc("Greece") },
  { disease_en: "West Nile fever", country_en: "Romania",         minCases:  5, fetcher: fetchWNVEcdc("Romania") },
  { disease_en: "West Nile fever", country_en: "Spain",           minCases:  1, fetcher: fetchWNVEcdc("Spain") },
  { disease_en: "West Nile fever", country_en: "North Macedonia", minCases:  1, fetcher: fetchWNVEcdc("North Macedonia") },
  { disease_en: "West Nile fever", country_en: "France",          minCases:  1, fetcher: fetchWNVEcdc("France") },
  { disease_en: "West Nile fever", country_en: "Germany",         minCases:  1, fetcher: fetchWNVEcdc("Germany") },

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
  // Madagascar: top mpox-reporting country worldwide since 2026 (546 cases in June 2026 alone,
  // ~48% of the global monthly total per WHO situation report 68) — missing from this list
  // entirely until 2026-08-12, a pure allowlist omission (WHO's own MPX/V_MPX_VALIDATED_DAILY
  // mart already covers it, same as the other 4 countries below).
  { disease_en: "Mpox", country_en: "Madagascar", minCases: 1, fetcher: fetchMpoxGlobalSurveillance("Madagascar") },

  // ── Rift Valley Fever — expansion beyond Kenya ────────────────────────────────
  // Rwanda: large RVF outbreak in livestock and humans 2024–2025; WHO AFRO + OCHA on ReliefWeb
  { disease_en: "Rift Valley", country_en: "Rwanda",                              minCases:      1 },
  { disease_en: "Rift Valley", country_en: "Uganda",                              minCases:      1 },
  { disease_en: "Rift Valley", country_en: "Tanzania",                            minCases:      1 },

  // ── Polio — cVDPV expansion beyond endemic Pakistan/Afghanistan ──────────────
  // fetchPolioGPEIThisWeek (defined above, next to fetchPolioGHO): weekly prose
  // bulletin from GPEI, the only 13 countries this cron has ever tracked
  // outbreak-style cVDPV for (add-cvdpv-africa-gpei-2026-08-22.mjs). Nigeria and
  // DRC already existed as targets but with no fetcher — WHO DON dedup guard
  // only covers a DON actually being published for these, which happens rarely;
  // the other 11 existed only as DB rows with no cron watching them at all until
  // today. minCases:1 kept for parity with the rest of the file even though the
  // fetcher's own `total <= 0` check already excludes a zero result.
  { disease_en: "Polio", country_en: "Nigeria",                                   minCases: 1, fetcher: fetchPolioGPEIThisWeek("Nigeria") },
  { disease_en: "Polio", country_en: "Democratic Republic of the Congo",          minCases: 1, fetcher: fetchPolioGPEIThisWeek("Democratic Republic of the Congo") },
  { disease_en: "Polio", country_en: "Chad",                                      minCases: 1, fetcher: fetchPolioGPEIThisWeek("Chad") },
  { disease_en: "Polio", country_en: "Sudan",                                     minCases: 1, fetcher: fetchPolioGPEIThisWeek("Sudan") },
  { disease_en: "Polio", country_en: "Central African Republic",                  minCases: 1, fetcher: fetchPolioGPEIThisWeek("Central African Republic") },
  { disease_en: "Polio", country_en: "Somalia",                                   minCases: 1, fetcher: fetchPolioGPEIThisWeek("Somalia") },
  { disease_en: "Polio", country_en: "South Sudan",                               minCases: 1, fetcher: fetchPolioGPEIThisWeek("South Sudan") },
  { disease_en: "Polio", country_en: "Ethiopia",                                  minCases: 1, fetcher: fetchPolioGPEIThisWeek("Ethiopia") },
  { disease_en: "Polio", country_en: "Niger",                                     minCases: 1, fetcher: fetchPolioGPEIThisWeek("Niger") },
  { disease_en: "Polio", country_en: "Togo",                                      minCases: 1, fetcher: fetchPolioGPEIThisWeek("Togo") },
  { disease_en: "Polio", country_en: "Mali",                                      minCases: 1, fetcher: fetchPolioGPEIThisWeek("Mali") },
  { disease_en: "Polio", country_en: "Angola",                                    minCases: 1, fetcher: fetchPolioGPEIThisWeek("Angola") },
  { disease_en: "Polio", country_en: "Madagascar",                                minCases: 1, fetcher: fetchPolioGPEIThisWeek("Madagascar") },

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

// Exported for the fetcher-coverage probe (data-quality section 4o, lib/fetcher-coverage.ts,
// 2026-09-03) — a disease+country pair here means SOME cron will re-check this row on its next
// scheduled run, regardless of whether that run finds anything worth writing. Derived from
// TARGETS itself rather than duplicated, so it can't drift out of sync with additions/removals.
//
// MUST run each entry through normalizeDisease()/findCountry(), the same way the main loop's
// own dcKey does a few hundred lines below (`diseaseInfo.name_en`/`countryInfo.name_en`, not
// the raw target.disease_en/country_en strings) — TARGETS deliberately uses shorthand ("Dengue",
// "DR Congo" would be typed here) that only matches the DB's canonical disease_en/country_en
// columns AFTER normalization. Skipping this step was tried first and produced 45/129 active
// rows misreported as uncovered — e.g. every India/Bangladesh/Colombia/... Dengue TARGETS entry,
// because this array's `disease_en: "Dengue"` normalizes to the DB's stored "Dengue fever".
export const TARGET_KEYS = new Set(
  TARGETS.map((t) => {
    const diseaseInfo = normalizeDisease(t.disease_en);
    const countryInfo = findCountry(t.country_en);
    return `${diseaseInfo.name_en.toLowerCase()}|${(countryInfo?.name_en ?? t.country_en).toLowerCase()}`;
  })
);

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

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  try {
    return await runSyncWhoRegional(req, supabase);
  } catch (err) {
    console.error("[sync-who-regional] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-who-regional" } });
    await logCronRun(supabase, "sync-who-regional", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncWhoRegional(_req: NextRequest, supabase: SupabaseClient) {
  const today = new Date().toISOString().substring(0, 10);

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
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
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
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — see the two push sites below (main update
  // branch and the reactivate branch) for why these, and only these, need to
  // reach the health-check. Both call sites feed this one array.
  const lockedGuardBlocked: string[] = [];
  // Rows this run re-read from the source and found unchanged — stamped as
  // verified in one batched write after the loop (see lib/source-confirmed.ts).
  const sourceConfirmed: string[] = [];
  // Reset the GPEI/WNV/meningitis shared-page caches for this run — see
  // getGpeiSection(), getWnvSeason() and getMeningitisBulletin() above.
  // Without this, a warm serverless container could in principle serve a
  // previous invocation's cached page across days.
  gpeiSectionCache  = null;
  wnvSeasonCache    = null;
  meningitisCache   = null;
  const loopStart = Date.now();

  // Process each target
  for (const target of TARGETS) {
    // Bail out before the Vercel maxDuration kills the function outright — a
    // partial run that still logs/upserts what it processed beats a hard
    // timeout with nothing persisted. Remaining targets are picked up on the
    // next scheduled run. See TARGET_LOOP_BUDGET_MS above.
    if (Date.now() - loopStart > TARGET_LOOP_BUDGET_MS) {
      log.push({ label: "budget", status: "skip", detail: `time budget exceeded, ${TARGETS.length - results.skipped - results.inserted - results.updated - results.errors} target(s) left unprocessed` });
      break;
    }

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

    // Never overwrite rows managed by PAHO's alert/sitrep sync. GHO annual
    // reference figures (this cron) are always coarser than a PAHO
    // Epidemiological Alert — without this, sync-who-regional and
    // sync-paho-alerts fight over the same row daily, since both write at
    // source_priority=5 and neither treated the other as authoritative.
    // Found 2026-07-19 on Diphtheria/Haiti — see
    // project_diphtheria_haiti_source_priority_collision memory.
    if (existingRow?.source?.includes("paho.org")) {
      log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "owned by PAHO alert sync" });
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

    // Guards/assessRisk take a concrete number (GuardedIncoming/assessRisk
    // aren't nullable — shared by 12+ other cron files, not worth widening
    // for this one fetcher). A coalesced 0 is the correct conservative input
    // for them: "no death data this week" should be guarded exactly as
    // cautiously as a real zero. Only the actual DB write and the diff check
    // below use found.deaths itself, so a manually-verified null still
    // persists instead of being overwritten by this coalescing.
    const guardedFound = { ...found, deaths: found.deaths ?? 0 };

    if (existingRow) {
      const isNewer    = found.date > existingRow.date;
      const casesDiff  = found.cases  !== existingRow.cases;
      const deathsDiff = found.deaths !== existingRow.deaths;

      if (!isNewer && !casesDiff && !deathsDiff) {
        // Source fetched and an entry for this row parsed, carrying nothing
        // newer than the row's `date` — that is a verification, not merely
        // "nothing to write". Recorded so the row stops ageing towards the
        // "no update" badge while its source confirms it every run.
        sourceConfirmed.push(existingRow.id);
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "data unchanged — source confirmed" });
        results.skipped++;
        continue;
      }

      // A fetch dated before what's already stored is a regression, not an
      // update — e.g. the meningitis multi-week fallback landing on an older
      // week because the latest week's PDF failed table validation (found
      // 2026-07-20: self-regressed weeks 26→25, since casesDiff alone was
      // enough to pass the check above). Refuse rather than silently walking
      // case counts backward. Same root cause as the WHO-regional/PAHO Haiti
      // collision guarded by source ownership above — here it's the same
      // fetcher regressing against itself, so ownership can't help; a date
      // floor can.
      //
      // Spike/collapse/zero protection added 2026-08-02, same guard family as
      // sync-who-afro/sync-cdc-notices, shared via lib/outbreak-guards.ts —
      // only the date floor above existed until now.
      const guardReason =
        dateFloorGuard(guardedFound, existingRow) ??
        spikeGuard(guardedFound, existingRow) ??
        collapseGuard(guardedFound, existingRow) ??
        zeroCaseGuard(guardedFound, existingRow) ??
        zeroDeathGuard(guardedFound, existingRow) ??
        lockedRowRegressionGuard(guardedFound, existingRow);
      if (guardReason) {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: guardReason });
        results.skipped++;
        // A refusal on a locked (source_priority>=10) row is not an
        // ordinary skip: nothing else will ever write this row again, so a
        // silently-blocked write freezes it on stale figures forever with
        // nothing to show for it (see check-mpox-sitrep/route.ts and
        // project_source_priority_is_ownership_not_freeze_2026_08_19).
        // Ordinary guards (dateFloor/spike/collapse/zeroCase/zeroDeath) stay
        // unreported here — their regular-operation volume isn't measured,
        // so surfacing them too would risk drowning the health-check in
        // noise.
        // …but only while that premise holds: a locked row its owning source refreshed
        // days ago is being protected, not frozen, and escalating it every run buries
        // the next real failure of this cron. See lockedRowIsFreezing (2026-08-24).
        if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(existingRow)) lockedGuardBlocked.push(`${target.disease_en}/${target.country_en}: ${guardReason}`);
        continue;
      }

      const updatePayload: Record<string, unknown> = {
        cases:           found.cases,
        deaths:          found.deaths,
        date:            found.date,
        source:          found.source,
        description:     found.description,
        risk_level:      assessRisk(target.disease_en, found.description, found.cases, guardedFound.deaths),
        active:          activeFlag,
        is_seed:         isAnnualRef,
        source_priority: Math.max(5, existingRow.source_priority ?? 0),
        // `Found` (above) has no admin1 field — no fetcher in this file has ever
        // populated one, since they're all national/regional aggregates, not
        // sub-national. Any admin1 already on the row is therefore guaranteed to
        // be a leftover from a *different* source that no longer backs it (e.g.
        // Nigeria/Cholera carried admin1="Borno" from an earlier DON-based entry
        // after this cron switched it to the country-level-only WHO ArcGIS feed,
        // "cholera_adm0_week_view" — "adm0" = admin level 0 = country). Clearing
        // it here keeps every row this cron writes internally consistent with
        // data-quality's 4i admin1-groundedness check (found 2026-08-12).
        admin1:          null,
      };
      // English description just changed — existing FR/ES/AR/ID translations
      // (if any) now describe stale figures. Null them so sync-outbreaks'
      // backfill sweep re-translates from the fresh text (it only fires when
      // description_fr IS NULL — see project_sync_outbreaks_paho_translation_drift_fixed).
      if (existingRow.description !== found.description) {
        updatePayload.description_fr = null;
        updatePayload.description_es = null;
        updatePayload.description_ar = null;
        updatePayload.description_id = null;
      }
      // .select("id") so a source_priority guard that blocks the write (row now
      // owned by a higher-priority source) is visible as 0 affected rows —
      // without it, a blocked update still returns error: null and was
      // reported as "updated" even though nothing changed. Found 2026-07-15.
      const { data: updatedRows, error } = await supabase
        .from("outbreaks")
        .update(updatePayload)
        .eq("id", existingRow.id)
        .lte("source_priority", 10)
        .select("id");

      if (error) {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "error", detail: error.message });
        results.errors++;
      } else if (!updatedRows || updatedRows.length === 0) {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
        results.skipped++;
      } else {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "updated", detail: `${found.cases} cases / ${found.deaths ?? "unreported"} deaths (${found.date})` });
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
        .select("id, cases, deaths, date, active, description, source_priority")
        .eq("disease_en", diseaseInfo.name_en)
        .eq("country_en", countryInfo.name_en)
        .order("is_seed", { ascending: false })
        .order("source_priority", { ascending: false })
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (directCheck) {
        // Row already exists (likely deactivated + old) — reactivate and update.
        // Had no anti-regression guard at all until 2026-08-02 (not even a date
        // floor) — same guard family as the main existingRow branch above.
        const reactivateGuardReason =
          dateFloorGuard(guardedFound, directCheck) ??
          spikeGuard(guardedFound, directCheck) ??
          collapseGuard(guardedFound, directCheck) ??
          zeroCaseGuard(guardedFound, directCheck) ??
          zeroDeathGuard(guardedFound, directCheck) ??
          lockedRowRegressionGuard(guardedFound, directCheck);
        if (reactivateGuardReason) {
          log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: reactivateGuardReason });
          results.skipped++;
          // Same locked-row surfacing as the main update branch above — see
          // its comment for the full rationale. Feeds the same
          // lockedGuardBlocked array.
          // …but only while that premise holds: a locked row its owning source refreshed
          // days ago is being protected, not frozen, and escalating it every run buries
          // the next real failure of this cron. See lockedRowIsFreezing (2026-08-24).
          if (reactivateGuardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(directCheck)) lockedGuardBlocked.push(`${target.disease_en}/${target.country_en}: ${reactivateGuardReason}`);
          continue;
        }

        const reactivatePayload: Record<string, unknown> = {
          cases: found.cases, deaths: found.deaths, date: found.date,
          source: found.source, description: found.description,
          active: activeFlag, is_seed: isAnnualRef,
          risk_level: assessRisk(target.disease_en, found.description, found.cases, guardedFound.deaths),
          source_priority: Math.max(5, directCheck.source_priority ?? 0),
          admin1: null, // same reasoning as the main update branch above — see its comment
        };
        if (directCheck.description !== found.description) {
          reactivatePayload.description_fr = null;
          reactivatePayload.description_es = null;
          reactivatePayload.description_ar = null;
          reactivatePayload.description_id = null;
        }
        // .select("id") so a source_priority guard that blocks the write (row now
        // owned by a higher-priority source) is visible as 0 affected rows —
        // without it, a blocked update still returns error: null and was
        // reported as "updated" even though nothing changed. Found 2026-07-15.
        const { data: updatedRows, error } = await supabase
          .from("outbreaks")
          .update(reactivatePayload)
          .eq("id", directCheck.id)
          .lte("source_priority", 10)
          .select("id");
        if (error) {
          log.push({ label: `${target.disease_en}/${target.country_en}`, status: "error", detail: error.message });
          results.errors++;
        } else if (!updatedRows || updatedRows.length === 0) {
          log.push({ label: `${target.disease_en}/${target.country_en}`, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
          results.skipped++;
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
        risk_level:  assessRisk(target.disease_en, found.description, found.cases, guardedFound.deaths),
        date:        found.date,
        source:      found.source,
        description: found.description,
        active:      activeFlag,
        is_seed:     isAnnualRef,
        is_backfill: isAnnualRef,
        source_priority: 5,
      });

      if (error) {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ label: `${target.disease_en}/${target.country_en}`, status: "inserted", detail: `${found.cases} cases / ${found.deaths ?? "unreported"} deaths (${found.date})` });
        results.inserted++;
      }
    }
  }

  // One batched verification stamp for every row the source confirmed
  // unchanged. Never fatal: a failed stamp costs freshness metadata, not
  // data, so it is logged and the run still reports on its actual writes.
  const confirmed = await stampSourceConfirmed(supabase, sourceConfirmed);
  if (confirmed.error) console.error("[regional] source_confirmed_at stamp failed:", confirmed.error);

  console.log("[regional] Done:", results, log, `confirmed=${confirmed.stamped}`);
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[who-regional] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }
  // Was hardcoded "ok" regardless of results.errors — same bug as
  // sync-outbreaks (2026-07-29).
  await logCronRun(supabase, "sync-who-regional", results.errors > 0 || lockedGuardBlocked.length > 0 ? "error" : "ok", results.inserted ?? 0,
    lockedGuardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
      : results.errors > 0 ? `${results.errors} écriture(s) en échec` : undefined);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    targets:   TARGETS.length,
    guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined,
    ...results,
    log,
  });
}
