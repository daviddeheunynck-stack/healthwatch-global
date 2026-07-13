// USDA APHIS HPAI H5N1 bovine/livestock sync — runs daily at 14:00 UTC.
// Fetches USDA APHIS dairy-herd CSV, aggregates confirmed H5N1 herds per US state,
// and upserts one record per state into outbreaks.
// Fills the gap left by WHO/CDC/ECDC feeds, which don't cover ongoing US bovine HPAI.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { errorMessage } from "@/lib/error";
import { scrapeAphisTableauCsv, parseCrosstabCsv, aggregateCrosstabByState } from "@/lib/aphis-tableau-scraper";

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

  const supabase    = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const diseaseInfo = normalizeDisease("avian influenza");
  const countryGeo  = findCountry("United States");

  if (!countryGeo) {
    return NextResponse.json({ error: "geo:United States not found" }, { status: 500 });
  }

  // ── 1. Fetch data (CSV candidates first, HTML table fallback) ────────────
  let rawText = "";
  let dataFormat: "csv" | "html" | "tableau" = "html";
  let csvSource: string | null = null;

  try {
    // Try each CSV candidate until one succeeds
    for (const url of APHIS_CSV_CANDIDATES) {
      let res: Response;
      try {
        res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8_000) });
      } catch {
        continue; // network error / timeout on this candidate — try next
      }
      if (!res.ok) continue; // 404 / 4xx — try next
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
      let htmlRes: Response;
      try {
        htmlRes = await fetch(APHIS_HTML_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
      } catch (e) {
        const msg = `[usda-aphis] APHIS unreachable (all CSV + HTML failed): ${errorMessage(e)}`;
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
  const results = { dataFormat, rows: rows.length, states: byState.length, inserted: 0, updated: 0, skipped: 0, errors: 0, deactivated: 0 };
  const log: Array<{ state: string; status: string; detail?: string }> = [];

  for (const sd of byState) {
    const coords    = US_STATES[sd.state]!;
    const sourceUrl = `${SOURCE_PREFIX}${sd.state.toLowerCase().replace(/\s+/g, "-")}`;
    const safeDate  = sd.latestDate > today ? today : sd.latestDate;
    const herdLabel = sd.herdTypes.size > 0 ? [...sd.herdTypes].join(", ") : "dairy cattle";
    const description = (
      `USDA APHIS — H5N1 HPAI confirmed in ${sd.herds} ${herdLabel} herd${sd.herds !== 1 ? "s" : ""} in ${sd.state}` +
      (sd.cattle > 0 ? ` (~${sd.cattle.toLocaleString()} animals)` : "") +
      `. Latest detection: ${safeDate}. Source: ${APHIS_PAGE_URL}`
    ).substring(0, 600);

    const existing = bySource.get(sourceUrl);

    if (existing) {
      if (sd.herds === existing.cases && safeDate <= existing.date) {
        log.push({ state: sd.state, status: "skip", detail: "unchanged" });
        results.skipped++;
        continue;
      }

      const updatePayload: Record<string, unknown> = {
        cases:           sd.herds,
        date:            safeDate,
        description,
        active:          true,
        source_priority: SOURCE_PRIORITY,
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
      const { error } = await supabase
        .from("outbreaks")
        .update(updatePayload)
        .eq("id", existing.id);

      if (error) {
        log.push({ state: sd.state, status: "error", detail: error.message });
        results.errors++;
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
        active:          true,
        is_seed:         false,
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

  // ── 4. Deactivate states with no confirmed detection in a long time ───────
  // USDA's crosstab is a cumulative historical record (every premises ever
  // confirmed since 2024), not a "currently active" list — a state whose most
  // recent detection is older than DEACTIVATE_AFTER_DAYS isn't an ongoing
  // outbreak anymore, it's history, and shouldn't render as an active dot on
  // the public map. 730d matches the SEED_FRESH_DAYS_REF precedent already
  // used in data-quality/route.ts for "old enough to not be current".
  // Reactivation is automatic: if a state gets a genuinely new detection, the
  // update branch above sets active:true again on its own — nothing extra
  // needed here for that direction.
  const DEACTIVATE_AFTER_DAYS = 730;
  const deactivateThreshold = new Date(Date.now() - DEACTIVATE_AFTER_DAYS * 86_400_000)
    .toISOString()
    .substring(0, 10);

  const { data: staleActive, error: staleErr } = await supabase
    .from("outbreaks")
    .select("id, admin1, date")
    .like("source", `${SOURCE_PREFIX}%`)
    .eq("active", true)
    .lte("date", deactivateThreshold);

  if (staleErr) {
    log.push({ state: "-", status: "error", detail: `deactivation query: ${staleErr.message}` });
  } else if (staleActive && staleActive.length > 0) {
    const { error: deactivateErr } = await supabase
      .from("outbreaks")
      .update({ active: false })
      .in("id", staleActive.map((r) => r.id));

    if (deactivateErr) {
      log.push({ state: "-", status: "error", detail: `deactivation update: ${deactivateErr.message}` });
    } else {
      results.deactivated = staleActive.length;
      for (const r of staleActive) {
        log.push({ state: r.admin1 ?? "?", status: "deactivated", detail: `no detection since ${r.date}` });
      }
    }
  }

  console.log("[usda-aphis] Done:", results, log);
  await logCronRun(supabase, "sync-usda-aphis", "ok", results.inserted ?? 0);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
