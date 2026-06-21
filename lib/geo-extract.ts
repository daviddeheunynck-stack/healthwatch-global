/**
 * Sub-national location extraction from WHO DON bulletin text.
 *
 * Primary path: Claude Haiku LLM (when ANTHROPIC_API_KEY is set).
 * Fallback: regex patterns against WHO DON first-paragraph conventions:
 *   "...notified WHO of X cases in Kamituga Health Zone, South Kivu Province..."
 *   "...reported in North Kivu Province, DRC..."
 *   "...outbreak in the Aden Governorate..."
 *
 * Results are geocoded via Nominatim (OpenStreetMap, free, no API key required).
 */

import { extractAdmin1LLM } from "./geo-extract-llm";

// Match admin1-level location names from WHO DON bulletin prose.
// Ordered from most specific to most generic — first match wins.
const ADMIN1_PATTERNS = [
  // "in South Kivu Province"  /  "in the North Kivu Region"
  /\bin\s+(?:the\s+)?((?:[A-Z][a-zÀ-ž]+\s+){1,3}(?:Province|Region|State|District|Oblast|Governorate|County|Prefecture|Département|Wilaya|Emirate|Territory))\b/i,
  // "in Kamituga Health Zone"  /  "in the Bwera Health Sub-district"
  /\bin\s+(?:the\s+)?((?:[A-Z][a-zÀ-ž]+\s+){1,4}(?:Health\s+(?:Zone|District|Sub-district|Area|Region)))\b/i,
  // "in Aden Governorate"
  /\bin\s+(?:the\s+)?((?:[A-Z][a-zÀ-ž]+\s+){1,2}Governorate)\b/i,
  // "from North Kivu province"
  /\bfrom\s+(?:the\s+)?((?:[A-Z][a-zÀ-ž]+\s+){1,3}(?:Province|Region|State|District|Oblast|Governorate))\b/i,
  // "in Lagos State"  /  "in Équateur Province"
  /\bin\s+((?:[A-ZÀ-ž][a-zÀ-ž]+\s+){1,2}(?:State|Province|Region|District))\b/,
];

/**
 * Extract admin1 location name from WHO DON bulletin text.
 * Returns null when no reliable sub-national location can be detected.
 */
// Broad geographic terms that are NOT sub-national locations
const NOISE_TERMS = new Set([
  "the country", "the region", "the area", "the zone", "the district",
  "the americas region", "americas region",
  "the african region", "african region",
  "the eastern mediterranean region", "eastern mediterranean region",
  "the european region", "european region",
  "the south-east asia region", "south-east asia region",
  "the western pacific region", "western pacific region",
  "the region", "the state", "the province", "the district",
  "a region", "a province", "a state",
]);

export async function extractAdmin1(text: string, countryEn?: string): Promise<string | null> {
  if (!text || text.length < 30) return null;

  // LLM path: Claude Haiku gives ~65% hit rate vs ~8% for regex alone
  const llmResult = await extractAdmin1LLM(text, countryEn);
  if (llmResult) return llmResult;

  // Regex fallback (no API key, or Haiku returned null)
  for (const pattern of ADMIN1_PATTERNS) {
    const m = text.match(pattern);
    if (m?.[1]) {
      const raw = m[1].trim();
      const lower = raw.toLowerCase();
      if (NOISE_TERMS.has(lower)) continue;
      if (raw.length < 4 || raw.length > 60) continue;
      return raw;
    }
  }
  return null;
}

// Nominatim geocoding — OpenStreetMap free API, 1 req/sec max.
// Always sends a descriptive User-Agent as required by Nominatim policy.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "HealthWatch-Global/1.0 (contact@healthwatch-global.com; epidemic surveillance; see https://healthwatch-global.com)";

// In-process cache: avoid redundant calls within the same sync run.
const _geoCache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeAdmin1(
  admin1: string,
  countryEn: string
): Promise<{ lat: number; lng: number } | null> {
  const key = `${admin1}|${countryEn}`;
  if (_geoCache.has(key)) return _geoCache.get(key)!;

  try {
    // Multi-province strings (e.g. "South Kivu, North Kivu") can't geocode as-is — use first
    const primaryAdmin1 = admin1.split(/,|\s+and\s+/i)[0].trim();
    const url = new URL(NOMINATIM);
    url.searchParams.set("q", `${primaryAdmin1}, ${countryEn}`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "0");
    // Prefer admin boundaries over POIs
    url.searchParams.set("featuretype", "state");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) { _geoCache.set(key, null); return null; }

    const data = await res.json();
    if (!data[0]) { _geoCache.set(key, null); return null; }

    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    _geoCache.set(key, result);
    return result;
  } catch {
    _geoCache.set(key, null);
    return null;
  }
}
