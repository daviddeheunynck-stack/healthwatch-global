import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { logCronRun } from "@/lib/cron-monitor";
import { createClient } from "@supabase/supabase-js";
import { parseRSSFeed, buildOutbreakFromRSSItem } from "@/lib/outbreak-parser";
import { fetchWHODONList, parseWHODONItems, donArticleUrl } from "@/lib/who-api";
import type { ParsedOutbreak } from "@/lib/outbreak-parser";
import { errorMessage } from "@/lib/error";
import { translateDescription } from "@/lib/translate";

export const dynamic = "force-dynamic";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

const SUPABASE_URL        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET          = clean(process.env.CRON_SECRET);

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
  const results = { inserted: 0, updated: 0, skipped: 0, errors: 0, staleDeactivated: 0, whoAlreadySeen: 0 };

  // ── 1. Fetch outbreak data — WHO Disease Outbreak News ────────────
  let outbreaks: ParsedOutbreak[] = [];
  let usedSource = "";
  // True once the WHO OData call itself returns ≥1 item — independent of how
  // many turn out to be new. Gates the RSS-fallback/502 path below, which must
  // only fire on a real fetch failure, not on a normal "nothing new this hour" run.
  let whoODataReturnedItems = false;

  // Each WHO DON URL is a fixed, separately-numbered article (WHO publishes a
  // new DonId for every update rather than editing an existing one in place),
  // so a source URL already stored will always re-parse to the same result.
  // fetchWHODONList(40) returns mostly the same 40 URLs run over run — WHO
  // publishes roughly 1-3 new DONs/week, not 40/hour — so without this check
  // the same handful of bulletins were being re-fetched and re-run through the
  // geo-extraction LLM 24×/day for nothing (found 2026-07-17 costing out the
  // Anthropic billing alert — see console.anthropic.com usage). Skipping them
  // here means we never re-fetch the article body or re-call extractAdmin1LLM
  // for content that hasn't changed.
  const { data: seenWhoDonRows } = await supabase
    .from("outbreaks")
    .select("source")
    .like("source", "https://www.who.int/emergencies/disease-outbreak-news/item/%");
  const seenWhoDonSources = new Set((seenWhoDonRows || []).map((r) => r.source));

  // Primary: WHO OData API
  try {
    const whoItems = await fetchWHODONList(40);
    whoODataReturnedItems = whoItems.length > 0;
    const parsed: ParsedOutbreak[] = [];
    for (const item of whoItems) {
      if (seenWhoDonSources.has(donArticleUrl(item))) {
        results.whoAlreadySeen++;
        continue;
      }
      // parseWHODONItems() already fetches the full article body itself
      // whenever Summary-only extraction comes up empty, and fans a single
      // multi-country DON out into one row per country it names its own
      // figures for — no separate retry pass needed here.
      const items = await parseWHODONItems(item);
      if (debug) {
        if (items.length === 0) debugLog.push(`✗ "${item.Title}" → skipped`);
        else for (const p of items) debugLog.push(`✓ "${item.Title}" → ${p.disease_en} / ${p.country_en} (${p.cases} cases)`);
      }
      parsed.push(...items);
    }
    outbreaks  = parsed;
    usedSource = "WHO OData API";
    console.log(`[sync] WHO OData: ${whoItems.length} fetched, ${results.whoAlreadySeen} already-seen, ${outbreaks.length} new/changed`);
  } catch (e: unknown) {
    console.warn("[sync] WHO OData failed:", errorMessage(e));
    if (debug) debugLog.push(`WHO OData error: ${errorMessage(e)}`);
  }

  // Fallback: WHO RSS feeds (only if OData itself failed or returned nothing at
  // all — not just because every fetched item was already stored, which is a
  // normal "nothing new this hour" outcome and must not trigger a fallback).
  if (!whoODataReturnedItems) {
    const rss = await fetchRSSFallback();
    if (rss) {
      outbreaks  = rss.items;
      usedSource = rss.source + " (RSS fallback)";
      if (debug) debugLog.push(`RSS fallback (${rss.source}): ${rss.items.length} parsed`);
    }
  }

  if (!whoODataReturnedItems && outbreaks.length === 0) {
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
    .select("id, disease_en, country_en, source, date, cases, deaths, active, who_don_published_at, description");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  // Row shape mirrors whatever the `.select(...)` above actually returns —
  // derived rather than hand-typed so it can't drift from the query.
  type ExistingOutbreakRow = NonNullable<typeof existing>[number];
  // Keyed by source+country, not source alone: a multi-country DON fans out
  // into several rows that legitimately share one source URL, so the URL
  // alone can't identify which of them a given parsed outbreak should match.
  const sourceKey = (source: string, countryEn: string) => `${source}|${countryEn.toLowerCase()}`;
  const bySource = new Map<string, ExistingOutbreakRow>();
  const byDiseaseCountry = new Map<string, ExistingOutbreakRow>();
  for (const row of existing || []) {
    if (row.source) bySource.set(sourceKey(row.source, row.country_en || ""), row);
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
      const matchViaSource = bySource.get(sourceKey(outbreak.source, outbreak.country_en));
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

        // Supersession guard: matchViaSource pins directly to whatever row already
        // carries this exact source+country URL, bypassing byDiseaseCountry's own
        // "prefer the active row" tie-break. If that pinned row was deliberately
        // retired (active=false — e.g. a WHO DON snapshot superseded by a fresher,
        // higher-priority ECDC/PAHO tracker for the same disease+country) and a
        // different sibling row is the one actively representing this outbreak,
        // don't silently resurrect it: that re-creates two active rows for the same
        // disease+country and double-counts on the disease detail page (found
        // 2026-07-15 — DR Congo/Ebola DON612 snapshot resurrected ~3.5h after being
        // retired, re-inflating the disease-page total by ~76%/69%).
        const sibling = byDiseaseCountry.get(dcKey);
        if (!existingRow.active && sibling && sibling.id !== existingRow.id && sibling.active) {
          console.warn(`[sync] guard:superseded — ${outbreak.disease_en}/${outbreak.country_en} — active sibling ${sibling.id} already covers this, not resurrecting ${existingRow.id}`);
          if (debug) debugLog.push(`⚠️ Superseded, not resurrected: ${outbreak.disease_en}/${outbreak.country_en} — sibling ${sibling.id} is active`);
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
          // The English description just changed — the existing FR/ES/AR/ID
          // translations (if any) now describe the old figures. Null them so
          // step 4's backfill sweep re-translates from the fresh text, instead
          // of leaving them frozen forever (backfill only fires when NULL).
          if (existingRow.description !== outbreak.description) {
            updatePayload.description_fr = null;
            updatePayload.description_es = null;
            updatePayload.description_ar = null;
            updatePayload.description_id = null;
          }
          if (outbreak.recovered > 0) updatePayload.recovered = outbreak.recovered;
          // Always update admin1 when we have fresh extraction (can be null → clears stale data)
          if (outbreak.admin1 !== undefined) {
            updatePayload.admin1     = outbreak.admin1;
            updatePayload.admin1_lat = outbreak.admin1_lat;
            updatePayload.admin1_lng = outbreak.admin1_lng;
          }
          // .select("id") so a source_priority guard that blocks the write (row now
          // owned by a higher-priority source) is visible as 0 affected rows —
          // without it, a blocked update still returns error: null and was
          // reported as "updated" even though nothing changed. Found 2026-07-15.
          const { data: updatedRows, error } = await supabase
            .from("outbreaks")
            .update({ ...updatePayload, source_priority: 3 })
            .eq("id", existingRow.id)
            .lte("source_priority", 3) // never overwrite higher-priority sources (sitrep=10, regional=5)
            .select("id");
          if (error) {
            console.error("[sync] update:", error);
            errorLog.push(`UPDATE ${outbreak.disease_en}/${outbreak.country_en}: ${error.message}`);
            results.errors++;
          } else if (!updatedRows || updatedRows.length === 0) {
            results.skipped++;
          } else results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        const { error } = await supabase.from("outbreaks").insert({ ...outbreak, is_backfill: false });
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
    // Catch any of the 4 languages missing, not just French — a row can have
    // description_fr set by hand (a session translating manually, bypassing
    // this shared sweep) while description_es/ar/id stay null forever, since
    // the old .is("description_fr", null) gate never re-fires once fr exists.
    // Found 2026-07-23: 7 active rows stuck this way (Ebola/Uganda among them).
    const { data: needsTranslation } = await supabase
      .from("outbreaks")
      .select("id, description, description_fr, description_es, description_ar, description_id")
      .eq("active", true)
      .or("description_fr.is.null,description_es.is.null,description_ar.is.null,description_id.is.null")
      .not("description", "is", null)
      .neq("description", "")
      .order("created_at", { ascending: false })
      .limit(10);

    if (needsTranslation && needsTranslation.length > 0) {
      console.log(`[sync] Translating ${needsTranslation.length} descriptions via MyMemory…`);
      for (const row of needsTranslation) {
        const t = await translateDescription(row.description);
        // Only fill fields that are actually missing — a row can reach here with
        // description_fr already hand-written (see gate comment above); never
        // clobber it with a lower-quality MyMemory retranslation.
        const patch: Record<string, string> = {};
        if (row.description_fr === null && t.fr) patch.description_fr = t.fr;
        if (row.description_es === null && t.es) patch.description_es = t.es;
        if (row.description_ar === null && t.ar) patch.description_ar = t.ar;
        if (row.description_id === null && t.id) patch.description_id = t.id;
        if (Object.keys(patch).length > 0) {
          await supabase.from("outbreaks").update(patch).eq("id", row.id);
        }
        await new Promise((r) => setTimeout(r, 300)); // polite delay between MyMemory calls
      }
    }

    // ── 4bis. Same sweep for archived rows, small separate budget ──────
    // The block above is scoped to active rows only, so a row that goes
    // inactive before picking up all 4 languages stays untranslated forever —
    // it never falls active again to re-enter that query. Found 2026-07-27:
    // 29 archived rows missing every translation, still rendered in English
    // (getLocalizedDescription() falls back to EN) on public disease-history
    // pages and direct /outbreak/[id] links. Kept on its own small budget so
    // a backlog of old rows never competes with fresh active rows for the
    // day's MyMemory quota.
    const archivedBudget = Math.max(0, 5 - (needsTranslation?.length ?? 0));
    if (archivedBudget > 0) {
      const { data: archivedNeedsTranslation } = await supabase
        .from("outbreaks")
        .select("id, description, description_fr, description_es, description_ar, description_id")
        .eq("active", false)
        .or("description_fr.is.null,description_es.is.null,description_ar.is.null,description_id.is.null")
        .not("description", "is", null)
        .neq("description", "")
        .order("created_at", { ascending: false })
        .limit(archivedBudget);

      if (archivedNeedsTranslation && archivedNeedsTranslation.length > 0) {
        console.log(`[sync] Translating ${archivedNeedsTranslation.length} archived descriptions via MyMemory…`);
        for (const row of archivedNeedsTranslation) {
          const t = await translateDescription(row.description);
          const patch: Record<string, string> = {};
          if (row.description_fr === null && t.fr) patch.description_fr = t.fr;
          if (row.description_es === null && t.es) patch.description_es = t.es;
          if (row.description_ar === null && t.ar) patch.description_ar = t.ar;
          if (row.description_id === null && t.id) patch.description_id = t.id;
          if (Object.keys(patch).length > 0) {
            await supabase.from("outbreaks").update(patch).eq("id", row.id);
          }
          await new Promise((r) => setTimeout(r, 300));
        }
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
    // outbreak_snapshots.cases/deaths are NOT NULL DEFAULT 0, but outbreaks.cases/deaths
    // are nullable — a single active row with a null count (e.g. a WHO bulletin with no
    // death toll) fails the whole batch upsert, silently freezing trend history for every
    // other active outbreak too (found 2026-07-16: Yellow fever/Global's null deaths had
    // blocked every snapshot since 2026-06-30).
    const snapshots = activeOutbreaks.map((o) => ({
      outbreak_id: o.id,
      cases:       o.cases  ?? 0,
      deaths:      o.deaths ?? 0,
      snapped_at:  today,
    }));
    const { error: snapErr } = await supabase
      .from("outbreak_snapshots")
      .upsert(snapshots, { onConflict: "outbreak_id,snapped_at" });
    if (snapErr) console.error("[sync] snapshot upsert:", snapErr.message);
    else console.log(`[sync] Snapshotted ${snapshots.length} outbreaks for ${today}`);
  }

  // ── 6. Deactivate stale entries (never touch seed rows or high-priority) ──────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const { count } = await supabase
    .from("outbreaks")
    .update({ active: false })
    .eq("active", true)
    .neq("is_seed", true)
    .lt("source_priority", 5) // never auto-deactivate regional/sitrep-managed entries (priority ≥ 5)
    .eq("is_pheic", false)    // never auto-deactivate active WHO PHEICs
    .lt("date", cutoff.toISOString().split("T")[0]);

  results.staleDeactivated = count ?? 0;

  const hb = process.env.BETTERSTACK_HB_SYNC_OUTBREAKS;
  if (hb) fetch(hb).catch(() => {});

  console.log("[sync] Done:", results, "source:", usedSource);
  await logCronRun(supabase, "sync-outbreaks", "ok", outbreaks.length);
  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    source: usedSource,
    outbreaksParsed: outbreaks.length,
    ...results,
    ...(debug ? { debugLog, errorLog } : {}),
  });
}
