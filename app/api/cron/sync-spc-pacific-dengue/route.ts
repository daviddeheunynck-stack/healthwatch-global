// Pacific Community (SPC) epidemic alert dashboard — Dengue rows for the 4 Pacific Island
// Countries and Territories (PICTs) already tracked in `outbreaks` whose dengue figures no
// cron refreshed. Runs daily.
//
// Built 2026-09-03, same fetcher-coverage gap as sync-tanzania-rotavirus (see
// lib/fetcher-coverage.ts, data-quality section 4o): Wallis and Futuna, Marshall Islands,
// Vanuatu and American Samoa each had an active Dengue fever row sourced from spc.int, but no
// cron behind any of them — they were one-off inserts. sync-pacific-surveillance (the other
// SPC-region cron in this repo) does NOT cover this gap: it parses a WHO WPRO syndromic
// (ILI/DLI) surveillance PDF and never writes country-level dengue case counts itself
// (confirmed 2026-09-03 — it only reads existing active dengue rows to decide whether to
// raise a signal). This is a different source (SPC's own dashboard, not WHO WPRO) and a
// different mechanism (a live JSON API, not a PDF table).
//
// SOURCE FORMAT: https://www.spc.int/phd/epidemics/ is a JS-rendered Leaflet map — but its data
// comes from a plain JSON endpoint (found 2026-09-03 via the browser's network log):
// https://www.spc.int/phd/epidemics/api/Epidemy/GetEpidemies?virusId=0&statusId=0&maxDate=&virusGroupId=
// → { epidemy: [ { code, name, data: [ { virus, status, date, cases, deaths, desc, ... } ] } ] }.
// One call covers every PICT in one shot — no per-country fetch needed, unlike the PDF-listing
// crons elsewhere in this repo. A country can report the SAME cumulative total under several
// "Dengue serotype N" entries at once (verified for American Samoa: serotype 1 and 2 both show
// 1,044/0) — this fetcher takes the entry with the highest `cases` among all dengue-labelled
// entries for a target, not the first one, so that never under-reports.
//
// LEGAL: no terms of use or redistribution restriction found on spc.int (checked 2026-09-03 —
// no /terms, /copyright, or footer legal link; a web search turned up nothing beyond a general
// procurement ToS unrelated to this data). The Pacific Public Health Surveillance Network
// (PPHSN) page states its entire purpose is regional epidemic-alert dissemination — the
// opposite posture from ReliefWeb's personal/non-commercial clause or NCDC's per-document
// confidentiality marking (both of which DO explicitly restrict reuse and are excluded
// elsewhere in this repo for exactly that). Same legally-clean posture already applied to
// WHO DON/AFRO/EMRO/PAHO/Africa CDC/ECDC: ingest FACTS (case/death counts, status, date) only —
// `desc` is SPC's own prose citation and is deliberately never copied into this cron's output;
// see buildDescriptions() below, which writes its own sentence from the structured fields only.
//
// SCOPE: the API covers ~9 PICTs and every disease SPC tracks (measles, polio, leptospirosis,
// …), not just these 4 dengue rows — deliberately narrow here to the rows that already exist
// in `outbreaks`, matching today's actual gap rather than opening a wide new intake with no
// existing product surface for it. Extending TARGETS to more countries/diseases is a small,
// mechanical change if a future row needs it.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { assessRisk } from "@/lib/outbreak-parser";
import { dateFloorGuard, collapseGuard, zeroCaseGuard, zeroDeathGuard, lockedRowRegressionGuard, lockedRowIsFreezing } from "@/lib/outbreak-guards";
import { stampSourceConfirmed } from "@/lib/source-confirmed";
import { fetchWithRetry } from "@/lib/fetch-retry";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;
// Schedule: 10 6 * * *

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const API_URL = "https://www.spc.int/phd/epidemics/api/Epidemy/GetEpidemies?virusId=0&statusId=0&maxDate=&virusGroupId=";
const SOURCE_URL = "https://www.spc.int/phd/epidemics/";

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/json,*/*",
};

interface Target { spcCode: string; countryKey: string; }
const TARGETS: Target[] = [
  { spcCode: "AS", countryKey: "American Samoa" },
  { spcCode: "WF", countryKey: "Wallis and Futuna" },
  { spcCode: "VU", countryKey: "Vanuatu" },
  { spcCode: "MH", countryKey: "Marshall Islands" },
];

const MONTHS_EN: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseSpcDate(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS_EN[m[2].toLowerCase()];
  if (mon === undefined) return null;
  const d = new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[1], 10)));
  return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
}

interface SpcEntry { virus: string; status: string; date: string; cases: string | null; deaths: string | null; }
interface SpcCountry { code: string; name: string; data: SpcEntry[]; }

async function fetchSpcData(): Promise<SpcCountry[] | null> {
  const { response: res } = await fetchWithRetry(API_URL, { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 8000, backoffMs: [1000] });
  if (!res || !res.ok) return null;
  try {
    const json = await res.json() as { epidemy?: SpcCountry[] };
    return json.epidemy ?? null;
  } catch {
    return null;
  }
}

interface Found { cases: number; deaths: number; date: string; status: string; }

function bestDengueEntry(country: SpcCountry): Found | null {
  let best: Found | null = null;
  for (const e of country.data) {
    if (!/dengue/i.test(e.virus)) continue;
    const cases = parseInt((e.cases ?? "0").replace(/,/g, ""), 10);
    if (isNaN(cases)) continue;
    const date = parseSpcDate(e.date);
    if (!date) continue;
    if (!best || cases > best.cases) {
      best = { cases, deaths: parseInt((e.deaths ?? "0").replace(/,/g, ""), 10) || 0, date, status: e.status };
    }
  }
  return best;
}

interface Descriptions { en: string; fr: string; es: string; ar: string; id: string; }

function buildDescriptions(countryName: string, f: Found): Descriptions {
  const statusEn = f.status.toLowerCase();
  return {
    en: `Dengue fever in ${countryName}, per the Pacific Community (SPC) epidemic alert dashboard for the Pacific Public Health Surveillance Network (PPHSN). As of ${f.date}, ${f.cases} cumulative cases have been recorded (status: ${statusEn}); ${f.deaths} deaths. Source: SPC/PPHSN epidemic alert dashboard.`,
    fr: `Dengue à ${countryName}, selon le tableau de bord d'alerte épidémique de la Communauté du Pacifique (SPC) pour le réseau PPHSN. Au ${f.date}, ${f.cases} cas cumulés ont été enregistrés (statut : ${statusEn}) ; ${f.deaths} décès. Source : tableau de bord d'alerte épidémique SPC/PPHSN.`,
    es: `Dengue en ${countryName}, según el panel de alertas epidémicas de la Comunidad del Pacífico (SPC) para la red PPHSN. Al ${f.date}, se han registrado ${f.cases} casos acumulados (estado: ${statusEn}); ${f.deaths} muertes. Fuente: panel de alertas epidémicas SPC/PPHSN.`,
    ar: `حمى الضنك في ${countryName}، وفقًا للوحة تنبيهات الأوبئة التابعة لجماعة المحيط الهادئ (SPC) لشبكة PPHSN. حتى ${f.date}، سُجّلت ${f.cases} حالة تراكمية (الحالة: ${statusEn})؛ ${f.deaths} حالة وفاة. المصدر: لوحة تنبيهات الأوبئة SPC/PPHSN.`,
    id: `Demam berdarah dengue di ${countryName}, menurut dasbor peringatan epidemi Komunitas Pasifik (SPC) untuk jaringan PPHSN. Per ${f.date}, ${f.cases} kasus kumulatif telah tercatat (status: ${statusEn}); ${f.deaths} kematian. Sumber: dasbor peringatan epidemi SPC/PPHSN.`,
  };
}

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
    return await runSyncSpcPacificDengue(supabase);
  } catch (err) {
    console.error("[sync-spc-pacific-dengue] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-spc-pacific-dengue" } });
    await logCronRun(supabase, "sync-spc-pacific-dengue", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncSpcPacificDengue(supabase: SupabaseClient) {
  const countries = await fetchSpcData();
  if (!countries) {
    await logCronRun(supabase, "sync-spc-pacific-dengue", "error", 0, "SPC API unreachable or malformed");
    return NextResponse.json({ error: "SPC API unreachable" }, { status: 502 });
  }

  const diseaseInfo = normalizeDisease("Dengue");
  const results: Record<string, string> = {};
  // Never inserted — see the "no existing row" branch below, out-of-scope by design (4 known
  // targets only). Kept in the response shape for symmetry with sync-taiwan-cdc-style crons.
  const inserted = 0;
  let updated = 0, skipped = 0, errors = 0;

  // 4 targets, one shared API call already made above — no per-target network fetch, so no
  // time-budget guard needed (contrast sync-who-regional's TARGET_LOOP_BUDGET_MS).
  for (const target of TARGETS) {
    const countryInfo = findCountry(target.countryKey);
    if (!countryInfo) { results[target.countryKey] = "skip: geo missing"; skipped++; continue; }

    const spcCountry = countries.find((c) => c.code === target.spcCode);
    const found = spcCountry ? bestDengueEntry(spcCountry) : null;
    if (!found) {
      // Absent from the dashboard this run — SPC removed the alert or it never had one this
      // pass. Not evidence the outbreak is over (same philosophy as every other cron here):
      // skip, don't touch the existing row.
      results[target.countryKey] = "skip: no dengue entry on dashboard";
      skipped++;
      continue;
    }

    const { data: existingRows, error: fetchErr } = await supabase
      .from("outbreaks")
      .select("id, cases, deaths, date, source, source_priority, active")
      .eq("country_en", countryInfo.name_en)
      .eq("disease_en", diseaseInfo.name_en)
      .order("active", { ascending: false })
      .order("source_priority", { ascending: false })
      .order("date", { ascending: false });
    if (fetchErr) { results[target.countryKey] = `error: ${fetchErr.message}`; errors++; continue; }
    const existingRow = (existingRows ?? [])[0];

    if (existingRow && !existingRow.active) {
      results[target.countryKey] = "skip: row deactivated — not resurrecting (needs a human decision)";
      skipped++;
      continue;
    }

    if (!existingRow) {
      // No existing row for this PICT/Dengue pair — narrow-purpose cron scoped to 4 known rows
      // (see file header), not a general Pacific dengue intake. Same scope call as
      // sync-taiwan-cdc/sync-wpro-dengue-update make for their own out-of-scope cases.
      results[target.countryKey] = "skip: no existing row for this target — not inserting (out of scope)";
      skipped++;
      continue;
    }

    if (found.date === existingRow.date && found.cases === existingRow.cases && found.deaths === (existingRow.deaths ?? -1)) {
      const confirmed = await stampSourceConfirmed(supabase, [existingRow.id]);
      if (confirmed.error) console.error(`[sync-spc-pacific-dengue] source_confirmed_at stamp failed for ${target.countryKey}:`, confirmed.error);
      results[target.countryKey] = "unchanged — source confirmed";
      skipped++;
      continue;
    }
    if (found.date < existingRow.date) {
      results[target.countryKey] = "skip: older than existing row";
      skipped++;
      continue;
    }

    const incoming = { cases: found.cases, deaths: found.deaths, date: found.date };
    const existing = { cases: existingRow.cases, deaths: existingRow.deaths, date: existingRow.date, source_priority: existingRow.source_priority };
    const guardReason = dateFloorGuard(incoming, existing)
      ?? collapseGuard(incoming, existing)
      ?? zeroCaseGuard(incoming, existing)
      ?? zeroDeathGuard(incoming, existing)
      ?? lockedRowRegressionGuard(incoming, existing);
    if (guardReason) {
      if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(existing)) {
        Sentry.captureMessage(`[sync-spc-pacific-dengue] blocked by anti-regression guard on locked row: ${target.countryKey} — ${guardReason}`, "warning");
      }
      results[target.countryKey] = `skip: ${guardReason}`;
      skipped++;
      continue;
    }

    const desc = buildDescriptions(countryInfo.name_en, found);
    const riskLevel = assessRisk(diseaseInfo.name_en, desc.en, found.cases, found.deaths);

    const { data: updatedRows, error } = await supabase.from("outbreaks").update({
      cases: found.cases, deaths: found.deaths, date: found.date, source: SOURCE_URL,
      description: desc.en, description_fr: desc.fr, description_es: desc.es,
      description_ar: desc.ar, description_id: desc.id,
      risk_level: riskLevel, active: true, source_priority: Math.max(5, existingRow.source_priority ?? 0),
    }).eq("id", existingRow.id).lte("source_priority", 10).select("id");

    if (error) { results[target.countryKey] = `error: ${error.message}`; errors++; continue; }
    if (!updatedRows || updatedRows.length === 0) { results[target.countryKey] = "skip: blocked by source_priority guard"; skipped++; continue; }
    results[target.countryKey] = `updated: ${existingRow.cases}/${existingRow.deaths} (${existingRow.date}) → ${found.cases}/${found.deaths} (${found.date})`;
    updated++;
  }

  const status = errors > 0 ? "error" : "ok";
  await logCronRun(supabase, "sync-spc-pacific-dengue", status, updated, JSON.stringify(results));
  return NextResponse.json({ ok: errors === 0, inserted, updated, skipped, errors, results });
}
