-- In-app notification log — populated by cron alert triggers
-- Lets users review which alerts fired while they were away

CREATE TABLE IF NOT EXISTS public.alert_notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('tripwire', 'category_alert', 'subscriber', 'watchlist')),
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  outbreak_id  UUID        REFERENCES public.outbreaks(id) ON DELETE SET NULL,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.alert_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.alert_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.alert_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Service role inserts (cron jobs) bypass RLS — no INSERT policy needed

CREATE INDEX IF NOT EXISTS alert_notifications_user_created
  ON public.alert_notifications (user_id, created_at DESC);
