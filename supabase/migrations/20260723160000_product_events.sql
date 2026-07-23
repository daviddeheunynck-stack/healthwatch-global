-- ── Product usage events ──────────────────────────────────────────────────────
-- Global, user-scoped usage log (modeled on org_activity_log, minus the
-- org_id scoping). Written exclusively via the service role (lib/track-event.ts)
-- — no RLS policy is created on purpose, so any request using the anon/
-- authenticated JWT is denied by default. This is capture-only for now: no
-- client-facing read path, no analytics UI, just a queryable record of real
-- per-user product usage (dashboard views, exports, etc.) that Vercel
-- Analytics' client-side, user_id-less events can't provide.

CREATE TABLE IF NOT EXISTS public.product_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT        NOT NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_events_user_created_idx
  ON public.product_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_events_action_created_idx
  ON public.product_events (action, created_at DESC);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
-- No policies: deny-by-default for anon/authenticated roles, service role bypasses RLS.
