// Africa CDC News scraper — runs Wed + Sat at 09:00 UTC.
// Fetches recent news posts from africacdc.org/news-item/ (previously /disease-outbreak-news/),
// extracts disease / country / cases, and upserts to outbreaks. Covers sub-Saharan
// African outbreaks (Guinea, Sierra Leone, Burkina Faso, etc.) that may not
// appear in WHO DON or ReliefWeb until later in the outbreak timeline.
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry } from "@/lib/geo-data";
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

// African country names sorted longest-first
const AFRICA_COUNTRIES = Object.entries(COUNTRIES)
  .filter(([, geo]) => geo.region === "africa")
  .map(([key]) => key)
  .sort((a, b) => b.length - a.length);

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

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

// Abbreviations in Africa CDC RSS text → canonical country key
const AFRICA_TEXT_ALIASES: Record<string, string> = {
  " drc ":    "Democratic Republic of the Congo",
  "(drc)":    "Democratic Republic of the Congo",
  " rdc ":    "Democratic Republic of the Congo",
  " dr congo": "Democratic Republic of the Congo",
};

function findMentionedAfricanCountries(text: string): string[] {
  const lower  = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  const seen   = new Set<string>();

  // Abbreviation aliases first
  for (const [abbr, canonical] of Object.entries(AFRICA_TEXT_ALIASES)) {
    if (lower.includes(abbr) && !seen.has(canonical)) {
      found.push(canonical);
      seen.add(COUNTRIES[canonical]?.name_en ?? canonical);
    }
  }

  for (const name of AFRICA_COUNTRIES) {
    const geo = COUNTRIES[name];
    if (!geo) continue;
    if (seen.has(geo.name_en)) continue;
    if (lower.includes(name.toLowerCase())) {
      found.push(name);
      seen.add(geo.name_en);
    }
  }
  return found;
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

    items.push({ url: link, title, date: d.toISOString().substring(0, 10), description });
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
  const diseaseRaw = extractDiseaseFromTitle(item.title);
  // If the title couldn't be cleaned to a short disease name (> 40 chars remain),
  // it's likely an institutional/funding article rather than an outbreak report.
  if (!diseaseRaw || diseaseRaw.length > 40 || !isKnownDisease(diseaseRaw)) return [];
  const diseaseInfo = normalizeDisease(diseaseRaw);

  // Country detection — RSS description has compact text with key country mentions.
  // e.g. "...Ebola outbreak...in the Democratic Republic of the Congo and Uganda..."
  const descCountries = findMentionedAfricanCountries(item.description);
  let primaryCountry: string | null = descCountries.length > 0 ? descCountries[0] : null;

  // Fetch article page: needed for case/death numbers and country fallback.
  let articleText = "";
  try {
    const res = await fetch(item.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (res.ok) articleText = htmlToText(await res.text());
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
  if (!geo) return [];

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
      return NextResponse.json({ error: `Africa CDC RSS HTTP ${res.status}` }, { status: 502 });
    }
    rssXml = await res.text();
  } catch (e) {
    console.error("[africa-cdc] fetch RSS:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-africa-cdc" } });
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const items = parseRSSFeed(rssXml);
  console.log(`[africa-cdc] Found ${items.length} recent item(s) within ${MAX_AGE_DAYS} days`);

  if (items.length === 0) {
    return NextResponse.json({ success: true, items: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing outbreaks for dedup ──────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  type Row = NonNullable<typeof existing>[number];
  const byDC = new Map<string, Row>();
  for (const row of existing ?? []) {
    const k    = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

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
      if (!geo) {
        log.push({ label, status: "skip", detail: "country not in geo-data" });
        results.skipped++;
        continue;
      }

      const dcKey   = `${item.disease_en.toLowerCase()}|${item.country_en.toLowerCase()}`;
      const existRow = byDC.get(dcKey);

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

        const { error } = await supabase
          .from("outbreaks")
          .update({
            cases:           item.cases,
            deaths:          item.deaths,
            date:            item.date,
            source:          item.source,
            description:     item.description,
            risk_level:      riskLevel,
            active:          true,
            source_priority: 5,
          })
          .eq("id", existRow.id)
          .lte("source_priority", 5);

        if (error) {
          log.push({ label, status: "error", detail: error.message });
          results.errors++;
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
