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
import { createClient } from "@supabase/supabase-js";
import { logCronRun } from "@/lib/cron-monitor";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { extractAdmin1, geocodeAdmin1 } from "@/lib/geo-extract";
import { errorMessage } from "@/lib/error";

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

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    supabase.from("outbreaks").select("id, disease_en, country_en, cases, deaths, date, source, active")
      .like("source", "%wwwnc.cdc.gov%"),
    supabase.from("outbreaks").select("id, disease_en, country_en, cases, deaths, date, source, active")
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

  type Row = NonNullable<typeof cdcRows>[number];

  // URL-based dedup: set of existing CDC source paths
  const existingSources = new Set<string>(
    (cdcRows ?? []).map((r) => (r.source ?? "").replace(/^https?:\/\/[^/]+/, ""))
  );

  // Disease+country dedup (for cross-source ownership checks)
  const byDC = new Map<string, Row>();
  for (const row of [...(cdcRows ?? []), ...(recentRows ?? [])]) {
    const k    = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

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
    if (!geo) {
      log.push({ label: notice.title, status: "skip", detail: `country not found: ${parsed.country}` });
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

    const dcKey = `${diseaseInfo.name_en.toLowerCase()}|${geo.name_en.toLowerCase()}`;
    const existRow = byDC.get(dcKey);

    // Never overwrite WHO DON-owned rows
    if (existRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
      results.skipped++;
      continue;
    }

    // Fetch the individual notice page
    let pageText = "";
    try {
      const res = await fetch(CDC_BASE + notice.path, {
        headers: FETCH_HEADERS,
        signal:  AbortSignal.timeout(12_000),
      });
      if (res.ok) pageText = htmlToText(await res.text());
    } catch (e) {
      console.warn("[cdc-notices] fetch page:", errorMessage(e));
    }

    const { cases, deaths } = extractNumbers(pageText);
    const date = parseCDCDate(pageText) ?? today;

    if (date > today) {
      log.push({ label, status: "skip", detail: `future date: ${date}` });
      results.skipped++;
      continue;
    }

    // Level 1/2 notices with no case data are travel advisories for endemic risk,
    // not reportable outbreak events. Only Level 3 (Warning) is inserted without counts.
    if (cases === 0 && deaths === 0 && notice.level !== "level3") {
      if (existRow?.active) {
        await supabase.from("outbreaks").update({ active: false }).eq("id", existRow.id);
        log.push({ label, status: "deactivated", detail: "0/0 cases — endemic advisory" });
      } else {
        log.push({ label, status: "skip", detail: "0/0 cases — endemic advisory, not inserted" });
      }
      results.skipped++;
      continue;
    }

    const riskLevel  = LEVEL_TO_RISK[notice.level] ?? assessRisk(diseaseInfo.name_en, pageText, cases, deaths);
    const description = `CDC Travel Notice (${notice.level.replace("level", "Level ")}) — ${notice.title}. ${pageText.substring(0, 380)}`.substring(0, 600);

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

      const { error } = await supabase
        .from("outbreaks")
        .update({
          cases, deaths, date,
          source:          CDC_BASE + notice.path,
          description,
          risk_level:      riskLevel,
          active:          true,
          source_priority: 5,
        })
        .eq("id", existRow.id).lte("source_priority", 5);

      if (error) {
        log.push({ label, status: "error", detail: error.message });
        results.errors++;
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
