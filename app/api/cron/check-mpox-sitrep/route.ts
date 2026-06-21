// Twice-weekly (Wed + Sat 08:00 UTC): detects new WHO Mpox Situation Reports,
// downloads the PDF, extracts global case/death figures, and updates the DB.
// Falls back to a manual-notification email if PDF parsing fails.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { errorMessage } from "@/lib/error";

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

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,application/pdf,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
  jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
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

// ── 2. Find the PDF download link on the sitrep page ─────────────────────────

async function fetchPdfUrl(sitrепPageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sitrепPageUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Look for cdn.who.int PDF links on the page
    const hrefRe = /href="(https?:\/\/cdn\.who\.int[^"]+\.pdf[^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null) {
      const href = m[1];
      if (/mpox|monkeypox|situation.?report/i.test(href)) return href;
    }

    // Fallback: any cdn.who.int PDF
    const fallbackRe = /href="(https?:\/\/cdn\.who\.int[^"]+\.pdf[^"]*)"/i;
    const fb = fallbackRe.exec(html);
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

async function extractFromPdf(pdfUrl: string): Promise<SitrepData | null> {
  // Download PDF as ArrayBuffer
  let buffer: Buffer;
  try {
    const res = await fetch(pdfUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.log(`[mpox] PDF download → HTTP ${res.status}`); return null; }
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
  } catch (e) {
    console.log("[mpox] PDF download:", errorMessage(e));
    return null;
  }

  // Parse PDF — dynamic import avoids Next.js build-time issues with pdf-parse
  let text: string;
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result   = await pdfParse(buffer, { max: 2 }); // only first 2 pages
    text = result.text;
  } catch (e) {
    console.log("[mpox] pdf-parse error:", errorMessage(e));
    return null;
  }

  return parseSitrepText(text);
}

function parseSitrepText(text: string): SitrepData | null {
  // Normalize whitespace
  const t = text.replace(/[ \t]+/g, " ").replace(/\r/g, "");

  // Find "Global (D Mon YYYY – D Mon YYYY)*" and the numbers following it.
  // WHO key figures table, first row:
  //   Global (1 Jan 2025 – 31 Mar 2026)*   58 214   238   100
  const dateRe = /Global\s*\(\s*\d{1,2}\s+\w+\s+\d{4}\s*[–\-]\s*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s*\)\s*\*?/i;
  const dateMatch = dateRe.exec(t);
  if (!dateMatch) {
    console.log("[mpox] parseSitrepText: could not find Global date row");
    return null;
  }

  // The numbers immediately follow the date row (possibly on next line)
  const afterGlobal = t.slice(dateMatch.index + dateMatch[0].length, dateMatch.index + dateMatch[0].length + 150);
  // Cases may be space-formatted: "58 214" → need to grab 1-2 digit groups
  // Pattern: one or two digit chunks separated by a space = one number, then deaths, then countries
  const numsRe = /\s*([\d][\d ]{1,8}[\d]|\d+)\s+([\d]{1,5})\s+(\d{1,3})/;
  const numsMatch = numsRe.exec(afterGlobal);
  if (!numsMatch) {
    console.log("[mpox] parseSitrepText: could not extract numbers after Global row. Excerpt:", afterGlobal.slice(0, 80));
    return null;
  }

  const cases  = parseInt(numsMatch[1].replace(/\s/g, ""), 10);
  const deaths = parseInt(numsMatch[2], 10);

  if (isNaN(cases) || isNaN(deaths) || cases < 1000 || deaths < 0 || deaths > cases) {
    console.log("[mpox] parseSitrepText: implausible values", { cases, deaths });
    return null;
  }

  const month = MONTHS[dateMatch[2].toLowerCase()];
  if (!month) return null;
  const date = `${dateMatch[3]}-${month}-${dateMatch[1].padStart(2, "0")}`;

  return { cases, deaths, date };
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
  }).catch((e) => console.error("[mpox] email:", errorMessage(e)));
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

  const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // Load last known sitrep URL
  const { data: configRow } = await supabase
    .from("site_config").select("value").eq("key", "mpox_last_sitrep_url").single();
  const lastKnownUrl = configRow?.value ?? "";

  // Step 1: detect latest sitrep
  const latest = await fetchLatestSitrep();
  if (!latest) {
    console.log("[mpox] Could not detect sitrep from WHO page.");
    return NextResponse.json({ status: "no_data" });
  }

  console.log(`[mpox] Latest: #${latest.num} — ${latest.url}`);

  if (latest.url === lastKnownUrl) {
    console.log("[mpox] Already up to date.");
    return NextResponse.json({ status: "up_to_date", sitrep: latest.num });
  }

  console.log(`[mpox] NEW sitrep #${latest.num} detected.`);

  // Step 2: find PDF URL on the sitrep page
  const pdfUrl = await fetchPdfUrl(latest.url);
  console.log(`[mpox] PDF URL: ${pdfUrl ?? "(not found)"}`);

  // Step 3: extract data from PDF
  const data = pdfUrl ? await extractFromPdf(pdfUrl) : null;
  console.log(`[mpox] Extracted data:`, data);

  // Step 4a: auto-update DB if extraction succeeded
  if (data) {
    const { error } = await supabase
      .from("outbreaks")
      .update({
        cases:      data.cases,
        deaths:     data.deaths,
        date:       data.date,
        source:     latest.url,
        active:     true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", MPOX_MONDIAL_ID);

    if (error) {
      console.error("[mpox] DB update error:", error.message);
    } else {
      console.log(`[mpox] ✅ DB updated: ${data.cases} cas / ${data.deaths} décès / ${data.date}`);
      const { subject, html } = emailAutoUpdated(latest, data);
      if (adminEmail) await sendEmail(adminEmail, subject, html);
    }
  } else {
    // Step 4b: fallback — manual notification
    console.log("[mpox] PDF extraction failed — sending manual notification.");
    const { subject, html } = emailManualNeeded(latest);
    if (adminEmail) await sendEmail(adminEmail, subject, html);
  }

  // Step 5: persist last known URL regardless of outcome
  await supabase.from("site_config").upsert({
    key:        "mpox_last_sitrep_url",
    value:      latest.url,
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({
    status:      data ? "auto_updated" : "manual_needed",
    sitrep:      latest.num,
    url:         latest.url,
    pdfUrl:      pdfUrl ?? null,
    extracted:   data,
    emailSent:   !!adminEmail,
  });
}
