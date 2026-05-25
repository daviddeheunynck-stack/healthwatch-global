import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseRSSFeed, buildOutbreakFromRSSItem } from "@/lib/outbreak-parser";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = clean(process.env.CRON_SECRET);

// WHO Disease Outbreak News RSS
const WHO_DON_RSS = "https://www.who.int/feeds/entity/csr/don/en/rss.xml";

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

  // ── 1. Fetch WHO DON RSS ───────────────────────────────────────
  let xml: string;
  try {
    const res = await fetch(WHO_DON_RSS, {
      headers: {
        "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (err: any) {
    console.error("[sync-outbreaks] Failed to fetch WHO RSS:", err.message);
    return NextResponse.json({ error: "Failed to fetch WHO RSS", detail: err.message }, { status: 502 });
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
    rssItemsFound: rssItems.length,
    ...results,
  });
}
