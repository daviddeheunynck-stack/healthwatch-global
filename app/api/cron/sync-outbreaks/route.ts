import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { parseRSSFeed, buildOutbreakFromRSSItem } from "@/lib/outbreak-parser";
import { fetchWHODONList, parseWHODONItem } from "@/lib/who-api";
import type { ParsedOutbreak } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);
const MYMEMORY_EMAIL = clean(process.env.MYMEMORY_EMAIL); // optional — free registration at mymemory.translated.net gives 10k words/day

// ── MyMemory translation (100% gratuit, sans CB) ──────────────────────────────
// API publique : 1 000 mots/jour sans compte, 10 000/jour avec un email gratuit.
// Pour enregistrer : https://mymemory.translated.net/register.php
async function translateDescription(text: string): Promise<{
  fr: string | null; es: string | null; ar: string | null; id: string | null;
}> {
  const empty = { fr: null, es: null, ar: null, id: null };
  if (!text?.trim()) return empty;

  const base = "https://api.mymemory.translated.net/get";
  const pairs = [
    { key: "fr" as const, langpair: "en|fr" },
    { key: "es" as const, langpair: "en|es" },
    { key: "ar" as const, langpair: "en|ar" },
    { key: "id" as const, langpair: "en|id" },
  ];

  const results: { fr: string | null; es: string | null; ar: string | null; id: string | null } = { ...empty };

  try {
    const calls = pairs.map(({ langpair }) => {
      const url = new URL(base);
      url.searchParams.set("q", text);
      url.searchParams.set("langpair", langpair);
      if (MYMEMORY_EMAIL) url.searchParams.set("de", MYMEMORY_EMAIL);
      return fetch(url.toString()).then((r) => r.ok ? r.json() : null);
    });

    const responses = await Promise.all(calls);
    for (let i = 0; i < pairs.length; i++) {
      const t = responses[i]?.responseData?.translatedText ?? null;
      // MyMemory returns the original text when it can't translate — discard those
      if (t && t !== text) results[pairs[i].key] = t;
    }
  } catch (e: unknown) {
    console.warn("[sync] MyMemory translation error:", errorMessage(e));
  }

  return results;
}

const STALE_DAYS = 60;

// WHO deprecated their RSS feeds — both old URLs return 404/timeout (verified 2026-06-26).
// OData API (fetchWHODONList) is the only reliable source.
const RSS_FALLBACKS: string[] = [];

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
    } catch (e: unknown) {
      console.warn(`[sync] ${url} → ${errorMessage(e)}`);
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debug = req.nextUrl.searchParams.get("debug") === "1";
  const debugLog: string[] = [];
  const errorLog: string[] = [];

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("[sync-outbreaks] Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "env:missing" }, { status: 500 });
  }
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
  } catch (e: unknown) {
    console.warn("[sync] WHO OData failed:", errorMessage(e));
    if (debug) debugLog.push(`WHO OData error: ${errorMessage(e)}`);
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

  // WHO publishes multiple DON articles over time for the same evolving
  // outbreak (e.g. "Update 1", "Update 2"...). The feed is fetched newest
  // first, so for a given disease+country keep only the first (most recent)
  // article — older updates are superseded and must not overwrite it.
  {
    const seenDC = new Set<string>();
    const beforeDedup = outbreaks.length;
    outbreaks = outbreaks.filter((o) => {
      const k = `${o.disease_en.toLowerCase()}|${o.country_en.toLowerCase()}`;
      if (seenDC.has(k)) return false;
      seenDC.add(k);
      return true;
    });
    if (debug && outbreaks.length < beforeDedup) {
      debugLog.push(`Deduped ${beforeDedup - outbreaks.length} older WHO article(s) superseded by a newer update for the same disease/country`);
    }
  }

  // ── 2. Load existing outbreaks ────────────────────────────────
  const { data: existing, error: fetchErr } = await supabase
    .from("outbreaks")
    .select("id, disease_en, country_en, source, date, cases, deaths, active, who_don_published_at");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  // Row shape mirrors whatever the `.select(...)` above actually returns —
  // derived rather than hand-typed so it can't drift from the query.
  type ExistingOutbreakRow = NonNullable<typeof existing>[number];
  const bySource = new Map<string, ExistingOutbreakRow>();
  const byDiseaseCountry = new Map<string, ExistingOutbreakRow>();
  for (const row of existing || []) {
    if (row.source) bySource.set(row.source, row);
    const k = `${(row.disease_en || "").toLowerCase()}|${(row.country_en || "").toLowerCase()}`;
    // A disease+country can have several historical rows (past episodes).
    // Keep the one a fresh WHO article should actually update: prefer the
    // active row, then the most recently dated one.
    const prev = byDiseaseCountry.get(k);
    if (!prev || (row.active && !prev.active) || (row.active === prev.active && row.date > prev.date)) {
      byDiseaseCountry.set(k, row);
    }
  }

  // ── 3. Upsert ─────────────────────────────────────────────────
  for (const outbreak of outbreaks) {
    try {
      const dcKey = `${outbreak.disease_en.toLowerCase()}|${outbreak.country_en.toLowerCase()}`;
      const matchViaSource = bySource.get(outbreak.source);
      const matchViaDC     = byDiseaseCountry.get(dcKey);
      const existingRow    = matchViaSource ?? matchViaDC;

      // Detect: WHO DON now officially covers an outbreak first seen via ECDC/PAHO.
      // Record first_seen_at (original source's pub date) and who_don_published_at once.
      if (!matchViaSource && matchViaDC) {
        const isNonWhoDon = !(matchViaDC.source ?? "").includes("who.int/emergencies/disease-outbreak-news");
        if (isNonWhoDon && !matchViaDC.who_don_published_at) {
          const { error: ltErr } = await supabase
            .from("outbreaks")
            .update({
              first_seen_at:        matchViaDC.date,
              who_don_published_at: outbreak.date,
            })
            .eq("id", matchViaDC.id)
            .is("who_don_published_at", null);
          if (ltErr) console.error("[sync] lead-time update:", ltErr);
          else console.log(`[sync] lead-time ✓ ${outbreak.disease_en}/${outbreak.country_en}: first=${matchViaDC.date} WHO DON=${outbreak.date}`);
        }
      }

      // ── Pre-upsert sanity guards ─────────────────────────────────
      // Reject impossible or suspicious data before touching the DB.
      if (outbreak.deaths > outbreak.cases && outbreak.cases > 0) {
        console.warn(`[sync] guard:deaths>cases — ${outbreak.disease_en}/${outbreak.country_en} (${outbreak.deaths}d > ${outbreak.cases}c) — skipping`);
        results.skipped++;
        continue;
      }

      if (existingRow) {
        // Never let an older-dated WHO article overwrite a row that already
        // reflects a more recent one (e.g. byDiseaseCountry matched the
        // current row, but this article predates it).
        const isOlderArticle = outbreak.date < existingRow.date;
        const existingRecovered = (existingRow as Record<string, unknown>).recovered as number | null ?? 0;

        // Spike guard: >3× jump is almost certainly a parsing anomaly.
        if (outbreak.cases > 0 && existingRow.cases > 0 && outbreak.cases > existingRow.cases * 3) {
          console.warn(`[sync] guard:spike — ${outbreak.disease_en}/${outbreak.country_en} — parsed ${outbreak.cases} vs existing ${existingRow.cases} (>3×) — skipping`);
          if (debug) debugLog.push(`⚠️ Spike rejected: ${outbreak.disease_en}/${outbreak.country_en} — ${outbreak.cases} vs ${existingRow.cases}`);
          results.skipped++;
          continue;
        }
        // Collapse guard: a >70% reduction in an active outbreak is also suspect
        // (e.g. WHO DON article only covers one region but DB has global total).
        if (existingRow.cases > 100 && outbreak.cases > 0 && outbreak.cases < existingRow.cases * 0.3) {
          console.warn(`[sync] guard:collapse — ${outbreak.disease_en}/${outbreak.country_en} — parsed ${outbreak.cases} vs existing ${existingRow.cases} (<30%) — skipping`);
          if (debug) debugLog.push(`⚠️ Collapse rejected: ${outbreak.disease_en}/${outbreak.country_en} — ${outbreak.cases} vs ${existingRow.cases}`);
          results.skipped++;
          continue;
        }

        const needsUpdate =
          !isOlderArticle &&
          (existingRow.cases !== outbreak.cases ||
            existingRow.deaths !== outbreak.deaths ||
            existingRow.date !== outbreak.date ||
            (outbreak.recovered > 0 && outbreak.recovered !== existingRecovered)) &&
          // Never overwrite a real case/death count with a parser-miss zero
          !(outbreak.cases === 0 && existingRow.cases > 0) &&
          !(outbreak.deaths === 0 && existingRow.deaths > 0);

        if (needsUpdate) {
          const updatePayload: Record<string, unknown> = {
            cases: outbreak.cases, deaths: outbreak.deaths,
            date: outbreak.date, description: outbreak.description,
            risk_level: outbreak.risk_level, source: outbreak.source,
            active: true,
          };
          if (outbreak.recovered > 0) updatePayload.recovered = outbreak.recovered;
          // Always update admin1 when we have fresh extraction (can be null → clears stale data)
          if (outbreak.admin1 !== undefined) {
            updatePayload.admin1     = outbreak.admin1;
            updatePayload.admin1_lat = outbreak.admin1_lat;
            updatePayload.admin1_lng = outbreak.admin1_lng;
          }
          const { error } = await supabase
            .from("outbreaks")
            .update({ ...updatePayload, source_priority: 3 })
            .eq("id", existingRow.id)
            .lte("source_priority", 3); // never overwrite higher-priority sources (sitrep=10, regional=5)
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
    } catch (e: unknown) {
      console.error("[sync] item error:", errorMessage(e));
      Sentry.captureException(e, { tags: { cron: "sync-outbreaks" } });
      results.errors++;
    }
  }

  // ── 4. Back-fill missing description translations (MyMemory) ────────
  // Translate up to 10 rows per sync run to stay within free tier limits.
  // Runs automatically — no API key needed (1k words/day free).
  // Set MYMEMORY_EMAIL in env for 10k words/day free tier.
  {
    // Newest first: (a) translate what readers are actually looking at right
    // now before older entries, and (b) without an explicit order, Postgres
    // returns these in unspecified order — which in practice let a handful of
    // older rows with non-English seed text (translateDescription() always
    // sends "en|xx": MyMemory echoes the input back, t === text, so the
    // result is discarded and description_fr stays null forever) re-occupy
    // the whole 10-row daily budget run after run, starving every legitimate
    // English row queued behind them. Oldest-first would only make that worse.
    const { data: needsTranslation } = await supabase
      .from("outbreaks")
      .select("id, description")
      .eq("active", true)
      .is("description_fr", null)
      .not("description", "is", null)
      .neq("description", "")
      .order("created_at", { ascending: false })
      .limit(10);

    if (needsTranslation && needsTranslation.length > 0) {
      console.log(`[sync] Translating ${needsTranslation.length} descriptions via MyMemory…`);
      for (const row of needsTranslation) {
        const t = await translateDescription(row.description);
        if (t.fr || t.es || t.ar || t.id) {
          await supabase
            .from("outbreaks")
            .update({ description_fr: t.fr, description_es: t.es, description_ar: t.ar, description_id: t.id })
            .eq("id", row.id);
        }
        await new Promise((r) => setTimeout(r, 300)); // polite delay between MyMemory calls
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
