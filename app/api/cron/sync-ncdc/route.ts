// NCDC (Nigeria Centre for Disease Control) sync — runs daily.
// Nigeria is a high-burden outbreak country (Lassa fever, cholera, mpox, diphtheria,
// measles, meningitis, yellow fever) and NCDC publishes weekly situation reports with
// cumulative case/death figures that are often absent from, or ahead of, WHO DON.
//
// LEGAL: NCDC's terms of use are a user-conduct policy with no restriction on reusing
// its published epidemiological data (verified 2026-07-06). We ingest only FACTS
// (cumulative confirmed cases, deaths, CFR, reporting date) plus a link to NCDC's own
// sitrep page — facts are not copyrightable and no NCDC ToS/licence forbids this. This
// is the same legally-clean posture as the WHO DON ingestion. We never copy NCDC prose.
//
// SAFETY (données sûres): a row is accepted only when the extracted (confirmed, deaths)
// pair reproduces the sitrep's OWN stated CFR (±1.5 pts) — a mis-parsed table is skipped,
// never ingested — and only when the sitrep is fresh (< FRESH_DAYS old), so paused/closed
// outbreaks aren't shown as active. Never overwrites rows owned by the WHO DON sync.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const BASE       = "https://ncdc.gov.ng";
const FRESH_DAYS = 60; // only ingest sitreps published within this window
const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/pdf,text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// NCDC disease-sitrep categories → canonical disease name for normalizeDisease().
const CATEGORIES: Array<{ cat: number; disease: string }> = [
  { cat: 5,  disease: "Lassa fever" },
  { cat: 7,  disease: "Cholera" },
  { cat: 8,  disease: "Mpox" },            // NCDC labels this "Monkeypox"
  { cat: 10, disease: "Yellow fever" },
  { cat: 11, disease: "Measles" },
  { cat: 16, disease: "Avian influenza" },
  { cat: 18, disease: "Diphtheria" },
  { cat: 19, disease: "Dengue fever" },
  { cat: 6,  disease: "Meningitis" },
];

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const toNum = (s: string) => parseInt(s.replace(/,/g, ""), 10);

// Parse "6 June 2026" → "2026-06-06" (or null).
function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/);
  if (!m) return null;
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  const d = new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[1], 10)));
  return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
}

interface Cumulative { confirmed: number; deaths: number; cfr: number; }

// Extract cumulative confirmed + deaths for `year` from a sitrep PDF's summary table.
// Column order varies by disease (some tables carry Suspected/Probable, some don't), so
// we take every number in the "<year> Cumulative (week N) … <CFR>%" row and pick the
// (confirmed, deaths) pair whose ratio reproduces the stated CFR. That locates the
// columns AND validates the parse — a mismatch returns null (row skipped).
function extractCumulative(text: string, year: number): Cumulative | null {
  const t  = text.replace(/\s+/g, " ");
  const re = new RegExp(`${year}\\s+Cumulative\\s*\\(week\\s*\\d+\\)\\s+([\\d,\\s]+?)\\s*([\\d.]+)\\s*%`, "i");
  const m  = t.match(re);
  if (!m) return null;
  const nums = (m[1].match(/\d[\d,]*/g) ?? []).map(toNum).filter((n) => Number.isFinite(n));
  const cfr  = parseFloat(m[2]);
  if (nums.length < 2 || !Number.isFinite(cfr)) return null;

  let best: (Cumulative & { diff: number }) | null = null;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const confirmed = nums[i], deaths = nums[j];
      if (confirmed <= 0 || deaths > confirmed) continue;
      const diff = Math.abs((deaths / confirmed) * 100 - cfr);
      if (diff <= 1.5 && (!best || diff < best.diff)) best = { confirmed, deaths, cfr, diff };
    }
  }
  return best ? { confirmed: best.confirmed, deaths: best.deaths, cfr: best.cfr } : null;
}

interface Sitrep { pdfUrl: string; pageUrl: string; date: string; }

// From a disease category page, find the latest sitrep's PDF + reporting date.
async function latestSitrep(cat: number): Promise<Sitrep | null> {
  const pageUrl = `${BASE}/diseases/sitreps/?cat=${cat}`;
  const res = await fetch(pageUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const html = await res.text();
  const pdf  = html.match(/href="(\/themes\/common\/files\/sitreps\/[^"]+\.pdf)"/i)?.[1];
  const date = parseDate(html.match(/for Week\s*\d+\s*[^0-9]*?(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)?.[1] ?? null);
  if (!pdf || !date) return null;
  return { pdfUrl: BASE + pdf, pageUrl, date };
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
  const year     = new Date().getUTCFullYear();
  const freshCutoff = new Date(Date.now() - FRESH_DAYS * 86_400_000).toISOString().substring(0, 10);

  const nigeria = findCountry("Nigeria");
  if (!nigeria) {
    await logCronRun(supabase, "sync-ncdc", "error", 0, "geo:nigeria missing");
    return NextResponse.json({ error: "geo:nigeria missing" }, { status: 500 });
  }

  // Load existing rows for dedup (active + recent), mirroring the other national crons.
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));
  if (fetchErr) {
    await logCronRun(supabase, "sync-ncdc", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  type Row = NonNullable<typeof existing>[number];
  const byDC = new Map<string, Row>();
  for (const row of existing ?? []) {
    const k = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
    (buf: Buffer, opts?: object) => Promise<{ text: string }>;

  const results = { checked: CATEGORIES.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type Log = { label: string; status: string; detail?: string };
  const log: Log[] = [];

  for (const { cat, disease } of CATEGORIES) {
    const diseaseInfo = normalizeDisease(disease);
    const label = `${diseaseInfo.name_en}/Nigeria`;
    try {
      const sit = await latestSitrep(cat);
      if (!sit) { log.push({ label, status: "skip", detail: "no sitrep/date" }); results.skipped++; continue; }

      // Freshness: skip paused/closed outbreaks so stale figures aren't shown as active.
      if (sit.date < freshCutoff || sit.date > today) {
        log.push({ label, status: "skip", detail: `stale (${sit.date})` });
        results.skipped++;
        continue;
      }

      const pdfRes = await fetch(sit.pdfUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30_000) });
      if (!pdfRes.ok) { log.push({ label, status: "skip", detail: `pdf HTTP ${pdfRes.status}` }); results.skipped++; continue; }
      const { text } = await pdfParse(Buffer.from(await pdfRes.arrayBuffer()), { max: 3 });

      const ex = extractCumulative(text, year);
      if (!ex) { log.push({ label, status: "skip", detail: "no CFR-valid cumulative row" }); results.skipped++; continue; }

      const description =
        `Nigeria CDC — ${diseaseInfo.name_en} situation report (${sit.date}): ` +
        `${ex.confirmed.toLocaleString("en")} confirmed cases and ${ex.deaths.toLocaleString("en")} deaths ` +
        `(CFR ${ex.cfr}%) cumulative in ${year}. Source: NCDC weekly sitrep.`;
      const riskLevel = assessRisk(diseaseInfo.name_en, description, ex.confirmed, ex.deaths);

      const dcKey       = `${diseaseInfo.name_en.toLowerCase()}|nigeria`;
      const existingRow = byDC.get(dcKey);

      // Never overwrite rows owned by the WHO DON daily sync.
      if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
        log.push({ label, status: "skip", detail: "owned by WHO DON" });
        results.skipped++;
        continue;
      }

      if (existingRow) {
        if (sit.date <= existingRow.date && ex.confirmed === existingRow.cases && ex.deaths === (existingRow.deaths ?? -1)) {
          log.push({ label, status: "skip", detail: "unchanged" });
          results.skipped++;
          continue;
        }
        const { error } = await supabase.from("outbreaks").update({
          cases: ex.confirmed, deaths: ex.deaths, date: sit.date, source: sit.pdfUrl,
          description, risk_level: riskLevel, active: true, source_priority: 5,
        }).eq("id", existingRow.id).lte("source_priority", 5);
        if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
        else { log.push({ label, status: "updated", detail: `${ex.confirmed}/${ex.deaths} (${sit.date})` }); results.updated++; }
      } else {
        const { error } = await supabase.from("outbreaks").insert({
          disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
          country: nigeria.name_fr, country_en: nigeria.name_en, country_ar: nigeria.name_ar,
          region: nigeria.region, lat: nigeria.lat, lng: nigeria.lng,
          cases: ex.confirmed, deaths: ex.deaths, risk_level: riskLevel, date: sit.date,
          source: sit.pdfUrl, description, active: true, is_seed: false, source_priority: 5,
          admin1: null, admin1_lat: null, admin1_lng: null,
        });
        if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
        else { log.push({ label, status: "inserted", detail: `${ex.confirmed}/${ex.deaths} (${sit.date})` }); results.inserted++; }
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { cron: "sync-ncdc", disease } });
      log.push({ label, status: "error", detail: errorMessage(e) });
      results.errors++;
    }
  }

  console.log("[ncdc] Done:", results, log);
  await logCronRun(supabase, "sync-ncdc", "ok", results.inserted + results.updated);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
