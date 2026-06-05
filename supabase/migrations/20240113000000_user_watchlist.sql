-- ── User outbreak watchlist ───────────────────────────────────────────────────
-- Users can star specific outbreaks to receive change notifications.
-- When cases/deaths change for a watched outbreak, an alert is sent.

CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outbreak_id UUID NOT NULL REFERENCES public.outbreaks(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, outbreak_id)
);

CREATE INDEX IF NOT EXISTS user_watchlist_user_idx
  ON public.user_watchlist (user_id);

ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_own" ON public.user_watchlist
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Track last notified snapshot to avoid duplicate alerts
CREATE TABLE IF NOT EXISTS public.watchlist_alert_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outbreak_id UUID NOT NULL REFERENCES public.outbreaks(id) ON DELETE CASCADE,
  cases_at_alert  INTEGER NOT NULL,
  deaths_at_alert INTEGER NOT NULL,
  alerted_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, outbreak_id)
);
