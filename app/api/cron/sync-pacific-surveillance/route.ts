// Weekly early-warning check for the Pacific Island Countries and Areas (PICs)
// region, which has essentially no automated coverage in `outbreaks` (as of
// 2026-08-03, only Diphtheria/Australia — 1 active row for the whole Oceania
// region, versus 16-39 in every other region). A real multi-country 2026
// dengue outbreak (New Caledonia 2,166 cases, French Polynesia 30 cases,
// elevated activity in Fiji/Samoa/Tonga/Kiribati/etc.) was found entirely
// missing — see the two manually-added rows sourced to WHO WPRO "Dengue
// Situation Update" #749.
//
// That numbered situation-update series only gives extractable case-count
// text for New Caledonia and French Polynesia; every other PIC is presented
// only as an unlabelled weekly chart, not usable by a fetcher. This cron
// instead reads the weekly "Pacific Syndromic Surveillance System (PSSS)
// Weekly Bulletin" (WHO Division of Pacific Technical Support, Suva) — a
// different report, syndromic rather than lab-confirmed, but published as a
// genuine per-country DATA TABLE (verified against a real edition on
// 2026-08-03: Country/Area | No. sites | No. reported | % reported | AFR |
// PF | Diarrhoea | DLI | ILI | SARI | COVID-19), not a chart.
//
// Deliberately does NOT write to `outbreaks`. DLI ("dengue-like illness") is
// a syndromic case definition (fever + 2 of: nausea, myalgia, headache,
// rash, bleeding) — not lab-confirmed dengue, and mixing it into the same
// `cases` column as the confirmed-case rows used everywhere else in the
// product would misrepresent the data. There is also no historical baseline
// available from a single PDF to judge what counts as "elevated" versus
// normal seasonal noise (the bulletin's own alert threshold is "twice the
// average of the previous 3 weeks", which this cron cannot compute from one
// edition). So this only surfaces the current table + a naive DLI>0 signal
// for PICs with no matching active Dengue row yet, and leaves the
// interpretation and any DB write to a human — same division of labour as
// disease-coverage's travelerRisk-gap emails, or section 4 bis of the
// morning-don-check routine ("le laisser trancher").
//
// Discovery (verified 2026-08-03, no ToS restriction identified — same
// who.int family already used for WHO DON, no redistribution, factual
// case/data-table extraction only):
//   1. GET the standing listing page (lists editions newest-first):
//      https://www.who.int/westernpacific/wpro-emergencies/surveillance/pacific-islands
//   2. Regex out the first (= latest) bulletin item-page URL.
//   3. GET that item page; its PDF link renders as an UNQUOTED href attribute
//      (href=https://cdn.who.int/...pdf?...&download=true) — a quoted-href
//      regex misses it entirely, confirmed by testing against a live page.
//   4. Download the PDF and parse it with pdf-parse's `pagerender` hook to
//      get each text item's (x, y) position — the table's numeric columns
//      have NO delimiters in the flattened text (e.g. "Fiji292690%10840…"),
//      so plain text extraction cannot be split back into columns
//      unambiguously. Position-based column reconstruction (row = items
//      sharing a y, ordered by x) is required and was verified against a
//      real edition (W23 2026): reconstructed row for Fiji =
//      29 sites / 26 reported / 90% / AFR 1 / PF 0 / Diarrhoea 840 / DLI 95 /
//      ILI 96 / SARI 4 / COVID 0 — matches the source PDF exactly.
//
// Schedule: 15 8 * * 1 (Monday 08:15 UTC) — matches the bulletin's own
// weekly cadence; no point polling more often.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

const LISTING_URL = "https://www.who.int/westernpacific/wpro-emergencies/surveillance/pacific-islands";

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// The 23 PICs covered by PSSS. Keys are the raw first-line label as it
// appears in the PDF (wrapped continuations like "(the)" or "Guinea" land on
// their own near-empty row and are naturally dropped by the 11-column
// filter below — the data stays attached to the first line, verified
// against a real edition). Values are display-normalized full names.
const KNOWN_PICTS: Record<string, string> = {
  "American Samoa": "American Samoa",
  "Cook Islands": "Cook Islands",
  "Fiji": "Fiji",
  "French Polynesia": "French Polynesia",
  "Guam": "Guam",
  "Kiribati": "Kiribati",
  "Marshall Islands": "Marshall Islands",
  "Micronesia": "Federated States of Micronesia",
  "Nauru": "Nauru",
  "New Caledonia": "New Caledonia",
  "New Zealand": "New Zealand",
  "Niue": "Niue",
  "Northern Mariana": "Northern Mariana Islands",
  "Palau": "Palau",
  "Papua New": "Papua New Guinea",
  "Pitcairn Islands": "Pitcairn Islands",
  "Samoa": "Samoa",
  "Solomon Islands": "Solomon Islands",
  "Tokelau": "Tokelau",
  "Tonga": "Tonga",
  "Tuvalu": "Tuvalu",
  "Vanuatu": "Vanuatu",
  "Wallis & Futuna": "Wallis and Futuna",
};

interface CountryRow {
  country: string;
  sites: number;
  reported: number;
  pctReported: number;
  afr: number;
  pf: number;
  diarrhoea: number;
  dli: number;
  ili: number;
  sari: number;
  covid: number;
}

interface PdfTextItem { str: string; transform: number[]; }
interface PdfPageData { getTextContent: () => Promise<{ items: PdfTextItem[] }>; }

// ── Email helper (mirrors disease-coverage) ───────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY || !to) return;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  // Was previously a bare .catch() that only saw network-level exceptions:
  // a non-2xx Brevo response (or a fetch that simply never landed) resolved
  // normally and was silently discarded. logCronRun below still recorded
  // "ok" even though the alert never reached Brevo — found 2026-08-11 while
  // investigating a week with 5 DLI signals logged but no email received.
  // Throwing here lets the route's own try/catch (GET, above) log a real
  // "error" status instead.
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo error ${res.status}: ${body.slice(0, 500)}`);
  }
}

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Discovery ──────────────────────────────────────────────────────────────

async function findLatestBulletinItemUrl(): Promise<string> {
  const res = await fetch(LISTING_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`listing page HTTP ${res.status}`);
  const html = await res.text();
  // The listing page lists editions newest-first — first match is the latest.
  const match = html.match(
    /https:\/\/www\.who\.int\/westernpacific\/publications\/m\/item\/pacific-syndromic-surveillance-system-weekly-bulletin--[^"]+/
  );
  if (!match) throw new Error("no PSSS bulletin link found on listing page");
  return match[0];
}

async function findPdfUrl(itemUrl: string): Promise<string> {
  const res = await fetch(itemUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`item page HTTP ${res.status}`);
  const html = await res.text();
  // Renders as an UNQUOTED href attribute on this page template — verified
  // 2026-08-03. A quoted-href regex (`href="..."`) silently matches nothing.
  const match = html.match(
    /href=(https:\/\/cdn\.who\.int\/media\/docs\/default-source\/wpro---documents\/emergency\/psss\/[^\s">]+\.pdf[^\s">]*)/
  );
  if (!match) throw new Error("no PDF link found on bulletin item page");
  return match[1];
}

// ── PDF table extraction ───────────────────────────────────────────────────

function reconstructRows(items: { str: string; x: number; y: number }[]): CountryRow[] {
  const nonEmpty = items.filter((it) => it.str.trim() !== "");
  // Top-to-bottom, then left-to-right within a row.
  const sorted = [...nonEmpty].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: { str: string; x: number }[][] = [];
  let curY: number | null = null;
  let curLine: { str: string; x: number }[] = [];
  for (const it of sorted) {
    if (curY === null || Math.abs(it.y - curY) > 2) {
      if (curLine.length) lines.push(curLine);
      curLine = [{ str: it.str, x: it.x }];
      curY = it.y;
    } else {
      curLine.push({ str: it.str, x: it.x });
    }
  }
  if (curLine.length) lines.push(curLine);

  const rows: CountryRow[] = [];
  for (const line of lines) {
    // label + 10 numeric columns. Wrapped-continuation lines (e.g. a lone
    // "(the)") and the header/Total/footnote rows don't have this shape.
    if (line.length !== 11) continue;
    const label = line[0].str.trim();
    const canonical = KNOWN_PICTS[label];
    if (!canonical) continue;
    const nums = line.slice(1).map((c) => c.str.replace("%", ""));
    if (nums.some((n) => !/^\d+$/.test(n))) continue;
    const [sites, reported, pctReported, afr, pf, diarrhoea, dli, ili, sari, covid] = nums.map(Number);
    rows.push({ country: canonical, sites, reported, pctReported, afr, pf, diarrhoea, dli, ili, sari, covid });
  }
  return rows;
}

async function extractPsssTable(pdfBuffer: Buffer): Promise<CountryRow[]> {
  const pdfParseFn = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
    (buf: Buffer, opts?: { pagerender?: (pageData: PdfPageData) => Promise<string> }) => Promise<{ text: string }>;

  let tableItems: { str: string; x: number; y: number }[] | null = null;

  async function pagerender(pageData: PdfPageData): Promise<string> {
    if (tableItems !== null) return ""; // already found it on an earlier page
    const tc = await pageData.getTextContent();
    const joined = tc.items.map((it) => it.str).join("");
    if (joined.includes("Country/Area")) {
      tableItems = tc.items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
    }
    return "";
  }

  await pdfParseFn(pdfBuffer, { pagerender });
  if (!tableItems) throw new Error("PSSS table page not found (no 'Country/Area' header in any page)");
  return reconstructRows(tableItems);
}

// ── Main handler ─────────────────────────────────────────────────────────

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
    return await runPacificSurveillance(supabase);
  } catch (err) {
    console.error("[sync-pacific-surveillance] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-pacific-surveillance" } });
    await logCronRun(supabase, "sync-pacific-surveillance", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runPacificSurveillance(supabase: SupabaseClient) {
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  const itemUrl = await findLatestBulletinItemUrl();
  const pdfUrl = await findPdfUrl(itemUrl);

  const pdfRes = await fetch(pdfUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30_000) });
  if (!pdfRes.ok) throw new Error(`PSSS PDF HTTP ${pdfRes.status}`);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  const rows = await extractPsssTable(pdfBuffer);

  // Which PICs already have an active, lab-confirmed Dengue row in `outbreaks`
  // — those don't need a syndromic flag, they're already properly tracked.
  const { data: activeDengue, error: dengueErr } = await supabase
    .from("outbreaks")
    .select("country_en")
    .eq("region", "oceania")
    .eq("active", true)
    .ilike("disease_en", "%dengue%");
  if (dengueErr) console.error("[sync-pacific-surveillance] dengue-coverage query error:", dengueErr.message);
  const covered = new Set((activeDengue ?? []).map((r) => (r.country_en as string) ?? ""));

  // Naive signal: DLI > 0 on a PIC that both reported this week (pctReported
  // > 0 — a 0% row means no data, not zero cases) and has no active Dengue
  // row yet. No baseline/threshold math (a single edition can't support it,
  // see file header) — this is a "worth a human look" flag, not an alert.
  const signals = rows.filter((r) => r.dli > 0 && r.pctReported > 0 && !covered.has(r.country));

  console.log(`[sync-pacific-surveillance] edition: ${itemUrl}`);
  console.log(`[sync-pacific-surveillance] ${rows.length} PIC rows parsed, ${signals.length} DLI signal(s) uncovered by an active Dengue row`);

  if (signals.length > 0 && adminEmail && isRealProduction) {
    const tableHtml = rows
      .slice()
      .sort((a, b) => b.dli - a.dli)
      .map((r) => {
        const flagged = signals.includes(r);
        return `<tr style="${flagged ? "color:#f59e0b;font-weight:bold" : ""}">
          <td style="padding:4px 8px">${esc(r.country)}</td>
          <td style="padding:4px 8px;text-align:right">${r.pctReported}%</td>
          <td style="padding:4px 8px;text-align:right">${r.dli}</td>
          <td style="padding:4px 8px;text-align:right">${r.ili}</td>
          <td style="padding:4px 8px;text-align:right">${r.diarrhoea}</td>
        </tr>`;
      })
      .join("");

    const html = `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:24px;border-radius:12px">
        <h2 style="color:#f59e0b;margin-top:0">Pacific Syndromic Surveillance — signal hebdo</h2>
        <p style="color:#9ca3af">${new Date().toISOString().split("T")[0]} — édition : <a href="${esc(itemUrl)}" style="color:#38bdf8">${esc(itemUrl.split("--")[1] ?? itemUrl)}</a></p>
        <h3 style="color:#f59e0b">${signals.length} PICT avec signal DLI (dengue-like illness) sans ligne Dengue active</h3>
        <p style="color:#9ca3af;font-size:13px">DLI = syndromique (définition clinique), pas confirmé labo — vérifier contre une source primaire (WHO WPRO Dengue Situation Update, ministère national) avant toute création de ligne. En orange dans le tableau.</p>
        <table style="border-collapse:collapse;font-size:13px;width:100%">
          <tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #374151">PICT</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #374151">% rapporté</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #374151">DLI</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #374151">ILI</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #374151">Diarrhée</th></tr>
          ${tableHtml}
        </table>
        <hr style="border-color:#1e293b;margin:20px 0">
        <p style="color:#475569;font-size:12px">Cron hebdomadaire automatique — WHO Division of Pacific Technical Support (Suva). app/api/cron/sync-pacific-surveillance</p>
      </div>`;

    await sendEmail(
      adminEmail,
      `[HealthWatch] Pacific surveillance — ${signals.length} signal(aux) DLI non couvert(s)`,
      html
    );

    if (isRealProduction) {
      Sentry.captureMessage(
        `[sync-pacific-surveillance] ${signals.length} DLI signal(s) uncovered`,
        {
          level: "info",
          tags: { component: "sync-pacific-surveillance" },
          extra: { signals: signals.map((s) => `${s.country}: DLI=${s.dli}`) },
        }
      );
    }
  }

  await logCronRun(supabase, "sync-pacific-surveillance", "ok", signals.length);
  return NextResponse.json({
    ok: true,
    edition: itemUrl,
    rowsParsed: rows.length,
    signals: signals.map((s) => ({ country: s.country, dli: s.dli, ili: s.ili, pctReported: s.pctReported })),
    checkedAt: new Date().toISOString(),
  });
}
