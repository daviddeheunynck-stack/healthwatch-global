-- Second backfill of alert_locale, same shape as 20260625010000_backfill_alert_locale.
-- The first backfill (25/06) only caught the stock existing at that date. Two write
-- paths kept producing the same gap for every account created after: the OAuth
-- callback's `!profile?.locale` guard was dead code (profiles.locale has carried a
-- DEFAULT 'fr' since 20240108000000, so it never reads as null), and the client-side
-- write in signup/page.tsx silently no-ops under RLS when it fires before a session
-- exists (email confirmation required, no auto-login). Both fixed in
-- app/auth/callback/route.ts and app/api/admin/invite/route.ts alongside this
-- migration — this statement only repairs the accounts already affected.
--
-- Same precaution as the first backfill: only touch rows still sitting on the
-- untouched alert_locale DEFAULT 'en', so a user who deliberately kept alert_locale
-- at 'en' while interface locale differs (e.g. prefers English epi terminology) is
-- never overwritten.
UPDATE profiles
SET alert_locale = locale
WHERE locale IS NOT NULL
  AND locale != 'en'
  AND alert_locale = 'en';
