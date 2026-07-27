import { findCountry, COUNTRIES } from "./geo-data";
import { normalizeDisease } from "./disease-data";
import type { CountryGeo } from "./geo-data";
import { truncateAtSentence } from "./truncate-text";

// Umbrella country labels used for multi-country events. A WHO DON multi-country event
// is stored as "Multiple countries" by the DON sync; ECDC-wide articles are aggregated
// as "EU/EEA" by sync-ecdc-threats. These denote the same kind of event under different
// labels, so a secondary-source cron (ECDC, CDC) must not re-open a WHO-closed event
// under a mismatched umbrella label just because the exact disease+country key differs
// from the DON row (the hantavirus cruise re-open loop, 2026-07-08 — the ownership guard
// alone, keyed on exact disease+country, missed it). Shared by sync-ecdc-threats and
// sync-cdc-notices so both crons defer to a WHO-DON-owned umbrella row.
export const UMBRELLA_COUNTRY_LABELS = new Set([
  "eu/eea", "multiple countries", "multi-country", "multiple locations", "global",
]);

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
  admin1:     string | null;  // province / health-zone extracted from bulletin text
  admin1_lat: number | null;  // geocoded admin1 latitude  (Nominatim)
  admin1_lng: number | null;  // geocoded admin1 longitude (Nominatim)
  cases: number;
  deaths: number;
  recovered: number;
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

// Exported: also used to clean WHO DON article body HTML before number
// extraction. WHO's CMS glues &nbsp; directly against adjacent words with no
// real whitespace (e.g. "a total of&nbsp;46 800 cholera cases") — left
// undecoded, that silently breaks the "total of N cases" pattern below and
// falls through to an unrelated number elsewhere in the same paragraph.
export function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
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

// Small counts (typically ≤20) in WHO/ECDC prose are often spelled out in words
// rather than digits — e.g. a DON reporting a large country in digits ("452
// deaths") but a small satellite country in the same article as "including
// two deaths, as well as one probable case who has died" (DON612, Uganda).
// The case/death patterns that sit directly next to the count (not the
// "total of N" aggregate-total patterns, which are effectively always
// digit-form) accept both so a small figure isn't silently read as zero.
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};
const NUM_WORD_ALT = Object.keys(NUMBER_WORDS).join("|");
// \b around the word-form branch: without it, a number word embedded inside a
// longer word matches (e.g. "Sierra Leone" ends in "one" -> cases/deaths = 1,
// "often deaths" -> deaths = 10). Found 2026-07-15 security audit.
const NUM = `(?:\\d[\\d,]*|\\b(?:${NUM_WORD_ALT})\\b)`;

function parseCount(raw: string): number {
  const digits = raw.replace(/,/g, "");
  if (/^\d+$/.test(digits)) return parseInt(digits, 10);
  return NUMBER_WORDS[raw.toLowerCase().trim()] ?? 0;
}

export function extractNumbers(text: string): { cases: number; deaths: number; recovered: number } {
  const clean = text
    .replace(/\n/g, " ")
    .replace(/ /g, " ")
    // Normalize space-as-thousands-separator (European style: "2 649" → "2649")
    .replace(/\b(\d{1,3}) (\d{3})\b/g, "$1$2")
    .replace(/\b(\d{1,3}) (\d{3}) (\d{3})\b/g, "$1$2$3");

  // Qualifier words that can appear between a number and "cases"
  // e.g. "746 suspected cases", "83 confirmed cases", "12 probable cases",
  // and "144 suspected and confirmed cases" (qualifiers joined by "and").
  const QUALIFIERS = "(?:(?:suspected|probable|confirmed|laboratory[- ]confirmed|human|new|reported|additional)\\s+(?:and\\s+)?)*";

  const casePatterns = [
    // "a total of 2649 MERS cases" — allows 0-3 words between count and "cases"
    // catches "total of N [disease name(s)] cases" (e.g. ECDC: "2 649 MERS cases")
    /\btotal\s+of\s+(\d[\d,]*)\s+(?:[\w-]+\s+){0,3}cases?/i,
    // "a total of 746 suspected cases"
    new RegExp(`total\\s+of\\s+(\\d[\\d,]*)\\s+${QUALIFIERS}cases?`, "i"),
    // "a total of 48 768 cholera and acute watery diarrhoea cases" — cholera
    // DONs often double-label cases with a second disease/qualifier term,
    // exceeding the tighter patterns' 3-word gap. Still anchored to "total
    // of" so a grounded topline is preferred over an ungrounded match below.
    /\btotal\s+of\s+(\d[\d,]*)\s+(?:[\w-]+\s+){0,6}cases?/i,
    // "746 suspected/confirmed/probable/etc cases [have been reported]"
    // (also matches word-form small counts: "twenty confirmed cases")
    new RegExp(`(${NUM})\\s+${QUALIFIERS}cases?(?:\\s+(?:have\\s+been|were|are)\\s+reported)?`, "i"),
    // "cases: 746" / "cases reported: 746"
    /cases?(?:\s+reported)?[:\s]+(\d[\d,]*)/i,
    // ECDC uses "infections" instead of "cases": "more than 2 300 infections", "2 300 reported infections"
    /(\d[\d,]*)\s+(?:reported\s+)?infections?\b/i,
    /\btotal\s+of\s+(\d[\d,]*)\s+(?:[\w-]+\s+){0,3}infections?/i,
    // "N notified" (ECDC surveillance style: "2 300 notified")
    /(\d[\d,]*)\s+notified\b/i,
  ];

  // Qualifier words that can appear between a number and "deaths" — e.g. ECDC's
  // "including 719 related deaths". Without this, that count fails to match
  // (the base pattern requires the number directly adjacent to "deaths") and
  // the scan falls through to a later, unrelated "deaths" mention elsewhere
  // in the same page — e.g. an ECDC "living" topic page's day-over-day delta
  // sentence ("an increase of 31 new confirmed cases and 10 deaths since the
  // previous report"), silently swapping the cumulative total for a daily
  // increment. Found 2026-07-15 (Ebola DRC: read 10 deaths instead of 719).
  const DEATH_QUALIFIERS = "(?:(?:related|associated|confirmed|reported|probable|suspected|additional)\\s+)*";

  // "total of N ... cases, with/including M ... deaths" — anchors deaths to
  // the same cumulative sentence as cases, rather than scanning the whole
  // text for the first bare "N deaths" match. This is what actually fixes
  // the bug above for cases like ECDC's phrasing, where the cumulative
  // deaths figure is qualified ("related deaths") but a later, unqualified,
  // unrelated death count also appears in the page.
  const pairedPattern = new RegExp(
    `total\\s+of\\s+(\\d[\\d,]*)\\s+${QUALIFIERS}cases?,?\\s+(?:with|including)\\s+(${NUM})\\s+${DEATH_QUALIFIERS}deaths?`,
    "i"
  );

  // WHO AFRO's "Weekly External Situation Report" bulletins state BOTH a
  // week-over-week delta ("a total of 229 new confirmed cases, including 53
  // new confirmed deaths, have been reported") AND the real absolute total,
  // qualified with the word "cumulative" ("a cumulative total of 550
  // laboratory-confirmed cases, including 101 confirmed deaths"), earlier and
  // later in the same paragraph respectively. The plain pairedPattern above
  // only lands on the right (second) sentence by the accident of "new" not
  // being in DEATH_QUALIFIERS, which happens to break its match on the delta
  // sentence — not a real safeguard. This anchors on the literal word
  // "cumulative" so the real total is found on purpose. Found 2026-07-15.
  const cumulativePairedPattern = new RegExp(
    `cumulative(?:ly)?\\s+total\\s+of\\s+(\\d[\\d,]*)\\s+${QUALIFIERS}cases?,?\\s+(?:with|including)\\s+(${NUM})\\s+${DEATH_QUALIFIERS}deaths?`,
    "i"
  );
  const cumulativeCasePattern  = new RegExp(`cumulative(?:ly)?\\s+total\\s+of\\s+(\\d[\\d,]*)\\s+${QUALIFIERS}cases?`, "i");
  const cumulativeDeathPattern = new RegExp(`cumulative(?:ly)?\\s+total\\s+of\\s+(?:\\d[\\d,]*)\\s+${QUALIFIERS}cases?[^.]*?(${NUM})\\s+${DEATH_QUALIFIERS}deaths?`, "i");

  // Some AFRO bulletins (e.g. Ebola/DRC Situation Report #8) state ONLY the
  // delta, with no "cumulative"/"total of" figure anywhere in the article —
  // the absolute count apparently lives solely in a table/infographic image.
  // "An additional 317 confirmed cases and 144 confirmed deaths have been
  // reported" then silently satisfies the generic casePatterns/deathPatterns
  // below, misreporting the week's delta as the outbreak's absolute total
  // (confirmed 2026-07-15 — zero "total of" occurrences on the live page).
  // When this delta framing is present and no cumulative anchor was found
  // above, there is no trustworthy count to extract: return 0/0 so the
  // caller's existing 0/0 guard skips the write instead of corrupting a row
  // with a delta (this is what produced the 259 cases / 0 deaths incident —
  // an earlier week's "...and zero confirmed deaths have been reported").
  const DELTA_ONLY_MARKER = new RegExp(
    `\\ban?\\s+additional\\s+${NUM}\\s+${QUALIFIERS}(?:cases?|deaths?)\\b` +
    `|\\b${NUM}\\s+additional\\s+${QUALIFIERS}(?:cases?|deaths?)\\b`,
    "i"
  );

  const deathPatterns = [
    // "176 deaths [among ...]" — also matches word-form ("including two deaths")
    // and an intercalated qualifier ("719 related deaths").
    new RegExp(`(${NUM})\\s+${DEATH_QUALIFIERS}deaths?\\b`, "i"),
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

  const recoveredPatterns = [
    // "88 patients have recovered" / "88 have recovered"
    /(\d[\d,]*)\s+(?:patients?\s+)?have\s+recovered\b/i,
    // "88 recovered" (standalone)
    /(\d[\d,]*)\s+recovered\b(?!\s+(?:case|death|confirm))/i,
    // "88 recoveries"
    /(\d[\d,]*)\s+recoveries?\b/i,
    // "recovered: 88"
    /recovered[:\s]+(\d[\d,]*)/i,
    // "88 patients discharged from" (ETU context)
    /(\d[\d,]*)\s+patients?\s+(?:have\s+been\s+)?discharged\b/i,
    // "discharged: 88"
    /discharged[:\s]+(\d[\d,]*)/i,
  ];

  let cases = 0;
  let deaths = 0;
  let foundCumulative = false;

  const cumulativePaired = clean.match(cumulativePairedPattern);
  if (cumulativePaired) {
    cases  = parseCount(cumulativePaired[1]);
    deaths = parseCount(cumulativePaired[2]);
    foundCumulative = true;
  } else {
    const cCase  = clean.match(cumulativeCasePattern);
    const cDeath = clean.match(cumulativeDeathPattern);
    if (cCase || cDeath) {
      if (cCase)  cases  = parseCount(cCase[1]);
      if (cDeath) deaths = parseCount(cDeath[1]);
      foundCumulative = true;
    }
  }

  if (!foundCumulative) {
    if (DELTA_ONLY_MARKER.test(clean)) {
      cases  = 0;
      deaths = 0;
    } else {
      const paired = clean.match(pairedPattern);
      if (paired) {
        cases  = parseCount(paired[1]);
        deaths = parseCount(paired[2]);
      } else {
        for (const p of casePatterns) {
          const m = clean.match(p);
          if (m) { cases = parseCount(m[1]); break; }
        }
        for (const p of deathPatterns) {
          const m = clean.match(p);
          if (m) { deaths = parseCount(m[1]); break; }
        }
      }
    }
  }

  let recovered = 0;
  for (const p of recoveredPatterns) {
    const m = clean.match(p);
    if (m) { recovered = parseInt(m[1].replace(/,/g, ""), 10); break; }
  }

  return { cases, deaths, recovered };
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
): { cases: number; deaths: number; recovered: number } | null {
  const clean = text.replace(/\n/g, " ");
  const QUALIFIERS = "(?:(?:suspected|probable|confirmed|laboratory[- ]confirmed|human|new|reported|additional)\\s+(?:and\\s+)?)*";
  // See extractNumbers() for why this exists — allows an intercalated
  // qualifier between a death count and "deaths" (e.g. "719 related deaths").
  const DEATH_QUALIFIERS = "(?:(?:related|associated|confirmed|reported|probable|suspected|additional)\\s+)*";
  const aliasPattern = new RegExp(countryAliases.map(escapeRegExp).join("|"), "i");
  const WINDOW = 200;

  const nearCountry = (index: number, length: number): boolean => {
    const start = Math.max(0, index - WINDOW);
    const end = Math.min(clean.length, index + length + WINDOW);
    return aliasPattern.test(clean.slice(start, end));
  };

  // Tier 1: "a total of N ... cases, with/including M deaths" — the most
  // common WHO phrasing for a single country's headline figure. The deaths
  // half accepts word-form counts too ("a total of 20 cases, including two
  // deaths") — small satellite-country figures are often spelled out even
  // when the cases half of the same sentence is digit-form.
  const pairPattern = new RegExp(
    `total\\s+of\\s+(\\d[\\d,]*)\\s+${QUALIFIERS}cases?,?\\s+(?:with|including)\\s+(${NUM})\\s+${DEATH_QUALIFIERS}deaths?`,
    "gi"
  );
  for (const m of clean.matchAll(pairPattern)) {
    if (nearCountry(m.index ?? 0, m[0].length)) {
      return {
        cases:     parseCount(m[1]),
        deaths:    parseCount(m[2]),
        recovered: 0,
      };
    }
  }

  // Tier 2: cases and deaths mentioned in separate sentences, each
  // individually anchored near the country name. Both accept word-form
  // counts (see NUM) — e.g. DON612's "Uganda has reported 20 confirmed
  // cases including two deaths" has no "total of" anchor for Tier 1 to
  // match, so this tier is what actually resolves Uganda's figures.
  const casePattern = new RegExp(`(${NUM})\\s+${QUALIFIERS}cases?`, "gi");
  const deathPattern = new RegExp(`(${NUM})\\s+${DEATH_QUALIFIERS}deaths?\\b`, "gi");

  let cases: number | null = null;
  for (const m of clean.matchAll(casePattern)) {
    if (nearCountry(m.index ?? 0, m[0].length)) {
      cases = parseCount(m[1]);
      break;
    }
  }

  let deaths: number | null = null;
  for (const m of clean.matchAll(deathPattern)) {
    if (nearCountry(m.index ?? 0, m[0].length)) {
      deaths = parseCount(m[1]);
      break;
    }
  }

  if (cases === null && deaths === null) return null;

  // Recovered: anchor to country name in text
  const recovPattern = /(\d[\d,]*)\s+(?:patients?\s+)?(?:have\s+)?recovered\b|(\d[\d,]*)\s+recoveries?\b|recovered[:\s]+(\d[\d,]*)|(\d[\d,]*)\s+patients?\s+(?:have\s+been\s+)?discharged\b/gi;
  let recovered = 0;
  for (const m of clean.matchAll(recovPattern)) {
    if (nearCountry(m.index ?? 0, m[0].length)) {
      const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "0";
      recovered = parseInt(raw.replace(/,/g, ""), 10);
      break;
    }
  }

  return { cases: cases ?? 0, deaths: deaths ?? 0, recovered };
}

// ─── Country-headed sections within multi-country DON HTML ────
//
// WHO's CMS renders a multi-country DON's per-country breakdown as a bare
// "<p><strong>Country Name</strong></p>" heading immediately followed by
// that country's own narrative (cases, deaths, dates) — repeated once per
// country with individually-attributed figures, ending wherever the next
// such heading begins (another country, or an unrelated section title like
// "Epidemiology"). A fixed character radius around each country's name is
// NOT reliable for finding its own figures here: these DONs constantly
// cross-reference each other ("border with Sudan", "cross-border with DRC")
// within a few hundred characters of the actual figures. This instead uses
// the document's own heading structure as the boundary. Returns a map of
// name_en -> that country's own section text (plain), for countries that
// have a dedicated section; countries only named in passing (e.g. inside a
// regional roll-up total) correctly get no entry rather than a guessed one.
export function findCountryHeadingSections(
  html: string,
  candidates: CountryGeo[]
): Map<string, string> {
  const clean = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");

  const headingRe = /<(strong|h[2-4])[^>]*>\s*([^<]{2,60}?)\s*<\/\1>/gi;
  const headings: Array<{ start: number; end: number; label: string }> = [];
  for (const m of clean.matchAll(headingRe)) {
    headings.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, label: m[2].trim().toLowerCase() });
  }

  // A candidate's own COUNTRIES key(s) (e.g. "Democratic Republic of the
  // Congo") are what WHO's headings actually spell out — name_en is often a
  // shorter display label ("DR Congo") that never appears verbatim in text.
  const byLabel = new Map<string, CountryGeo>();
  for (const geo of candidates) {
    byLabel.set(geo.name_en.toLowerCase(), geo);
    for (const [key, val] of Object.entries(COUNTRIES)) {
      if (val.name_en === geo.name_en) byLabel.set(key.toLowerCase(), geo);
    }
  }
  const blocks = new Map<string, string>();

  for (let i = 0; i < headings.length; i++) {
    const geo = byLabel.get(headings[i].label);
    if (!geo || blocks.has(geo.name_en)) continue; // first (data) section wins over later repeats
    const blockEnd = i + 1 < headings.length ? headings[i + 1].start : clean.length;
    const plain = decodeEntities(
      clean.slice(headings[i].end, blockEnd).replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ").trim();
    blocks.set(geo.name_en, plain);
  }
  return blocks;
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
  const descClean = truncateAtSentence(
    item.description
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    400
  );

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
    admin1:     null,
    admin1_lat: null,
    admin1_lng: null,
    cases,
    deaths,
    recovered: 0,
    risk_level,
    date,
    source: item.link || "https://www.who.int/emergencies/disease-outbreak-news",
    description: descClean,
    active: true,
  };
}
