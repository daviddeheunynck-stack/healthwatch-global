-- Per-outbreak predictive trend alert. Unlike outbreak_tripwires (fires on a
-- manual case-count threshold, after the fact), this fires when the 7-day
-- growth trend (lib/outbreak-trend.ts) projects the outbreak to double its
-- case count within the user's configured window — a forward-looking signal
-- computed from outbreak_snapshots, not a fixed number the user has to guess.
CREATE TABLE IF NOT EXISTS public.outbreak_predictive_alerts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outbreak_id           TEXT        NOT NULL,
  doubling_within_days  INT         NOT NULL CHECK (doubling_within_days > 0),
  email                 TEXT        NOT NULL,
  last_projected_days   NUMERIC,
  triggered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One predictive alert per user per outbreak
CREATE UNIQUE INDEX IF NOT EXISTS predictive_alerts_user_outbreak_idx
  ON public.outbreak_predictive_alerts (user_id, outbreak_id);

CREATE INDEX IF NOT EXISTS predictive_alerts_outbreak_idx
  ON public.outbreak_predictive_alerts (outbreak_id);

ALTER TABLE public.outbreak_predictive_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_predictive_alerts" ON public.outbreak_predictive_alerts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
