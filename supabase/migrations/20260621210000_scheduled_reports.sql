-- Scheduled sitrep email reports (one config per user)
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipients    TEXT[]      NOT NULL DEFAULT '{}',
  locale        TEXT        NOT NULL DEFAULT 'en',
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  last_sent_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_reports_user_unique UNIQUE (user_id)
);

ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_scheduled_reports"
  ON public.scheduled_reports
  FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS scheduled_reports_user_idx
  ON public.scheduled_reports (user_id);
