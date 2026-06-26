// Weekly sync for "official" (non-WHO-DON) rows whose data comes from
// national agencies or WHO regional offices instead of the DON feed.
//
// Current targets: Philippines dengue, Ethiopia cholera, Thailand leptospirosis.
// Schedule: 30 7 * * 1  (Monday 07:30 UTC — after the 6h DON sync run at 06:00)

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { extractNumbers } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic   = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const BREVO_API_KEY        = clean(process.env.BREVO_API_KEY);
const ADMIN_EMAILS         = clean(process.env.ADMIN_EMAILS);

const FETCH_HEADERS = {
  "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":     "text/html,application/json,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  january:"01", february:"02", march:"03", april:"04",
  may:"05",     june:"06",     july:"07",  august:"08",
  september:"09", october:"10", november:"11", december:"12",
};

function parseEnglishDate(raw: string): string | null {
  const m = raw.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})$/);
  if (!m) return null;
  const mo = MONTH_MAP[m[1].toLowerCase()];
  return mo ? `${m[3]}-${mo}-${m[2].padStart(2, "0")}` : null;
}

function todayYMD(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.log(`[endemic] ${url} → HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.log(`[endemic] fetch error ${url}:`, errorMessage(e));
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Extract hrefs matching a regex from raw HTML
function extractHrefs(html: string, pattern: RegExp): string[] {
  const out: string[] = [];
  const re = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (pattern.test(m[1])) out.push(m[1]);
  }
  return [...new Set(out)];
}

// ── Result type ──────────────────────────────────────────────────────────────

interface Found {
  cases:  number;
  deaths: number;
  date:   string;   // YYYY-MM-DD
  source: string;
  note:   string;
}

// ══════════════════════════════════════════════════════════════════════════════
// TARGET 1 — Philippines / Dengue
// Sources: Philippine News Agency (PNA) + GMA Network
// Strategy: fetch tag/search listing → find latest article URLs → parse
// ══════════════════════════════════════════════════════════════════════════════

async function fetchPhilippinesDengue(currentDate: string): Promise<Found | null> {
  // Step 1: collect candidate article URLs from listing pages
  const listingUrls = [
    "https://www.pna.gov.ph/tags/dengue",
    "https://www.pna.gov.ph/search?q=dengue+DOH+cases",
    "https://www.gmanetwork.com/news/search/?q=dengue+cases+DOH+Philippines&sort=latest",
  ];

  const candidates: string[] = [];

  for (const listing of listingUrls) {
    const html = await fetchHtml(listing);
    if (!html) { await delay(300); continue; }

    // PNA: /articles/XXXXXXX
    const pna = extractHrefs(html, /^\/articles\/\d+$/).map(
      (p) => `https://www.pna.gov.ph${p}`
    );
    // GMA: full https URLs with numeric segment
    const gma = extractHrefs(html, /gmanetwork\.com\/news\/[a-z]+\/[a-z]+\/\d+\/story/);

    candidates.push(...pna, ...gma);
    if (candidates.length >= 10) break;
    await delay(400);
  }

  // Sort PNA by article ID descending (higher = newer)
  candidates.sort((a, b) => {
    const nA = parseInt(a.match(/\/articles\/(\d+)/)?.[1] ?? "0");
    const nB = parseInt(b.match(/\/articles\/(\d+)/)?.[1] ?? "0");
    return nB - nA || 0;
  });

  // Step 2: parse the top candidates
  for (const url of candidates.slice(0, 6)) {
    await delay(350);
    const html = await fetchHtml(url);
    if (!html) continue;
    const text = htmlToText(html);
    if (!/dengue/i.test(text)) continue;

    const result = parseDengueCumulative(text, url, currentDate);
    if (result) return result;
  }

  return null;
}

function parseDengueCumulative(text: string, url: string, currentDate: string): Found | null {
  // ── Find a cumulative case figure (annual total, always ≥50 000 for PH)
  // We explicitly avoid biweekly fragments ("X cases from DATE to DATE")
  // by requiring keywords that signal a running-year total.

  const CUMULATIVE_RE = [
    // "total of 280,000 dengue cases"
    /\btotal\s+(?:of\s+)?(\d[\d,]+)\s+(?:dengue\s+)?(?:fever\s+)?cases/i,
    // "280,000 dengue cases nationwide as of October 2025"
    /(\d[\d,]+)\s+(?:dengue\s+)?(?:fever\s+)?cases\s+(?:nationwide|across[^.]*?)(?:[^.]*?)as\s+of/i,
    // "recorded/logged 280,000 cases since January"
    /(?:recorded?|logged?|tallied)\s+(\d[\d,]+)\s+(?:dengue\s+)?(?:fever\s+)?cases\s+(?:nationwide|since|from\s+January)/i,
    // "since January 1 … 280,000"
    /(?:since\s+January\s*1?|from\s+January\s*1?\s+to)\b[^.]{0,120}?(\d[\d,]+)\s+(?:dengue\s+)?cases/i,
  ];

  let cases = 0;
  for (const re of CUMULATIVE_RE) {
    const m = re.exec(text);
    if (m) {
      const c = parseInt(m[1].replace(/,/g, ""), 10);
      if (c > cases) cases = c;
    }
  }

  // Annual Philippines dengue always exceeds 50 000
  if (cases < 50_000) return null;

  // ── Extract reporting date
  const DATE_RE = /as\s+of\s+([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/i;
  const dm = DATE_RE.exec(text);
  if (!dm) return null;
  const date = parseEnglishDate(dm[1]);
  if (!date || date <= currentDate) return null;

  // ── Extract deaths
  const { deaths } = extractNumbers(text);

  return {
    cases,
    deaths: deaths > 0 && deaths < cases ? deaths : 0,
    date,
    source: url,
    note: `PH dengue cumul. via ${new URL(url).hostname}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// TARGET 2 — Ethiopia / Cholera
// Sources: WHO AFRO monthly bulletins (HTML text) + ReliefWeb API
// ══════════════════════════════════════════════════════════════════════════════

async function fetchEthiopiaCholera(currentDate: string): Promise<Found | null> {
  // Strategy A: try WHO AFRO monthly bulletin pages for the last 14 months
  const result = await tryWHOAFROBulletins(currentDate);
  if (result) return result;

  await delay(500);

  // Strategy B: ReliefWeb open API (JSON, no auth)
  return tryReliefWebEthiopiaCholera(currentDate);
}

async function tryWHOAFROBulletins(currentDate: string): Promise<Found | null> {
  // Build a list of month slugs from the month after currentDate up to today
  const slugs: string[] = [];
  const start = new Date(currentDate);
  start.setMonth(start.getMonth() + 1); // start one month after current DB date
  const now = new Date();

  while (start <= now && slugs.length < 14) {
    const month = start.toLocaleString("en-US", { month: "long" }).toLowerCase();
    const year  = start.getFullYear();
    slugs.push(`${month}-${year}`);
    start.setMonth(start.getMonth() + 1);
  }
  // Try most recent first
  slugs.reverse();

  for (const slug of slugs) {
    const url = `https://www.afro.who.int/publications/monthly-regional-cholera-bulletin-${slug}`;
    await delay(400);
    const html = await fetchHtml(url);
    if (!html) continue;

    // Find the PDF bitstream URL for iris.who.int (to store as source)
    const pdfMatch = html.match(/href="(https:\/\/iris\.who\.int\/bitstream[^"]+\.pdf[^"]*)"/i);
    const pdfUrl = pdfMatch?.[1] ?? url;

    const text = htmlToText(html);

    // Look for Ethiopia-specific figures in the page summary text
    const found = parseEthiopiaCholera(text, pdfUrl, currentDate);
    if (found) return found;
  }

  return null;
}

async function tryReliefWebEthiopiaCholera(currentDate: string): Promise<Found | null> {
  // ReliefWeb v2 API (v1 decommissioned). Requires approved appname.
  const year = new Date().getFullYear();
  const apiUrl = new URL("https://api.reliefweb.int/v2/reports");
  apiUrl.searchParams.set("appname", "healthwatch-global");
  apiUrl.searchParams.set("query[value]", `Ethiopia cholera cases ${year}`);
  apiUrl.searchParams.set("fields[include][]", "title");
  apiUrl.searchParams.set("fields[include][]", "date");
  apiUrl.searchParams.set("fields[include][]", "url");
  apiUrl.searchParams.set("fields[include][]", "body");
  apiUrl.searchParams.set("sort[]", "date:desc");
  apiUrl.searchParams.set("limit", "5");

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: { ...FETCH_HEADERS, "Accept": "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const json = await res.json() as {
      data?: Array<{ fields?: { title?: string; date?: { created?: string }; url?: string; body?: string } }>
    };

    for (const item of json.data ?? []) {
      const f = item.fields;
      if (!f?.body) continue;
      const text = htmlToText(f.body);
      if (!/ethiopia/i.test(text)) continue;
      const source = f.url ?? apiUrl.toString();
      const found = parseEthiopiaCholera(text, source, currentDate);
      if (found) return found;
    }
  } catch (e) {
    console.log("[endemic] ReliefWeb error:", errorMessage(e));
  }

  return null;
}

function parseEthiopiaCholera(text: string, source: string, currentDate: string): Found | null {
  // Extract an Ethiopia-specific block from the text
  // WHO AFRO text typically says "Ethiopia reported X cases and Y deaths as of DATE"

  // Find the sentence/paragraph containing "Ethiopia" + numbers
  const ETH_BLOCK_RE = /ethiopia[^.]{0,400}/gi;
  let ethBlock = "";
  let m: RegExpExecArray | null;
  while ((m = ETH_BLOCK_RE.exec(text)) !== null) {
    if (/\d[\d,]+[^.]*?cases/i.test(m[0])) {
      ethBlock = m[0];
      break;
    }
  }
  if (!ethBlock) return null;

  // Extract cumulative cases from Ethiopia block
  const CASES_RE = /(\d[\d,]+)\s+(?:cumulative\s+)?cases/i;
  const DEATHS_RE = /(\d[\d,]+)\s+(?:cumulative\s+)?deaths/i;
  const DATE_RE   = /as\s+of\s+(\d{1,2}\s+[A-Z][a-z]+\s+\d{4})|([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/i;

  const cm = CASES_RE.exec(ethBlock);
  if (!cm) return null;
  const cases = parseInt(cm[1].replace(/,/g, ""), 10);
  if (cases < 100) return null;

  const dm = DEATHS_RE.exec(ethBlock);
  const deaths = dm ? parseInt(dm[1].replace(/,/g, ""), 10) : 0;

  // Try to get date from block, fall back to full text
  const dtm = DATE_RE.exec(ethBlock) ?? DATE_RE.exec(text);
  let date = "";
  if (dtm) {
    const raw = (dtm[1] ?? dtm[2]).trim();
    // Handle "31 May 2025" format
    const dd = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (dd) {
      const mo = MONTH_MAP[dd[2].toLowerCase()];
      date = mo ? `${dd[3]}-${mo}-${dd[1].padStart(2, "0")}` : "";
    } else {
      date = parseEnglishDate(raw) ?? "";
    }
  }

  if (!date || date <= currentDate) return null;
  if (cases <= 0 || deaths > cases) return null;

  return {
    cases,
    deaths,
    date,
    source,
    note: `Ethiopia cholera via ${new URL(source).hostname}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// TARGET 3 — Thailand / Leptospirosis
// Sources: Nation Thailand (DDC press releases) + WHO SEARO bulletin
// ══════════════════════════════════════════════════════════════════════════════

async function fetchThailandLepto(currentDate: string): Promise<Found | null> {
  // Strategy A: Nation Thailand — DDC regularly issues press releases here
  const nationResult = await tryNationThailand(currentDate);
  if (nationResult) return nationResult;

  await delay(500);

  // Strategy B: WHO SEARO weekly epi bulletin (try last 8 weeks)
  return tryWHOSEAROBulletin(currentDate);
}

async function tryNationThailand(currentDate: string): Promise<Found | null> {
  const searchUrls = [
    "https://www.nationthailand.com/search?q=leptospirosis+DDC",
    "https://www.nationthailand.com/search?q=leptospirosis+Thailand+cases",
    "https://www.nationthailand.com/health-wellness",
  ];

  const candidates: string[] = [];

  for (const listing of searchUrls) {
    const html = await fetchHtml(listing);
    if (!html) { await delay(300); continue; }

    // Nation Thailand article URLs: /news/SECTION/NNNNNNN or /health-wellness/NNNNNNN
    const found = extractHrefs(html, /nationthailand\.com\/(?:news|health-wellness|thailand)\/[a-z-]+\/\d+/);
    candidates.push(...found);
    if (candidates.length >= 8) break;
    await delay(400);
  }

  // Sort by article number (higher = newer)
  candidates.sort((a, b) => {
    const nA = parseInt(a.match(/\/(\d+)(?:\?|$)/)?.[1] ?? "0");
    const nB = parseInt(b.match(/\/(\d+)(?:\?|$)/)?.[1] ?? "0");
    return nB - nA;
  });

  for (const url of candidates.slice(0, 5)) {
    await delay(350);
    const html = await fetchHtml(url);
    if (!html) continue;
    const text = htmlToText(html);
    if (!/leptospirosis/i.test(text) || !/thailand/i.test(text)) continue;

    const result = parseLeptoThailand(text, url, currentDate);
    if (result) return result;
  }

  return null;
}

async function tryWHOSEAROBulletin(currentDate: string): Promise<Found | null> {
  // SEARO epi bulletins: https://cdn.who.int/media/docs/default-source/searo/whe/wherepib/2025_WW_searo_epi_bulletin.pdf
  // Try the last 8 weeks
  const now = new Date();
  const weekNums: number[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(
      ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    weekNums.push(week);
  }

  for (const week of weekNums) {
    const ww = String(week).padStart(2, "0");
    const year = new Date().getFullYear();
    const url = `https://cdn.who.int/media/docs/default-source/searo/whe/wherepib/${year}_${ww}_searo_epi_bulletin.pdf`;
    await delay(400);
    const html = await fetchHtml(url);
    if (!html) continue;
    const text = htmlToText(html);
    if (!/leptospirosis/i.test(text) || !/thailand/i.test(text)) continue;

    const result = parseLeptoThailand(text, url, currentDate);
    if (result) return result;
  }

  return null;
}

function parseLeptoThailand(text: string, source: string, currentDate: string): Found | null {
  // Find a Thailand-specific block containing leptospirosis data
  // DDC press releases: "Thailand reported X leptospirosis cases and Y deaths from January 1 to DATE"

  const TH_BLOCK_RE = /(?:thailand|thai)[^.]{0,600}/gi;
  let block = "";
  let m: RegExpExecArray | null;
  while ((m = TH_BLOCK_RE.exec(text)) !== null) {
    if (/leptospirosis/i.test(m[0]) && /\d[\d,]+[^.]*?cases/i.test(m[0])) {
      block = m[0];
      break;
    }
  }
  if (!block) return null;

  const CASES_RE  = /(\d[\d,]+)\s+(?:leptospirosis\s+)?cases/i;
  const DEATHS_RE = /(\d[\d,]+)\s+deaths?/i;
  const DATE_RE   = /(?:from\s+January\s*1?\s+to|as\s+of|through|until)\s+([A-Z][a-z]+\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/i;

  const cm = CASES_RE.exec(block);
  if (!cm) return null;
  const cases = parseInt(cm[1].replace(/,/g, ""), 10);
  if (cases < 500) return null; // Thailand lepto annual is always ≥500

  const dm  = DEATHS_RE.exec(block);
  const deaths = dm ? parseInt(dm[1].replace(/,/g, ""), 10) : 0;

  const dtm = DATE_RE.exec(block) ?? DATE_RE.exec(text);
  let date = "";
  if (dtm) {
    const raw = dtm[1].trim();
    const dd  = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (dd) {
      const mo = MONTH_MAP[dd[2].toLowerCase()];
      date = mo ? `${dd[3]}-${mo}-${dd[1].padStart(2, "0")}` : "";
    } else {
      date = parseEnglishDate(raw) ?? "";
    }
  }

  if (!date || date <= currentDate) return null;
  if (deaths > cases) return null;

  return {
    cases,
    deaths,
    date,
    source,
    note: `Thailand lepto via ${new URL(source).hostname}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// EMAIL
// ══════════════════════════════════════════════════════════════════════════════

async function sendEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY || !to) return;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "HealthWatch Global", email: "alerts@healthwatch-global.com" },
      to:     [{ email: to }],
      subject,
      htmlContent: html,
    }),
  }).catch((e) => {
    console.error("[endemic] email failed:", errorMessage(e));
    Sentry.captureException(e, { tags: { cron: "sync-endemic-data" } });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today      = todayYMD();
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // ── Load the 3 target rows ───────────────────────────────────────────────
  const { data: rows, error } = await supabase
    .from("outbreaks")
    .select("id, disease, country, cases, deaths, date, source")
    .eq("active", true)
    .or(
      "and(disease.eq.Dengue,country.eq.Philippines)," +
      "and(disease.eq.Choléra,country.eq.Éthiopie)," +
      "and(disease.eq.Leptospirose,country.eq.Thaïlande)"
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = NonNullable<typeof rows>[number];
  const findRow = (disease: string, country: string): Row | undefined =>
    rows?.find((r) => r.disease === disease && r.country === country);

  // ── Define targets ───────────────────────────────────────────────────────

  interface Target {
    label: string;
    disease: string;
    country: string;
    fetch: (currentDate: string) => Promise<Found | null>;
  }

  const targets: Target[] = [
    {
      label:   "Dengue / Philippines",
      disease: "Dengue",
      country: "Philippines",
      fetch:   fetchPhilippinesDengue,
    },
    {
      label:   "Choléra / Éthiopie",
      disease: "Choléra",
      country: "Éthiopie",
      fetch:   fetchEthiopiaCholera,
    },
    {
      label:   "Leptospirose / Thaïlande",
      disease: "Leptospirose",
      country: "Thaïlande",
      fetch:   fetchThailandLepto,
    },
  ];

  // ── Run each target ──────────────────────────────────────────────────────

  type UpdateRecord = { label: string; before: string; after: string; source: string };
  type SkipRecord   = { label: string; reason: string };

  const updates:  UpdateRecord[] = [];
  const skipped:  SkipRecord[]   = [];

  for (const target of targets) {
    const row = findRow(target.disease, target.country);

    if (!row) {
      skipped.push({ label: target.label, reason: "row not found in DB" });
      continue;
    }

    console.log(`[endemic] Scanning ${target.label} (current: ${row.date} ${row.cases}c/${row.deaths}d)…`);

    let found: Found | null = null;
    try {
      found = await target.fetch(row.date);
    } catch (e) {
      console.error(`[endemic] ${target.label} fetch error:`, errorMessage(e));
      Sentry.captureException(e, { tags: { cron: "sync-endemic-data", label: target.label } });
      skipped.push({ label: target.label, reason: `fetch error: ${errorMessage(e)}` });
      continue;
    }

    if (!found) {
      skipped.push({ label: target.label, reason: "no newer data found in accessible sources" });
      continue;
    }

    // Guard: refuse if new cases are ≤0 or new date is in the future
    if (found.cases <= 0 || found.date > today) {
      skipped.push({ label: target.label, reason: `implausible result (${found.cases}c, date ${found.date})` });
      continue;
    }

    // Update DB
    const { error: upErr } = await supabase
      .from("outbreaks")
      .update({
        cases:  found.cases,
        deaths: found.deaths,
        date:   found.date,
        source: found.source,
      })
      .eq("id", row.id);

    if (upErr) {
      console.error(`[endemic] DB update ${target.label}:`, upErr.message);
      skipped.push({ label: target.label, reason: `DB update error: ${upErr.message}` });
    } else {
      updates.push({
        label:  target.label,
        before: `${row.cases.toLocaleString("fr-FR")}c/${row.deaths}d (${row.date})`,
        after:  `${found.cases.toLocaleString("fr-FR")}c/${found.deaths}d (${found.date})`,
        source: found.source,
      });
      console.log(`[endemic] ✅ Updated ${target.label}: ${found.note}`);
    }

    await delay(300);
  }

  // ── Email report ─────────────────────────────────────────────────────────

  const updatesHtml = updates.length > 0
    ? `<h3 style="color:#16a34a">✅ Données mises à jour (${updates.length})</h3><ul>` +
      updates.map((u) =>
        `<li><strong>${u.label}</strong><br>
         ${u.before} → <strong>${u.after}</strong><br>
         <small>Source : <a href="${u.source}">${u.source}</a></small></li>`
      ).join("") + `</ul>`
    : `<p style="color:#6b7280">Aucune donnée plus récente trouvée dans les sources accessibles.</p>`;

  const skippedHtml = skipped.length > 0
    ? `<h3 style="color:#d97706">⚠️ Sources inaccessibles ou inchangées</h3><ul>` +
      skipped.map((s) => `<li><strong>${s.label}</strong> — ${s.reason}</li>`).join("") +
      `</ul>`
    : "";

  const subject = updates.length > 0
    ? `✅ HealthWatch — ${updates.length} ligne(s) endémique(s) mise(s) à jour (${today})`
    : `📊 HealthWatch — sync endémiques : aucune mise à jour (${today})`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      <h2 style="border-bottom:2px solid #e5e7eb;padding-bottom:8px">
        📊 Sync données endémiques — ${today}
      </h2>
      <p style="color:#6b7280">
        Cibles : Dengue/Philippines · Choléra/Éthiopie · Leptospirose/Thaïlande<br>
        Mises à jour : <strong>${updates.length}</strong> &nbsp;|&nbsp;
        Sans changement : <strong>${skipped.length}</strong>
      </p>
      ${updatesHtml}
      ${skippedHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">
        Généré automatiquement par /api/cron/sync-endemic-data ·
        ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
      </p>
    </div>`;

  if (adminEmail) await sendEmail(adminEmail, subject, html);

  return NextResponse.json({
    success: true,
    date:    today,
    targets: targets.length,
    updated: updates.length,
    skipped: skipped.length,
    updates: updates.map((u) => ({ label: u.label, before: u.before, after: u.after })),
    reasons: skipped,
    emailSent: !!adminEmail,
  });
}
