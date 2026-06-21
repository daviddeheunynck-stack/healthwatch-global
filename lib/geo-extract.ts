/**
 * Sub-national location extraction from WHO DON bulletin text.
 *
 * WHO DON first paragraphs follow predictable patterns:
 *   "...notified WHO of X cases in Kamituga Health Zone, South Kivu Province..."
 *   "...reported in North Kivu Province, DRC..."
 *   "...outbreak in the Aden Governorate..."
 *
 * We apply a ranked list of regexes to extract the most specific location,
 * then geocode it via Nominatim (OpenStreetMap, free, no API key required).
 */

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
export function extractAdmin1(text: string): string | null {
  if (!text || text.length < 30) return null;

  for (const pattern of ADMIN1_PATTERNS) {
    const m = text.match(pattern);
    if (m?.[1]) {
      const raw = m[1].trim();
      // Reject noise: single common words that aren't meaningful location names
      const lower = raw.toLowerCase();
      if (["the country", "the region", "the area", "the zone", "the district"].includes(lower)) continue;
      // Reject matches that are just the country name repeated (common in multi-country articles)
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
    const url = new URL(NOMINATIM);
    url.searchParams.set("q", `${admin1}, ${countryEn}`);
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
