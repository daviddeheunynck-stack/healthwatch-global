// WHO EMRO (Eastern Mediterranean Regional Office) outbreak sync — runs Mon/Wed/Fri.
// Scrapes the WHO EMRO outbreak and emergencies page, extracts disease/country/date
// from alert titles, fetches individual pages for case counts, and upserts.
// EMRO covers Middle East, North Africa, and Central Asia — primary fast source for
// MERS-CoV (Saudi Arabia, UAE, Jordan), Crimean-Congo HF, cholera (Yemen, Syria),
// and any new emerging threat before WHO DON HQ publication.
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { findMentionedCountries } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { logCronRun } from "@/lib/cron-monitor";
import { errorMessage } from "@/lib/error";
import { truncateAtSentence } from "@/lib/truncate-text";

export const dynamic     = "force-dynamic";
export const maxDuration = 120;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const EMRO_BASE      = "https://www.emro.who.int";
// The old RSS feed (rss.xml) and "/eha/who-outbreaks-and-emergencies/" listing
// both now 302-redirect to a soft-404 page — confirmed dead. "/media/news/"
// is EMRO's actual current news listing: server-rendered (unlike the
// Elasticsearch-widget-driven topic hub pages, which only render results
// client-side via JS and leave literal unrendered Mustache placeholders in
// the static HTML). "/health-topics/disease-outbreaks/" kept as a secondary
// fallback — it returns 200 today but its own content is that same
// client-rendered widget shell, so it rarely yields candidates.
const EMRO_LIST_URLS = [
  "https://www.emro.who.int/media/news/",
  "https://www.emro.who.int/health-topics/disease-outbreaks/",
];
const MAX_AGE_DAYS   = 45;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/rss+xml,text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}

// "MERS-CoV in Saudi Arabia" or "Outbreak update – Cholera in Yemen, June 2026"
function parseEMROTitle(raw: string): { disease: string; country: string } | null {
  const title = raw
    .replace(/^(?:Outbreak|Disease\s+Outbreak)\s+(?:update|news)\s*[-–—]\s*/i, "")
    .replace(/^Weekly\s+(?:outbreak\s+)?(?:update|briefing)\s*[-–—]\s*/i, "")
    .replace(/^(?:WHO\s+)?EMRO?\s+(?:Alert|Update|Bulletin)\s*[-–—]\s*/i, "")
    .replace(/,?\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}\s*$/i, "")
    .trim();

  const inMatch = title.match(/^(.+?)\s+in\s+(?:the\s+)?(.+?)(?:\s*[-–—].*)?$/i);
  if (inMatch) return { disease: inMatch[1].trim(), country: inMatch[2].trim() };

  const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch && findMentionedCountries(dashMatch[2]).length > 0) {
    return { disease: dashMatch[1].trim(), country: dashMatch[2].trim() };
  }
  return null;
}

// ── Link extraction ───────────────────────────────────────────────────────────

interface PageEntry { url: string; title: string; dateHint?: string }

function extractOutbreakLinks(html: string, _baseUrl: string): PageEntry[] {
  const entries: PageEntry[] = [];
  const seen = new Set<string>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  for (const m of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>\s*([\s\S]{15,250}?)\s*<\/a>/gi)) {
    const href  = m[1].trim();
    const text  = htmlToText(m[2]).trim();
    if (text.length < 15 || seen.has(href)) continue;

    const lower = text.toLowerCase();
    const isRelevant =
      lower.includes("outbreak") ||
      lower.includes("disease") ||
      lower.includes("emergency") ||
      lower.includes("mers") ||
      lower.includes("cholera") ||
      lower.includes("dengue") ||
      lower.includes("polio") ||
      lower.includes("plague") ||
      lower.includes("influenza") ||
      lower.includes("crimean") ||
      lower.includes("hemorrhagic") ||
      lower.includes("haemorrhagic");

    if (!isRelevant) continue;
    if (
      lower === "read more" || lower === "more" ||
      lower.startsWith("home") || lower.startsWith("contact") ||
      lower.length > 250
    ) continue;

    const linkPos = html.indexOf(m[0]);
    const nearby  = html.slice(Math.max(0, linkPos - 300), linkPos + 300);
    const dateM   = nearby.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    const dateHint = dateM ? `${dateM[3]}-${String(["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(dateM[2].toLowerCase())+1).padStart(2,"0")}-${dateM[1].padStart(2,"0")}` : undefined;

    if (dateHint) {
      const d = new Date(dateHint);
      if (d < cutoff) continue;
    }

    const url = href.startsWith("http") ? href : EMRO_BASE + (href.startsWith("/") ? href : "/" + href);
    if (!url.includes("emro.who.int")) continue;

    seen.add(href);
    entries.push({ url, title: text, dateHint });
  }
  return entries;
}

// EMRO article pages wrap the real body text in itemprop="articleBody"
// (schema.org microdata) — confirmed stable, and reliably scopes past the
// site's header/nav chrome the same way don-content/cdc-main do elsewhere.
function extractEMROBody(html: string): string {
  const idx = html.indexOf('itemprop="articleBody"');
  // If EMRO changes their template, this selector stops matching — returning the
  // full page (header/nav chrome) instead of "" would feed page chrome into
  // extractNumbers/findMentionedCountries (wrong case counts, wrong country)
  // rather than the empty-string 0/0 those functions already handle as a
  // visible skip. Found 2026-07-16.
  if (idx < 0) {
    console.warn("[who-emro] body selector no longer matches — skipping article");
    return "";
  }
  const tagEnd = html.indexOf(">", idx) + 1;
  return html.slice(tagEnd, tagEnd + 8000);
}

// ── Shared dedup lookup ───────────────────────────────────────────────────────

interface ExistingRow {
  id: string;
  disease_en: string | null;
  country_en: string | null;
  cases: number;
  deaths: number;
  date: string;
  source: string | null;
  active: boolean;
  description: string | null;
}

const dcKey = (disease: string | null, country: string | null) =>
  `${(disease ?? "").toLowerCase()}|${(country ?? "").toLowerCase()}`;

function indexRow(byDC: Map<string, ExistingRow>, row: ExistingRow): void {
  const k    = dcKey(row.disease_en, row.country_en);
  const prev = byDC.get(k);
  if (!prev || (row.active && !prev.active)) byDC.set(k, row);
}

// The dedup snapshot in GET loads active rows plus anything dated within 90
// days. A row that fell inactive BEFORE that window is invisible to it, and an
// unseen row is upserted as an insert — a duplicate, not an update. Look the
// targeted rows up explicitly before writing them. Same fix as sync-paho-alerts
// (found 2026-07-15, applied here 2026-07-17).
async function loadExistingForItems(
  supabase: SupabaseClient,
  byDC: Map<string, ExistingRow>,
  items: { disease_en: string; country_en: string }[],
): Promise<void> {
  const missing = items.filter((i) => !byDC.has(dcKey(i.disease_en, i.country_en)));
  if (missing.length === 0) return;

  const { data, error } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description")
    .in("disease_en", [...new Set(missing.map((i) => i.disease_en))])
    .in("country_en", [...new Set(missing.map((i) => i.country_en))]);

  if (error) {
    console.warn("[who-emro] dedup lookup:", error.message);
    return;
  }
  for (const row of (data ?? []) as ExistingRow[]) indexRow(byDC, row);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Defensive wrapper: section 3 below (per-article processing loop) runs
  // entirely outside any enclosing try/catch. An uncaught exception there
  // propagated straight out: bare 500, no Sentry event, logCronRun never
  // reached — exactly what happened to sync-outbreaks on 2026-07-29.
  try {
    return await runWhoEmro(req, supabase);
  } catch (err) {
    console.error("[who-emro] uncaught exception:", err);
    Sentry.captureException(err, { tags: { cron: "sync-who-emro" } });
    await logCronRun(supabase, "sync-who-emro", "error", 0,
      err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function runWhoEmro(_req: NextRequest, supabase: SupabaseClient) {
  const today = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch EMRO list (HTML) ──────────────────────────────────────────────
  let pageEntries: PageEntry[] = [];

  for (const listUrl of EMRO_LIST_URLS) {
    try {
      const res = await fetch(listUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const html = await res.text();
      pageEntries = extractOutbreakLinks(html, listUrl);
      if (pageEntries.length > 0) break;
    } catch { continue; }
  }

  console.log(`[who-emro] ${pageEntries.length} candidate articles`);
  if (pageEntries.length === 0) {
    await logCronRun(supabase, "sync-who-emro", "no_data", 0);
    return NextResponse.json({ success: true, articles: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing for dedup ────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));
  if (fetchErr) {
    await logCronRun(supabase, "sync-who-emro", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const bySource = new Map<string, ExistingRow>();
  const byDC     = new Map<string, ExistingRow>();
  for (const row of (existing ?? []) as ExistingRow[]) {
    if (row.source) bySource.set(row.source, row);
    indexRow(byDC, row);
  }

  // ── 3. Process each article ───────────────────────────────────────────────
  const results = { articles: pageEntries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type Log = { label: string; status: string; detail?: string };
  const log: Log[] = [];

  for (const entry of pageEntries) {
    if (bySource.has(entry.url)) {
      log.push({ label: entry.url, status: "skip", detail: "URL in DB" });
      results.skipped++;
      continue;
    }

    const parsed = parseEMROTitle(entry.title);

    let pageText = entry.title;
    try {
      const res = await fetch(entry.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      if (res.ok) pageText = `${entry.title} ${htmlToText(extractEMROBody(await res.text()))}`;
    } catch (e) {
      console.warn("[who-emro] fetch:", errorMessage(e));
    }

    const rawDisease = parsed?.disease ?? entry.title;
    if (!isKnownDisease(rawDisease)) {
      log.push({ label: entry.title, status: "skip", detail: `unknown: ${rawDisease}` });
      results.skipped++;
      continue;
    }

    const countries = findMentionedCountries(
      (parsed?.country ? parsed.country + " " : "") + pageText.substring(0, 2000)
    );
    if (countries.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: "no country" });
      results.skipped++;
      continue;
    }

    const geo = countries[0];

    let date = entry.dateHint ?? today;
    if (!entry.dateHint) {
      const dm = pageText.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
      if (dm) {
        const mi = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(dm[2].toLowerCase()) + 1;
        date = `${dm[3]}-${String(mi).padStart(2,"0")}-${dm[1].padStart(2,"0")}`;
      }
    }
    if (date > today) { results.skipped++; continue; }

    const diseaseInfo  = normalizeDisease(rawDisease);
    const { cases, deaths } = extractNumbers(pageText.substring(0, 3000));
    const riskLevel    = assessRisk(diseaseInfo.name_en, pageText, cases, deaths);
    const description  = truncateAtSentence(`WHO EMRO — ${entry.title}`, 600);
    const label        = `${diseaseInfo.name_en}/${geo.name_en}`;

    // Skip 0/0 entries — WHO EMRO's news listing mixes real outbreak reports
    // with general guidance/preparedness updates that mention a disease/
    // country but report no current case count. Same guard as
    // sync-africa-cdc / sync-paho-alerts / sync-ukhsa.
    if (cases === 0 && deaths === 0) {
      log.push({ label, status: "skip", detail: "0 cases and 0 deaths — likely a guidance update, not an outbreak report" });
      results.skipped++;
      continue;
    }

    await loadExistingForItems(supabase, byDC, [{ disease_en: diseaseInfo.name_en, country_en: geo.name_en }]);
    const existingRow  = byDC.get(dcKey(diseaseInfo.name_en, geo.name_en));

    if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label, status: "skip", detail: "owned by WHO DON" });
      results.skipped++;
      continue;
    }

    if (existingRow) {
      if (date <= existingRow.date && cases === existingRow.cases) {
        log.push({ label, status: "skip", detail: "unchanged" });
        results.skipped++;
        continue;
      }
      // An older-dated entry with different numbers was not caught above (only
      // "unchanged" was) — without this floor a stale re-fetch could still
      // overwrite a more recent row. Same guard family as sync-who-afro/sync-cdc-han.
      if (date < existingRow.date) {
        log.push({ label, status: "skip", detail: `older entry (${date}) than existing (${existingRow.date})` });
        results.skipped++;
        continue;
      }
      const updatePayload: Record<string, unknown> = {
        cases, deaths, date, source: entry.url,
        description, risk_level: riskLevel, active: true, source_priority: 5,
      };
      // English description just changed — existing FR/ES/AR/ID translations
      // (if any) now describe stale figures. Null them so sync-outbreaks'
      // backfill sweep re-translates from the fresh text (it only fires when
      // description_fr IS NULL — see project_sync_outbreaks_paho_translation_drift_fixed).
      if (existingRow.description !== description) {
        updatePayload.description_fr = null;
        updatePayload.description_es = null;
        updatePayload.description_ar = null;
        updatePayload.description_id = null;
      }
      // .select("id") so a source_priority guard that blocks the write (row now
      // owned by a higher-priority source) is visible as 0 affected rows —
      // without it, a blocked update still returns error: null and was
      // reported as "updated" even though nothing changed. Found 2026-07-15.
      const { data: updatedRows, error } = await supabase.from("outbreaks").update(updatePayload)
        .eq("id", existingRow.id).lte("source_priority", 5)
        .select("id");
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else if (!updatedRows || updatedRows.length === 0) {
        log.push({ label, status: "skip", detail: "blocked by source_priority guard — row owned by a higher-priority source" });
        results.skipped++;
      } else { log.push({ label, status: "updated" }); results.updated++; }
    } else {
      const { error } = await supabase.from("outbreaks").insert({
        disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
        country: geo.name_fr, country_en: geo.name_en, country_ar: geo.name_ar,
        region: geo.region, lat: geo.lat, lng: geo.lng,
        cases, deaths, risk_level: riskLevel, date,
        source: entry.url, description, active: true, is_seed: false, is_backfill: false, source_priority: 5,
        admin1: null, admin1_lat: null, admin1_lng: null,
      });
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else { log.push({ label, status: "inserted", detail: `${cases}/${deaths} (${date})` }); results.inserted++; }
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("[who-emro] Done:", results, log);
  // Was hardcoded "ok" regardless of results.errors — a failed insert/update
  // was silently lost while the report stayed green. Same bug as
  // sync-outbreaks (2026-07-29).
  await logCronRun(supabase, "sync-who-emro", results.errors > 0 ? "error" : "ok",
    (results.inserted ?? 0) + (results.updated ?? 0),
    results.errors > 0 ? `${results.errors} écriture(s) en échec` : undefined);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
