-- ── user_alert_regions ────────────────────────────────────────────────────────
-- Stores which regions each paid user wants outbreak alerts for.

CREATE TABLE IF NOT EXISTS public.user_alert_regions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region  TEXT NOT NULL CHECK (region IN ('africa','asia','americas','europe','oceania')),
  PRIMARY KEY (user_id, region)
);

ALTER TABLE public.user_alert_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own alert regions"
  ON public.user_alert_regions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── outbreak_alert_log ────────────────────────────────────────────────────────
-- Prevents the cron from sending duplicate alerts for the same outbreak.

CREATE TABLE IF NOT EXISTS public.outbreak_alert_log (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outbreak_id TEXT NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, outbreak_id)
);

ALTER TABLE public.outbreak_alert_log ENABLE ROW LEVEL SECURITY;

-- Only the service role (cron) writes here; users cannot read or write.
CREATE POLICY "Service role only"
  ON public.outbreak_alert_log
  FOR ALL
  USING (false);
