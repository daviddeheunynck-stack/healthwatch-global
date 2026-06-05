import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseRSSFeed, buildOutbreakFromRSSItem } from "@/lib/outbreak-parser";
import { fetchWHODONList, parseWHODONItem } from "@/lib/who-api";
import type { ParsedOutbreak } from "@/lib/outbreak-parser";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = clean(process.env.CRON_SECRET);

const STALE_DAYS = 90;

// RSS fallback sources (tried only if WHO OData fails)
const RSS_FALLBACKS = [
  "https://www.who.int/feeds/entity/csr/don/en/rss.xml",
  "https://www.who.int/feeds/entity/emergencies/disease-outbreak-news/en/rss.xml",
  "https://promedmail.org/feed/",
];

async function fetchRSSFallback(): Promise<{ items: ParsedOutbreak[]; source: string } | null> {
  for (const url of RSS_FALLBACKS) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "HealthWatch-Global/1.0 (contact@healthwatch-global.com)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        next: { revalidate: 0 },
      });
      if (!res.ok) { console.warn(`[sync] ${url} → HTTP ${res.status}`); continue; }
      const xml = await res.text();
      if (!xml.includes("<item>")) continue;

      const raw = parseRSSFeed(xml);
      const items = raw
        .map((i) => buildOutbreakFromRSSItem(i))
        .filter((x): x is ParsedOutbreak => x !== null);

      if (items.length > 0) return { items, source: url };
    } catch (e: any) {
      console.warn(`[sync] ${url} → ${e.message}`);
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debug = req.nextUrl.searchParams.get("debug") === "1";
  const debugLog: string[] = [];
  const errorLog: string[] = [];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results = { inserted: 0, updated: 0, skipped: 0, errors: 0, staleDeactivated: 0 };

  // ── 1. Fetch outbreak data ────────────────────────────────────
  let outbreaks: ParsedOutbreak[] = [];
  let usedSource = "";

  // Primary: WHO OData API (Sitefinity CMS — public, no auth required)
  try {
    const whoItems = await fetchWHODONList(40);
    if (debug) debugLog.push(`WHO OData: ${whoItems.length} raw items`);

    for (const item of whoItems) {
      const parsed = await parseWHODONItem(item, false);
      if (debug) {
        debugLog.push(
          parsed
            ? `✓ "${item.Title}" → ${parsed.disease_en} / ${parsed.country_en}`
            : `✗ "${item.Title}" → skipped`
        );
      }
      if (parsed) outbreaks.push(parsed);
    }

    if (outbreaks.length > 0) {
      usedSource = "WHO OData API";
      console.log(`[sync] WHO OData: ${whoItems.length} raw → ${outbreaks.length} parsed`);
    }
  } catch (e: any) {
    console.warn("[sync] WHO OData failed:", e.message);
    if (debug) debugLog.push(`WHO OData error: ${e.message}`);
  }

  // Fallback: RSS sources
  if (outbreaks.length === 0) {
    console.warn("[sync] WHO OData yielded 0 results, trying RSS fallbacks");
    const rss = await fetchRSSFallback();
    if (rss) {
      outbreaks = rss.items;
      usedSource = rss.source + " (RSS fallback)";
      if (debug) debugLog.push(`RSS fallback (${rss.source}): ${rss.items.length} parsed`);
    }
  }

  if (outbreaks.length === 0) {
    return NextResponse.json({
      error: "All sources failed — WHO OData + all RSS fallbacks returned 0 usable items",
      debug: debug ? debugLog : undefined,
    }, { status: 502 });
  }

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
  for (const outbreak of outbreaks) {
    try {
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
          if (error) {
            console.error("[sync] update:", error);
            errorLog.push(`UPDATE ${outbreak.disease_en}/${outbreak.country_en}: ${error.message}`);
            results.errors++;
          } else results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        const { error } = await supabase.from("outbreaks").insert(outbreak);
        if (error) {
          console.error("[sync] insert:", error, outbreak);
          errorLog.push(`INSERT ${outbreak.disease_en}/${outbreak.country_en}: ${error.message}`);
          results.errors++;
        }
        else results.inserted++;
      }

      await new Promise((r) => setTimeout(r, 50));
    } catch (e: any) {
      console.error("[sync] item error:", e.message);
      results.errors++;
    }
  }

  // ── 4. Deactivate stale entries (never touch seed rows) ──────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const { count } = await supabase
    .from("outbreaks")
    .update({ active: false })
    .eq("active", true)
    .neq("is_seed", true)
    .lt("date", cutoff.toISOString().split("T")[0]);

  results.staleDeactivated = count ?? 0;

  console.log("[sync] Done:", results, "source:", usedSource);
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    source: usedSource,
    outbreaksParsed: outbreaks.length,
    ...results,
    ...(debug ? { debugLog, errorLog } : {}),
  });
}
