-- ── Mobile push tokens (Expo) ─────────────────────────────────────────────────
-- Stores Expo push tokens for the React Native companion app, sent via Expo's
-- push API (see lib/expo-push.ts) rather than Web Push/VAPID. Mirrors the
-- push_subscriptions pattern: one row per device, owned by the authenticated
-- user, RLS-restricted to its own rows.
--
-- `expo_push_token` is unique because each device/app-install is a distinct
-- push channel — re-registering the same device (e.g. after reinstall)
-- produces a fresh token, while re-registering an unchanged one should update
-- the row in place rather than create a duplicate.

CREATE TABLE IF NOT EXISTS public.mobile_push_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token   TEXT NOT NULL UNIQUE,
  platform          TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  locale            TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobile_push_tokens_user_idx
  ON public.mobile_push_tokens (user_id);

ALTER TABLE public.mobile_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mobile_push_tokens_own" ON public.mobile_push_tokens
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
