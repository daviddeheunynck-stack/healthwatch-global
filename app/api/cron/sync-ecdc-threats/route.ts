// ECDC Epidemiological Update scraper — runs every Friday at 09:00 UTC.
// Reads the ECDC "Epidemiological update" RSS feed (taxonomy/term/1310), fetches
// each article page for case numbers and country mentions, and upserts to outbreaks.
// Replaces the old Threat Assessment Brief HTML scraper (that URL is now 404).
// Covers EU/EEA-specific threats (Ebola, MERS-CoV, Mpox, Hantavirus, etc.).
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

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

// Country names sorted longest-first to avoid "Congo" matching before "Democratic Republic of the Congo"
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

// Find countries mentioned in the text (returns canonical country keys from COUNTRIES)
function findMentionedCountries(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  const seen  = new Set<string>();

  // Check abbreviation aliases first
  for (const [abbr, canonical] of Object.entries(TEXT_ALIASES)) {
    if (lower.includes(abbr) && !seen.has(canonical)) {
      found.push(canonical);
      seen.add(canonical);
    }
  }

  for (const name of COUNTRY_NAMES) {
    const geo = COUNTRIES[name];
    if (!geo) continue;
    if (seen.has(name)) continue;
    if (lower.includes(name.toLowerCase())) {
      found.push(name);
      seen.add(name);
    }
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
    .replace(/\s*[-–—]\s*.+$/, "")
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
}

async function extractItemData(item: RSSItem): Promise<BriefData[]> {
  const titleCore = extractECDCDisease(item.title);
  if (!titleCore || !isKnownDisease(titleCore)) return [];
  const diseaseInfo = normalizeDisease(titleCore);

  // Fetch article page for full case numbers and country context
  let articleText = "";
  try {
    const res = await fetch(item.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (res.ok) articleText = htmlToText(await res.text());
  } catch (e) {
    console.warn("[ecdc] fetch article:", errorMessage(e));
  }

  // Combine RSS description + article intro for extraction
  const fullText = `${item.description} ${articleText}`.trim();
  const { cases, deaths } = extractNumbers(fullText.substring(0, 3000));

  // Country detection: scan description + article intro (first 800 chars of article)
  const searchText = `${item.description} ${articleText.substring(0, 800)}`;
  const countries  = findMentionedCountries(searchText);
  if (countries.length === 0) return [];

  // Take the first mentioned country only (avoid noise from "worldwide overview" items)
  const geo = findCountry(countries[0]);
  if (!geo) return [];

  return [{
    disease_en:  diseaseInfo.name_en,
    country_en:  geo.name_en,
    cases,
    deaths,
    source:      item.url,
    description: `ECDC — ${item.title}. ${item.description}`.substring(0, 600),
    date:        item.date,
  }];
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

  // ── 1. Fetch ECDC Epidemiological Update RSS feed ─────────────────────────
  let rssXml: string;
  try {
    const res = await fetch(ECDC_RSS_FEED, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[ecdc] RSS HTTP ${res.status}`);
      return NextResponse.json({ error: `ECDC RSS HTTP ${res.status}` }, { status: 502 });
    }
    rssXml = await res.text();
  } catch (e) {
    console.error("[ecdc] fetch RSS:", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const entries = parseRSSFeed(rssXml);
  console.log(`[ecdc] Found ${entries.length} recent item(s) within ${MAX_AGE_DAYS} days`);

  if (entries.length === 0) {
    return NextResponse.json({ success: true, briefs: 0, inserted: 0, updated: 0, skipped: 0 });
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
  const results = { briefs: entries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  for (const entry of entries) {
    let briefItems: BriefData[] = [];
    try {
      briefItems = await extractItemData(entry);
    } catch (e) {
      log.push({ label: entry.title, status: "error", detail: errorMessage(e) });
      results.errors++;
      continue;
    }

    if (briefItems.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: "disease not in map or no country found" });
      results.skipped++;
      continue;
    }

    for (const item of briefItems) {
      const label = `${item.disease_en}/${item.country_en}`;

      // Sanity guard
      if (item.date > today) {
        log.push({ label, status: "skip", detail: `future date: ${item.date}` });
        results.skipped++;
        continue;
      }

      const geo = findCountry(item.country_en);
      if (!geo) {
        log.push({ label, status: "skip", detail: "country not in geo-data" });
        results.skipped++;
        continue;
      }

      const dcKey      = `${item.disease_en.toLowerCase()}|${item.country_en.toLowerCase()}`;
      const existing   = byDC.get(dcKey);

      // Never overwrite WHO DON-owned rows
      if (existing?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
        log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
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
          log.push({ label, status: "skip", detail: "data unchanged" });
          results.skipped++;
          continue;
        }

        const { error } = await supabase
          .from("outbreaks")
          .update({
            cases:       item.cases,
            deaths:      item.deaths,
            date:        item.date,
            source:      item.source,
            description: item.description,
            risk_level:  riskLevel,
            active:      true,
          })
          .eq("id", existing.id);

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

  console.log("[ecdc] Done:", results, log);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
