-- ── Web Push subscriptions ────────────────────────────────────────────────────
-- Stores browser PushSubscription objects (endpoint + encryption keys) so the
-- server can send Web Push notifications via VAPID (see lib/push.ts). Mirrors
-- the user_watchlist pattern: one row per device/browser subscription, owned
-- by the authenticated user, RLS-restricted to its own rows.
--
-- `endpoint` is unique because each browser subscription is a distinct push
-- channel — re-subscribing the same device (e.g. after clearing permissions)
-- produces a fresh endpoint, while re-registering an unchanged one should
-- update the row in place rather than create a duplicate (see the upsert in
-- /api/push/subscribe).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  locale      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
