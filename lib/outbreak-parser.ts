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

// ─── ProMED title parsing ──────────────────────────────────────
// Format: "PRO/AH/EDR> Cholera - Haiti (03): WHO, update"
//      or "PRO/AH> Avian Influenza - Cambodia (07): H5N1"

export function parseProMEDTitle(title: string): { disease: string; country: string } | null {
  // Strip "PRO/XX> " prefix
  const withoutPrefix = title.replace(/^PRO\/[^>]+>\s*/i, "").trim();

  // Pattern: "Disease - Country (number): detail"
  // Split on " - " but stop before "(N):" or ":"
  const match = withoutPrefix.match(/^(.+?)\s*-\s*([^:(]+?)(?:\s*\(\d+\))?(?:\s*:.*)?$/);
  if (match) {
    const disease = match[1].trim();
    // Country may have commas (multi-country) — take first
    const countryRaw = match[2].trim();
    const country = countryRaw.split(/,\s*/)[0].trim();
    if (disease && country) return { disease, country };
  }
  return null;
}

// ─── Generic title parser (tries WHO then ProMED) ─────────────

export function parseTitle(title: string): { disease: string; country: string } | null {
  if (/^PRO\//i.test(title)) return parseProMEDTitle(title);
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
    new RegExp(`total\\s+of\\s+([\\d,]+)\\s+${QUALIFIERS}cases?`, "i"),
    // "746 suspected/confirmed/probable/etc cases [have been reported]"
    new RegExp(`([\\d,]+)\\s+${QUALIFIERS}cases?(?:\\s+(?:have\\s+been|were|are)\\s+reported)?`, "i"),
    // "cases: 746" / "cases reported: 746"
    /cases?(?:\s+reported)?[:\s]+([,\d]+)/i,
  ];

  const deathPatterns = [
    // "176 deaths [among ...]"
    /([\d,]+)\s+deaths?\b/i,
    // "X people have died" / "X died"
    /([\d,]+)\s+(?:people\s+)?(?:have\s+)?died/i,
    // "X fatalities"
    /([\d,]+)\s+fatalities/i,
    // "killing X" / "killed X"
    /kill(?:ed|ing)\s+([\d,]+)/i,
    // "of which X were fatal" / "X fatal cases"
    /(?:of\s+which\s+)?([\d,]+)\s+(?:were\s+)?fatal/i,
    // "deaths: 42"
    /deaths?(?:\s+reported)?[:\s]+([,\d]+)/i,
    /([\d,]+)\s+(?:fatal\s+)?(?:casualties|casulties)/i,
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
  const { cases, deaths } = extractNumbers(item.description);
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
