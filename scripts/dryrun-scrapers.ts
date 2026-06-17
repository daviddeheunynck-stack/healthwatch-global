/**
 * End-to-end dry-run of the three new scrapers: ECDC, PAHO, Africa CDC.
 * Shows what would be inserted into the outbreaks table — no DB writes.
 * Run: npx tsx scripts/dryrun-scrapers.ts
 */

import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry } from "@/lib/geo-data";
import { extractNumbers } from "@/lib/outbreak-parser";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/rss+xml,text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const MAX_AGE_DAYS  = 45;
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

// Sorted longest-first to avoid prefix collisions
const ALL_COUNTRIES  = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);
const AFRICA_CTRIES  = ALL_COUNTRIES.filter(k => COUNTRIES[k]?.region === "africa");
const AMERICAS_CTRIES = ALL_COUNTRIES.filter(k => COUNTRIES[k]?.region === "americas");

function findCountries(text: string, list = ALL_COUNTRIES): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const seen  = new Set<string>();
  for (const name of list) {
    if (seen.has(name)) continue;
    if (lower.includes(name.toLowerCase())) { found.push(name); seen.add(name); }
  }
  return found;
}

function parsePAHODate(text: string): string | null {
  const MONTHS: Record<string, string> = {
    jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
    jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  };
  const v = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+(\d{4})\b/i);
  if (v) {
    const mon = MONTHS[v[2].toLowerCase().slice(0,3)];
    return mon ? `${v[3]}-${mon}-${v[1].padStart(2,"0")}` : null;
  }
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

interface Result {
  source: string;
  disease_en: string;
  country_en: string;
  cases: number;
  deaths: number;
  date: string;
  url: string;
}

// ── ECDC RSS ──────────────────────────────────────────────────────────────────

async function runECDC(): Promise<Result[]> {
  const res = await fetch("https://www.ecdc.europa.eu/en/taxonomy/term/1310/feed", { headers: HEADERS });
  const xml  = await res.text();
  const results: Result[] = [];

  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const raw   = m[1];
    const title = raw.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    if (!title) continue;
    const link  = raw.match(/<link>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim() ??
                  raw.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim();
    if (!link) continue;
    const pubDateStr = raw.match(/<pubDate>([^<]+)/i)?.[1]?.trim();
    if (!pubDateStr) continue;
    const d = new Date(pubDateStr);
    if (isNaN(d.getTime()) || d < cutoff) continue;
    const date = d.toISOString().slice(0, 10);

    const descRaw = raw.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
    const desc    = descRaw.replace(/<!\[CDATA\[/gi,"").replace(/\]\]>/gi,"")
                           .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();

    // Disease extraction
    const titleCore = title
      .replace(/^epidemiological\s+update\s*:\s*/i,"")
      .replace(/^(?:rapid\s+risk\s+assessment|threat\s+assessment\s+brief)\s*:\s*/i,"")
      .replace(/\s+worldwide\s+overview\b.*/i,"")
      .replace(/\s+situation\s+update\b.*/i,"")
      .replace(/\s+outbreak\b.*/i,"")
      .replace(/\s+in\s+.+$/i,"")
      .replace(/\s*[-–—]\s*.+$/,"")
      .trim();

    if (!isKnownDisease(titleCore)) {
      console.log(`  [ECDC skip] ${title.slice(0,60)} → disease not in map`);
      continue;
    }

    // Fetch article for numbers + countries
    let articleText = "";
    try {
      const ar = await fetch(link, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
      if (ar.ok) articleText = htmlToText(await ar.text());
    } catch { /* ignore */ }

    const fullText   = `${desc} ${articleText}`.slice(0, 3000);
    const { cases, deaths } = extractNumbers(fullText);
    const countries  = findCountries(`${desc} ${articleText.slice(0, 800)}`);
    if (countries.length === 0) {
      console.log(`  [ECDC skip] ${title.slice(0,60)} → no country found`);
      continue;
    }
    const geo = findCountry(countries[0]);
    if (!geo) continue;
    const disease = normalizeDisease(titleCore);

    results.push({ source:"ECDC", disease_en:disease.name_en, country_en:geo.name_en, cases, deaths, date, url:link });
  }

  return results;
}

// ── PAHO ──────────────────────────────────────────────────────────────────────

async function runPAHO(): Promise<Result[]> {
  const res  = await fetch("https://www.paho.org/en/epidemiological-alerts-and-updates", { headers: HEADERS });
  const html = await res.text();
  const results: Result[] = [];
  const seen  = new Set<string>();

  const linkRe = /<a\s[^>]*href="(\/en\/[^"]*(?:epidemiological-alert|epidemiological-update|epi-alert|epi-update)[^"]*)"[^>]*>([^<]+)<\/a>/gi;

  for (const m of html.matchAll(linkRe)) {
    const relPath = m[1];
    const title   = m[2].trim();
    if (seen.has(relPath) || !title || title.length < 10) continue;
    seen.add(relPath);

    const window  = html.slice(Math.max(0, m.index - 400), m.index + 400);
    const dateStr = parsePAHODate(window);
    if (!dateStr || new Date(dateStr) < cutoff) continue;

    const titleCore = title
      .replace(/^epidemiological\s+(?:alert|update)\s*:?\s*/i,"")
      .replace(/\s*-\s*\d+.*$/,"")
      .replace(/\s+in\s+the\s+Region.*/i,"")
      .replace(/\s+in\s+.+$/i,"")
      .trim();

    if (!isKnownDisease(titleCore)) {
      console.log(`  [PAHO skip] ${title.slice(0,60)} → disease not in map`);
      continue;
    }

    const url = `https://www.paho.org${relPath}`;
    let bodyText = "";
    try {
      const ar = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
      if (ar.ok) bodyText = htmlToText(await ar.text());
    } catch { /* ignore */ }

    const { cases, deaths } = extractNumbers(bodyText.slice(0, 3000));
    const countries = findCountries(`${title} ${bodyText.slice(0, 2500)}`, AMERICAS_CTRIES);
    if (countries.length === 0) {
      console.log(`  [PAHO skip] ${title.slice(0,60)} → no Americas country found`);
      continue;
    }
    const geo     = findCountry(countries[0]);
    if (!geo) continue;
    const disease = normalizeDisease(titleCore);

    results.push({ source:"PAHO", disease_en:disease.name_en, country_en:geo.name_en, cases, deaths, date:dateStr, url });
  }

  return results;
}

// ── Africa CDC ────────────────────────────────────────────────────────────────

async function runAfricaCDC(): Promise<Result[]> {
  const res = await fetch("https://africacdc.org/news-item/feed/", {
    headers: { ...HEADERS, Accept: "application/rss+xml,*/*" },
  });
  const xml     = await res.text();
  const results: Result[] = [];

  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const raw = m[1];
    const title = raw.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    if (!title) continue;
    const link = raw.match(/<link>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim() ??
                 raw.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim();
    if (!link) continue;
    const pubDate = raw.match(/<pubDate>([^<]+)/i)?.[1]?.trim();
    if (!pubDate) continue;
    const d = new Date(pubDate);
    if (isNaN(d.getTime()) || d < cutoff) continue;
    const date = d.toISOString().slice(0, 10);

    const descRaw = raw.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
    const desc = descRaw.replace(/<!\[CDATA\[/gi,"").replace(/\]\]>/gi,"")
      .replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();

    // Disease from title
    const diseaseRaw = title
      .replace(/^\d{4}\s+/, "")
      .replace(/:.*$/, "")
      .replace(/\s+without\b.*/i, "")
      .replace(/\s*[-–—|]\s*(update|situation|report)\s*#?\d*.*/i,"")
      .replace(/\s+outbreak\b.*/i,"")
      .replace(/\s+in\s+.+$/i,"")
      .replace(/\s*[-–—]\s*.+$/,"")
      .trim();

    if (!diseaseRaw || diseaseRaw.length > 40 || !isKnownDisease(diseaseRaw)) {
      console.log(`  [Africa CDC skip] ${title.slice(0,60)} → disease not in map`);
      continue;
    }

    // Country: scan RSS description first, then article body
    let countries = findCountries(desc, AFRICA_CTRIES);
    if (countries.length === 0) {
      try {
        const ar = await fetch(link, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
        if (ar.ok) {
          const bodyText = htmlToText(await ar.text());
          countries = findCountries(bodyText.slice(0, 1500), AFRICA_CTRIES);
        }
      } catch { /* ignore */ }
    }

    if (countries.length === 0) {
      console.log(`  [Africa CDC skip] ${title.slice(0,60)} → no African country found`);
      continue;
    }
    const geo = findCountry(countries[0]);
    if (!geo) continue;

    // Numbers: description + article body
    let artText = "";
    try {
      const ar = await fetch(link, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
      if (ar.ok) artText = htmlToText(await ar.text());
    } catch { /* ignore */ }
    const { cases, deaths } = extractNumbers(`${desc} ${artText}`.slice(0, 3000));
    const disease = normalizeDisease(diseaseRaw);

    results.push({ source:"Africa CDC", disease_en:disease.name_en, country_en:geo.name_en, cases, deaths, date, url:link });
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log("=== Scraper Dry-Run ===\n");
  const all: Result[] = [];

  for (const [name, fn] of [
    ["ECDC",       runECDC],
    ["PAHO",       runPAHO],
    ["Africa CDC", runAfricaCDC],
  ] as [string, () => Promise<Result[]>][]) {
    console.log(`\n── ${name} ──`);
    try {
      const rows = await fn();
      all.push(...rows);
      if (rows.length === 0) {
        console.log("  (no outbreak data extracted)");
      } else {
        rows.forEach(r =>
          console.log(`  ✅ ${r.disease_en} / ${r.country_en} — ${r.cases} cases, ${r.deaths} deaths (${r.date})`)
        );
      }
    } catch (e) {
      console.error(`  ❌ ${name} FAILED:`, e);
    }
  }

  console.log(`\n${"─".repeat(55)}`);
  console.log(`Total rows that would be inserted/updated: ${all.length}`);
  console.log(`${"─".repeat(55)}\n`);
}

run().catch(console.error);
