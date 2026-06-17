// ECDC Rapid Risk Assessment scraper — runs every Friday at 09:00 UTC.
// Fetches recent threat assessment briefs from ECDC (< 45 days old), extracts
// disease / country / cases from the brief page, and upserts to outbreaks.
// Covers EU/EEA-specific threats (West Nile, CCHF, etc.) not in WHO DON.
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const ECDC_BASE     = "https://www.ecdc.europa.eu";
const ECDC_TAB_LIST = "https://www.ecdc.europa.eu/en/publications-data/threat-assessment-briefs";
const MAX_AGE_DAYS  = 45;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
  jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
};

// Country names sorted longest-first to avoid "Congo" matching before "Democratic Republic of the Congo"
const COUNTRY_NAMES = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function parseECDCDate(text: string): string | null {
  // "14 Mar 2025" / "14 March 2025"
  const verbal = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+(\d{4})\b/i);
  if (verbal) {
    const day = verbal[1].padStart(2, "0");
    const mon = MONTHS[verbal[2].toLowerCase().substring(0, 3)];
    return mon ? `${verbal[3]}-${mon}-${day}` : null;
  }
  // ISO format: "2025-03-14"
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

// Detect if a disease term maps to a known entry in our disease map
function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  // The unknown-disease fallback has no family / cfr_ref / r0_ref set
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

// Find countries mentioned in the text (returns canonical country keys from COUNTRIES)
function findMentionedCountries(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const seen  = new Set<string>();
  for (const name of COUNTRY_NAMES) {
    const geo = COUNTRIES[name];
    if (!geo) continue;
    const canonical = name; // key in COUNTRIES
    if (seen.has(canonical)) continue;
    if (lower.includes(name.toLowerCase())) {
      found.push(canonical);
      seen.add(canonical);
    }
  }
  return found;
}

// ── Listing page parser ───────────────────────────────────────────────────────

interface BriefEntry {
  url:    string;
  title:  string;
  date:   string;  // YYYY-MM-DD
}

function parseListing(html: string): BriefEntry[] {
  const entries: BriefEntry[] = [];
  const seen    = new Set<string>();
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // Match <a href="..."> where href points to a TAB/RRA page, then capture link text
  const linkRe = /<a\s[^>]*href="(\/en\/publications-data\/(?:rapid-risk-assessment|threat-assessment-brief)[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(html)) !== null) {
    const relPath = m[1];
    const title   = m[2].trim();
    if (seen.has(relPath) || !title) continue;
    seen.add(relPath);

    // Find the nearest date in a 600-char window around this link
    const start   = Math.max(0, m.index - 300);
    const window  = html.substring(start, m.index + 300);
    const dateStr = parseECDCDate(window);
    if (!dateStr) continue;

    const briefDate = new Date(dateStr);
    if (isNaN(briefDate.getTime()) || briefDate < cutoff) continue;

    entries.push({ url: ECDC_BASE + relPath, title, date: dateStr });
  }

  return entries;
}

// ── Individual brief page ─────────────────────────────────────────────────────

interface BriefData {
  disease_en:  string;
  country_en:  string;
  cases:       number;
  deaths:      number;
  source:      string;
  description: string;
  date:        string;
}

async function extractBriefData(entry: BriefEntry): Promise<BriefData[]> {
  // Identify disease from the title (strip "Rapid Risk Assessment:" / "Threat Assessment:" prefix)
  const titleCore = entry.title
    .replace(/^(rapid\s+risk\s+assessment|threat\s+assessment\s+brief)\s*:?\s*/i, "")
    .replace(/\s+—\s+.*$/, "")    // strip "— update #N"
    .replace(/\s+in\s+.+$/i, "")  // strip "in Italy" (we'll get country from body)
    .trim();

  if (!isKnownDisease(titleCore)) return [];

  const diseaseInfo = normalizeDisease(titleCore);

  // Fetch the brief page
  let html: string;
  try {
    const res = await fetch(entry.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    html = await res.text();
  } catch (e) {
    console.warn("[ecdc] fetch brief:", errorMessage(e));
    return [];
  }

  const bodyText    = htmlToText(html);
  const { cases, deaths } = extractNumbers(bodyText);

  // Primary country: look in the ORIGINAL title first ("in [Country]" pattern)
  let primaryCountries: string[] = [];
  const titleInMatch = entry.title.match(/\bin\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,–—,]|$)/);
  if (titleInMatch) {
    const geo = findCountry(titleInMatch[1].trim());
    if (geo) primaryCountries = [titleInMatch[1].trim()];
  }

  // Fallback: scan the first 800 chars of the body (intro paragraph) for countries
  if (primaryCountries.length === 0) {
    const intro   = bodyText.substring(0, 800);
    primaryCountries = findMentionedCountries(intro).slice(0, 3);
  }

  // Skip multi-country events without a clear primary (WHO DON likely covers them)
  if (primaryCountries.length === 0) return [];

  // For single-country events OR when we have a clear primary, take the first
  const targetCountries = primaryCountries.length === 1 ? primaryCountries : primaryCountries.slice(0, 1);
  const description     = bodyText.substring(0, 500).trim();

  const results: BriefData[] = [];
  for (const countryKey of targetCountries) {
    const geo = findCountry(countryKey);
    if (!geo) continue;
    results.push({
      disease_en:  diseaseInfo.name_en,
      country_en:  geo.name_en,
      cases,
      deaths,
      source:      entry.url,
      description: `ECDC Rapid Risk Assessment — ${entry.title}. ${description}`.substring(0, 600),
      date:        entry.date,
    });
  }
  return results;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today    = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch ECDC TAB listing ─────────────────────────────────────────────
  let listingHtml: string;
  try {
    const res = await fetch(ECDC_TAB_LIST, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[ecdc] listing HTTP ${res.status}`);
      return NextResponse.json({ error: `ECDC listing HTTP ${res.status}` }, { status: 502 });
    }
    listingHtml = await res.text();
  } catch (e) {
    console.error("[ecdc] fetch listing:", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const entries = parseListing(listingHtml);
  console.log(`[ecdc] Found ${entries.length} recent brief(s) within ${MAX_AGE_DAYS} days`);

  if (entries.length === 0) {
    return NextResponse.json({ success: true, briefs: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing outbreaks for dedup ──────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  type Row = NonNullable<typeof existing>[number];
  const byDC = new Map<string, Row>();
  for (const row of existing ?? []) {
    const k    = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

  // ── 3. Process each brief ─────────────────────────────────────────────────
  const results = { briefs: entries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  for (const entry of entries) {
    let briefItems: BriefData[] = [];
    try {
      briefItems = await extractBriefData(entry);
    } catch (e) {
      log.push({ label: entry.title, status: "error", detail: errorMessage(e) });
      results.errors++;
      continue;
    }

    if (briefItems.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: "disease not in map or no country found" });
      results.skipped++;
      continue;
    }

    for (const item of briefItems) {
      const label = `${item.disease_en}/${item.country_en}`;

      // Sanity guard
      if (item.date > today) {
        log.push({ label, status: "skip", detail: `future date: ${item.date}` });
        results.skipped++;
        continue;
      }

      const geo = findCountry(item.country_en);
      if (!geo) {
        log.push({ label, status: "skip", detail: "country not in geo-data" });
        results.skipped++;
        continue;
      }

      const dcKey      = `${item.disease_en.toLowerCase()}|${item.country_en.toLowerCase()}`;
      const existing   = byDC.get(dcKey);

      // Never overwrite WHO DON-owned rows
      if (existing?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
        log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
        results.skipped++;
        continue;
      }

      const diseaseInfo = normalizeDisease(item.disease_en);
      const riskLevel   = assessRisk(item.disease_en, item.description, item.cases, item.deaths);

      if (existing) {
        const isNewer    = item.date > existing.date;
        const casesDiff  = item.cases  !== existing.cases;
        const deathsDiff = item.deaths !== existing.deaths;

        if (!isNewer && !casesDiff && !deathsDiff) {
          log.push({ label, status: "skip", detail: "data unchanged" });
          results.skipped++;
          continue;
        }

        const { error } = await supabase
          .from("outbreaks")
          .update({
            cases:       item.cases,
            deaths:      item.deaths,
            date:        item.date,
            source:      item.source,
            description: item.description,
            risk_level:  riskLevel,
            active:      true,
          })
          .eq("id", existing.id);

        if (error) {
          log.push({ label, status: "error", detail: error.message });
          results.errors++;
        } else {
          log.push({ label, status: "updated", detail: `${item.cases} cases / ${item.deaths} deaths (${item.date})` });
          results.updated++;
        }
      } else {
        const { error } = await supabase.from("outbreaks").insert({
          disease:     diseaseInfo.name_fr,
          disease_en:  diseaseInfo.name_en,
          disease_ar:  diseaseInfo.name_ar,
          country:     geo.name_fr,
          country_en:  geo.name_en,
          country_ar:  geo.name_ar,
          region:      geo.region,
          lat:         geo.lat,
          lng:         geo.lng,
          cases:       item.cases,
          deaths:      item.deaths,
          risk_level:  riskLevel,
          date:        item.date,
          source:      item.source,
          description: item.description,
          active:      true,
          is_seed:     false,
        });

        if (error) {
          log.push({ label, status: "error", detail: error.message });
          results.errors++;
        } else {
          log.push({ label, status: "inserted", detail: `${item.cases} cases / ${item.deaths} deaths (${item.date})` });
          results.inserted++;
        }
      }

      // Small delay to avoid hammering ECDC and Supabase
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("[ecdc] Done:", results, log);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
