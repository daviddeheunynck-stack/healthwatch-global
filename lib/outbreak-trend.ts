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

  const direction: TrendDirection =
    deltaPercent >  THRESHOLD_PCT ? "up"   :
    deltaPercent < -THRESHOLD_PCT ? "down" : "stable";

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

  // The 3 lookups below are independent (different date windows on the same
  // table) — run them concurrently instead of sequentially. Measured against
  // prod: ~100ms each but ~300-1300ms end-to-end when awaited one at a time,
  // vs. ~max(100-500ms) in parallel. This function sits directly in the
  // dashboard's render path (uncached at call sites that don't wrap it — see
  // getOutbreakTrendsBulkCached below), so the 3x wait was pure latency
  // multiplied by however slow the slowest of the three happened to be.
  const [{ data: latestRaw }, { data: oldestRaw }, { data: yesterdayRaw }] = await Promise.all([
    // Latest snapshot per outbreak
    supabase
      .from("outbreak_snapshots")
      .select("outbreak_id, cases, snapped_at")
      .in("outbreak_id", outbreakIds)
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
    const direction: TrendDirection =
      deltaPercent >  THRESHOLD_PCT ? "up"   :
      deltaPercent < -THRESHOLD_PCT ? "down" : "stable";
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
