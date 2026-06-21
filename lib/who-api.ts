import { findCountry } from "./geo-data";
import { normalizeDisease } from "./disease-data";
import { parseWHOTitle, extractNumbers, extractNumbersForCountry, countryAliasesForMultiCountry, assessRisk } from "./outbreak-parser";
import type { ParsedOutbreak } from "./outbreak-parser";
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

// ── 2. Fetch individual article body for case/death numbers ───

async function fetchArticleNumbers(
  path: string,
  countryAliases: string[] | null
): Promise<{ cases: number; deaths: number; recovered: number; description: string; fullText: string }> {
  try {
    const url = path.startsWith("http") ? path : `https://www.who.int${path}`;
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { cases: 0, deaths: 0, recovered: 0, description: "", fullText: "" };

    const html = await res.text();

    // Extract text from the main content area
    const bodyMatch = html.match(
      /(?:sf-content-block|article-content|content-block-article|don-content)([\s\S]{0,8000})/i
    );
    const rawText = (bodyMatch ? bodyMatch[1] : html)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const nums = (countryAliases && extractNumbersForCountry(rawText, countryAliases)) || extractNumbers(rawText);
    const description = rawText.slice(0, 400);
    return { cases: nums.cases, deaths: nums.deaths, recovered: nums.recovered ?? 0, description, fullText: rawText };
  } catch {
    return { cases: 0, deaths: 0, recovered: 0, description: "", fullText: "" };
  }
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

// ── 3. Parse a WHO DON item → ParsedOutbreak ──────────────────

export async function parseWHODONItem(
  item: WHONewsItem,
  fetchBody = false
): Promise<ParsedOutbreak | null> {
  const { Title, ItemDefaultUrl, PublicationDateAndTime, Summary, DonId } = item;
  if (!Title) return null;

  // Title formats: "Ebola disease – Democratic Republic of the Congo"
  //                "Mpox – DR Congo"
  //                "Cholera – Haiti"
  const parsed = parseWHOTitle(Title);
  if (!parsed) return null;

  const geo = findCountry(parsed.country);
  if (!geo) {
    console.warn(`[who-api] Unknown country: "${parsed.country}" (title: ${Title})`);
    return null;
  }

  const disease = normalizeDisease(parsed.disease);
  const date = PublicationDateAndTime
    ? new Date(PublicationDateAndTime).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  // Articles covering several countries (e.g. "...the Democratic Republic
  // of the Congo and Uganda") report per-country AND combined totals —
  // anchor extraction to the country this row is for.
  const countryAliases = countryAliasesForMultiCountry(parsed.country, geo);

  // Canonical DON URL: /emergencies/disease-outbreak-news/item/2026-DON603
  const donSlug = DonId || ItemDefaultUrl?.replace(/^\//, "") || "";
  const articleUrl = donSlug
    ? `https://www.who.int/emergencies/disease-outbreak-news/item/${donSlug}`
    : `https://www.who.int${ItemDefaultUrl || ""}`;

  // Try to get numbers from Summary field first (API field, fast).
  // Summary rarely contains recovered data — body fetch is needed for that.
  let cases = 0;
  let deaths = 0;
  let recovered = 0;
  let description = "";
  let fullText = "";

  if (Summary) {
    const plain = Summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
  if (ItemDefaultUrl) {
    const bodyData = await fetchArticleNumbers(ItemDefaultUrl, countryAliases);
    if (cases === 0) {
      cases  = bodyData.cases  ?? 0;
      deaths = bodyData.deaths ?? 0;
    }
    if (recovered === 0) recovered = bodyData.recovered ?? 0;
    description = bodyData.description || description;
    fullText    = bodyData.fullText;
    await new Promise((r) => setTimeout(r, 150)); // polite delay
  }

  const risk_level = assessRisk(parsed.disease, description, cases, deaths);
  const active = !isOutbreakEnded(fullText || description);

  // ── Sub-national location extraction ──────────────────────────────
  // Use fullText (up to 8000 chars) so province mentions in paragraph 2-3
  // are reachable — description is only 400 chars and misses most of them.
  let admin1:     string | null = null;
  let admin1_lat: number | null = null;
  let admin1_lng: number | null = null;
  const textForAdmin1 = fullText || description;
  if (textForAdmin1) {
    const extracted = extractAdmin1(textForAdmin1);
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
