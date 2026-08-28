// ── Outbreak trend calculation ─────────────────────────────────────────────────
// Compares current case count against N days ago to produce a directional signal.
// Requires outbreak_snapshots table to have at least DAYS_BACK + 1 entries.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export type TrendDirection = "up" | "stable" | "down" | "unknown";

export interface OutbreakTrend {
  direction:    TrendDirection;
  deltaCases:   number;        // absolute change (7-day)
  deltaPercent: number;        // % change (7-day)
  daysBack:     number;        // how many days compared
  delta24h:     number | null; // absolute cases change since yesterday's snapshot (null = no snapshot yet)
}

const THRESHOLD_PCT = 5;  // < 5% change = stable
const DAYS_BACK     = 7;  // compare against last week

/**
 * Direction for a case-count delta — the ONLY place either function below
 * decides one, so the rule holds identically on every surface that renders a
 * trend (OutbreakTable's TrendBadge/TrendBar, PhaseBadge's "En déclin",
 * why-it-matters' "En recul : -83% de cas sur 7 jours", and the percentages on
 * the country/disease/region pages — all six derive from this value).
 *
 * A DECREASE IS NEVER A TREND. `outbreaks.cases` is a cumulative
 * count, and every write path in this repo already treats a drop in it as a
 * data defect rather than an epidemiological fact: lockedRowRegressionGuard
 * refuses ANY decrease on a locked row, deathsNeverDecreaseGuard does the same
 * for deaths, and data-quality section 3 files one as a `large_drop` ANOMALY
 * for review. The read path was the lone exception — it rendered exactly that
 * drop as a green "En déclin" badge, i.e. as good news.
 *
 * Measured against prod 2026-08-28 over the full 61 days of snapshot history
 * (127 active rows, 5,443 snapshots): all 17 day-over-day decreases were data
 * corrections — the 17/07 re-sourcing batch, Cholera/Chad 776→129 on 22/07,
 * Ebola/DRC 5208→5021 on 22/08, the two CCHF re-sourcings of 27/08 that
 * surfaced this bug. Not one was an outbreak receding. A cumulative counter
 * does not go down in the field; when it goes down here, HealthWatch corrected
 * its own figure, and saying "in decline" about it is the opposite of true.
 *
 * This also covers the 1 January cliff on the two year-to-date crons
 * (sync-malaysia-dengue, sync-taiwan-cdc — see isYearRollover in
 * lib/outbreak-guards.ts): their counters reset from ~100k to a handful, which
 * would otherwise have rendered as "En déclin -99%" on New Year's Day.
 *
 * "unknown" rather than "stable": every consumer already gates on
 * `direction !== "unknown"` and renders nothing, so a correction shows NO
 * claim instead of a false one. "stable" would still assert something.
 * Deliberately keyed on deltaCases, not the rounded deltaPercent — a small
 * decrease on a large base rounds to 0% and would otherwise slip through as
 * "stable".
 */
function directionFor(deltaCases: number, deltaPercent: number): TrendDirection {
  if (deltaCases < 0) return "unknown";
  return deltaPercent > THRESHOLD_PCT ? "up" : "stable";
}

/**
 * Returns trend for a single outbreak.
 * Returns "unknown" if not enough snapshot data yet.
 */
export async function getOutbreakTrend(
  supabase: SupabaseClient,
  outbreakId: string
): Promise<OutbreakTrend> {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - DAYS_BACK);
  const targetStr = targetDate.toISOString().split("T")[0];

  const { data } = await supabase
    .from("outbreak_snapshots")
    .select("cases, snapped_at")
    .eq("outbreak_id", outbreakId)
    .lte("snapped_at", targetStr)
    .order("snapped_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return { direction: "unknown", deltaCases: 0, deltaPercent: 0, daysBack: 0, delta24h: null };

  // Also get today's snapshot
  const { data: todaySnap } = await supabase
    .from("outbreak_snapshots")
    .select("cases, snapped_at")
    .eq("outbreak_id", outbreakId)
    .order("snapped_at", { ascending: false })
    .limit(1)
    .single();

  if (!todaySnap) return { direction: "unknown", deltaCases: 0, deltaPercent: 0, daysBack: 0, delta24h: null };

  const nowCases    = todaySnap.cases as number;
  const thenCases   = data.cases as number;
  const thenDate    = data.snapped_at as string;
  const todayDate   = todaySnap.snapped_at as string;

  const deltaCases   = nowCases - thenCases;
  const deltaPercent = thenCases > 0 ? Math.round((deltaCases / thenCases) * 100) : 0;

  const direction = directionFor(deltaCases, deltaPercent);
  // Corrections short-circuit before the 24h lookup — one fewer query, and a
  // 24h delta straddling a correction is the same artifact at a shorter range.
  if (direction === "unknown") {
    return { direction, deltaCases: 0, deltaPercent: 0, daysBack: 0, delta24h: null };
  }

  const daysBack = Math.round(
    (new Date(todayDate).getTime() - new Date(thenDate).getTime()) / 86_400_000
  );

  // 24h delta: compare today vs yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const { data: ySnap } = await supabase
    .from("outbreak_snapshots")
    .select("cases")
    .eq("outbreak_id", outbreakId)
    .lte("snapped_at", yesterdayStr)
    .order("snapped_at", { ascending: false })
    .limit(1)
    .single();
  const delta24h = ySnap ? nowCases - (ySnap.cases as number) : null;

  return { direction, deltaCases, deltaPercent, daysBack, delta24h };
}

/**
 * Bulk fetch trends for multiple outbreaks (efficient — 2 queries total).
 */
export async function getOutbreakTrendsBulk(
  supabase: SupabaseClient,
  outbreakIds: string[]
): Promise<Map<string, OutbreakTrend>> {
  if (outbreakIds.length === 0) return new Map();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - DAYS_BACK);
  const targetStr = targetDate.toISOString().split("T")[0];

  // Lower bound for 7-day query: look back 2× DAYS_BACK to handle gaps in daily cron
  const oldestFloor = new Date();
  oldestFloor.setDate(oldestFloor.getDate() - DAYS_BACK * 2);
  const oldestFloorStr = oldestFloor.toISOString().split("T")[0];

  type SnapRow = { outbreak_id: string; cases: number; snapped_at: string };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 3); // 3-day window handles cron gaps
  const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

  // Lower bound for the "latest" query below — only the single most recent
  // row per outbreak is ever used (deduped in JS after the order-by), but
  // without a floor this scanned the outbreak_snapshots table's ENTIRE
  // history for every id in the list: with one row/outbreak/day accumulating
  // since the daily snapshot cron started, the table (2026-08-07: ~3,000 rows,
  // growing ~200/day) was being re-fetched close to in full on every cache
  // miss — the dominant driver of Supabase egress quota consumption
  // (project_supabase_egress_quota). 10 days gives 3x the 3-day cron-gap
  // tolerance used below, so a slow/skipped cron still resolves correctly.
  const latestFloor = new Date();
  latestFloor.setDate(latestFloor.getDate() - 10);
  const latestFloorStr = latestFloor.toISOString().split("T")[0];

  // The 3 lookups below are independent (different date windows on the same
  // table) — run them concurrently instead of sequentially. Measured against
  // prod: ~100ms each but ~300-1300ms end-to-end when awaited one at a time,
  // vs. ~max(100-500ms) in parallel. This function sits directly in the
  // dashboard's render path (uncached at call sites that don't wrap it — see
  // getOutbreakTrendsBulkCached below), so the 3x wait was pure latency
  // multiplied by however slow the slowest of the three happened to be.
  const [{ data: latestRaw }, { data: oldestRaw }, { data: yesterdayRaw }] = await Promise.all([
    // Latest snapshot per outbreak — bounded, see latestFloorStr above.
    supabase
      .from("outbreak_snapshots")
      .select("outbreak_id, cases, snapped_at")
      .in("outbreak_id", outbreakIds)
      .gte("snapped_at", latestFloorStr)
      .order("snapped_at", { ascending: false }),
    // Most recent snapshot at or before DAYS_BACK ago (for 7-day trend)
    // Narrow window [2×DAYS_BACK, DAYS_BACK] avoids scanning full history
    supabase
      .from("outbreak_snapshots")
      .select("outbreak_id, cases, snapped_at")
      .in("outbreak_id", outbreakIds)
      .lte("snapped_at", targetStr)
      .gte("snapped_at", oldestFloorStr)
      .order("snapped_at", { ascending: false }),
    // Most recent snapshot at or before yesterday (for 24h delta)
    // 3-day window keeps query tight while tolerating cron gaps
    supabase
      .from("outbreak_snapshots")
      .select("outbreak_id, cases, snapped_at")
      .in("outbreak_id", outbreakIds)
      .lte("snapped_at", yesterdayStr)
      .gte("snapped_at", twoDaysAgoStr)
      .order("snapped_at", { ascending: false }),
  ]);
  const latest         = (latestRaw ?? [])    as SnapRow[];
  const oldest         = (oldestRaw ?? [])    as SnapRow[];
  const yesterdaySnaps = (yesterdayRaw ?? []) as SnapRow[];

  const latestMap    = new Map<string, number>();
  const oldestMap    = new Map<string, number>();
  const yesterdayMap = new Map<string, number>();
  const seenLatest   = new Set<string>();
  const seenOldest   = new Set<string>();
  const seenYday     = new Set<string>();

  for (const row of latest) {
    if (!seenLatest.has(row.outbreak_id)) {
      latestMap.set(row.outbreak_id, row.cases);
      seenLatest.add(row.outbreak_id);
    }
  }
  for (const row of oldest) {
    if (!seenOldest.has(row.outbreak_id)) {
      oldestMap.set(row.outbreak_id, row.cases);
      seenOldest.add(row.outbreak_id);
    }
  }
  for (const row of yesterdaySnaps) {
    if (!seenYday.has(row.outbreak_id)) {
      yesterdayMap.set(row.outbreak_id, row.cases);
      seenYday.add(row.outbreak_id);
    }
  }

  const result = new Map<string, OutbreakTrend>();
  for (const id of outbreakIds) {
    const now   = latestMap.get(id);
    const then  = oldestMap.get(id);
    const yday  = yesterdayMap.get(id);
    if (now === undefined || then === undefined) {
      result.set(id, { direction: "unknown", deltaCases: 0, deltaPercent: 0, daysBack: DAYS_BACK, delta24h: null });
      continue;
    }
    const deltaCases   = now - then;
    const deltaPercent = then > 0 ? Math.round((deltaCases / then) * 100) : 0;
    const direction    = directionFor(deltaCases, deltaPercent);
    if (direction === "unknown") {
      result.set(id, { direction, deltaCases: 0, deltaPercent: 0, daysBack: DAYS_BACK, delta24h: null });
      continue;
    }
    const delta24h = yday !== undefined ? now - yday : null;
    result.set(id, { direction, deltaCases, deltaPercent, daysBack: DAYS_BACK, delta24h });
  }

  return result;
}

// ── Cached bulk trends (dashboard) ──────────────────────────────────────────
// getOutbreakTrendsBulk above hits Supabase fresh on every call — fine for
// low-traffic pages, but the main dashboard calls it on every single request
// with the same (cached, 5-minute-stable) outbreak ID list from getOutbreaks().
// Wrap it the same way lib/outbreaks.ts caches getOutbreaks()/getLastSync():
// trend data only changes once a day (one snapshot/day per cron), so a 5-minute
// window is effectively always fresh while cutting Supabase round-trips to
// near zero for repeat requests. Returns a plain Record (not a Map) because
// unstable_cache persists its result via JSON — a Map would silently
// serialize to "{}".
const BOM   = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

function getServiceClient() {
  return createClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export const OUTBREAK_TRENDS_CACHE_TAG = "outbreak-trends";
const TRENDS_REVALIDATE = 300; // seconds — matches OUTBREAKS_REVALIDATE in lib/outbreaks.ts

const getOutbreakTrendsBulkCachedInner = unstable_cache(
  async (outbreakIds: string[]): Promise<Record<string, OutbreakTrend>> => {
    const supabase = getServiceClient();
    const map = await getOutbreakTrendsBulk(supabase, outbreakIds);
    return Object.fromEntries(map);
  },
  ["outbreak-trends-bulk"],
  { tags: [OUTBREAK_TRENDS_CACHE_TAG], revalidate: TRENDS_REVALIDATE },
);

export async function getOutbreakTrendsBulkCached(outbreakIds: string[]): Promise<Record<string, OutbreakTrend>> {
  if (outbreakIds.length === 0) return {};
  try {
    return await getOutbreakTrendsBulkCachedInner(outbreakIds);
  } catch {
    return {}; // uncached fallback — next request retries rather than serving stale trends forever
  }
}
