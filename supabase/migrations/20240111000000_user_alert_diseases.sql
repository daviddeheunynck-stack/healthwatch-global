-- ── User disease alert subscriptions ─────────────────────────────────────────
-- Each row = "this user wants alerts for this specific pathogen, worldwide."
-- Complementary to user_alert_regions (geography-based).
-- One row per user per disease — MAX 10 diseases per user (enforced at API level).

CREATE TABLE IF NOT EXISTS public.user_alert_diseases (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disease_en TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, disease_en)
);

CREATE INDEX IF NOT EXISTS user_alert_diseases_user_idx
  ON public.user_alert_diseases (user_id);

-- RLS: users can only see/manage their own subscriptions
ALTER TABLE public.user_alert_diseases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disease_alerts_own" ON public.user_alert_diseases
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Track last sent to avoid duplicate alerts (same outbreak, same user)
-- We reuse the existing outbreak_alert_log table if it exists,
-- otherwise create a disease-specific log.
CREATE TABLE IF NOT EXISTS public.disease_alert_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outbreak_id UUID NOT NULL REFERENCES public.outbreaks(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, outbreak_id)
);

CREATE INDEX IF NOT EXISTS disease_alert_log_user_idx
  ON public.disease_alert_log (user_id);
