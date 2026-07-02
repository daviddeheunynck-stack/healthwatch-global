// ── Outbreak trend calculation ─────────────────────────────────────────────────
// Compares current case count against N days ago to produce a directional signal.
// Requires outbreak_snapshots table to have at least DAYS_BACK + 1 entries.

import type { SupabaseClient } from "@supabase/supabase-js";

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

  // Latest snapshot per outbreak
  const { data: latestRaw } = await supabase
    .from("outbreak_snapshots")
    .select("outbreak_id, cases, snapped_at")
    .in("outbreak_id", outbreakIds)
    .order("snapped_at", { ascending: false });
  const latest = (latestRaw ?? []) as SnapRow[];

  // Most recent snapshot at or before DAYS_BACK ago (for 7-day trend)
  // Narrow window [2×DAYS_BACK, DAYS_BACK] avoids scanning full history
  const { data: oldestRaw } = await supabase
    .from("outbreak_snapshots")
    .select("outbreak_id, cases, snapped_at")
    .in("outbreak_id", outbreakIds)
    .lte("snapped_at", targetStr)
    .gte("snapped_at", oldestFloorStr)
    .order("snapped_at", { ascending: false });
  const oldest = (oldestRaw ?? []) as SnapRow[];

  // Most recent snapshot at or before yesterday (for 24h delta)
  // 3-day window keeps query tight while tolerating cron gaps
  const { data: yesterdayRaw } = await supabase
    .from("outbreak_snapshots")
    .select("outbreak_id, cases, snapped_at")
    .in("outbreak_id", outbreakIds)
    .lte("snapped_at", yesterdayStr)
    .gte("snapped_at", twoDaysAgoStr)
    .order("snapped_at", { ascending: false });
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
