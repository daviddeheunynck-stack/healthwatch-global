// Tanzania Ministry of Health weekly community bulletin ("Jarida la Taarifa ya Magonjwa Kwa
// Jamii" / "Jarida la Jamii") — Rotavirus section only. Runs weekly.
//
// Built 2026-09-03 to close a gap the fetcher-coverage probe found the same day (see
// lib/fetcher-coverage.ts, data-quality section 4o): the Rotavirus/Tanzania row (Mafinga Town
// Council, Iringa Region — created 2026-09-02, commit 727c8d79, on David's explicit order from
// this same PDF) had no cron of any kind behind it — a one-off insert, not a subscription.
//
// LEGAL: moh.go.tz is Tanzania's own Ministry of Health, already in
// lib/source-trust.ts's AUTHORITATIVE_SOURCE_DOMAINS (added 2026-09-02 for this exact row) —
// same national-primary-source posture as WHO DON/AFRO/EMRO/PAHO/Africa CDC/ECDC. No ToS or
// confidentiality clause found on the bulletin itself (contrast sync-ncdc, suspended 2026-09-02
// for exactly that on a Nigerian sitrep) or on moh.go.tz generally.
//
// SOURCE FORMAT: the bulletin is published weekly (Swahili, "Jarida la Jamii" / "Wiki NN")
// under https://www.moh.go.tz/resource-center — a general publications archive mixing laws,
// strategic plans, statistics and this bulletin, newest-first, server-rendered HTML (verified
// 2026-09-03: no JS needed, unlike the SPC dashboard sibling built the same day). Discovery:
// find the first PDF link whose text matches "Jarida...la...Jamii" (excludes "Jarida la
// Takwimu", a different statistics bulletin also hosted there).
//
// SCOPE: this bulletin also carries dog/cat-bite, snake-bite, measles, COVID/influenza and
// (this edition) dengue sections — all deliberately NOT extracted here. Rotavirus is the only
// one with an existing `outbreaks` row; adding the others is a straightforward extension of
// `extractRotavirusSection()`'s pattern if a future row needs it, not a limitation of the
// discovery mechanism itself.
//
// STRUCTURE IS NOT GUARANTEED STABLE ACROSS EDITIONS: the bulletin's sections are
// event-driven, not a fixed template — Wiki 33 (2026-08-13 to -19) has no Rotavirus section at
// all (verified 2026-09-03 against the archived edition), and Wiki 35's Dengue section is
// presumably the same. A missing Rotavirus section is treated as "nothing to report this
// edition", not an error — see the early-return below. This is a single hand-tuned regex
// extractor against ONE confirmed sample (Wiki 35) — same risk profile as every other
// custom-PDF fetcher in this repo (sync-taiwan-cdc, sync-drc-sitrep, …), not something a
// generic date/case parser could do given the Swahili prose and event-driven layout.

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
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;
// Schedule: 35 8 * * 1

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const LISTING_URL = "https://www.moh.go.tz/resource-center";

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,application/pdf,*/*",
  "Accept-Language": "sw,en;q=0.8",
};

const MONTHS_SW: Record<string, number> = {
  januari: 0, februari: 1, machi: 2, aprili: 3, mei: 4, juni: 5,
  julai: 6, agosti: 7, septemba: 8, oktoba: 9, novemba: 10, desemba: 11,
};

function parseSwahiliDate(day: string, month: string, year: string): string | null {
  const mon = MONTHS_SW[month.toLowerCase()];
  if (mon === undefined) return null;
  const d = new Date(Date.UTC(parseInt(year, 10), mon, parseInt(day, 10)));
  return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
}

async function findLatestBulletinUrl(): Promise<string | null> {
  const { response: res } = await fetchWithRetry(
    LISTING_URL, { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 10_000, backoffMs: [1000] },
  );
  if (!res || !res.ok) return null;
  const html = await res.text();
  const anchorRe = /<a\s+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const text = m[2].replace(/<[^>]+>/g, " ");
    if (/Jarida[\s_]*la[\s_]*Jamii/i.test(text)) return m[1];
  }
  return null;
}

interface RotavirusData {
  district:        string;
  region:          string;
  startDate:       string | null;
  cumulativeCases: number;
  weeklyCases:     number | null;
  deaths:          number;
  weekNum:         number | null;
  periodEnd:       string | null; // bulletin's own reporting period end date
}

function extractRotavirusSection(text: string): RotavirusData | null {
  const headerRe = /Ugonjwa\s+wa\s+Kuhara\s+wa\s+Virusi\s+vya\s+Rota/gi;
  let lastIdx = -1;
  let hm: RegExpExecArray | null;
  // Two occurrences expected — the table of contents (Yaliyomo) and the real section; the
  // content section always comes last, the TOC entry carries no data to extract anyway.
  while ((hm = headerRe.exec(text))) lastIdx = hm.index;
  if (lastIdx === -1) return null;
  const window = text.slice(lastIdx, lastIdx + 1500);

  const casesM = window.match(/jumla\s+ya\s+wagonjwa\s+(\d[\d,]*)/i);
  if (!casesM) return null; // header present but the expected sentence isn't — bail, don't guess
  const cumulativeCases = parseInt(casesM[1].replace(/,/g, ""), 10);

  const locM = window.match(/Halmashauri\s+ya\s+([^,]+?),\s*Mkoa\s+wa\s+([A-Za-z][A-Za-z\s]*?)\s+tangu/i);
  // The PDF's text layer uses multiple spaces between words (justified-text artifact, seen
  // throughout pdf-parse's output for this source) — collapse before use in prose/admin1.
  const district = locM ? locM[1].replace(/\s+/g, " ").trim() : "";
  const region   = locM ? locM[2].replace(/\s+/g, " ").trim() : "";

  const startM = window.match(/tangu\s+tarehe\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  const startDate = startM ? parseSwahiliDate(startM[1], startM[2], startM[3]) : null;

  const weeklyM = window.match(/wiki\s+hii\s+wagonjwa\s+(\d[\d,]*)\s+wametolewa\s+taarifa/i);
  const weeklyCases = weeklyM ? parseInt(weeklyM[1].replace(/,/g, ""), 10) : null;

  // "hamna vifo (vilivyotolewa taarifa)" = "no deaths (reported)" — the bulletin's own way of
  // stating zero cumulative deaths in prose, checked first; a numeric "vifo N" elsewhere in the
  // section (widget or, in a future edition, a real death count in the same sentence) is the
  // fallback. Deliberately not scoped tighter than the whole section: the only two things that
  // legitimately mention "vifo" here are that sentence and the weekly stat widget, and both
  // report the same figure whenever cases > 0 and no deaths have occurred.
  const deaths = /hamna\s+vifo/i.test(window)
    ? 0
    : (() => { const dm = window.match(/vifo\s+(\d[\d,]*)/i); return dm ? parseInt(dm[1].replace(/,/g, ""), 10) : 0; })();

  const weekM = text.match(/WIKI\s+(\d+)\s*[·.]?\s*(\d{4})/i);
  const weekNum = weekM ? parseInt(weekM[1], 10) : null;

  const periodM = text.match(/(\d{1,2})\s*[—–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  const periodEnd = periodM ? parseSwahiliDate(periodM[2], periodM[3], periodM[4]) : null;

  return { district, region, startDate, cumulativeCases, weeklyCases, deaths, weekNum, periodEnd };
}

interface Descriptions { en: string; fr: string; es: string; ar: string; id: string; }

function buildDescriptions(d: RotavirusData): Descriptions {
  const place = d.district && d.region ? `${d.district}, ${d.region} Region, Tanzania` : "Tanzania";
  const weekLabel = d.weekNum ? `epidemiological week ${d.weekNum}` : "the latest weekly bulletin";
  const period = d.periodEnd ? ` (as of ${d.periodEnd})` : "";
  const weekly = d.weeklyCases !== null ? `, including ${d.weeklyCases} new cases reported this week alone` : "";
  const deathsPhrase = d.deaths > 0 ? `${d.deaths} deaths recorded` : "no deaths recorded";
  const since = d.startDate ? ` first reported ${d.startDate},` : "";
  return {
    en: `Rotavirus infection outbreak in ${place},${since} per Tanzania's Ministry of Health. As of ${weekLabel}${period}, ${d.cumulativeCases} cumulative cases have been confirmed${weekly}; ${deathsPhrase}. Source: Tanzania Ministry of Health, Jarida la Taarifa ya Magonjwa Kwa Jamii (weekly community disease bulletin)${d.weekNum ? `, Week ${d.weekNum}` : ""}.`,
    fr: `Flambée d'infection à rotavirus à ${place},${d.startDate ? ` signalée pour la première fois le ${d.startDate},` : ""} selon le ministère de la Santé de Tanzanie. Au titre de ${d.weekNum ? `la semaine épidémiologique ${d.weekNum}` : "la dernière édition"}${period}, ${d.cumulativeCases} cas cumulés ont été confirmés${d.weeklyCases !== null ? `, dont ${d.weeklyCases} nouveaux cas cette seule semaine` : ""} ; ${d.deaths > 0 ? `${d.deaths} décès enregistrés` : "aucun décès enregistré"}. Source : ministère de la Santé de Tanzanie, Jarida la Taarifa ya Magonjwa Kwa Jamii (bulletin communautaire hebdomadaire)${d.weekNum ? `, semaine ${d.weekNum}` : ""}.`,
    es: `Brote de infección por rotavirus en ${place},${d.startDate ? ` notificado por primera vez el ${d.startDate},` : ""} según el Ministerio de Salud de Tanzania. En ${d.weekNum ? `la semana epidemiológica ${d.weekNum}` : "la última edición"}${period}, se confirmaron ${d.cumulativeCases} casos acumulados${d.weeklyCases !== null ? `, incluidos ${d.weeklyCases} casos nuevos solo esta semana` : ""}; ${d.deaths > 0 ? `${d.deaths} muertes registradas` : "no se registraron muertes"}. Fuente: Ministerio de Salud de Tanzania, Jarida la Taarifa ya Magonjwa Kwa Jamii (boletín comunitario semanal)${d.weekNum ? `, semana ${d.weekNum}` : ""}.`,
    ar: `تفشي عدوى فيروس الروتا في ${place}،${d.startDate ? ` أُبلغ عنه لأول مرة في ${d.startDate}،` : ""} وفقًا لوزارة الصحة في تنزانيا. حتى ${d.weekNum ? `الأسبوع الوبائي ${d.weekNum}` : "آخر نشرة"}${period}، تم تأكيد ${d.cumulativeCases} حالة تراكمية${d.weeklyCases !== null ? `، منها ${d.weeklyCases} حالة جديدة في هذا الأسبوع وحده` : ""}؛ ${d.deaths > 0 ? `${d.deaths} حالة وفاة مسجلة` : "لم تُسجَّل أي وفيات"}. المصدر: وزارة الصحة في تنزانيا، Jarida la Taarifa ya Magonjwa Kwa Jamii (النشرة المجتمعية الأسبوعية)${d.weekNum ? `، الأسبوع ${d.weekNum}` : ""}.`,
    id: `Wabah infeksi rotavirus di ${place},${d.startDate ? ` pertama kali dilaporkan pada ${d.startDate},` : ""} menurut Kementerian Kesehatan Tanzania. Per ${d.weekNum ? `pekan epidemiologi ${d.weekNum}` : "edisi terbaru"}${period}, ${d.cumulativeCases} kasus kumulatif telah dikonfirmasi${d.weeklyCases !== null ? `, termasuk ${d.weeklyCases} kasus baru hanya pada pekan ini` : ""}; ${d.deaths > 0 ? `${d.deaths} kematian tercatat` : "tidak ada kematian yang tercatat"}. Sumber: Kementerian Kesehatan Tanzania, Jarida la Taarifa ya Magonjwa Kwa Jamii (buletin komunitas mingguan)${d.weekNum ? `, Pekan ${d.weekNum}` : ""}.`,
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
    return await runSyncTanzaniaRotavirus(supabase);
  } catch (err) {
    console.error("[sync-tanzania-rotavirus] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-tanzania-rotavirus" } });
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncTanzaniaRotavirus(supabase: SupabaseClient) {
  const tanzania = findCountry("Tanzania");
  if (!tanzania) {
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, "geo:tanzania missing");
    return NextResponse.json({ error: "geo:tanzania missing" }, { status: 500 });
  }

  const pdfUrl = await findLatestBulletinUrl();
  if (!pdfUrl) {
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, "no Jarida la Jamii link found on listing page");
    return NextResponse.json({ error: "listing: no bulletin link found" }, { status: 502 });
  }

  const { response: pdfRes, error: pdfFetchErr, attemptsMade } = await fetchWithRetry(
    pdfUrl, { headers: FETCH_HEADERS }, { attempts: 2, timeoutMs: 15_000, backoffMs: [2000] },
  );
  if (!pdfRes) {
    const msg = `${errorMessage(pdfFetchErr)} (${attemptsMade} tentative(s))`;
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (!pdfRes.ok) {
    const msg = `PDF download HTTP ${pdfRes.status} (${attemptsMade} tentative(s))`;
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let text: string;
  try {
    const buffer = Buffer.from(await pdfRes.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as any)).default as (buf: Buffer, opts?: object) => Promise<{ text: string }>;
    const result = await pdfParse(buffer, { max: 10 });
    text = result.text;
  } catch (e) {
    const msg = `PDF parse failed: ${errorMessage(e)}`;
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const ex = extractRotavirusSection(text);
  if (!ex) {
    // No Rotavirus section in this edition — the bulletin's sections are event-driven (see file
    // header), so this is the ordinary "nothing to report" case, not a broken parser.
    await logCronRun(supabase, "sync-tanzania-rotavirus", "ok", 0, "no Rotavirus section in latest bulletin");
    return NextResponse.json({ ok: true, status: "no_data", pdfUrl });
  }
  if (!ex.periodEnd) {
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, "extraction failed — could not find bulletin period date");
    return NextResponse.json({ error: "extraction failed: no period date" }, { status: 500 });
  }

  const diseaseInfo = normalizeDisease("Rotavirus");
  const desc = buildDescriptions(ex);
  const riskLevel = assessRisk(diseaseInfo.name_en, desc.en, ex.cumulativeCases, ex.deaths);

  // Same "prefer the active row, then highest priority/most recent" ordering as
  // sync-taiwan-cdc/sync-wpro-dengue-update — see their comments for why a bare [0] on an
  // unordered result is unsafe.
  const { data: existingRows, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, cases, deaths, date, source, source_priority, active")
    .eq("country_en", tanzania.name_en)
    .eq("disease_en", diseaseInfo.name_en)
    .order("active", { ascending: false })
    .order("source_priority", { ascending: false })
    .order("date", { ascending: false });
  if (fetchErr) {
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  const existingRow = (existingRows ?? [])[0];

  // Same anti-resurrection scope call as sync-taiwan-cdc/sync-wpro-dengue-update: a
  // deliberately-deactivated row is a human decision, not something this narrow cron re-opens.
  if (existingRow && !existingRow.active) {
    await logCronRun(supabase, "sync-tanzania-rotavirus", "ok", 0, "row deactivated — not resurrecting");
    return NextResponse.json({ ok: true, status: "skip: row deactivated — not resurrecting (needs a human decision)", incoming: ex });
  }

  if (existingRow) {
    if (ex.periodEnd === existingRow.date && ex.cumulativeCases === existingRow.cases && ex.deaths === (existingRow.deaths ?? -1)) {
      const confirmed = await stampSourceConfirmed(supabase, [existingRow.id]);
      if (confirmed.error) console.error("[sync-tanzania-rotavirus] source_confirmed_at stamp failed:", confirmed.error);
      await logCronRun(supabase, "sync-tanzania-rotavirus", "ok", 0);
      return NextResponse.json({ ok: true, status: "unchanged — source confirmed", ...ex });
    }
    if (ex.periodEnd < existingRow.date) {
      await logCronRun(supabase, "sync-tanzania-rotavirus", "ok", 0);
      return NextResponse.json({ ok: true, status: "skip: older than existing row", incoming: ex, existing: existingRow });
    }
    const incoming = { cases: ex.cumulativeCases, deaths: ex.deaths, date: ex.periodEnd };
    const existing = { cases: existingRow.cases, deaths: existingRow.deaths, date: existingRow.date, source_priority: existingRow.source_priority };
    const guardReason = dateFloorGuard(incoming, existing)
      ?? collapseGuard(incoming, existing)
      ?? zeroCaseGuard(incoming, existing)
      ?? zeroDeathGuard(incoming, existing)
      ?? lockedRowRegressionGuard(incoming, existing);
    if (guardReason) {
      const lockedGuardBlocked: string[] = [];
      if (guardReason.startsWith("guard:locked-row-") && lockedRowIsFreezing(existing)) lockedGuardBlocked.push(guardReason);
      if (lockedGuardBlocked.length > 0) {
        Sentry.captureMessage(
          `[sync-tanzania-rotavirus] blocked by anti-regression guard on locked row(s): ${lockedGuardBlocked.join(" | ")}`,
          "warning",
        );
      }
      await logCronRun(supabase, "sync-tanzania-rotavirus", lockedGuardBlocked.length > 0 ? "error" : "ok", 0,
        lockedGuardBlocked.length > 0
          ? `écriture bloquée par le garde anti-régression : ${lockedGuardBlocked.join(" | ")}`
          : guardReason);
      return NextResponse.json({ ok: true, status: `skip: ${guardReason}`, guardBlocked: lockedGuardBlocked.length > 0 ? lockedGuardBlocked : undefined });
    }

    const { data: updated, error } = await supabase.from("outbreaks").update({
      cases: ex.cumulativeCases, deaths: ex.deaths, date: ex.periodEnd, source: pdfUrl,
      description: desc.en, description_fr: desc.fr, description_es: desc.es,
      description_ar: desc.ar, description_id: desc.id,
      risk_level: riskLevel, active: true, source_priority: Math.max(5, existingRow.source_priority ?? 0),
      admin1: ex.region || undefined,
    }).eq("id", existingRow.id).lte("source_priority", 10).select("id");

    if (error) {
      await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      await logCronRun(supabase, "sync-tanzania-rotavirus", "ok", 0, "blocked by source_priority guard");
      return NextResponse.json({ ok: true, status: "blocked by source_priority guard" });
    }
    await logCronRun(supabase, "sync-tanzania-rotavirus", "ok", 1);
    return NextResponse.json({ ok: true, status: "updated", ...ex });
  }

  const { error: insertErr } = await supabase.from("outbreaks").insert({
    disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
    country: tanzania.name_fr, country_en: tanzania.name_en, country_ar: tanzania.name_ar,
    region: tanzania.region, lat: tanzania.lat, lng: tanzania.lng, admin1: ex.region || null,
    cases: ex.cumulativeCases, deaths: ex.deaths, risk_level: riskLevel, date: ex.periodEnd,
    source: pdfUrl, description: desc.en, description_fr: desc.fr, description_es: desc.es,
    description_ar: desc.ar, description_id: desc.id,
    active: true, is_seed: false, is_backfill: false, source_priority: 5,
  });
  if (insertErr) {
    await logCronRun(supabase, "sync-tanzania-rotavirus", "error", 0, insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  await logCronRun(supabase, "sync-tanzania-rotavirus", "ok", 1);
  return NextResponse.json({ ok: true, status: "inserted", ...ex });
}
