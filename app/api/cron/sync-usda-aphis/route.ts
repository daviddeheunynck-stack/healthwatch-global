// USDA APHIS HPAI H5N1 bovine/livestock sync — runs daily at 14:00 UTC.
// Fetches USDA APHIS dairy-herd CSV, aggregates confirmed H5N1 herds per US state,
// and upserts one record per state into outbreaks.
// Fills the gap left by WHO/CDC/ECDC feeds, which don't cover ongoing US bovine HPAI.
//
// USDA APHIS is the US federal agency that authoritatively reports this data
// — a genuine primary government source — so the case-count write below can
// touch a row locked at source_priority=10 (ceiling raised 2026-08-19
// alongside sync-who-afro/emro — see project_source_priority_is_ownership_
// not_freeze_2026_08_19). lockedRowRegressionGuard refuses a cases decrease
// on a locked row. The staleness DEACTIVATION sweep further below is
// untouched — still capped at SOURCE_PRIORITY, since automatically retiring
// a locked row is a different and more destructive action than refreshing
// its figures.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { errorMessage } from "@/lib/error";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { scrapeAphisTableauCsv, parseCrosstabCsv, aggregateCrosstabByState } from "@/lib/aphis-tableau-scraper";
import { truncateAtSentence } from "@/lib/truncate-text";
import { dateFloorGuard, spikeGuard, collapseGuard, zeroCaseGuard, lockedRowRegressionGuard, lockedRowIsFreezing } from "@/lib/outbreak-guards";
import { stampSourceConfirmed } from "@/lib/source-confirmed";

export const dynamic     = "force-dynamic";
// Tableau fallback launches a real headless browser (cold Lambda start +
// Chromium extraction can be slow) — Vercel Pro allows 300s for crons.
export const maxDuration = 300;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

// CSV candidates — APHIS periodically renames files during site migrations
const APHIS_CSV_CANDIDATES = [
  "https://www.aphis.usda.gov/sites/default/files/hpai-dairy-herd-detections.csv",
  "https://www.aphis.usda.gov/sites/default/files/hpai-livestock-herd-detections.csv",
  "https://www.aphis.usda.gov/sites/default/files/hpai-detections-livestock.csv",
  "https://www.aphis.usda.gov/sites/default/files/hpai-confirmed-livestock-cases.csv",
];
// Fallback: HTML table page if no CSV is available
const APHIS_HTML_URL = "https://www.aphis.usda.gov/livestock-poultry-disease/avian/avian-influenza/hpai-detections/hpai-confirmed-cases-livestock";
const APHIS_PAGE_URL = APHIS_HTML_URL; // used in descriptions
// Synthetic source prefix — one URL per state used as the dedup key
const SOURCE_PREFIX   = "https://www.aphis.usda.gov/hpai-h5n1#";
const SOURCE_PRIORITY = 6;

// A state row is "active" only while its most recent CONFIRMED detection is
// within this window. APHIS's crosstab is a cumulative register of every
// premises ever confirmed since March 2024, so `cases` is a running total that
// never decreases — a state whose total stopped moving 8 months ago has no
// ongoing outbreak, it has a frozen counter.
//
// 60 days, for three reasons:
//  1. USDA's own National Milk Testing Strategy drops a state out of "Affected"
//     status when no new case has been confirmed in the last 30 days. 60 is
//     deliberately twice the primary authority's own threshold.
//  2. It's already this codebase's single "no longer current" constant —
//     STALE_DAYS / SIXTY_DAYS_MS in lib/outbreaks.ts.
//  3. It lines up exactly with the display-side recency fallback
//     (`date.gte.sixtyDaysAgo` in getOutbreaksCached(), mirrored in
//     isDisplayActive()). A row is deactivated at the precise moment its own
//     date leaves that window, so there is no band in which the DB says
//     inactive and the public site still renders it as a live "foyer en cours"
//     — the 2026-08-01 Dengue/Haiti resurrection class of bug is structurally
//     impossible here rather than merely avoided.
//
// Was 730 days until 2026-08-05, which is longer than this dataset has existed
// and never fired in practice: 9 states sat active with detections 235–722 days
// old (California's 773-herd cumulative total among them, quarantines all
// released Feb 2026), inflating the active-outbreak count and poisoning any
// freshness-ordered view.
//
// Deactivation is NOT terminal: a state that goes quiet and later gets a new
// confirmed detection is set active again by the update branch below. That
// round trip matters — Utah went 574 days between detections, Texas 270, Idaho
// 185, and all three are genuinely active today. Verified 2026-08-05 that the
// return leg is silent: push-alerts gates on created_at (unchanged by
// reactivation), disease-alerts dedups per subscriber for the row's lifetime,
// and trigger-subscriber-alerts is a 24h-cooldown digest. No alert burst.
const ACTIVE_WINDOW_DAYS = 60;

/** ISO date (YYYY-MM-DD) before which a detection no longer counts as ongoing. */
function activeSinceThreshold(): string {
  return new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .substring(0, 10);
}

const FETCH_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (compatible; HealthWatch-Global/1.0; +https://healthwatch-global.com)",
  "Accept":          "text/html,application/xhtml+xml,text/csv,text/plain,*/*;q=0.9",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control":   "no-cache",
};

// US state centroids
const US_STATES: Record<string, { lat: number; lng: number }> = {
  "Alabama":        { lat: 32.806671, lng: -86.791130 },
  "Alaska":         { lat: 61.370716, lng: -152.404419 },
  "Arizona":        { lat: 33.729759, lng: -111.431221 },
  "Arkansas":       { lat: 34.969704, lng: -92.373123 },
  "California":     { lat: 36.116203, lng: -119.681564 },
  "Colorado":       { lat: 39.059811, lng: -105.311104 },
  "Connecticut":    { lat: 41.597782, lng: -72.755371 },
  "Delaware":       { lat: 39.318523, lng: -75.507141 },
  "Florida":        { lat: 27.766279, lng: -81.686783 },
  "Georgia":        { lat: 33.040619, lng: -83.643074 },
  "Hawaii":         { lat: 21.094318, lng: -157.498337 },
  "Idaho":          { lat: 44.240459, lng: -114.478828 },
  "Illinois":       { lat: 40.349457, lng: -88.986137 },
  "Indiana":        { lat: 39.849426, lng: -86.258278 },
  "Iowa":           { lat: 42.011539, lng: -93.210526 },
  "Kansas":         { lat: 38.526600, lng: -96.726486 },
  "Kentucky":       { lat: 37.668140, lng: -84.670067 },
  "Louisiana":      { lat: 31.169960, lng: -91.867805 },
  "Maine":          { lat: 44.693947, lng: -69.381927 },
  "Maryland":       { lat: 39.063946, lng: -76.802101 },
  "Massachusetts":  { lat: 42.230171, lng: -71.530106 },
  "Michigan":       { lat: 43.326618, lng: -84.536095 },
  "Minnesota":      { lat: 45.694454, lng: -93.900192 },
  "Mississippi":    { lat: 32.741646, lng: -89.678696 },
  "Missouri":       { lat: 38.456085, lng: -92.288368 },
  "Montana":        { lat: 46.921925, lng: -110.454353 },
  "Nebraska":       { lat: 41.125370, lng: -98.268082 },
  "Nevada":         { lat: 38.313515, lng: -117.055374 },
  "New Hampshire":  { lat: 43.452492, lng: -71.563896 },
  "New Jersey":     { lat: 40.298904, lng: -74.521011 },
  "New Mexico":     { lat: 34.840515, lng: -106.248482 },
  "New York":       { lat: 42.165726, lng: -74.948051 },
  "North Carolina": { lat: 35.630066, lng: -79.806419 },
  "North Dakota":   { lat: 47.528912, lng: -99.784012 },
  "Ohio":           { lat: 40.388783, lng: -82.764915 },
  "Oklahoma":       { lat: 35.565342, lng: -96.928917 },
  "Oregon":         { lat: 44.572021, lng: -122.070938 },
  "Pennsylvania":   { lat: 40.590752, lng: -77.209755 },
  "Rhode Island":   { lat: 41.680893, lng: -71.511780 },
  "South Carolina": { lat: 33.856892, lng: -80.945007 },
  "South Dakota":   { lat: 44.299782, lng: -99.438828 },
  "Tennessee":      { lat: 35.747845, lng: -86.692345 },
  "Texas":          { lat: 31.054487, lng: -97.563461 },
  "Utah":           { lat: 40.150032, lng: -111.862434 },
  "Vermont":        { lat: 44.045876, lng: -72.710686 },
  "Virginia":       { lat: 37.769337, lng: -78.169968 },
  "Washington":     { lat: 47.400902, lng: -121.490494 },
  "West Virginia":  { lat: 38.491226, lng: -80.954453 },
  "Wisconsin":      { lat: 44.268543, lng: -89.616508 },
  "Wyoming":        { lat: 42.755966, lng: -107.302490 },
};

const STATE_ABBREVS: Record<string, string> = {
  "AL": "Alabama",       "AK": "Alaska",        "AZ": "Arizona",       "AR": "Arkansas",
  "CA": "California",    "CO": "Colorado",       "CT": "Connecticut",   "DE": "Delaware",
  "FL": "Florida",       "GA": "Georgia",        "HI": "Hawaii",        "ID": "Idaho",
  "IL": "Illinois",      "IN": "Indiana",        "IA": "Iowa",          "KS": "Kansas",
  "KY": "Kentucky",      "LA": "Louisiana",      "ME": "Maine",         "MD": "Maryland",
  "MA": "Massachusetts", "MI": "Michigan",       "MN": "Minnesota",     "MS": "Mississippi",
  "MO": "Missouri",      "MT": "Montana",        "NE": "Nebraska",      "NV": "Nevada",
  "NH": "New Hampshire", "NJ": "New Jersey",     "NM": "New Mexico",    "NY": "New York",
  "NC": "North Carolina","ND": "North Dakota",   "OH": "Ohio",          "OK": "Oklahoma",
  "OR": "Oregon",        "PA": "Pennsylvania",   "RI": "Rhode Island",  "SC": "South Carolina",
  "SD": "South Dakota",  "TN": "Tennessee",      "TX": "Texas",         "UT": "Utah",
  "VT": "Vermont",       "VA": "Virginia",       "WA": "Washington",    "WV": "West Virginia",
  "WI": "Wisconsin",     "WY": "Wyoming",
};

function normalizeState(raw: string): string {
  const s = raw.replace(/^"|"$/g, "").trim();
  return STATE_ABBREVS[s.toUpperCase()] ?? s;
}

// Simple CSV parser — handles quoted fields containing commas
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const splitLine = (line: string): string[] => {
    const vals: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    return vals;
  };

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = splitLine(lines[i]);
    if (vals.every(v => v === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// Parse an HTML <table> into the same row format as parseCSV
function parseHTMLTable(html: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return rows;

  const table   = tableMatch[0];
  const thMatch = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)];
  const headers  = thMatch.map(m =>
    m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().toLowerCase()
  );
  if (headers.length === 0) return rows;

  for (const trMatch of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length === 0) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx]?.[1] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
    });
    rows.push(row);
  }
  return rows;
}

// Pick a field from a row using multiple possible column names
function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

interface StateData {
  state:      string;
  herds:      number;
  cattle:     number;
  latestDate: string;
  herdTypes:  Set<string>;
}

function aggregateByState(rows: Array<Record<string, string>>): StateData[] {
  const map = new Map<string, StateData>();
  const today = new Date().toISOString().substring(0, 10);

  for (const row of rows) {
    const rawState = pick(row, "state", "state name", "state/territory", "st");
    if (!rawState) continue;
    const state = normalizeState(rawState);
    if (!US_STATES[state]) continue; // skip summary/total rows

    const herdType = pick(row,
      "herd type", "flock/herd type", "flock type", "animal type", "livestock type"
    );

    // Herd count — try multiple column names
    const herdRaw = pick(row,
      "herds", "number of herds", "herd count", "confirmed herds",
      "number herds/flocks affected", "flocks", "number of flocks",
      "total herds", "# herds"
    );
    const herds = parseInt(herdRaw.replace(/,/g, ""), 10) || 1;

    // Animal count
    const cattleRaw = pick(row,
      "number cattle", "total cattle", "animals affected",
      "number of animals", "cattle", "inventory at risk"
    );
    const cattle = parseInt(cattleRaw.replace(/,/g, ""), 10) || 0;

    // Detection date
    const dateRaw = pick(row,
      "date detected", "confirmation date", "confirmed date",
      "date confirmed", "date", "detected", "first detection date"
    );
    let detectedDate = today;
    if (dateRaw) {
      const parsed = new Date(dateRaw);
      if (!isNaN(parsed.getTime())) {
        detectedDate = parsed.toISOString().substring(0, 10);
      }
    }

    const existing = map.get(state);
    if (existing) {
      existing.herds += herds;
      existing.cattle += cattle;
      if (detectedDate > existing.latestDate) existing.latestDate = detectedDate;
      if (herdType) existing.herdTypes.add(herdType);
    } else {
      map.set(state, {
        state,
        herds,
        cattle,
        latestDate: detectedDate,
        herdTypes:  new Set(herdType ? [herdType] : []),
      });
    }
  }

  return [...map.values()];
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Defensive wrapper: the fetch stage below is already well try/catch-guarded,
  // but the row-processing/write loop after it is not. An uncaught exception
  // there propagated straight out: bare 500, no Sentry event, logCronRun never
  // reached — same root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runUsdaAphis(req, supabase);
  } catch (err) {
    console.error("[usda-aphis] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-usda-aphis" } });
    await logCronRun(supabase, "sync-usda-aphis", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runUsdaAphis(_req: NextRequest, supabase: SupabaseClient) {
  const diseaseInfo = normalizeDisease("avian influenza");
  const countryGeo  = findCountry("United States");

  if (!countryGeo) {
    await logCronRun(supabase, "sync-usda-aphis", "error", 0, "geo:United States not found");
    return NextResponse.json({ error: "geo:United States not found" }, { status: 500 });
  }

  // ── 1. Fetch data (CSV candidates first, HTML table fallback) ────────────
  let rawText = "";
  let dataFormat: "csv" | "html" | "tableau" = "html";
  let csvSource: string | null = null;

  try {
    // Try each CSV candidate until one succeeds
    for (const url of APHIS_CSV_CANDIDATES) {
      // fetchWithRetry: 2 attempts, 4s each — safe on a candidate-URL
      // fallback list: fetchWithRetry never retries a 4xx, so a candidate
      // that's genuinely gone still falls through to the next one at
      // roughly the original 8s single-attempt pace. Only a transient
      // network blip on a preferred candidate now gets a fair second try.
      // See lib/fetch-retry.ts (2026-09-02).
      const { response: res } = await fetchWithRetry(url, { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 4000, backoffMs: [500] });
      if (!res || !res.ok) continue; // network error, or 404/4xx — try next
      const ct = res.headers.get("content-type") ?? "";
      const body = await res.text();
      if (ct.includes("text/html") || body.trimStart().startsWith("<")) {
        // Cloudflare challenge or HTML redirect — not real CSV
        continue;
      }
      rawText = body;
      dataFormat = "csv";
      csvSource = url;
      break;
    }

    if (!csvSource) {
      // No CSV worked — try HTML table page
      console.warn("[usda-aphis] All CSV candidates failed — trying HTML page");
      // fetchWithRetry: 2 attempts, 7.5s each (worst case ~16s, close to the
      // original single 15s attempt).
      const { response: htmlRes, error: htmlFetchErr, attemptsMade } = await fetchWithRetry(
        APHIS_HTML_URL, { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 7500, backoffMs: [1000] },
      );
      if (!htmlRes) {
        const msg = `[usda-aphis] APHIS unreachable (all CSV + HTML failed): ${errorMessage(htmlFetchErr)} (${attemptsMade} tentative(s))`;
        console.warn(msg);
        if (isRealProduction) Sentry.captureMessage(msg, { level: "warning", tags: { cron: "sync-usda-aphis" } });
        await logCronRun(supabase, "sync-usda-aphis", "error", 0, "aphis_unreachable");
        return NextResponse.json({ success: false, error: "aphis_unreachable" }, { status: 200 });
      }
      if (!htmlRes.ok) {
        const msg = `[usda-aphis] HTML fallback HTTP ${htmlRes.status}`;
        console.warn(msg);
        if (isRealProduction) Sentry.captureMessage(msg, { level: "warning", tags: { cron: "sync-usda-aphis" } });
        await logCronRun(supabase, "sync-usda-aphis", "error", 0, `aphis_http_${htmlRes.status}`);
        return NextResponse.json({ success: false, error: `aphis_http_${htmlRes.status}` }, { status: 200 });
      }
      rawText = await htmlRes.text();
      dataFormat = "html";
    }
  } catch (e) {
    console.error("[usda-aphis] unexpected fetch error:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-usda-aphis" } });
    await logCronRun(supabase, "sync-usda-aphis", "error", 0, errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  let rows: Array<Record<string, string>>;
  if (dataFormat === "csv") {
    rows = parseCSV(rawText);
  } else {
    rows = parseHTMLTable(rawText);
  }
  let byState = aggregateByState(rows);

  console.log(`[usda-aphis] ${dataFormat} → ${rows.length} rows → ${byState.length} states with HPAI herds`);

  if (byState.length === 0) {
    // APHIS migrated this page to a Tableau dashboard embed (~2026-06-27); the CSV
    // candidates 404 and the HTML fallback has no <table> to parse. Fall back to
    // driving the dashboard's own "Download crosstab" UI in a headless browser —
    // same button a human would click, not a replay of Tableau's internal API.
    try {
      const csvText = await scrapeAphisTableauCsv();
      const crosstabRows = parseCrosstabCsv(csvText);
      const crosstabByState = aggregateCrosstabByState(crosstabRows);
      byState = crosstabByState
        .map((s) => ({ ...s, state: normalizeState(s.state), cattle: 0 }))
        .filter((s) => US_STATES[s.state]);
      dataFormat = "tableau";
      console.log(`[usda-aphis] tableau fallback → ${crosstabRows.length} rows → ${byState.length} states with HPAI herds`);
    } catch (e) {
      const msg = `[usda-aphis] 0 states parsed (format=${dataFormat}, rows=${rows.length}) and tableau fallback failed: ${errorMessage(e)}`;
      console.warn(msg);
      await logCronRun(supabase, "sync-usda-aphis", "no_data", 0);
      return NextResponse.json({ success: true, dataFormat, rows: rows.length, states: 0, inserted: 0, updated: 0, skipped: 0, tableauError: errorMessage(e) });
    }
  }

  // ── 2. Load existing USDA records for dedup ───────────────────────────────
  const { data: existingRows, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, admin1, cases, date, source, source_priority, description")
    .eq("disease_en", diseaseInfo.name_en)
    .eq("country_en", "United States")
    .like("source", `${SOURCE_PREFIX}%`);

  if (fetchErr) {
    await logCronRun(supabase, "sync-usda-aphis", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  type Row = NonNullable<typeof existingRows>[number];
  const bySource = new Map<string, Row>();
  for (const row of existingRows ?? []) {
    if (row.source) bySource.set(row.source, row);
  }

  // ── 3. Upsert one record per state ───────────────────────────────────────
  const today = new Date().toISOString().substring(0, 10);
  const activeSince = activeSinceThreshold();
  const results = { dataFormat, rows: rows.length, states: byState.length, inserted: 0, updated: 0, skipped: 0, errors: 0, deactivated: 0 };
  const log: Array<{ state: string; status: string; detail?: string }> = [];
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — see the push site below for why these,
  // and only these, need to reach the health-check.
  const lockedGuardBlocked: string[] = [];
  // Rows this run re-read from the source and found unchanged — stamped as
  // verified in one batched write after the loop (see lib/source-confirmed.ts).
  const sourceConfirmed: string[] = [];

  for (const sd of byState) {
    const coords    = US_STATES[sd.state]!;
    const sourceUrl = `${SOURCE_PREFIX}${sd.state.toLowerCase().replace(/\s+/g, "-")}`;
    const safeDate  = sd.latestDate > today ? today : sd.latestDate;
    const herdLabel = sd.herdTypes.size > 0 ? [...sd.herdTypes].join(", ") : "dairy cattle";
    const description = truncateAtSentence(
      `USDA APHIS — H5N1 HPAI confirmed in ${sd.herds} ${herdLabel} herd${sd.herds !== 1 ? "s" : ""} in ${sd.state}` +
      (sd.cattle > 0 ? ` (~${sd.cattle.toLocaleString()} animals)` : "") +
      `. Latest detection: ${safeDate}. Source: ${APHIS_PAGE_URL}`,
      600
    );

    const existing = bySource.get(sourceUrl);

    if (existing) {
      if (sd.herds === existing.cases && safeDate <= existing.date) {
        // Source fetched and an entry for this row parsed, carrying nothing
        // newer than the row's `date` — that is a verification, not merely
        // "nothing to write". Recorded so the row stops ageing towards the
        // "no update" badge while its source confirms it every run.
        sourceConfirmed.push(existing.id);
        log.push({ state: sd.state, status: "skip", detail: "unchanged — source confirmed" });
        results.skipped++;
        continue;
      }

      // Had no anti-regression guard of any kind until 2026-08-02, not even a
      // date floor. `cases` here is a herd count, not a human case count, so
      // there is no deaths field to guard — date-floor/spike/collapse/zero-case
      // only, from lib/outbreak-guards.ts.
      const guardIncoming = { cases: sd.herds, deaths: 0, date: safeDate };
      const guardExisting = { cases: existing.cases, deaths: null, date: existing.date, source_priority: existing.source_priority };
      const guardReason =
        dateFloorGuard(guardIncoming, guardExisting) ??
        spikeGuard(guardIncoming, guardExisting) ??
        collapseGuard(guardIncoming, guardExisting) ??
        zeroCaseGuard(guardIncoming, guardExisting) ??
        lockedRowRegressionGuard(guardIncoming, guardExisting);
      if (guardReason) {
        log.push({ state: sd.state, status: "skip", detail: guardReason });
        results.skipped++;
        // A refusal on a locked (source_priority>=10) row is not an
        // ordinary skip: nothing else will ever write this row again, so a
        // silently-blocked write freezes it on stale figures forever with
        // nothing to show for it (see check-mpox-sitrep/route.ts and
        // project_source_priority_is_ownership_not_freeze_2026_08_19).
        // Ordinary guards (dateFloor/spike/collapse/zeroCase) stay
        // unreported here — their regular-operation volume isn't measured,
        // so surfacing them too would risk drowning the health-check in
        // noise.
        // …but only while that premise holds: a locked row its owning source refreshed
        // days ago is being protected, not frozen, and escalating it every run buries
        // the next real failure of this cron. See lockedRowIsFreezing (2026-08-24).
        if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(guardExisting)) lockedGuardBlocked.push(`${sd.state}: ${guardReason}`);
        continue;
      }

      // Derived from the detection date, never hardcoded to true: this branch
      // also fires for cosmetic changes (a new herd-type label, a description
      // rewrite) on a state whose counter is long frozen. Forcing active:true
      // there resurrected the row until the step-4 sweep undid it later in the
      // same run — a pointless write that also nulled the FR/ES/AR/ID
      // translations below on every pass. Setting it correctly at write time
      // makes the sweep a safety net rather than the only line of defence.
      const isOngoing = safeDate >= activeSince;

      const updatePayload: Record<string, unknown> = {
        cases:           sd.herds,
        date:            safeDate,
        description,
        active:          isOngoing,
        source_priority: Math.max(SOURCE_PRIORITY, existing.source_priority ?? 0),
      };
      // English description just changed — existing FR/ES/AR/ID translations
      // (if any) now describe stale figures. Null them so sync-outbreaks'
      // backfill sweep re-translates from the fresh text (it only fires when
      // description_fr IS NULL — see project_sync_outbreaks_paho_translation_drift_fixed).
      if (existing.description !== description) {
        updatePayload.description_fr = null;
        updatePayload.description_es = null;
        updatePayload.description_ar = null;
        updatePayload.description_id = null;
      }
      // .select("id") so a blocked write (row now owned by a higher-priority
      // source — e.g. manually locked) is visible as 0 affected rows instead
      // of being silently counted as "updated". Same fix already applied
      // across every other sync-* cron; this one had no priority guard at
      // all until now. Found 2026-07-17.
      const { data: updatedRows, error } = await supabase
        .from("outbreaks")
        .update(updatePayload)
        .eq("id", existing.id)
        .lte("source_priority", 10)
        .select("id");

      if (error) {
        log.push({ state: sd.state, status: "error", detail: error.message });
        results.errors++;
      } else if (!updatedRows || updatedRows.length === 0) {
        log.push({ state: sd.state, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
        results.skipped++;
      } else {
        log.push({ state: sd.state, status: "updated", detail: `${sd.herds} herds (${safeDate})` });
        results.updated++;
      }
    } else {
      const { error } = await supabase.from("outbreaks").insert({
        disease:         diseaseInfo.name_fr,
        disease_en:      diseaseInfo.name_en,
        disease_ar:      diseaseInfo.name_ar,
        country:         countryGeo.name_fr,
        country_en:      countryGeo.name_en,
        country_ar:      countryGeo.name_ar,
        region:          countryGeo.region,
        lat:             countryGeo.lat,
        lng:             countryGeo.lng,
        cases:           sd.herds,
        deaths:          0,
        risk_level:      "high",
        date:            safeDate,
        source:          sourceUrl,
        description,
        // Same rule as the update branch — a state first seen through a
        // backfill of the cumulative register (its detections already years
        // old) must not land as an active foyer just because it's new to us.
        active:          safeDate >= activeSince,
        is_seed:         false,
        // USDA's crosstab is a cumulative historical record (every premises
        // ever confirmed since 2024), not a live "what's happening now" feed
        // — every first-insert here is onboarding archive data, unconditionally.
        is_backfill:     true,
        admin1:          sd.state,
        admin1_lat:      coords.lat,
        admin1_lng:      coords.lng,
        source_priority: SOURCE_PRIORITY,
      });

      if (error) {
        log.push({ state: sd.state, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ state: sd.state, status: "inserted", detail: `${sd.herds} herds (${safeDate})` });
        results.inserted++;
      }
    }
  }

  // ── 4. Deactivate states whose counter has stopped moving ────────────────
  // Still required even though step 3 now writes `active` correctly: a state
  // with a frozen counter matches the "unchanged" skip at the top of the loop
  // and never reaches a write at all, so this sweep is the only thing that ever
  // flips it. It also catches states that dropped out of the feed entirely
  // (byState no longer lists them), which step 3 by construction cannot see.
  // See ACTIVE_WINDOW_DAYS above for why the window is 60 days.
  const { data: staleActive, error: staleErr } = await supabase
    .from("outbreaks")
    .select("id, admin1, date")
    .like("source", `${SOURCE_PREFIX}%`)
    .eq("active", true)
    .lt("date", activeSince);

  if (staleErr) {
    log.push({ state: "-", status: "error", detail: `deactivation query: ${staleErr.message}` });
  } else if (staleActive && staleActive.length > 0) {
    // Restricting the lookup to this cron's own SOURCE_PREFIX keeps the sweep on
    // rows it owns, but a row it owns can still have been locked at
    // source_priority=10 by a human (the convention used for DR Congo/Ebola,
    // Uganda, Tanzania, Somalia) — without the .lte() the staleness sweep would
    // silently revert that decision. Same contract as the deactivation in
    // data-quality/route.ts: guard at the DB level, and count only the rows the
    // write actually returned instead of assuming every candidate landed —
    // results.deactivated used staleActive.length, so once the guard blocks a
    // row the report would have overstated the sweep.
    const { data: deactivated, error: deactivateErr } = await supabase
      .from("outbreaks")
      .update({ active: false })
      .in("id", staleActive.map((r) => r.id))
      .lte("source_priority", SOURCE_PRIORITY)
      .select("id");

    if (deactivateErr) {
      log.push({ state: "-", status: "error", detail: `deactivation update: ${deactivateErr.message}` });
      results.errors++;
    } else {
      const landed = new Set((deactivated ?? []).map((r) => r.id as string));
      results.deactivated = landed.size;
      for (const r of staleActive) {
        if (landed.has(r.id)) {
          log.push({ state: r.admin1 ?? "?", status: "deactivated", detail: `no detection since ${r.date}` });
        } else {
          log.push({ state: r.admin1 ?? "?", status: "skip", detail: `deactivation blocked by source_priority guard — row locked or owned by a higher-priority source (last detection ${r.date})` });
        }
      }
    }
  }

  // One batched verification stamp for every row the source confirmed
  // unchanged. Never fatal: a failed stamp costs freshness metadata, not
  // data, so it is logged and the run still reports on its actual writes.
  const confirmed = await stampSourceConfirmed(supabase, sourceConfirmed);
  if (confirmed.error) console.error("[usda-aphis] source_confirmed_at stamp failed:", confirmed.error);

  console.log("[usda-aphis] Done:", results, log, `confirmed=${confirmed.stamped}`);
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[usda-aphis] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }
  // Was hardcoded "ok" regardless of results.errors — same bug as
  // sync-outbreaks (2026-07-29).
  await logCronRun(supabase, "sync-usda-aphis", results.errors > 0 || lockedGuardBlocked.length > 0 ? "error" : "ok", results.inserted ?? 0,
    lockedGuardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
      : results.errors > 0 ? `${results.errors} écriture(s) en échec` : undefined);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined, ...results, log });
}
