// WHO AFRO (Africa Regional Office) outbreak sync — runs Mon/Wed/Fri.
// Scrapes the WHO AFRO outbreak updates page, extracts disease/country/date
// from alert titles, fetches individual pages for case counts, and upserts.
// WHO AFRO publishes 1–3 days faster than WHO DON HQ for African outbreaks
// (Ebola DRC, Mpox, Cholera, Marburg, Lassa, CCHF, etc.).
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
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

const AFRO_BASE      = "https://www.afro.who.int";
const AFRO_LIST_URL  = "https://www.afro.who.int/health-topics/disease-outbreaks/outbreaks-and-other-emergencies-updates";
const AFRO_RSS_URL   = "https://www.afro.who.int/rss.xml";
const MAX_AGE_DAYS   = 45;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/rss+xml,text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const COUNTRY_NAMES = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);


// ── Helpers ───────────────────────────────────────────────────────────────────

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}

// afro.who.int's Drupal "field--name-body" class is reused across many
// widgets on the same page (donation banner, language switcher, search box —
// confirmed 8 occurrences on one real article) before the real article body,
// which is always the LAST occurrence — verified on 2 different articles.
// Using the first occurrence (as a naive scope would) lands on unrelated
// widget markup; using the last one also sidesteps the country-breadcrumb
// risk ("WHO Africa Countries Kenya"), since the breadcrumb sits earlier on
// the page, before all the widget instances of this class.
function extractAFROBody(html: string): string {
  const idx = html.lastIndexOf('class="field field--name-body');
  if (idx < 0) return html;
  const tagEnd = html.indexOf(">", idx) + 1;
  return html.slice(tagEnd, tagEnd + 8000);
}

// Parse "Outbreak update – Disease in Country, date" or "Disease in Country"
function parseAFROTitle(raw: string): { disease: string; country: string } | null {
  const title = raw
    .replace(/^(?:Outbreak|Disease\s+Outbreak)\s+(?:update|news)\s*[-–—]\s*/i, "")
    .replace(/^Weekly\s+(?:outbreak\s+)?(?:update|briefing)\s*[-–—]\s*/i, "")
    .replace(/^(?:WHO\s+)?(?:AFRO?\s+)?(?:Outbreak|Emergency)\s+(?:Alert|Update|Bulletin)\s*[-–—]\s*/i, "")
    .replace(/,?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\s*$/i, "")
    .trim();

  // "Disease in the Country" → split on " in "
  const inMatch = title.match(/^(.+?)\s+in\s+(?:the\s+)?(.+?)(?:\s*[-–—].*)?$/i);
  if (inMatch) {
    return { disease: inMatch[1].trim(), country: inMatch[2].trim() };
  }
  // "Disease — Country" fallback
  const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch && COUNTRY_NAMES.some(n => dashMatch[2].toLowerCase().includes(n.toLowerCase()))) {
    return { disease: dashMatch[1].trim(), country: dashMatch[2].trim() };
  }
  return null;
}

function findMentionedCountries(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  const seen  = new Set<string>();

  const aliases: Record<string, string> = {
    " drc ":     "Democratic Republic of the Congo",
    "(drc)":     "Democratic Republic of the Congo",
    " rdc ":     "Democratic Republic of the Congo",
    " dr congo": "Democratic Republic of the Congo",
  };
  for (const [abbr, canonical] of Object.entries(aliases)) {
    if (lower.includes(abbr) && !seen.has(canonical)) {
      found.push(canonical); seen.add(canonical);
    }
  }
  for (const name of COUNTRY_NAMES) {
    if (seen.has(name)) continue;
    if (lower.includes(` ${name.toLowerCase()} `) || lower.includes(` ${name.toLowerCase()},`)) {
      found.push(name); seen.add(name);
    }
  }
  return found;
}

// ── Link extraction ───────────────────────────────────────────────────────────

interface PageEntry { url: string; title: string; dateHint?: string }

function extractOutbreakLinks(html: string): PageEntry[] {
  const entries: PageEntry[] = [];
  const seen = new Set<string>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // Extract all <a> tags whose text looks like an outbreak title
  for (const m of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>\s*([\s\S]{15,250}?)\s*<\/a>/gi)) {
    const href  = m[1].trim();
    const text  = htmlToText(m[2]).trim();
    if (text.length < 15 || seen.has(href)) continue;

    const lower = text.toLowerCase();
    const isRelevant =
      lower.includes("outbreak") ||
      lower.includes("disease") ||
      lower.includes("emergency") ||
      lower.includes("ebola") ||
      lower.includes("marburg") ||
      lower.includes("cholera") ||
      lower.includes("mpox") ||
      lower.includes("plague") ||
      lower.includes("yellow fever") ||
      lower.includes("lassa") ||
      lower.includes("dengue") ||
      lower.includes("meningitis") ||
      lower.includes("polio");

    if (!isRelevant) continue;

    // Reject nav links, footers, generic headings
    if (
      lower === "read more" ||
      lower === "more" ||
      lower.startsWith("home") ||
      lower.startsWith("contact") ||
      lower.length > 250
    ) continue;

    // Try to find date near this link in the raw HTML
    const linkPos = html.indexOf(m[0]);
    const nearby  = html.slice(Math.max(0, linkPos - 300), linkPos + 300);
    const dateM   = nearby.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    const dateHint = dateM ? `${dateM[3]}-${String(["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(dateM[2].toLowerCase())+1).padStart(2,"0")}-${dateM[1].padStart(2,"0")}` : undefined;

    if (dateHint) {
      const d = new Date(dateHint);
      if (d < cutoff) continue;
    }

    const url = href.startsWith("http") ? href : AFRO_BASE + (href.startsWith("/") ? href : "/" + href);
    if (!url.includes("afro.who.int")) continue;

    seen.add(href);
    entries.push({ url, title: text, dateHint });
  }
  return entries;
}

// ── RSS parser (fallback) ─────────────────────────────────────────────────────

function parseRSSFeed(xml: string, cutoff: Date): PageEntry[] {
  const items: PageEntry[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const raw = m[1];
    const title = raw.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    if (!title) continue;
    const link = raw.match(/<link>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim();
    if (!link) continue;
    const pub = raw.match(/<pubDate>([^<]+)/i)?.[1]?.trim();
    if (!pub) continue;
    const d = new Date(pub);
    if (isNaN(d.getTime()) || d < cutoff) continue;
    items.push({ url: link, title, dateHint: d.toISOString().substring(0, 10) });
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
  const cutoff   = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // ── 1. Fetch AFRO list page (try RSS, then HTML) ──────────────────────────
  let pageEntries: PageEntry[] = [];

  try {
    const rssRes = await fetch(AFRO_RSS_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (rssRes.ok) {
      const text = await rssRes.text();
      if (text.includes("<item>")) {
        pageEntries = parseRSSFeed(text, cutoff);
      }
    }
  } catch { /* fall through to HTML */ }

  if (pageEntries.length === 0) {
    try {
      const res = await fetch(AFRO_LIST_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return NextResponse.json({ error: `AFRO HTTP ${res.status}` }, { status: 502 });
      pageEntries = extractOutbreakLinks(await res.text());
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: "sync-who-afro" } });
      return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
    }
  }

  console.log(`[who-afro] ${pageEntries.length} candidate articles`);
  if (pageEntries.length === 0) {
    return NextResponse.json({ success: true, articles: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing for dedup ────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  type Row = NonNullable<typeof existing>[number];
  const bySource = new Map<string, Row>();
  const byDC     = new Map<string, Row>();
  for (const row of existing ?? []) {
    if (row.source) bySource.set(row.source, row);
    const k    = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

  // ── 3. Process each article ───────────────────────────────────────────────
  const results = { articles: pageEntries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type Log = { label: string; status: string; detail?: string };
  const log: Log[] = [];

  for (const entry of pageEntries) {
    if (bySource.has(entry.url)) {
      log.push({ label: entry.url, status: "skip", detail: "URL in DB" });
      results.skipped++;
      continue;
    }

    // Try to extract disease/country from title first (fast path)
    const parsed = parseAFROTitle(entry.title);

    // Fetch full article for case numbers and to confirm disease/country
    let pageText = entry.title;
    try {
      const res = await fetch(entry.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      if (res.ok) pageText = `${entry.title} ${htmlToText(extractAFROBody(await res.text()))}`;
    } catch (e) {
      console.warn("[who-afro] fetch:", errorMessage(e));
    }

    const rawDisease = parsed?.disease ?? entry.title;
    if (!isKnownDisease(rawDisease)) {
      log.push({ label: entry.title, status: "skip", detail: `unknown: ${rawDisease}` });
      results.skipped++;
      continue;
    }

    const countries = findMentionedCountries(
      (parsed?.country ? parsed.country + " " : "") + pageText.substring(0, 2000)
    );
    if (countries.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: "no country" });
      results.skipped++;
      continue;
    }

    const geo = findCountry(countries[0]);
    if (!geo) {
      log.push({ label: entry.title, status: "skip", detail: `geo miss: ${countries[0]}` });
      results.skipped++;
      continue;
    }

    // Resolve date: use hint or extract from text
    let date = entry.dateHint ?? today;
    if (!entry.dateHint) {
      const dm = pageText.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
      if (dm) {
        const mi = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(dm[2].toLowerCase()) + 1;
        date = `${dm[3]}-${String(mi).padStart(2,"0")}-${dm[1].padStart(2,"0")}`;
      }
    }
    if (date > today) { results.skipped++; continue; }

    const diseaseInfo  = normalizeDisease(rawDisease);
    const { cases, deaths } = extractNumbers(pageText.substring(0, 3000));
    const riskLevel    = assessRisk(diseaseInfo.name_en, pageText, cases, deaths);
    const description  = `WHO AFRO — ${entry.title}`.substring(0, 600);
    const label        = `${diseaseInfo.name_en}/${geo.name_en}`;
    const dcKey        = `${diseaseInfo.name_en.toLowerCase()}|${geo.name_en.toLowerCase()}`;
    const existingRow  = byDC.get(dcKey);

    if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label, status: "skip", detail: "owned by WHO DON" });
      results.skipped++;
      continue;
    }

    if (existingRow) {
      if (date <= existingRow.date && cases === existingRow.cases) {
        log.push({ label, status: "skip", detail: "unchanged" });
        results.skipped++;
        continue;
      }
      const { error } = await supabase.from("outbreaks").update({
        cases, deaths, date, source: entry.url,
        description, risk_level: riskLevel, active: true, source_priority: 5,
      }).eq("id", existingRow.id)
        .lte("source_priority", 5); // never overwrite sitrep (priority 10)
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else { log.push({ label, status: "updated" }); results.updated++; }
    } else {
      const { error } = await supabase.from("outbreaks").insert({
        disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
        country: geo.name_fr, country_en: geo.name_en, country_ar: geo.name_ar,
        region: geo.region, lat: geo.lat, lng: geo.lng,
        cases, deaths, risk_level: riskLevel, date,
        source: entry.url, description, active: true, is_seed: false,
        admin1: null, admin1_lat: null, admin1_lng: null,
      });
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else { log.push({ label, status: "inserted", detail: `${cases}/${deaths} (${date})` }); results.inserted++; }
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("[who-afro] Done:", results, log);
  await logCronRun(supabase, "sync-who-afro", "ok", (results.inserted ?? 0) + (results.updated ?? 0));
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
