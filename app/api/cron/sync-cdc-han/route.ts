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
//
// CDC is the US's own national public health agency — a genuine primary
// government source for its own country's rows — so this cron can write onto
// rows locked at source_priority=10 (ceiling raised 2026-08-19 alongside
// sync-who-afro/emro — see project_source_priority_is_ownership_not_freeze_
// 2026_08_19). lockedRowRegressionGuard refuses any decrease on a locked row.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { logCronRun } from "@/lib/cron-monitor";
import { COUNTRIES, findCountry, isAggregateCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { truncateAtSentence } from "@/lib/truncate-text";
import { dateFloorGuard, spikeGuard, collapseGuard, zeroCaseGuard, zeroDeathGuard, lockedRowRegressionGuard, lockedRowIsFreezing } from "@/lib/outbreak-guards";
import { stampSourceConfirmed } from "@/lib/source-confirmed";

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

// Country names sorted longest-first to avoid short matches before full names.
// Excludes aggregate pseudo-countries ("Global", "Multi-country", "African Region"...):
// left in, boilerplate like "the global health security" would match the "Global"
// alias and become countries[0] whenever it's mentioned before the real country,
// causing the aggregate-rejection guard below to discard the whole article instead
// of finding the real one. Found 2026-07-16 (same class as sync-africa-cdc).
const COUNTRY_NAMES = Object.keys(COUNTRIES)
  .filter((name) => !isAggregateCountry(COUNTRIES[name]))
  .sort((a, b) => b.length - a.length);

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
  // If CDC changes their template, this selector stops matching — returning the
  // full page (header/nav chrome) instead of "" would feed page chrome into
  // extractNumbers/findMentionedCountries (wrong case counts, wrong country)
  // rather than the empty-string 0/0 those functions already handle as a
  // visible skip. Found 2026-07-16.
  if (idx < 0) {
    console.warn("[cdc-han] body selector no longer matches — skipping article");
    return "";
  }
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

// ── Shared dedup lookup ───────────────────────────────────────────────────────

interface ExistingRow {
  id: string;
  disease_en: string | null;
  country_en: string | null;
  cases: number;
  deaths: number;
  date: string;
  source: string | null;
  active: boolean;
  description: string | null;
  source_priority: number | null;
}

const dcKey = (disease: string | null, country: string | null) =>
  `${(disease ?? "").toLowerCase()}|${(country ?? "").toLowerCase()}`;

function indexRow(byDC: Map<string, ExistingRow>, row: ExistingRow): void {
  const k    = dcKey(row.disease_en, row.country_en);
  const prev = byDC.get(k);
  if (!prev || (row.active && !prev.active)) byDC.set(k, row);
}

// The dedup snapshot in GET loads active rows plus anything dated within 90
// days. A row that fell inactive BEFORE that window is invisible to it, and an
// unseen row is upserted as an insert — a duplicate, not an update. Look the
// targeted rows up explicitly before writing them. Same fix as sync-paho-alerts
// (found 2026-07-15, applied here 2026-07-17).
async function loadExistingForItems(
  supabase: SupabaseClient,
  byDC: Map<string, ExistingRow>,
  items: { disease_en: string; country_en: string }[],
): Promise<void> {
  const missing = items.filter((i) => !byDC.has(dcKey(i.disease_en, i.country_en)));
  if (missing.length === 0) return;

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .in("disease_en", [...new Set(missing.map((i) => i.disease_en))])
    .in("country_en", [...new Set(missing.map((i) => i.country_en))]);

  if (error) {
    console.warn("[cdc-han] dedup lookup:", error.message);
    return;
  }
  for (const row of (data ?? []) as ExistingRow[]) indexRow(byDC, row);
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

  // Defensive wrapper: section 3 below (per-alert processing loop) runs
  // entirely outside any enclosing try/catch — only the page-text fetch has
  // its own local one. An uncaught exception in the synchronous parsing (geo
  // matching, number extraction, string processing on untrusted HTML) would
  // propagate straight out: bare 500, no Sentry event, logCronRun never
  // reached. Same root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runCdcHan(req, supabase);
  } catch (err) {
    console.error("[cdc-han] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-cdc-han" } });
    await logCronRun(supabase, "sync-cdc-han", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runCdcHan(_req: NextRequest, supabase: SupabaseClient) {
  const today = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch HAN notice list from CDC's WCMS search API ──────────────────
  // fetchWithRetry: 2 attempts, 15s each (unchanged from the original
  // single-attempt timeout — see the sync-usda-aphis lesson, 2026-09-02: a
  // shortened per-attempt timeout can turn a working-but-slow source into a
  // false failure). See lib/fetch-retry.ts (2026-09-02).
  const { response: res, error: searchFetchErr, attemptsMade } = await fetchWithRetry(
    buildHANSearchUrl(), { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 15_000, backoffMs: [1000] },
  );
  if (!res) {
    const msg = `${errorMessage(searchFetchErr)} (${attemptsMade} tentative(s))`;
    console.error("[cdc-han] fetch search:", msg);
    Sentry.captureException(searchFetchErr ?? new Error(msg), { tags: { cron: "sync-cdc-han" } });
    await logCronRun(supabase, "sync-cdc-han", "error", 0, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (!res.ok) {
    const msg = `HAN search HTTP ${res.status} (${attemptsMade} tentative(s))`;
    console.error(`[cdc-han] ${msg}`);
    await logCronRun(supabase, "sync-cdc-han", "error", 0, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  const searchJson = await res.text();

  const entries = parseHANSearch(searchJson);
  console.log(`[cdc-han] Found ${entries.length} recent alert(s) within ${MAX_AGE_DAYS} days`);

  if (entries.length === 0) {
    await logCronRun(supabase, "sync-cdc-han", "no_data", 0);
    return NextResponse.json({ success: true, alerts: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing outbreaks for dedup ──────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) {
    await logCronRun(supabase, "sync-cdc-han", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const bySource = new Map<string, ExistingRow>();
  const byDC     = new Map<string, ExistingRow>();
  for (const row of (existing ?? []) as ExistingRow[]) {
    if (row.source) bySource.set(row.source, row);
    indexRow(byDC, row);
  }

  // ── 3. Process each HAN alert ─────────────────────────────────────────────
  const results = { alerts: entries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — see the push site below for why these,
  // and only these, need to reach the health-check.
  const lockedGuardBlocked: string[] = [];
  // Rows this run re-read from the source and found unchanged — stamped as
  // verified in one batched write after the loop (see lib/source-confirmed.ts).
  const sourceConfirmed: string[] = [];

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
    if (!geo || isAggregateCountry(geo)) {
      log.push({ label: entry.title, status: "skip", detail: `country not in geo-data or aggregate pseudo-country: ${countries[0]}` });
      results.skipped++;
      continue;
    }

    const { cases, deaths } = extractNumbers(pageText.substring(0, 3000));
    const riskLevel         = assessRisk(diseaseInfo.name_en, pageText, cases, deaths);
    const description       = truncateAtSentence(`CDC HAN — ${stripHANPrefix(entry.title)}. ${entry.description}`, 600);
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

    await loadExistingForItems(supabase, byDC, [{ disease_en: diseaseInfo.name_en, country_en: geo.name_en }]);
    const existingRow = byDC.get(dcKey(diseaseInfo.name_en, geo.name_en));

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
        // Source fetched and an entry for this row parsed, carrying nothing
        // newer than the row's `date` — that is a verification, not merely
        // "nothing to write". Recorded so the row stops ageing towards the
        // "no update" badge while its source confirms it every run.
        sourceConfirmed.push(existingRow.id);
        log.push({ label, status: "skip", detail: "data unchanged — source confirmed" });
        results.skipped++;
        continue;
      }

      // Only a date-floor guard existed here — spike/collapse/zero protection
      // was added 2026-08-02, same guard family as sync-who-afro/sync-cdc-notices,
      // shared via lib/outbreak-guards.ts.
      const guardReason =
        dateFloorGuard({ cases, deaths, date: entry.date }, existingRow) ??
        spikeGuard({ cases, deaths, date: entry.date }, existingRow) ??
        collapseGuard({ cases, deaths, date: entry.date }, existingRow) ??
        zeroCaseGuard({ cases, deaths, date: entry.date }, existingRow) ??
        zeroDeathGuard({ cases, deaths, date: entry.date }, existingRow) ??
        lockedRowRegressionGuard({ cases, deaths, date: entry.date }, existingRow);
      if (guardReason) {
        log.push({ label, status: "skip", detail: guardReason });
        results.skipped++;
        // A refusal on a locked (source_priority>=10) row is not an
        // ordinary skip: nothing else will ever write this row again, so a
        // silently-blocked write freezes it on stale figures forever with
        // nothing to show for it (see check-mpox-sitrep/route.ts and
        // project_source_priority_is_ownership_not_freeze_2026_08_19).
        // Ordinary guards (spike/collapse/zeroCase/dateFloor) stay
        // unreported here — their regular-operation volume isn't measured,
        // so surfacing them too would risk drowning the health-check in
        // noise.
        // …but only while that premise holds: a locked row its owning source refreshed
        // days ago is being protected, not frozen, and escalating it every run buries
        // the next real failure of this cron. See lockedRowIsFreezing (2026-08-24).
        if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(existingRow)) lockedGuardBlocked.push(`${label}: ${guardReason}`);
        continue;
      }

      const updatePayload: Record<string, unknown> = {
        cases, deaths, date: entry.date, source: entry.url, description, risk_level: riskLevel, active: true,
        source_priority: Math.max(5, existingRow.source_priority ?? 0),
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
      // .select("id") so a source_priority guard that blocks the write (row now
      // owned by a higher-priority source) is visible as 0 affected rows —
      // without it, a blocked update still returns error: null and was
      // reported as "updated" even though nothing changed. Found 2026-07-15.
      const { data: updatedRows, error } = await supabase
        .from("outbreaks")
        .update(updatePayload)
        .eq("id", existingRow.id).lte("source_priority", 10)
        .select("id");

      if (error) {
        log.push({ label, status: "error", detail: error.message });
        results.errors++;
      } else if (!updatedRows || updatedRows.length === 0) {
        log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
        results.skipped++;
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
        is_backfill: false,
        source_priority: 5,
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

  // One batched verification stamp for every row the source confirmed
  // unchanged. Never fatal: a failed stamp costs freshness metadata, not
  // data, so it is logged and the run still reports on its actual writes.
  const confirmed = await stampSourceConfirmed(supabase, sourceConfirmed);
  if (confirmed.error) console.error("[cdc-han] source_confirmed_at stamp failed:", confirmed.error);

  console.log("[cdc-han] Done:", results, log, `confirmed=${confirmed.stamped}`);
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[cdc-han] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }
  // Was hardcoded "ok" regardless of results.errors — a failed insert/update
  // was silently lost while the report stayed green. Same bug as
  // sync-outbreaks/sync-who-emro (2026-07-29/30).
  await logCronRun(supabase, "sync-cdc-han", results.errors > 0 || lockedGuardBlocked.length > 0 ? "error" : "ok", results.inserted ?? 0,
    lockedGuardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
      : results.errors > 0 ? `${results.errors} écriture(s) en échec` : undefined);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined, ...results, log });
}
