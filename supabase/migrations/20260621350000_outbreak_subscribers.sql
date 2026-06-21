-- P4: Per-outbreak email subscriber list.
-- One row per (user, outbreak). Emails are a TEXT[] of up to 50 addresses.
-- The cron job reads this table and sends a daily/change-triggered digest.
CREATE TABLE IF NOT EXISTS public.outbreak_subscribers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outbreak_id TEXT        NOT NULL,
  emails      TEXT[]      NOT NULL DEFAULT '{}',
  locale      TEXT        NOT NULL DEFAULT 'en',
  last_sent_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_user_outbreak_idx
  ON public.outbreak_subscribers (user_id, outbreak_id);

CREATE INDEX IF NOT EXISTS subscribers_outbreak_idx
  ON public.outbreak_subscribers (outbreak_id);

ALTER TABLE public.outbreak_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_subscribers" ON public.outbreak_subscribers
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
