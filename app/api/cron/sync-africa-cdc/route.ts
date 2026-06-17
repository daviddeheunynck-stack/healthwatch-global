// Africa CDC News scraper — runs Wed + Sat at 09:00 UTC.
// Fetches recent news posts from africacdc.org/news-item/ (previously /disease-outbreak-news/),
// extracts disease / country / cases, and upserts to outbreaks. Covers sub-Saharan
// African outbreaks (Guinea, Sierra Leone, Burkina Faso, etc.) that may not
// appear in WHO DON or ReliefWeb until later in the outbreak timeline.
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

const AFRICA_CDC_BASE = "https://africacdc.org";
const AFRICA_CDC_URL  = "https://africacdc.org/news-item/";
const MAX_AGE_DAYS    = 45;

const FETCH_HEADERS = {
  "User-Agent":      "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
  "Accept":          "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const MONTHS: Record<string, string> = {
  jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
  jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
};

// African country names sorted longest-first
const AFRICA_COUNTRIES = Object.entries(COUNTRIES)
  .filter(([, geo]) => geo.region === "africa")
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

function parseAfricaCDCDate(text: string): string | null {
  const verbal = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+(\d{4})\b/i);
  if (verbal) {
    const day = verbal[1].padStart(2, "0");
    const mon = MONTHS[verbal[2].toLowerCase().substring(0, 3)];
    return mon ? `${verbal[3]}-${mon}-${day}` : null;
  }
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function isKnownDisease(rawName: string): boolean {
  const info = normalizeDisease(rawName);
  return !!(info.family || info.cfr_ref || info.r0_ref || info.incubationMin);
}

function findMentionedAfricanCountries(text: string): string[] {
  const lower  = text.toLowerCase();
  const found: string[] = [];
  const seen   = new Set<string>();
  for (const name of AFRICA_COUNTRIES) {
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

// Extract disease name from an Africa CDC outbreak title.
// Common patterns:
//   "Mpox Outbreak in Democratic Republic of Congo"
//   "Cholera Outbreak Update — Cameroon"
//   "Marburg Virus Disease — Rwanda"
//   "Yellow Fever — Nigeria | Update 5"
//   "Bundibugyo Ebola without vaccines or therapeutics: why..."
//   "2026 Ebola Disease Outbreak Triggers Unified Response..."
function extractDiseaseFromTitle(title: string): string {
  return title
    .replace(/^\d{4}\s+/, "")                                       // "2026 Ebola Disease..." → "Ebola Disease..."
    .replace(/:.*$/, "")                                             // "Bundibugyo Ebola...: why..." → "Bundibugyo Ebola..."
    .replace(/\s+without\b.*/i, "")                                  // "Bundibugyo Ebola without vaccines" → "Bundibugyo Ebola"
    .replace(/\s*[-–—|]\s*(update|situation|report)\s*#?\d*.*/i, "")
    .replace(/\s+outbreak\s+(?:update\s+)?(?:in|update)\s*.*/i, "")
    .replace(/\s+outbreak\s*$/i, "")
    .replace(/\s*[-–—]\s*.+$/, "")
    .replace(/\s+(?:in|update)\s+.+$/i, "")
    .trim();
}

// ── Listing page parser ───────────────────────────────────────────────────────

interface OutbreakPost {
  url:   string;
  title: string;
  date:  string;  // YYYY-MM-DD
}

function parseListing(html: string): OutbreakPost[] {
  const posts:  OutbreakPost[] = [];
  const seen   = new Set<string>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  // Africa CDC uses WordPress — news items are at /news-item/[slug]/
  // Match: href="https://africacdc.org/news-item/some-slug/" or "/news-item/..."
  const linkRe = /<a\s[^>]*href="((?:https?:\/\/africacdc\.org)?\/news-item\/[^/"]+\/?)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(html)) !== null) {
    const rawUrl = m[1];
    const title  = m[2].trim();
    if (!title || title.length < 5) continue;

    // Resolve to absolute URL
    const absUrl = rawUrl.startsWith("http") ? rawUrl : AFRICA_CDC_BASE + rawUrl;
    if (seen.has(absUrl)) continue;
    seen.add(absUrl);

    // Find date in surrounding HTML window
    const window  = html.substring(Math.max(0, m.index - 400), m.index + 400);
    const dateStr = parseAfricaCDCDate(window);
    if (!dateStr) continue;

    const postDate = new Date(dateStr);
    if (isNaN(postDate.getTime()) || postDate < cutoff) continue;

    posts.push({ url: absUrl, title, date: dateStr });
  }

  return posts;
}

// ── Individual post page ──────────────────────────────────────────────────────

interface PostData {
  disease_en:  string;
  country_en:  string;
  cases:       number;
  deaths:      number;
  source:      string;
  description: string;
  date:        string;
}

async function extractPostData(post: OutbreakPost): Promise<PostData[]> {
  const diseaseRaw = extractDiseaseFromTitle(post.title);
  if (!diseaseRaw || !isKnownDisease(diseaseRaw)) return [];
  const diseaseInfo = normalizeDisease(diseaseRaw);

  let html: string;
  try {
    const res = await fetch(post.url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    html = await res.text();
  } catch (e) {
    console.warn("[africa-cdc] fetch post:", errorMessage(e));
    return [];
  }

  const bodyText      = htmlToText(html);
  const { cases, deaths } = extractNumbers(bodyText);

  // Primary country: try title first
  let primaryCountry: string | null = null;

  // "in [Country]" from title
  const titleInMatch = post.title.match(/\bin\s+([A-Z][a-zA-Z\s]+?)(?:\s*[-–—|]|$)/);
  if (titleInMatch) {
    const candidate = titleInMatch[1].trim();
    const geo       = findCountry(candidate);
    if (geo) primaryCountry = candidate;
  }

  // Fallback: scan first 600 chars of body for African country names
  if (!primaryCountry) {
    const intro    = bodyText.substring(0, 600);
    const mentions = findMentionedAfricanCountries(intro);
    if (mentions.length > 0) primaryCountry = mentions[0];
  }

  if (!primaryCountry) return [];

  const geo = findCountry(primaryCountry);
  if (!geo) return [];

  const description = bodyText.substring(0, 500).trim();

  return [{
    disease_en:  diseaseInfo.name_en,
    country_en:  geo.name_en,
    cases,
    deaths,
    source:      post.url,
    description: `Africa CDC — ${post.title}. ${description}`.substring(0, 600),
    date:        post.date,
  }];
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

  // ── 1. Fetch Africa CDC listing ───────────────────────────────────────────
  let listingHtml: string;
  try {
    const res = await fetch(AFRICA_CDC_URL, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`[africa-cdc] listing HTTP ${res.status}`);
      return NextResponse.json({ error: `Africa CDC HTTP ${res.status}` }, { status: 502 });
    }
    listingHtml = await res.text();
  } catch (e) {
    console.error("[africa-cdc] fetch listing:", errorMessage(e));
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }

  const posts = parseListing(listingHtml);
  console.log(`[africa-cdc] Found ${posts.length} recent post(s) within ${MAX_AGE_DAYS} days`);

  if (posts.length === 0) {
    return NextResponse.json({ success: true, posts: 0, inserted: 0, updated: 0, skipped: 0 });
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

  // ── 3. Process each post ──────────────────────────────────────────────────
  const results = { posts: posts.length, inserted: 0, updated: 0, skipped: 0, errors: 0 };
  type LogEntry = { label: string; status: string; detail?: string };
  const log: LogEntry[] = [];

  for (const post of posts) {
    let items: PostData[] = [];
    try {
      items = await extractPostData(post);
    } catch (e) {
      log.push({ label: post.title, status: "error", detail: errorMessage(e) });
      results.errors++;
      continue;
    }

    if (items.length === 0) {
      log.push({ label: post.title, status: "skip", detail: "disease not in map or no country found" });
      results.skipped++;
      continue;
    }

    for (const item of items) {
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

      const dcKey   = `${item.disease_en.toLowerCase()}|${item.country_en.toLowerCase()}`;
      const existRow = byDC.get(dcKey);

      // Never overwrite WHO DON-owned rows
      if (existRow?.source?.includes("who.int/emergencies/disease-outbreak-news")) {
        log.push({ label, status: "skip", detail: "owned by WHO DON sync" });
        results.skipped++;
        continue;
      }

      const diseaseInfo = normalizeDisease(item.disease_en);
      const riskLevel   = assessRisk(item.disease_en, item.description, item.cases, item.deaths);

      if (existRow) {
        const isNewer    = item.date > existRow.date;
        const casesDiff  = item.cases  !== existRow.cases;
        const deathsDiff = item.deaths !== existRow.deaths;

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
          .eq("id", existRow.id);

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

      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("[africa-cdc] Done:", results, log);
  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results, log });
}
