-- Webhooks : push configurable par région et niveau de risque (Pro+)
CREATE TABLE IF NOT EXISTS public.webhooks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL DEFAULT 'My webhook' CHECK (char_length(name) <= 64),
  url             TEXT        NOT NULL CHECK (length(url) <= 2048),
  secret          TEXT        NOT NULL,          -- HMAC-SHA256 signing secret
  filters         JSONB       NOT NULL DEFAULT '{}',
  -- filters shape: { "regions": ["africa"], "risk_levels": ["high"] }
  -- empty arrays = no filter on that dimension
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  last_status_code  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_webhooks" ON public.webhooks
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS webhooks_user_active_idx
  ON public.webhooks (user_id, active);
