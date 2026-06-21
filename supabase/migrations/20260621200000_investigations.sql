-- Signal investigations: tracks escalated signals for each user
CREATE TABLE IF NOT EXISTS public.signal_investigations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_source  TEXT,
  headline       TEXT        NOT NULL,
  disease_hint   TEXT,
  country_hint   TEXT,
  status         TEXT        NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'escalated', 'closed')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.signal_investigations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_investigations" ON public.signal_investigations
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS signal_investigations_user_idx
  ON public.signal_investigations (user_id, created_at DESC);
