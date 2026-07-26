/**
 * Catch-up incident: HealthWatch Global's own pipeline occasionally ingests an
 * outbreak long after the source's stated `date` — a backfilled or
 * late-discovered record, not a live signal HWG missed in real time.
 *
 * This measures HWG's own pipeline pickup timing relative to the source's
 * stated date — it is NOT a claim about how fast the reporting country's
 * surveillance system detected, validated, or responded to the event.
 *
 * Framed as a rare, disclosed incident rather than a per-row freshness grade
 * (fresh/moderate/delayed) on purpose: tested against real prod data
 * (2026-07-27), only 9 of 254 rows are even eligible for this calculation at
 * all, and every eligible row sits at 213+ days — there is no populated
 * middle ground. A 3-bucket spectrum shown on every outbreak would imply a
 * normal distribution across "fresh" to "delayed" that the data doesn't
 * support; disclosing the rare qualifying case on its own terms is honest,
 * a routine freshness grade applied to everything is not.
 *
 * Two exclusions are required for the day-count itself to be honest, both
 * learned the hard way against real data (see
 * project_reporting_lag_feature_incremental_build memory, 2026-07-20):
 *
 * 1. `is_seed` or `is_backfill` rows are excluded outright. Seed rows are
 *    manually curated, not source-derived. Backfill rows come from a source
 *    that is itself a historical/cumulative archive (e.g. USDA APHIS's HPAI
 *    crosstab, WHO GHO annual reference indicators) — a first-attempt version
 *    of this metric that only excluded `is_seed` mislabeled these as
 *    "Delayed by 200-800 days", when in fact they were never live signals.
 *
 * 2. Rows updated since insertion are excluded. `date` is mutated in place by
 *    later sync cycles (a long-running outbreak refreshed with a newer
 *    bulletin bumps `date` forward without changing `created_at`), so
 *    `created_at - date` is only a valid measurement of pickup lag for rows
 *    still exactly as first inserted. Comparing `updated_at` to `created_at`
 *    (within UPDATE_TOLERANCE_MS, to absorb clock/write timing noise from the
 *    insert itself) detects this.
 */

const UPDATE_TOLERANCE_MS = 60_000;

// Anything at or below this is normal pipeline latency (crons run several
// times daily), not worth disclosing as an incident. Every real catch-up case
// found in prod so far is 213+ days — this threshold has a wide, currently
// empty margin above normal latency and below any observed real case.
const CATCHUP_INCIDENT_THRESHOLD_DAYS = 7;

export function computeCatchupIncidentDays(
  date: string | null | undefined,
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined,
  isSeed: boolean,
  isBackfill: boolean,
): number | null {
  if (isSeed || isBackfill || !date || !createdAt) return null;

  if (updatedAt) {
    const createdMs = new Date(createdAt).getTime();
    const updatedMs = new Date(updatedAt).getTime();
    if (
      !Number.isNaN(createdMs) &&
      !Number.isNaN(updatedMs) &&
      updatedMs - createdMs > UPDATE_TOLERANCE_MS
    ) {
      return null; // row was refreshed since insertion — `date` no longer reflects the original bulletin
    }
  }

  const reported = new Date(`${date}T00:00:00Z`).getTime();
  const ingested = new Date(createdAt).getTime();
  if (Number.isNaN(reported) || Number.isNaN(ingested)) return null;

  const days = Math.round((ingested - reported) / 86_400_000);
  // Negative means the source date postdates our own ingestion timestamp —
  // a data anomaly, not a real lag. Treat as unknown rather than as "fast".
  return days >= 0 ? days : null;
}

export function isCatchupIncident(days: number | null): days is number {
  return days !== null && days > CATCHUP_INCIDENT_THRESHOLD_DAYS;
}

const DISCLOSURE: Record<string, (days: number) => string> = {
  en: (days) => `Catch-up ingestion: added to HealthWatch Global ${days} days after its reported date — a backfilled or late-discovered record, not a live-time miss.`,
  fr: (days) => `Ingestion tardive : intégré à HealthWatch Global ${days} jours après sa date signalée — un enregistrement rattrapé ou découvert tardivement, pas un signal manqué en temps réel.`,
  es: (days) => `Ingesta tardía: incorporado a HealthWatch Global ${days} días después de su fecha notificada — un registro recuperado o descubierto tardíamente, no una señal perdida en tiempo real.`,
  ar: (days) => `إدخال متأخر: أُضيف إلى HealthWatch Global بعد ${days} يومًا من تاريخه المُبلَّغ عنه — سجل مستدرك أو اكتُشف متأخرًا، وليس إشارة فائتة في الوقت الفعلي.`,
  id: (days) => `Entri susulan: ditambahkan ke HealthWatch Global ${days} hari setelah tanggal yang dilaporkan — catatan yang diproses ulang atau ditemukan terlambat, bukan sinyal yang terlewat secara real-time.`,
};

/**
 * Returns a full disclosure sentence when `days` clears the incident
 * threshold, or null when there's nothing to disclose (not eligible, or
 * within normal pipeline latency) — callers should render nothing at all in
 * the null case, not an empty/dash placeholder.
 */
export function catchupIncidentDisclosure(days: number | null, locale: string): string | null {
  if (!isCatchupIncident(days)) return null;
  return (DISCLOSURE[locale] ?? DISCLOSURE.en)(days);
}
