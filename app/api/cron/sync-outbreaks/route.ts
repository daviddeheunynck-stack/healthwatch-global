import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseRSSFeed, buildOutbreakFromRSSItem } from "@/lib/outbreak-parser";
import { fetchWHODONList, parseWHODONItem } from "@/lib/who-api";
import type { ParsedOutbreak } from "@/lib/outbreak-parser";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const DEEPL_API_KEY        = clean(process.env.DEEPL_API_KEY); // optional — sign up free at deepl.com

// ── DeepL batch translation ────────────────────────────────────────────────────
// Translates a single text to multiple target languages in one API call.
// Returns null for each language if translation fails or key is not set.
// Free tier: 500 000 chars/month — ample for ~30 outbreak descriptions.
async function translateDescription(text: string): Promise<{
  fr: string | null; es: string | null; ar: string | null; id: string | null;
}> {
  const empty = { fr: null, es: null, ar: null, id: null };
  if (!DEEPL_API_KEY || !text?.trim()) return empty;

  const endpoint = "https://api-free.deepl.com/v2/translate";
  const targets = ["FR", "ES", "AR", "ID"] as const;
  const keys:    ["fr", "es", "ar", "id"] = ["fr", "es", "ar", "id"];

  const results: { fr: string | null; es: string | null; ar: string | null; id: string | null } = { ...empty };

  try {
    // DeepL Free API: one language per call (batch in parallel)
    const calls = targets.map((lang) =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${DEEPL_API_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          text:        [text],
          source_lang: "EN",
          target_lang: lang,
        }),
      }).then((r) => r.ok ? r.json() : null)
    );

    const responses = await Promise.all(calls);
    for (let i = 0; i < targets.length; i++) {
      const translation = responses[i]?.translations?.[0]?.text ?? null;
      results[keys[i]] = translation;
    }
  } catch (e: any) {
    console.warn("[sync] DeepL translation error:", e.message);
  }

  return results;
}

const STALE_DAYS = 90;

// RSS fallback sources (tried only if WHO OData fails) — WHO official feeds only
const RSS_FALLBACKS = [
  "https://www.who.int/feeds/entity/csr/don/en/rss.xml",
  "https://www.who.int/feeds/entity/emergencies/disease-outbreak-news/en/rss.xml",
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

  // ── 1. Fetch outbreak data — WHO Disease Outbreak News ────────────
  let outbreaks: ParsedOutbreak[] = [];
  let usedSource = "";

  // Primary: WHO OData API
  try {
    const whoItems = await fetchWHODONList(40);
    const parsed: ParsedOutbreak[] = [];
    for (const item of whoItems) {
      // First pass: fast (no body fetch)
      let p = await parseWHODONItem(item, false);
      // Second pass: fetch full article for items with 0 cases (N/D fix)
      if (p && p.cases === 0 && item.ItemDefaultUrl) {
        const full = await parseWHODONItem(item, true);
        if (full && full.cases > 0) p = full;
        await new Promise((r) => setTimeout(r, 200)); // polite delay
      }
      if (debug) debugLog.push(p ? `✓ "${item.Title}" → ${p.disease_en} / ${p.country_en} (${p.cases} cases)` : `✗ "${item.Title}" → skipped`);
      if (p) parsed.push(p);
    }
    if (parsed.length > 0) {
      outbreaks  = parsed;
      usedSource = "WHO OData API";
      console.log(`[sync] WHO OData: ${outbreaks.length} parsed`);
    }
  } catch (e: any) {
    console.warn("[sync] WHO OData failed:", e.message);
    if (debug) debugLog.push(`WHO OData error: ${e.message}`);
  }

  // Fallback: WHO RSS feeds (only if OData yields nothing)
  if (outbreaks.length === 0) {
    const rss = await fetchRSSFallback();
    if (rss) {
      outbreaks  = rss.items;
      usedSource = rss.source + " (RSS fallback)";
      if (debug) debugLog.push(`RSS fallback (${rss.source}): ${rss.items.length} parsed`);
    }
  }

  if (outbreaks.length === 0) {
    return NextResponse.json({
      error: "All WHO sources failed — OData + RSS fallbacks returned 0 usable items",
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

  // ── 4. Back-fill missing description translations (DeepL) ────────
  // Translate up to 10 rows per sync run to stay within free tier limits.
  // Only runs when DEEPL_API_KEY is set.
  if (DEEPL_API_KEY) {
    const { data: needsTranslation } = await supabase
      .from("outbreaks")
      .select("id, description")
      .eq("active", true)
      .is("description_fr", null)
      .not("description", "is", null)
      .neq("description", "")
      .limit(10);

    if (needsTranslation && needsTranslation.length > 0) {
      console.log(`[sync] Translating ${needsTranslation.length} descriptions via DeepL…`);
      for (const row of needsTranslation) {
        const t = await translateDescription(row.description);
        if (t.fr || t.es || t.ar || t.id) {
          await supabase
            .from("outbreaks")
            .update({ description_fr: t.fr, description_es: t.es, description_ar: t.ar, description_id: t.id })
            .eq("id", row.id);
        }
        await new Promise((r) => setTimeout(r, 300)); // polite delay between DeepL calls
      }
    }
  }

  // ── 5. Daily snapshot — upsert cases/deaths for trend tracking ──
  const today = new Date().toISOString().split("T")[0];
  const { data: activeOutbreaks } = await supabase
    .from("outbreaks")
    .select("id, cases, deaths")
    .eq("active", true);

  if (activeOutbreaks && activeOutbreaks.length > 0) {
    const snapshots = activeOutbreaks.map((o) => ({
      outbreak_id: o.id,
      cases:       o.cases,
      deaths:      o.deaths,
      snapped_at:  today,
    }));
    const { error: snapErr } = await supabase
      .from("outbreak_snapshots")
      .upsert(snapshots, { onConflict: "outbreak_id,snapped_at" });
    if (snapErr) console.error("[sync] snapshot upsert:", snapErr.message);
    else console.log(`[sync] Snapshotted ${snapshots.length} outbreaks for ${today}`);
  }

  // ── 6. Deactivate stale entries (never touch seed rows) ──────
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
