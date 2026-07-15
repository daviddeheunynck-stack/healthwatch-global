// CDC Health Alert Network (HAN) sync — runs every 4 hours.
// Fetches the HAN notice list from CDC's public WCMS search API (the old
// emergency.cdc.gov/han/rss.asp feed now 301-redirects to a generic CDC
// homepage — CDC migrated HAN to www.cdc.gov/han/php/notices/ and the
// listing page is client-rendered, backed by this same search endpoint the
// page's own JS calls), parses each alert page for disease / country / case
// counts, and upserts to outbreaks.
// CDC HAN publishes within hours of national confirmation — much faster
// than WHO DON (3–8 days lag) and before ECDC rapid risk assessments.
// Catches exported cases (e.g. France Ebola) before official UN publications.
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { logCronRun } from "@/lib/cron-monitor";
import { COUNTRIES, findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const HAN_SEARCH_URL = "https://wcmssearch.cdc.gov/srch/internet_wcms/wcms_widget";
const MAX_AGE_DAYS   = 30;
const FEED_ROWS       = 25;

function buildHANSearchUrl(): string {
  const params = new URLSearchParams();
  params.set("q", "*:*");
  params.append("fq", '(type_txt:"DFE Page" AND cdc_dfe_template_str:("cdc_health_alert")) OR type_txt:("Page")');
  params.append("fq", "(topical_site_context_s:1984-2 AND (permalink:*/han/php/notices/*)) OR (site_id:1984 AND (permalink:*/han/2024/* OR permalink:*/han/2023/*))");
  params.append("fq", "-id:1984_486");
  params.append("fq", '-status:"cdc_archive"');
  params.append("fq", "-is_hidden_b:true");
  params.set("wt", "json");
  params.set("start", "0");
  params.set("rows", String(FEED_ROWS));
  params.set("fl", "id,title_txt,permalink,excerpt_txt,cdc_article_date_dt");
  params.set("sort", "cdc_last_reviewed_date_dt desc,cdc_article_date_dt desc");
  return `${HAN_SEARCH_URL}?${params.toString()}`;
}

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/rss+xml,text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// Country names sorted longest-first to avoid short matches before full names
const COUNTRY_NAMES = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);

const TEXT_ALIASES: Record<string, string> = {
  " drc ":    "Democratic Republic of the Congo",
  "(drc)":    "Democratic Republic of the Congo",
  " rdc ":    "Democratic Republic of the Congo",
  " dr congo": "Democratic Republic of the Congo",
  " usa ":    "United States",
  " u.s. ":   "United States",
  " u.s.a. ": "United States",
};

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// HAN notice pages wrap the real advisory (Summary, Background, Recommendations)
// in <main class="container cdc-main">, confirmed stable across 3 different
// notices — everything before it is CDC's site-wide header/nav chrome.
function extractHANBody(html: string): string {
  const idx = html.indexOf('class="container cdc-main"');
  if (idx < 0) return html;
  const tagEnd = html.indexOf(">", idx) + 1;
  return html.slice(tagEnd, tagEnd + 8000);
}

// Strip CDC HAN prefix: "HAN00497 - Health Alert: " → clean title
function stripHANPrefix(title: string): string {
  return title
    .replace(/^HAN\d+\s*[-–—]\s*/i, "")
    .replace(/^Health\s+(?:Alert|Advisory|Update|Notice)\s*:\s*/i, "")
    .replace(/^Info(?:rmation)?\s+Service\s*:\s*/i, "")
    .trim();
}

function extractHANDisease(title: string): string {
  const clean = stripHANPrefix(title);
  return clean
    .replace(/\s+in\s+.+$/i, "")
    .replace(/\s+among\s+.+$/i, "")
    .replace(/\s+outbreak\b.*/i, "")
    .replace(/\s+[-–—]\s+update\s+\d+\b.*/i, "")
    .replace(/\s*[-–—]\s*.+$/, "")
    .trim();
}

// Returns countries ordered by earliest position of first occurrence in the
// text, not by iteration order over TEXT_ALIASES/COUNTRY_NAMES — callers take
// countries[0] as "the primary country", which needs to mean "mentioned
// first in the article", not "whichever name happens to be declared first".
// Found 2026-07-15 (same class of bug already fixed in sync-ecdc-threats).
function findMentionedCountries(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const positions = new Map<string, number>();

  const record = (canonical: string, idx: number) => {
    if (idx === -1) return;
    const prev = positions.get(canonical);
    if (prev === undefined || idx < prev) positions.set(canonical, idx);
  };

  for (const [abbr, canonical] of Object.entries(TEXT_ALIASES)) {
    record(canonical, lower.indexOf(abbr));
  }

  for (const name of COUNTRY_NAMES) {
    if (positions.has(name)) continue;
    const lowerName = name.toLowerCase();
    const idxSpace = lower.indexOf(` ${lowerName} `);
    const idxComma = lower.indexOf(` ${lowerName},`);
    record(name, idxSpace === -1 ? idxComma : idxComma === -1 ? idxSpace : Math.min(idxSpace, idxComma));
  }
  return [...positions.keys()].sort((a, b) => positions.get(a)! - positions.get(b)!);
}

// ── HAN search-result parser ──────────────────────────────────────────────────

interface RSSItem {
  url:   string;
  title: string;
  date:  string; // YYYY-MM-DD
  description: string;
}

interface HANSearchDoc {
  title_txt?: string;
  permalink?: string;
  excerpt_txt?: string;
  cdc_article_date_dt?: string;
}

function parseHANSearch(json: string): RSSItem[] {
  const items: RSSItem[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  let data: { response?: { docs?: HANSearchDoc[] } };
  try {
    data = JSON.parse(json);
  } catch {
    return items;
  }

  for (const doc of data.response?.docs ?? []) {
    if (!doc.title_txt || !doc.permalink || !doc.cdc_article_date_dt) continue;
    const d = new Date(doc.cdc_article_date_dt);
    if (isNaN(d.getTime()) || d < cutoff) continue;

    items.push({
      url:         doc.permalink,
      title:       doc.title_txt,
      date:        d.toISOString().substring(0, 10),
      description: (doc.excerpt_txt ?? "").trim(),
    });
  }

  return items;
}

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

  // ── 1. Fetch HAN notice list from CDC's WCMS search API ──────────────────
  let searchJson: string;
  try {
    const res = await fetch(buildHANSearchUrl(), { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[cdc-han] search HTTP ${res.status}`);
      await logCronRun(supabase, "sync-cdc-han", "error", 0, `HAN search HTTP ${res.status}`);
      return NextResponse.json({ error: `HAN search HTTP ${res.status}` }, { status: 502 });
    }
    searchJson = await res.text();
  } catch (e) {
    console.error("[cdc-han] fetch search:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-cdc-han" } });
    await logCronRun(supabase, "sync-cdc-han", "error", 0, errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const entries = parseHANSearch(searchJson);
  console.log(`[cdc-han] Found ${entries.length} recent alert(s) within ${MAX_AGE_DAYS} days`);

  if (entries.length === 0) {
    await logCronRun(supabase, "sync-cdc-han", "no_data", 0);
    return NextResponse.json({ success: true, alerts: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing outbreaks for dedup ──────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) {
    await logCronRun(supabase, "sync-cdc-han", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  type Row = NonNullable<typeof existing>[number];
  const bySource = new Map<string, Row>();
  const byDC     = new Map<string, Row>();
  for (const row of existing ?? []) {
    if (row.source) bySource.set(row.source, row);
    const k    = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

  // ── 3. Process each HAN alert ─────────────────────────────────────────────
  const results = { alerts: entries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  for (const entry of entries) {
    const rawDisease = extractHANDisease(entry.title);

    if (!isKnownDisease(rawDisease)) {
      log.push({ label: entry.title, status: "skip", detail: `unknown disease: ${rawDisease}` });
      results.skipped++;
      continue;
    }

    const diseaseInfo = normalizeDisease(rawDisease);

    // Fetch the alert page for full text (case counts + country mentions).
    // entry.url (from the search API's "permalink" field) is always absolute.
    let pageText = entry.description;
    try {
      const res = await fetch(entry.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      if (res.ok) pageText = `${entry.description} ${htmlToText(extractHANBody(await res.text()))}`;
    } catch (e) {
      console.warn("[cdc-han] fetch page:", errorMessage(e));
    }

    const searchText = `${stripHANPrefix(entry.title)} ${pageText}`;
    const countries  = findMentionedCountries(searchText.substring(0, 2000));

    // Require at least one known country
    if (countries.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: "no country found" });
      results.skipped++;
      continue;
    }

    const geo = findCountry(countries[0]);
    if (!geo) {
      log.push({ label: entry.title, status: "skip", detail: `country not in geo-data: ${countries[0]}` });
      results.skipped++;
      continue;
    }

    const { cases, deaths } = extractNumbers(pageText.substring(0, 3000));
    const riskLevel         = assessRisk(diseaseInfo.name_en, pageText, cases, deaths);
    const description       = `CDC HAN — ${stripHANPrefix(entry.title)}. ${entry.description}`.substring(0, 600);
    const label             = `${diseaseInfo.name_en}/${geo.name_en}`;

    // Skip 0/0 entries — CDC HAN alerts mix real incident/outbreak reports
    // with general clinical guidance updates that mention a disease/country
    // but report no current case count. Same guard as sync-africa-cdc /
    // sync-paho-alerts / sync-ukhsa.
    if (cases === 0 && deaths === 0) {
      log.push({ label, status: "skip", detail: "0 cases and 0 deaths — likely a guidance update, not an outbreak report" });
      results.skipped++;
      continue;
    }

    if (entry.date > today) {
      log.push({ label, status: "skip", detail: `future date: ${entry.date}` });
      results.skipped++;
      continue;
    }

    // Source-based dedup
    if (bySource.has(entry.url)) {
      log.push({ label, status: "skip", detail: "source URL already in DB" });
      results.skipped++;
      continue;
    }

    const dcKey      = `${diseaseInfo.name_en.toLowerCase()}|${geo.name_en.toLowerCase()}`;
    const existingRow = byDC.get(dcKey);

    // Never overwrite WHO DON-owned rows
    if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
      results.skipped++;
      continue;
    }

    if (existingRow) {
      const isNewer   = entry.date > existingRow.date;
      const casesDiff = cases !== existingRow.cases;

      if (!isNewer && !casesDiff) {
        log.push({ label, status: "skip", detail: "data unchanged" });
        results.skipped++;
        continue;
      }

      const updatePayload: Record<string, unknown> = {
        cases, deaths, date: entry.date, source: entry.url, description, risk_level: riskLevel, active: true, source_priority: 5,
      };
      // English description just changed — existing FR/ES/AR/ID translations
      // (if any) now describe stale figures. Null them so sync-outbreaks'
      // backfill sweep re-translates from the fresh text (it only fires when
      // description_fr IS NULL — see project_sync_outbreaks_paho_translation_drift_fixed).
      if (existingRow.description !== description) {
        updatePayload.description_fr = null;
        updatePayload.description_es = null;
        updatePayload.description_ar = null;
        updatePayload.description_id = null;
      }
      const { error } = await supabase
        .from("outbreaks")
        .update(updatePayload)
        .eq("id", existingRow.id).lte("source_priority", 5);

      if (error) {
        log.push({ label, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ label, status: "updated", detail: `${cases} cases / ${deaths} deaths (${entry.date})` });
        results.updated++;
      }
    } else {
      const { error } = await supabase.from("outbreaks").insert({
        disease:    diseaseInfo.name_fr,
        disease_en: diseaseInfo.name_en,
        disease_ar: diseaseInfo.name_ar,
        country:    geo.name_fr,
        country_en: geo.name_en,
        country_ar: geo.name_ar,
        region:     geo.region,
        lat:        geo.lat,
        lng:        geo.lng,
        cases,
        deaths,
        risk_level:  riskLevel,
        date:        entry.date,
        source:      entry.url,
        description,
        active:      true,
        is_seed:     false,
        admin1:      null,
        admin1_lat:  null,
        admin1_lng:  null,
      });

      if (error) {
        log.push({ label, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ label, status: "inserted", detail: `${cases} cases / ${deaths} deaths (${entry.date})` });
        results.inserted++;
      }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("[cdc-han] Done:", results, log);
  await logCronRun(supabase, "sync-cdc-han", "ok", results.inserted ?? 0);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
