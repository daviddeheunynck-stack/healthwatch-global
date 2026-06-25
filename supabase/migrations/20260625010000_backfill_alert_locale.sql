-- Backfill alert_locale for users who have a non-English signup locale
-- but still carry the DEFAULT 'en' that the previous migration set.
-- Safe: we only touch rows where locale differs from 'en',
-- preserving any user who deliberately changed alert_locale to 'en'.
UPDATE profiles
SET alert_locale = locale
WHERE locale IS NOT NULL
  AND locale != 'en'
  AND alert_locale = 'en';
