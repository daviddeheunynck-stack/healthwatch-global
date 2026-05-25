import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseRSSFeed, buildOutbreakFromRSSItem } from "@/lib/outbreak-parser";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = clean(process.env.CRON_SECRET);

// RSS sources tried in order — first successful one wins
const RSS_SOURCES = [
  // WHO Disease Outbreak News (try several URL variants)
  "https://www.who.int/feeds/entity/csr/don/en/rss.xml",
  "https://www.who.int/feeds/entity/emergencies/disease-outbreak-news/en/rss.xml",
  "https://www.who.int/rss-feeds/news-english.xml",
  // ProMED — reliable fallback, covers same outbreaks
  "https://promedmail.org/feed/",
];

// WHO DON page — scrape article titles as last resort
const WHO_DON_PAGE = "https://www.who.int/emergencies/disease-outbreak-news";

// How many days before an outbreak is considered stale and set to inactive
const STALE_DAYS = 90;

export async function GET(req: NextRequest) {
  // Auth guard
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results = { inserted: 0, updated: 0, skipped: 0, errors: 0, staleDeactivated: 0 };

  // ── 1. Fetch RSS — try each source until one works ────────────
  let xml = "";
  let usedSource = "";

  for (const url of RSS_SOURCES) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        console.warn(`[sync-outbreaks] ${url} → HTTP ${res.status}, trying next`);
        continue;
      }
      xml = await res.text();
      if (xml.includes("<item>")) {
        usedSource = url;
        console.log(`[sync-outbreaks] Using source: ${url}`);
        break;
      }
      console.warn(`[sync-outbreaks] ${url} → no <item> tags, trying next`);
    } catch (err: any) {
      console.warn(`[sync-outbreaks] ${url} → ${err.message}, trying next`);
    }
  }

  // ── 1b. Fallback: scrape WHO DON page HTML ───────────────────
  if (!xml || !usedSource) {
    try {
      const res = await fetch(WHO_DON_PAGE, {
        headers: { "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)" },
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const html = await res.text();
        // Extract article titles from WHO DON page links
        // WHO DON links look like: href="/emergencies/disease-outbreak-news/item/YEAR-DONXXX"
        const linkRe = /href="(\/emergencies\/disease-outbreak-news\/item\/[^"]+)"/g;
        const titleRe = /aria-label="([^"]+)"|<h3[^>]*>([^<]+)<\/h3>|<a[^>]+emergencies\/disease-outbreak-news\/item\/[^"]+[^>]*>([^<]+)<\/a>/g;

        // Build fake RSS XML from scraped titles + links
        const articleLinks: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(html)) !== null) {
          const link = "https://www.who.int" + m[1];
          if (!articleLinks.includes(link)) articleLinks.push(link);
        }

        // Extract corresponding titles from the page
        const allTitles: string[] = [];
        const h3Re = /<a[^>]+\/emergencies\/disease-outbreak-news\/item\/[^"]*"[^>]*>\s*([^<]{10,}?)\s*<\/a>/g;
        while ((m = h3Re.exec(html)) !== null) {
          const t = m[1].replace(/\s+/g, " ").trim();
          if (t.length > 10 && !allTitles.includes(t)) allTitles.push(t);
        }

        if (articleLinks.length > 0 && allTitles.length > 0) {
          // Build minimal RSS XML so the existing parser can consume it
          const fakeItems = articleLinks.slice(0, 20).map((link, i) => {
            const title = allTitles[i] || "";
            const today = new Date().toUTCString();
            return `<item><title><![CDATA[${title}]]></title><link>${link}</link><description></description><pubDate>${today}</pubDate></item>`;
          });
          xml = `<rss><channel>${fakeItems.join("")}</channel></rss>`;
          usedSource = WHO_DON_PAGE + " (html-scrape)";
          console.log(`[sync-outbreaks] Using WHO page scrape: ${articleLinks.length} links, ${allTitles.length} titles`);
        }
      }
    } catch (err: any) {
      console.warn("[sync-outbreaks] WHO page scrape failed:", err.message);
    }
  }

  if (!xml || !usedSource) {
    return NextResponse.json({ error: "All sources failed (RSS + page scrape)" }, { status: 502 });
  }

  // ── 2. Parse RSS items ─────────────────────────────────────────
  const rssItems = parseRSSFeed(xml);
  console.log(`[sync-outbreaks] Parsed ${rssItems.length} RSS items`);

  if (rssItems.length === 0) {
    return NextResponse.json({ error: "No RSS items parsed", results }, { status: 500 });
  }

  // ── 3. Load existing outbreaks from Supabase ──────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, source, date, cases, deaths");

  if (fetchErr) {
    console.error("[sync-outbreaks] Failed to fetch existing outbreaks:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  // Build lookup maps
  const bySource = new Map<string, any>();
  const byDiseaseCountry = new Map<string, any>();
  for (const row of (existing || [])) {
    if (row.source) bySource.set(row.source, row);
    const key = `${(row.disease_en || "").toLowerCase()}|${(row.country_en || "").toLowerCase()}`;
    byDiseaseCountry.set(key, row);
  }

  // ── 4. Upsert each parsed entry ───────────────────────────────
  for (const item of rssItems) {
    try {
      const outbreak = buildOutbreakFromRSSItem(item);
      if (!outbreak) { results.skipped++; continue; }

      const dcKey = `${outbreak.disease_en.toLowerCase()}|${outbreak.country_en.toLowerCase()}`;

      const existingBySource = bySource.get(outbreak.source);
      const existingByDC = byDiseaseCountry.get(dcKey);
      const existingRow = existingBySource || existingByDC;

      if (existingRow) {
        // Update only if numbers changed or date is newer
        const needsUpdate =
          existingRow.cases !== outbreak.cases ||
          existingRow.deaths !== outbreak.deaths ||
          existingRow.date < outbreak.date;

        if (needsUpdate) {
          const { error } = await supabase
            .from("outbreaks")
            .update({
              cases: outbreak.cases,
              deaths: outbreak.deaths,
              date: outbreak.date,
              description: outbreak.description,
              risk_level: outbreak.risk_level,
              source: outbreak.source,
              active: true,
            })
            .eq("id", existingRow.id);

          if (error) { console.error("[sync-outbreaks] Update error:", error); results.errors++; }
          else results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        // Insert new entry
        const { error } = await supabase.from("outbreaks").insert(outbreak);
        if (error) {
          console.error("[sync-outbreaks] Insert error:", error, outbreak);
          results.errors++;
        } else {
          results.inserted++;
        }
      }

      // Small delay to avoid Supabase rate limits
      await new Promise((r) => setTimeout(r, 50));
    } catch (err: any) {
      console.error("[sync-outbreaks] Item error:", err.message);
      results.errors++;
    }
  }

  // ── 5. Deactivate stale outbreaks ─────────────────────────────
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS);
  const staleDateStr = staleCutoff.toISOString().split("T")[0];

  const { error: staleErr, count } = await supabase
    .from("outbreaks")
    .update({ active: false })
    .eq("active", true)
    .lt("date", staleDateStr);

  if (staleErr) {
    console.error("[sync-outbreaks] Stale deactivation error:", staleErr);
  } else {
    results.staleDeactivated = count ?? 0;
  }

  console.log("[sync-outbreaks] Done:", results);
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    source: usedSource,
    rssItemsFound: rssItems.length,
    ...results,
  });
}
