// ── Outbreak trend calculation ─────────────────────────────────────────────────
// Compares current case count against N days ago to produce a directional signal.
// Requires outbreak_snapshots table to have at least DAYS_BACK + 1 entries.

import { createClient } from "@supabase/supabase-js";

export type TrendDirection = "up" | "stable" | "down" | "unknown";

export interface OutbreakTrend {
  direction:   TrendDirection;
  deltaCases:  number;   // absolute change
  deltaPercent: number;  // % change
  daysBack:    number;   // how many days compared
}

const THRESHOLD_PCT = 5;  // < 5% change = stable
const DAYS_BACK     = 7;  // compare against last week

/**
 * Returns trend for a single outbreak.
 * Returns "unknown" if not enough snapshot data yet.
 */
export async function getOutbreakTrend(
  supabase: ReturnType<typeof createClient>,
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

  if (!data) return { direction: "unknown", deltaCases: 0, deltaPercent: 0, daysBack: 0 };

  // Also get today's snapshot
  const { data: todaySnap } = await (supabase
    .from("outbreak_snapshots")
    .select("cases, snapped_at")
    .eq("outbreak_id", outbreakId)
    .order("snapped_at", { ascending: false })
    .limit(1) as any).single();

  if (!todaySnap) return { direction: "unknown", deltaCases: 0, deltaPercent: 0, daysBack: 0 };

  const nowCases    = (todaySnap as any).cases as number;
  const thenCases   = (data as any).cases as number;
  const thenDate    = (data as any).snapped_at as string;
  const todayDate   = (todaySnap as any).snapped_at as string;

  const deltaCases   = nowCases - thenCases;
  const deltaPercent = thenCases > 0 ? Math.round((deltaCases / thenCases) * 100) : 0;

  const direction: TrendDirection =
    deltaPercent >  THRESHOLD_PCT ? "up"   :
    deltaPercent < -THRESHOLD_PCT ? "down" : "stable";

  const daysBack = Math.round(
    (new Date(todayDate).getTime() - new Date(thenDate).getTime()) / 86_400_000
  );

  return { direction, deltaCases, deltaPercent, daysBack };
}

/**
 * Bulk fetch trends for multiple outbreaks (efficient — 2 queries total).
 */
export async function getOutbreakTrendsBulk(
  supabase: ReturnType<typeof createClient>,
  outbreakIds: string[]
): Promise<Map<string, OutbreakTrend>> {
  if (outbreakIds.length === 0) return new Map();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - DAYS_BACK);
  const targetStr = targetDate.toISOString().split("T")[0];

  type SnapRow = { outbreak_id: string; cases: number; snapped_at: string };

  // Latest snapshot per outbreak
  const { data: latestRaw } = await (supabase as any)
    .from("outbreak_snapshots")
    .select("outbreak_id, cases, snapped_at")
    .in("outbreak_id", outbreakIds)
    .order("snapped_at", { ascending: false });
  const latest = (latestRaw ?? []) as SnapRow[];

  // Oldest snapshot within DAYS_BACK window per outbreak
  const { data: oldestRaw } = await (supabase as any)
    .from("outbreak_snapshots")
    .select("outbreak_id, cases, snapped_at")
    .in("outbreak_id", outbreakIds)
    .lte("snapped_at", targetStr)
    .order("snapped_at", { ascending: false });
  const oldest = (oldestRaw ?? []) as SnapRow[];

  const latestMap  = new Map<string, number>();
  const oldestMap  = new Map<string, number>();
  const seenLatest = new Set<string>();
  const seenOldest = new Set<string>();

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

  const result = new Map<string, OutbreakTrend>();
  for (const id of outbreakIds) {
    const now   = latestMap.get(id);
    const then  = oldestMap.get(id);
    if (now === undefined || then === undefined) {
      result.set(id, { direction: "unknown", deltaCases: 0, deltaPercent: 0, daysBack: DAYS_BACK });
      continue;
    }
    const deltaCases   = now - then;
    const deltaPercent = then > 0 ? Math.round((deltaCases / then) * 100) : 0;
    const direction: TrendDirection =
      deltaPercent >  THRESHOLD_PCT ? "up"   :
      deltaPercent < -THRESHOLD_PCT ? "down" : "stable";
    result.set(id, { direction, deltaCases, deltaPercent, daysBack: DAYS_BACK });
  }

  return result;
}
