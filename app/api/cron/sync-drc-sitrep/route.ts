// Daily (07:00 UTC): originally detected new WHO AFRO Ebola DRC situation reports via
// ReliefWeb, downloaded the PDF, extracted DRC cumulative case/death figures, and updated
// the DB. Sitrep detection is now permanently disabled (see fetchLatestSitrep — legal,
// ReliefWeb ToS) so steps 2+ never run; only the Step-1 "Ebola DRC row missing" safety
// check still fires. Ebola DRC figures are kept fresh via sync-who-afro (WHO Disease
// Outbreak News) instead.
// source_priority: 10 — highest tier, never overwritten by automated crons.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/error";
import { regressionGuard } from "@/lib/outbreak-guards";
import * as Sentry from "@sentry/nextjs";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

const ADMIN_PANEL_URL   = "https://healthwatch-global.com/fr/admin";

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,application/pdf,*/*",
  "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
};

const MONTHS: Record<string, string> = {
  jan:"01", january:"01",    janvier:"01",
  feb:"02", february:"02",   février:"02", fevrier:"02",
  mar:"03", march:"03",      mars:"03",
  apr:"04", april:"04",      avril:"04",
  may:"05", mai:"05",
  jun:"06", june:"06",       juin:"06",
  jul:"07", july:"07",       juillet:"07",
  aug:"08", august:"08",     août:"08",   aout:"08",
  sep:"09", september:"09",  septembre:"09",
  oct:"10", october:"10",    octobre:"10",
  nov:"11", november:"11",   novembre:"11",
  dec:"12", december:"12",   décembre:"12", decembre:"12",
};

// ── 1. Find Ebola DRC outbreak row ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findEbolaDrcRow(supabase: any) {
  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, cases, deaths, date, source_priority")
    .ilike("disease_en", "%ebola%")
    .ilike("country_en", "%Congo%")
    .order("source_priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.log("[drc-sitrep] Could not find Ebola DRC row:", error?.message);
    return null;
  }
  return data as { id: string; cases: number; deaths: number; date: string; source_priority: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findBvdCountryRow(supabase: any, countryEn: string) {
  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, cases, deaths, date, source_priority")
    .or("disease_en.ilike.%bundibugyo%,disease_en.ilike.%ebola%")
    .ilike("country_en", `%${countryEn}%`)
    .eq("active", true)
    .order("source_priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.log(`[drc-sitrep] BVD row not found for ${countryEn}:`, error?.message ?? "no row");
    return null;
  }
  return data as { id: string; cases: number; deaths: number; date: string; source_priority: number };
}

// ── 2. Latest situation report discovery — DISABLED (legal) ──────────────────
// Previously discovered + downloaded DRC Ebola sitrep PDFs via the ReliefWeb API.
// Removed: ReliefWeb's ToS permits personal, non-commercial use only, so use in this
// commercial product breaches it (same as the ProMED C&D — see legal_reliefweb_noncommercial).
// DRC Ebola figures come from WHO Disease Outbreak News via the main sync path instead.

async function fetchLatestSitrep(): Promise<{ pageUrl: string; pdfUrl: string | null; num: number; reliefwebError?: boolean } | null> {
  // DISABLED (legal) — this discovered + downloaded DRC Ebola sitrep PDFs via ReliefWeb,
  // whose terms permit "personal, non-commercial use" only (no redistribution of
  // third-party copyrighted reports). HealthWatch Global is commercial => breach, the
  // same legal shape as the ProMED C&D. DRC Ebola is covered by WHO Disease Outbreak News.
  // See legal_reliefweb_noncommercial. Returns null so the cron logs a clean no_data.
  return null;
}

// ── 3. Download PDF + extract DRC cumulative figures ─────────────────────────

interface SitrepData {
  cases:  number;
  deaths: number;
  date:   string; // YYYY-MM-DD
  num:    number;
}

async function extractFromPdf(pdfUrl: string, num: number): Promise<{ data: SitrepData | null; text: string | null }> {
  let buffer: Buffer;
  try {
    const res = await fetch(pdfUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.log(`[drc-sitrep] PDF download → HTTP ${res.status}`); return { data: null, text: null }; }
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.log("[drc-sitrep] PDF download:", errorMessage(e));
    return { data: null, text: null };
  }

  let text: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as any)).default as (buf: Buffer, opts?: object) => Promise<{ text: string }>;
    const result   = await pdfParse(buffer, { max: 5 });
    text = result.text;
  } catch (e) {
    console.log("[drc-sitrep] pdf-parse error:", errorMessage(e));
    return { data: null, text: null };
  }

  return { data: parseSitrepText(text, num, pdfUrl), text };
}

function parseSitrepText(text: string, num: number, url: string): SitrepData | null {
  const t = text.replace(/[ \t]+/g, " ").replace(/\r/g, "");

  // Extract date — look for "as of DD Month YYYY" or "au DD mois YYYY" or "Date: DD/MM/YYYY"
  let date: string | null = null;

  // Pattern: "as of D Month YYYY" or "Au D mois YYYY"
  const dateRe = /(?:as\s+of|au|du)\s+(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i;
  const dateMatch = dateRe.exec(t);
  if (dateMatch) {
    const month = MONTHS[dateMatch[2].toLowerCase()];
    if (month) date = `${dateMatch[3]}-${month}-${dateMatch[1].padStart(2, "0")}`;
  }

  // Fallback: "DD/MM/YYYY" near "date de situation" or "situation date"
  if (!date) {
    const ddmmRe = /(?:situation\s+date|date\s+de\s+situation)[^0-9]{0,20}(\d{2})\/(\d{2})\/(\d{4})/i;
    const ddmmMatch = ddmmRe.exec(t);
    if (ddmmMatch) date = `${ddmmMatch[3]}-${ddmmMatch[2]}-${ddmmMatch[1]}`;
  }

  if (!date) {
    console.log("[drc-sitrep] parseSitrepText: no date found. Excerpt:", t.substring(0, 400));
    return null;
  }

  // Extract DRC cumulative confirmed cases and deaths.
  // Typical sitrep rows (EN or FR):
  //   "Confirmed cases  1 203   321   Deaths"
  //   "Cas confirmés cumulés  1 203   Décès confirmés  321"
  //   "Total cumulative confirmed  1,203  confirmed deaths  321"
  const casesRe = /(?:confirmed\s+cases?|cas\s+confirm[eé]s?(?:\s+cumulatifs?|\s+cumulés?)?)\s*[:\-–]?\s*([\d\s,.]+?)(?:\s+(?:confirmed\s+)?deaths?|d[eé]c[eè]s|$)/i;
  const casesMatch = casesRe.exec(t);
  if (!casesMatch) {
    console.log("[drc-sitrep] parseSitrepText: no case count found. Excerpt:", t.substring(0, 500));
    return null;
  }

  const cases = parseInt(casesMatch[1].replace(/[\s,.]/g, ""), 10);

  // Deaths: look right after cases match, or in nearby text
  const afterCases = t.slice(casesMatch.index, casesMatch.index + casesMatch[0].length + 200);
  const deathsRe   = /(?:deaths?|d[eé]c[eè]s)\s*[:\-–]?\s*([\d\s,.]+?)(?:\s|$)/i;
  const deathsMatch = deathsRe.exec(afterCases);
  const deaths = deathsMatch ? parseInt(deathsMatch[1].replace(/[\s,.]/g, ""), 10) : 0;

  if (isNaN(cases) || cases < 100 || deaths < 0 || deaths > cases) {
    console.log("[drc-sitrep] parseSitrepText: implausible values", { cases, deaths, url });
    return null;
  }

  return { cases, deaths, date, num };
}

function extractDate(text: string): string | null {
  const t = text.replace(/[ \t]+/g, " ").replace(/\r/g, "");
  const m = /(?:as\s+of|au|du)\s+(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i.exec(t);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  return month ? `${m[3]}-${month}-${m[1].padStart(2, "0")}` : null;
}

// Word-to-number for small counts used in WHO sitrep prose ("two confirmed deaths")
const WORDS_TO_NUM: Record<string, number> = {
  zero:0,one:1,two:2,three:3,four:4,five:5,
  six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,
  sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,
};
function wordOrNum(s: string): number {
  const n = parseInt(s.replace(/[\s,]/g, ""), 10);
  if (!isNaN(n)) return n;
  return WORDS_TO_NUM[s.toLowerCase().trim()] ?? -1;
}
const WORD_OR_NUM = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\\d+)";

function parseCountryRow(text: string, country: string): { cases: number; deaths: number } | null {
  const t = text.replace(/\r/g, "");

  // ── Uganda: parse from WHO sitrep prose body (page 4+) ──────────────────
  // Template: "cumulative total of N cases (M confirmed and ... probable),
  //            including Q deaths (R confirmed and ... probable)"
  // The summary table is unreliable (DRC+Uganda numbers appear merged in the
  // same column, so DRC's large count precedes Uganda's in the extracted text).
  if (country === "Uganda") {
    const re = new RegExp(
      `cumulative total of \\d+ cases? \\((\\d+) confirmed[^)]*\\)[\\s\\S]{1,800}?` +
      `including\\s+(?:${WORD_OR_NUM})\\s+deaths?\\s*\\((${WORD_OR_NUM})\\s+confirmed`,
      "i",
    );
    const m = re.exec(t);
    if (m) {
      const cases  = parseInt(m[1], 10);
      const deaths = wordOrNum(m[2]);
      if (!isNaN(cases) && deaths >= 0 && deaths <= cases) {
        console.log(`[drc-sitrep] Uganda (prose): cases=${cases}, deaths=${deaths}`);
        return { cases, deaths };
      }
    }
    // Prose section not found — happens when the PDF format changes or page limit is reached.
    console.log("[drc-sitrep] Uganda: prose pattern not found — skipping update");
    return null;
  }

  // ── France + future satellite countries: standalone table row ────────────
  // France always occupies its own row at the end of the summary table, so
  // the default pdftotext output is clean: "France\n1\n0\n0\n0\n..."
  // WHO weekly sitrep columns: Confirmed Cases | Confirmed Deaths | Probable Cases | Probable Deaths | ...
  // WHO weekly sitrep: country name appears multiple times (title, table, body).
  // Iterate ALL occurrences and take the first that passes sanity checks —
  // the header occurrence (e.g. "France\nWeekly External Sitrep…") produces
  // implausible numbers (deaths > cases) that the sanity check rejects,
  // while the summary-table occurrence produces the correct confirmed figures.
  const NAMES: Record<string, string[]> = { France: ["France"] };
  const names = NAMES[country] ?? [country];
  const tn = t.replace(/[ \t]+/g, " ");

  for (const name of names) {
    for (const match of tn.matchAll(new RegExp("\\b" + name + "\\b", "gi"))) {
      const idx = (match.index ?? 0) + name.length;
      const context = tn.slice(idx, idx + 300);
      const nums = Array.from(
        context.matchAll(/(\d{1,3}(?:[\s,]\d{3})*|\d+)/g),
        (m) => parseInt(m[1].replace(/[\s,]/g, ""), 10),
      ).filter((n) => !isNaN(n) && n < 100_000);

      if (nums.length < 2) continue;
      // cols: [0]=Confirmed Cases, [1]=Confirmed Deaths, [2]=Probable Cases, ...
      const cases  = nums[0];
      const deaths = nums[1];
      if (cases < 0 || deaths < 0 || deaths > cases) continue;

      console.log(`[drc-sitrep] ${country} (table): cases=${cases}, deaths=${deaths}`);
      return { cases, deaths };
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateSatelliteCountry(supabase: any, countryEn: string, cases: number, deaths: number, date: string, source: string): Promise<boolean> {
  const row = await findBvdCountryRow(supabase, countryEn);
  if (!row) return false;
  if (row.cases === cases && row.deaths === deaths) {
    console.log(`[drc-sitrep] ${countryEn}: already up to date (${cases}/${deaths})`);
    return false;
  }
  // Date floor + collapse / zero-over-real guards (lib/outbreak-guards.ts).
  // This updater had none of them: it wrote whatever the sitrep PDF parser
  // produced straight onto the satellite country rows, with only the
  // source_priority ownership check on the chain below. Those are the very
  // rows behind the three real Ebola/DRC overwrites of 2026-07-15.
  const guardReason = regressionGuard({ cases, deaths, date }, row);
  if (guardReason) {
    console.warn(`[drc-sitrep] ${countryEn}: ${guardReason} — skipping`);
    return false;
  }
  // .select("id") so a source_priority guard that blocks the write (row now
  // owned by a higher-priority source) is visible as 0 affected rows —
  // without it, a blocked update still returns error: null and this function
  // would return true (success) even though nothing changed. Found 2026-07-15.
  const desc = buildSatelliteDescriptions(countryEn, cases, deaths, date);
  const { data: updatedRows, error } = await supabase
    .from("outbreaks")
    .update({
      cases, deaths, date, source,
      description:     desc.en,
      description_fr:  desc.fr,
      description_es:  desc.es,
      description_ar:  desc.ar,
      description_id:  desc.id,
      updated_at:      new Date().toISOString(),
      source_priority: 5,
    })
    .eq("id", row.id)
    .lte("source_priority", 5)
    .select("id");

  if (error) {
    console.error(`[drc-sitrep] ${countryEn} DB error:`, error.message);
    return false;
  }
  if (!updatedRows || updatedRows.length === 0) {
    console.error(`[drc-sitrep] ${countryEn} update blocked by source_priority guard — row owned by a higher-priority source`);
    return false;
  }
  console.log(`[drc-sitrep] ✅ ${countryEn}: ${cases} cas / ${deaths} décès / ${date}`);
  return true;
}

// ── 3bis. Multi-locale descriptions ──────────────────────────────────────────
// Generated directly (not via translation API) so description_fr/es/ar/id can
// never freeze out of sync with `description` the way a NULL-gated translation
// backfill can — same rationale as check-mpox-sitrep's buildGlobalDescriptions/
// buildDrcDescriptions, and the exact defect (item 15) this route was flagged
// for by daily-security-audit-healthwatch since 2026-08-10: both .update()
// calls below wrote cases/deaths/date without ever touching description.
// Currently dead code — fetchLatestSitrep() is permanently disabled (see its
// own comment) so neither updater can run — but fixed now so the defect can't
// resurface silently if the sitrep source is ever reactivated.

interface Descriptions { en: string; fr: string; es: string; ar: string; id: string; }

function buildMainDescriptions(cases: number, deaths: number, date: string): Descriptions {
  const c   = cases.toLocaleString("en");
  const d   = deaths.toLocaleString("en");
  const cfr = cases > 0 ? ((deaths / cases) * 100).toFixed(1) : "0.0";
  return {
    en: `Ebola disease caused by Bundibugyo virus in the Democratic Republic of the Congo. WHO situation report: ${c} confirmed cases and ${d} deaths cumulative, a case fatality ratio of ${cfr}%, as of ${date}. Declared a Public Health Emergency of International Concern (PHEIC). Source: WHO Ebola DRC situation report.`,
    fr: `Maladie à virus Ebola causée par le virus Bundibugyo en République démocratique du Congo. Rapport de situation OMS : ${c} cas confirmés et ${d} décès cumulés, soit un taux de létalité de ${cfr.replace(".", ",")} %, au ${date}. Déclarée Urgence de Santé Publique de Portée Internationale (USPPI). Source : rapport de situation OMS sur l'épidémie d'Ebola en RDC.`,
    es: `Enfermedad del Ébola causada por el virus Bundibugyo en la República Democrática del Congo. Informe de situación de la OMS: ${c} casos confirmados y ${d} muertes acumuladas, una tasa de letalidad del ${cfr.replace(".", ",")} %, al ${date}. Declarada Emergencia de Salud Pública de Importancia Internacional (ESPII). Fuente: informe de situación de la OMS sobre el Ébola en la RDC.`,
    ar: `مرض الإيبولا الناجم عن فيروس بونديبوغيو في جمهورية الكونغو الديمقراطية. تقرير حالة منظمة الصحة العالمية: ${c} حالة مؤكدة و${d} حالة وفاة تراكمية، بمعدل إماتة ${cfr}%، حتى ${date}. أُعلن طارئة صحية عامة تثير قلقاً دولياً. المصدر: تقرير حالة منظمة الصحة العالمية بشأن الإيبولا في جمهورية الكونغو الديمقراطية.`,
    id: `Penyakit Ebola yang disebabkan oleh virus Bundibugyo di Republik Demokratik Kongo. Laporan situasi WHO: ${c} kasus terkonfirmasi dan ${d} kematian kumulatif, tingkat fatalitas kasus ${cfr}%, per ${date}. Dinyatakan sebagai Kedaruratan Kesehatan Masyarakat yang Meresahkan Dunia (PHEIC). Sumber: laporan situasi WHO tentang Ebola di RD Kongo.`,
  };
}

const SATELLITE_COUNTRY_NAMES: Record<string, { fr: string; es: string; ar: string; id: string }> = {
  Uganda: { fr: "en Ouganda",   es: "en Uganda",  ar: "في أوغندا",  id: "di Uganda" },
  France: { fr: "en France",    es: "en Francia", ar: "في فرنسا",   id: "di Prancis" },
};

function buildSatelliteDescriptions(countryEn: string, cases: number, deaths: number, date: string): Descriptions {
  const c     = cases.toLocaleString("en");
  const d     = deaths.toLocaleString("en");
  const names = SATELLITE_COUNTRY_NAMES[countryEn] ?? { fr: `en ${countryEn}`, es: `en ${countryEn}`, ar: `في ${countryEn}`, id: `di ${countryEn}` };
  return {
    en: `Ebola disease caused by Bundibugyo virus — cases linked to the Democratic Republic of the Congo outbreak, reported in ${countryEn}. WHO situation report: ${c} cumulative confirmed cases and ${d} deaths in ${countryEn}, as of ${date}. Source: WHO Ebola DRC situation report.`,
    fr: `Maladie à virus Ebola (souche Bundibugyo) — cas liés à l'épidémie de République démocratique du Congo, signalés ${names.fr}. Rapport de situation OMS : ${c} cas confirmés cumulés et ${d} décès ${names.fr}, au ${date}. Source : rapport de situation OMS sur l'épidémie d'Ebola en RDC.`,
    es: `Enfermedad del Ébola (cepa Bundibugyo) — casos vinculados al brote de la República Democrática del Congo, notificados ${names.es}. Informe de situación de la OMS: ${c} casos confirmados acumulados y ${d} muertes ${names.es}, al ${date}. Fuente: informe de situación de la OMS sobre el Ébola en la RDC.`,
    ar: `مرض الإيبولا (سلالة بونديبوغيو) — حالات مرتبطة بتفشي جمهورية الكونغو الديمقراطية، أُبلغ عنها ${names.ar}. تقرير حالة منظمة الصحة العالمية: ${c} حالة مؤكدة تراكمية و${d} حالة وفاة ${names.ar}، حتى ${date}. المصدر: تقرير حالة منظمة الصحة العالمية بشأن الإيبولا في جمهورية الكونغو الديمقراطية.`,
    id: `Penyakit Ebola (galur Bundibugyo) — kasus terkait wabah Republik Demokratik Kongo, dilaporkan ${names.id}. Laporan situasi WHO: ${c} kasus terkonfirmasi kumulatif dan ${d} kematian ${names.id}, per ${date}. Sumber: laporan situasi WHO tentang Ebola di RD Kongo.`,
  };
}

// ── 4. Email helpers ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY || !to) return;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  // Was previously a bare .catch() that only saw network-level exceptions — a
  // non-2xx Brevo response resolved normally and was silently discarded, so
  // logCronRun still recorded "ok" even though no email went out. Throwing
  // here lets the route's own defensive wrapper below log a real "error"
  // status instead (found 2026-08-11, same pattern in sync-pacific-surveillance).
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo error ${res.status}: ${body.slice(0, 500)}`);
  }
}

function emailAutoUpdated(data: SitrepData) {
  return {
    subject: `✅ Ébola RDC mis à jour — Sitrep N°${data.num}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
        <h2 style="border-bottom:2px solid #16a34a;padding-bottom:8px;color:#16a34a">
          ✅ Ébola / RDC — Sitrep N°${data.num} intégré automatiquement
        </h2>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr style="background:#f3f4f6">
            <td style="padding:8px 12px;font-weight:bold">Cas confirmés cumulés</td>
            <td style="padding:8px 12px;font-size:1.2em;font-weight:bold;color:#dc2626">${data.cases.toLocaleString("fr-FR")}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:bold">Décès confirmés</td>
            <td style="padding:8px 12px">${data.deaths.toLocaleString("fr-FR")}</td>
          </tr>
          <tr style="background:#f3f4f6">
            <td style="padding:8px 12px;font-weight:bold">Date de situation</td>
            <td style="padding:8px 12px">${data.date}</td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:13px">Source: sitrep N°${data.num} — extraction automatique PDF. Vérification conseillée.</p>
        <p>
          <a href="${ADMIN_PANEL_URL}" style="display:inline-block;background:#111827;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold">
            ⚙️ Vérifier dans Admin
          </a>
        </p>
      </div>`,
  };
}

function emailManualNeeded(num: number, sitrepUrl: string) {
  return {
    subject: `⚠️ Nouveau sitrep Ébola RDC N°${num} — mise à jour manuelle requise`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
        <h2 style="border-bottom:2px solid #f59e0b;padding-bottom:8px;color:#b45309">
          ⚠️ Sitrep Ébola RDC N°${num} détecté — extraction PDF échouée
        </h2>
        <p>Le sitrep a été détecté mais l'extraction automatique a échoué.</p>
        <p><strong>Étapes (≈ 3 min) :</strong><br>
          1. Ouvrir le sitrep → relever cas confirmés cumulés, décès, date<br>
          2. Admin → Épidémies → ✏️ sur <em>Ébola / République démocratique du Congo</em><br>
          3. Mettre à jour les chiffres
        </p>
        <p>
          <a href="${sitrepUrl}" style="display:inline-block;background:#dc2626;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:8px">
            📄 Sitrep N°${num}
          </a>
          <a href="${ADMIN_PANEL_URL}" style="display:inline-block;background:#111827;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold">
            ⚙️ Admin
          </a>
        </p>
      </div>`,
  };
}

// ── 5. Main handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  try {
    return await runSyncDrcSitrep(req, supabase);
  } catch (err) {
    console.error("[sync-drc-sitrep] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-drc-sitrep" } });
    await logCronRun(supabase, "sync-drc-sitrep", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncDrcSitrep(_req: NextRequest, supabase: SupabaseClient) {
  const adminEmail  = ADMIN_EMAILS?.split(",")[0]?.trim();

  // Load last known sitrep number, and find the Ebola DRC outbreak row — unrelated
  // tables, neither depends on the other's result, so fetch both concurrently.
  const [{ data: configRow }, outbreakRow] = await Promise.all([
    supabase.from("site_config").select("value").eq("key", "ebola_drc_last_sitrep_num").maybeSingle(),
    findEbolaDrcRow(supabase),
  ]);
  const lastKnownNum = configRow ? parseInt(configRow.value, 10) : 0;
  if (!outbreakRow) {
    const err = new Error("[drc-sitrep] Ebola DRC row not found in DB — cron cannot update");
    console.error(err.message);
    Sentry.captureException(err, { tags: { cron: "sync-drc-sitrep" } });
    await logCronRun(supabase, "sync-drc-sitrep", "error", 0, "Ebola DRC row not found");
    if (adminEmail && isRealProduction) {
      await sendEmail(
        adminEmail,
        "🚨 Ébola RDC — ligne DB introuvable (cron bloqué)",
        `<div style="font-family:sans-serif;color:#1f2937">
          <h2 style="color:#dc2626">🚨 sync-drc-sitrep : ligne Ebola RDC introuvable</h2>
          <p>Le cron n'a pas pu trouver la ligne Ebola / RD Congo dans la table <code>outbreaks</code>.</p>
          <p>Les données Ebola DRC <strong>ne sont pas mises à jour</strong> tant que ce problème persiste.</p>
          <p><a href="${ADMIN_PANEL_URL}" style="background:#dc2626;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold">⚙️ Admin</a></p>
        </div>`,
      );
    }
    return NextResponse.json({ status: "error", detail: "Ebola DRC row not found" }, { status: 500 });
  }

  // Step 2: detect latest sitrep via ReliefWeb
  const latest = await fetchLatestSitrep();

  if (!latest || latest.reliefwebError) {
    const detail = latest?.reliefwebError ? "ReliefWeb unavailable" : "no_sitrep_found";
    console.log(`[drc-sitrep] ${detail}`);
    await logCronRun(supabase, "sync-drc-sitrep", latest?.reliefwebError ? "error" : "no_data", 0, detail);
    // No email: fetchLatestSitrep() is permanently disabled (legal, see fetchLatestSitrep's
    // own comment) and can never return non-null, so this branch fires on every single run —
    // "no sitrep found" would stop being a signal and just become daily spam. Ebola DRC
    // figures are kept fresh via WHO Disease Outbreak News through sync-who-afro instead.
    return NextResponse.json({ status: detail });
  }

  console.log(`[drc-sitrep] Found sitrep N°${latest.num} — ${latest.pageUrl}`);

  if (latest.num <= lastKnownNum) {
    console.log(`[drc-sitrep] Already processed N°${latest.num}.`);
    await logCronRun(supabase, "sync-drc-sitrep", "ok", 0);
    return NextResponse.json({ status: "up_to_date", sitrep: latest.num });
  }

  // Step 3: extract data from PDF (if available)
  const extracted = latest.pdfUrl ? await extractFromPdf(latest.pdfUrl, latest.num) : { data: null, text: null };
  const data      = extracted.data;
  const pdfText   = extracted.text;
  console.log(`[drc-sitrep] Extracted:`, data);

  let dbUpdateFailed = false;

  // Same anti-regression guards as updateSatelliteCountry() above — this is the
  // priority-10 Ebola/DRC PHEIC row, the single most-overwritten row in the repo.
  const mainGuardReason = data ? regressionGuard(data, outbreakRow) : null;
  if (mainGuardReason) {
    console.warn(`[drc-sitrep] main row: ${mainGuardReason} — skipping update`);
    Sentry.captureMessage(`[drc-sitrep] sitrep N°${latest.num} blocked: ${mainGuardReason}`, "warning");
    // Logged as "error", not "ok": returning here skips the
    // ebola_drc_last_sitrep_num bookkeeping below, so this sitrep is retried on
    // every subsequent run. A persistently-bad parse would otherwise loop
    // forever while the cron kept reporting healthy — this way the daily
    // health-check surfaces it.
    await logCronRun(supabase, "sync-drc-sitrep", "error", 0, mainGuardReason);
    return NextResponse.json({ status: "blocked_by_guard", reason: mainGuardReason, sitrep: latest.num });
  }

  if (data) {
    // Step 4a: auto-update DB at source_priority 10
    // .select("id") for the same reason as updateSatelliteCountry() above: a write
    // blocked by the source_priority guard still returns error: null, so without it
    // a blocked update was counted as a success — cron status stayed "ok" and the
    // "✅ auto-updated" admin email went out quoting figures that were never written.
    // The satellite path got this treatment on 2026-07-15; this one, the priority-10
    // Ebola DRC PHEIC row itself, was missed at the time.
    const desc = buildMainDescriptions(data.cases, data.deaths, data.date);
    const { data: updatedRows, error } = await supabase
      .from("outbreaks")
      .update({
        cases:           data.cases,
        deaths:          data.deaths,
        date:            data.date,
        source:          latest.pdfUrl ?? latest.pageUrl,
        description:     desc.en,
        description_fr:  desc.fr,
        description_es:  desc.es,
        description_ar:  desc.ar,
        description_id:  desc.id,
        active:          true,
        updated_at:      new Date().toISOString(),
        source_priority: 10,
      })
      .eq("id", outbreakRow.id)
      .lte("source_priority", 10)
      .select("id");

    if (error) {
      console.error("[drc-sitrep] DB update error:", error.message);
      Sentry.captureException(new Error(error.message), { tags: { cron: "sync-drc-sitrep" } });
      dbUpdateFailed = true;
    } else if (!updatedRows || updatedRows.length === 0) {
      console.error("[drc-sitrep] update blocked by source_priority guard — Ebola DRC row owned by a higher-priority source");
      Sentry.captureException(
        new Error("[drc-sitrep] Ebola DRC update blocked by source_priority guard — row locked above priority 10"),
        { tags: { cron: "sync-drc-sitrep" } },
      );
      dbUpdateFailed = true;
    } else {
      console.log(`[drc-sitrep] ✅ Updated: ${data.cases} cas / ${data.deaths} décès / ${data.date}`);
      const { subject, html } = emailAutoUpdated(data);
      if (adminEmail && isRealProduction) await sendEmail(adminEmail, subject, html);
    }
  } else {
    // Step 4b: PDF parsing failed — notify for manual update
    console.log("[drc-sitrep] PDF extraction failed — sending manual notification.");
    const { subject, html } = emailManualNeeded(latest.num, latest.pdfUrl ?? latest.pageUrl);
    if (adminEmail && isRealProduction) await sendEmail(adminEmail, subject, html);
  }

  // Step 4c: update satellite countries (Uganda, France) from the same PDF text
  let satelliteUpdated = 0;
  if (pdfText) {
    const sitrepDate = data?.date ?? extractDate(pdfText) ?? new Date().toISOString().split("T")[0];
    const pdfSource  = latest.pdfUrl ?? latest.pageUrl;
    for (const country of ["Uganda", "France"]) {
      const countryRow = parseCountryRow(pdfText, country);
      if (countryRow) {
        const ok = await updateSatelliteCountry(supabase, country, countryRow.cases, countryRow.deaths, sitrepDate, pdfSource);
        if (ok) satelliteUpdated++;
      }
    }
  }

  // Step 5: persist last sitrep number
  await supabase.from("site_config").upsert({
    key:        "ebola_drc_last_sitrep_num",
    value:      String(latest.num),
    updated_at: new Date().toISOString(),
  });
  // Was hardcoded "ok" — the update error above already reached Sentry, but
  // not cron status, so health-check's daily digest (which only reads
  // logCronRun, not Sentry) never flagged a failed write to this priority-10
  // Ebola DRC PHEIC row, the most-watched row in the dataset.
  await logCronRun(supabase, "sync-drc-sitrep", dbUpdateFailed ? "error" : "ok", (data ? 1 : 0) + satelliteUpdated,
    dbUpdateFailed ? "Ebola DRC row update failed — see Sentry" : undefined);

  return NextResponse.json({
    status:     data ? "auto_updated" : "manual_needed",
    sitrep:     latest.num,
    pageUrl:    latest.pageUrl,
    pdfUrl:     latest.pdfUrl,
    extracted:  data,
    emailSent:  !!adminEmail,
  });
}
