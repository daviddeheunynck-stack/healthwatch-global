// Taiwan CDC (衛生福利部疾病管制署) dengue surveillance sync — runs daily.
//
// Found 2026-08-03 while auditing the least-covered regions: Taiwan had ZERO
// rows in `outbreaks` and wasn't even registered in lib/geo-data.ts, despite
// having 111 confirmed dengue cases in 2026 (Kaohsiung local transmission +
// imported cases) and a history of major epidemics (43,000+ cases in 2015).
// It's invisible to every WHO-based source in this product by construction —
// Taiwan is not a WHO member state, so it never appears in WHO DON, WHO WPRO
// Dengue Situation Update, or PSSS, regardless of how those are automated.
//
// LEGAL: Taiwan's National Infectious Disease Statistics System (NIDSS,
// nidss.cdc.gov.tw) publishes this data as part of the "Taiwan CDC Open Data
// Portal" (data.cdc.gov.tw) program, released under the "Open Government
// Data License, version 1.0" (data.gov.tw/license, verified 2026-08-03) —
// explicitly grants non-exclusive, irrevocable, royalty-free use "without
// restriction on purpose" for reproduction, distribution, and building
// "products or services", the only condition being attribution (the source
// link kept in `source`). Compatible with CC BY 4.0 per the license text
// itself. Materially different from — and NOT covered by the same caution
// as — ReliefWeb/ProMED/polioeradication.org/cdc.gov.au, all of which
// restrict commercial reuse; this one explicitly invites it.
//
// SOURCE FORMAT: nidss.cdc.gov.tw/nndss/disease?id=061 (061 = dengue fever)
// is a live query page, not a discrete dated report — it embeds a plain HTML
// summary table with a data-as-of timestamp ("資料更新時間為YYYY/MM/DD HH:MM")
// and a "今年累計數" (this-year cumulative cases) / "今年累計死亡數"
// (this-year cumulative deaths) row. No PDF, no coordinate-based table
// reconstruction needed (contrast with sync-pacific-surveillance) — three
// plain regexes on the raw HTML are enough, verified against a live fetch.
//
// od.cdc.gov.tw (the raw-CSV open-data subdomain also linked from this page)
// was tested and is unreachable from every network path available in this
// session (connection timeout, not an HTTP error) — the nidss.cdc.gov.tw
// page itself IS reachable and already contains the figures we need inline,
// so the CSV endpoint was never actually required.
//
// Schedule: 0 5 * * * (daily) — cheap single-page fetch, no reason to poll
// less often than the other national single-country crons here.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findCountry } from "@/lib/geo-data";
import { assessRisk } from "@/lib/outbreak-parser";
import { dateFloorGuard, collapseGuard, zeroCaseGuard, zeroDeathGuard, isYearRollover } from "@/lib/outbreak-guards";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const SOURCE_URL = "https://nidss.cdc.gov.tw/nndss/disease?id=061";

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,*/*",
  "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
};

interface Extracted { date: string; year: number; cases: number; deaths: number; }

function extract(html: string): Extracted | null {
  const dateM = html.match(/資料更新時間為(\d{4})\/(\d{2})\/(\d{2})/);
  if (!dateM) return null;
  const date = `${dateM[1]}-${dateM[2]}-${dateM[3]}`;

  const casesM = html.match(/(\d{4})年\s*\(今年累計數\)<\/th>\s*<td>(\d+)<\/td>/);
  const deathsM = html.match(/今年累計死亡數<\/th>\s*<td>(\d+)<\/td>/);
  if (!casesM || !deathsM) return null;

  return { date, year: parseInt(casesM[1], 10), cases: parseInt(casesM[2], 10), deaths: parseInt(deathsM[1], 10) };
}

interface Descriptions { en: string; fr: string; es: string; ar: string; id: string; }

function buildDescriptions(date: string, cases: number, deaths: number, year: number): Descriptions {
  return {
    en: `Taiwan CDC — dengue fever surveillance (data as of ${date}): ${cases} cumulative confirmed cases and ${deaths} deaths in ${year}, per the National Infectious Disease Statistics System (NIDSS). Source: Taiwan CDC NIDSS.`,
    fr: `CDC Taïwan — surveillance de la dengue (données au ${date}) : ${cases} cas confirmés cumulés et ${deaths} décès en ${year}, selon le système national de statistiques des maladies infectieuses (NIDSS). Source : CDC Taïwan NIDSS.`,
    es: `CDC de Taiwán — vigilancia del dengue (datos al ${date}): ${cases} casos confirmados acumulados y ${deaths} muertes en ${year}, según el Sistema Nacional de Estadísticas de Enfermedades Infecciosas (NIDSS). Fuente: CDC de Taiwán, NIDSS.`,
    ar: `مركز السيطرة على الأمراض في تايوان — ترصد حمى الضنك (بيانات حتى ${date}): ${cases} حالة مؤكدة تراكمية و${deaths} حالة وفاة في عام ${year}، وفقًا للنظام الوطني لإحصاءات الأمراض المعدية (NIDSS). المصدر: مركز تايوان لمكافحة الأمراض، NIDSS.`,
    id: `CDC Taiwan — surveilans demam berdarah (data per ${date}): ${cases} kasus terkonfirmasi kumulatif dan ${deaths} kematian pada ${year}, menurut Sistem Statistik Penyakit Menular Nasional (NIDSS). Sumber: CDC Taiwan, NIDSS.`,
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
    return await runSyncTaiwanCdc(supabase);
  } catch (err) {
    console.error("[sync-taiwan-cdc] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-taiwan-cdc" } });
    await logCronRun(supabase, "sync-taiwan-cdc", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncTaiwanCdc(supabase: SupabaseClient) {
  const taiwan = findCountry("Taiwan");
  if (!taiwan) {
    await logCronRun(supabase, "sync-taiwan-cdc", "error", 0, "geo:taiwan missing");
    return NextResponse.json({ error: "geo:taiwan missing" }, { status: 500 });
  }

  const res = await fetch(SOURCE_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    await logCronRun(supabase, "sync-taiwan-cdc", "error", 0, `HTTP ${res.status}`);
    return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
  }
  const html = await res.text();

  const ex = extract(html);
  if (!ex) {
    await logCronRun(supabase, "sync-taiwan-cdc", "error", 0, "extraction failed — page layout may have changed");
    return NextResponse.json({ error: "extraction failed" }, { status: 500 });
  }

  const diseaseInfo = normalizeDisease("Dengue fever");
  const desc = buildDescriptions(ex.date, ex.cases, ex.deaths, ex.year);
  const riskLevel = assessRisk(diseaseInfo.name_en, desc.en, ex.cases, ex.deaths);

  // Ordered so an ACTIVE row always wins over an archived one, then the
  // highest-priority / most recent among those — taking a bare [0] out of an
  // unordered result let Postgres pick arbitrarily, so a stale archived row
  // could be updated with this year's figures while the real active row went
  // untouched. Same "prefer the active row" rule as sync-ecdc-threats' byDC
  // map (`row.active && !prev.active`) and sync-wpro-dengue-update's ordered
  // lookup.
  const { data: existingRows, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, cases, deaths, date, source, source_priority, active")
    .eq("country_en", taiwan.name_en)
    .eq("disease_en", diseaseInfo.name_en)
    .order("active", { ascending: false })
    .order("source_priority", { ascending: false })
    .order("date", { ascending: false });
  if (fetchErr) {
    await logCronRun(supabase, "sync-taiwan-cdc", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  const existingRow = (existingRows ?? [])[0];

  // The update payload below sets active:true unconditionally. With the
  // ordering above, reaching this branch on an INACTIVE row means every row
  // for Taiwan/Dengue is archived — i.e. someone deliberately retired the
  // outbreak — so writing to it would silently resurrect it on the next NIDSS
  // refresh. Deactivation is a human decision; re-opening it is too. Same
  // scope call as sync-wpro-dengue-update ("no active row found — not
  // inserting ... it needs a human decision, not a silent re-insert from a
  // narrow-purpose cron") and the anti-resurrection skip in sync-ecdc-threats.
  if (existingRow && !existingRow.active) {
    await logCronRun(supabase, "sync-taiwan-cdc", "ok", 0, "row deactivated — not resurrecting");
    return NextResponse.json({
      ok: true,
      status: "skip: row deactivated — not resurrecting (needs a human decision)",
      incoming: ex,
    });
  }

  if (existingRow) {
    if (ex.date === existingRow.date && ex.cases === existingRow.cases && ex.deaths === (existingRow.deaths ?? -1)) {
      await logCronRun(supabase, "sync-taiwan-cdc", "ok", 0);
      return NextResponse.json({ ok: true, status: "unchanged", ...ex });
    }
    if (ex.date < existingRow.date) {
      await logCronRun(supabase, "sync-taiwan-cdc", "ok", 0);
      return NextResponse.json({ ok: true, status: "skip: older than existing row", incoming: ex, existing: existingRow });
    }
    const incoming = { cases: ex.cases, deaths: ex.deaths, date: ex.date };
    const existing = { cases: existingRow.cases, deaths: existingRow.deaths, date: existingRow.date };
    // NIDSS's "this-year cumulative" cases/deaths both reset every 1 January —
    // a rollover year skips collapse/zero-case/zero-death (a real drop to
    // near-zero, not a parsing accident), but dateFloorGuard still applies
    // unconditionally. Same reasoning as sync-malaysia-dengue; see
    // lib/outbreak-guards.ts's isYearRollover doc. Composed manually here
    // (not regressionGuard()) so the bypass can be scoped per-guard.
    const rollover = isYearRollover(incoming, existing);
    const guardReason = dateFloorGuard(incoming, existing)
      ?? (rollover ? null : collapseGuard(incoming, existing))
      ?? (rollover ? null : zeroCaseGuard(incoming, existing))
      ?? (rollover ? null : zeroDeathGuard(incoming, existing));
    if (guardReason) {
      await logCronRun(supabase, "sync-taiwan-cdc", "ok", 0, guardReason);
      return NextResponse.json({ ok: true, status: `skip: ${guardReason}` });
    }

    const { data: updated, error } = await supabase.from("outbreaks").update({
      cases: ex.cases, deaths: ex.deaths, date: ex.date, source: SOURCE_URL,
      description: desc.en, description_fr: desc.fr, description_es: desc.es,
      description_ar: desc.ar, description_id: desc.id,
      risk_level: riskLevel, active: true, source_priority: 5,
    }).eq("id", existingRow.id).lte("source_priority", 5).select("id");

    if (error) {
      await logCronRun(supabase, "sync-taiwan-cdc", "error", 0, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      await logCronRun(supabase, "sync-taiwan-cdc", "ok", 0, "blocked by source_priority guard");
      return NextResponse.json({ ok: true, status: "blocked by source_priority guard" });
    }
    await logCronRun(supabase, "sync-taiwan-cdc", "ok", 1, rollover ? `year rollover: ${existingRow.cases}/${existingRow.deaths} (${existingRow.date}) → ${ex.cases}/${ex.deaths} (${ex.date})` : undefined);
    return NextResponse.json({ ok: true, status: "updated", rollover, ...ex });
  }

  const { error: insertErr } = await supabase.from("outbreaks").insert({
    disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
    country: taiwan.name_fr, country_en: taiwan.name_en, country_ar: taiwan.name_ar,
    region: taiwan.region, lat: taiwan.lat, lng: taiwan.lng,
    cases: ex.cases, deaths: ex.deaths, risk_level: riskLevel, date: ex.date,
    source: SOURCE_URL, description: desc.en, description_fr: desc.fr, description_es: desc.es,
    description_ar: desc.ar, description_id: desc.id,
    active: true, is_seed: false, is_backfill: false, source_priority: 5,
  });
  if (insertErr) {
    await logCronRun(supabase, "sync-taiwan-cdc", "error", 0, insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  await logCronRun(supabase, "sync-taiwan-cdc", "ok", 1);
  return NextResponse.json({ ok: true, status: "inserted", ...ex });
}
