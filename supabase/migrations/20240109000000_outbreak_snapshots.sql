-- ── Daily outbreak snapshots ──────────────────────────────────────────────────
-- Stores one case/death count per outbreak per day.
-- Used to compute directional trend indicators (▲ / → / ▼).
-- The sync cron upserts a snapshot after each run.
-- After 7 days of data, trend calculation becomes meaningful.

CREATE TABLE IF NOT EXISTS public.outbreak_snapshots (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  outbreak_id UUID    NOT NULL REFERENCES public.outbreaks(id) ON DELETE CASCADE,
  cases       INTEGER NOT NULL DEFAULT 0,
  deaths      INTEGER NOT NULL DEFAULT 0,
  snapped_at  DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  -- One snapshot per outbreak per day (idempotent upsert)
  UNIQUE (outbreak_id, snapped_at)
);

-- Index for fast trend lookups: "give me the last 14 snapshots for outbreak X"
CREATE INDEX IF NOT EXISTS outbreak_snapshots_outbreak_date_idx
  ON public.outbreak_snapshots (outbreak_id, snapped_at DESC);

-- RLS: no direct public access — only service role (cron) writes
ALTER TABLE public.outbreak_snapshots ENABLE ROW LEVEL SECURITY;

-- Backfill: seed today's snapshot from current outbreaks
INSERT INTO public.outbreak_snapshots (outbreak_id, cases, deaths, snapped_at)
SELECT id, cases, deaths, CURRENT_DATE
FROM   public.outbreaks
WHERE  active = true
ON CONFLICT (outbreak_id, snapped_at) DO NOTHING;
