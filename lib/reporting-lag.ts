/**
 * Reporting lag: how many days after an outbreak's reported `date` did
 * HealthWatch Global's own pipeline first ingest it (`created_at`).
 *
 * This measures HWG's own pipeline freshness relative to the source's stated
 * date — it is NOT a claim about how fast the reporting country's
 * surveillance system detected, validated, or responded to the event.
 *
 * Two exclusions are required for this to be honest, both learned the hard
 * way against real data (see project_reporting_lag_feature_incremental_build
 * memory, 2026-07-20):
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
export type ReportingLagBucket = "fresh" | "moderate" | "delayed";

const UPDATE_TOLERANCE_MS = 60_000;

export function computeReportingLagDays(
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

export function bucketReportingLag(days: number | null): ReportingLagBucket | null {
  if (days === null) return null;
  if (days <= 2) return "fresh";
  if (days <= 7) return "moderate";
  return "delayed";
}

const LABELS: Record<string, Record<ReportingLagBucket, string>> = {
  en: { fresh: "Fresh",      moderate: "Moderate", delayed: "Delayed"  },
  fr: { fresh: "Récent",     moderate: "Modéré",   delayed: "Retardé"  },
  es: { fresh: "Reciente",   moderate: "Moderado", delayed: "Retrasado" },
  ar: { fresh: "حديث",       moderate: "متوسط",    delayed: "متأخر"    },
  id: { fresh: "Baru",       moderate: "Sedang",   delayed: "Tertunda"  },
};

export function reportingLagLabel(bucket: ReportingLagBucket | null, locale: string): string {
  if (!bucket) return "—";
  return (LABELS[locale] ?? LABELS.en)[bucket];
}
