-- P3: Category-based outbreak alerts.
-- Fires when any outbreak in the configured (disease_category, region) crosses min_cases.
CREATE TABLE IF NOT EXISTS public.category_alerts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disease_category  TEXT        NOT NULL,   -- respiratory | hemorrhagic | waterborne | vector-borne | zoonotic | other
  region            TEXT        NOT NULL DEFAULT 'all',
  min_cases         INT         NOT NULL CHECK (min_cases > 0),
  email             TEXT        NOT NULL,
  last_fired_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS category_alerts_user_idx ON public.category_alerts (user_id);

ALTER TABLE public.category_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_category_alerts" ON public.category_alerts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
