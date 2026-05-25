import { findCountry } from "./geo-data";
import { normalizeDisease } from "./disease-data";
import { parseWHOTitle, extractNumbers, assessRisk } from "./outbreak-parser";
import type { ParsedOutbreak } from "./outbreak-parser";

const WHO_API = "https://www.who.int/api/news/newsitems";

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
  NewsType: string;
  Summary?: string;
}

// ── 1. Fetch DON listing from WHO OData API ───────────────────

export async function fetchWHODONList(top = 25): Promise<WHONewsItem[]> {
  const params = new URLSearchParams({
    "sf_culture": "en",
    "$format": "json",
    "$filter": "NewsType eq 'DiseaseOutbreakNews'",
    "$orderby": "PublicationDateAndTime desc",
    "$top": String(top),
    "$select": "Id,Title,UrlName,ItemDefaultUrl,PublicationDateAndTime,NewsType,Summary",
  });

  const res = await fetch(`${WHO_API}?${params}`, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`WHO OData API → HTTP ${res.status}`);
  const json = await res.json();
  return json.value || [];
}

// ── 2. Fetch individual article body for case/death numbers ───

async function fetchArticleNumbers(
  path: string
): Promise<{ cases: number; deaths: number; description: string }> {
  try {
    const url = path.startsWith("http") ? path : `https://www.who.int${path}`;
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { cases: 0, deaths: 0, description: "" };

    const html = await res.text();

    // Extract text from the main content area
    const bodyMatch = html.match(
      /(?:sf-content-block|article-content|content-block-article|don-content)([\s\S]{0,8000})/i
    );
    const rawText = (bodyMatch ? bodyMatch[1] : html)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const { cases, deaths } = extractNumbers(rawText);
    const description = rawText.slice(0, 400);
    return { cases, deaths, description };
  } catch {
    return { cases: 0, deaths: 0, description: "" };
  }
}

// ── 3. Parse a WHO DON item → ParsedOutbreak ──────────────────

export async function parseWHODONItem(
  item: WHONewsItem,
  fetchBody = false
): Promise<ParsedOutbreak | null> {
  const { Title, ItemDefaultUrl, PublicationDateAndTime, Summary } = item;
  if (!Title) return null;

  // Title formats: "Mpox – DR Congo", "Disease Outbreak News: Cholera – Haiti"
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

  const articleUrl = ItemDefaultUrl?.startsWith("http")
    ? ItemDefaultUrl
    : `https://www.who.int${ItemDefaultUrl || ""}`;

  // Try to get numbers from Summary field first (API field, fast)
  let cases = 0;
  let deaths = 0;
  let description = "";

  if (Summary) {
    const plain = Summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const nums = extractNumbers(plain);
    cases = nums.cases;
    deaths = nums.deaths;
    description = plain.slice(0, 400);
  }

  // Fallback: fetch full article page for numbers (only for new entries)
  if (fetchBody && cases === 0 && ItemDefaultUrl) {
    const bodyData = await fetchArticleNumbers(ItemDefaultUrl);
    cases = bodyData.cases;
    deaths = bodyData.deaths;
    description = bodyData.description || description;
    await new Promise((r) => setTimeout(r, 150)); // polite delay
  }

  const risk_level = assessRisk(parsed.disease, description, cases, deaths);

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
    source: articleUrl,
    description,
    active: true,
  };
}
