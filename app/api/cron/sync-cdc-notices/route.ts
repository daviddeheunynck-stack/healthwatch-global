// CDC Travel Health Notices scraper — runs daily at 10:00 UTC.
// Fetches all active CDC Travel Health Notices (Level 1/2/3), extracts
// disease/country/date from notice pages, and upserts to outbreaks.
// Covers diseases and countries often absent from WHO DON:
//   Chikungunya, Hantavirus, Oropouche, RMSF, Sleeping Sickness, etc.
// CDC notices include sub-national province data in their text
// (e.g. "in Ituri, Nord-Kivu, and Sud-Kivu provinces"), which the
// LLM pipeline uses for admin1 extraction.
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logCronRun } from "@/lib/cron-monitor";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry, isAggregateCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { extractAdmin1, geocodeAdmin1 } from "@/lib/geo-extract";
import { errorMessage } from "@/lib/error";
import { truncateAtSentence } from "@/lib/truncate-text";
import { dateFloorGuard, bothZeroGuard, collapseGuard, zeroDeathGuard } from "@/lib/outbreak-guards";

export const dynamic     = "force-dynamic";
export const maxDuration = 120; // up to ~25 notices × ~3s each

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const CDC_NOTICES_URL = "https://wwwnc.cdc.gov/travel/notices";
const CDC_BASE        = "https://wwwnc.cdc.gov";

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  january:"01", february:"02", march:"03", april:"04",
  may:"05",     june:"06",     july:"07",  august:"08",
  september:"09", october:"10", november:"11", december:"12",
};

// CDC level → risk_level field
const LEVEL_TO_RISK: Record<string, string> = {
  level3: "high",
  level2: "medium",
  level1: "low",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Named entities beyond the handful CDC markup uses directly (amp/lt/gt/etc,
// handled below) — mainly accented Latin letters in place names (León, Español).
const NAMED_ENTITIES: Record<string, string> = {
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  aacute: "á", agrave: "à", acirc: "â", auml: "ä",
  iacute: "í", igrave: "ì", icirc: "î", iuml: "ï",
  oacute: "ó", ograve: "ò", ocirc: "ô", ouml: "ö",
  uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü",
  ntilde: "ñ", ccedil: "ç",
  Eacute: "É", Egrave: "È", Aacute: "Á", Agrave: "À",
  Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Ccedil: "Ç",
  ndash: "–", mdash: "—", hellip: "…",
};

function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

// CDC travel notice pages wrap the actual write-up in <div class="notice"> …
// through id="leftNav" (confirmed stable across level1/2/3 notices). Everything
// outside that window is page chrome — skip links, masthead, the "outdated
// browser" banner, footer — which must never leak into a scraped description.
// Returns "" if CDC changes their template rather than falling back to the full
// HTML: the full page's chrome (nav, footer, other-notice links) would otherwise
// feed extractNumbers/parseCDCDate/admin1 extraction wrong data instead of the
// empty-string 0/0 the caller already treats as a visible skip. Found 2026-07-16.
function extractNoticeContent(html: string): string {
  const start = html.indexOf('<div class="notice">');
  if (start < 0) {
    console.warn("[cdc-notices] notice-content selector no longer matches — skipping notice");
    return "";
  }
  const end = html.indexOf('id="leftNav"', start);
  return end > start ? html.slice(start, end) : html.slice(start, start + 8000);
}

function parseCDCDate(text: string): string | null {
  const m = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(20\d{2})\b/i);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  return mo ? `${m[3]}-${mo}-${m[2].padStart(2, "0")}` : null;
}

// Parse CDC notice title into disease + country components.
// "Ebola Bundibugyo Virus Disease in Parts of the DRC" → { disease: "Ebola Bundibugyo Virus Disease", country: "Democratic Republic of the Congo" }
// "Global Dengue"                                      → null (global notice, no country)
// "Diphtheria in Sub-Saharan Africa"                   → parsed but findCountry will fail → caller skips
function parseNoticeTitle(title: string): { disease: string; country: string } | null {
  if (/^global\s/i.test(title)) return null;

  const inIdx = title.search(/\s+in\s+/i);
  if (inIdx < 0) return null;

  const disease     = title.substring(0, inIdx).trim();
  const afterIn     = title.substring(inIdx).replace(/^\s+in\s+/i, "").trim();

  // Strip "Parts of", "the " and trim
  const country = afterIn
    .replace(/^parts\s+of\s+/i, "")
    .replace(/^the\s+/i, "")
    .trim();

  return { disease, country };
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
}

const dcKey = (disease: string | null, country: string | null) =>
  `${(disease ?? "").toLowerCase()}|${(country ?? "").toLowerCase()}`;

function indexRow(byDC: Map<string, ExistingRow>, row: ExistingRow): void {
  const k    = dcKey(row.disease_en, row.country_en);
  const prev = byDC.get(k);
  if (!prev || (row.active && !prev.active)) byDC.set(k, row);
}

// The two dedup snapshots in GET (CDC-sourced rows by URL, plus active/90-day
// rows from all sources) still miss a row that is BOTH non-CDC-sourced AND
// inactive AND older than 90 days — invisible to either query, so an unseen
// row is upserted as an insert (a duplicate) instead of an update. Look the
// targeted row up explicitly before writing it. Same fix as sync-paho-alerts
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
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description")
    .in("disease_en", [...new Set(missing.map((i) => i.disease_en))])
    .in("country_en", [...new Set(missing.map((i) => i.country_en))]);

  if (error) {
    console.warn("[cdc-notices] dedup lookup:", error.message);
    return;
  }
  for (const row of (data ?? []) as ExistingRow[]) indexRow(byDC, row);
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
  const today    = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch notice listing page ─────────────────────────────────────────
  let listHtml: string;
  try {
    const res = await fetch(CDC_NOTICES_URL, {
      headers: FETCH_HEADERS,
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`[cdc-notices] listing HTTP ${res.status}`);
      await logCronRun(supabase, "sync-cdc-notices", "error", 0, `CDC notices HTTP ${res.status}`);
      return NextResponse.json({ error: `CDC notices HTTP ${res.status}` }, { status: 502 });
    }
    listHtml = await res.text();
  } catch (e) {
    console.error("[cdc-notices] fetch listing:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-cdc-notices" } });
    await logCronRun(supabase, "sync-cdc-notices", "error", 0, errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  // ── 2. Parse notice links ─────────────────────────────────────────────────
  interface Notice { path: string; level: string; title: string }
  const seen     = new Set<string>();
  const notices: Notice[] = [];

  for (const m of listHtml.matchAll(/href="(\/travel\/notices\/(level\d)\/[^"]+)"[^>]*>\s*([^<]{8,}?)\s*</g)) {
    const path  = m[1];
    const level = m[2];
    const title = m[3].trim();
    if (seen.has(path) || /read\s+more/i.test(title)) continue;
    seen.add(path);
    notices.push({ path, level, title });
  }

  console.log(`[cdc-notices] Found ${notices.length} notices`);
  if (notices.length === 0) {
    await logCronRun(supabase, "sync-cdc-notices", "no_data", 0);
    return NextResponse.json({ success: true, notices: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 3. Load existing outbreaks for dedup ──────────────────────────────────
  // Fetch all CDC-sourced rows (to catch duplicates by URL regardless of date)
  // plus active/recent rows from all sources (to avoid overwriting WHO DON etc.)
  const [{ data: cdcRows, error: cdcErr }, { data: recentRows, error: recentErr }] = await Promise.all([
    supabase.from("outbreaks").select("id, disease_en, country_en, cases, deaths, date, source, active, description")
      .like("source", "%wwwnc.cdc.gov%"),
    supabase.from("outbreaks").select("id, disease_en, country_en, cases, deaths, date, source, active, description")
      .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10)),
  ]);

  if (cdcErr) {
    await logCronRun(supabase, "sync-cdc-notices", "error", 0, cdcErr.message);
    return NextResponse.json({ error: cdcErr.message }, { status: 500 });
  }
  if (recentErr) {
    await logCronRun(supabase, "sync-cdc-notices", "error", 0, recentErr.message);
    return NextResponse.json({ error: recentErr.message }, { status: 500 });
  }

  // URL-based dedup: set of existing CDC source paths
  const existingSources = new Set<string>(
    (cdcRows ?? []).map((r) => (r.source ?? "").replace(/^https?:\/\/[^/]+/, ""))
  );

  // Disease+country dedup (for cross-source ownership checks)
  const byDC = new Map<string, ExistingRow>();
  for (const row of [...(cdcRows ?? []), ...(recentRows ?? [])] as ExistingRow[]) indexRow(byDC, row);

  // ── 4. Process each notice ────────────────────────────────────────────────
  const results = { notices: notices.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  for (const notice of notices) {
    const parsed = parseNoticeTitle(notice.title);
    if (!parsed) {
      log.push({ label: notice.title, status: "skip", detail: "global notice" });
      results.skipped++;
      continue;
    }

    const diseaseInfo = normalizeDisease(parsed.disease);
    if (!diseaseInfo.name_en) {
      log.push({ label: notice.title, status: "skip", detail: `unknown disease: ${parsed.disease}` });
      results.skipped++;
      continue;
    }

    const geo = findCountry(parsed.country);
    if (!geo || isAggregateCountry(geo)) {
      log.push({ label: notice.title, status: "skip", detail: `country not found or aggregate: ${parsed.country}` });
      results.skipped++;
      continue;
    }

    const label = `${diseaseInfo.name_en}/${geo.name_en}`;

    // Primary dedup: same source URL already in DB
    if (existingSources.has(notice.path)) {
      log.push({ label, status: "skip", detail: "source URL already in DB" });
      results.skipped++;
      continue;
    }

    await loadExistingForItems(supabase, byDC, [{ disease_en: diseaseInfo.name_en, country_en: geo.name_en }]);
    const existRow = byDC.get(dcKey(diseaseInfo.name_en, geo.name_en));

    // Never overwrite WHO DON-owned rows
    if (existRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
      results.skipped++;
      continue;
    }

    // Never overwrite PAHO alert/sitrep-owned rows — a travel notice is never
    // more authoritative than PAHO's own regional bulletin. Same collision
    // family as sync-who-regional vs sync-paho-alerts, latent here (not yet
    // observed in prod) but closed defensively at the same time.
    // See project_diphtheria_haiti_source_priority_collision memory (2026-07-19).
    if (existRow?.source?.includes("paho.org")) {
      log.push({ label, status: "skip", detail: "owned by PAHO alert sync" });
      results.skipped++;
      continue;
    }

    // Fetch the individual notice page
    let pageText = "";
    let pageFetchFailed = false;
    try {
      const res = await fetch(CDC_BASE + notice.path, {
        headers: FETCH_HEADERS,
        signal:  AbortSignal.timeout(12_000),
      });
      if (res.ok) pageText = htmlToText(extractNoticeContent(await res.text()));
      else pageFetchFailed = true;
    } catch (e) {
      pageFetchFailed = true;
      console.warn("[cdc-notices] fetch page:", errorMessage(e));
    }

    // A transient fetch failure (timeout, 5xx) must not be treated the same as a
    // page that was read and genuinely says 0 cases/deaths — extractNumbers("")
    // also returns 0/0, which previously let a dead network request silently
    // deactivate an active row below (guard:0/0 path) even though no notice
    // content was ever read. Found 2026-07-16.
    if (pageFetchFailed) {
      log.push({ label, status: "skip", detail: "notice page unreachable — not evaluated" });
      results.skipped++;
      continue;
    }

    const { cases, deaths } = extractNumbers(pageText);
    const date = parseCDCDate(pageText) ?? today;

    if (date > today) {
      log.push({ label, status: "skip", detail: `future date: ${date}` });
      results.skipped++;
      continue;
    }

    // Level 1/2 notices with no case data are travel advisories for endemic risk,
    // not reportable outbreak events — and never grounds to close an existing row.
    // A travel notice that says nothing about case counts isn't authoritative enough
    // to declare another source's tracked outbreak over; only Level 3 (Warning) is
    // inserted without counts, and Level 3 never deactivates either (see the
    // guard:zero-count skip further below). Previously this branch deactivated any
    // active row at source_priority<=5 whenever a Level 1/2 notice parsed to 0/0.
    // Found 2026-07-17: a Level 2 "Ebola ... DRC and Uganda" notice with no figures
    // closed the ECDC-sourced flagship DRC row (2,073 cases/796 deaths), and a Level 1
    // notice did the same to Diphtheria/Haiti minutes later — see
    // project_ebola_drc_priority10_frozen_no_autofeed memory. Deactivation removed;
    // this is now purely informational.
    if (cases === 0 && deaths === 0 && notice.level !== "level3") {
      log.push({ label, status: "skip", detail: "0/0 cases — endemic advisory, not reportable" });
      results.skipped++;
      continue;
    }

    const riskLevel  = LEVEL_TO_RISK[notice.level] ?? assessRisk(diseaseInfo.name_en, pageText, cases, deaths);
    const description = truncateAtSentence(`CDC Travel Notice (${notice.level.replace("level", "Level ")}) — ${notice.title}. ${truncateAtSentence(pageText, 380)}`, 600);

    // LLM admin1 extraction from full page text
    const admin1 = await extractAdmin1(pageText.substring(0, 3000), geo.name_en);
    let admin1_lat: number | null = null;
    let admin1_lng: number | null = null;
    if (admin1) {
      const coords = await geocodeAdmin1(admin1, geo.name_en);
      if (coords) { admin1_lat = coords.lat; admin1_lng = coords.lng; }
      await new Promise((r) => setTimeout(r, 1100));
    }

    if (existRow) {
      const isNewer   = date > existRow.date;
      const casesDiff = cases !== existRow.cases;

      if (!isNewer && !casesDiff) {
        log.push({ label, status: "skip", detail: "data unchanged" });
        results.skipped++;
        continue;
      }
      // Same guard family as sync-outbreaks, shared via lib/outbreak-guards.ts
      // (2026-08-02). bothZeroGuard is the cdc-notices-specific one: a Level 3
      // notice with no extractable case data (common — travel notices are prose,
      // not case-count bulletins) must not blank out real numbers an
      // authoritative source already established. Found 2026-07-16: a Level 3
      // DRC Ebola notice with 0/0 parsed overwrote 1963/719 from ECDC this way.
      const guardReason =
        dateFloorGuard({ cases, deaths, date }, existRow) ??
        bothZeroGuard({ cases, deaths, date }, existRow) ??
        collapseGuard({ cases, deaths, date }, existRow) ??
        zeroDeathGuard({ cases, deaths, date }, existRow);
      if (guardReason) {
        log.push({ label, status: "skip", detail: guardReason });
        results.skipped++;
        continue;
      }

      const updatePayload: Record<string, unknown> = {
        cases, deaths, date,
        source:          CDC_BASE + notice.path,
        description,
        risk_level:      riskLevel,
        active:          true,
        source_priority: 5,
      };
      // English description just changed — existing FR/ES/AR/ID translations
      // (if any) now describe stale figures. Null them so sync-outbreaks'
      // backfill sweep re-translates from the fresh text (it only fires when
      // description_fr IS NULL — see project_sync_outbreaks_paho_translation_drift_fixed).
      if (existRow.description !== description) {
        updatePayload.description_fr = null;
        updatePayload.description_es = null;
        updatePayload.description_ar = null;
        updatePayload.description_id = null;
      }
      // .select("id") so a source_priority guard that blocks the write (row now
      // owned by a higher-priority source) is visible as 0 affected rows —
      // without it, a blocked update still returns error: null and was
      // reported as "updated" even though nothing changed. Found 2026-07-15.
      const { data: updatedRows, error } = await supabase
        .from("outbreaks")
        .update(updatePayload)
        .eq("id", existRow.id).lte("source_priority", 5)
        .select("id");

      if (error) {
        log.push({ label, status: "error", detail: error.message });
        results.errors++;
      } else if (!updatedRows || updatedRows.length === 0) {
        log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
        results.skipped++;
      } else {
        log.push({ label, status: "updated", detail: date });
        results.updated++;
      }
    } else {
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
        cases,
        deaths,
        risk_level:  riskLevel,
        date,
        source:      CDC_BASE + notice.path,
        description,
        active:      true,
        is_seed:     false,
        is_backfill: false,
        source_priority: 5,
        admin1:      admin1 ?? null,
        admin1_lat:  admin1_lat ?? null,
        admin1_lng:  admin1_lng ?? null,
      });

      if (error) {
        log.push({ label, status: "error", detail: error.message });
        results.errors++;
      } else {
        log.push({ label, status: "inserted", detail: `${date} — ${notice.level}` });
        results.inserted++;
      }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("[cdc-notices] Done:", results, log);
  await logCronRun(supabase, "sync-cdc-notices", "ok", results.inserted ?? 0);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
