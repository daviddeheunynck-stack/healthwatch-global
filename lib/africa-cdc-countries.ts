// Country detection for sync-africa-cdc.
//
// Extracted from app/api/cron/sync-africa-cdc/route.ts on 2026-07-21 so the
// matcher can be unit-tested in isolation (scripts/test-africa-cdc-country-match.ts)
// without importing the whole Next.js route. Pure functions only — no I/O.

import { COUNTRIES, isAggregateCountry } from "@/lib/geo-data";

// African country names. Excludes aggregate pseudo-countries ("Global",
// "Multi-country", "African Region"...) — they're tagged region:"africa" as a
// placeholder, not a real regional assignment, so left in they'd match
// boilerplate like "the global response to the Ebola outbreak" and become
// primaryCountry whenever mentioned before the real country, causing the
// aggregate-rejection guard in the route to discard the whole article instead
// of finding the real one. Found 2026-07-16.
const AFRICA_COUNTRIES = Object.entries(COUNTRIES)
  .filter(([, geo]) => geo.region === "africa" && !isAggregateCountry(geo))
  .map(([key]) => key);

// Abbreviations in Africa CDC RSS text → canonical country key
const AFRICA_TEXT_ALIASES: Record<string, string> = {
  " drc ":     "Democratic Republic of the Congo",
  "(drc)":     "Democratic Republic of the Congo",
  " rdc ":     "Democratic Republic of the Congo",
  " dr congo": "Democratic Republic of the Congo",
};

// Search terms (aliases + country keys) merged and sorted longest-first, once
// at module load. Longest-first is load-bearing for the masking pass below:
// every longer country name is consumed before any shorter name that is a
// substring of it.
interface CountryTerm {
  search:    string;   // lowercased needle to search for
  output:    string;   // COUNTRIES key (or alias target) returned to callers
  canonical: string;   // name_en — used to dedupe alias vs. full-name hits
}

const AFRICA_COUNTRY_TERMS: CountryTerm[] = [
  ...Object.entries(AFRICA_TEXT_ALIASES).map(([abbr, canonical]) => ({
    search:    abbr,
    output:    canonical,
    canonical: COUNTRIES[canonical]?.name_en ?? canonical,
  })),
  ...AFRICA_COUNTRIES.map((name) => ({
    search:    name.toLowerCase(),
    output:    name,
    canonical: COUNTRIES[name]!.name_en,
  })),
].sort((a, b) => b.search.length - a.search.length);

// Returns countries ordered by earliest position of first occurrence in the
// text, not by declaration order — callers take the first entry as "the primary
// country", which must mean "mentioned first in the article", not "whichever
// name happens to be declared first" (same class of bug fixed in
// sync-ecdc-threats, found 2026-07-15).
//
// Matching walks a MASKED copy of the text: each matched span is blanked
// (replaced with spaces of equal length, preserving offsets) before the next,
// shorter term is searched. Because terms are processed longest-first, a longer
// country name's span is consumed before any shorter name that is a substring
// of it can match inside it. This is what stops "Republic of the Congo"
// (name_en "Congo", RoC) from matching inside "Democratic Republic of the
// Congo" and mis-attributing a DRC-only article to RoC — the 2026-07-21
// Ebola/Congo phantom (id 0867397e). A raw indexOf pass could not: the DRC
// alias path and the RoC substring got independent positions, and the RoC
// substring — sitting earlier in the string ("democratic |republic of the
// congo|") — sorted first and became the primary country. The same guard also
// prevents Niger⊂Nigeria, Sudan⊂South Sudan and Guinea⊂Equatorial Guinea
// false-positives. Word-boundary matching would NOT fix this, since "republic
// of the congo" sits on word boundaries inside the longer name.
export function findMentionedAfricanCountries(text: string): string[] {
  let masked = ` ${text.toLowerCase()} `;
  const positions = new Map<string, number>();  // output string -> earliest index
  const seenKey   = new Map<string, string>();  // canonical name_en -> output string already recorded

  for (const term of AFRICA_COUNTRY_TERMS) {
    let idx = masked.indexOf(term.search);
    if (idx === -1) continue;

    if (!seenKey.has(term.canonical)) seenKey.set(term.canonical, term.output);
    const key  = seenKey.get(term.canonical)!;
    const prev = positions.get(key);
    if (prev === undefined || idx < prev) positions.set(key, idx);

    // Blank EVERY occurrence of this term, not just the first — otherwise a
    // repeated mention (e.g. "Democratic Republic of the Congo" named twice)
    // leaves the second instance unmasked, letting a shorter substring term
    // ("Congo" / Republic of Congo) re-match inside it later in the loop.
    while (idx !== -1) {
      masked = masked.slice(0, idx) + " ".repeat(term.search.length) + masked.slice(idx + term.search.length);
      idx = masked.indexOf(term.search, idx + term.search.length);
    }
  }

  return [...positions.keys()].sort((a, b) => positions.get(a)! - positions.get(b)!);
}
