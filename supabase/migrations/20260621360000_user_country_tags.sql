-- P1: Per-user country labels (e.g. "Hamburg — A320 factory", "Toulouse — HQ")
-- One label per (user, country). Label can be updated via upsert.
CREATE TABLE IF NOT EXISTS public.user_country_tags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_en  TEXT        NOT NULL,
  label       TEXT        NOT NULL CHECK (char_length(label) <= 80),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_country_tags_user_country_idx
  ON public.user_country_tags (user_id, country_en);

ALTER TABLE public.user_country_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_country_tags" ON public.user_country_tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
