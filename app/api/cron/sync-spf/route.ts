// Santé Publique France (SPF) sync — runs twice daily.
// Fetches the SPF news RSS feed, filters infectious disease alerts and
// epidemiological updates, and upserts to outbreaks.
// SPF publishes within hours of French national confirmation — the primary
// source for imported cases in France (Ebola, MERS-CoV, etc.) before WHO DON.
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 90;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const SPF_BASE      = "https://www.santepubliquefrance.fr";
// Try multiple known SPF RSS endpoint patterns
const SPF_RSS_URLS  = [
  "https://www.santepubliquefrance.fr/maladies-et-traumatismes/maladies-infectieuses-d-origine-alimentaire?format=xml",
  "https://www.santepubliquefrance.fr/les-actualites?format=xml",
  "https://www.santepubliquefrance.fr/recherche#search_query=maladie+infectieuse&first=0&sort=date&format=xml",
];
const SPF_NEWS_URL  = "https://www.santepubliquefrance.fr/les-actualites";
const MAX_AGE_DAYS  = 30;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/rss+xml,text/html,*/*",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

const COUNTRY_NAMES = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);

// French country name fragments → canonical English key
const FR_ALIASES: Record<string, string> = {
  " france ":              "France",
  "en france":             "France",
  "sur le territoire":     "France",
  " drc ":                 "Democratic Republic of the Congo",
  " rdc ":                 "Democratic Republic of the Congo",
  " congo démocratique":   "Democratic Republic of the Congo",
  " rd congo":             "Democratic Republic of the Congo",
  " maroc ":               "Morocco",
  " algérie ":             "Algeria",
  " tunisie ":             "Tunisia",
  " sénégal ":             "Senegal",
  " côte d'ivoire":        "Ivory Coast",
  " guinée ":              "Guinea",
  " cameroun ":            "Cameroon",
  " nigeria ":             "Nigeria",
  " ouganda ":             "Uganda",
  " kenya ":               "Kenya",
  " arabie saoudite":      "Saudi Arabia",
  " brésil ":              "Brazil",
  " mexique ":             "Mexico",
  " chine ":               "China",
  " inde ":                "India",
  " thaïlande ":           "Thailand",
  " indonésie ":           "Indonesia",
};

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

// Strip SPF title prefixes to extract core disease term
function extractSPFDisease(title: string): string {
  return title
    .replace(/^point\s+épidémiologique\s+n°?\s*\d*\s*[-–—]\s*/i, "")
    .replace(/^point\s+épidémiologique\s+[-–—]?\s*/i, "")
    .replace(/^point\s+épidémio\s+[-–—]?\s*/i, "")
    .replace(/^alerte\s+[-–—]?\s*/i, "")
    .replace(/^avis\s+[-–—]?\s*/i, "")
    .replace(/^bulletin\s+épidémiologique\s+[-–—]?\s*/i, "")
    .replace(/^maladie\s+à\s+virus\s+/i, "")
    .replace(/\s*[-–—]\s*(?:situation|point|bilan|mise\s+à\s+jour|actualités?|france?).+$/i, "")
    .replace(/\s*[-–—]\s*\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre).+$/i, "")
    .replace(/\s+(?:au|en|aux|à|dans\s+le?s?)\s+.+$/i, "")
    .replace(/\s+(?:en|de)\s+france.+$/i, "")
    .replace(/\s*[-–—]\s*.+$/, "")
    .replace(/\s*n°?\s*\d+\s*$/, "")
    .trim();
}

function findMentionedCountries(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  const seen  = new Set<string>();

  // French aliases first
  for (const [fr, canonical] of Object.entries(FR_ALIASES)) {
    if (lower.includes(fr) && !seen.has(canonical)) {
      found.push(canonical);
      seen.add(canonical);
    }
  }
  // Then English country names (appear in scientific content)
  for (const name of COUNTRY_NAMES) {
    if (seen.has(name)) continue;
    if (lower.includes(` ${name.toLowerCase()} `) || lower.includes(` ${name.toLowerCase()},`)) {
      found.push(name);
      seen.add(name);
    }
  }
  return found;
}

// ── RSS parser ────────────────────────────────────────────────────────────────

interface RSSItem {
  url:   string;
  title: string;
  date:  string;
  description: string;
}

function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const raw = m[1];

    const title = raw.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    if (!title) continue;

    const link =
      raw.match(/<link>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim() ??
      raw.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim();
    if (!link) continue;

    const pubDate = raw.match(/<pubDate>([^<]+)/i)?.[1]?.trim();
    if (!pubDate) continue;
    const d = new Date(pubDate);
    if (isNaN(d.getTime()) || d < cutoff) continue;

    const descRaw = raw.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
    const description = htmlToText(
      descRaw.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "")
    );

    items.push({ url: link, title, date: d.toISOString().substring(0, 10), description });
  }
  return items;
}

// Extract article links + dates directly from SPF HTML when RSS is unavailable
function parseHTMLItems(html: string): RSSItem[] {
  const items: RSSItem[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // SPF article cards: <a href="/..." class="...">Title</a> near a date
  for (const m of html.matchAll(/<a[^>]+href="(\/[^"]+)"[^>]*>\s*([^<]{15,})\s*<\/a>/gi)) {
    const href  = m[1];
    const title = m[2].trim();
    if (title.length < 15 || title.length > 200) continue;

    // Find nearest date string (dd mois aaaa format)
    const dateMatch = html.slice(
      Math.max(0, html.indexOf(m[0]) - 200),
      html.indexOf(m[0]) + 400
    ).match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);

    if (!dateMatch) continue;
    const monthMap: Record<string, string> = {
      janvier:"01", février:"02", mars:"03", avril:"04", mai:"05", juin:"06",
      juillet:"07", août:"08", septembre:"09", octobre:"10", novembre:"11", décembre:"12",
    };
    const d = new Date(`${dateMatch[3]}-${monthMap[dateMatch[2].toLowerCase()]}-${dateMatch[1].padStart(2,"0")}`);
    if (isNaN(d.getTime()) || d < cutoff) continue;

    items.push({ url: SPF_BASE + href, title, date: d.toISOString().substring(0, 10), description: "" });
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

  // ── 1. Fetch SPF feed (try RSS, fall back to HTML) ────────────────────────
  let items: RSSItem[] = [];
  let feedSource = "none";

  for (const rssUrl of SPF_RSS_URLS) {
    try {
      const res = await fetch(rssUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes("<item>") && !text.includes("<entry>")) continue;
      items = parseRSSFeed(text);
      feedSource = rssUrl;
      break;
    } catch {
      continue;
    }
  }

  if (items.length === 0) {
    try {
      const res = await fetch(SPF_NEWS_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      if (res.ok) {
        items = parseHTMLItems(await res.text());
        feedSource = "html:" + SPF_NEWS_URL;
      }
    } catch (e) {
      console.error("[spf] HTML fallback failed:", errorMessage(e));
      Sentry.captureException(e, { tags: { cron: "sync-spf" } });
      return NextResponse.json({ error: "SPF unreachable" }, { status: 502 });
    }
  }

  console.log(`[spf] ${items.length} items via ${feedSource}`);
  if (items.length === 0) {
    return NextResponse.json({ success: true, items: 0, inserted: 0, updated: 0, skipped: 0 });
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

  // ── 3. Process items ──────────────────────────────────────────────────────
  const results = { items: items.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type Log = { label: string; status: string; detail?: string };
  const log: Log[] = [];

  for (const item of items) {
    const rawDisease = extractSPFDisease(item.title);
    if (!isKnownDisease(rawDisease)) {
      log.push({ label: item.title, status: "skip", detail: `unknown: ${rawDisease}` });
      results.skipped++;
      continue;
    }

    // Fetch article for full text
    let pageText = `${item.title} ${item.description}`;
    try {
      const res = await fetch(item.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      if (res.ok) pageText = `${item.title} ${item.description} ${htmlToText(await res.text())}`;
    } catch (e) {
      console.warn("[spf] fetch page:", errorMessage(e));
    }

    const searchText = pageText.substring(0, 3000);
    const countries  = findMentionedCountries(searchText);
    if (countries.length === 0) {
      log.push({ label: item.title, status: "skip", detail: "no country" });
      results.skipped++;
      continue;
    }

    const geo = findCountry(countries[0]);
    if (!geo) {
      log.push({ label: item.title, status: "skip", detail: `geo miss: ${countries[0]}` });
      results.skipped++;
      continue;
    }

    // SPF guard: France entries require explicit French case language.
    // SPF publishes awareness bulletins for foreign outbreaks (e.g. Ebola DRC)
    // that mention France in an advisory context — these must NOT create France rows.
    if (geo.name_en === "France") {
      const hasFrenchCase =
        /(?:cas|patient|voyageur|contact)\s+(?:confirmé|identifi[eé]|import[eé]|signalé|hospitalisé)\s+(?:en\s+france|sur\s+le\s+territoire)/i.test(searchText) ||
        /france\s+(?:a\s+)?(?:confirm[eé]|signal[eé]|notifi[eé])\s+(?:\d+|un[e]?\s+(?:cas|patient))/i.test(searchText) ||
        /cas\s+(?:autochtone|import[eé])\s+(?:en\s+france|sur\s+le\s+territoire)/i.test(searchText);
      if (!hasFrenchCase) {
        log.push({ label: item.title, status: "skip", detail: "France not primary event country" });
        results.skipped++;
        continue;
      }
    }

    if (item.date > today) { results.skipped++; continue; }
    if (bySource.has(item.url)) {
      log.push({ label: item.title, status: "skip", detail: "URL in DB" });
      results.skipped++;
      continue;
    }

    const diseaseInfo = normalizeDisease(rawDisease);
    const { cases, deaths } = extractNumbers(searchText);
    const riskLevel   = assessRisk(diseaseInfo.name_en, searchText, cases, deaths);
    const description = `SPF — ${item.title}. ${item.description}`.substring(0, 600);
    const label       = `${diseaseInfo.name_en}/${geo.name_en}`;

    const dcKey      = `${diseaseInfo.name_en.toLowerCase()}|${geo.name_en.toLowerCase()}`;
    const existingRow = byDC.get(dcKey);

    if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label, status: "skip", detail: "owned by WHO DON" });
      results.skipped++;
      continue;
    }

    if (existingRow) {
      if (item.date <= existingRow.date && cases === existingRow.cases) {
        log.push({ label, status: "skip", detail: "unchanged" });
        results.skipped++;
        continue;
      }
      const { error } = await supabase.from("outbreaks").update({
        cases, deaths, date: item.date, source: item.url,
        description, risk_level: riskLevel, active: true, source_priority: 5,
      }).eq("id", existingRow.id).lte("source_priority", 5);
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else { log.push({ label, status: "updated" }); results.updated++; }
    } else {
      const { error } = await supabase.from("outbreaks").insert({
        disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
        country: geo.name_fr, country_en: geo.name_en, country_ar: geo.name_ar,
        region: geo.region, lat: geo.lat, lng: geo.lng,
        cases, deaths, risk_level: riskLevel, date: item.date,
        source: item.url, description, active: true, is_seed: false,
        admin1: null, admin1_lat: null, admin1_lng: null,
      });
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else { log.push({ label, status: "inserted", detail: `${cases}/${deaths} (${item.date})` }); results.inserted++; }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("[spf] Done:", results, log);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
