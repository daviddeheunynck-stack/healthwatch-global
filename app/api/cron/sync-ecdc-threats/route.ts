// ECDC Epidemiological Update scraper — runs daily at 09:05 UTC (see vercel.json).
// Schedule: 5 9 * * *
// Reads the ECDC "Epidemiological update" RSS feed (taxonomy/term/1310), fetches
// each article page for case numbers and country mentions, and upserts to outbreaks.
// Replaces the old Threat Assessment Brief HTML scraper (that URL is now 404).
// Covers EU/EEA-specific threats (Ebola, MERS-CoV, Mpox, Hantavirus, etc.).
// Never overwrites rows owned by the WHO DON daily sync.
//
// ECDC is the EU's own centre for disease prevention and control — a genuine
// primary institutional source — so this cron can write onto rows locked at
// source_priority=10 (ceiling raised 2026-08-19 alongside sync-who-afro/emro
// — see project_source_priority_is_ownership_not_freeze_2026_08_19).
// lockedRowRegressionGuard adds a cases-decrease check on a locked row;
// deathsNeverDecreaseGuard below already covers deaths unconditionally.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry, isAggregateCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk, UMBRELLA_COUNTRY_LABELS } from "@/lib/outbreak-parser";
import { extractAdmin1, geocodeAdmin1 } from "@/lib/geo-extract";
import { errorMessage } from "@/lib/error";
import { dateFloorGuard, spikeGuard, deathsNeverDecreaseGuard, implausibleDeathsGuard, lockedRowRegressionGuard, lockedRowIsFreezing } from "@/lib/outbreak-guards";
import { stampSourceConfirmed } from "@/lib/source-confirmed";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

// RSS feed for "Epidemiological update" content type — 10 items, updated weekly
const ECDC_RSS_FEED = "https://www.ecdc.europa.eu/en/taxonomy/term/1310/feed";
const MAX_AGE_DAYS  = 45;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/rss+xml,text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// Country names sorted longest-first. Load-bearing for the span-masking in
// findMentionedCountries below: a longer country name must be searched (and its
// span blanked) before any shorter name that is a substring of it.
const COUNTRY_NAMES = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);

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

// ECDC's ~2,100-char nav mega-menu (Topics A-Z, spotlight, newsroom, etc.)
// before the article — the exact "heavy nav" this file's own comment already
// flagged — happened to still fit under the old 8,000-char budget on the 2
// pages tested, including a "worldwide overview" page, but only by margin.
// role="main" scopes past it reliably (verified stable on both).
function extractECDCBody(html: string): string {
  const idx = html.indexOf('role="main"');
  // If ECDC changes their template, this selector stops matching — returning the
  // full page (nav mega-menu) instead of "" would feed page chrome into
  // extractNumbers/findMentionedCountries (wrong case counts, wrong country)
  // rather than the empty-string 0/0 those functions already handle as a
  // visible skip. Found 2026-07-16.
  if (idx < 0) {
    console.warn("[ecdc-threats] body selector no longer matches — skipping article");
    return "";
  }
  const tagEnd = html.indexOf(">", idx) + 1;
  return html.slice(tagEnd, tagEnd + 8000);
}

// ECDC "living" topic pages (e.g. the Ebola DRC/Uganda page) are rewritten in
// place as new data arrives — the RSS <pubDate> for such an item is when the
// page was first published, not the age of the figures currently on it (seen
// 2026-07-15: pubDate stuck at 6 July while the page's own text reported
// "data up until 12 July"). Prefer the page's own as-of statement when
// present; falls back to the RSS pubDate for one-off dated articles that
// don't carry this phrasing.
const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function extractAsOfDate(text: string, fallback: string, today: string): string {
  const m =
    text.match(/data\s+up\s+until\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/i) ??
    text.match(/(?:as\s+of|last\s+updated)\s+(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/i);
  if (!m) return fallback;

  const day   = parseInt(m[1], 10);
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return fallback;

  // No explicit year in the text — anchor on the current year (far more
  // reliable than the RSS pubDate's year, which can be stale by months on a
  // "living" page). If that guess lands in the future, the article is
  // describing a date from the previous year (e.g. "as of 31 December" read
  // in early January).
  let year = m[3] ? parseInt(m[3], 10) : parseInt(today.substring(0, 4), 10);
  let d = new Date(Date.UTC(year, month, day));
  if (!m[3] && d.toISOString().substring(0, 10) > today) {
    year -= 1;
    d = new Date(Date.UTC(year, month, day));
  }
  if (isNaN(d.getTime())) return fallback;

  const iso = d.toISOString().substring(0, 10);
  // Sanity bounds: this phrasing only appears on "living" pages describing
  // their own current data, not historical retrospectives — never in the
  // future, and not implausibly old (a misparsed unrelated number).
  if (iso > today) return fallback;
  if ((Date.parse(today) - Date.parse(iso)) / 86_400_000 > 120) return fallback;
  return iso;
}

// Detect if a disease term maps to a known entry in our disease map
function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

// Abbreviations that appear in ECDC titles/text → canonical country key
const TEXT_ALIASES: Record<string, string> = {
  " drc ":   "Democratic Republic of the Congo",
  "(drc)":   "Democratic Republic of the Congo",
  " rdc ":   "Democratic Republic of the Congo",
  " dr congo": "Democratic Republic of the Congo",
};

// Find countries mentioned in the text (returns canonical country keys from COUNTRIES).
//
// Matching walks a MASKED copy of the text: every matched span is blanked
// (spaces of equal length, offsets preserved) before shorter terms are searched.
// Because aliases and country names are searched longest-first, a longer country
// name's span is consumed before any shorter name that is a substring of it can
// match inside it. This stops "Republic of the Congo" (name_en "Congo", RoC)
// from matching inside "Democratic Republic of the Congo" and mis-attributing a
// DRC-only article to RoC — the fan-out at the call site would otherwise create a
// phantom active Ebola/Congo row double-counting DRC on aggregate pages (the same
// 2026-07-21 phantom fixed in sync-africa-cdc, commit b39e44c; ECDC is the ECDC
// source of the same row, missed by that fix because it only patched africa-cdc).
// Longest-first ordering alone did NOT prevent it: the RoC substring got its own
// indexOf position independent of the DRC hit and was recorded as a separate key.
// The same guard also blocks Niger⊂Nigeria, Sudan⊂South Sudan, Guinea⊂Equatorial
// Guinea. ALL occurrences of each term are blanked (not just the first) so a body
// that repeats "Democratic Republic of the Congo" can't leak RoC from a later
// mention. Output order is unchanged: aliases first, then names longest-first.
function findMentionedCountries(text: string): string[] {
  let masked = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  const seen  = new Set<string>();

  const consume = (search: string, output: string): void => {
    let idx = masked.indexOf(search);
    if (idx === -1) return;
    if (!seen.has(output)) {
      found.push(output);
      seen.add(output);
    }
    // Blank every occurrence of this term so no shorter substring can re-match
    // inside it — even when the country was already recorded via an alias.
    while (idx !== -1) {
      masked = masked.slice(0, idx) + " ".repeat(search.length) + masked.slice(idx + search.length);
      idx = masked.indexOf(search, idx + search.length);
    }
  };

  // Abbreviation aliases first (map to a canonical COUNTRIES key)...
  for (const [abbr, canonical] of Object.entries(TEXT_ALIASES)) {
    consume(abbr, canonical);
  }
  // ...then full country names, longest-first (see COUNTRY_NAMES).
  for (const name of COUNTRY_NAMES) {
    if (!COUNTRIES[name]) continue;
    consume(name.toLowerCase(), name);
  }
  return found;
}

// Extract disease name from an ECDC epidemiological update title.
// e.g. "Ebola disease outbreak in DRC and Uganda" → "Ebola disease"
//      "MERS-CoV worldwide overview" → "MERS-CoV"
//      "Mpox worldwide overview" → "Mpox"
//      "Epidemiological update: Shigella in Europe" → "Shigella"
function extractECDCDisease(title: string): string {
  return title
    .replace(/^epidemiological\s+update\s*:\s*/i, "")
    .replace(/^(?:rapid\s+risk\s+assessment|threat\s+assessment\s+brief)\s*:\s*/i, "")
    .replace(/\s+worldwide\s+overview\b.*/i, "")
    .replace(/\s+situation\s+update\b.*/i, "")
    .replace(/\s+outbreak\b.*/i, "")
    .replace(/\s+in\s+.+$/i, "")
    .replace(/\s*[–—]\s*.+$/, "")
    .trim();
}

// ── RSS feed parser ───────────────────────────────────────────────────────────

interface RSSItem {
  url:         string;
  title:       string;
  date:        string;   // YYYY-MM-DD
  description: string;   // plain text from RSS <description>
}

function parseRSSFeed(xml: string): RSSItem[] {
  const items:   RSSItem[] = [];
  const cutoff   = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const raw = m[1];

    const title = raw.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    if (!title) continue;

    // <link> in RSS 2.0 is a text node between tags
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
      .replace(/&nbsp;/g, " ").replace(/\s+/g, " ")
      .trim();

    items.push({ url: link, title, date: d.toISOString().substring(0, 10), description });
  }

  return items;
}

// ── Individual article page ───────────────────────────────────────────────────

interface BriefData {
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

async function extractItemData(item: RSSItem, today: string, dbg?: { reason?: string }): Promise<BriefData[]> {
  const titleCore = extractECDCDisease(item.title);
  if (!titleCore || !isKnownDisease(titleCore)) {
    if (dbg) dbg.reason = `unknown disease: titleCore="${titleCore}"`;
    return [];
  }
  const diseaseInfo = normalizeDisease(titleCore);

  // "X worldwide overview" is ECDC's own naming convention (see extractECDCDisease
  // above) for a global cumulative rollup with no single-country focus. Any country
  // name the fallback body-scan below might pick up from such a page (nav, "related
  // topics" sidebar, etc.) is incidental page chrome, not the bulletin's actual
  // subject. Found 2026-06-28, patched then by deactivating the resulting row
  // (20260628000000_deactivate_bad_ecdc_rows.sql) without fixing this root cause —
  // the row still existed and resurfaced via isDisplayActive()'s 60-day recency
  // fallback (found again 2026-07-16, MERS-CoV worldwide overview misattributed to
  // "DR Congo"). Skip these entirely rather than guess.
  if (/\bworldwide\s+overview\b/i.test(item.title)) {
    if (dbg) dbg.reason = "worldwide-scope overview — not attributable to a single country";
    return [];
  }

  // Fetch article page for full case numbers and country context
  let articleText = "";
  try {
    const res = await fetch(item.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (res.ok) articleText = htmlToText(extractECDCBody(await res.text()));
  } catch (e) {
    console.warn("[ecdc] fetch article:", errorMessage(e));
  }

  // Prefer the page's own as-of statement over the RSS pubDate — see
  // extractAsOfDate() for why (ECDC "living" topic pages).
  const asOfDate = extractAsOfDate(articleText, item.date, today);

  // Combine RSS description + article intro for extraction.
  // Use 8 000 chars — ECDC "worldwide overview" pages have heavy nav before the article body.
  const fullText = `${item.description} ${articleText}`.trim();
  const { cases, deaths } = extractNumbers(fullText.substring(0, 8_000));

  // Detect if this article is explicitly about a European outbreak (used for both
  // country fallback and EU multi-country mode guard below). Check the RSS
  // description too — some articles (e.g. cruise-ship clusters) only say
  // "EU/EEA" in the editorial summary, not the title.
  const titleLower = item.title.toLowerCase();
  const descLower  = item.description.toLowerCase();
  const isEuropeArticle =
    titleLower.includes("europe") || descLower.includes("europe") ||
    titleLower.includes("eu/eea") || descLower.includes("eu/eea") ||
    titleLower.includes(" eu ")   || descLower.includes(" eu ")   ||
    titleLower.includes("european") || descLower.includes("european");

  // Country detection: title first (most reliable), then body text.
  // The article body often mentions European countries in risk-assessment sections
  // unrelated to the actual outbreak — the title explicitly names the source country.
  const titleCountries = findMentionedCountries(item.title);
  const titleNonEU     = titleCountries.filter((c) => {
    const g = findCountry(c);
    return g && g.region !== "europe";
  });
  // A European country the TITLE itself names (e.g. a future dedicated article
  // "Ebola disease outbreak — France") is a standalone update: that article's
  // extracted cases/deaths describe France specifically, not another country's
  // aggregate. Kept separate from titleNonEU so it can be added back into
  // targetCountries below even when a non-EU country is also present (the
  // outbreak's country of origin, named in body context) — see targetCountries.
  const titleEU = titleCountries.filter((c) => {
    const g = findCountry(c);
    return g && g.region === "europe";
  });

  // Prefer the curated RSS description over the full scraped page: the page
  // scrape includes nav/sidebar/"related topics" text that can name countries
  // never mentioned in the actual outbreak report (e.g. a cruise-ship article
  // picking up an unrelated DRC link and getting geocoded to Africa). Only
  // fall back to scanning the full article text when the description itself
  // names no country.
  const descriptionCountries = findMentionedCountries(item.description);
  const bodyCountries = descriptionCountries.length > 0
    ? descriptionCountries
    : findMentionedCountries(`${item.description} ${articleText.substring(0, 12_000)}`);

  // Merge: title-found non-EU countries first (outbreak source), then body countries.
  // This prevents a European country mentioned in the risk section from overriding
  // the actual outbreak country (e.g. Germany appearing before DRC in the body).
  const seenMerge = new Set([...titleNonEU, ...titleEU].map((c) => c.toLowerCase()));
  const countries = [
    ...titleNonEU,
    ...titleEU,
    ...bodyCountries.filter((c) => !seenMerge.has(c.toLowerCase())),
  ];

  // Fallback for EU articles whose body is JS-rendered (no static country names):
  // use the ECDC EU/EEA surveillance country set when cases are parseable but
  // no countries were detected in the HTML.
  if (countries.length === 0 && isEuropeArticle && cases > 0) {
    countries.push("EU/EEA");
  }

  if (countries.length === 0) {
    if (dbg) dbg.reason = `no country: cases=${cases} isEU=${isEuropeArticle} desc="${item.description.substring(0, 120)}"`;
    return [];
  }

  const euCountries = countries.filter((c) => {
    const g = findCountry(c);
    return g?.region === "europe";
  });
  const isEUMultiCountry = isEuropeArticle && euCountries.length >= 2;

  // Non-EU countries named in the article (e.g. "Ebola disease outbreak in
  // DRC and Uganda" names both). Previously only countries[0] was ever
  // processed — for this exact title, that's always DRC (the " drc "
  // TEXT_ALIASES check runs before the general country-name loop, so DRC
  // wins the ordering regardless of which country the title actually
  // mentions first), and Uganda was silently dropped with no skip log at
  // all. Each one now goes through the same per-country pipeline as a
  // single-country article — the WHO-DON-ownership skip and the
  // spike/collapse guards below already protect an existing row from a
  // wrongly-attributed shared figure, so a country legitimately owned
  // elsewhere is explicitly skipped instead of never being attempted.
  const nonEuCountries = countries.filter((c) => {
    const g = findCountry(c);
    return g && g.region !== "europe";
  });

  // For EU-wide overview articles the extracted case count is an EU aggregate —
  // not attributable to individual countries. Use a single EU/EEA entry rather
  // than duplicating the total across every mentioned member state.
  // A European country only ever found in the BODY (e.g. "two cases were
  // exported to Germany" inside the DRC/Uganda living page) stays excluded
  // here: the article's single extracted case/death count is scoped to the
  // whole page (the non-EU outbreak total), and would misattribute that
  // aggregate to the exported-case country. A European country the TITLE
  // names (titleEU) is a dedicated update instead — include it alongside any
  // non-EU countries rather than dropping it wholesale.
  const titleEUNotInNonEU = titleEU.filter(
    (c) => !nonEuCountries.some((n) => n.toLowerCase() === c.toLowerCase())
  );
  const targetCountries = isEUMultiCountry
    ? ["EU/EEA"]
    : nonEuCountries.length > 0
      ? [...nonEuCountries, ...titleEUNotInNonEU]
      : [countries[0]];

  const results: BriefData[] = [];
  const descBase = `ECDC — ${item.title}. ${item.description}`.substring(0, 600);

  for (const countryName of targetCountries) {
    const geo = findCountry(countryName);
    if (!geo || isAggregateCountry(geo)) continue;

    const admin1 = isEUMultiCountry
      ? null  // skip admin1 geocoding for bulk EU processing (performance)
      : await extractAdmin1(fullText.substring(0, 3000), geo.name_en);
    let admin1_lat: number | null = null;
    let admin1_lng: number | null = null;
    if (admin1) {
      const coords = await geocodeAdmin1(admin1, geo.name_en);
      if (coords) { admin1_lat = coords.lat; admin1_lng = coords.lng; }
      await new Promise((r) => setTimeout(r, 1100));
    }

    results.push({
      disease_en:  diseaseInfo.name_en,
      country_en:  geo.name_en,
      cases,
      deaths,
      source:      item.url,
      description: descBase,
      date:        asOfDate,
      admin1,
      admin1_lat,
      admin1_lng,
    });
  }

  return results;
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

const dcKeyOf = (disease: string | null, country: string | null) =>
  `${(disease ?? "").toLowerCase()}|${(country ?? "").toLowerCase()}`;

function indexRow(byDC: Map<string, ExistingRow>, row: ExistingRow): void {
  const k    = dcKeyOf(row.disease_en, row.country_en);
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
  const missing = items.filter((i) => !byDC.has(dcKeyOf(i.disease_en, i.country_en)));
  if (missing.length === 0) return;

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .in("disease_en", [...new Set(missing.map((i) => i.disease_en))])
    .in("country_en", [...new Set(missing.map((i) => i.country_en))]);

  if (error) {
    console.warn("[ecdc] dedup lookup:", error.message);
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

  // Defensive wrapper: the per-item processing loop below runs outside any
  // enclosing try/catch. An uncaught exception there propagated straight out:
  // bare 500, no Sentry event, logCronRun never reached — same root cause as
  // the sync-outbreaks incident of 2026-07-29.
  try {
    return await runEcdcThreats(req, supabase);
  } catch (err) {
    console.error("[ecdc] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-ecdc-threats" } });
    await logCronRun(supabase, "sync-ecdc-threats", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runEcdcThreats(_req: NextRequest, supabase: SupabaseClient) {
  const today = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch ECDC Epidemiological Update RSS feed ─────────────────────────
  let rssXml: string;
  try {
    const res = await fetch(ECDC_RSS_FEED, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[ecdc] RSS HTTP ${res.status}`);
      await logCronRun(supabase, "sync-ecdc-threats", "error", 0, `ECDC RSS HTTP ${res.status}`);
      return NextResponse.json({ error: `ECDC RSS HTTP ${res.status}` }, { status: 502 });
    }
    rssXml = await res.text();
  } catch (e) {
    console.error("[ecdc] fetch RSS:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-ecdc-threats" } });
    await logCronRun(supabase, "sync-ecdc-threats", "error", 0, errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const entries = parseRSSFeed(rssXml);
  console.log(`[ecdc] Found ${entries.length} recent item(s) within ${MAX_AGE_DAYS} days`);

  if (entries.length === 0) {
    await logCronRun(supabase, "sync-ecdc-threats", "no_data", 0);
    return NextResponse.json({ success: true, briefs: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing outbreaks for dedup ──────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) {
    await logCronRun(supabase, "sync-ecdc-threats", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const byDC = new Map<string, ExistingRow>();
  for (const row of (existing ?? []) as ExistingRow[]) indexRow(byDC, row);

  // Defensive index: (normalized disease + country) → an ACTIVE row already
  // exists, even if its raw disease_en/country_en text differs from what a
  // fresh parse produces. byDC above matches on raw text, which is fragile to
  // any label drift (a relabel, a species-suffix change, another cron's own
  // canonicalization) — found 2026-07-15 when exactly this happened on the
  // DR Congo/Uganda Ebola rows. Update below forces active:true unconditionally
  // and is only gated on source_priority (never on .active); insert has no
  // collision guard at all — so a label mismatch here can silently create a
  // second active row for a disease+country that already has one.
  const activeByNormalizedDC = new Set<string>();
  for (const row of existing ?? []) {
    if (!row.active) continue;
    const normDisease = normalizeDisease(row.disease_en ?? "").name_en.toLowerCase();
    // Normalize country too, not just disease — a raw country_en comparison is just as
    // fragile to label drift ("DR Congo" vs "Democratic Republic of the Congo") as the
    // raw disease_en comparison this guard was built to route around. Found 2026-07-16.
    const normCountry = (findCountry(row.country_en ?? "")?.name_en ?? row.country_en ?? "").toLowerCase();
    activeByNormalizedDC.add(`${normDisease}|${normCountry}`);
  }

  // Diseases that already have a WHO DON-owned row under an umbrella label. An
  // umbrella item (e.g. "EU/EEA") for such a disease is the same multi-country event
  // the DON sync owns — defer to WHO instead of re-inserting a parallel active row
  // under a mismatched label. Bounded to rows in the 90-day load window above, so a
  // genuinely new event later (which would get its own DON) is unaffected.
  const donOwnedUmbrellaDiseases = new Set<string>();
  for (const row of existing ?? []) {
    if (row.source?.includes("who.int/emergencies/disease-outbreak-news") &&
        UMBRELLA_COUNTRY_LABELS.has((row.country_en ?? "").toLowerCase())) {
      donOwnedUmbrellaDiseases.add((row.disease_en ?? "").toLowerCase());
    }
  }

  // ── 3. Process each RSS item ──────────────────────────────────────────────
  const results = { briefs: entries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
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
    let briefItems: BriefData[] = [];
    const dbg: { reason?: string } = {};
    try {
      briefItems = await extractItemData(entry, today, dbg);
    } catch (e) {
      log.push({ label: entry.title, status: "error", detail: errorMessage(e) });
      Sentry.captureException(e, { tags: { cron: "sync-ecdc-threats" } });
      results.errors++;
      continue;
    }

    if (briefItems.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: dbg.reason ?? "disease not in map or no country found" });
      results.skipped++;
      continue;
    }

    await loadExistingForItems(supabase, byDC, briefItems);

    for (const item of briefItems) {
      const label = `${item.disease_en}/${item.country_en}`;

      // Sanity guard
      if (item.date > today) {
        log.push({ label, status: "skip", detail: `future date: ${item.date}` });
        results.skipped++;
        continue;
      }

      const geo = findCountry(item.country_en);
      if (!geo || isAggregateCountry(geo)) {
        log.push({ label, status: "skip", detail: "country not in geo-data or aggregate pseudo-country" });
        results.skipped++;
        continue;
      }

      const dcKey      = `${item.disease_en.toLowerCase()}|${item.country_en.toLowerCase()}`;
      const existing   = byDC.get(dcKey);

      // Don't resurrect a retired row, nor insert a duplicate, when an active
      // sibling already covers this disease+country under different raw text
      // (see activeByNormalizedDC comment above). geo.name_en (already resolved
      // above) is the canonical country form, matching the normalized country
      // side of activeByNormalizedDC.
      const normDcKey = `${normalizeDisease(item.disease_en).name_en.toLowerCase()}|${geo.name_en.toLowerCase()}`;
      if (activeByNormalizedDC.has(normDcKey) && (!existing || !existing.active)) {
        log.push({ label, status: "skip", detail: "active sibling already covers this disease+country under different text" });
        results.skipped++;
        continue;
      }

      // Never overwrite WHO DON-owned rows
      if (existing?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
        log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
        results.skipped++;
        continue;
      }

      // Same multi-country event under a different umbrella label — defer to the
      // WHO DON row rather than re-opening it here (see UMBRELLA_COUNTRY_LABELS note).
      if (UMBRELLA_COUNTRY_LABELS.has(item.country_en.toLowerCase()) &&
          donOwnedUmbrellaDiseases.has(item.disease_en.toLowerCase())) {
        log.push({ label, status: "skip", detail: "multi-country event owned by WHO DON (umbrella match)" });
        results.skipped++;
        continue;
      }

      // Ambiguous attribution: this article named 2+ non-EU countries (see
      // nonEuCountries in extractItemData) and the extracted cases/deaths is
      // one combined figure with no structural anchor saying which country
      // it actually belongs to. Safe to UPDATE an existing row — the
      // ownership/spike/collapse guards already protect against a wildly
      // wrong number — but never silently INSERT a brand-new row on a guess.
      if (!existing && briefItems.length > 1) {
        log.push({ label, status: "skip", detail: `multi-country article (${briefItems.length} countries named) — no existing row, ambiguous attribution, refusing to guess-insert` });
        results.skipped++;
        continue;
      }

      // ── Plausibility guards ──────────────────────────────────────────────
      // "Worldwide overview" ECDC articles often have 0/0 because numbers are
      // in tables the regex can't parse. Skip rather than insert empty rows.
      if (item.cases === 0 && item.deaths === 0) {
        log.push({ label, status: "skip", detail: "0/0 — no parseable case numbers" });
        results.skipped++;
        continue;
      }
      const implausibleReason = implausibleDeathsGuard(item);
      if (implausibleReason) {
        log.push({ label, status: "skip", detail: implausibleReason });
        results.skipped++;
        continue;
      }

      const diseaseInfo = normalizeDisease(item.disease_en);
      const riskLevel   = assessRisk(item.disease_en, item.description, item.cases, item.deaths);

      if (existing) {
        const isNewer    = item.date > existing.date;
        const casesDiff  = item.cases  !== existing.cases;
        const deathsDiff = item.deaths !== existing.deaths;

        if (!isNewer && !casesDiff && !deathsDiff) {
          // Source fetched and an entry for this row parsed, carrying nothing
          // newer than the row's `date` — that is a verification, not merely
          // "nothing to write". Recorded so the row stops ageing towards the
          // "no update" badge while its source confirms it every run.
          sourceConfirmed.push(existing.id);
          log.push({ label, status: "skip", detail: "data unchanged — source confirmed" });
          results.skipped++;
          continue;
        }

        // Same guard family as sync-cdc-notices, shared via
        // lib/outbreak-guards.ts (2026-08-02). deathsNeverDecreaseGuard is the
        // ecdc-threats-specific one: a running death toll in an ongoing
        // outbreak never decreases, so any drop (not just a fall to zero) is
        // refused — stricter than the plain zero-death guard the other crons
        // use. A drop is almost always a parsing anomaly — e.g. grabbing a
        // daily increment instead of the running total (found 2026-07-15 on
        // ECDC's Ebola DRC page: 719 cumulative vs 10 same-day increment, see
        // extractNumbers' pairedPattern) — rather than a real downward
        // revision, which is rare enough to apply by hand instead of risking a
        // silent overwrite. No collapse or zero-case guard here — deliberately
        // absent before this migration, left that way.
        const guardReason =
          dateFloorGuard(item, existing) ??
          spikeGuard(item, existing) ??
          deathsNeverDecreaseGuard(item, existing) ??
          lockedRowRegressionGuard(item, existing);
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
          if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(existing)) lockedGuardBlocked.push(`${label}: ${guardReason}`);
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
          source_priority: Math.max(5, existing.source_priority ?? 0),
        };
        // English description just changed — existing FR/ES/AR/ID translations
        // (if any) now describe stale figures. Null them so sync-outbreaks'
        // backfill sweep re-translates from the fresh text (it only fires when
        // description_fr IS NULL — see project_sync_outbreaks_paho_translation_drift_fixed).
        if (existing.description !== item.description) {
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
          .eq("id", existing.id)
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
          active:       true,
          is_seed:      false,
          is_backfill:  false,
          source_priority: 5,
          admin1:       item.admin1 ?? null,
          admin1_lat:   item.admin1_lat ?? null,
          admin1_lng:   item.admin1_lng ?? null,
          first_seen_at: item.date,
        });

        if (error) {
          log.push({ label, status: "error", detail: error.message });
          results.errors++;
        } else {
          log.push({ label, status: "inserted", detail: `${item.cases} cases / ${item.deaths} deaths (${item.date})` });
          results.inserted++;
        }
      }

      // Small delay to avoid hammering ECDC and Supabase
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // One batched verification stamp for every row the source confirmed
  // unchanged. Never fatal: a failed stamp costs freshness metadata, not
  // data, so it is logged and the run still reports on its actual writes.
  const confirmed = await stampSourceConfirmed(supabase, sourceConfirmed);
  if (confirmed.error) console.error("[ecdc] source_confirmed_at stamp failed:", confirmed.error);

  console.log("[ecdc] Done:", results, log, `confirmed=${confirmed.stamped}`);
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[ecdc] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }
  // Was hardcoded "ok" regardless of results.errors — same bug as
  // sync-outbreaks (2026-07-29).
  await logCronRun(supabase, "sync-ecdc-threats", results.errors > 0 || lockedGuardBlocked.length > 0 ? "error" : "ok", results.inserted ?? 0,
    lockedGuardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
      : results.errors > 0 ? `${results.errors} écriture(s) en échec` : undefined);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined, ...results, log });
}
