// Weekly (Mon 07:00 UTC): detects new WHO AFRO Ebola DRC situation reports,
// downloads the PDF, extracts DRC cumulative case/death figures, and updates the DB.
// source_priority: 10 — highest tier, never overwritten by automated crons.
// Falls back to a manual-notification email if PDF parsing fails.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/error";
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

const RELIEFWEB_BASE    = "https://api.reliefweb.int/v2/reports";
const RELIEFWEB_APPNAME = "healthwatch-global";
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

// ── 2. Detect latest situation report via ReliefWeb API ──────────────────────
// ReliefWeb aggregates DRC Ministry of Health / INSP sitreps within ~24h.
// This replaces the broken WHO AFRO page (restructured, sitreps removed).

interface RWFile { url?: string; filename?: string; mimetype?: string; }
interface RWReport {
  fields?: {
    title?: string;
    date?:  { created?: string };
    url?:   string;
    files?: RWFile[];
  };
}

async function fetchLatestSitrep(): Promise<{ pageUrl: string; pdfUrl: string | null; num: number } | null> {
  const year = new Date().getFullYear();
  const rwUrl = new URL(RELIEFWEB_BASE);
  rwUrl.searchParams.set("appname", RELIEFWEB_APPNAME);
  rwUrl.searchParams.set("query[value]", `Ebola Congo MVB sitrep situation report ${year}`);
  rwUrl.searchParams.append("fields[include][]", "title");
  rwUrl.searchParams.append("fields[include][]", "date");
  rwUrl.searchParams.append("fields[include][]", "url");
  rwUrl.searchParams.append("fields[include][]", "files");
  rwUrl.searchParams.set("sort[]", "date:desc");
  rwUrl.searchParams.set("limit", "5");

  try {
    const res = await fetch(rwUrl.toString(), {
      headers: { ...FETCH_HEADERS, "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) { console.log(`[drc-sitrep] ReliefWeb → HTTP ${res.status}`); return null; }

    const json = await res.json() as { data?: RWReport[] };

    for (const item of json.data ?? []) {
      const f = item.fields;
      if (!f?.title) continue;

      const lower = f.title.toLowerCase();
      // Must be an Ebola or MVB sitrep from DRC
      if (!lower.includes("ebola") && !lower.includes("mvb")) continue;
      if (!lower.includes("congo") && !lower.includes("drc") && !lower.includes("rdc")) continue;

      // Extract sitrep number from title (e.g. "SitRep N°044/MVB" or "Situation Report No. 44")
      const numMatch = f.title.match(/(?:sitrep|situation[-\s]?report|rapport[-\s]?de[-\s]?situation)\s*[n°no#.]?\s*0*(\d{2,3})/i)
        ?? f.title.match(/[nN][°o]?\s*0*(\d{2,3})\s*[/|\\]?\s*(?:MVB|EVD|ebola)/i);
      if (!numMatch) continue;

      const num    = parseInt(numMatch[1], 10);
      const pageUrl = f.url ?? "";
      const pdfUrl  = f.files?.find(
        (file) => file.mimetype === "application/pdf" || file.filename?.endsWith(".pdf")
      )?.url ?? null;

      console.log(`[drc-sitrep] ReliefWeb found: "${f.title}" — sitrep N°${num}, PDF: ${pdfUrl ?? "none"}`);
      return { pageUrl, pdfUrl, num };
    }

    console.log("[drc-sitrep] ReliefWeb: no matching sitrep found in top 5 results");
    return null;
  } catch (e) {
    console.log("[drc-sitrep] ReliefWeb query error:", errorMessage(e));
    return null;
  }
}

// ── 3. Download PDF + extract DRC cumulative figures ─────────────────────────

interface SitrepData {
  cases:  number;
  deaths: number;
  date:   string; // YYYY-MM-DD
  num:    number;
}

async function extractFromPdf(pdfUrl: string, num: number): Promise<SitrepData | null> {
  let buffer: Buffer;
  try {
    const res = await fetch(pdfUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.log(`[drc-sitrep] PDF download → HTTP ${res.status}`); return null; }
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.log("[drc-sitrep] PDF download:", errorMessage(e));
    return null;
  }

  let text: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as any)).default as (buf: Buffer, opts?: object) => Promise<{ text: string }>;
    const result   = await pdfParse(buffer, { max: 3 });
    text = result.text;
  } catch (e) {
    console.log("[drc-sitrep] pdf-parse error:", errorMessage(e));
    return null;
  }

  return parseSitrepText(text, num, pdfUrl);
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

// ── 4. Email helpers ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY || !to) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender:      { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  }).catch((e) => {
    console.error("[drc-sitrep] email:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-drc-sitrep" } });
  });
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

function emailNoSitrep() {
  return {
    subject: `⚠️ Ébola RDC — aucun nouveau sitrep détecté`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
        <h2 style="border-bottom:2px solid #f59e0b;padding-bottom:8px;color:#b45309">
          ⚠️ Ébola RDC — sitrep non détecté automatiquement
        </h2>
        <p>ReliefWeb n'a pas retourné de nouveau sitrep MVB correspondant. Vérification manuelle conseillée.</p>
        <p>
          <a href="https://reliefweb.int/updates?search=ebola+congo+sitrep" style="display:inline-block;background:#dc2626;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;margin-right:8px">
            🌐 ReliefWeb Ébola DRC
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

  const supabase    = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const adminEmail  = ADMIN_EMAILS?.split(",")[0]?.trim();

  // Load last known sitrep number to avoid re-processing
  const { data: configRow } = await supabase
    .from("site_config").select("value").eq("key", "ebola_drc_last_sitrep_num").maybeSingle();
  const lastKnownNum = configRow ? parseInt(configRow.value, 10) : 0;

  // Step 1: find Ebola DRC outbreak row
  const outbreakRow = await findEbolaDrcRow(supabase);
  if (!outbreakRow) {
    const err = new Error("[drc-sitrep] Ebola DRC row not found in DB — cron cannot update");
    console.error(err.message);
    Sentry.captureException(err, { tags: { cron: "sync-drc-sitrep" } });
    if (adminEmail) {
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

  if (!latest) {
    console.log("[drc-sitrep] No sitrep found on ReliefWeb.");
    if (adminEmail) {
      const { subject, html } = emailNoSitrep();
      await sendEmail(adminEmail, subject, html);
    }
    return NextResponse.json({ status: "no_sitrep_found" });
  }

  console.log(`[drc-sitrep] Found sitrep N°${latest.num} — ${latest.pageUrl}`);

  if (latest.num <= lastKnownNum) {
    console.log(`[drc-sitrep] Already processed N°${latest.num}.`);
    return NextResponse.json({ status: "up_to_date", sitrep: latest.num });
  }

  // Step 3: extract data from PDF (if available)
  const data = latest.pdfUrl ? await extractFromPdf(latest.pdfUrl, latest.num) : null;
  console.log(`[drc-sitrep] Extracted:`, data);

  if (data) {
    // Step 4a: auto-update DB at source_priority 10
    const { error } = await supabase
      .from("outbreaks")
      .update({
        cases:           data.cases,
        deaths:          data.deaths,
        date:            data.date,
        source:          latest.pdfUrl ?? latest.pageUrl,
        active:          true,
        updated_at:      new Date().toISOString(),
        source_priority: 10,
      })
      .eq("id", outbreakRow.id)
      .lte("source_priority", 10);

    if (error) {
      console.error("[drc-sitrep] DB update error:", error.message);
      Sentry.captureException(new Error(error.message), { tags: { cron: "sync-drc-sitrep" } });
    } else {
      console.log(`[drc-sitrep] ✅ Updated: ${data.cases} cas / ${data.deaths} décès / ${data.date}`);
      const { subject, html } = emailAutoUpdated(data);
      if (adminEmail) await sendEmail(adminEmail, subject, html);
    }
  } else {
    // Step 4b: PDF parsing failed — notify for manual update
    console.log("[drc-sitrep] PDF extraction failed — sending manual notification.");
    const { subject, html } = emailManualNeeded(latest.num, latest.pdfUrl ?? latest.pageUrl);
    if (adminEmail) await sendEmail(adminEmail, subject, html);
  }

  // Step 5: persist last sitrep number
  await supabase.from("site_config").upsert({
    key:        "ebola_drc_last_sitrep_num",
    value:      String(latest.num),
    updated_at: new Date().toISOString(),
  });
  await logCronRun(supabase, "sync-drc-sitrep", "ok", data ? 1 : 0);

  return NextResponse.json({
    status:     data ? "auto_updated" : "manual_needed",
    sitrep:     latest.num,
    pageUrl:    latest.pageUrl,
    pdfUrl:     latest.pdfUrl,
    extracted:  data,
    emailSent:  !!adminEmail,
  });
}
