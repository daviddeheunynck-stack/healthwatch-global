// Fetcher coverage probe — is ANY cron ever going to look at this row again?
//
// Built 2026-09-03, closing a fix-queue entry from 2026-09-01 (itself tracing back to
// 2026-08-28): 11 African rows (Chad, Sudan, CAR, Somalia, South Sudan, Ethiopia, Niger,
// Togo, Mali, Angola, Madagascar) were created on 2026-08-22 with no fetcher or fallback
// targeting them at all. No freshness check caught it — freshness checks only measure the
// age of rows a cron already knows about, never whether a row is a target of any cron in
// the first place. The gap was found by a LinkedIn DM from a recipient, not by the product.
// The same-day fix (fetchPolioGPEIThisWeek, see project_polio_africa_cvdpv_auto_fetch_2026_08_28)
// covered the 13 polio rows specifically; this file covers the general condition.
//
// Two coverage mechanisms, matching how the sync-* crons actually work:
//
// 1. DOMAIN COVERAGE — a fixed-page/fixed-feed cron (WHO DON, Africa CDC, ECDC, PAHO, CDC
//    HAN/notices, UKHSA, WHO AFRO/EMRO, SPF, USDA APHIS, Taiwan CDC, Malaysia dengue, Samoa
//    dengue, check-mpox-sitrep) re-fetches the SAME url/feed every run and writes whatever
//    it finds there under that same domain. A row whose `source` cites that domain WILL be
//    re-examined on the cron's next run, whether or not that run finds anything new to write
//    — that is what "coverage" means for these. Substrings reuse the exact ownership-guard
//    strings already scattered through app/api/cron/*/route.ts (see e.g. sync-cdc-notices.ts
//    `.source?.includes("who.int/emergencies/disease-outbreak-news")`) rather than inventing
//    new ones, so this file can't quietly diverge from what the guards already treat as
//    canonical. Deliberately excludes: reliefweb.int (ingestion disabled repo-wide, see
//    legal_reliefweb_noncommercial), ncdc.gov.ng (sync-ncdc suspended 2026-09-02, see
//    legal_ncdc_nigeria_confidential_sitreps), and every domain in
//    lib/source-trust.ts's AUTHORITATIVE_SOURCE_DOMAINS that exists ONLY for trust-scoring a
//    manually-entered row (gov.br, mohfw.gov.in, moph.go.th, moh.go.tz, cidrap.umn.edu,
//    info.dengue.mat.br, …) — no cron in this repo ever re-fetches those, so listing them here
//    would silently hide exactly the kind of orphaned row this probe exists to surface.
//
// 2. TARGET-KEY COVERAGE — sync-who-regional and sync-wpro-dengue-update instead loop over a
//    fixed TARGETS: {disease_en, country_en}[] list and call a PER-TARGET fetcher (which may
//    itself hit any number of different API domains — GHO, xmart, ArcGIS, ECDC's WNV portal,
//    ReliefWeb-shaped listings, …). The row's `source` field ends up citing whatever domain
//    that particular fetcher happened to use, which has no fixed relationship to the cron
//    itself — so domain matching doesn't work here. Coverage instead means the row's
//    disease_en/country_en pair is a member of that cron's own TARGETS array. Both files
//    export their own `TARGET_KEYS` (derived from TARGETS, not hand-copied) specifically for
//    this probe to import — see the export next to each TARGETS array.
//
// Deliberately NOT modeled: check-wer-cholera doesn't re-fetch a fixed page for a fixed ROW —
// it checks for a new WHO Weekly Epidemiological Record edition and, on a match, EMAILS David
// rather than writing to `outbreaks` itself (confirmed 2026-09-03: no `.update()`/`.upsert()`
// call anywhere in that route). Cholera rows whose figures come from a WER edition are
// therefore correctly reported as uncovered below — there genuinely is no cron that writes
// them, only a human-in-the-loop nudge, which is exactly the "who refreshes this?" gap this
// probe exists to surface, not a false positive to suppress. sync-pacific-surveillance is
// deliberately not modeled either, for the same reason noted next to the who.int/westernpacific
// domain entry above: it doesn't write the country-level case-count rows this probe is about.
// sync-drc-sitrep is excluded outright: its discovery step was disabled for legal reasons in
// 2026 (ReliefWeb ToS, see the file's own comment) and unconditionally returns null, so it
// contributes no coverage today regardless.
//
// This probe's job is to prompt a manual look (see the fix-queue entry's own "journalise le
// résultat, ne tranche rien"), not to auto-correct anything — an occasional false positive a
// human clears in five seconds is a far cheaper mistake than silently missing a real orphan
// the way the 2026-08-22 incident did.

import { TARGET_KEYS as WHO_REGIONAL_TARGET_KEYS } from "@/app/api/cron/sync-who-regional/route";
import { TARGET_KEYS as WPRO_DENGUE_TARGET_KEYS } from "@/app/api/cron/sync-wpro-dengue-update/route";

export const TARGET_COVERED_KEYS: ReadonlySet<string> = new Set([
  ...WHO_REGIONAL_TARGET_KEYS,
  ...WPRO_DENGUE_TARGET_KEYS,
]);

// { substring to match against outbreaks.source, cron name for the report }.
export const DYNAMIC_COVERAGE_DOMAINS: ReadonlyArray<{ substring: string; cron: string }> = [
  { substring: "who.int/emergencies/disease-outbreak-news", cron: "sync-outbreaks (WHO DON)" },
  { substring: "afro.who.int",                              cron: "sync-who-afro" },
  { substring: "emro.who.int",                              cron: "sync-who-emro" },
  { substring: "africacdc.org",                              cron: "sync-africa-cdc" },
  { substring: "ecdc.europa.eu",                             cron: "sync-ecdc-threats" },
  { substring: "paho.org",                                   cron: "sync-paho-alerts" },
  // Exact hostnames, not a bare "cdc.gov" substring — cdc.gov.tw/cdc.gov.au/ncdc.gov.ng all
  // contain "cdc.gov" too (same collision lib/source-trust.ts's sourceName() calls out).
  { substring: "wcmssearch.cdc.gov",                         cron: "sync-cdc-han" },
  { substring: "wwwnc.cdc.gov",                              cron: "sync-cdc-notices" },
  { substring: "cdc.gov.tw",                                 cron: "sync-taiwan-cdc" },
  { substring: "gov.uk",                                     cron: "sync-ukhsa" },
  { substring: "santepubliquefrance.fr",                     cron: "sync-spf" },
  { substring: "aphis.usda.gov",                             cron: "sync-usda-aphis" },
  { substring: "mysa.gov.my",                                cron: "sync-malaysia-dengue" },
  { substring: "health.gov.ws",                              cron: "sync-samoa-dengue" },
  // NOT sync-pacific-surveillance: that cron parses a syndromic (ILI/DLI) surveillance table
  // and never writes country-level dengue case counts itself (confirmed 2026-09-03 — it only
  // reads existing active dengue rows to decide whether to raise a signal). Wallis & Futuna /
  // Marshall Islands / Vanuatu / American Samoa dengue rows sourced from spc.int are therefore
  // correctly reported as uncovered below, not a bug in this file. Kept for
  // sync-wpro-dengue-update defense-in-depth only: harmless overlap with its TARGET_KEYS
  // coverage today, in case a future TARGETS-less row it discovers cites this path.
  { substring: "who.int/westernpacific",                     cron: "sync-wpro-dengue-update" },
  // check-mpox-sitrep re-fetches the same WHO mpox situation page every run and updates the
  // one Mpox/Global aggregate row with whatever sitrep it finds linked there — same "always
  // re-checked" shape as the crons above, just a single row instead of a whole feed. Confirmed
  // against the row's actual `source` value in production 2026-09-03.
  { substring: "who.int/publications/m/item/multi-country-outbreak-of-mpox", cron: "check-mpox-sitrep" },
];

export interface CoverageResult {
  covered: boolean;
  via?: string; // cron name (domain match) or "TARGETS" (key match), for the report
}

export function checkFetcherCoverage(
  source: string | null | undefined,
  diseaseEn: string | null | undefined,
  countryEn: string | null | undefined,
): CoverageResult {
  const src = source ?? "";
  for (const { substring, cron } of DYNAMIC_COVERAGE_DOMAINS) {
    if (src.includes(substring)) return { covered: true, via: cron };
  }
  if (diseaseEn && countryEn) {
    const key = `${diseaseEn.toLowerCase()}|${countryEn.toLowerCase()}`;
    if (TARGET_COVERED_KEYS.has(key)) return { covered: true, via: "TARGETS" };
  }
  return { covered: false };
}
