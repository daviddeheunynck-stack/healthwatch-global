// Malaysia iDengue dashboard sync — runs daily.
//
// Found 2026-08-05 during a QC pass: the Dengue/Malaysia row (source_priority=6,
// manually seeded) was stuck 3+ weeks stale (45,101 cases as of 14 July) while
// the live dashboard already showed 52,907 — no fetcher existed for this source
// at all, and its priority=6 structurally blocked sync-who-regional's own
// dengue aggregate (priority=5) from ever refreshing it in the meantime. This
// cron replaces the dead one-off insert with a recurring fetch, at the same
// priority=6 so it keeps outranking the coarser WHO aggregate going forward —
// same precedent as sync-wpro-dengue-update's Cambodia row (a dedicated
// national source should win over a regional one, see that file's comment).
//
// SOURCE: idengue.mysa.gov.my is Malaysia's Ministry of Health (via CPRC —
// National Crisis Preparedness and Response Centre) live dengue dashboard.
// Despite loading jQuery/Bootstrap for its UI chrome, the national summary
// table itself is plain server-rendered HTML (verified via a raw fetch —
// no JS execution needed): a 3-column table (STATE | daily cases | cumulative
// cases) with a MALAYSIA totals row, and a separate per-state table header
// carrying the reporting date ("...HINGGA <span id='txt'>04 Aug 2026</span>").
//
// Deaths are deliberately NOT extracted: the only death figure on the page
// lives in a static "Dengue Death Case" announcement box that read "16 People,
// January until 25 Feb 2024" on the day this was written — a stale, unrelated
// fragment nobody had updated, not live data. Rather than parse and write a
// number we know is wrong, this cron only ever touches `cases`/`date`, leaving
// `deaths` at its last manually-confirmed value.
//
// Schedule: 0 6 * * * (daily) — cheap single-page fetch, same cadence as the
// other national single-country crons here (sync-taiwan-cdc).

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { assessRisk } from "@/lib/outbreak-parser";
import { dateFloorGuard, collapseGuard, zeroCaseGuard, isYearRollover } from "@/lib/outbreak-guards";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const SOURCE_URL = "https://idengue.mysa.gov.my/ide_v3/index.php";
const SOURCE_PRIORITY = 6; // outranks sync-who-regional's dengue aggregate (5) — see file comment

const FETCH_HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":     "text/html,*/*",
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

interface Extracted { date: string; year: number; cases: number; }

function extract(html: string): Extracted | null {
  // "...TERKUMPUL <br>DARI <span id='txt'>31 DEC 2023</span> HINGGA
  //  <br><span id='txt'> 04 Aug 2026</span>" — the second (HINGGA/"until") date
  // is the as-of date for the cumulative figure below.
  const dateM = html.match(/HINGGA\s*<br>\s*<span id='txt'>\s*(\d{1,2})\s+(\w{3})\w*\s+(\d{4})/i);
  if (!dateM) return null;
  const month = MONTHS[dateM[2].toLowerCase().slice(0, 3)];
  if (!month) return null;
  const day = dateM[1].padStart(2, "0");
  const date = `${dateM[3]}-${String(month).padStart(2, "0")}-${day}`;

  // National summary table: MALAYSIA | <daily> | <!-- kumulatip --> <cumulative>.
  // The HTML comment anchors us onto the SECOND number after "MALAYSIA" (the
  // cumulative one) rather than accidentally grabbing the daily figure twice.
  const casesM = html.match(/MALAYSIA<\/strong>[\s\S]{0,80}?<strong>(\d+)<\/strong>[\s\S]{0,250}?kumulatip[\s\S]{0,80}?<strong>(\d+)<\/strong>/i);
  if (!casesM) return null;

  return { date, year: parseInt(dateM[3], 10), cases: parseInt(casesM[2], 10) };
}

interface Descriptions { en: string; fr: string; es: string; ar: string; id: string; }

// `year` is taken from the HINGGA ("until") date parsed above, never hardcoded
// — same signature as sync-taiwan-cdc's buildDescriptions(), for the same
// reason: this figure is a year-to-date cumulative count, so a literal year in
// the text silently becomes a lie the first time the counter rolls over.
function buildDescriptions(date: string, cases: number, year: number): Descriptions {
  return {
    en: `Malaysia — dengue surveillance (iDengue dashboard, data as of ${date}): ${cases.toLocaleString("en")} cumulative cases in ${year}, per the Ministry of Health (National Crisis Preparedness and Response Centre). Source: iDengue, Ministry of Health Malaysia.`,
    fr: `Malaisie — surveillance de la dengue (tableau de bord iDengue, données au ${date}) : ${cases.toLocaleString("fr")} cas cumulés en ${year}, selon le ministère de la Santé (Centre national de préparation et de réponse aux crises). Source : iDengue, ministère de la Santé de Malaisie.`,
    es: `Malasia — vigilancia del dengue (panel iDengue, datos al ${date}): ${cases.toLocaleString("es")} casos acumulados en ${year}, según el Ministerio de Salud (Centro Nacional de Preparación y Respuesta ante Crisis). Fuente: iDengue, Ministerio de Salud de Malasia.`,
    ar: `ماليزيا — ترصد حمى الضنك (لوحة بيانات iDengue، حتى ${date}): ${cases.toLocaleString("en")} حالة تراكمية في عام ${year}، وفقًا لوزارة الصحة (المركز الوطني للتأهب والاستجابة للأزمات). المصدر: iDengue، وزارة الصحة الماليزية.`,
    id: `Malaysia — surveilans demam berdarah (dasbor iDengue, data per ${date}): ${cases.toLocaleString("en")} kasus kumulatif pada ${year}, menurut Kementerian Kesehatan (Pusat Kesiapsiagaan dan Respons Krisis Nasional). Sumber: iDengue, Kementerian Kesehatan Malaysia.`,
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
    return await runSyncMalaysiaDengue(supabase);
  } catch (err) {
    console.error("[sync-malaysia-dengue] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-malaysia-dengue" } });
    await logCronRun(supabase, "sync-malaysia-dengue", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncMalaysiaDengue(supabase: SupabaseClient) {
  const malaysia = findCountry("Malaysia");
  if (!malaysia) {
    await logCronRun(supabase, "sync-malaysia-dengue", "error", 0, "geo:malaysia missing");
    return NextResponse.json({ error: "geo:malaysia missing" }, { status: 500 });
  }

  const res = await fetch(SOURCE_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    await logCronRun(supabase, "sync-malaysia-dengue", "error", 0, `HTTP ${res.status}`);
    return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
  }
  const html = await res.text();

  const ex = extract(html);
  if (!ex) {
    await logCronRun(supabase, "sync-malaysia-dengue", "error", 0, "extraction failed — page layout may have changed");
    return NextResponse.json({ error: "extraction failed" }, { status: 500 });
  }

  const diseaseInfo = normalizeDisease("Dengue fever");

  // Same "prefer the active row, then highest priority, then most recent"
  // ordering as sync-taiwan-cdc / sync-wpro-dengue-update — see those files'
  // comments for why a bare [0] on an unordered result is unsafe.
  const { data: existingRows, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, cases, deaths, date, source, source_priority, active")
    .eq("country_en", malaysia.name_en)
    .eq("disease_en", diseaseInfo.name_en)
    .order("active", { ascending: false })
    .order("source_priority", { ascending: false })
    .order("date", { ascending: false });
  if (fetchErr) {
    await logCronRun(supabase, "sync-malaysia-dengue", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  const existingRow = (existingRows ?? [])[0];

  // Deactivation is a human decision; re-opening it is too — same
  // anti-resurrection skip as sync-taiwan-cdc / sync-wpro-dengue-update.
  if (existingRow && !existingRow.active) {
    await logCronRun(supabase, "sync-malaysia-dengue", "ok", 0, "row deactivated — not resurrecting");
    return NextResponse.json({
      ok: true,
      status: "skip: row deactivated — not resurrecting (needs a human decision)",
      incoming: ex,
    });
  }

  const knownDeaths = existingRow?.deaths ?? null;
  const desc = buildDescriptions(ex.date, ex.cases, ex.year);
  const riskLevel = assessRisk(diseaseInfo.name_en, desc.en, ex.cases, knownDeaths ?? 0);

  if (existingRow) {
    if (ex.date === existingRow.date && ex.cases === existingRow.cases) {
      await logCronRun(supabase, "sync-malaysia-dengue", "ok", 0);
      return NextResponse.json({ ok: true, status: "unchanged", ...ex });
    }
    // deaths isn't sourced from this page, so guard on cases/date only —
    // pass the existing death count straight through, making the (unused)
    // deaths comparisons in these guards no-ops rather than fabricating one.
    const incoming = { cases: ex.cases, deaths: knownDeaths ?? 0, date: ex.date };
    const existing = { cases: existingRow.cases, deaths: existingRow.deaths, date: existingRow.date };
    // iDengue's cumulative resets every 1 January — a rollover year skips
    // collapseGuard/zeroCaseGuard (a real drop to near-zero, not a parsing
    // accident), but dateFloorGuard still applies unconditionally: a rollover
    // incoming date is always later than existing's, so it never
    // false-triggers on a real rollover, and it must still catch a genuinely
    // stale re-fetch. See lib/outbreak-guards.ts's isYearRollover doc.
    const rollover = isYearRollover(incoming, existing);
    const guardReason = dateFloorGuard(incoming, existing)
      ?? (rollover ? null : collapseGuard(incoming, existing))
      ?? (rollover ? null : zeroCaseGuard(incoming, existing));
    if (guardReason) {
      await logCronRun(supabase, "sync-malaysia-dengue", "ok", 0, guardReason);
      return NextResponse.json({ ok: true, status: `skip: ${guardReason}` });
    }

    const { data: updated, error } = await supabase.from("outbreaks").update({
      cases: ex.cases, date: ex.date, source: SOURCE_URL,
      description: desc.en, description_fr: desc.fr, description_es: desc.es,
      description_ar: desc.ar, description_id: desc.id,
      risk_level: riskLevel, active: true, source_priority: SOURCE_PRIORITY,
    }).eq("id", existingRow.id).lte("source_priority", SOURCE_PRIORITY).select("id");

    if (error) {
      await logCronRun(supabase, "sync-malaysia-dengue", "error", 0, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      await logCronRun(supabase, "sync-malaysia-dengue", "ok", 0, "blocked by source_priority guard");
      return NextResponse.json({ ok: true, status: "blocked by source_priority guard" });
    }
    await logCronRun(supabase, "sync-malaysia-dengue", "ok", 1, rollover ? `year rollover: ${existingRow.cases} (${existingRow.date}) → ${ex.cases} (${ex.date})` : undefined);
    return NextResponse.json({ ok: true, status: "updated", rollover, ...ex });
  }

  const { error: insertErr } = await supabase.from("outbreaks").insert({
    disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
    country: malaysia.name_fr, country_en: malaysia.name_en, country_ar: malaysia.name_ar,
    region: malaysia.region, lat: malaysia.lat, lng: malaysia.lng,
    cases: ex.cases, deaths: null, risk_level: riskLevel, date: ex.date,
    source: SOURCE_URL, description: desc.en, description_fr: desc.fr, description_es: desc.es,
    description_ar: desc.ar, description_id: desc.id,
    active: true, is_seed: false, is_backfill: false, source_priority: SOURCE_PRIORITY,
  });
  if (insertErr) {
    await logCronRun(supabase, "sync-malaysia-dengue", "error", 0, insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  await logCronRun(supabase, "sync-malaysia-dengue", "ok", 1);
  return NextResponse.json({ ok: true, status: "inserted", ...ex });
}
