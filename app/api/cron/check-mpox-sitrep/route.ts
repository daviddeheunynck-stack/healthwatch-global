// Twice-weekly (Wed + Sat 08:10 UTC): detects new WHO Mpox Situation Reports,
// downloads the PDF, extracts global case/death figures, and updates the DB.
// Falls back to a manual-notification email if PDF parsing fails.
//
// Reads WHO's own global sitrep PDF directly (not a scrape of a news listing),
// so it can write onto rows locked at source_priority=10 (ceiling raised
// 2026-08-19 alongside sync-who-afro/emro — see
// project_source_priority_is_ownership_not_freeze_2026_08_19). Additional
// lockedRowRegressionGuard refuses any decrease on a locked row.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { errorMessage } from "@/lib/error";
import { regressionGuard, lockedRowRegressionGuard } from "@/lib/outbreak-guards";
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

const WHO_SITREP_PAGE  = "https://www.who.int/emergencies/situations/mpox-outbreak";
const ADMIN_PANEL_URL  = "https://healthwatch-global.com/fr/admin";
const MPOX_MONDIAL_ID  = "dbc9c1d0-9299-4607-a027-f229ec8c25ce";
const MPOX_DRC_ID      = "c5632295-8df7-4546-9225-60f844d40a00";

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,application/pdf,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  jan:"01", january:"01",
  feb:"02", february:"02",
  mar:"03", march:"03",
  apr:"04", april:"04",
  may:"05",
  jun:"06", june:"06",
  jul:"07", july:"07",
  aug:"08", august:"08",
  sep:"09", september:"09",
  oct:"10", october:"10",
  nov:"11", november:"11",
  dec:"12", december:"12",
};

// ── 1. Detect latest sitrep on WHO page ──────────────────────────────────────

async function fetchLatestSitrep(): Promise<{ url: string; num: number } | null> {
  try {
    const res = await fetch(WHO_SITREP_PAGE, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.log(`[mpox] WHO page → HTTP ${res.status}`); return null; }
    return parseSitrepLinks(await res.text());
  } catch (e) {
    console.log("[mpox] fetch WHO page:", errorMessage(e));
    return null;
  }
}

function parseSitrepLinks(html: string): { url: string; num: number } | null {
  const hrefRe = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  let bestNum = 0;
  let bestUrl = "";

  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1];
    const numMatch = href.match(/external-situation-report--(\d+)/i);
    if (!numMatch) continue;
    const num = parseInt(numMatch[1], 10);
    if (num > bestNum) {
      bestNum = num;
      bestUrl  = href.startsWith("http") ? href : `https://www.who.int${href}`;
    }
  }

  return bestNum > 0 ? { url: bestUrl, num: bestNum } : null;
}

// ── 2. Find the PDF download link ────────────────────────────────────────────
// WHO sitrep pages are JS-rendered — PDF link not in raw HTML.
// Use the stable CDN URL pattern instead:
//   https://cdn.who.int/media/docs/default-source/_sage-YEAR/
//   multi-country-outbreak-of-mpox--external-situation-report_NUM.pdf

async function fetchPdfUrl(sitrepPageUrl: string, num: number): Promise<string | null> {
  // Extract year from the page URL slug (e.g. "---31-may-2026" → 2026)
  const yearMatch = sitrepPageUrl.match(/---\d+-\w+-(\d{4})$/);
  if (yearMatch) {
    const year = yearMatch[1];
    const directUrl = `https://cdn.who.int/media/docs/default-source/_sage-${year}/multi-country-outbreak-of-mpox--external-situation-report_${num}.pdf`;
    try {
      const r = await fetch(directUrl, { method: "HEAD", headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        console.log(`[mpox] Direct PDF URL → ${directUrl}`);
        return directUrl;
      }
    } catch (e) {
      console.log("[mpox] Direct PDF HEAD failed:", errorMessage(e));
    }
  }

  // Fallback: try to parse PDF link from the HTML page (may fail on JS-rendered pages)
  try {
    const res = await fetch(sitrepPageUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    const html = await res.text();
    const hrefRe = /href="(https?:\/\/cdn\.who\.int[^"]+\.pdf[^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null) {
      if (/mpox|monkeypox|situation.?report/i.test(m[1])) return m[1];
    }
    const fb = /href="(https?:\/\/cdn\.who\.int[^"]+\.pdf[^"]*)"/.exec(html);
    return fb?.[1] ?? null;
  } catch (e) {
    console.log("[mpox] fetch sitrep page:", errorMessage(e));
    return null;
  }
}

// ── 3. Download PDF + extract text ───────────────────────────────────────────

interface SitrepData {
  cases:  number;
  deaths: number;
  date:   string; // YYYY-MM-DD
}

interface SitrepResult {
  global: SitrepData | null;
  drc:    SitrepData | null;
}

async function extractFromPdf(pdfUrl: string): Promise<SitrepResult> {
  // Download PDF as ArrayBuffer
  let buffer: Buffer;
  try {
    const res = await fetch(pdfUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.log(`[mpox] PDF download → HTTP ${res.status}`); return { global: null, drc: null }; }
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
  } catch (e) {
    console.log("[mpox] PDF download:", errorMessage(e));
    return { global: null, drc: null };
  }

  // Parse PDF — import lib directly to bypass the index.js debug-mode check
  // that tries to open ./test/data/05-versions-space.pdf (absent in Vercel lambdas).
  let text: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as any)).default as (buf: Buffer, opts?: object) => Promise<{ text: string }>;
    const result   = await pdfParse(buffer, { max: 2 }); // only first 2 pages
    text = result.text;
  } catch (e) {
    console.log("[mpox] pdf-parse error:", errorMessage(e));
    return { global: null, drc: null };
  }

  return { global: parseSitrepText(text), drc: parseDrcFromSitrepText(text) };
}

function parseSitrepText(text: string): SitrepData | null {
  // Normalize whitespace
  const t = text.replace(/[ \t]+/g, " ").replace(/\r/g, "");

  // Find "Global (D Mon YYYY – D Mon YYYY)*" and the numbers following it.
  // WHO key figures table, first row:
  //   Global (1 Jan 2022 – 30 Apr 2026)*   179 612   1 047   117
  // Accepts both abbreviated (Apr) and full (April) month names.
  const dateRe = /Global\s*\(\s*\d{1,2}\s+\w+\s+\d{4}\s*[–\-—]\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s*\)\s*\*?/i;
  const dateMatch = dateRe.exec(t);
  if (!dateMatch) {
    console.log("[mpox] parseSitrepText: no Global date row found. Text excerpt:", t.substring(0, 300));
    return null;
  }

  // The numbers immediately follow the date row (possibly on next line).
  // Cases may be space-formatted: "179 612" → need to strip spaces.
  const afterGlobal = t.slice(dateMatch.index + dateMatch[0].length, dateMatch.index + dateMatch[0].length + 200);
  const numsRe = /\s*([\d][\d ]{1,8}[\d]|\d+)\s+([\d][\d ,]{0,6}[\d]|\d+)\s+(\d{1,3})/;
  const numsMatch = numsRe.exec(afterGlobal);
  if (!numsMatch) {
    console.log("[mpox] parseSitrepText: no numbers after Global row. Excerpt:", afterGlobal.slice(0, 100));
    return null;
  }

  const cases  = parseInt(numsMatch[1].replace(/[\s,]/g, ""), 10);
  const deaths = parseInt(numsMatch[2].replace(/[\s,]/g, ""), 10);

  if (isNaN(cases) || isNaN(deaths) || cases < 1000 || deaths < 0 || deaths > cases) {
    console.log("[mpox] parseSitrepText: implausible values", { cases, deaths });
    return null;
  }

  const month = MONTHS[dateMatch[2].toLowerCase()];
  if (!month) return null;
  const date = `${dateMatch[3]}-${month}-${dateMatch[1].padStart(2, "0")}`;

  return { cases, deaths, date };
}

function parseDrcFromSitrepText(text: string): SitrepData | null {
  const t = text.replace(/[ \t]+/g, " ").replace(/\r/g, "");

  const drcRe = /Democratic\s+Republic\s+of\s+(?:the\s+)?Congo\s*\(\s*\d{1,2}\s+\w+\s+\d{4}\s*[–\-—]\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s*\)\s*\*?/i;
  const drcMatch = drcRe.exec(t);
  if (!drcMatch) {
    console.log("[mpox] parseDrcFromSitrepText: no DRC date row found.");
    return null;
  }

  const afterDrc = t.slice(drcMatch.index + drcMatch[0].length, drcMatch.index + drcMatch[0].length + 200);
  const numsRe   = /\s*([\d][\d ]{1,8}[\d]|\d+)\s+([\d][\d ,]{0,6}[\d]|\d+)/;
  const numsMatch = numsRe.exec(afterDrc);
  if (!numsMatch) {
    console.log("[mpox] parseDrcFromSitrepText: no numbers after DRC row. Excerpt:", afterDrc.slice(0, 100));
    return null;
  }

  const cases  = parseInt(numsMatch[1].replace(/[\s,]/g, ""), 10);
  const deaths = parseInt(numsMatch[2].replace(/[\s,]/g, ""), 10);

  if (isNaN(cases) || isNaN(deaths) || cases < 100 || deaths < 0 || deaths > cases) {
    console.log("[mpox] parseDrcFromSitrepText: implausible DRC values", { cases, deaths });
    return null;
  }

  const month = MONTHS[drcMatch[2].toLowerCase()];
  if (!month) return null;
  const date = `${drcMatch[3]}-${month}-${drcMatch[1].padStart(2, "0")}`;

  return { cases, deaths, date };
}

// ── 4. Multi-locale descriptions ─────────────────────────────────────────────
// Generated directly (not via translation API) so description_fr/es/ar/id can
// never freeze out of sync with `description` the way a NULL-gated translation
// backfill can (sync-outbreaks' MyMemory pass only fires once per row — it never
// re-fires once description_fr is non-null, which is exactly how this bug
// happened: the 2026-07-09 fix updated description each run but not the locale
// columns, and the one-time backfill that had already run never came back).
// CFR-style acronyms aside, the site keeps numbers in en-US grouping across all
// locales in these auto-generated templates (see sync-ncdc's buildDescriptions).

interface Descriptions { en: string; fr: string; es: string; ar: string; id: string; }

function buildGlobalDescriptions(num: number, cases: number, deaths: number, date: string): Descriptions {
  const c = cases.toLocaleString("en");
  const d = deaths.toLocaleString("en");
  return {
    en: `WHO multi-country mpox situation report #${num}: ${c} confirmed cases and ${d} deaths cumulative worldwide, as of ${date}. Source: WHO mpox multi-country external situation report.`,
    fr: `Rapport de situation OMS sur le mpox multi-pays n°${num} : ${c} cas confirmés et ${d} décès cumulés dans le monde, au ${date}. Source : rapport de situation multi-pays de l'OMS sur le mpox.`,
    es: `Informe de situación multipaís de la OMS sobre mpox n.º ${num}: ${c} casos confirmados y ${d} muertes acumuladas en todo el mundo, al ${date}. Fuente: informe de situación multipaís de la OMS sobre mpox.`,
    ar: `تقرير حالة منظمة الصحة العالمية متعدد البلدان بشأن الجدري رقم ${num}: ${c} حالة مؤكدة و${d} حالة وفاة تراكمية عالميًا، حتى ${date}. المصدر: تقرير حالة منظمة الصحة العالمية متعدد البلدان بشأن الجدري.`,
    id: `Laporan situasi multi-negara WHO tentang mpox No. ${num}: ${c} kasus terkonfirmasi dan ${d} kematian kumulatif di seluruh dunia, per ${date}. Sumber: laporan situasi multi-negara WHO tentang mpox.`,
  };
}

function buildDrcDescriptions(num: number, cases: number, deaths: number, date: string): Descriptions {
  const c = cases.toLocaleString("en");
  const d = deaths.toLocaleString("en");
  return {
    en: `WHO multi-country mpox situation report #${num}: ${c} cumulative confirmed cases and ${d} deaths in the Democratic Republic of the Congo, as of ${date}. Source: WHO mpox multi-country external situation report.`,
    fr: `Rapport de situation OMS sur le mpox multi-pays n°${num} : ${c} cas confirmés cumulés et ${d} décès en République démocratique du Congo, au ${date}. Source : rapport de situation multi-pays de l'OMS sur le mpox.`,
    es: `Informe de situación multipaís de la OMS sobre mpox n.º ${num}: ${c} casos confirmados acumulados y ${d} muertes en la República Democrática del Congo, al ${date}. Fuente: informe de situación multipaís de la OMS sobre mpox.`,
    ar: `تقرير حالة منظمة الصحة العالمية متعدد البلدان بشأن الجدري رقم ${num}: ${c} حالة مؤكدة تراكمية و${d} حالة وفاة في جمهورية الكونغو الديمقراطية، حتى ${date}. المصدر: تقرير حالة منظمة الصحة العالمية متعدد البلدان بشأن الجدري.`,
    id: `Laporan situasi multi-negara WHO tentang mpox No. ${num}: ${c} kasus terkonfirmasi kumulatif dan ${d} kematian di Republik Demokratik Kongo, per ${date}. Sumber: laporan situasi multi-negara WHO tentang mpox.`,
  };
}

// ── 5. Email helpers ──────────────────────────────────────────────────────────

// Returns whether the email actually sent — the caller's final JSON response
// used to report emailSent: !!adminEmail regardless of whether this ran at
// all, which lies whenever BREVO_API_KEY is missing or the Brevo call fails.
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!BREVO_API_KEY || !to) return false;
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
  }).catch((e) => {
    console.error("[mpox] email:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "check-mpox-sitrep" } });
    return null;
  });
  return !!res?.ok;
}

function emailAutoUpdated(sitrep: { num: number; url: string }, data: SitrepData) {
  return {
    subject: `✅ Mpox mis à jour automatiquement — Sitrep #${sitrep.num}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
        <h2 style="border-bottom:2px solid #16a34a;padding-bottom:8px;color:#16a34a">
          ✅ Mpox / Mondial mis à jour automatiquement
        </h2>
        <p>Le <strong>rapport de situation OMS n°${sitrep.num}</strong> a été détecté et traité automatiquement.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr style="background:#f3f4f6">
            <td style="padding:8px 12px;font-weight:bold">Cas confirmés (global)</td>
            <td style="padding:8px 12px;font-size:1.2em;font-weight:bold;color:#dc2626">${data.cases.toLocaleString("fr-FR")}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:bold">Décès</td>
            <td style="padding:8px 12px">${data.deaths.toLocaleString("fr-FR")}</td>
          </tr>
          <tr style="background:#f3f4f6">
            <td style="padding:8px 12px;font-weight:bold">Date de coupure</td>
            <td style="padding:8px 12px">${data.date}</td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:13px">Vérification conseillée : les chiffres ont été extraits automatiquement depuis le PDF.</p>
        <p>
          <a href="${sitrep.url}" style="display:inline-block;background:#dc2626;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:8px">
            📄 Sitrep #${sitrep.num}
          </a>
          <a href="${ADMIN_PANEL_URL}" style="display:inline-block;background:#111827;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold">
            ⚙️ Admin
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#9ca3af;font-size:12px">HealthWatch Global · extraction automatique PDF</p>
      </div>`,
  };
}

function emailManualNeeded(sitrep: { num: number; url: string }) {
  return {
    subject: `⚠️ Nouveau sitrep Mpox #${sitrep.num} — mise à jour manuelle requise`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
        <h2 style="border-bottom:2px solid #f59e0b;padding-bottom:8px;color:#b45309">
          ⚠️ Sitrep Mpox #${sitrep.num} détecté — extraction PDF échouée
        </h2>
        <p>Le rapport a été détecté mais l'extraction automatique n'a pas fonctionné (format PDF modifié ?).</p>
        <p><strong>3 étapes manuelles (≈ 5 min) :</strong><br>
          1. Ouvrir le sitrep → relever cas confirmés globaux, décès, date de coupure<br>
          2. Admin → Épidémies → ✏️ sur <em>Mpox / Mondial</em><br>
          3. Mettre à jour + activer la ligne
        </p>
        <p>
          <a href="${sitrep.url}" style="display:inline-block;background:#dc2626;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:8px">
            📄 Sitrep #${sitrep.num}
          </a>
          <a href="${ADMIN_PANEL_URL}" style="display:inline-block;background:#111827;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold">
            ⚙️ Admin
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#9ca3af;font-size:12px">HealthWatch Global · surveillance sitreps OMS</p>
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
  try {
    return await runCheckMpoxSitrep(req, supabase);
  } catch (err) {
    console.error("[check-mpox-sitrep] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "check-mpox-sitrep" } });
    await logCronRun(supabase, "check-mpox-sitrep", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runCheckMpoxSitrep(_req: NextRequest, supabase: SupabaseClient) {
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();
  let emailSent      = false;
  let dbUpdateFailed = false;

  // Load last known sitrep URL
  const { data: configRow } = await supabase
    .from("site_config").select("value").eq("key", "mpox_last_sitrep_url").single();
  const lastKnownUrl = configRow?.value ?? "";

  // Step 1: detect latest sitrep
  const latest = await fetchLatestSitrep();
  if (!latest) {
    console.log("[mpox] Could not detect sitrep from WHO page.");
    await logCronRun(supabase, "check-mpox-sitrep", "no_data", 0);
    return NextResponse.json({ status: "no_data" });
  }

  console.log(`[mpox] Latest: #${latest.num} — ${latest.url}`);

  if (latest.url === lastKnownUrl) {
    console.log("[mpox] Already up to date.");
    await logCronRun(supabase, "check-mpox-sitrep", "no_data", 0);
    return NextResponse.json({ status: "up_to_date", sitrep: latest.num });
  }

  console.log(`[mpox] NEW sitrep #${latest.num} detected.`);

  // Step 2: find PDF URL on the sitrep page
  const pdfUrl = await fetchPdfUrl(latest.url, latest.num);
  console.log(`[mpox] PDF URL: ${pdfUrl ?? "(not found)"}`);

  // Step 3: extract data from PDF
  const result  = pdfUrl ? await extractFromPdf(pdfUrl) : null;
  const data    = result?.global ?? null;
  const drcData = result?.drc    ?? null;
  console.log(`[mpox] Extracted global:`, data, "DRC:", drcData);

  // Read the two target rows before writing. This cron updates them by
  // hardcoded id and never looked at their current figures, so it had NO
  // anti-regression guard at all — not even a date floor: whatever the sitrep
  // PDF parser returned was written straight onto the global Mpox row and the
  // DRC PHEIC row. Both are public-facing PHEIC rows, and the parser class is
  // the one that mis-read a footnote as Guatemala's death toll on 2026-08-01
  // (sync-paho-alerts, 26 → 4). Guards from lib/outbreak-guards.ts below.
  const { data: guardRows, error: guardFetchErr } = await supabase
    .from("outbreaks")
    .select("id, cases, deaths, date, source_priority")
    .in("id", [MPOX_MONDIAL_ID, MPOX_DRC_ID]);
  if (guardFetchErr) {
    console.error("[mpox] guard pre-read failed:", guardFetchErr.message);
    Sentry.captureException(new Error(`[mpox] guard pre-read failed: ${guardFetchErr.message}`), { tags: { cron: "check-mpox-sitrep" } });
  }
  // A failed pre-read must not silently disable the guards — treat an
  // unreadable row as unguardable and refuse the write rather than fall open.
  type MpoxGuardRow = { id: string; cases: number | null; deaths: number | null; date: string | null; source_priority: number | null };
  const rowById = new Map<string, MpoxGuardRow>(
    ((guardRows ?? []) as MpoxGuardRow[]).map((r) => [String(r.id), r]),
  );
  const globalRow = rowById.get(String(MPOX_MONDIAL_ID)) ?? null;
  const drcRow    = rowById.get(String(MPOX_DRC_ID)) ?? null;

  const globalGuard = data
    ? (globalRow ? (regressionGuard(data, globalRow) ?? lockedRowRegressionGuard(data, globalRow)) : "guard:row-unreadable — refusing to write blind")
    : null;
  const drcGuard = drcData
    ? (drcRow ? (regressionGuard(drcData, drcRow) ?? lockedRowRegressionGuard(drcData, drcRow)) : "guard:row-unreadable — refusing to write blind")
    : null;
  if (globalGuard) console.warn(`[mpox] global: ${globalGuard} — skipping update`);
  if (drcGuard)    console.warn(`[mpox] DRC: ${drcGuard} — skipping update`);

  // Step 4a: auto-update DB if extraction succeeded
  if (data && !globalGuard) {
    const desc = buildGlobalDescriptions(latest.num, data.cases, data.deaths, data.date);
    // .select("id") so a source_priority guard that blocks the write (row now
    // owned by a higher-priority source) is visible as 0 affected rows —
    // without it, a blocked update still returns error: null and was logged
    // as a success. Found 2026-07-15.
    const { data: updatedRows, error } = await supabase
      .from("outbreaks")
      .update({
        cases:           data.cases,
        deaths:          data.deaths,
        date:            data.date,
        source:          latest.url,
        description:     desc.en,
        description_fr:  desc.fr,
        description_es:  desc.es,
        description_ar:  desc.ar,
        description_id:  desc.id,
        active:          true,
        updated_at:      new Date().toISOString(),
        source_priority: Math.max(5, globalRow?.source_priority ?? 0),
      })
      .eq("id", MPOX_MONDIAL_ID)
      .lte("source_priority", 10)
      .select("id");

    if (error) {
      console.error("[mpox] DB update global error:", error.message);
      Sentry.captureException(new Error(`[mpox] global update failed: ${error.message}`), { tags: { cron: "check-mpox-sitrep" } });
      dbUpdateFailed = true;
    } else if (!updatedRows || updatedRows.length === 0) {
      console.error("[mpox] Global update blocked by source_priority guard — row owned by a higher-priority source");
    } else {
      console.log(`[mpox] ✅ Global updated: ${data.cases} cas / ${data.deaths} décès / ${data.date}`);
      const { subject, html } = emailAutoUpdated(latest, data);
      if (adminEmail && isRealProduction) emailSent = await sendEmail(adminEmail, subject, html);
    }
  } else {
    // Step 4b: fallback — manual notification. Reached both when extraction
    // failed outright and when it succeeded but the anti-regression guard
    // refused the figures; either way the row needs a human look, which is
    // exactly what this email asks for.
    console.log(globalGuard
      ? `[mpox] extraction blocked by guard (${globalGuard}) — sending manual notification.`
      : "[mpox] PDF extraction failed — sending manual notification.");
    const { subject, html } = emailManualNeeded(latest);
    if (adminEmail && isRealProduction) emailSent = await sendEmail(adminEmail, subject, html);
  }

  // Step 4c: also update DRC PHEIC row if DRC data extracted
  if (drcData && !drcGuard) {
    const drcDesc = buildDrcDescriptions(latest.num, drcData.cases, drcData.deaths, drcData.date);
    const { data: drcUpdatedRows, error: drcErr } = await supabase
      .from("outbreaks")
      .update({
        cases:           drcData.cases,
        deaths:          drcData.deaths,
        date:            drcData.date,
        source:          latest.url,
        description:     drcDesc.en,
        description_fr:  drcDesc.fr,
        description_es:  drcDesc.es,
        description_ar:  drcDesc.ar,
        description_id:  drcDesc.id,
        active:          true,
        updated_at:      new Date().toISOString(),
        source_priority: Math.max(5, drcRow?.source_priority ?? 0),
      })
      .eq("id", MPOX_DRC_ID)
      .lte("source_priority", 10)
      .select("id");

    if (drcErr) {
      console.error("[mpox] DB update DRC error:", drcErr.message);
      Sentry.captureException(new Error(`[mpox] DRC update failed: ${drcErr.message}`), { tags: { cron: "check-mpox-sitrep" } });
      dbUpdateFailed = true;
    }
    else if (!drcUpdatedRows || drcUpdatedRows.length === 0) console.error("[mpox] DRC update blocked by source_priority guard — row owned by a higher-priority source");
    else console.log(`[mpox] ✅ DRC updated: ${drcData.cases} cas / ${drcData.deaths} décès / ${drcData.date}`);
  }

  // Step 5: persist last known URL regardless of outcome
  await supabase.from("site_config").upsert({
    key:        "mpox_last_sitrep_url",
    value:      latest.url,
    updated_at: new Date().toISOString(),
  });
  // A new sitrep was still found/processed either way — but flag the run as
  // errored if the admin notification itself didn't go out, so a missing
  // BREVO_API_KEY doesn't read identically to a clean "ok" run. Also flag on
  // dbUpdateFailed: the two outbreaks.update() calls above (the global and
  // DRC PHEIC rows — the most-watched rows in the whole dataset) previously
  // only reached console.error on failure, invisible to both Sentry and cron
  // status.
  // A guard block must not pass as a clean run: mpox_last_sitrep_url is
  // upserted just above whatever happened, so this sitrep will never be
  // reprocessed — a silently-blocked write would freeze the row on the old
  // figures with nothing to show for it. Surface it as an erroring cron so it
  // reaches the daily health-check, and in Sentry.
  const guardBlocked = [globalGuard, drcGuard].filter(Boolean) as string[];
  if (guardBlocked.length > 0) {
    Sentry.captureMessage(
      `[mpox] sitrep N°${latest.num} blocked by anti-regression guard: ${guardBlocked.join(" | ")}`,
      "warning",
    );
  }
  const emailExpected = !!adminEmail && isRealProduction;
  await logCronRun(
    supabase,
    "check-mpox-sitrep",
    (emailExpected && !emailSent) || dbUpdateFailed || guardBlocked.length > 0 ? "error" : "ok",
    (data && !globalGuard ? 1 : 0) + (drcData && !drcGuard ? 1 : 0),
    guardBlocked.length > 0
      ? `écriture bloquée par le garde anti-régression : ${guardBlocked.join(" | ")}`
      : dbUpdateFailed ? "mpox/DRC PHEIC row update failed — see Sentry" : undefined,
  );

  return NextResponse.json({
    status:      guardBlocked.length > 0 ? "blocked_by_guard" : data ? "auto_updated" : "manual_needed",
    guardBlocked: guardBlocked.length > 0 ? guardBlocked : undefined,
    sitrep:      latest.num,
    url:         latest.url,
    pdfUrl:      pdfUrl ?? null,
    extracted:   data,
    drc:         drcData,
    emailSent,
  });
}
