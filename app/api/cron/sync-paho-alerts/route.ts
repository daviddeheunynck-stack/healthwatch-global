// PAHO scraper — runs daily at 09:30 UTC (see vercel.json: "30 9 * * *"; the
// old "every Tuesday" comment here predated this file and was stale). Two
// independent sources:
//
//   1. Epidemiological alerts and updates (/en/epidemiological-alerts-and-updates)
//   2. Measles situation reports (/en/situation-reports)
//
// Both feed outbreaks. Covers Americas-specific threats not systematically
// captured by WHO DON or ReliefWeb.
//
// The two listings share no links: an alert is never republished as a sitrep and
// vice versa. Scraping only the alerts page (the behaviour until 2026-07-15)
// meant no PAHO situation report was ever ingested, so the Americas measles
// picture was limited to the countries that happen to get their own alert —
// Guatemala (the region's heaviest death toll) and Peru (its only accelerating
// outbreak) appear ONLY in the sitrep table and were absent from the DB
// entirely, while Mexico silently froze on the 29 May alert between sitreps.
//
// Alert rows never overwrite rows owned by the WHO DON daily sync; sitrep rows
// may, but only when the sitrep is at least as recent (see upsertItems).
//
// PAHO is WHO's own Regional Office for the Americas, so this cron can write
// onto rows locked at source_priority=10 (ceiling raised 2026-08-19 alongside
// sync-who-afro/emro — see project_source_priority_is_ownership_not_freeze_
// 2026_08_19). Additional lockedRowRegressionGuard refuses any decrease on a
// locked row. The Measles-sitrep DEACTIVATION sweep below is untouched —
// still capped at 5, since automatically retiring a locked row is a different
// and more destructive action than refreshing its figures.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry, isAggregateCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { extractAdmin1, geocodeAdmin1 } from "@/lib/geo-extract";
import { errorMessage } from "@/lib/error";
import { translateDescription } from "@/lib/translate";
import { regressionGuard, lockedRowRegressionGuard } from "@/lib/outbreak-guards";
import { truncateAtSentence } from "@/lib/truncate-text";

export const dynamic = "force-dynamic";
// Alerts + a 14-page sitrep PDF, then up to 6 countries × (4 translation calls
// + Haiku admin1 extraction + rate-limited geocoding). The 60s this route used
// to declare no longer covers that, and the route's own export beats the 300
// in vercel.json — a stale value here is a 504, not a fallback.
export const maxDuration = 300;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const PAHO_BASE       = "https://www.paho.org";
const PAHO_ALERT_URL  = "https://www.paho.org/en/epidemiological-alerts-and-updates";
const PAHO_SITREP_URL = "https://www.paho.org/en/situation-reports";
const MAX_AGE_DAYS    = 45;
// Sitreps run fortnightly. 90 days tolerates a few skipped editions while still
// refusing to resurrect a long-abandoned report as if it were current.
const SITREP_MAX_AGE_DAYS = 90;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
  jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
};

// Americas country names sorted longest-first to avoid prefix collisions.
// Excludes aggregate pseudo-countries ("Americas region" etc.) for the same reason
// AMERICAS_SITREP_KEYS below does: a PAHO alert mentioning the region as an adjective
// (not a place) must not spawn a phantom "Americas (regional)" outbreak row.
const AMERICAS_COUNTRIES = Object.entries(COUNTRIES)
  .filter(([, geo]) => geo.region === "americas" && !isAggregateCountry(geo))
  .map(([key]) => key)
  .sort((a, b) => b.length - a.length);

// ── Helpers ───────────────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// PAHO's current "/en/documents/..." template has NO real article text in the
// HTML at all when there's no PDF — even the page's "field--name-body" class
// is reused by an unrelated search-icon widget, so there's no content
// container to scope htmlToText() to the way CDC/WHO DON pages have. If the
// PDF path fails, the only signal available is whether the raw page text
// matches known PAHO site chrome (nav/account-menu/library links) rather
// than real alert prose.
const PAHO_CHROME_MARKERS = [
  /user account menu/i, /digital health library/i, /virtual health library/i,
  /virtual campus for public health/i, /log in\s*english/i,
];
function looksLikePahoChrome(text: string): boolean {
  return PAHO_CHROME_MARKERS.some((re) => re.test(text.slice(0, 600)));
}

function parsePAHODate(text: string): string | null {
  // "24 June 2026" / "24 Jun 2026"
  const verbal = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+(\d{4})\b/i);
  if (verbal) {
    const day = verbal[1].padStart(2, "0");
    const mon = MONTHS[verbal[2].toLowerCase().substring(0, 3)];
    return mon ? `${verbal[3]}-${mon}-${day}` : null;
  }
  // ISO: "2026-06-24"
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

function findMentionedAmericasCountries(text: string): string[] {
  const lower  = text.toLowerCase();
  const found: string[] = [];
  const seen   = new Set<string>();
  for (const name of AMERICAS_COUNTRIES) {
    const geo = COUNTRIES[name];
    if (!geo) continue;
    if (seen.has(geo.name_en)) continue;
    if (lower.includes(name.toLowerCase())) {
      found.push(name);
      seen.add(geo.name_en);
    }
  }
  return found;
}

// ── Per-country figure extraction (regional bulletins) ─────────────────────────
// PAHO's regional alerts ("Diphtheria in the Americas Region", "Measles in the
// Americas Region"...) report one aggregate country list per alert, e.g.:
//   "reported between three countries: Brazil (n= 2 cases), Haiti (n= 159
//   cases, including five deaths), and Peru (n= 2 cases)"
// A naive "any country name in the first 2500 chars" scan picks up incidental
// mentions from footnotes (vaccination-coverage lists, etc.) rather than the
// actually-affected country, and the regional total (not a single country's
// share) for cases/deaths. Parse the "(n= X cases[, including Y deaths])"
// idiom directly so each country gets its own figures.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WORDS_TO_NUM: Record<string, number> = {
  zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,
  seventeen:17,eighteen:18,nineteen:19,twenty:20,
};
function wordOrNum(s: string): number {
  const n = parseInt(s.replace(/[\s,]/g, ""), 10);
  if (!isNaN(n)) return n;
  return WORDS_TO_NUM[s.toLowerCase().trim()] ?? 0;
}

// Isolate the current-year summary paragraph: from the "Summary of the
// situation" heading (if present) up to the SECOND "In 20YY," year marker.
// The first marker opens the current-year sentence; the second opens the
// year-over-year comparison paragraph, which restates the same country list
// with the prior year's (stale) figures — without this cutoff, a country
// absent this year but present last year would resolve to last year's count.
function currentYearBlock(text: string): string {
  const headingIdx = text.search(/summary of the situation/i);
  const rest = text.slice(headingIdx >= 0 ? headingIdx : 0);
  const yearRe = /\bIn\s+20\d{2},/g;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = yearRe.exec(rest)) !== null) {
    if (++count === 2) return rest.slice(0, m.index);
  }
  return rest;
}

interface CountryFigure { country: string; cases: number; deaths: number }

function extractCountryFigures(text: string): CountryFigure[] {
  const block   = currentYearBlock(text);
  const results: CountryFigure[] = [];
  const seen    = new Set<string>();
  for (const name of AMERICAS_COUNTRIES) {
    const geo = COUNTRIES[name];
    if (!geo || seen.has(geo.name_en)) continue;
    const re = new RegExp(
      escapeRegExp(name) + "\\s*\\(n\\s*=?\\s*([\\d,]+)\\s*cases?(?:,?\\s*including\\s*([\\w,]+)\\s*deaths?)?\\)",
      "i",
    );
    const m = re.exec(block);
    if (!m) continue;
    const cases = parseInt(m[1].replace(/,/g, ""), 10);
    if (isNaN(cases)) continue;
    results.push({ country: name, cases, deaths: m[2] ? wordOrNum(m[2]) : 0 });
    seen.add(geo.name_en);
  }
  return results.sort((a, b) => b.cases - a.cases);
}

// ── Measles situation reports ─────────────────────────────────────────────────
// The fortnightly "Situation Report: Measles in the Americas Region" carries a
// per-country table (cases, deaths, trend, classification, notes) plus a
// model-based Rt table. It is the only place PAHO publishes figures for
// countries that never get their own alert, so it — not the alerts page — is
// what keeps the regional measles picture complete and current.

// Same as AMERICAS_COUNTRIES but without the aggregate pseudo-entries ("Region
// of the Americas" → "Americas (regional)"). A sitrep is a regional document
// whose every page reads "Measles in the Americas Region", so leaving the
// aggregate in would invite a phantom region-wide row that no table row backs.
const AMERICAS_SITREP_KEYS = Object.entries(COUNTRIES)
  .filter(([, geo]) => geo.region === "americas" && !isAggregateCountry(geo))
  .map(([key]) => key)
  .sort((a, b) => b.length - a.length);

// Anchor on the heading TEXT, never the table number: the cases table is
// Table 2 in sitreps #3–#4 and Table 3 from #5 on, and "Table 3." also occurs
// mid-sentence in #4's prose. The heading also carries the "as of EW N" that
// dates the figures.
const SITREP_CASES_HEAD = /Table\s*\d+\s*\.\s*Measles\s+cases\s+in\s+the\s+Region\s+of\s+the\s+Americas\s+by\s+country\s*,?\s*as\s+of\s+EW\s*(\d+)\s*,?\s*(\d{4})/i;
const SITREP_RT_HEAD    = /Table\s*\d+\s*\.\s*Model-?based\s+estimates/i;
const SITREP_BLOCK_END  = [/Table\s*\d+\s*\.\s*Model-?based/i, /\*\s*Countries\s+with\s+active\s+outbreaks/i];

// The classification column has a closed vocabulary, which makes it a reliable
// separator between the trend cell and the free-text notes cell.
const SITREP_CLASSIFICATION = /(Sustained\s+elimination(?:\s+with\s+major\s+concerns)?|Endemic)/i;
const SITREP_TREND_WORD     = /^(declining|increasing|stabilizing|plateau|stable)$/i;

// Page furniture and footnotes that trail a country's notes cell once the table
// is linearized into a single text run.
const SITREP_NOTE_CUT = [
  /PAHO\/WHO\s+Regional\s+Situation\s+Report/i,
  /www\.paho\.org/i,
  /Trends\s+in\s+\w+\s+should\s+be\s+interpreted/i,
  /Probable\s+case\s+definition/i,
  /Other\s*\(/i,
  /Country\s+Cases\s+\d{4}/i,
  /\*\s*Countries\s+with\s+active\s+outbreaks/i,
];

function tidyCell(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/([a-z])-\s+([a-z])/g, "$1-$2")   // rejoin PDF line-break hyphenation
    .replace(/([.)])\s*\d{1,2}\s*$/, "$1")     // drop a trailing footnote marker
    .replace(/^[\s—–\-↓↑~≈*.,;]+/, "")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

interface SitrepCells { trend: string; classification: string; notes: string }

function splitSitrepCells(raw: string): SitrepCells {
  let s = raw;
  for (const re of SITREP_NOTE_CUT) {
    const m = re.exec(s);
    if (m) s = s.slice(0, m.index);
  }
  const c = SITREP_CLASSIFICATION.exec(s);
  if (!c) return { trend: "", classification: "", notes: tidyCell(s) };
  return {
    trend:          tidyCell(s.slice(0, c.index)),
    classification: tidyCell(c[0]).replace(/\s+/g, " "),
    notes:          tidyCell(s.slice(c.index + c[0].length)),
  };
}

// PAHO/WHO epidemiological weeks run Sunday–Saturday, with EW 1 the week
// containing 4 January. The table reports "as of EW N", so the figures date to
// that week's Saturday — NOT the report's publication date, which lags by
// several days and would overstate freshness against other sources.
// Verified: EW 25 2026 → 2026-06-27, matching the figures PAHO labels EW 25.
function epiWeekEndDate(year: number, ew: number): string {
  const jan4     = new Date(Date.UTC(year, 0, 4));
  const firstSat = new Date(jan4);
  firstSat.setUTCDate(jan4.getUTCDate() + (6 - jan4.getUTCDay()));
  const end = new Date(firstSat);
  end.setUTCDate(firstSat.getUTCDate() + (ew - 1) * 7);
  return end.toISOString().substring(0, 10);
}

interface SitrepRow extends SitrepCells {
  country: string;
  active:  boolean;  // PAHO's own "*" = outbreak running 12+ weeks
  cases:   number;
  deaths:  number;
  at:      number;
  endAt:   number;
}

interface SitrepTable { ew: number; year: number; date: string; rows: SitrepRow[] }

function parseSitrepCases(text: string, log?: LogEntry[]): SitrepTable | null {
  const h = SITREP_CASES_HEAD.exec(text);
  if (!h) return null;

  const start = h.index + h[0].length;
  let end = text.length;
  for (const re of SITREP_BLOCK_END) {
    const m = re.exec(text.slice(start));
    if (m) end = Math.min(end, start + m.index);
  }
  const block = text.slice(start, end).replace(/\s+/g, " ");

  const rows: SitrepRow[] = [];
  const seen = new Set<string>();
  for (const name of AMERICAS_SITREP_KEYS) {
    const geo = COUNTRIES[name];
    if (!geo || seen.has(geo.name_en)) continue;
    // "Mexico* 11,820 16" — name, optional active marker, optional footnote
    // marker, cases, deaths. Both footnote groups are optional-and-greedy: each
    // only survives when the numbers that follow still add up, so a plain
    // "Costa Rica 5 0" backtracks to cases=5/deaths=0 rather than eating either
    // 5 as a marker.
    // The second (post-cases) footnote group exists because a footnote can also
    // attach to the CASES figure itself — sitrep #7's Table 3 renders
    // Guatemala's case-definition footnote as "27,145 4 26" once pdf-parse
    // linearizes the superscript "⁴" into its own space-separated digit. Without
    // this group, deaths captured that stray "4" instead of the real "26" (found
    // 2026-08-01, live for 3+ weeks — Guatemala is HWG's highest-death-toll
    // measles row, undercounted 26→4, a ~6.5x miss). Mexico/Bolivia/etc. have no
    // footnote here, so this group simply doesn't match for them and the deaths
    // capture falls through to the real number unchanged — verified for all 6
    // countries in sitrep #7 before this shipped.
    //
    // Both footnote groups are now CAPTURING (not just optional) so a leading
    // one can be detected below. A row with a leading footnote digit is
    // structurally ambiguous whenever the table has exactly 2 real data
    // columns and 3 raw numbers appear (footnote+cases+deaths vs. some other
    // reading) — there is no way to tell which from the text alone without
    // the document's own footnote legend, and guessing differently here would
    // only trade the verified-correct Guatemala case for an unverified one
    // (see known-findings.json,
    // sync-paho-alerts::parsing::regex-ambiguity-on-three-number-rows).
    // Rather than silently pick a reading, log it so a human checks the raw
    // row — turning a silent wrong number into a visible one, same principle
    // as every guard in lib/outbreak-guards.ts.
    const re = new RegExp(
      escapeRegExp(name).replace(/\s+/g, "\\s+") + "\\s*(\\*?)\\s*(\\d{1,2}\\s+)?([\\d,]+)\\s+(?:\\d{1,2}\\s+)?(\\d+)(?![\\d,])",
      "i",
    );
    const m = re.exec(block);
    if (!m) continue;
    const cases = parseInt(m[3].replace(/,/g, ""), 10);
    if (isNaN(cases)) continue;
    if (m[2] && log) {
      log.push({
        label:  `Measles/${name}`,
        status: "warn",
        detail: `leading footnote digit "${m[2].trim()}" consumed before cases=${cases} — ambiguous 3-number row, verify against the source PDF: "${m[0].trim()}"`,
      });
    }
    rows.push({
      country: name, active: m[1] === "*", cases, deaths: parseInt(m[4], 10),
      at: m.index, endAt: m.index + m[0].length,
      trend: "", classification: "", notes: "",
    });
    seen.add(geo.name_en);
  }

  rows.sort((a, b) => a.at - b.at);
  // A country's cells run from its own match to the next country's match.
  for (let i = 0; i < rows.length; i++) {
    const slice = block.slice(rows[i].endAt, i + 1 < rows.length ? rows[i + 1].at : undefined);
    Object.assign(rows[i], splitSitrepCells(slice.slice(0, 450)));
  }
  return { ew: parseInt(h[1], 10), year: parseInt(h[2], 10), date: epiWeekEndDate(+h[2], +h[1]), rows };
}

interface RtEstimate { rt: string; lo: string; hi: string; trend: string }

function parseSitrepRt(text: string): Map<string, RtEstimate> {
  const out = new Map<string, RtEstimate>();
  const h = SITREP_RT_HEAD.exec(text);
  if (!h) return out;
  const block = text.slice(h.index).replace(/\s+/g, " ");
  for (const name of AMERICAS_SITREP_KEYS) {
    // "Peru 6 1.35 [1.23 – 1.47] ↑ increasing" — the optional digit is a
    // footnote marker (present on Peru in sitrep #5); Rt always carries a
    // decimal point, so the two can't be confused.
    const re = new RegExp(
      escapeRegExp(name).replace(/\s+/g, "\\s+") +
        "\\s*(?:\\d{1,2}\\s+)?(\\d\\.\\d{1,2})\\s*\\[\\s*(\\d\\.\\d{1,2})\\s*[–\\-]\\s*(\\d\\.\\d{1,2})\\s*\\]\\s*[↑↓~≈]?\\s*(increasing|declining|stabilizing)?",
      "i",
    );
    const m = re.exec(block);
    if (m) out.set(name, { rt: m[1], lo: m[2], hi: m[3], trend: (m[4] ?? "").toLowerCase() });
  }
  return out;
}

// MyMemory refuses any query over 500 characters — it answers HTTP 200 with an
// in-body 403, which translateDescription correctly discards, leaving
// description_fr/es/ar/id NULL. A 600-char description therefore ships
// untranslated in all four locales: the very drift this cron is meant to own.
// Cut to the last sentence that fits instead.
const SITREP_DESC_MAX = 490;

function fitForTranslation(s: string): string {
  if (s.length <= SITREP_DESC_MAX) return s;
  const cut  = s.slice(0, SITREP_DESC_MAX);
  const stop = cut.lastIndexOf(". ");
  if (stop > 200) return cut.slice(0, stop + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 200 ? cut.slice(0, space) : cut).trim() + "…";
}

function buildSitrepDescription(num: number, t: SitrepTable, row: SitrepRow, rt: RtEstimate | undefined, admin1: string | null): string {
  const parts = [
    // "EW 25" spelled out: MyMemory reorders the bare abbreviation into
    // "25 EW 2026" in French.
    `PAHO Situation Report #${num}: Measles in the Americas Region (data as of epidemiological week ${t.ew}, ${t.year}).`,
    `${row.country}: ${row.cases.toLocaleString("en-US")} cases, ${row.deaths} deaths.`,
  ];
  if (row.classification) parts.push(`PAHO classification: ${row.classification}.`);
  const isTrend = SITREP_TREND_WORD.test(row.trend);
  if (isTrend) parts.push(`Observed 4-week trend: ${row.trend.toLowerCase()}.`);
  // Keep the observed trend and the model estimate explicitly attributed: they
  // legitimately disagree (Peru, sitrep #6: observed counts declining, Rt 1.35
  // increasing once nowcasting corrects for reporting delay). Stating them
  // unlabelled and side by side would read as a contradiction.
  if (rt) parts.push(`Model-based Rt ${rt.rt} (95% CrI ${rt.lo}–${rt.hi})${rt.trend ? `, ${rt.trend}` : ""}.`);
  // A trend cell that isn't one of the standard words is descriptive prose
  // (Bolivia's "drop by drop transmission", Guatemala's lab-confirmed-only
  // caveat) — keep it with the notes rather than labelling it a trend.
  const tail = [isTrend ? "" : row.trend, row.notes].filter(Boolean).join(". ");
  if (tail) parts.push(tail.replace(/\.\s*\./g, "."));
  const fitted = fitForTranslation(parts.join(" ").trim());
  // extractAdmin1 (call site) runs against the untruncated row.notes, so for a
  // country whose notes cell is long enough that the geographic-detail sentence
  // arrives late, the 490-char cap above can truncate it out of `fitted` even
  // though it's what grounded admin1 in the first place — e.g. Guatemala sitrep
  // #8: "...all 22 departments." survived the cut, but the following sentence
  // naming Izabal as the highest-incidence department didn't, leaving a
  // correctly-extracted admin1 looking ungrounded to anyone just reading the
  // stored description (and to data-quality's [ADMIN1?] check). Append a short
  // clause rather than reworking the cap, so the two fields stay consistent.
  // Found 2026-08-02.
  if (admin1 && !fitted.toLowerCase().includes(admin1.toLowerCase())) {
    return `${fitted} Highest-burden area: ${admin1}.`;
  }
  return fitted;
}

// ── Listing page parser ───────────────────────────────────────────────────────

interface AlertEntry {
  url:   string;
  title: string;
  date:  string;  // YYYY-MM-DD
}

function parseListing(html: string): AlertEntry[] {
  const entries: AlertEntry[] = [];
  const seen    = new Set<string>();
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // PAHO alert links are relative paths like /en/epidemiological-alerts-and-updates/...
  // or /es/... (Spanish) — we only want EN paths
  const linkRe = /<a\s[^>]*href="(\/en\/[^"]*(?:epidemiological-alert|epidemiological-update|epi-alert|epi-update)[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(html)) !== null) {
    const relPath = m[1];
    const title   = m[2].trim();
    if (seen.has(relPath) || !title) continue;
    seen.add(relPath);

    const window  = html.substring(Math.max(0, m.index - 400), m.index + 400);
    const dateStr = parsePAHODate(window);
    if (!dateStr) continue;

    const alertDate = new Date(dateStr);
    if (isNaN(alertDate.getTime()) || alertDate < cutoff) continue;

    entries.push({ url: PAHO_BASE + relPath, title, date: dateStr });
  }

  return entries;
}

// ── Individual alert page ─────────────────────────────────────────────────────

interface AlertData {
  disease_en:  string;
  country_en:  string;
  cases:       number;
  deaths:      number;
  source:      string;
  description: string;
  date:        string;
  admin1:      string | null;
  admin1_lat:  number | null;
  admin1_lng:  number | null;
  // Set for rows built from a situation report's per-country table. These get
  // two rules the one-off alert pages don't earn — see upsertItems().
  fromSitrep?: boolean;
  // Set when this row's cases/deaths is a shared document-level figure split
  // across multiple mentioned countries with no per-country structural anchor
  // (tier 3 in extractAlertData below) — upsertItems() refuses to INSERT a
  // brand-new row on this kind of guess, same guard as sync-ecdc-threats.
  ambiguous?: boolean;
}

async function extractAlertData(entry: AlertEntry): Promise<AlertData[]> {
  // Disease from title: strip "Epidemiological Alert:" / "Epidemiological Update:" prefix
  const titleCore = entry.title
    .replace(/^epidemiological\s+(?:alert|update)\s*:?\s*/i, "")
    .replace(/\s*-\s*\d+.*$/, "")           // strip trailing " - 24 June 2026"
    .replace(/\s+in\s+the\s+Region.*/i, "") // strip "in the Region of the Americas"
    .replace(/\s+in\s+.+$/i, "")            // strip "in Country"
    .trim();

  if (!isKnownDisease(titleCore)) return [];
  const diseaseInfo = normalizeDisease(titleCore);

  // Fetch the individual alert page
  let html: string;
  try {
    const res = await fetch(entry.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    html = await res.text();
  } catch (e) {
    console.warn("[paho] fetch alert:", errorMessage(e));
    return [];
  }

  // PAHO's /en/documents/... pages are now thin landing pages (nav chrome +
  // a one-paragraph generic teaser, no country names) that link out to the
  // actual alert as a PDF — e.g. "Given the emergence of new cases in some
  // countries of the Region" with the real country/case detail only in the
  // linked PDF. Fetch and parse it when present; fall back to the HTML body
  // text for any alert page that still publishes inline (older format).
  let pdfText = "";
  const pdfHref = html.match(/href="([^"]+\.pdf)"/i)?.[1];
  if (pdfHref) {
    const pdfUrl = pdfHref.startsWith("http") ? pdfHref : PAHO_BASE + pdfHref;
    try {
      const pdfRes = await fetch(pdfUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
      if (pdfRes.ok) {
        const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
          (buf: Buffer, opts?: object) => Promise<{ text: string }>;
        const { text } = await pdfParse(Buffer.from(await pdfRes.arrayBuffer()), { max: 5 });
        pdfText = text;
      }
    } catch (e) {
      console.warn("[paho] fetch/parse PDF:", errorMessage(e));
    }
  }

  const bodyText = pdfText.trim().length > 200 ? pdfText : htmlToText(html);

  // No usable PDF text and the HTML fallback is just page chrome (thin
  // "documents" landing page with no inline content, or a fetch/parse
  // failure) — there's nothing real to extract. Skip rather than store
  // chrome text as the description, same principle as the 0/0-cases guard
  // further down.
  if (pdfText.trim().length <= 200 && looksLikePahoChrome(bodyText)) return [];

  const { cases: docCases, deaths: docDeaths } = extractNumbers(bodyText);

  // Countries to write, each carrying its own cases/deaths. Tier 2 (structured
  // per-country breakdown) gives every country a real, individual figure —
  // previously only the most-affected country (figures[0]) was kept and the
  // rest silently dropped even though extractCountryFigures had already
  // individualized them (e.g. a diphtheria alert naming Brazil/Haiti/Peru only
  // ever produced a row for Haiti). Tiers 1 and 3 have at most one real figure
  // for the whole document, so every country in those tiers necessarily shares
  // it — tier 3's `ambiguous` flag tells upsertItems() not to blind-insert on
  // that shared, unanchored figure.
  interface CountryTarget { country: string; cases: number; deaths: number; ambiguous: boolean }
  let targets: CountryTarget[] = [];

  // Tier 1: look in the ORIGINAL title for "in [the] Country" pattern.
  // Optional "the" handles "in the Democratic Republic of the Congo and Uganda".
  const titleInMatch = entry.title.match(/\bin\s+(?:the\s+)?([A-Z][a-zA-Z\s,]+?)(?:\s*[-–—]|$)/i);
  if (titleInMatch) {
    const candidate = titleInMatch[1].replace(/\s+(and|or)\s+.+$/i, "").trim();
    // exclude generic phrases
    if (!/(region|americas|caribbean|paho)/i.test(candidate)) {
      const geo = findCountry(candidate);
      if (geo) targets = [{ country: candidate, cases: docCases, deaths: docDeaths, ambiguous: false }];
    }
  }

  // Tier 2: regional alerts ("Diphtheria in the Americas Region") — parse the
  // per-country "(n= X cases[, including Y deaths])" breakdown. Each entry
  // already has its own anchored figure, so all of them are kept.
  if (targets.length === 0) {
    const figures = extractCountryFigures(bodyText);
    if (figures.length > 0) {
      targets = figures.map((f) => ({ country: f.country, cases: f.cases, deaths: f.deaths, ambiguous: false }));
    }
  }

  // Tier 3: last-resort fallback — any Americas country name in the first
  // 2500 chars, paired with the document-wide totals (used only if the
  // structured per-country breakdown above isn't present). No structural
  // anchor ties a specific figure to a specific country here, so mark these
  // ambiguous when more than one country is found.
  if (targets.length === 0) {
    const intro     = bodyText.substring(0, 2500);
    const names     = findMentionedAmericasCountries(intro).slice(0, 3);
    const ambiguous = names.length > 1;
    targets = names.map((n) => ({ country: n, cases: docCases, deaths: docDeaths, ambiguous }));
  }

  if (targets.length === 0) return [];

  // PDF text starts with a "Suggested citation: ..." boilerplate block before
  // the actual situation summary — skip past it so the stored description is
  // the substantive text, not a citation line.
  const description = truncateAtSentence(
    (pdfText.trim().length > 200 ? currentYearBlock(bodyText) : bodyText).trim(),
    500
  );

  const results: AlertData[] = [];
  for (const target of targets) {
    const geo = findCountry(target.country);
    if (!geo) continue;

    const admin1 = await extractAdmin1(bodyText.substring(0, 3000), geo.name_en);
    let admin1_lat: number | null = null;
    let admin1_lng: number | null = null;
    if (admin1) {
      const coords = await geocodeAdmin1(admin1, geo.name_en);
      if (coords) { admin1_lat = coords.lat; admin1_lng = coords.lng; }
      await new Promise((r) => setTimeout(r, 1100));
    }

    results.push({
      disease_en:  diseaseInfo.name_en,
      country_en:  geo.name_en,
      cases:       target.cases,
      deaths:      target.deaths,
      source:      entry.url,
      description: truncateAtSentence(`PAHO ${entry.title}. ${description}`, 600),
      date:        entry.date,
      admin1,
      admin1_lat,
      admin1_lng,
      ambiguous:   target.ambiguous,
    });
  }
  return results;
}

// ── Shared upsert ─────────────────────────────────────────────────────────────

type LogEntry = { label: string; status: string; detail?: string };

interface SyncResults {
  alerts: number; sitrepRows: number;
  inserted: number; updated: number; skipped: number; errors: number; deactivated: number;
}

interface ExistingRow {
  id: string;
  disease_en: string | null;
  country_en: string | null;
  cases: number;
  deaths: number;
  date: string;
  source: string | null;
  active: boolean;
  source_priority: number | null;
}

const WHO_DON_SOURCE = "who.int/emergencies/disease-outbreak-news";

const dcKey = (disease: string | null, country: string | null) =>
  `${(disease ?? "").toLowerCase()}|${(country ?? "").toLowerCase()}`;

function indexRow(byDC: Map<string, ExistingRow>, row: ExistingRow): void {
  const k    = dcKey(row.disease_en, row.country_en);
  const prev = byDC.get(k);
  if (!prev || (row.active && !prev.active)) byDC.set(k, row);
}

// The dedup snapshot in GET loads active rows plus anything dated within 90
// days. A row that fell inactive BEFORE that window is invisible to it, and an
// unseen row is upserted as an insert — a duplicate, not an update. Canada's
// measles row is exactly that: inactive and frozen at 2026-03-01, so the first
// sitrep run created a second Canada row alongside the stale one. Look the
// targeted rows up explicitly before writing them.
async function loadExistingForItems(
  supabase: SupabaseClient,
  byDC: Map<string, ExistingRow>,
  items: AlertData[],
): Promise<void> {
  const missing = items.filter((i) => !byDC.has(dcKey(i.disease_en, i.country_en)));
  if (missing.length === 0) return;

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, source_priority")
    .in("disease_en",  [...new Set(missing.map((i) => i.disease_en))])
    .in("country_en", [...new Set(missing.map((i) => i.country_en))]);

  if (error) {
    console.warn("[paho] dedup lookup:", error.message);
    return;
  }
  for (const row of (data ?? []) as ExistingRow[]) indexRow(byDC, row);
}

async function upsertItems(
  supabase: SupabaseClient,
  byDC: Map<string, ExistingRow>,
  items: AlertData[],
  today: string,
  results: SyncResults,
  log: LogEntry[],
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — accumulated across both call sites
  // (alerts + sitrep) so the caller can report them together after both
  // have run. See the push site below for why these, and only these, need
  // to reach the health-check.
  lockedGuardBlocked: string[],
): Promise<void> {
  for (const item of items) {
    const label = `${item.disease_en}/${item.country_en}`;

    if (item.date > today) {
      log.push({ label, status: "skip", detail: `future date: ${item.date}` });
      results.skipped++;
      continue;
    }

    // Skip 0/0 entries — routine surveillance bulletins (e.g. flu positivity-rate
    // updates) report percentages, not case counts, and would otherwise insert an
    // empty "outbreak" row. Same guard as sync-africa-cdc.
    if (item.cases === 0 && item.deaths === 0) {
      log.push({ label, status: "skip", detail: "0 cases and 0 deaths — likely a surveillance bulletin without a countable figure" });
      results.skipped++;
      continue;
    }

    const geo = findCountry(item.country_en);
    if (!geo) {
      log.push({ label, status: "skip", detail: "country not in geo-data" });
      results.skipped++;
      continue;
    }

    const existing = byDC.get(dcKey(item.disease_en, item.country_en));

    // Ambiguous attribution: this alert named 2+ countries with no structural
    // anchor saying which country the extracted cases/deaths actually belongs
    // to (see the `ambiguous` tier in extractAlertData). Safe to UPDATE an
    // existing row — the staleness/ownership guards elsewhere already protect
    // against a wildly wrong number — but never silently INSERT a brand-new
    // row on a guess, same guard as sync-ecdc-threats.
    if (item.ambiguous && !existing) {
      log.push({ label, status: "skip", detail: "ambiguous attribution — no existing row, refusing to guess-insert" });
      results.skipped++;
      continue;
    }

    // A sitrep must never move a row backwards in time. The US measles row is
    // the live case: CDC data at 2,231 (9 July) against the sitrep's 2,134
    // (EW 25, 27 June) — both correct for their own cut-off, but writing the
    // sitrep's would silently downgrade a fresher figure. Whichever source is
    // most recent wins; from sitrep #7 on the sitrep leads and takes the row
    // over, which is what makes it self-maintaining instead of hand-patched.
    if (item.fromSitrep && existing && item.date < existing.date) {
      log.push({ label, status: "skip", detail: `sitrep ${item.date} older than existing row ${existing.date} — keeping fresher source` });
      results.skipped++;
      continue;
    }

    // Alert pages never take a row off the WHO DON sync. A sitrep may, but only
    // when it's at least as recent: the fortnightly regional table is the
    // authority on Americas measles, and Canada was pinned at a stale DON
    // (6,332 cumulative since the 2024 outbreak, frozen at 1 March) while PAHO
    // reported 1,079 for 2026 — the same year-to-date basis every sibling row
    // uses. Once written at priority 5, sync-outbreaks (priority 3) can't
    // revert it, so ownership transfers cleanly rather than ping-ponging.
    if (existing?.source?.includes(WHO_DON_SOURCE) && !item.fromSitrep) {
      log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
      results.skipped++;
      continue;
    }

    const diseaseInfo = normalizeDisease(item.disease_en);
    const riskLevel   = assessRisk(item.disease_en, item.description, item.cases, item.deaths);

    if (existing) {
      const isNewer    = item.date > existing.date;
      const casesDiff  = item.cases  !== existing.cases;
      const deathsDiff = item.deaths !== existing.deaths;

      if (!isNewer && !casesDiff && !deathsDiff) {
        log.push({ label, status: "skip", detail: "data unchanged" });
        results.skipped++;
        continue;
      }

      // An older-dated item with different numbers was not skipped above (only
      // the "unchanged" case was) — a stale re-fetch could still overwrite a
      // more recent row. Same guard family as sync-cdc-notices.
      if (item.date < existing.date) {
        log.push({ label, status: "skip", detail: `older item (${item.date}) than existing (${existing.date})` });
        results.skipped++;
        continue;
      }

      // Collapse / zero-over-real guards (lib/outbreak-guards.ts). This cron
      // reads linearized PDF sitrep tables, the most parse-fragile source in
      // the repo — on 2026-08-01 a footnote digit was captured as Guatemala's
      // death toll (26 → 4) and stood for 3+ weeks. The date floor above was
      // the only regression guard here; sync-who-afro/sync-cdc-notices have
      // had the full set since 2026-07-16.
      const guardReason = regressionGuard(item, existing) ?? lockedRowRegressionGuard(item, existing);
      if (guardReason) {
        log.push({ label, status: "skip", detail: guardReason });
        results.skipped++;
        // A refusal on a locked (source_priority>=10) row is not an
        // ordinary skip: nothing else will ever write this row again, so a
        // silently-blocked write freezes it on stale figures forever with
        // nothing to show for it (see check-mpox-sitrep/route.ts and
        // project_source_priority_is_ownership_not_freeze_2026_08_19).
        // Ordinary guards (regressionGuard's own checks) stay unreported
        // here — their regular-operation volume isn't measured, so
        // surfacing them too would risk drowning the health-check in noise.
        if (guardReason.startsWith("guard:locked-row-")) lockedGuardBlocked.push(`${label}: ${guardReason}`);
        continue;
      }

      // Re-translate inline on update too — same reasoning as the insert
      // branch below: this cron owns its own localization, and an English
      // description update without a matching FR/ES/AR/ID refresh leaves
      // those columns frozen on the old figures forever (no other cron
      // revisits a non-NULL description_fr).
      const t = await translateDescription(item.description);
      const updatePayload: Record<string, unknown> = {
        cases:           item.cases,
        deaths:          item.deaths,
        date:            item.date,
        source:          item.source,
        description:     item.description,
        risk_level:      riskLevel,
        active:          true,
        is_seed:         false,
        source_priority: Math.max(5, existing.source_priority ?? 0),
      };
      // Only overwrite a locale column when the translation actually
      // succeeded — MyMemory returns null on failure/echo, and writing
      // that would blank out a still-valid prior translation.
      if (t.fr) updatePayload.description_fr = t.fr;
      if (t.es) updatePayload.description_es = t.es;
      if (t.ar) updatePayload.description_ar = t.ar;
      if (t.id) updatePayload.description_id = t.id;
      if (item.admin1) {
        updatePayload.admin1     = item.admin1;
        updatePayload.admin1_lat = item.admin1_lat;
        updatePayload.admin1_lng = item.admin1_lng;
      }

      // .select("id") so a source_priority guard that blocks the write (row now
      // owned by a higher-priority source) is visible as 0 affected rows —
      // without it, a blocked update still returns error: null and was
      // reported as "updated" even though nothing changed. Found 2026-07-15.
      const { data: updated, error } = await supabase
        .from("outbreaks")
        .update(updatePayload)
        .eq("id", existing.id)
        .lte("source_priority", 10)
        .select("id");

      if (error) {
        log.push({ label, status: "error", detail: error.message });
        results.errors++;
      } else if (!updated || updated.length === 0) {
        log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
        results.skipped++;
      } else {
        log.push({ label, status: "updated", detail: `${existing.cases}/${existing.deaths} → ${item.cases} cases / ${item.deaths} deaths (${item.date})` });
        results.updated++;
      }
    } else {
      // Translate inline so this cron owns its own localization rather than
      // relying on sync-outbreaks' unrelated backfill sweep to catch it later.
      const t = await translateDescription(item.description);

      const { error } = await supabase.from("outbreaks").insert({
        disease:     diseaseInfo.name_fr,
        disease_en:  diseaseInfo.name_en,
        disease_ar:  diseaseInfo.name_ar,
        country:     geo.name_fr,
        country_en:  geo.name_en,
        country_ar:  geo.name_ar,
        region:      geo.region,
        lat:         geo.lat,
        lng:         geo.lng,
        cases:       item.cases,
        deaths:      item.deaths,
        risk_level:  riskLevel,
        date:        item.date,
        source:      item.source,
        description:    item.description,
        description_fr: t.fr,
        description_es: t.es,
        description_ar: t.ar,
        description_id: t.id,
        active:       true,
        is_seed:      false,
        is_backfill:  false,
        source_priority: 5,
        admin1:       item.admin1 ?? null,
        admin1_lat:   item.admin1_lat ?? null,
        admin1_lng:   item.admin1_lng ?? null,
        first_seen_at: item.date,
      });

      if (error) {
        log.push({ label, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ label, status: "inserted", detail: `${item.cases} cases / ${item.deaths} deaths (${item.date})` });
        results.inserted++;
      }
    }

    await new Promise((r) => setTimeout(r, 200));
  }
}

// ── Sitrep collection ─────────────────────────────────────────────────────────

interface SitrepEntry { url: string; title: string; num: number; created: string | null }

// Picks the highest-numbered measles sitrep on the listing. Numbering is the
// reliable ordering key — the listing's "created" timestamp is when the node
// was published, which can trail the report itself.
function parseSitrepListing(html: string): SitrepEntry | null {
  const linkRe = /<a\s+href="(\/en\/documents\/[^"]*situation-report[^"]*measles[^"]*americas[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  let best: SitrepEntry | null = null;

  while ((m = linkRe.exec(html)) !== null) {
    const relPath = m[1];
    const title   = m[2].trim();
    const num = parseInt(
      /situation-report-(?:no\.?)?(\d+)/i.exec(relPath)?.[1] ?? /#\s*(\d+)|No\.?\s*(\d+)/i.exec(title)?.slice(1).find(Boolean) ?? "",
      10,
    );
    if (isNaN(num)) continue;

    // Nearest <time> before the title link is this row's publication date; the
    // listing renders it in the same views-field group.
    const before  = html.slice(Math.max(0, m.index - 800), m.index);
    const created = [...before.matchAll(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})/g)].pop()?.[1] ?? null;

    if (!best || num > best.num) best = { url: PAHO_BASE + relPath, title, num, created };
  }
  return best;
}

// The PDF filename follows no stable pattern across editions
// (paho-measles-sitrep4.pdf, pahomeaslessitrep5eng.pdf,
// measles-sitrep6-2july-2026.pdf), so it has to be read off the document page
// rather than constructed.
async function fetchSitrepPdfText(docUrl: string): Promise<string> {
  const res = await fetch(docUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`sitrep doc page HTTP ${res.status}`);
  const pdfHref = (await res.text()).match(/href="([^"]+\.pdf)"/i)?.[1];
  if (!pdfHref) throw new Error("no PDF link on sitrep document page");

  const pdfUrl = pdfHref.startsWith("http") ? pdfHref : PAHO_BASE + pdfHref;
  const pdfRes = await fetch(pdfUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!pdfRes.ok) throw new Error(`sitrep PDF HTTP ${pdfRes.status}`);

  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
    (buf: Buffer, opts?: object) => Promise<{ text: string }>;
  // No page cap: the country table sits around page 8 of ~14.
  const { text } = await pdfParse(Buffer.from(await pdfRes.arrayBuffer()));
  return text;
}

// A country drops off the asterisked set when PAHO judges its outbreak over —
// the deactivation pass below turns that into active=false on the matching
// row. A truncated PDF parse (bad page break, PAHO changing the table layout
// mid-report) would otherwise read as "every unmentioned country's outbreak
// just ended" and mass-deactivate rows with real, ongoing outbreaks. Sitreps
// #4/#5 parsed 10 country rows and #6 parsed 11; anything short of that is
// treated as a suspect parse and the deactivation pass is skipped entirely
// (the insert/update pass above is unaffected — it only ever touches rows
// for countries it actually found this edition).
const SITREP_MIN_SANE_ROWS = 8;
const SITREP_SOURCE_LIKE = "%paho.org%situation-report%";

interface DeactivationCandidate { id: string; country_en: string; cases: number; deaths: number }

async function deactivateDroppedSitrepCountries(
  supabase: SupabaseClient,
  entry: SitrepEntry,
  table: SitrepTable,
  log: LogEntry[],
): Promise<number> {
  if (table.rows.length < SITREP_MIN_SANE_ROWS) {
    log.push({
      label:  entry.title,
      status: "skip",
      detail: `deactivation pass skipped — parse yielded only ${table.rows.length} country row(s) (< ${SITREP_MIN_SANE_ROWS}), too few to trust as a complete table`,
    });
    return 0;
  }

  const stillActive = new Set(
    table.rows
      .filter((r) => r.active)
      .map((r) => findCountry(r.country)?.name_en)
      .filter((n): n is string => !!n),
  );

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, country_en, cases, deaths")
    .eq("disease_en", "Measles")
    .eq("region", "americas")
    .eq("active", true)
    .like("source", SITREP_SOURCE_LIKE);

  if (error) {
    log.push({ label: entry.title, status: "error", detail: `deactivation lookup: ${error.message}` });
    return 0;
  }

  let count = 0;
  for (const row of (data ?? []) as DeactivationCandidate[]) {
    if (stillActive.has(row.country_en)) continue;

    // Scoping the lookup above to this sitrep's own `source` keeps the sweep on
    // rows this cron owns, but that alone never protected a row a human locked
    // at source_priority=10 (the convention used for DR Congo/Ebola, Uganda,
    // Tanzania, Somalia): the lock lives in a column the sweep didn't read, so
    // a deliberate "keep this active" decision could be reverted by a sitrep
    // that simply stopped asterisking the country. Same contract as the
    // deactivation in data-quality/route.ts: guard at the DB level, and verify
    // via .select("id") that the write actually landed before reporting it as
    // deactivated — a blocked write must read as "skip", never as a success.
    const { data: deact, error: updErr } = await supabase
      .from("outbreaks")
      .update({ active: false })
      .eq("id", row.id)
      .eq("active", true)
      .lte("source_priority", 5)
      .select("id");

    if (updErr) {
      log.push({ label: `Measles/${row.country_en}`, status: "error", detail: `deactivation failed: ${updErr.message}` });
      continue;
    }
    if (!deact || deact.length === 0) {
      log.push({ label: `Measles/${row.country_en}`, status: "skip", detail: "deactivation blocked by source_priority guard — row locked or owned by a higher-priority source" });
      continue;
    }
    log.push({
      label:  `Measles/${row.country_en}`,
      status: "deactivated",
      detail: `no longer in sitrep #${entry.num}'s asterisked set (EW ${table.ew} ${table.year}) — was ${row.cases} cases / ${row.deaths} deaths, outbreak treated as over`,
    });
    count++;
  }
  return count;
}

async function collectSitrepItems(
  supabase: SupabaseClient,
  log: LogEntry[],
): Promise<{ items: AlertData[]; deactivated: number }> {
  const listRes = await fetch(PAHO_SITREP_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!listRes.ok) throw new Error(`sitrep listing HTTP ${listRes.status}`);

  const entry = parseSitrepListing(await listRes.text());
  if (!entry) {
    log.push({ label: "measles sitrep", status: "skip", detail: "no measles sitrep on listing" });
    return { items: [], deactivated: 0 };
  }

  if (entry.created) {
    const ageDays = (Date.now() - new Date(entry.created).getTime()) / 86400_000;
    if (ageDays > SITREP_MAX_AGE_DAYS) {
      log.push({ label: entry.title, status: "skip", detail: `sitrep older than ${SITREP_MAX_AGE_DAYS}d (${entry.created})` });
      return { items: [], deactivated: 0 };
    }
  }

  const text  = await fetchSitrepPdfText(entry.url);
  const table = parseSitrepCases(text, log);
  // Sitrep #3 and earlier had no deaths column, so nothing matches the
  // cases+deaths shape. Writing nothing is the correct outcome for a layout we
  // don't recognise — better a visible coverage gap than invented figures.
  if (!table || table.rows.length === 0) {
    log.push({ label: entry.title, status: "skip", detail: "country table not found or unrecognised layout" });
    return { items: [], deactivated: 0 };
  }

  const rt    = parseSitrepRt(text);
  const items: AlertData[] = [];

  // Only countries PAHO itself marks with "*" — "measles cases reported for a
  // period of 12 weeks or longer", i.e. an actual outbreak, and exactly the set
  // it bothers to model in the Rt table. The unmarked rows are sporadic
  // importations (5–18 cases, "last case on EW 15") that would land as
  // permanently-active low-risk noise.
  const active = table.rows.filter((r) => r.active);
  const passed = table.rows.filter((r) => !r.active).map((r) => `${r.country}=${r.cases}`);
  log.push({
    label:  entry.title,
    status: "parsed",
    detail: `EW ${table.ew} ${table.year} (${table.date}) — ${active.length} active outbreak(s); sporadic importations not ingested: ${passed.join(", ") || "none"}`,
  });

  for (const row of active) {
    const geo = findCountry(row.country);
    if (!geo || isAggregateCountry(geo)) continue;

    // The notes cell names the actual foci ("concentrated in Puno (603)"),
    // which is a far better admin1 signal than the alert prose this normally
    // runs on. Extracted before the description so a long notes cell that gets
    // truncated below can still have its grounding admin1 appended back in.
    const admin1 = await extractAdmin1(`${row.country}. ${row.notes}`, geo.name_en);
    const description = buildSitrepDescription(entry.num, table, row, rt.get(row.country), admin1);

    let admin1_lat: number | null = null;
    let admin1_lng: number | null = null;
    if (admin1) {
      const coords = await geocodeAdmin1(admin1, geo.name_en);
      if (coords) { admin1_lat = coords.lat; admin1_lng = coords.lng; }
      await new Promise((r) => setTimeout(r, 1100));
    }

    items.push({
      disease_en: "Measles",
      country_en: geo.name_en,
      cases:      row.cases,
      deaths:     row.deaths,
      source:     entry.url,
      description,
      date:       table.date,
      admin1,
      admin1_lat,
      admin1_lng,
      fromSitrep: true,
    });
  }

  const deactivated = await deactivateDroppedSitrepCountries(supabase, entry, table, log);
  return { items, deactivated };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Defensive wrapper: sections 1/2/4 below already handle their own errors
  // locally, but section 3's loadExistingForItems/upsertItems calls (per-alert
  // loop) sit outside the try/catch that only covers extractAlertData. An
  // uncaught exception there propagated straight out: bare 500, no Sentry
  // event, logCronRun never reached — same root cause as the sync-outbreaks
  // incident of 2026-07-29.
  try {
    return await runPahoAlerts(req, supabase);
  } catch (err) {
    console.error("[paho] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-paho-alerts" } });
    await logCronRun(supabase, "sync-paho-alerts", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runPahoAlerts(_req: NextRequest, supabase: SupabaseClient) {
  const today = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch PAHO alert listing ───────────────────────────────────────────
  let listingHtml: string;
  try {
    const res = await fetch(PAHO_ALERT_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[paho] listing HTTP ${res.status}`);
      await logCronRun(supabase, "sync-paho-alerts", "error", 0, `PAHO listing HTTP ${res.status}`);
      return NextResponse.json({ error: `PAHO listing HTTP ${res.status}` }, { status: 502 });
    }
    listingHtml = await res.text();
  } catch (e) {
    console.error("[paho] fetch listing:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-paho-alerts" } });
    await logCronRun(supabase, "sync-paho-alerts", "error", 0, errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const entries = parseListing(listingHtml);
  console.log(`[paho] Found ${entries.length} recent alert(s) within ${MAX_AGE_DAYS} days`);

  // No early return on an empty alert listing: the measles sitrep is published
  // on a separate page and is the more important of the two sources. Bailing
  // here would skip it on every quiet alert week.

  // ── 2. Load existing outbreaks for dedup ──────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, source_priority")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) {
    await logCronRun(supabase, "sync-paho-alerts", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const byDC = new Map<string, ExistingRow>();
  for (const row of (existing ?? []) as ExistingRow[]) indexRow(byDC, row);

  // ── 3. Process each alert ─────────────────────────────────────────────────
  const results: SyncResults = { alerts: entries.length, sitrepRows: 0, inserted: 0, updated: 0, skipped: 0, errors: 0, deactivated: 0 };
  const log: LogEntry[] = [];
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — see the push site in upsertItems() for
  // why these, and only these, need to reach the health-check.
  const lockedGuardBlocked: string[] = [];

  for (const entry of entries) {
    let alertItems: AlertData[] = [];
    try {
      alertItems = await extractAlertData(entry);
    } catch (e) {
      log.push({ label: entry.title, status: "error", detail: errorMessage(e) });
      Sentry.captureException(e, { tags: { cron: "sync-paho-alerts" } });
      results.errors++;
      continue;
    }

    if (alertItems.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: "disease not in map or no country found" });
      results.skipped++;
      continue;
    }

    await loadExistingForItems(supabase, byDC, alertItems);
    await upsertItems(supabase, byDC, alertItems, today, results, log, lockedGuardBlocked);
  }

  // ── 4. Measles situation report ───────────────────────────────────────────
  // Independent of the alerts above: a sitrep failure must not lose the alert
  // work already committed, and vice versa.
  let sitrepError: string | null = null;
  try {
    const { items: sitrepItems, deactivated } = await collectSitrepItems(supabase, log);
    results.sitrepRows   = sitrepItems.length;
    results.deactivated  = deactivated;
    await loadExistingForItems(supabase, byDC, sitrepItems);
    await upsertItems(supabase, byDC, sitrepItems, today, results, log, lockedGuardBlocked);
  } catch (e) {
    sitrepError = errorMessage(e);
    console.error("[paho] sitrep:", sitrepError);
    Sentry.captureException(e, { tags: { cron: "sync-paho-alerts", stage: "sitrep" } });
    log.push({ label: "measles sitrep", status: "error", detail: sitrepError });
    results.errors++;
  }

  console.log("[paho] Done:", results, log);
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[paho] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }
  // Report a sitrep-stage failure as an error rather than a green run: a silent
  // "ok" here is exactly how the missing sitrep ingestion stayed invisible.
  // Also checks results.errors now — it was ignored here, so a failed alert
  // insert/update alongside a successful sitrep still logged "ok" (same bug
  // class as sync-outbreaks, 2026-07-29).
  await logCronRun(
    supabase,
    "sync-paho-alerts",
    sitrepError || results.errors > 0 || lockedGuardBlocked.length > 0 ? "error" : "ok",
    results.inserted ?? 0,
    lockedGuardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
      : sitrepError ?? (results.errors > 0 ? `${results.errors} écriture(s) en échec` : undefined),
  );
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined, ...results, log });
}
