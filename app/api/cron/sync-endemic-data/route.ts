// Weekly sync for "official" (non-WHO-DON) rows whose data comes from
// national agencies or WHO regional offices instead of the DON feed.
//
// Current targets: Philippines dengue, Ethiopia cholera, Thailand leptospirosis.
// Schedule: 30 7 * * 1  (Monday 07:30 UTC — after the 6h DON sync run at 06:00)

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logCronRun, isRealProduction } from "@/lib/cron-monitor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { extractNumbers } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";
import { dateFloorGuard, spikeGuard, collapseGuard, zeroDeathGuard } from "@/lib/outbreak-guards";

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

// Rebuilds the English description from the freshly fetched figures — without
// this, a weekly cases/deaths/date update left the description narrating
// whatever the seed data said, drifting further out of sync every week. See
// project_sync_outbreaks_paho_translation_drift_fixed for the same fix applied
// to the other outbreaks-writing crons.
function buildEndemicDescription(diseaseEn: string, countryEn: string, found: Found): string {
  const casesStr  = found.cases.toLocaleString("en");
  const deathsStr = found.deaths > 0 ? ` and ${found.deaths.toLocaleString("en")} death${found.deaths > 1 ? "s" : ""}` : "";
  return `${diseaseEn} in ${countryEn} — ${casesStr} cumulative case${found.cases > 1 ? "s" : ""}${deathsStr} reported as of ${found.date}.`;
}

// ══════════════════════════════════════════════════════════════════════════════
// TARGET 1 — Philippines / Dengue
// Source: GMA Network RSS feeds (server-rendered, real <item> entries)
// Strategy: scan the sections DOH dengue announcements land in → parse
//
// Philippine News Agency (pna.gov.ph) is NOT used: every path returns a
// persistent HTTP 403 (Cloudflare bot-protection), confirmed via the actual
// fetch() runtime, not just a broken URL — no URL fix applies to an active
// block, and this scraper doesn't attempt to evade bot detection. GMA's own
// search page (/news/search/) was also tried previously, but it 302s to a
// client-rendered results widget — the real results never appear in the raw
// HTML a server-side fetch sees, so it always returned 0 candidates. GMA's
// RSS feeds are real, static, and reliably server-rendered.
// ══════════════════════════════════════════════════════════════════════════════

async function fetchPhilippinesDengue(currentDate: string): Promise<Found | null> {
  const RSS_FEEDS = [
    "https://data.gmanetwork.com/gno/rss/news/nation/feed.xml",
    "https://data.gmanetwork.com/gno/rss/news/metro/feed.xml",
    "https://data.gmanetwork.com/gno/rss/lifestyle/healthandwellness/feed.xml",
  ];

  // Step 1: collect candidate article URLs from RSS items mentioning dengue
  const candidates: string[] = [];
  for (const feedUrl of RSS_FEEDS) {
    const xml = await fetchHtml(feedUrl);
    if (!xml) { await delay(300); continue; }

    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      if (!/dengue/i.test(m[1])) continue;
      const link = m[1].match(/<link>([^<]+)/)?.[1]?.trim();
      if (link) candidates.push(link);
    }
    await delay(300);
  }

  // Step 2: parse the top candidates (RSS items are already newest-first)
  for (const url of [...new Set(candidates)].slice(0, 6)) {
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
  // Strategy A: WHO's global "multi-country outbreak of cholera,
  // epidemiological update #N" series. Replaces the old AFRO-regional
  // "monthly-regional-cholera-bulletin-{month}-{year}" series, which WHO AFRO
  // discontinued after June 2025 (confirmed: the June 2025 slug returns 200,
  // every month from July 2025 onward 404s, checked through today) — not a
  // slug/naming bug, the series itself stopped.
  const result = await tryWHOGlobalCholeraUpdate(currentDate);
  if (result) return result;

  await delay(500);

  // Strategy B: ReliefWeb open API (JSON, no auth)
  return tryReliefWebEthiopiaCholera(currentDate);
}

interface CholeraUpdateRef { url: string; title: string; publicationDate: string }

// WHO's public OData API (same family as the WHO DON API in lib/who-api.ts) —
// found by inspecting the real network requests the update's own landing
// page makes. Only `contains()` on Title is accepted here as a $filter (the
// sibling "newsitems" entity set rejects any Title filter at all).
async function findLatestCholeraUpdate(): Promise<CholeraUpdateRef | null> {
  const params = new URLSearchParams({
    sf_culture: "en",
    "$top":     "10",
    "$orderby": "PublicationDate desc",
    "$select":  "Title,ItemDefaultUrl,PublicationDate",
    "$filter":  "contains(Title,'outbreak of cholera')",
    "$format":  "json",
  });
  const json = await fetchHtml(`https://www.who.int/api/news/meetingreports?${params}`);
  if (!json) return null;

  try {
    const data = JSON.parse(json) as {
      value?: Array<{ Title?: string; ItemDefaultUrl?: string; PublicationDate?: string }>;
    };
    for (const item of data.value ?? []) {
      if (!item.Title || !item.ItemDefaultUrl || !item.PublicationDate) continue;
      // Accept any numbered report in the series ("#N") rather than requiring
      // the current "epidemiological update" wording — WHO already renamed
      // this exact series once (from "external situation report" to
      // "epidemiological update" at #33), and hard-coding the name would
      // silently break again on the next rename.
      if (!/#\s*\d+/.test(item.Title)) continue;
      const url = item.ItemDefaultUrl.startsWith("http")
        ? item.ItemDefaultUrl
        : `https://www.who.int${item.ItemDefaultUrl}`;
      return { url, title: item.Title, publicationDate: item.PublicationDate };
    }
  } catch (e) {
    console.log("[endemic] cholera update list parse error:", errorMessage(e));
  }
  return null;
}

async function tryWHOGlobalCholeraUpdate(currentDate: string): Promise<Found | null> {
  const ref = await findLatestCholeraUpdate();
  if (!ref) return null;

  const updateNum = ref.title.match(/#\s*(\d+)/)?.[1];
  const pubDate = new Date(ref.publicationDate);
  if (!updateNum || isNaN(pubDate.getTime())) return null;

  // The PDF filename embeds the publish date as a UTC calendar date —
  // confirmed by reconstructing and fetching it for updates #37 and #38 from
  // their real PublicationDate. Also probe +/-1 day in case a publish close
  // to UTC midnight makes the UTC calendar date disagree with the filename.
  let pdfText = "";
  for (const offsetDays of [0, -1, 1]) {
    const d = new Date(pubDate);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const pdfUrl = `https://cdn.who.int/media/docs/default-source/documents/emergencies/situation-reports/${yyyymmdd}_multi-country_outbreak-of-cholera_epidemiological_update_${updateNum}.pdf`;

    try {
      const res = await fetch(pdfUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20_000) });
      if (res.ok) {
        const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as
          (buf: Buffer, opts?: object) => Promise<{ text: string }>;
        const { text } = await pdfParse(Buffer.from(await res.arrayBuffer()), { max: 20 });
        pdfText = text;
        break;
      }
    } catch (e) {
      console.log("[endemic] cholera PDF fetch/parse error:", errorMessage(e));
    }
    await delay(300);
  }
  if (!pdfText) return null;

  return parseEthiopiaCholeraTable(pdfText, ref.url, currentDate);
}

async function tryReliefWebEthiopiaCholera(_currentDate: string): Promise<Found | null> {
  // DISABLED (legal) — ReliefWeb's terms permit "personal, non-commercial use" only,
  // with no redistribution / derivative works over third-party copyrighted reports.
  // HealthWatch Global is commercial, so ingesting ReliefWeb breaches its ToS — the
  // same legal shape as the ProMED C&D (see legal_reliefweb_noncommercial). Ethiopia
  // cholera is otherwise covered by the WHO AFRO / Africa CDC paths; this ReliefWeb
  // fallback is retired. Never calls the ReliefWeb API.
  return null;
}

// "Table 1" in each update lists every affected country by WHO region, with
// 2 column groups: year-to-date cumulative (cases, deaths, CFR%, cases per
// 100k) and last-28-days (same 4 columns, often "-" when no recent activity).
// Ethiopia's row never wraps across lines (short name), so it reliably reads
// "Ethiopia <cases> <deaths> <CFR%> <per-100k> ..." on one line — verified on
// updates #37 ("Ethiopia 53 1 1.9 0 ...") and #38 ("Ethiopia 50 2 4.0 0 ...").
// Uses the cumulative pair, consistent with how this file's other target
// (Philippines dengue) tracks a running annual total rather than a snapshot.
function parseEthiopiaCholeraTable(text: string, source: string, currentDate: string): Found | null {
  // The table caption ("Table 1 ... as of DD Month YYYY") carries the real
  // data cutoff — WHO publishes ~1 month after the period it covers, so this
  // is earlier than the report's own publish date.
  const dateM = text.match(/as\s+of\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!dateM) return null;
  const mo = MONTH_MAP[dateM[2].toLowerCase()];
  if (!mo) return null;
  const date = `${dateM[3]}-${mo}-${dateM[1].padStart(2, "0")}`;
  if (date <= currentDate) return null;

  const rowM = text.match(/Ethiopia\s+(\d[\d,]*)\s+(\d[\d,]*)\s+[\d.]+\s+\d+/);
  if (!rowM) return null;
  const cases  = parseInt(rowM[1].replace(/,/g, ""), 10);
  const deaths = parseInt(rowM[2].replace(/,/g, ""), 10);
  if (cases <= 0 || deaths > cases) return null;

  return {
    cases,
    deaths,
    date,
    source,
    note: "Ethiopia cholera via WHO global multi-country cholera update",
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
    signal: AbortSignal.timeout(10_000),
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

  // Defensive wrapper: catch any uncaught exception so logCronRun is always called.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    return await runSyncEndemicData(req, supabase);
  } catch (err) {
    console.error("[sync-endemic-data] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-endemic-data" } });
    await logCronRun(supabase, "sync-endemic-data", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

async function runSyncEndemicData(_req: NextRequest, supabase: SupabaseClient) {
  const today      = todayYMD();
  const adminEmail = ADMIN_EMAILS?.split(",")[0]?.trim();

  // ── Load the 3 target rows ───────────────────────────────────────────────
  const { data: rows, error } = await supabase
    .from("outbreaks")
    .select("id, disease, disease_en, country, country_en, cases, deaths, date, source, description")
    .or(
      "and(disease.eq.Dengue,country.eq.Philippines)," +
      "and(disease.eq.Choléra,country.eq.Éthiopie)," +
      "and(disease.eq.Leptospirose,country.eq.Thaïlande)"
    );

  if (error) {
    await logCronRun(supabase, "sync-endemic-data", "error", 0, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

    // Had no protection against the current row's own figures at all until
    // 2026-08-02 — the check above only sanity-checks the fetch result in
    // isolation, never compares it to what's already stored. Standard
    // date-floor/spike/collapse/zero-death guard set from
    // lib/outbreak-guards.ts, same as every other sync cron. No zeroCaseGuard:
    // `found.cases <= 0` is already excluded by the check above, so it could
    // never fire here.
    const guardReason =
      dateFloorGuard(found, row) ??
      spikeGuard(found, row) ??
      collapseGuard(found, row) ??
      zeroDeathGuard(found, row);
    if (guardReason) {
      skipped.push({ label: target.label, reason: guardReason });
      continue;
    }

    // Update DB — description is rebuilt from the fresh figures every time
    // (see buildEndemicDescription); FR/ES/AR/ID are nulled when the English
    // text changed so sync-outbreaks' backfill sweep re-translates it.
    const newDescription = buildEndemicDescription(row.disease_en ?? target.disease, row.country_en ?? target.country, found);
    const updatePayload: Record<string, unknown> = {
      cases:           found.cases,
      deaths:          found.deaths,
      date:            found.date,
      source:          found.source,
      description:     newDescription,
      source_priority: 5,
    };
    if (row.description !== newDescription) {
      updatePayload.description_fr = null;
      updatePayload.description_es = null;
      updatePayload.description_ar = null;
      updatePayload.description_id = null;
    }
    // .select("id") so a source_priority guard that blocks the write (row now
    // owned by a higher-priority source) is visible as 0 affected rows —
    // without it, a blocked update still returns error: null and was reported
    // as a success. Found 2026-07-15.
    const { data: updatedRows, error: upErr } = await supabase
      .from("outbreaks")
      .update(updatePayload)
      .eq("id", row.id).lte("source_priority", 5)
      .select("id");

    if (upErr) {
      console.error(`[endemic] DB update ${target.label}:`, upErr.message);
      Sentry.captureException(new Error(`[endemic] ${target.label} update failed: ${upErr.message}`), { tags: { cron: "sync-endemic-data" } });
      skipped.push({ label: target.label, reason: `DB update error: ${upErr.message}` });
    } else if (!updatedRows || updatedRows.length === 0) {
      skipped.push({ label: target.label, reason: "blocked by source_priority guard — row owned by a higher-priority source" });
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

  // Only email when there are actual updates or real fetch/DB errors (not routine "no newer data").
  const realErrors = skipped.filter((s) => !s.reason.startsWith("no newer data"));
  if (adminEmail && isRealProduction && (updates.length > 0 || realErrors.length > 0)) {
    await sendEmail(adminEmail, subject, html);
  }
  // Was hardcoded "ok" — realErrors (a real DB/fetch error, as opposed to the
  // routine "no newer data" skip) was already computed above to decide
  // whether to email, but never fed into cron status.
  await logCronRun(supabase, "sync-endemic-data", realErrors.length > 0 ? "error" : "ok", updates.length,
    realErrors.length > 0 ? `${realErrors.length} erreur(s) réelle(s)` : undefined);

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
