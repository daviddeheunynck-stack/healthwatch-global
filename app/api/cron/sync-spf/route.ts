// Santé Publique France (SPF) sync — runs twice daily.
// Fetches the SPF news RSS feed, filters infectious disease alerts and
// epidemiological updates, and upserts to outbreaks.
// SPF publishes within hours of French national confirmation — the primary
// source for imported cases in France (Ebola, MERS-CoV, etc.) before WHO DON.
// Never overwrites rows owned by the WHO DON daily sync.
//
// SPF is France's own national public health agency — a genuine primary
// government source for its own country's rows — so this cron can write onto
// rows locked at source_priority=10 (ceiling raised 2026-08-19 alongside
// sync-who-afro/emro — see project_source_priority_is_ownership_not_freeze_
// 2026_08_19). lockedRowRegressionGuard refuses any decrease on a locked row.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry, isAggregateCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { truncateAtSentence } from "@/lib/truncate-text";
import { dateFloorGuard, spikeGuard, collapseGuard, zeroCaseGuard, zeroDeathGuard, lockedRowRegressionGuard, lockedRowIsFreezing } from "@/lib/outbreak-guards";
import { stampSourceConfirmed } from "@/lib/source-confirmed";

export const dynamic     = "force-dynamic";
// 300s (was 90): the per-article page fetches (12s timeout each) pushed real
// runs to ~85-105s, at the ceiling — sync-spf silently timed out and skipped
// two consecutive ticks (2026-07-16 15:00 + 2026-07-17 07:00 UTC). Matches the
// vercel.json app/api/cron/** default of 300, which the route export overrides.
export const maxDuration = 300;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const SPF_BASE      = "https://www.santepubliquefrance.fr";
// Try multiple known SPF RSS endpoint patterns
const SPF_RSS_URLS  = [
  "https://www.santepubliquefrance.fr/maladies-et-traumatismes/maladies-infectieuses-d-origine-alimentaire?format=xml",
  "https://www.santepubliquefrance.fr/les-actualites?format=xml",
  "https://www.santepubliquefrance.fr/recherche#search_query=maladie+infectieuse&first=0&sort=date&format=xml",
];
const SPF_NEWS_URL  = "https://www.santepubliquefrance.fr/les-actualites";
const MAX_AGE_DAYS  = 30;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/rss+xml,text/html,*/*",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

// Excludes aggregate pseudo-countries ("Global", "Multi-country", "African Region"...):
// left in, boilerplate like "la situation mondiale" would match the "Global" alias
// and become countries[0] whenever it's mentioned before the real country, causing
// the aggregate-rejection guard below to discard the whole article instead of
// finding the real one. Found 2026-07-16 (same class as sync-africa-cdc).
const COUNTRY_NAMES = Object.keys(COUNTRIES)
  .filter((name) => !isAggregateCountry(COUNTRIES[name]))
  .sort((a, b) => b.length - a.length);

// French country name fragments → canonical English key
const FR_ALIASES: Record<string, string> = {
  " france ":              "France",
  "en france":             "France",
  "sur le territoire":     "France",
  " drc ":                 "Democratic Republic of the Congo",
  " rdc ":                 "Democratic Republic of the Congo",
  " congo démocratique":   "Democratic Republic of the Congo",
  " rd congo":             "Democratic Republic of the Congo",
  " maroc ":               "Morocco",
  " algérie ":             "Algeria",
  " tunisie ":             "Tunisia",
  " sénégal ":             "Senegal",
  " côte d'ivoire":        "Ivory Coast",
  " guinée ":              "Guinea",
  " cameroun ":            "Cameroon",
  " nigeria ":             "Nigeria",
  " ouganda ":             "Uganda",
  " kenya ":               "Kenya",
  " arabie saoudite":      "Saudi Arabia",
  " brésil ":              "Brazil",
  " mexique ":             "Mexico",
  " chine ":               "China",
  " inde ":                "India",
  " thaïlande ":           "Thailand",
  " indonésie ":           "Indonesia",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}

// SPF article pages wrap all real content inside <main id="main-content-main">
// (breadcrumb + share buttons + the actual bulletin/dossier prose) — confirmed
// stable across hub pages, regional bulletins, and national bulletins. Before
// it sits the full A-Z disease directory (which repeats 2-3 times across the
// header/nav) plus the top nav — unscoped, that alone fills the entire
// extraction window before any real content is reached.
function extractSPFBody(html: string): string {
  const idx = html.indexOf('id="main-content-main"');
  // If SPF changes their template, this selector stops matching — returning the
  // full page (A-Z disease directory repeated 2-3x + top nav) instead of "" would
  // feed page chrome into extractNumbers/findMentionedCountries (wrong case
  // counts, wrong country) rather than the empty-string 0/0 those functions
  // already handle as a visible skip. Found 2026-07-16.
  if (idx < 0) {
    console.warn("[spf] body selector no longer matches — skipping article");
    return "";
  }
  const tagEnd = html.indexOf(">", idx) + 1;
  return html.slice(tagEnd, tagEnd + 12000);
}

// Strip SPF title prefixes to extract core disease term
function extractSPFDisease(title: string): string {
  return title
    .replace(/^point\s+épidémiologique\s+n°?\s*\d*\s*[-–—]\s*/i, "")
    .replace(/^point\s+épidémiologique\s+[-–—]?\s*/i, "")
    .replace(/^point\s+épidémio\s+[-–—]?\s*/i, "")
    .replace(/^alerte\s+[-–—]?\s*/i, "")
    .replace(/^avis\s+[-–—]?\s*/i, "")
    .replace(/^bulletin\s+épidémiologique\s+[-–—]?\s*/i, "")
    .replace(/^maladie\s+à\s+virus\s+/i, "")
    .replace(/\s*[-–—]\s*(?:situation|point|bilan|mise\s+à\s+jour|actualités?|france?).+$/i, "")
    .replace(/\s*[-–—]\s*\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre).+$/i, "")
    .replace(/\s+(?:au|en|aux|à|dans\s+le?s?)\s+.+$/i, "")
    .replace(/\s+(?:en|de)\s+france.+$/i, "")
    .replace(/\s*[-–—]\s*.+$/, "")
    .replace(/\s*n°?\s*\d+\s*$/, "")
    .trim();
}

// Returns countries ordered by earliest position of first occurrence in the
// text, not by iteration order over FR_ALIASES/COUNTRY_NAMES — callers take
// countries[0] as "the primary country", which needs to mean "mentioned
// first in the article", not "whichever name happens to be declared first".
// Found 2026-07-15 (same class of bug already fixed in sync-ecdc-threats).
function findMentionedCountries(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const positions = new Map<string, number>();

  const record = (canonical: string, idx: number) => {
    if (idx === -1) return;
    const prev = positions.get(canonical);
    if (prev === undefined || idx < prev) positions.set(canonical, idx);
  };

  // French aliases first
  for (const [fr, canonical] of Object.entries(FR_ALIASES)) {
    record(canonical, lower.indexOf(fr));
  }
  // Then English country names (appear in scientific content)
  for (const name of COUNTRY_NAMES) {
    if (positions.has(name)) continue;
    const lowerName = name.toLowerCase();
    const idxSpace = lower.indexOf(` ${lowerName} `);
    const idxComma = lower.indexOf(` ${lowerName},`);
    record(name, idxSpace === -1 ? idxComma : idxComma === -1 ? idxSpace : Math.min(idxSpace, idxComma));
  }

  return [...positions.keys()].sort((a, b) => positions.get(a)! - positions.get(b)!);
}

// ── RSS parser ────────────────────────────────────────────────────────────────

interface RSSItem {
  url:   string;
  title: string;
  date:  string;
  description: string;
}

function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const raw = m[1];

    const title = raw.match(/<title>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    if (!title) continue;

    const link =
      raw.match(/<link>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim() ??
      raw.match(/<guid[^>]*>\s*(https?:\/\/[^\s<]+)/i)?.[1]?.trim();
    if (!link) continue;

    const pubDate = raw.match(/<pubDate>([^<]+)/i)?.[1]?.trim();
    if (!pubDate) continue;
    const d = new Date(pubDate);
    if (isNaN(d.getTime()) || d < cutoff) continue;

    const descRaw = raw.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
    const description = htmlToText(
      descRaw.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "")
    );

    items.push({ url: link, title, date: d.toISOString().substring(0, 10), description });
  }
  return items;
}

// Extract article links + dates directly from SPF HTML when RSS is unavailable
function parseHTMLItems(html: string): RSSItem[] {
  const items: RSSItem[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // SPF article cards: <a href="/..." class="...">Title</a> near a date
  for (const m of html.matchAll(/<a[^>]+href="(\/[^"]+)"[^>]*>\s*([^<]{15,})\s*<\/a>/gi)) {
    const href  = m[1];
    const title = m[2].trim();
    if (title.length < 15 || title.length > 200) continue;

    // Find nearest date string (dd mois aaaa format)
    const dateMatch = html.slice(
      Math.max(0, html.indexOf(m[0]) - 200),
      html.indexOf(m[0]) + 400
    ).match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);

    if (!dateMatch) continue;
    const monthMap: Record<string, string> = {
      janvier:"01", février:"02", mars:"03", avril:"04", mai:"05", juin:"06",
      juillet:"07", août:"08", septembre:"09", octobre:"10", novembre:"11", décembre:"12",
    };
    const d = new Date(`${dateMatch[3]}-${monthMap[dateMatch[2].toLowerCase()]}-${dateMatch[1].padStart(2,"0")}`);
    if (isNaN(d.getTime()) || d < cutoff) continue;

    items.push({ url: SPF_BASE + href, title, date: d.toISOString().substring(0, 10), description: "" });
  }
  return items;
}

// ── France arbovirus national bulletin (chikungunya/dengue/West Nile) ────────
//
// The RSS/HTML news feed above never surfaces this bulletin: it isn't a news
// article, it lives at its own numbered URL and is never linked from
// /les-actualites. Found 2026-08-21 — Chikungunya/Dengue/West Nile/France sat
// 3 numbered editions behind (bulletin #21 already published, #20 still in
// DB) despite this cron running twice daily and being allowed to write these
// rows (source_priority<=10 since 2026-08-19). See product-ideas-log.md,
// 2026-08-21 idea 1.
//
// One bulletin page reports all three diseases in prose, not one item per
// disease, so it can't reuse the per-item loop below — it gets its own pass.
// Bulletin numbers increment by ~1/week during the 1 May-30 Nov season; the
// next number is derived from whichever of the 3 rows is furthest behind
// (its own `source` URL already ends in "-et-<N>"), so no separate cursor
// needs to be persisted. Probes forward a few numbers to catch up if a week
// (or more) was missed, stopping at the first 404 — bulletins are strictly
// sequential, so a miss means "not published yet".
const ARBOVIRUS_BULLETIN_BASE =
  "https://www.santepubliquefrance.fr/maladies-a-transmission-vectorielle/chikungunya/bulletin-national/chikungunya-dengue-zika-et-";
const ARBOVIRUS_ROW_IDS: Record<"Chikungunya" | "Dengue fever" | "West Nile fever", string> = {
  "Chikungunya":   "99f356e8-7fc3-4f43-947e-45c9d6a34757",
  "Dengue fever":  "5ccc53c2-b17b-493b-aadf-233acb4b2cdf",
  "West Nile fever": "906bf26a-8867-4a9c-ad7c-976e4e2c5bab",
};
const ARBOVIRUS_LOOKAHEAD = 6; // ~6 weeks of catch-up if runs were missed

const FR_MONTHS: Record<string, string> = {
  janvier: "01", février: "02", mars: "03", avril: "04", mai: "05", juin: "06",
  juillet: "07", août: "08", septembre: "09", octobre: "10", novembre: "11", décembre: "12",
};

function parseFrenchDateNear(text: string, anchorIdx: number): string | null {
  // Looks backward from a disease mention to the nearest "Au DD mois AAAA,"
  // that opens its sentence — both the chikungunya/dengue sentence and the
  // separate West Nile sentence follow this exact pattern in the bulletin.
  const window = text.slice(Math.max(0, anchorIdx - 300), anchorIdx);
  const matches = [...window.matchAll(
    /Au\s+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi
  )];
  const m = matches[matches.length - 1];
  if (!m) return null;
  const mm = FR_MONTHS[m[2].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

interface ArbovirusFigure { cases: number; date: string }

// Returns null per-disease (rather than throwing) when a pattern doesn't
// match, so a bulletin wording change degrades to "skip that disease this
// run" instead of crashing the whole cron or writing garbage — the existing
// guard stack (spike/collapse/dateFloor) is a second line of defence, not
// the only one.
function parseArbovirusBulletin(text: string): Record<keyof typeof ARBOVIRUS_ROW_IDS, ArbovirusFigure | null> {
  const result: Record<keyof typeof ARBOVIRUS_ROW_IDS, ArbovirusFigure | null> = {
    "Chikungunya": null, "Dengue fever": null, "West Nile fever": null,
  };

  const chik = text.match(/(\d+)\s+épisodes?\s+de\s+chikungunya\s+totalisant\s+(\d+)\s+cas/i);
  if (chik) {
    const date = parseFrenchDateNear(text, chik.index ?? 0);
    if (date) result["Chikungunya"] = { cases: Number(chik[2]), date };
  }

  const dengue = text.match(/(\d+)\s+épisodes?\s+de\s+dengue\s+totalisant\s+(\d+)\s+cas/i);
  if (dengue) {
    const date = parseFrenchDateNear(text, dengue.index ?? 0);
    if (date) result["Dengue fever"] = { cases: Number(dengue[2]), date };
  }

  const westNile = text.match(/(\d+)\s+cas\s+autochtones?\s+d['’]infection\s+à\s+virus\s+West\s+Nile/i);
  if (westNile) {
    const date = parseFrenchDateNear(text, westNile.index ?? 0);
    if (date) result["West Nile fever"] = { cases: Number(westNile[1]), date };
  }

  return result;
}

// ── Shared dedup lookup ───────────────────────────────────────────────────────

interface ExistingRow {
  id: string;
  disease_en: string | null;
  country_en: string | null;
  cases: number;
  deaths: number;
  date: string;
  source: string | null;
  active: boolean;
  description: string | null;
  source_priority: number | null;
}

const dcKey = (disease: string | null, country: string | null) =>
  `${(disease ?? "").toLowerCase()}|${(country ?? "").toLowerCase()}`;

function indexRow(byDC: Map<string, ExistingRow>, row: ExistingRow): void {
  const k    = dcKey(row.disease_en, row.country_en);
  const prev = byDC.get(k);
  if (!prev || (row.active && !prev.active)) byDC.set(k, row);
}

// The dedup snapshot in GET loads active rows plus anything dated within 90
// days. A row that fell inactive BEFORE that window is invisible to it, and an
// unseen row is upserted as an insert — a duplicate, not an update. Look the
// targeted rows up explicitly before writing them. Same fix as sync-paho-alerts
// (found 2026-07-15, applied here 2026-07-17).
async function loadExistingForItems(
  supabase: SupabaseClient,
  byDC: Map<string, ExistingRow>,
  items: { disease_en: string; country_en: string }[],
): Promise<void> {
  const missing = items.filter((i) => !byDC.has(dcKey(i.disease_en, i.country_en)));
  if (missing.length === 0) return;

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .in("disease_en", [...new Set(missing.map((i) => i.disease_en))])
    .in("country_en", [...new Set(missing.map((i) => i.country_en))]);

  if (error) {
    console.warn("[spf] dedup lookup:", error.message);
    return;
  }
  for (const row of (data ?? []) as ExistingRow[]) indexRow(byDC, row);
}

// Runs the France arbovirus national bulletin pass described above, against
// the fixed set of 3 rows it owns (Chikungunya/Dengue fever/West Nile fever,
// all France). Mutates `results`/`log`/`lockedGuardBlocked` in place so the
// caller's existing reporting (logCronRun, Sentry, response body) picks this
// pass up for free instead of needing a second reporting path.
async function syncFranceArbovirusBulletin(
  supabase: SupabaseClient,
  results: { inserted: number; updated: number; skipped: number; errors: number },
  log: { label: string; status: string; detail?: string }[],
  lockedGuardBlocked: string[],
  // Rows the bulletin re-stated unchanged — accumulated into the caller's
  // array (like lockedGuardBlocked) so both SPF passes share one batched
  // verification stamp. See lib/source-confirmed.ts.
  sourceConfirmed: string[],
): Promise<void> {
  const ids = Object.values(ARBOVIRUS_ROW_IDS);
  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .in("id", ids);
  if (error || !data) {
    log.push({ label: "France arbovirus bulletin", status: "error", detail: error?.message ?? "rows not found" });
    results.errors++;
    return;
  }
  const rowById = new Map((data as ExistingRow[]).map((r) => [r.id, r]));

  // Base = the lowest bulletin number already cited among the 3 rows (a row
  // can lag behind its siblings if a previous run only matched some of them,
  // or if this pass has never run before and one row still cites an older
  // manual-fix source that isn't a numbered bulletin at all).
  let base = 0;
  for (const id of ids) {
    const src = rowById.get(id)?.source ?? "";
    const n = Number(src.match(/-et-(\d+)$/)?.[1] ?? 0);
    if (n > 0 && (base === 0 || n < base)) base = n;
  }
  if (base === 0) {
    log.push({ label: "France arbovirus bulletin", status: "skip", detail: "no row cites a numbered bulletin yet — refusing to guess a starting point" });
    return;
  }

  let lastApplied = 0;
  for (let n = base + 1; n <= base + ARBOVIRUS_LOOKAHEAD; n++) {
    const url = ARBOVIRUS_BULLETIN_BASE + n;
    let html: string;
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) break; // sequential numbering — a miss means not published yet
      html = await res.text();
    } catch {
      break;
    }

    const text = htmlToText(extractSPFBody(html));
    const figures = parseArbovirusBulletin(text);
    let anyMatched = false;

    for (const disease of Object.keys(ARBOVIRUS_ROW_IDS) as (keyof typeof ARBOVIRUS_ROW_IDS)[]) {
      const figure = figures[disease];
      const id = ARBOVIRUS_ROW_IDS[disease];
      const existingRow = rowById.get(id);
      const label = `${disease}/France (bulletin #${n})`;
      if (!figure || !existingRow) continue;
      anyMatched = true;

      if (figure.date <= existingRow.date && figure.cases === existingRow.cases) {
        // Source fetched and an entry for this row parsed, carrying nothing
        // newer than the row's `date` — that is a verification, not merely
        // "nothing to write". Recorded so the row stops ageing towards the
        // "no update" badge while its source confirms it every run.
        sourceConfirmed.push(existingRow.id);
        log.push({ label, status: "skip", detail: "unchanged — source confirmed" });
        results.skipped++;
        continue;
      }
      const candidate = { cases: figure.cases, deaths: existingRow.deaths, date: figure.date };
      const guardReason =
        dateFloorGuard(candidate, existingRow) ??
        spikeGuard(candidate, existingRow) ??
        collapseGuard(candidate, existingRow) ??
        zeroCaseGuard(candidate, existingRow) ??
        lockedRowRegressionGuard(candidate, existingRow);
      if (guardReason) {
        log.push({ label, status: "skip", detail: guardReason });
        results.skipped++;
        // …but only while that premise holds: a locked row its owning source refreshed
        // days ago is being protected, not frozen, and escalating it every run buries
        // the next real failure of this cron. See lockedRowIsFreezing (2026-08-24).
        if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(existingRow)) lockedGuardBlocked.push(`${label}: ${guardReason}`);
        continue;
      }

      const description = truncateAtSentence(
        `SPF — ${figure.cases} locally acquired ${disease.toLowerCase()} case(s) in mainland France, as at ${figure.date}, per Santé publique France's national arbovirus (chikungunya/dengue/Zika/West Nile) enhanced surveillance bulletin.`,
        600,
      );
      const updatePayload: Record<string, unknown> = {
        cases: figure.cases, date: figure.date, source: url,
        description, risk_level: assessRisk(disease, description, figure.cases, existingRow.deaths),
        active: true, source_priority: Math.max(5, existingRow.source_priority ?? 0),
      };
      if (existingRow.description !== description) {
        updatePayload.description_fr = null;
        updatePayload.description_es = null;
        updatePayload.description_ar = null;
        updatePayload.description_id = null;
      }
      const { data: updatedRows, error: updateErr } = await supabase.from("outbreaks").update(updatePayload)
        .eq("id", id).lte("source_priority", 10).select("id");
      if (updateErr) { log.push({ label, status: "error", detail: updateErr.message }); results.errors++; }
      else if (!updatedRows || updatedRows.length === 0) {
        log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
        results.skipped++;
      } else {
        log.push({ label, status: "updated", detail: `${figure.cases} cases (${figure.date})` });
        results.updated++;
        rowById.set(id, { ...existingRow, cases: figure.cases, date: figure.date, source: url, description, source_priority: Math.max(5, existingRow.source_priority ?? 0) });
      }
    }

    if (anyMatched) lastApplied = n;
  }

  if (lastApplied === 0) {
    log.push({ label: "France arbovirus bulletin", status: "skip", detail: `no new numbered edition beyond #${base}` });
  }
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
  try {
    return await runSyncSpf(req, supabase);
  } catch (err) {
    console.error("[sync-spf] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-spf" } });
    await logCronRun(supabase, "sync-spf", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncSpf(_req: NextRequest, supabase: SupabaseClient) {
  const today = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch SPF feed (try RSS, fall back to HTML) ────────────────────────
  let items: RSSItem[] = [];
  let feedSource = "none";

  for (const rssUrl of SPF_RSS_URLS) {
    // fetchWithRetry: 2 attempts, 6s each — safe on a candidate-URL fallback
    // list: fetchWithRetry never retries a 4xx, so a candidate that's
    // genuinely gone still falls through at roughly the original 12s
    // single-attempt pace. Only a transient network blip on a preferred
    // candidate now gets a fair second try. See lib/fetch-retry.ts
    // (2026-09-02).
    const { response: res } = await fetchWithRetry(rssUrl, { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 6000, backoffMs: [1000] });
    if (!res || !res.ok) continue;
    try {
      const text = await res.text();
      if (!text.includes("<item>") && !text.includes("<entry>")) continue;
      items = parseRSSFeed(text);
      feedSource = rssUrl;
      break;
    } catch {
      continue;
    }
  }

  if (items.length === 0) {
    const { response: res, error: htmlFetchErr, attemptsMade } = await fetchWithRetry(
      SPF_NEWS_URL, { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 6000, backoffMs: [1000] },
    );
    if (!res) {
      const msg = `${errorMessage(htmlFetchErr)} (${attemptsMade} tentative(s))`;
      console.error("[spf] HTML fallback failed:", msg);
      Sentry.captureException(htmlFetchErr ?? new Error(msg), { tags: { cron: "sync-spf" } });
      // This is a `return`, not a `throw` — GET()'s try/catch wrapper never sees
      // it, so without an explicit log here this failure was as silent as a
      // missed tick to the monitoring dashboard. Found 2026-07-17.
      await logCronRun(supabase, "sync-spf", "error", 0, "SPF unreachable (RSS + HTML fallback both failed)");
      return NextResponse.json({ error: "SPF unreachable" }, { status: 502 });
    }
    if (res.ok) {
      try {
        items = parseHTMLItems(await res.text());
        feedSource = "html:" + SPF_NEWS_URL;
      } catch (e) {
        console.error("[spf] HTML fallback parse failed:", errorMessage(e));
        Sentry.captureException(e, { tags: { cron: "sync-spf" } });
        await logCronRun(supabase, "sync-spf", "error", 0, "SPF unreachable (RSS + HTML fallback both failed)");
        return NextResponse.json({ error: "SPF unreachable" }, { status: 502 });
      }
    }
  }

  console.log(`[spf] ${items.length} items via ${feedSource}`);
  if (items.length === 0) {
    // Same class of gap as above: a genuinely successful run (feed reachable,
    // nothing new to report) returned early without ever calling logCronRun,
    // so cron-monitor's "last successful run" heartbeat froze at whatever the
    // last non-empty run happened to be — misreported as the cron being stuck
    // or overdue for every day it legitimately found 0 new items in a row.
    await logCronRun(supabase, "sync-spf", "ok", 0);
    return NextResponse.json({ success: true, items: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing for dedup ────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description, source_priority")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const bySource = new Map<string, ExistingRow>();
  const byDC     = new Map<string, ExistingRow>();
  for (const row of (existing ?? []) as ExistingRow[]) {
    if (row.source) bySource.set(row.source, row);
    indexRow(byDC, row);
  }

  // ── 3. Process items ──────────────────────────────────────────────────────
  const results = { items: items.length, inserted: 0, updated: 0, skipped: 0, errors: 0, pagesFetched: 0 };
  type Log = { label: string; status: string; detail?: string };
  const log: Log[] = [];
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — see the push site below for why these,
  // and only these, need to reach the health-check.
  const lockedGuardBlocked: string[] = [];
  // Rows this run re-read from the source and found unchanged — stamped as
  // verified in one batched write after the loop (see lib/source-confirmed.ts).
  const sourceConfirmed: string[] = [];

  for (const item of items) {
    const rawDisease = extractSPFDisease(item.title);
    if (!isKnownDisease(rawDisease)) {
      log.push({ label: item.title, status: "skip", detail: `unknown: ${rawDisease}` });
      results.skipped++;
      continue;
    }

    // Fetch article for full text. Counted regardless of outcome: this is the
    // 12s-timeout call that pushed real runs to ~85-105s pre-2026-07-17 (see
    // maxDuration comment above) — the metric that matters for confirming the
    // slow path is exercised is "did this fetch happen", not "did the item end
    // up written to outbreaks" (results.inserted/updated), since most items
    // that reach this point are still skipped afterwards (wrong country,
    // dedup, 0/0 cases...). Added 2026-09-05: pending-verifications.md had
    // watched `rows` for 50 days waiting for proof the loop below ever runs —
    // rows can stay 0 indefinitely while this fetch fires every tick.
    let pageText = `${item.title} ${item.description}`;
    try {
      const res = await fetch(item.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      results.pagesFetched++;
      if (res.ok) pageText = `${item.title} ${item.description} ${htmlToText(extractSPFBody(await res.text()))}`;
    } catch (e) {
      results.pagesFetched++;
      console.warn("[spf] fetch page:", errorMessage(e));
    }

    const searchText = pageText.substring(0, 3000);
    const countries  = findMentionedCountries(searchText);
    if (countries.length === 0) {
      log.push({ label: item.title, status: "skip", detail: "no country" });
      results.skipped++;
      continue;
    }

    const geo = findCountry(countries[0]);
    if (!geo || isAggregateCountry(geo)) {
      log.push({ label: item.title, status: "skip", detail: `geo miss or aggregate: ${countries[0]}` });
      results.skipped++;
      continue;
    }

    // SPF guard: France entries require explicit French case language.
    // SPF publishes awareness bulletins for foreign outbreaks (e.g. Ebola DRC)
    // that mention France in an advisory context — these must NOT create France rows.
    if (geo.name_en === "France") {
      const hasFrenchCase =
        /(?:cas|patient|voyageur|contact)\s+(?:confirmé|identifi[eé]|import[eé]|signalé|hospitalisé)\s+(?:en\s+france|sur\s+le\s+territoire)/i.test(searchText) ||
        /france\s+(?:a\s+)?(?:confirm[eé]|signal[eé]|notifi[eé])\s+(?:\d+|un[e]?\s+(?:cas|patient))/i.test(searchText) ||
        /cas\s+(?:autochtone|import[eé])\s+(?:en\s+france|sur\s+le\s+territoire)/i.test(searchText);
      if (!hasFrenchCase) {
        log.push({ label: item.title, status: "skip", detail: "France not primary event country" });
        results.skipped++;
        continue;
      }
    }

    if (item.date > today) { results.skipped++; continue; }
    if (bySource.has(item.url)) {
      log.push({ label: item.title, status: "skip", detail: "URL in DB" });
      results.skipped++;
      continue;
    }

    const diseaseInfo = normalizeDisease(rawDisease);
    const { cases, deaths } = extractNumbers(searchText);
    const riskLevel   = assessRisk(diseaseInfo.name_en, searchText, cases, deaths);
    const description = truncateAtSentence(`SPF — ${item.title}. ${item.description}`, 600);
    const label       = `${diseaseInfo.name_en}/${geo.name_en}`;

    // Skip 0/0 entries — SPF's news feed mixes real outbreak/incident reports
    // with general prevention guidance that mentions a disease/country but
    // reports no current case count. Same guard as sync-africa-cdc /
    // sync-paho-alerts / sync-ukhsa.
    if (cases === 0 && deaths === 0) {
      log.push({ label, status: "skip", detail: "0 cases and 0 deaths — likely a guidance article, not an outbreak report" });
      results.skipped++;
      continue;
    }

    await loadExistingForItems(supabase, byDC, [{ disease_en: diseaseInfo.name_en, country_en: geo.name_en }]);
    const existingRow = byDC.get(dcKey(diseaseInfo.name_en, geo.name_en));

    if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label, status: "skip", detail: "owned by WHO DON" });
      results.skipped++;
      continue;
    }

    if (existingRow) {
      if (item.date <= existingRow.date && cases === existingRow.cases) {
        // Source fetched and an entry for this row parsed, carrying nothing
        // newer than the row's `date` — that is a verification, not merely
        // "nothing to write". Recorded so the row stops ageing towards the
        // "no update" badge while its source confirms it every run.
        sourceConfirmed.push(existingRow.id);
        log.push({ label, status: "skip", detail: "unchanged — source confirmed" });
        results.skipped++;
        continue;
      }
      // Only a date-floor guard existed here — spike/collapse/zero protection
      // was added 2026-08-02, same guard family as sync-who-afro/sync-cdc-notices,
      // shared via lib/outbreak-guards.ts.
      const guardReason =
        dateFloorGuard({ cases, deaths, date: item.date }, existingRow) ??
        spikeGuard({ cases, deaths, date: item.date }, existingRow) ??
        collapseGuard({ cases, deaths, date: item.date }, existingRow) ??
        zeroCaseGuard({ cases, deaths, date: item.date }, existingRow) ??
        zeroDeathGuard({ cases, deaths, date: item.date }, existingRow) ??
        lockedRowRegressionGuard({ cases, deaths, date: item.date }, existingRow);
      if (guardReason) {
        log.push({ label, status: "skip", detail: guardReason });
        results.skipped++;
        // A refusal on a locked (source_priority>=10) row is not an
        // ordinary skip: nothing else will ever write this row again, so a
        // silently-blocked write freezes it on stale figures forever with
        // nothing to show for it (see check-mpox-sitrep/route.ts and
        // project_source_priority_is_ownership_not_freeze_2026_08_19).
        // Ordinary guards (spike/collapse/zeroCase/dateFloor) stay
        // unreported here — their regular-operation volume isn't measured,
        // so surfacing them too would risk drowning the health-check in
        // noise.
        // …but only while that premise holds: a locked row its owning source refreshed
        // days ago is being protected, not frozen, and escalating it every run buries
        // the next real failure of this cron. See lockedRowIsFreezing (2026-08-24).
        if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(existingRow)) lockedGuardBlocked.push(`${label}: ${guardReason}`);
        continue;
      }
      const updatePayload: Record<string, unknown> = {
        cases, deaths, date: item.date, source: item.url,
        description, risk_level: riskLevel, active: true,
        source_priority: Math.max(5, existingRow.source_priority ?? 0),
      };
      // English description just changed — existing FR/ES/AR/ID translations
      // (if any) now describe stale figures. Null them so sync-outbreaks'
      // backfill sweep re-translates from the fresh text (it only fires when
      // description_fr IS NULL — see project_sync_outbreaks_paho_translation_drift_fixed).
      if (existingRow.description !== description) {
        updatePayload.description_fr = null;
        updatePayload.description_es = null;
        updatePayload.description_ar = null;
        updatePayload.description_id = null;
      }
      // .select("id") so a source_priority guard that blocks the write (row now
      // owned by a higher-priority source) is visible as 0 affected rows —
      // without it, a blocked update still returns error: null and was
      // reported as "updated" even though nothing changed. Found 2026-07-15.
      const { data: updatedRows, error } = await supabase.from("outbreaks").update(updatePayload)
        .eq("id", existingRow.id).lte("source_priority", 10)
        .select("id");
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else if (!updatedRows || updatedRows.length === 0) {
        log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
        results.skipped++;
      } else { log.push({ label, status: "updated" }); results.updated++; }
    } else {
      const { error } = await supabase.from("outbreaks").insert({
        disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
        country: geo.name_fr, country_en: geo.name_en, country_ar: geo.name_ar,
        region: geo.region, lat: geo.lat, lng: geo.lng,
        cases, deaths, risk_level: riskLevel, date: item.date,
        source: item.url, description, active: true, is_seed: false, is_backfill: false, source_priority: 5,
        admin1: null, admin1_lat: null, admin1_lng: null,
      });
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else { log.push({ label, status: "inserted", detail: `${cases}/${deaths} (${item.date})` }); results.inserted++; }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  // Separate pass: the arbovirus national bulletin is never linked from the
  // news feed above, so its 3 rows (Chikungunya/Dengue fever/West Nile
  // fever, all France) would otherwise never be revisited by this cron at
  // all. See syncFranceArbovirusBulletin for why this can't reuse the loop.
  await syncFranceArbovirusBulletin(supabase, results, log, lockedGuardBlocked, sourceConfirmed);

  // One batched verification stamp for every row the source confirmed
  // unchanged. Never fatal: a failed stamp costs freshness metadata, not
  // data, so it is logged and the run still reports on its actual writes.
  const confirmed = await stampSourceConfirmed(supabase, sourceConfirmed);
  if (confirmed.error) console.error("[spf] source_confirmed_at stamp failed:", confirmed.error);

  console.log("[spf] Done:", results, log, `confirmed=${confirmed.stamped}`);
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[spf] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }
  // Was hardcoded "ok" regardless of results.errors — same bug as
  // sync-outbreaks (2026-07-29).
  await logCronRun(supabase, "sync-spf", results.errors > 0 || lockedGuardBlocked.length > 0 ? "error" : "ok", (results.inserted ?? 0) + (results.updated ?? 0),
    lockedGuardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
      : results.errors > 0 ? `${results.errors} écriture(s) en échec` : undefined,
    // Same pattern as disease-alerts/watchlist-alerts (lib/cron-monitor.ts):
    // stamps the last run where the slow per-article fetch loop actually
    // executed, independent of whether anything got written — see the
    // pagesFetched comment above for why `rows` alone can't answer this.
    results.pagesFetched > 0 ? new Date().toISOString() : undefined);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined, ...results, log });
}
