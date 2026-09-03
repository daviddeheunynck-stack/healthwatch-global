// Africa CDC News scraper.
// Schedule: 10 9 * * *  (daily, 09:10 UTC)
// The header used to claim "runs Wed + Sat … the handler below no-ops except
// Wed/Sat"; no such day check has ever existed in this file, and reading it as
// true makes four runs out of six look like days the cron never fired —
// exactly backwards when diagnosing a long rows=0 streak (2026-09-01).
// Fetches recent news posts from africacdc.org/news-item/ (previously /disease-outbreak-news/),
// extracts disease / country / cases, and upserts to outbreaks. Covers sub-Saharan
// African outbreaks (Guinea, Sierra Leone, Burkina Faso, etc.) that may not
// appear in WHO DON or ReliefWeb until later in the outbreak timeline.
// Never overwrites rows owned by the WHO DON daily sync.
//
// Africa CDC is the African Union's own continental public health agency —
// same institutional tier as a WHO regional office for African outbreaks —
// so this cron can write onto rows locked at source_priority=10 (ceiling
// raised 2026-08-19 alongside sync-who-afro/emro — see
// project_source_priority_is_ownership_not_freeze_2026_08_19).
// lockedRowRegressionGuard refuses any decrease on a locked row.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry, isAggregateCountry } from "@/lib/geo-data";
import { findMentionedAfricanCountries } from "@/lib/africa-cdc-countries";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { extractAdmin1, geocodeAdmin1 } from "@/lib/geo-extract";
import { errorMessage } from "@/lib/error";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { truncateAtSentence } from "@/lib/truncate-text";
import { dateFloorGuard, spikeGuard, collapseGuard, zeroCaseGuard, zeroDeathGuard, implausibleDeathsGuard, lockedRowRegressionGuard, lockedRowIsFreezing } from "@/lib/outbreak-guards";
import { stampSourceConfirmed } from "@/lib/source-confirmed";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const AFRICA_CDC_RSS = "https://africacdc.org/news-item/feed/";
const MAX_AGE_DAYS   = 45;

// Bail out of the per-item loop before Vercel hard-kills the function at
// maxDuration. Every RSS item costs one article-page fetch of up to 12s
// (ARTICLE_FETCH_TIMEOUT_MS below) and parseRSSFeed caps nothing but age, so a
// feed serving 10 items — which is what it serves today — is worth up to 120s
// of fetches against a 60s limit. A hard kill never reaches logCronRun, so the
// cron reads as "never ran" rather than "failed", and every row not yet
// upserted is lost, not just the ones the slow articles belonged to. Checked
// before each item, so the worst overshoot is one article fetch plus its
// writes (~53s total). Remaining items come back on the next run — the feed
// keeps serving them for MAX_AGE_DAYS. Same guard family as
// TARGET_LOOP_BUDGET_MS in sync-who-regional and DON_VERIFY_BUDGET_MS in
// data-quality (both 2026-09-02); this third case was missed then, found
// 2026-09-03.
const ITEM_LOOP_BUDGET_MS = 40_000;

// Timeout of a single article-page fetch, and of one RSS attempt.
const ARTICLE_FETCH_TIMEOUT_MS = 12_000;
const RSS_FETCH_TIMEOUT_MS     = 15_000;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/rss+xml,text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

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

// Africa CDC's Elementor/WordPress template puts ~100,000 characters of
// nav/mega-menu/related-posts chrome before the real article — confirmed on
// 2 live articles. The actual post body is reliably wrapped in
// elementor-widget-theme-post-content, WordPress's own post-content widget
// class, immediately after which real content (with real case/death figures)
// begins.
interface ParseStats {
  articlesFetched: number;  // article pages actually retrieved (HTTP ok)
  bodySelectorMisses: number;  // …of which the post-content selector did not match
}

function extractAfricaCdcBody(html: string, stats: ParseStats): string {
  const idx = html.indexOf("elementor-widget-theme-post-content");
  // If Africa CDC changes their template, this selector stops matching — returning
  // the full page (nav/mega-menu/related-posts chrome) instead of "" would feed
  // page chrome into extractNumbers/findMentionedAfricanCountries (wrong case
  // counts, wrong country) rather than the empty-string 0/0 those functions
  // already handle as a visible skip. Found 2026-07-16.
  if (idx < 0) {
    console.warn("[africa-cdc] body selector no longer matches — skipping article");
    stats.bodySelectorMisses++;
    return "";
  }
  const tagEnd = html.indexOf(">", idx) + 1;
  return html.slice(tagEnd, tagEnd + 8000);
}

// Africa CDC press releases open with a wire-service dateline ("ADDIS ABABA,
// ETHIOPIA — The Africa Centres for Disease Control..."), and Africa CDC is
// itself headquartered in Addis Ababa — so nearly every article mentions
// Ethiopia first, regardless of which country the story is actually about.
// findMentionedAfricanCountries() takes the earliest-position match as the
// primary country (correct in general — see its own comment for the DRC/RoC
// substring class of bug that ordering already guards against), so an
// unstripped dateline silently wins over the real subject every time. Found
// 2026-08-11: a DRC Bundibugyo Ebola update (4,120 cases / 1,887 deaths,
// title literally says "DRC Government") got filed under Ethiopia, the only
// country the RSS <description> field mentioned before this fix — the real
// country (DRC) was never even reached, since country detection only falls
// back to the article body when the description yields nothing at all, not
// when it yields something suboptimal. Strip the dateline before country
// detection, not just Ethiopia specifically: the "CITY, COUNTRY — " wire
// format isn't unique to Addis Ababa, and any Africa CDC affiliate office
// datelining a release the same way would reproduce this exact bug.
function stripDateline(text: string): string {
  return text.replace(/^\s*[A-Z][A-Za-z.\s]{1,40},\s*[A-Z][A-Za-z.\s]{1,40}\s*[-–—]\s*/, "");
}

// The dateline pattern above is "Capitalised, Capitalised — ", which a wire
// dateline matches but so does the "Disease, Country — summary" heading style
// Africa CDC also publishes ("Mpox, Democratic Republic of the Congo — situation
// update as of 5 August 2026"; "Lassa fever, Nigeria - weekly epidemiological
// summary" — both verified to strip, 2026-08-12). There the country lives *only*
// in the prefix, so stripping first and asking questions later throws away the
// one mention there was, and detection silently drops to the article body — the
// same "a country mentioned elsewhere wins" failure the dateline strip exists to
// prevent, just displaced one step. So: prefer the stripped reading, and fall
// back to the raw text only when stripping left nothing to go on. The Addis
// Ababa case is unaffected — its stripped text still names the real country, so
// the stripped reading wins exactly as intended.
function countriesIgnoringDateline(text: string): string[] {
  const stripped = findMentionedAfricanCountries(stripDateline(text));
  return stripped.length > 0 ? stripped : findMentionedAfricanCountries(text);
}

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

// Extract disease name from an Africa CDC outbreak title.
// Common patterns:
//   "Mpox Outbreak in Democratic Republic of Congo"
//   "Cholera Outbreak Update — Cameroon"
//   "Marburg Virus Disease — Rwanda"
//   "Yellow Fever — Nigeria | Update 5"
//   "Bundibugyo Ebola without vaccines or therapeutics: why..."
//   "2026 Ebola Disease Outbreak Triggers Unified Response..."
function extractDiseaseFromTitle(title: string): string {
  return title
    .replace(/^\d{4}\s+/, "")                                       // "2026 Ebola Disease..." → "Ebola Disease..."
    .replace(/:.*$/, "")                                             // "Bundibugyo Ebola...: why..." → "Bundibugyo Ebola..."
    .replace(/\s+without\b.*/i, "")                                  // "Bundibugyo Ebola without vaccines" → "Bundibugyo Ebola"
    .replace(/\s*[-–—|]\s*(update|situation|report)\s*#?\d*.*/i, "")
    .replace(/\s+outbreak\s+(?:update\s+)?(?:in|update)\s*.*/i, "")
    .replace(/\s+outbreak\s*$/i, "")
    .replace(/\s*[-–—]\s*.+$/, "")
    .replace(/\s+(?:in|update)\s+.+$/i, "")
    .trim();
}

// ── RSS feed parser ───────────────────────────────────────────────────────────
// Africa CDC publishes all news items at /news-item/feed/ (WordPress RSS 2.0).
// RSS gives reliable <pubDate> and <description> with country mentions baked in.

interface RSSItem {
  url:         string;
  title:       string;
  date:        string;   // YYYY-MM-DD
  description: string;   // plain text stripped from RSS <description>
  categories:  string[]; // <category> tags — Africa CDC uses these for disease names
}

function parseRSSFeed(xml: string): RSSItem[] {
  const items:  RSSItem[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const raw = m[1];

    const title = raw.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    if (!title) continue;

    const link = raw.match(/<link>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim() ??
                 raw.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim();
    if (!link) continue;

    const pubDate = raw.match(/<pubDate>([^<]+)/i)?.[1]?.trim();
    if (!pubDate) continue;
    const d = new Date(pubDate);  // RFC 2822 — native JS Date handles this
    if (isNaN(d.getTime()) || d < cutoff) continue;

    const descRaw = raw.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
    const description = descRaw
      .replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ").replace(/&#8211;/g, "–").replace(/&#124;/g, "|")
      .replace(/\s+/g, " ").trim();

    // Extract all <category> tags — Africa CDC tags articles with disease names
    const categories: string[] = [];
    for (const cat of raw.matchAll(/<category>(?:<!\[CDATA\[)?([^\]<]+)/gi)) {
      const c = cat[1].trim();
      if (c) categories.push(c);
    }

    items.push({ url: link, title, date: d.toISOString().substring(0, 10), description, categories });
  }

  return items;
}

// ── Individual item extraction ────────────────────────────────────────────────

interface PostData {
  disease_en:  string;
  country_en:  string;
  cases:       number;
  deaths:      number;
  source:      string;
  description: string;
  date:        string;
  admin1:      string | null;
  admin1_lat:  number | null;
  admin1_lng:  number | null;
}

async function extractItemData(item: RSSItem, stats: ParseStats): Promise<PostData[]> {
  // Disease detection: try title first, then RSS <category> tags as fallback.
  // Africa CDC often uses institutional titles ("Africa CDC Launches...") with
  // disease names only in the <category> tags.
  let diseaseRaw = extractDiseaseFromTitle(item.title);
  if (!diseaseRaw || diseaseRaw.length > 40 || !isKnownDisease(diseaseRaw)) {
    // Try each category for a recognized disease name
    diseaseRaw = item.categories.find((c) => isKnownDisease(c)) ?? "";
  }
  if (!diseaseRaw || !isKnownDisease(diseaseRaw)) return [];
  const diseaseInfo = normalizeDisease(diseaseRaw);

  // Country detection — RSS description has compact text with key country mentions.
  // e.g. "...Ebola outbreak...in the Democratic Republic of the Congo and Uganda..."
  // Dateline stripped first — see countriesIgnoringDateline() above.
  const descCountries = countriesIgnoringDateline(item.description);
  let primaryCountry: string | null = descCountries.length > 0 ? descCountries[0] : null;

  // Fetch article page: needed for case/death numbers and country fallback.
  let articleText = "";
  try {
    const res = await fetch(item.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(ARTICLE_FETCH_TIMEOUT_MS) });
    if (res.ok) {
      stats.articlesFetched++;
      articleText = htmlToText(extractAfricaCdcBody(await res.text(), stats));
    }
  } catch (e) {
    console.warn("[africa-cdc] fetch post:", errorMessage(e));
  }

  // Fallback country detection from article body (first 1500 chars)
  if (!primaryCountry && articleText) {
    const bodyMentions = countriesIgnoringDateline(articleText.substring(0, 1500));
    if (bodyMentions.length > 0) primaryCountry = bodyMentions[0];
  }

  if (!primaryCountry) return [];
  const geo = findCountry(primaryCountry);
  // Reject aggregate pseudo-countries ("Global", "Multiple countries", ...): unlike
  // who-api.ts/sync-paho-alerts, this cron had no such guard, so free-text mentions
  // of "global public health emergency" etc. (adjective, not a place) matched the
  // "Global" alias and produced a bogus per-country row that double-counts on top
  // of the real DRC/Uganda rows on disease detail pages (found 2026-07-15).
  if (!geo || isAggregateCountry(geo)) return [];

  const fullText = `${item.description} ${articleText}`.trim();
  const { cases, deaths } = extractNumbers(fullText.substring(0, 3000));

  const admin1 = await extractAdmin1(fullText.substring(0, 3000), geo.name_en);
  let admin1_lat: number | null = null;
  let admin1_lng: number | null = null;
  if (admin1) {
    const coords = await geocodeAdmin1(admin1, geo.name_en);
    if (coords) { admin1_lat = coords.lat; admin1_lng = coords.lng; }
    await new Promise((r) => setTimeout(r, 1100));
  }

  return [{
    disease_en:  diseaseInfo.name_en,
    country_en:  geo.name_en,
    cases,
    deaths,
    source:      item.url,
    description: truncateAtSentence(`Africa CDC — ${item.title}. ${item.description}`, 600),
    date:        item.date,
    admin1,
    admin1_lat,
    admin1_lng,
  }];
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
  items: PostData[],
): Promise<void> {
  const missing = items.filter((i) => !byDC.has(dcKey(i.disease_en, i.country_en)));
  if (missing.length === 0) return;

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .in("disease_en", [...new Set(missing.map((i) => i.disease_en))])
    .in("country_en", [...new Set(missing.map((i) => i.country_en))]);

  if (error) {
    console.warn("[africa-cdc] dedup lookup:", error.message);
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

  // Defensive wrapper: the per-item processing loop (section 3 below) runs
  // outside any enclosing try/catch. An uncaught exception there propagated
  // straight out: bare 500, no Sentry event, logCronRun never reached — same
  // root cause as the sync-outbreaks incident of 2026-07-29.
  try {
    return await runAfricaCdc(req, supabase);
  } catch (err) {
    console.error("[africa-cdc] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-africa-cdc" } });
    await logCronRun(supabase, "sync-africa-cdc", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runAfricaCdc(_req: NextRequest, supabase: SupabaseClient) {
  const today   = new Date().toISOString().substring(0, 10);
  // Budget clock starts here, not at the loop: a slow RSS fetch spends the same
  // 60s of function time the loop needs, so measuring from the loop would let
  // the two overrun together. See ITEM_LOOP_BUDGET_MS.
  const runStart = Date.now();

  // ── 1. Fetch Africa CDC RSS feed ─────────────────────────────────────────
  // fetchWithRetry: a transient network blip used to cost this daily cron a
  // full 24h cycle (found 2026-09-02 — see lib/fetch-retry.ts). That rollout
  // also cut the per-attempt timeout from 15s to 8s, to keep the retry from
  // eating a loop that had no budget guard of its own. The guard now exists,
  // so the cut has no reason left — and it had no measurement behind it
  // either: 10 consecutive fetches of this feed on 2026-09-03 came back in
  // 663 / 680 / 1744 ms (min / median / max), 0 failures. Restored to the
  // original 15s, per this repo's own lesson from the false aphis_unreachable
  // of 2026-09-02 (6ba10a5a): never shorten a timeout without measuring the
  // source. NB: the run that failed on 2026-09-03 at 09:10 UTC aborted twice
  // at 8s one second apart, which looks more like the source being
  // unreachable from Vercel than like latency — 15s is not claimed to fix
  // that, only to stop guessing.
  const { response: res, error: rssFetchErr, attemptsMade } = await fetchWithRetry(
    AFRICA_CDC_RSS, { headers: FETCH_HEADERS },
    { attempts: 2, timeoutMs: RSS_FETCH_TIMEOUT_MS, backoffMs: [1000] },
  );
  if (!res) {
    const msg = `${errorMessage(rssFetchErr)} (${attemptsMade} tentative(s))`;
    console.error("[africa-cdc] fetch RSS:", msg);
    Sentry.captureException(rssFetchErr ?? new Error(msg), { tags: { cron: "sync-africa-cdc" } });
    await logCronRun(supabase, "sync-africa-cdc", "error", 0, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (!res.ok) {
    const msg = `Africa CDC RSS HTTP ${res.status} (${attemptsMade} tentative(s))`;
    console.error(`[africa-cdc] ${msg}`);
    await logCronRun(supabase, "sync-africa-cdc", "error", 0, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  // Lecture du corps dans son propre try : AbortSignal.timeout couvre AUSSI le
  // streaming du corps, pas seulement les en-têtes, donc text() peut lever
  // après un fetch « réussi ». Avant le passage à fetchWithRetry (2026-09-02)
  // cette lecture était couverte par le try du fetch et journalisée sous ce
  // cron ; sans ça elle remonte au wrapper défensif du GET. Restauré 2026-09-03.
  let rssXml: string;
  try {
    rssXml = await res.text();
  } catch (e) {
    const msg = `${errorMessage(e)} (lecture du corps)`;
    console.error("[africa-cdc] read RSS body:", msg);
    Sentry.captureException(e, { tags: { cron: "sync-africa-cdc" } });
    await logCronRun(supabase, "sync-africa-cdc", "error", 0, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const items = parseRSSFeed(rssXml);
  console.log(`[africa-cdc] Found ${items.length} recent item(s) within ${MAX_AGE_DAYS} days`);

  if (items.length === 0) {
    await logCronRun(supabase, "sync-africa-cdc", "no_data", 0);
    return NextResponse.json({ success: true, items: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing outbreaks for dedup ──────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) {
    await logCronRun(supabase, "sync-africa-cdc", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const byDC = new Map<string, ExistingRow>();
  for (const row of (existing ?? []) as ExistingRow[]) indexRow(byDC, row);

  // ── 3. Process each RSS item ──────────────────────────────────────────────
  const results = { items: items.length, inserted: 0, updated: 0, skipped: 0, errors: 0, unprocessed: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — see the push site below for why these,
  // and only these, need to reach the health-check.
  const lockedGuardBlocked: string[] = [];
  // Rows this run re-read from the source and found unchanged — stamped as
  // verified in one batched write after the loop (see lib/source-confirmed.ts).
  const sourceConfirmed: string[] = [];
  // Article-parsing health, separate from the write counters. Africa CDC
  // publishes long stretches of institutional news (task forces, conferences,
  // vaccine-allocation statements) carrying no case figures, so rows=0 is a
  // normal week here — which is precisely why a broken parser looks identical
  // to a quiet source and can sit unnoticed for weeks (same shape as the PAHO
  // sitrep outage of 2026-08-30, and as this cron's own 21-day rows=0 streak
  // that prompted the check, 2026-09-01 — that one turned out to be a genuinely
  // quiet source). These two counters are what tells the cases apart.
  const parseStats: ParseStats = { articlesFetched: 0, bodySelectorMisses: 0 };

  let itemsProcessed = 0;

  for (const item of items) {
    // Bail out before the Vercel maxDuration kills the function outright — a
    // partial run that still logs and upserts what it processed beats a hard
    // timeout with nothing persisted. See ITEM_LOOP_BUDGET_MS above.
    if (Date.now() - runStart > ITEM_LOOP_BUDGET_MS) {
      // Counted apart from results.skipped: these items were never looked at,
      // whereas a skip is a decision taken about an item that was.
      results.unprocessed = items.length - itemsProcessed;
      log.push({ label: "budget", status: "skip", detail: `time budget exceeded, ${results.unprocessed} item(s) left unprocessed` });
      break;
    }
    itemsProcessed++;

    let extracted: PostData[] = [];
    try {
      extracted = await extractItemData(item, parseStats);
    } catch (e) {
      log.push({ label: item.title, status: "error", detail: errorMessage(e) });
      Sentry.captureException(e, { tags: { cron: "sync-africa-cdc" } });
      results.errors++;
      continue;
    }

    if (extracted.length === 0) {
      log.push({ label: item.title, status: "skip", detail: "disease not in map or no country found" });
      results.skipped++;
      continue;
    }

    await loadExistingForItems(supabase, byDC, extracted);

    for (const item of extracted) {
      const label = `${item.disease_en}/${item.country_en}`;

      if (item.date > today) {
        log.push({ label, status: "skip", detail: `future date: ${item.date}` });
        results.skipped++;
        continue;
      }

      // Skip 0/0 entries — they are institutional/funding articles parsed as outbreaks
      if (item.cases === 0 && item.deaths === 0) {
        log.push({ label, status: "skip", detail: "0 cases and 0 deaths — likely non-surveillance article" });
        results.skipped++;
        continue;
      }

      // Deaths above cases is never real — it is a mis-parse (a contact-tracing
      // figure, a funding amount, a table column read out of order). Every other
      // guard in this file compares against an existing row, so an item this
      // wrong reached the write layer and was stopped only when a row happened
      // to exist for that disease/country and some *other* guard fired on it;
      // with no existing row it was inserted as-is. Live feed on 2026-09-01:
      // "Three Months into the Bundibugyo Ebola Outbreak" parsed as 8 cases /
      // 2 320 deaths for Uganda — blocked here now, blocked only by luck before.
      // Same placement and wording as sync-ecdc-threats and sync-outbreaks.
      const implausibleReason = implausibleDeathsGuard(item);
      if (implausibleReason) {
        log.push({ label, status: "skip", detail: implausibleReason });
        results.skipped++;
        continue;
      }

      const geo = findCountry(item.country_en);
      if (!geo || isAggregateCountry(geo)) {
        log.push({ label, status: "skip", detail: "country not in geo-data or aggregate pseudo-country" });
        results.skipped++;
        continue;
      }

      const existRow = byDC.get(dcKey(item.disease_en, item.country_en));

      // Never overwrite WHO DON-owned rows
      if (existRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
        log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
        results.skipped++;
        continue;
      }

      const diseaseInfo = normalizeDisease(item.disease_en);
      const riskLevel   = assessRisk(item.disease_en, item.description, item.cases, item.deaths);

      if (existRow) {
        const isNewer    = item.date > existRow.date;
        const casesDiff  = item.cases  !== existRow.cases;
        const deathsDiff = item.deaths !== existRow.deaths;

        if (!isNewer && !casesDiff && !deathsDiff) {
          // Source fetched and an entry for this row parsed, carrying nothing
          // newer than the row's `date` — that is a verification, not merely
          // "nothing to write". Recorded so the row stops ageing towards the
          // "no update" badge while its source confirms it every run.
          sourceConfirmed.push(existRow.id);
          log.push({ label, status: "skip", detail: "data unchanged — source confirmed" });
          results.skipped++;
          continue;
        }

        // Only a date-floor guard existed here — spike/collapse/zero protection
        // was added 2026-08-02, same guard family as sync-who-afro/sync-cdc-notices,
        // shared via lib/outbreak-guards.ts. Africa CDC pages are HTML bulletins
        // parsed the same fragile way as those two sources.
        const guardReason =
          dateFloorGuard(item, existRow) ??
          spikeGuard(item, existRow) ??
          collapseGuard(item, existRow) ??
          zeroCaseGuard(item, existRow) ??
          zeroDeathGuard(item, existRow) ??
          lockedRowRegressionGuard(item, existRow);
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
          if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(existRow)) lockedGuardBlocked.push(`${label}: ${guardReason}`);
          continue;
        }

        const updatePayload: Record<string, unknown> = {
          cases:           item.cases,
          deaths:          item.deaths,
          date:            item.date,
          source:          item.source,
          description:     item.description,
          risk_level:      riskLevel,
          active:          true,
          source_priority: Math.max(5, existRow.source_priority ?? 0),
        };
        // English description just changed — existing FR/ES/AR/ID translations
        // (if any) now describe stale figures. Null them so sync-outbreaks'
        // backfill sweep re-translates from the fresh text (it only fires when
        // description_fr IS NULL — see project_sync_outbreaks_paho_translation_drift_fixed).
        if (existRow.description !== item.description) {
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
          .eq("id", existRow.id)
          .lte("source_priority", 10)
          .select("id");

        if (error) {
          log.push({ label, status: "error", detail: error.message });
          results.errors++;
        } else if (!updatedRows || updatedRows.length === 0) {
          log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
          results.skipped++;
        } else {
          log.push({ label, status: "updated", detail: `${item.cases} cases / ${item.deaths} deaths (${item.date})` });
          results.updated++;
        }
      } else {
        const { error } = await supabase.from("outbreaks").insert({
          disease:     diseaseInfo.name_fr,
          disease_en:  diseaseInfo.name_en,
          disease_ar:  diseaseInfo.name_ar,
          country:     geo.name_fr,
          country_en:  geo.name_en,
          country_ar:  geo.name_ar,
          region:      geo.region,
          lat:         geo.lat,
          lng:         geo.lng,
          cases:       item.cases,
          deaths:      item.deaths,
          risk_level:  riskLevel,
          date:        item.date,
          source:      item.source,
          description: item.description,
          active:      true,
          is_seed:     false,
          is_backfill: false,
          source_priority: 5,
          admin1:      item.admin1 ?? null,
          admin1_lat:  item.admin1_lat ?? null,
          admin1_lng:  item.admin1_lng ?? null,
        });

        if (error) {
          log.push({ label, status: "error", detail: error.message });
          results.errors++;
        } else {
          log.push({ label, status: "inserted", detail: `${item.cases} cases / ${item.deaths} deaths (${item.date})` });
          results.inserted++;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // One batched verification stamp for every row the source confirmed
  // unchanged. Never fatal: a failed stamp costs freshness metadata, not
  // data, so it is logged and the run still reports on its actual writes.
  const confirmed = await stampSourceConfirmed(supabase, sourceConfirmed);
  if (confirmed.error) console.error("[africa-cdc] source_confirmed_at stamp failed:", confirmed.error);

  console.log("[africa-cdc] Done:", results, log, `confirmed=${confirmed.stamped}`, parseStats);

  // Every article fetched, not one of them parseable: that is the template
  // change extractAfricaCdcBody() warns about, and on its own it produces a
  // textbook clean run — 0 errors, 0 writes, status ok — because an empty body
  // makes extractNumbers return 0/0 and every item exits through the
  // "0 cases and 0 deaths" skip. Nothing downstream would ever notice.
  const selectorBroken = parseStats.articlesFetched > 0 &&
                         parseStats.bodySelectorMisses === parseStats.articlesFetched;
  if (selectorBroken) {
    Sentry.captureMessage(
      `[africa-cdc] post-content selector matched 0 of ${parseStats.articlesFetched} article(s) — Africa CDC template likely changed`,
      "error",
    );
  }
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[africa-cdc] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }
  // Was hardcoded "ok" regardless of results.errors — same bug as
  // sync-outbreaks (2026-07-29). rowsUpdated was `results.inserted` alone —
  // a run that only refreshes existing rows (results.updated) reported
  // rows:0 and never advanced lastNonZero, exactly the gap lastNonZero was
  // added to catch (see sync-who-afro, which already sums both). Fixed
  // 2026-08-19 alongside the guard-visibility fix above.
  await logCronRun(supabase, "sync-africa-cdc",
    results.errors > 0 || lockedGuardBlocked.length > 0 || selectorBroken ? "error" : "ok",
    (results.inserted ?? 0) + (results.updated ?? 0),
    lockedGuardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
      : selectorBroken
        ? `sélecteur de corps d'article sans correspondance sur ${parseStats.bodySelectorMisses}/${parseStats.articlesFetched} article(s) — template Africa CDC probablement modifié`
        : results.errors > 0
          ? `${results.errors} écriture(s) en échec`
          // A truncated run is degraded, not broken — it stays status "ok" (the
          // items come back on the next run), but it must not read as a full
          // pass either, or a feed that grows past the budget every day would
          // silently stop covering its tail.
          : results.unprocessed > 0
            ? `budget de boucle dépassé : ${results.unprocessed} item(s) non traité(s), repris au prochain run`
            : undefined,
    // Stamped on every run: without it, "the source published nothing with
    // figures again today" and "this cron stopped running" both read as a
    // rows=0 entry with a stale ts. Same remedy as disease-alerts (2026-08-23).
    new Date().toISOString());
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined, parseStats, ...results, log });
}
