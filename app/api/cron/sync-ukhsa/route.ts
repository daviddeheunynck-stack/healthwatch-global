// UKHSA (UK Health Security Agency) sync — runs twice daily.
// Fetches the gov.uk ATOM publications feed for UKHSA, filters entries
// related to known diseases or outbreak events, and upserts to outbreaks.
// UKHSA publishes HAIRS risk assessments and incident reports within hours
// of confirmed national or international health threats — often before WHO DON.
// Never overwrites rows owned by the WHO DON daily sync.

import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-monitor";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { normalizeDisease } from "@/lib/disease-data";
import { COUNTRIES, findCountry } from "@/lib/geo-data";
import { extractNumbers, assessRisk } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic     = "force-dynamic";
export const maxDuration = 90;

const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v ?? "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL         = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

const UKHSA_ATOM   = "https://www.gov.uk/government/organisations/uk-health-security-agency.atom";
const GOV_BASE     = "https://www.gov.uk";
const MAX_AGE_DAYS = 30;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "application/atom+xml,application/xml,text/html,*/*",
  "Accept-Language": "en-GB,en;q=0.9",
};

const COUNTRY_NAMES = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);

const TEXT_ALIASES: Record<string, string> = {
  " drc ":     "Democratic Republic of the Congo",
  "(drc)":     "Democratic Republic of the Congo",
  " dr congo": "Democratic Republic of the Congo",
  " usa ":     "United States",
  " u.s. ":    "United States",
  " uk ":      "United Kingdom",
  " england ": "United Kingdom",
  " wales ":   "United Kingdom",
  " scotland ": "United Kingdom",
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
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// GOV.UK's cookie banner + full mega-menu (Benefits, Business, Driving, Money
// and tax, Visas...) run ~1,650 characters before any page's real content —
// confirmed to still fit under the old 3,000-char budget on the page tested,
// but only by margin, and the GOV.UK Design System's own class
// (govuk-main-wrapper) is a stable, whole-of-government convention, not a
// page-specific quirk, so it's worth anchoring on rather than relying on that
// margin holding for every future UKHSA publication.
function extractUKHSABody(html: string): string {
  const idx = html.indexOf("govuk-main-wrapper");
  if (idx < 0) return html;
  const tagEnd = html.indexOf(">", idx) + 1;
  return html.slice(tagEnd, tagEnd + 8000);
}

// Strip UKHSA-specific title prefixes → extract core disease term
function extractUKHSADisease(title: string): string {
  return title
    .replace(/^HAIRS\s+(?:joint\s+)?(?:risk\s+assessment|meeting)\s*[-:–]\s*/i, "")
    .replace(/^(?:UK\s+)?Technical\s+briefing\s*[-:–\s]\s*/i, "")
    .replace(/^Weekly\s+(?:national\s+)?influenza\s+and\s+/i, "")
    .replace(/^(?:Monkeypox|Mpox)\s+technical\s+briefing\s*\d*\s*[-:–]\s*/i, "Mpox: ")
    .replace(/\s+in\s+(?:England|UK|United\s+Kingdom|Scotland|Wales|Northern\s+Ireland|the\s+UK).*/i, "")
    .replace(/\s*[-:–]\s*.+$/, "")
    .replace(/\s+among\s+.+$/i, "")
    .replace(/\s+associated\s+with\s+.+$/i, "")
    .replace(/\s*\([^)]+\)\s*$/, "")
    .trim();
}

// Returns countries ordered by earliest position of first occurrence in the
// text, not by iteration order over TEXT_ALIASES/COUNTRY_NAMES — callers take
// countries[0] as "the primary country", which needs to mean "mentioned
// first in the article", not "whichever name happens to be declared first".
// Found 2026-07-15 (same class of bug already fixed in sync-ecdc-threats).
function findMentionedCountries(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const positions = new Map<string, number>();

  const record = (canonical: string, idx: number) => {
    if (idx === -1) return;
    const prev = positions.get(canonical);
    if (prev === undefined || idx < prev) positions.set(canonical, idx);
  };

  for (const [abbr, canonical] of Object.entries(TEXT_ALIASES)) {
    record(canonical, lower.indexOf(abbr));
  }
  for (const name of COUNTRY_NAMES) {
    if (positions.has(name)) continue;
    const lowerName = name.toLowerCase();
    const idxSpace = lower.indexOf(` ${lowerName} `);
    const idxComma = lower.indexOf(` ${lowerName},`);
    record(name, idxSpace === -1 ? idxComma : idxComma === -1 ? idxSpace : Math.min(idxSpace, idxComma));
  }
  return [...positions.keys()].sort((a, b) => positions.get(a)! - positions.get(b)!);
}

// ── ATOM parser ───────────────────────────────────────────────────────────────

interface AtomEntry {
  url:   string;
  title: string;
  date:  string;
  summary: string;
}

function parseATOMFeed(xml: string): AtomEntry[] {
  const entries: AtomEntry[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const raw = m[1];

    const titleRaw = raw.match(/<title[^>]*>(?:<!\[CDATA\[)?([^\]<]+)/i)?.[1]?.trim();
    if (!titleRaw) continue;
    const title = htmlToText(titleRaw);

    const link =
      raw.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/i)?.[1]?.trim() ??
      raw.match(/<link[^>]+href="([^"]+)"[^>]*rel="alternate"/i)?.[1]?.trim() ??
      raw.match(/<link[^>]+href="([^"]+)"/i)?.[1]?.trim();
    if (!link) continue;

    const dateRaw =
      raw.match(/<published>([^<]+)<\/published>/i)?.[1]?.trim() ??
      raw.match(/<updated>([^<]+)<\/updated>/i)?.[1]?.trim();
    if (!dateRaw) continue;
    const d = new Date(dateRaw);
    if (isNaN(d.getTime()) || d < cutoff) continue;

    const summaryRaw = raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? "";
    const summary = htmlToText(
      summaryRaw.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "")
    );

    const url = link.startsWith("http") ? link : GOV_BASE + link;
    entries.push({ url, title, date: d.toISOString().substring(0, 10), summary });
  }
  return entries;
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

  // ── 1. Fetch UKHSA ATOM ───────────────────────────────────────────────────
  let atomXml: string;
  try {
    const res = await fetch(UKHSA_ATOM, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      await logCronRun(supabase, "sync-ukhsa", "error", 0, `UKHSA ATOM HTTP ${res.status}`);
      return NextResponse.json({ error: `UKHSA ATOM HTTP ${res.status}` }, { status: 502 });
    }
    atomXml = await res.text();
  } catch (e) {
    Sentry.captureException(e, { tags: { cron: "sync-ukhsa" } });
    await logCronRun(supabase, "sync-ukhsa", "error", 0, errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const entries = parseATOMFeed(atomXml);
  console.log(`[ukhsa] ${entries.length} entries within ${MAX_AGE_DAYS} days`);
  if (entries.length === 0) {
    await logCronRun(supabase, "sync-ukhsa", "no_data", 0);
    return NextResponse.json({ success: true, entries: 0, inserted: 0, updated: 0, skipped: 0 });
  }

  // ── 2. Load existing for dedup ────────────────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, cases, deaths, date, source, active, description")
    .or("active.eq.true,date.gte." + new Date(Date.now() - 90 * 86400_000).toISOString().substring(0, 10));
  if (fetchErr) {
    await logCronRun(supabase, "sync-ukhsa", "error", 0, fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  type Row = NonNullable<typeof existing>[number];
  const bySource = new Map<string, Row>();
  const byDC     = new Map<string, Row>();
  for (const row of existing ?? []) {
    if (row.source) bySource.set(row.source, row);
    const k    = `${(row.disease_en ?? "").toLowerCase()}|${(row.country_en ?? "").toLowerCase()}`;
    const prev = byDC.get(k);
    if (!prev || (row.active && !prev.active)) byDC.set(k, row);
  }

  // ── 3. Process entries ────────────────────────────────────────────────────
  const results = { entries: entries.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type Log = { label: string; status: string; detail?: string };
  const log: Log[] = [];

  for (const entry of entries) {
    const rawDisease = extractUKHSADisease(entry.title);
    if (!isKnownDisease(rawDisease)) {
      log.push({ label: entry.title, status: "skip", detail: `unknown disease: ${rawDisease}` });
      results.skipped++;
      continue;
    }

    // Fetch full article for cases + country mentions
    let pageText = `${entry.title} ${entry.summary}`;
    try {
      const res = await fetch(entry.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
      if (res.ok) pageText = `${entry.title} ${entry.summary} ${htmlToText(extractUKHSABody(await res.text()))}`;
    } catch (e) {
      console.warn("[ukhsa] fetch page:", errorMessage(e));
    }

    const countries = findMentionedCountries(pageText.substring(0, 3000));
    if (countries.length === 0) {
      log.push({ label: entry.title, status: "skip", detail: "no country found" });
      results.skipped++;
      continue;
    }

    const geo = findCountry(countries[0]);
    if (!geo) {
      log.push({ label: entry.title, status: "skip", detail: `geo miss: ${countries[0]}` });
      results.skipped++;
      continue;
    }

    if (entry.date > today) { results.skipped++; continue; }
    if (bySource.has(entry.url)) {
      log.push({ label: entry.title, status: "skip", detail: "source URL in DB" });
      results.skipped++;
      continue;
    }

    const diseaseInfo = normalizeDisease(rawDisease);
    const { cases, deaths } = extractNumbers(pageText.substring(0, 3000));
    const riskLevel   = assessRisk(diseaseInfo.name_en, pageText, cases, deaths);
    const description = `UKHSA — ${entry.title}. ${entry.summary}`.substring(0, 600);
    const label       = `${diseaseInfo.name_en}/${geo.name_en}`;

    // Skip 0/0 entries — UKHSA's ATOM feed mixes real incident reports with
    // general reference guidance ("Diphtheria: migrant health guide" etc.)
    // that mention a disease name but report no current case count. Same
    // guard as sync-africa-cdc / sync-paho-alerts.
    if (cases === 0 && deaths === 0) {
      log.push({ label, status: "skip", detail: "0 cases and 0 deaths — likely a guidance document, not an outbreak report" });
      results.skipped++;
      continue;
    }

    const dcKey      = `${diseaseInfo.name_en.toLowerCase()}|${geo.name_en.toLowerCase()}`;
    const existingRow = byDC.get(dcKey);

    if (existingRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
      log.push({ label, status: "skip", detail: "owned by WHO DON" });
      results.skipped++;
      continue;
    }

    if (existingRow) {
      if (entry.date <= existingRow.date && cases === existingRow.cases) {
        log.push({ label, status: "skip", detail: "unchanged" });
        results.skipped++;
        continue;
      }
      const updatePayload: Record<string, unknown> = {
        cases, deaths, date: entry.date, source: entry.url,
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
      const { error } = await supabase.from("outbreaks").update(updatePayload)
        .eq("id", existingRow.id).lte("source_priority", 5);
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else { log.push({ label, status: "updated" }); results.updated++; }
    } else {
      const { error } = await supabase.from("outbreaks").insert({
        disease: diseaseInfo.name_fr, disease_en: diseaseInfo.name_en, disease_ar: diseaseInfo.name_ar,
        country: geo.name_fr, country_en: geo.name_en, country_ar: geo.name_ar,
        region: geo.region, lat: geo.lat, lng: geo.lng,
        cases, deaths, risk_level: riskLevel, date: entry.date,
        source: entry.url, description, active: true, is_seed: false, source_priority: 5,
        admin1: null, admin1_lat: null, admin1_lng: null,
      });
      if (error) { log.push({ label, status: "error", detail: error.message }); results.errors++; }
      else { log.push({ label, status: "inserted", detail: `${cases}/${deaths} (${entry.date})` }); results.inserted++; }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("[ukhsa] Done:", results, log);
  await logCronRun(supabase, "sync-ukhsa", "ok", (results.inserted ?? 0) + (results.updated ?? 0));
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
