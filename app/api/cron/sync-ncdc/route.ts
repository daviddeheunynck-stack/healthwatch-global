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
//
// NCDC is Nigeria's own national disease control agency — a genuine primary
// government source for its own country's rows — so this cron can write onto
// rows locked at source_priority=10 (ceiling raised 2026-08-19 alongside
// sync-who-afro/emro — see project_source_priority_is_ownership_not_freeze_
// 2026_08_19). lockedRowRegressionGuard refuses any decrease on a locked row.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";
import { regressionGuard, lockedRowRegressionGuard } from "@/lib/outbreak-guards";

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

interface Descriptions { en: string; fr: string; es: string; ar: string; id: string; }

// Factual description in all 5 site locales, generated directly rather than via
// translation API — so it can never go stale the way a NULL-gated backfill can
// (sync-outbreaks' MyMemory backfill only fires once per row: it stops as soon as
// description_fr is non-null, so it never re-fires when the English source changes).
// Disease names are wrapped in quotes/an idafa construction rather than a definite
// article so the same template works across all CATEGORIES diseases without a
// per-language gender-agreement table. CFR is kept untranslated in every locale,
// matching the site-wide convention (see app/[locale]/methodology/page.tsx).
function buildDescriptions(
  diseaseInfo: { name_en: string; name_fr: string; name_es: string; name_ar: string; name_id: string },
  date: string, confirmed: number, deaths: number, cfr: number, year: number,
): Descriptions {
  const c = confirmed.toLocaleString("en");
  const d = deaths.toLocaleString("en");
  return {
    en: `Nigeria CDC — ${diseaseInfo.name_en} situation report (${date}): ${c} confirmed cases and ${d} deaths (CFR ${cfr}%) cumulative in ${year}. Source: NCDC weekly sitrep.`,
    fr: `CDC Nigeria — rapport de situation « ${diseaseInfo.name_fr} » (${date}) : ${c} cas confirmés et ${d} décès (CFR ${cfr} %) cumulés en ${year}. Source : sitrep hebdomadaire du NCDC.`,
    es: `CDC de Nigeria — informe de situación «${diseaseInfo.name_es}» (${date}): ${c} casos confirmados y ${d} muertes (CFR ${cfr}%) acumulados en ${year}. Fuente: informe semanal del NCDC.`,
    ar: `مركز السيطرة على الأمراض في نيجيريا — تقرير حالة ${diseaseInfo.name_ar} (${date}): ${c} حالة مؤكدة و${d} حالة وفاة (CFR ${cfr}٪) تراكمياً في عام ${year}. المصدر: التقرير الأسبوعي لمركز نيجيريا لمكافحة الأمراض.`,
    id: `CDC Nigeria — laporan situasi ${diseaseInfo.name_id} (${date}): ${c} kasus terkonfirmasi dan ${d} kematian (CFR ${cfr}%) kumulatif pada ${year}. Sumber: sitrep mingguan NCDC.`,
  };
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
// targeted row up explicitly before writing it (single-country cron, so this
// is scoped to Nigeria rather than a batched country list). Same fix as
// sync-paho-alerts (found 2026-07-15, applied here 2026-07-17).
async function loadExistingForDiseases(
  supabase: SupabaseClient,
  byDC: Map<string, ExistingRow>,
  countryEn: string,
  diseaseEnList: string[],
): Promise<void> {
  const missing = diseaseEnList.filter((d) => !byDC.has(dcKey(d, countryEn)));
  if (missing.length === 0) return;

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, source_priority")
    .in("disease_en", [...new Set(missing)])
    .eq("country_en", countryEn);

  if (error) {
    console.warn("[ncdc] dedup lookup:", error.message);
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

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  try {
    return await runSyncNcdc(req, supabase);
  } catch (err) {
    console.error("[sync-ncdc] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-ncdc" } });
    await logCronRun(supabase, "sync-ncdc", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncNcdc(_req: NextRequest, supabase: SupabaseClient) {
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
    .select("id, disease_en, country_en, cases, deaths, date, source, active, source_priority")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));
  if (fetchErr) {
    await logCronRun(supabase, "sync-ncdc", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  const byDC = new Map<string, ExistingRow>();
  for (const row of (existing ?? []) as ExistingRow[]) indexRow(byDC, row);

  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
    (buf: Buffer, opts?: object) => Promise<{ text: string }>;

  const results = { checked: CATEGORIES.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type Log = { label: string; status: string; detail?: string };
  const log: Log[] = [];
  // Refusals from lockedRowRegressionGuard specifically (identified by its
  // "guard:locked-row-…" prefix) — see the push site below for why these,
  // and only these, need to reach the health-check.
  const lockedGuardBlocked: string[] = [];

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

      const desc = buildDescriptions(diseaseInfo, sit.date, ex.confirmed, ex.deaths, ex.cfr, year);
      const riskLevel = assessRisk(diseaseInfo.name_en, desc.en, ex.confirmed, ex.deaths);

      await loadExistingForDiseases(supabase, byDC, nigeria.name_en, [diseaseInfo.name_en]);
      const existingRow = byDC.get(dcKey(diseaseInfo.name_en, nigeria.name_en));

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
        // A sitrep dated earlier than the stored row with different numbers was not
        // caught above (only "unchanged" was) — without this floor a stale re-fetch
        // could still overwrite a more recent row. Same guard family as sync-who-afro.
        if (sit.date < existingRow.date) {
          log.push({ label, status: "skip", detail: `older sitrep (${sit.date}) than existing (${existingRow.date})` });
          results.skipped++;
          continue;
        }
        // Collapse / zero-over-real guards (lib/outbreak-guards.ts) — the date
        // floor above was the only regression guard on this PDF sitrep parser.
        const guardReason = regressionGuard(
          { cases: ex.confirmed, deaths: ex.deaths, date: sit.date },
          existingRow,
        ) ?? lockedRowRegressionGuard(
          { cases: ex.confirmed, deaths: ex.deaths, date: sit.date },
          existingRow,
        );
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
        // .select("id") so a source_priority guard that blocks the write (row now
        // owned by a higher-priority source) is visible as 0 affected rows —
        // without it, a blocked update still returns error: null and was
        // reported as "updated" even though nothing changed. Found 2026-07-15.
        const { data: updatedRows, error } = await supabase.from("outbreaks").update({
          cases: ex.confirmed, deaths: ex.deaths, date: sit.date, source: sit.pdfUrl,
          description: desc.en, description_fr: desc.fr, description_es: desc.es,
          description_ar: desc.ar, description_id: desc.id,
          risk_level: riskLevel, active: true, source_priority: Math.max(5, existingRow.source_priority ?? 0),
        }).eq("id", existingRow.id).lte("source_priority", 10).select("id");
        if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
        else if (!updatedRows || updatedRows.length === 0) {
          log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
          results.skipped++;
        } else { log.push({ label, status: "updated", detail: `${ex.confirmed}/${ex.deaths} (${sit.date})` }); results.updated++; }
      } else {
        const { error } = await supabase.from("outbreaks").insert({
          disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
          country: nigeria.name_fr, country_en: nigeria.name_en, country_ar: nigeria.name_ar,
          region: nigeria.region, lat: nigeria.lat, lng: nigeria.lng,
          cases: ex.confirmed, deaths: ex.deaths, risk_level: riskLevel, date: sit.date,
          source: sit.pdfUrl, description: desc.en, description_fr: desc.fr, description_es: desc.es,
          description_ar: desc.ar, description_id: desc.id,
          active: true, is_seed: false, is_backfill: false, source_priority: 5,
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
  // A locked-row refusal must not pass as a clean run: nothing else will
  // ever retry this row, so a silently-blocked write freezes it on stale
  // figures with nothing to show for it. Surface it as an erroring cron (so
  // it reaches the daily health-check) and in Sentry — same pattern as
  // check-mpox-sitrep/route.ts (2026-08-19).
  if (lockedGuardBlocked.length > 0) {
    Sentry.captureMessage(
      `[ncdc] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
      "warning",
    );
  }
  // Was hardcoded "ok" regardless of results.errors — same bug as
  // sync-outbreaks (2026-07-29).
  await logCronRun(supabase, "sync-ncdc", results.errors > 0 || lockedGuardBlocked.length > 0 ? "error" : "ok", results.inserted + results.updated,
    lockedGuardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
      : results.errors > 0 ? `${results.errors} écriture(s) en échec` : undefined);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined, ...results, log });
}
