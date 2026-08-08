-- Double opt-in for the 3 paid alert features that accept a free-text email
-- address at creation (country_risk_alerts, geofence_alerts, category_alerts).
-- Format validation only existed before this (harmonized 2026-08-05, commits
-- 39cf3fb/f1adfda/2154dbf) -- a Pro user could type a third party's address
-- and that person would start receiving recurring outbreak-alert emails with
-- no proof they ever consented, until they found and used the unsubscribe
-- link added the same day (commit d40bbcf). This closes the remaining gap:
-- no email goes out on a recurring basis until the address itself confirms
-- via a signed link (app/api/confirm-alert/route.ts), same trust model as
-- the existing unsubscribe link (lib/unsubscribe-token.ts).
--
-- NULL = pending confirmation (the state every new alert starts in); the 3
-- trigger-*-alerts crons only fire for confirmed_at IS NOT NULL. Existing
-- rows stay NULL (unconfirmed) rather than backfilled true -- all 3 tables
-- are empty in production as of 2026-08-08, so there is no real alert to
-- grandfather in either way.

ALTER TABLE public.country_risk_alerts ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.geofence_alerts     ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.category_alerts     ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
