-- API keys for Enterprise users.
-- The raw key is shown once at creation and never stored.
-- Only the SHA-256 hex hash is kept server-side.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  key_hash     TEXT        NOT NULL UNIQUE,   -- SHA-256(raw_key), hex-encoded
  key_prefix   TEXT        NOT NULL,          -- first 8 chars of raw key, for display
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own API keys"
  ON public.api_keys
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup by hash (used on every API request)
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON public.api_keys (key_hash);
