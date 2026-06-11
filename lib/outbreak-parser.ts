import { findCountry } from "./geo-data";
import { normalizeDisease } from "./disease-data";
import type { CountryGeo } from "./geo-data";

export interface ParsedOutbreak {
  disease: string;       // fr
  disease_en: string;
  disease_ar: string;
  country: string;       // fr
  country_en: string;
  country_ar: string;
  region: string;
  lat: number;
  lng: number;
  cases: number;
  deaths: number;
  risk_level: "high" | "medium" | "low";
  date: string;          // YYYY-MM-DD
  source: string;        // WHO article URL (used as external ID for dedup)
  description: string;
  active: boolean;
}

// ─── RSS XML parsing ───────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  // Try CDATA
  const cdata = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  if (cdata) return cdata[1].trim();
  // Plain text
  const plain = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
  return plain ? plain[1].trim() : "";
}

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

export function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: decodeEntities(extractTag(block, "title")),
      link: extractTag(block, "link").replace(/\s/g, ""),
      description: decodeEntities(extractTag(block, "description")),
      pubDate: extractTag(block, "pubDate"),
    });
  }
  return items;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—");
}

// ─── WHO DON title parsing ─────────────────────────────────────

export function parseWHOTitle(title: string): { disease: string; country: string } | null {
  // Remove "Disease Outbreak News: " prefix (with or without it)
  const clean = title
    .replace(/^Disease Outbreak News:\s*/i, "")
    .replace(/^DON\s*[–—]\s*/i, "")
    .trim();

  // Split on em dash, en dash, or hyphen (with space after; handles "disease- Country" too)
  const parts = clean.split(/\s*[–—]\s*|\s*-\s+/);
  if (parts.length >= 2) {
    return {
      disease: parts[0].trim(),
      country: parts.slice(1).join(" – ").trim(),
    };
  }

  // Fallback: trailing ", Country" pattern (e.g. "Hantavirus cluster, Multi-country")
  const commaIdx = clean.lastIndexOf(",");
  if (commaIdx !== -1) {
    const country = clean.slice(commaIdx + 1).trim();
    const disease = clean.slice(0, commaIdx).trim();
    if (disease && country) return { disease, country };
  }

  return null;
}

// ─── Generic title parser (WHO format) ───────────────────────

export function parseTitle(title: string): { disease: string; country: string } | null {
  return parseWHOTitle(title);
}

// ─── Number extraction from free text ─────────────────────────

export function extractNumbers(text: string): { cases: number; deaths: number } {
  const clean = text.replace(/\n/g, " ");

  // Qualifier words that can appear between a number and "cases"
  // e.g. "746 suspected cases", "83 confirmed cases", "12 probable cases"
  const QUALIFIERS = "(?:(?:suspected|probable|confirmed|laboratory[- ]confirmed|human|new|reported|additional)\\s+)*";

  const casePatterns = [
    // "a total of 746 suspected cases"
    new RegExp(`total\\s+of\\s+(\\d[\\d,]*)\\s+${QUALIFIERS}cases?`, "i"),
    // "746 suspected/confirmed/probable/etc cases [have been reported]"
    new RegExp(`(\\d[\\d,]*)\\s+${QUALIFIERS}cases?(?:\\s+(?:have\\s+been|were|are)\\s+reported)?`, "i"),
    // "cases: 746" / "cases reported: 746"
    /cases?(?:\s+reported)?[:\s]+(\d[\d,]*)/i,
  ];

  const deathPatterns = [
    // "176 deaths [among ...]"
    /(\d[\d,]*)\s+deaths?\b/i,
    // "X people have died" / "X died"
    /(\d[\d,]*)\s+(?:people\s+)?(?:have\s+)?died/i,
    // "X fatalities"
    /(\d[\d,]*)\s+fatalities/i,
    // "killing X" / "killed X"
    /kill(?:ed|ing)\s+(\d[\d,]*)/i,
    // "of which X were fatal" / "X fatal cases"
    /(?:of\s+which\s+)?(\d[\d,]*)\s+(?:were\s+)?fatal/i,
    // "deaths: 42"
    /deaths?(?:\s+reported)?[:\s]+(\d[\d,]*)/i,
    /(\d[\d,]*)\s+(?:fatal\s+)?(?:casualties|casulties)/i,
  ];

  let cases = 0;
  for (const p of casePatterns) {
    const m = clean.match(p);
    if (m) { cases = parseInt(m[1].replace(/,/g, ""), 10); break; }
  }

  let deaths = 0;
  for (const p of deathPatterns) {
    const m = clean.match(p);
    if (m) { deaths = parseInt(m[1].replace(/,/g, ""), 10); break; }
  }

  return { cases, deaths };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Country-anchored number extraction (multi-country articles) ──
//
// A single WHO DON article can cover several countries (e.g. "...the
// Democratic Republic of the Congo and Uganda"), each with its own case
// and death counts plus a combined total. extractNumbers() just grabs the
// first "N cases" it finds, which may belong to the wrong country or be
// the combined total. This anchors extraction to text near a mention of
// the target country, returning null (so the caller falls back to
// extractNumbers()) when no such anchored figure can be found.
export function extractNumbersForCountry(
  text: string,
  countryAliases: string[]
): { cases: number; deaths: number } | null {
  const clean = text.replace(/\n/g, " ");
  const QUALIFIERS = "(?:(?:suspected|probable|confirmed|laboratory[- ]confirmed|human|new|reported|additional)\\s+)*";
  const aliasPattern = new RegExp(countryAliases.map(escapeRegExp).join("|"), "i");
  const WINDOW = 200;

  const nearCountry = (index: number, length: number): boolean => {
    const start = Math.max(0, index - WINDOW);
    const end = Math.min(clean.length, index + length + WINDOW);
    return aliasPattern.test(clean.slice(start, end));
  };

  // Tier 1: "a total of N ... cases, with/including M deaths" — the most
  // common WHO phrasing for a single country's headline figure.
  const pairPattern = new RegExp(
    `total\\s+of\\s+(\\d[\\d,]*)\\s+${QUALIFIERS}cases?,?\\s+(?:with|including)\\s+(\\d[\\d,]*)\\s+deaths?`,
    "gi"
  );
  for (const m of clean.matchAll(pairPattern)) {
    if (nearCountry(m.index ?? 0, m[0].length)) {
      return {
        cases: parseInt(m[1].replace(/,/g, ""), 10),
        deaths: parseInt(m[2].replace(/,/g, ""), 10),
      };
    }
  }

  // Tier 2: cases and deaths mentioned in separate sentences, each
  // individually anchored near the country name.
  const casePattern = new RegExp(`(\\d[\\d,]*)\\s+${QUALIFIERS}cases?`, "gi");
  const deathPattern = /(\d[\d,]*)\s+deaths?\b/gi;

  let cases: number | null = null;
  for (const m of clean.matchAll(casePattern)) {
    if (nearCountry(m.index ?? 0, m[0].length)) {
      cases = parseInt(m[1].replace(/,/g, ""), 10);
      break;
    }
  }

  let deaths: number | null = null;
  for (const m of clean.matchAll(deathPattern)) {
    if (nearCountry(m.index ?? 0, m[0].length)) {
      deaths = parseInt(m[1].replace(/,/g, ""), 10);
      break;
    }
  }

  if (cases === null && deaths === null) return null;
  return { cases: cases ?? 0, deaths: deaths ?? 0 };
}

// Splits a WHO DON country fragment like "Democratic Republic of the Congo
// and Uganda" into per-country aliases for the segment matching `geo`, for
// use with extractNumbersForCountry(). Returns null for single-country
// articles, where extractNumbers()'s existing behaviour is unaffected.
export function countryAliasesForMultiCountry(countryFragment: string, geo: CountryGeo): string[] | null {
  const segments = countryFragment.split(/\s+(?:&|and)\s+/i).map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return null;

  const aliases: string[] = [geo.name_en];
  for (const seg of segments) {
    const segGeo = findCountry(seg);
    if (segGeo && segGeo.name_en === geo.name_en) {
      aliases.unshift(seg);
      break;
    }
  }
  if (geo.name_en === "DR Congo") aliases.push("DRC");
  return aliases;
}

// ─── Risk level heuristic ─────────────────────────────────────

export function assessRisk(
  diseaseName: string,
  description: string,
  cases: number,
  deaths: number
): "high" | "medium" | "low" {
  const t = (diseaseName + " " + description).toLowerCase();

  // Always high-risk diseases
  const alwaysHigh = ["ebola", "marburg", "nipah", "plague", "mers", "crimean-congo"];
  if (alwaysHigh.some((d) => t.includes(d))) return "high";

  // High-risk signals in text
  const highSignals = [
    "human-to-human", "human to human",
    "sustained transmission",
    "international spread", "spread to",
    "public health emergency of international concern", "pheic",
    "pandemic",
    "novel", "previously unknown",
  ];
  if (highSignals.some((s) => t.includes(s))) return "high";

  // Case fatality rate > 5% and meaningful numbers
  if (cases > 0 && deaths > 0 && deaths / cases > 0.05 && deaths >= 3) return "high";
  if (deaths >= 20) return "high";

  // Low-risk signals
  const lowSignals = ["contained", "under control", "no further cases", "ended", "eradicated"];
  if (lowSignals.some((s) => t.includes(s)) && deaths < 3) return "low";
  if (cases > 0 && deaths === 0 && cases < 20) return "low";

  return "medium";
}

// ─── Parse date from pubDate string ───────────────────────────

export function parsePubDate(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {}
  return new Date().toISOString().split("T")[0];
}

// ─── Build full outbreak entry from RSS item ──────────────────

export function buildOutbreakFromRSSItem(item: RSSItem): ParsedOutbreak | null {
  const parsed = parseTitle(item.title);
  if (!parsed) return null;

  const geo: CountryGeo | null = findCountry(parsed.country);
  if (!geo) {
    // Unknown country — skip for now (could be a multi-country alert)
    console.warn(`[sync] Unknown country: "${parsed.country}" (title: ${item.title})`);
    return null;
  }

  const disease = normalizeDisease(parsed.disease);
  const countryAliases = countryAliasesForMultiCountry(parsed.country, geo);
  const { cases, deaths } = (countryAliases && extractNumbersForCountry(item.description, countryAliases)) || extractNumbers(item.description);
  const risk_level = assessRisk(parsed.disease, item.description, cases, deaths);
  const date = parsePubDate(item.pubDate);

  // Strip HTML from description, truncate
  const descClean = item.description
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  return {
    disease: disease.name_fr,
    disease_en: disease.name_en,
    disease_ar: disease.name_ar,
    country: geo.name_fr,
    country_en: geo.name_en,
    country_ar: geo.name_ar,
    region: geo.region,
    lat: geo.lat,
    lng: geo.lng,
    cases,
    deaths,
    risk_level,
    date,
    source: item.link || "https://www.who.int/emergencies/disease-outbreak-news",
    description: descClean,
    active: true,
  };
}
