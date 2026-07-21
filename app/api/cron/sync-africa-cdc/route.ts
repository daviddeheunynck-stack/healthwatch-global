// Africa CDC News scraper — runs Wed + Sat at 09:00 UTC.
// Fetches recent news posts from africacdc.org/news-item/ (previously /disease-outbreak-news/),
// extracts disease / country / cases, and upserts to outbreaks. Covers sub-Saharan
// African outbreaks (Guinea, Sierra Leone, Burkina Faso, etc.) that may not
// appear in WHO DON or ReliefWeb until later in the outbreak timeline.
// Never overwrites rows owned by the WHO DON daily sync.

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

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const AFRICA_CDC_RSS = "https://africacdc.org/news-item/feed/";
const MAX_AGE_DAYS   = 45;

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
function extractAfricaCdcBody(html: string): string {
  const idx = html.indexOf("elementor-widget-theme-post-content");
  // If Africa CDC changes their template, this selector stops matching — returning
  // the full page (nav/mega-menu/related-posts chrome) instead of "" would feed
  // page chrome into extractNumbers/findMentionedAfricanCountries (wrong case
  // counts, wrong country) rather than the empty-string 0/0 those functions
  // already handle as a visible skip. Found 2026-07-16.
  if (idx < 0) {
    console.warn("[africa-cdc] body selector no longer matches — skipping article");
    return "";
  }
  const tagEnd = html.indexOf(">", idx) + 1;
  return html.slice(tagEnd, tagEnd + 8000);
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

async function extractItemData(item: RSSItem): Promise<PostData[]> {
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
  const descCountries = findMentionedAfricanCountries(item.description);
  let primaryCountry: string | null = descCountries.length > 0 ? descCountries[0] : null;

  // Fetch article page: needed for case/death numbers and country fallback.
  let articleText = "";
  try {
    const res = await fetch(item.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (res.ok) articleText = htmlToText(extractAfricaCdcBody(await res.text()));
  } catch (e) {
    console.warn("[africa-cdc] fetch post:", errorMessage(e));
  }

  // Fallback country detection from article body (first 1500 chars)
  if (!primaryCountry && articleText) {
    const bodyMentions = findMentionedAfricanCountries(articleText.substring(0, 1500));
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
    description: `Africa CDC — ${item.title}. ${item.description}`.substring(0, 600),
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
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description")
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
  const today    = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch Africa CDC RSS feed ─────────────────────────────────────────
  let rssXml: string;
  try {
    const res = await fetch(AFRICA_CDC_RSS, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[africa-cdc] RSS HTTP ${res.status}`);
      await logCronRun(supabase, "sync-africa-cdc", "error", 0, `Africa CDC RSS HTTP ${res.status}`);
      return NextResponse.json({ error: `Africa CDC RSS HTTP ${res.status}` }, { status: 502 });
    }
    rssXml = await res.text();
  } catch (e) {
    console.error("[africa-cdc] fetch RSS:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-africa-cdc" } });
    await logCronRun(supabase, "sync-africa-cdc", "error", 0, errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
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
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) {
    await logCronRun(supabase, "sync-africa-cdc", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const byDC = new Map<string, ExistingRow>();
  for (const row of (existing ?? []) as ExistingRow[]) indexRow(byDC, row);

  // ── 3. Process each RSS item ──────────────────────────────────────────────
  const results = { items: items.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  for (const item of items) {
    let extracted: PostData[] = [];
    try {
      extracted = await extractItemData(item);
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
          log.push({ label, status: "skip", detail: "data unchanged" });
          results.skipped++;
          continue;
        }

        // An older-dated item with different numbers was not skipped above (only
        // the "unchanged" case was) — a stale re-fetch could still overwrite a
        // more recent row. Same guard family as sync-cdc-notices.
        if (item.date < existRow.date) {
          log.push({ label, status: "skip", detail: `older item (${item.date}) than existing (${existRow.date})` });
          results.skipped++;
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
          source_priority: 5,
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
          .lte("source_priority", 5)
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

  console.log("[africa-cdc] Done:", results, log);
  await logCronRun(supabase, "sync-africa-cdc", "ok", results.inserted ?? 0);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
