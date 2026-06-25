// PAHO Epidemiological Alerts scraper — runs every Tuesday at 09:30 UTC.
// Fetches recent epidemiological alerts and updates from PAHO (Pan American
// Health Organization), extracts disease / country / cases from alert pages,
// and upserts to outbreaks. Covers Americas-specific threats not systematically
// captured by WHO DON or ReliefWeb.
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { extractAdmin1, geocodeAdmin1 } from "@/lib/geo-extract";
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const PAHO_BASE      = "https://www.paho.org";
const PAHO_ALERT_URL = "https://www.paho.org/en/epidemiological-alerts-and-updates";
const MAX_AGE_DAYS   = 45;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
  jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
};

// Americas country names sorted longest-first to avoid prefix collisions
const AMERICAS_COUNTRIES = Object.entries(COUNTRIES)
  .filter(([, geo]) => geo.region === "americas")
  .map(([key]) => key)
  .sort((a, b) => b.length - a.length);

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

function parsePAHODate(text: string): string | null {
  // "24 June 2026" / "24 Jun 2026"
  const verbal = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+(\d{4})\b/i);
  if (verbal) {
    const day = verbal[1].padStart(2, "0");
    const mon = MONTHS[verbal[2].toLowerCase().substring(0, 3)];
    return mon ? `${verbal[3]}-${mon}-${day}` : null;
  }
  // ISO: "2026-06-24"
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

function findMentionedAmericasCountries(text: string): string[] {
  const lower  = text.toLowerCase();
  const found: string[] = [];
  const seen   = new Set<string>();
  for (const name of AMERICAS_COUNTRIES) {
    const geo = COUNTRIES[name];
    if (!geo) continue;
    if (seen.has(geo.name_en)) continue;
    if (lower.includes(name.toLowerCase())) {
      found.push(name);
      seen.add(geo.name_en);
    }
  }
  return found;
}

// ── Listing page parser ───────────────────────────────────────────────────────

interface AlertEntry {
  url:   string;
  title: string;
  date:  string;  // YYYY-MM-DD
}

function parseListing(html: string): AlertEntry[] {
  const entries: AlertEntry[] = [];
  const seen    = new Set<string>();
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // PAHO alert links are relative paths like /en/epidemiological-alerts-and-updates/...
  // or /es/... (Spanish) — we only want EN paths
  const linkRe = /<a\s[^>]*href="(\/en\/[^"]*(?:epidemiological-alert|epidemiological-update|epi-alert|epi-update)[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(html)) !== null) {
    const relPath = m[1];
    const title   = m[2].trim();
    if (seen.has(relPath) || !title) continue;
    seen.add(relPath);

    const window  = html.substring(Math.max(0, m.index - 400), m.index + 400);
    const dateStr = parsePAHODate(window);
    if (!dateStr) continue;

    const alertDate = new Date(dateStr);
    if (isNaN(alertDate.getTime()) || alertDate < cutoff) continue;

    entries.push({ url: PAHO_BASE + relPath, title, date: dateStr });
  }

  return entries;
}

// ── Individual alert page ─────────────────────────────────────────────────────

interface AlertData {
  disease_en:  string;
  country_en:  string;
  cases:       number;
  deaths:      number;
  source:      string;
  description: string;
  date:        string;
  admin1:      string | null;
  admin1_lat:  number | null;
  admin1_lng:  number | null;
}

async function extractAlertData(entry: AlertEntry): Promise<AlertData[]> {
  // Disease from title: strip "Epidemiological Alert:" / "Epidemiological Update:" prefix
  const titleCore = entry.title
    .replace(/^epidemiological\s+(?:alert|update)\s*:?\s*/i, "")
    .replace(/\s*-\s*\d+.*$/, "")           // strip trailing " - 24 June 2026"
    .replace(/\s+in\s+the\s+Region.*/i, "") // strip "in the Region of the Americas"
    .replace(/\s+in\s+.+$/i, "")            // strip "in Country"
    .trim();

  if (!isKnownDisease(titleCore)) return [];
  const diseaseInfo = normalizeDisease(titleCore);

  // Fetch the individual alert page
  let html: string;
  try {
    const res = await fetch(entry.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    html = await res.text();
  } catch (e) {
    console.warn("[paho] fetch alert:", errorMessage(e));
    return [];
  }

  const bodyText       = htmlToText(html);
  const { cases, deaths } = extractNumbers(bodyText);

  // Primary country: look in the ORIGINAL title for "in [the] Country" pattern.
  // Optional "the" handles "in the Democratic Republic of the Congo and Uganda".
  let primaryCountries: string[] = [];
  const titleInMatch = entry.title.match(/\bin\s+(?:the\s+)?([A-Z][a-zA-Z\s,]+?)(?:\s*[-–—]|$)/i);
  if (titleInMatch) {
    const candidate = titleInMatch[1].replace(/\s+(and|or)\s+.+$/i, "").trim();
    // exclude generic phrases
    if (!/(region|americas|caribbean|paho)/i.test(candidate)) {
      const geo = findCountry(candidate);
      if (geo) primaryCountries = [candidate];
    }
  }

  // Fallback: scan first 2500 chars of body for Americas country names.
  // PAHO "in the Americas Region" alerts list specific countries in the
  // article body (often 500-2000 chars in, after the heading/summary).
  if (primaryCountries.length === 0) {
    const intro  = bodyText.substring(0, 2500);
    primaryCountries = findMentionedAmericasCountries(intro).slice(0, 3);
  }

  if (primaryCountries.length === 0) return [];

  // Use the single primary country (or first if multiple mentioned)
  const targetCountries = [primaryCountries[0]];
  const description     = bodyText.substring(0, 500).trim();

  const results: AlertData[] = [];
  for (const countryKey of targetCountries) {
    const geo = findCountry(countryKey);
    if (!geo) continue;

    const admin1 = await extractAdmin1(bodyText.substring(0, 3000), geo.name_en);
    let admin1_lat: number | null = null;
    let admin1_lng: number | null = null;
    if (admin1) {
      const coords = await geocodeAdmin1(admin1, geo.name_en);
      if (coords) { admin1_lat = coords.lat; admin1_lng = coords.lng; }
      await new Promise((r) => setTimeout(r, 1100));
    }

    results.push({
      disease_en:  diseaseInfo.name_en,
      country_en:  geo.name_en,
      cases,
      deaths,
      source:      entry.url,
      description: `PAHO ${entry.title}. ${description}`.substring(0, 600),
      date:        entry.date,
      admin1,
      admin1_lat,
      admin1_lng,
    });
  }
  return results;
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
  const today    = new Date().toISOString().substring(0, 10);

  // ── 1. Fetch PAHO alert listing ───────────────────────────────────────────
  let listingHtml: string;
  try {
    const res = await fetch(PAHO_ALERT_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[paho] listing HTTP ${res.status}`);
      return NextResponse.json({ error: `PAHO listing HTTP ${res.status}` }, { status: 502 });
    }
    listingHtml = await res.text();
  } catch (e) {
    console.error("[paho] fetch listing:", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const entries = parseListing(listingHtml);
  console.log(`[paho] Found ${entries.length} recent alert(s) within ${MAX_AGE_DAYS} days`);

  if (entries.length === 0) {
    return NextResponse.json({ success: true, alerts: 0, inserted: 0, updated: 0, skipped: 0 });
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

  // ── 3. Process each alert ─────────────────────────────────────────────────
  const results = { alerts: entries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  for (const entry of entries) {
    let alertItems: AlertData[] = [];
    try {
      alertItems = await extractAlertData(entry);
    } catch (e) {
      log.push({ label: entry.title, status: "error", detail: errorMessage(e) });
      results.errors++;
      continue;
    }

    if (alertItems.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: "disease not in map or no country found" });
      results.skipped++;
      continue;
    }

    for (const item of alertItems) {
      const label = `${item.disease_en}/${item.country_en}`;

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

      const dcKey    = `${item.disease_en.toLowerCase()}|${item.country_en.toLowerCase()}`;
      const existing = byDC.get(dcKey);

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
          active:       true,
          is_seed:      false,
          admin1:       item.admin1 ?? null,
          admin1_lat:   item.admin1_lat ?? null,
          admin1_lng:   item.admin1_lng ?? null,
          first_seen_at: item.date,
        });

        if (error) {
          log.push({ label, status: "error", detail: error.message });
          results.errors++;
        } else {
          log.push({ label, status: "inserted", detail: `${item.cases} cases / ${item.deaths} deaths (${item.date})` });
          results.inserted++;
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("[paho] Done:", results, log);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
