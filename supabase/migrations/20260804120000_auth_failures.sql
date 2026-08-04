-- Auth failure signal
-- Neither signup nor login wrote anything anywhere on failure before this:
-- the 2026-08-04 secret-key incident and the 2026-08-03 uncaught-exception
-- incident were both discovered by a prospect on LinkedIn, never by the
-- product. This table is the minimal signal to change that: no email
-- address (the person failing has no account and gave no consent), just
-- enough to tell "somebody typed a weak password" apart from "the auth
-- backend is broken for everyone". See marketing/product-ideas-log.md,
-- 2026-08-04, idea 1.
--
-- Written from a route reachable by anonymous visitors (nobody has a session
-- yet at the moment their signup/login fails), so unlike product_events this
-- cannot require an authenticated user_id. Rate-limited instead, see
-- app/api/track-auth-failure/route.ts.

CREATE TABLE IF NOT EXISTS public.auth_failures (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flow         TEXT        NOT NULL, -- 'signup' | 'login'
  method       TEXT        NOT NULL, -- 'email' | 'password' | 'otp'
  error_code   TEXT        NOT NULL,
  -- Domain only, never the full address, see the RGPD trade-off documented
  -- in the idea log above. Nullable: the client only has an email to split
  -- once the field has been filled in.
  email_domain TEXT,
  is_system    BOOLEAN     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_failures_created_idx
  ON public.auth_failures (created_at DESC);

CREATE INDEX IF NOT EXISTS auth_failures_system_created_idx
  ON public.auth_failures (is_system, created_at DESC);

ALTER TABLE public.auth_failures ENABLE ROW LEVEL SECURITY;
-- No policies: deny-by-default for anon/authenticated roles, service role
-- (the only writer/reader, see track-auth-failure/route.ts and
-- health-check/route.ts) bypasses RLS. Same convention as product_events.
