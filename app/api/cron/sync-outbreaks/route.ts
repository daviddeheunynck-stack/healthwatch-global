import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseRSSFeed, buildOutbreakFromRSSItem, parseTitle } from "@/lib/outbreak-parser";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = clean(process.env.CRON_SECRET);

const STALE_DAYS = 90;

// ── Fetch helpers ─────────────────────────────────────────────

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
        "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) { console.warn(`[sync] ${url} → HTTP ${res.status}`); return null; }
    return await res.text();
  } catch (e: any) {
    console.warn(`[sync] ${url} → ${e.message}`);
    return null;
  }
}

// ── Source 1 & 2: specific WHO DON RSS variants ───────────────

const WHO_RSS_VARIANTS = [
  "https://www.who.int/feeds/entity/csr/don/en/rss.xml",
  "https://www.who.int/feeds/entity/emergencies/disease-outbreak-news/en/rss.xml",
];

// ── Source 3: ProMED RSS ──────────────────────────────────────

const PROMED_RSS = "https://promedmail.org/feed/";

// ── Source 4: WHO general news — filter DON items only ────────
// news-english.xml is a general feed; we keep only items with
// "Disease Outbreak News" in the title.

const WHO_NEWS_RSS = "https://www.who.int/rss-feeds/news-english.xml";

// ── Source 5: scrape WHO DON listing page ─────────────────────

const WHO_DON_PAGE = "https://www.who.int/emergencies/disease-outbreak-news";

function scrapeWHOPage(html: string): Array<{ title: string; link: string }> {
  const items: Array<{ title: string; link: string }> = [];
  const seen = new Set<string>();

  // Match <a href="/emergencies/disease-outbreak-news/item/…">…text…</a>
  // WHO wraps these in various ways — try to grab the anchor text
  const re = /href="(\/emergencies\/disease-outbreak-news\/item\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const link = "https://www.who.int" + m[1];
    if (seen.has(link)) continue;

    // Strip inner HTML tags and normalise whitespace
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    // Must look like "Disease – Country" or similar (min length, contains letter)
    if (text.length > 8 && /[a-zA-Z]/.test(text)) {
      seen.add(link);
      items.push({ title: text, link });
    }
  }

  // Also try data attributes: data-title="…"
  const dataRe = /data-title="([^"]{8,})"/gi;
  while ((m = dataRe.exec(html)) !== null) {
    const t = m[1].trim();
    if (!items.some((i) => i.title === t)) {
      items.push({ title: t, link: WHO_DON_PAGE });
    }
  }

  return items.slice(0, 25);
}

// ── Main handler ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debug = req.nextUrl.searchParams.get("debug") === "1";
  const debugLog: string[] = [];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results = { inserted: 0, updated: 0, skipped: 0, errors: 0, staleDeactivated: 0 };

  // ── 1. Collect raw items from sources ─────────────────────────
  interface RawItem { title: string; link: string; description: string; pubDate: string }
  let rawItems: RawItem[] = [];
  let usedSource = "";

  // 1a. Specific WHO DON RSS
  for (const url of WHO_RSS_VARIANTS) {
    const xml = await fetchText(url);
    if (xml?.includes("<item>")) {
      const items = parseRSSFeed(xml);
      if (items.length > 0) {
        rawItems = items;
        usedSource = url;
        break;
      }
    }
  }

  // 1b. ProMED RSS
  if (!rawItems.length) {
    const xml = await fetchText(PROMED_RSS);
    if (xml?.includes("<item>")) {
      const items = parseRSSFeed(xml);
      if (items.length > 0) {
        rawItems = items;
        usedSource = PROMED_RSS;
      }
    }
  }

  // 1c. WHO general news — DON items only
  if (!rawItems.length) {
    const xml = await fetchText(WHO_NEWS_RSS);
    if (xml?.includes("<item>")) {
      const all = parseRSSFeed(xml);
      const don = all.filter((i) =>
        /disease outbreak news/i.test(i.title) || /\bdon\b/i.test(i.title)
      );
      if (don.length > 0) {
        rawItems = don;
        usedSource = WHO_NEWS_RSS + " (DON-filtered)";
      }
    }
  }

  // 1d. Scrape WHO DON page
  if (!rawItems.length) {
    const html = await fetchText(WHO_DON_PAGE);
    if (html) {
      const scraped = scrapeWHOPage(html);
      if (scraped.length > 0) {
        rawItems = scraped.map((s) => ({
          title: s.title,
          link: s.link,
          description: "",
          pubDate: new Date().toUTCString(),
        }));
        usedSource = WHO_DON_PAGE + " (html-scrape)";
      }
    }
  }

  if (!rawItems.length) {
    return NextResponse.json({ error: "All sources failed — no items retrieved" }, { status: 502 });
  }

  if (debug) debugLog.push(`Source: ${usedSource} — ${rawItems.length} raw items`);

  // ── 2. Load existing outbreaks ────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, source, date, cases, deaths");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const bySource = new Map<string, any>();
  const byDiseaseCountry = new Map<string, any>();
  for (const row of existing || []) {
    if (row.source) bySource.set(row.source, row);
    const k = `${(row.disease_en || "").toLowerCase()}|${(row.country_en || "").toLowerCase()}`;
    byDiseaseCountry.set(k, row);
  }

  // ── 3. Upsert ─────────────────────────────────────────────────
  for (const item of rawItems) {
    try {
      const outbreak = buildOutbreakFromRSSItem(item);

      if (debug) {
        const parsed = parseTitle(item.title);
        debugLog.push(
          parsed
            ? `✓ "${item.title}" → ${parsed.disease} / ${parsed.country}${outbreak ? "" : " (geo not found)"}`
            : `✗ "${item.title}" → no match`
        );
      }

      if (!outbreak) { results.skipped++; continue; }

      const dcKey = `${outbreak.disease_en.toLowerCase()}|${outbreak.country_en.toLowerCase()}`;
      const existingRow = bySource.get(outbreak.source) || byDiseaseCountry.get(dcKey);

      if (existingRow) {
        const needsUpdate =
          existingRow.cases !== outbreak.cases ||
          existingRow.deaths !== outbreak.deaths ||
          existingRow.date < outbreak.date;

        if (needsUpdate) {
          const { error } = await supabase
            .from("outbreaks")
            .update({
              cases: outbreak.cases, deaths: outbreak.deaths,
              date: outbreak.date, description: outbreak.description,
              risk_level: outbreak.risk_level, source: outbreak.source,
              active: true,
            })
            .eq("id", existingRow.id);
          if (error) { console.error("[sync] update:", error); results.errors++; }
          else results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        const { error } = await supabase.from("outbreaks").insert(outbreak);
        if (error) { console.error("[sync] insert:", error, outbreak); results.errors++; }
        else results.inserted++;
      }

      await new Promise((r) => setTimeout(r, 50));
    } catch (e: any) {
      console.error("[sync] item error:", e.message);
      results.errors++;
    }
  }

  // ── 4. Deactivate stale entries ───────────────────────────────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const { count, error: staleErr } = await supabase
    .from("outbreaks")
    .update({ active: false })
    .eq("active", true)
    .lt("date", cutoff.toISOString().split("T")[0]);

  if (!staleErr) results.staleDeactivated = count ?? 0;

  const response: Record<string, any> = {
    success: true,
    timestamp: new Date().toISOString(),
    source: usedSource,
    rssItemsFound: rawItems.length,
    ...results,
  };
  if (debug) response.debugLog = debugLog;

  console.log("[sync] Done:", results, "source:", usedSource);
  return NextResponse.json(response);
}
