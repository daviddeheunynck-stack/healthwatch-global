import { findCountry, findMentionedCountries, isAggregateCountry, findCountryParentheticals } from "./geo-data";
import { normalizeDisease } from "./disease-data";
import {
  parseWHOTitle, extractNumbers, extractNumbersForCountry, countryAliasesForMultiCountry,
  findCountryHeadingSections, decodeEntities, assessRisk,
} from "./outbreak-parser";
import type { ParsedOutbreak } from "./outbreak-parser";
import type { CountryGeo } from "./geo-data";
import { extractAdmin1, geocodeAdmin1 } from "./geo-extract";

const WHO_DON_API = "https://www.who.int/api/news/diseaseoutbreaknews";

const FETCH_HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface WHONewsItem {
  Id: string;
  Title: string;
  UrlName: string;
  ItemDefaultUrl: string;
  PublicationDateAndTime: string;
  DonId?: string;
  Summary?: string;
}

// ── 1. Fetch DON listing from WHO OData API ───────────────────

export async function fetchWHODONList(top = 25): Promise<WHONewsItem[]> {
  const params = new URLSearchParams({
    "sf_culture": "en",
    "$format": "json",
    "$orderby": "PublicationDateAndTime desc",
    "$top": String(top),
  });

  const res = await fetch(`${WHO_DON_API}?${params}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`WHO OData API → HTTP ${res.status}`);
  const json = await res.json();
  return json.value || [];
}

// ── 2. Fetch individual article body ───────────────────────────

// Takes the already-resolved canonical article URL (see donArticleUrl below)
// — NOT the raw OData `ItemDefaultUrl`, which the feed sometimes returns as
// a bare slug (e.g. "/2025-DON579") that 404s if fetched directly.
async function fetchArticleHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function htmlToPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

async function fetchArticleNumbers(
  url: string,
  countryAliases: string[] | null
): Promise<{ cases: number; deaths: number; recovered: number; description: string; fullText: string }> {
  const html = await fetchArticleHtml(url);
  if (!html) return { cases: 0, deaths: 0, recovered: 0, description: "", fullText: "" };

  // Extract text from the main content area
  const bodyMatch = html.match(
    /(?:sf-content-block|article-content|content-block-article|don-content)([\s\S]{0,8000})/i
  );
  const rawText = htmlToPlainText(bodyMatch ? bodyMatch[1] : html);

  const nums = (countryAliases && extractNumbersForCountry(rawText, countryAliases)) || extractNumbers(rawText);
  const description = rawText.slice(0, 400);
  return { cases: nums.cases, deaths: nums.deaths, recovered: nums.recovered ?? 0, description, fullText: rawText };
}

// ── End-of-outbreak signal detection ─────────────────────────
// WHO DON articles that formally close an outbreak contain these phrases.
const OUTBREAK_ENDED_SIGNALS = [
  "no new cases have been reported",
  "no further cases",
  "the outbreak has ended",
  "end of the outbreak",
  "declared the end",
  "outbreak has been declared over",
  "this outbreak is considered to be over",
  "outbreak is over",
];

function isOutbreakEnded(text: string): boolean {
  const lower = text.toLowerCase();
  return OUTBREAK_ENDED_SIGNALS.some((s) => lower.includes(s));
}

function donArticleUrl(item: WHONewsItem): string {
  // Canonical DON URL: /emergencies/disease-outbreak-news/item/2026-DON603
  const donSlug = item.DonId || item.ItemDefaultUrl?.replace(/^\//, "") || "";
  return donSlug
    ? `https://www.who.int/emergencies/disease-outbreak-news/item/${donSlug}`
    : `https://www.who.int${item.ItemDefaultUrl || ""}`;
}

function donDate(item: WHONewsItem): string {
  return item.PublicationDateAndTime
    ? new Date(item.PublicationDateAndTime).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];
}

// ── 3a. Single-country DON (the vast majority of articles) ────
async function parseSingleCountryDON(
  item: WHONewsItem,
  parsedTitle: { disease: string; country: string },
  geo: CountryGeo
): Promise<ParsedOutbreak> {
  const disease = normalizeDisease(parsedTitle.disease);
  const date = donDate(item);

  // Articles covering two countries in the title (e.g. "...the Democratic
  // Republic of the Congo and Uganda") sometimes report per-country AND
  // combined totals — anchor extraction to the country this row is for.
  const countryAliases = countryAliasesForMultiCountry(parsedTitle.country, geo);

  const articleUrl = donArticleUrl(item);

  // Try to get numbers from Summary field first (API field, fast).
  // Summary rarely contains recovered data — body fetch is needed for that.
  let cases = 0;
  let deaths = 0;
  let recovered = 0;
  let description = "";
  let fullText = "";

  if (item.Summary) {
    const plain = decodeEntities(item.Summary.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const nums = (countryAliases && extractNumbersForCountry(plain, countryAliases)) || extractNumbers(plain);
    cases       = nums.cases     ?? 0;
    deaths      = nums.deaths    ?? 0;
    recovered   = nums.recovered ?? 0;
    description = plain.slice(0, 400);
  }

  // Always fetch the full article body — we need the complete text for:
  //   1. Case/death numbers (when Summary is missing or zero)
  //   2. Admin1 extraction (province mention is often in paragraph 2-3,
  //      beyond the 400-char description slice)
  if (item.ItemDefaultUrl) {
    const bodyData = await fetchArticleNumbers(articleUrl, countryAliases);
    if (cases === 0) {
      cases  = bodyData.cases  ?? 0;
      deaths = bodyData.deaths ?? 0;
    }
    if (recovered === 0) recovered = bodyData.recovered ?? 0;
    description = bodyData.description || description;
    fullText    = bodyData.fullText;
    await new Promise((r) => setTimeout(r, 150)); // polite delay
  }

  const risk_level = assessRisk(parsedTitle.disease, description, cases, deaths);
  const active = !isOutbreakEnded(fullText || description);

  // ── Sub-national location extraction ──────────────────────────────
  // Use fullText (up to 8000 chars) so province mentions in paragraph 2-3
  // are reachable — description is only 400 chars and misses most of them.
  let admin1:     string | null = null;
  let admin1_lat: number | null = null;
  let admin1_lng: number | null = null;
  const textForAdmin1 = fullText || description;
  if (textForAdmin1) {
    const extracted = await extractAdmin1(textForAdmin1, geo.name_en);
    if (extracted) {
      admin1 = extracted;
      const coords = await geocodeAdmin1(extracted, geo.name_en);
      if (coords) { admin1_lat = coords.lat; admin1_lng = coords.lng; }
      // Nominatim rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

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
    admin1,
    admin1_lat,
    admin1_lng,
    cases,
    deaths,
    recovered,
    risk_level,
    date,
    source: articleUrl,
    description,
    active,
  };
}

// ── 3b. Multi-country DON: one row per country with its own figures ──
//
// Triggered either by a title naming 2+ countries ("X and Y") or by the
// country fragment not resolving to a real place at all — WHO's catch-all
// phrasing for articles covering many countries at once (e.g. "Cholera –
// Multi-country with a focus on countries experiencing current surges").
// Rather than the single aggregate "Multiple countries" row this used to
// produce (carrying only the global total), this finds each country WHO's
// own text gives individual figures to and returns one row per country —
// countries only folded into a regional roll-up (e.g. "the African Region
// recorded 172 750 cases, 23 countries") are correctly left out rather than
// guessed at.
async function parseMultiCountryDON(
  item: WHONewsItem,
  parsedTitle: { disease: string; country: string },
  primaryGeo: CountryGeo
): Promise<ParsedOutbreak[]> {
  const disease = normalizeDisease(parsedTitle.disease);
  const date = donDate(item);
  const articleUrl = donArticleUrl(item);

  const html = item.ItemDefaultUrl ? await fetchArticleHtml(articleUrl) : "";
  if (item.ItemDefaultUrl) await new Promise((r) => setTimeout(r, 150)); // polite delay

  const plainSummary = item.Summary
    ? decodeEntities(item.Summary.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    : "";
  const plainAll = html ? htmlToPlainText(html) : plainSummary;

  const candidates = findMentionedCountries(plainAll);
  const blocks = html ? findCountryHeadingSections(html, candidates) : new Map<string, string>();

  const rows: Array<{ geo: CountryGeo; cases: number; deaths: number; recovered: number }> = [];
  for (const geo of candidates) {
    const block = blocks.get(geo.name_en);
    if (!block) continue;
    const nums = extractNumbers(block);
    rows.push({ geo, cases: nums.cases, deaths: nums.deaths, recovered: nums.recovered ?? 0 });
  }

  // Fallback tier 2: "Name (N), Name (N), ..." list format (e.g. some
  // multi-country food-safety/toxin DONs) — tried only when no <strong>
  // heading sections were found for any candidate.
  if (rows.length === 0) {
    const parenNums = findCountryParentheticals(plainAll);
    for (const geo of candidates) {
      const n = parenNums.get(geo.name_en);
      if (n === undefined) continue;
      rows.push({ geo, cases: n, deaths: 0, recovered: 0 });
    }
  }

  // A third fallback tier reusing extractNumbersForCountry's window-anchored
  // search (the same "N cases near a country name" heuristic used for
  // single-country articles) was tried here for free-form narrative prose
  // (e.g. DON581/591-style "Brazil accounts for ... with 96,159 confirmed
  // cases and 111 deaths"). Tested against DON581/591/586 via
  // scripts/dryrun-check-4-older-dons-2026-07-05.ts: it produced wrong
  // numbers for nearly every country in DON581 (cross-contamination between
  // adjacent countries' figures, and year-over-year comparison numbers like
  // "63 cases ... compared to 63 in 2024" winning over the real figure),
  // fabricated cases=2635 for Jordan in DON591 (the 2012-2025 cumulative
  // global total, not anything Jordan-specific), and fabricated 3 bogus
  // country rows for DON586 (a trends-only report with zero real per-country
  // data). A 200-char window around a country name isn't enough to reliably
  // find "which of the several nearby numbers is actually this country's own
  // current figure" in free narrative text — unlike the heading and
  // parenthetical-list tiers above, there's no structural anchor tying a
  // number to a specific country. Deliberately not shipped; DON581/591-style
  // articles fall through to the pre-existing aggregate-row behavior below
  // and need manual per-event verification, same as before this change.

  // The originally-resolved country (e.g. the epicenter in an "X & Y" title)
  // may not have its own heading section — its figures are often just the
  // article's headline total instead. Include it via that fallback if it's
  // a real place and isn't already covered above.
  if (!isAggregateCountry(primaryGeo) && !rows.some((r) => r.geo.name_en === primaryGeo.name_en)) {
    const nums = extractNumbers(plainAll);
    if (nums.cases > 0 || nums.deaths > 0) {
      rows.unshift({ geo: primaryGeo, cases: nums.cases, deaths: nums.deaths, recovered: nums.recovered ?? 0 });
    }
  }

  // Prefer Summary for the description: it's already a clean "situation at a
  // glance" excerpt, whereas plainAll is the raw page (nav/header chrome and
  // all) — deliberately not content-isolated the way the single-country path
  // isolates it, since that isolation's fixed 8000-char cap is exactly what
  // kept per-country sections deep in a long article out of reach.
  const description = (plainSummary || plainAll).slice(0, 400);
  const active = !isOutbreakEnded(plainAll);

  if (rows.length === 0) {
    // Nothing individually attributable anywhere in the article — preserve
    // the previous behaviour rather than silently dropping the DON.
    const nums = extractNumbers(plainAll);
    return [{
      disease: disease.name_fr, disease_en: disease.name_en, disease_ar: disease.name_ar,
      country: primaryGeo.name_fr, country_en: primaryGeo.name_en, country_ar: primaryGeo.name_ar,
      region: primaryGeo.region, lat: primaryGeo.lat, lng: primaryGeo.lng,
      admin1: null, admin1_lat: null, admin1_lng: null,
      cases: nums.cases, deaths: nums.deaths, recovered: nums.recovered ?? 0,
      risk_level: assessRisk(parsedTitle.disease, description, nums.cases, nums.deaths),
      date, source: articleUrl, description, active,
    }];
  }

  return rows.map(({ geo, cases, deaths, recovered }) => ({
    disease: disease.name_fr, disease_en: disease.name_en, disease_ar: disease.name_ar,
    country: geo.name_fr, country_en: geo.name_en, country_ar: geo.name_ar,
    region: geo.region, lat: geo.lat, lng: geo.lng,
    admin1: null, admin1_lat: null, admin1_lng: null,
    cases, deaths, recovered,
    risk_level: assessRisk(parsedTitle.disease, description, cases, deaths),
    date, source: articleUrl, description, active,
  }));
}

// ── Entry point ────────────────────────────────────────────────
//
// Parses a WHO DON item into one row per country the text actually
// attributes figures to. Single-country articles (the vast majority) return
// exactly one row, unchanged from previous behaviour.
export async function parseWHODONItems(item: WHONewsItem): Promise<ParsedOutbreak[]> {
  const { Title } = item;
  if (!Title) return [];

  // Title formats: "Ebola disease – Democratic Republic of the Congo"
  //                "Mpox – DR Congo"
  //                "Cholera – Haiti"
  const parsed = parseWHOTitle(Title);
  if (!parsed) return [];

  const geo = findCountry(parsed.country);

  const titleSegments = parsed.country.split(/\s+(?:&|and)\s+/i).map((s) => s.trim()).filter(Boolean);
  const titleCountries: CountryGeo[] = [];
  if (titleSegments.length >= 2) {
    const seen = new Set<string>();
    for (const seg of titleSegments) {
      const g = findCountry(seg);
      if (g && !isAggregateCountry(g) && !seen.has(g.name_en)) { titleCountries.push(g); seen.add(g.name_en); }
    }
  }

  // WHO uses several "not a single place" phrasings beyond "Multi-country"
  // (e.g. "Hantavirus outbreak linked to cruise ship travel, Multi-locations")
  // that findCountry() can't fuzzy-resolve to anything, which used to mean
  // the DON was silently dropped entirely rather than even getting an
  // aggregate row. Treat any "multi-X" title fragment as multi-country too.
  const looksMultiEntity = !geo && /\bmulti[- ]\w+/i.test(parsed.country);

  if (titleCountries.length >= 2 || (geo && isAggregateCountry(geo)) || looksMultiEntity) {
    const fallbackGeo = geo ?? findCountry("Multi-country")!;
    return parseMultiCountryDON(item, parsed, fallbackGeo);
  }

  if (!geo) {
    console.warn(`[who-api] Unknown country: "${parsed.country}" (title: ${Title})`);
    return [];
  }

  return [await parseSingleCountryDON(item, parsed, geo)];
}
