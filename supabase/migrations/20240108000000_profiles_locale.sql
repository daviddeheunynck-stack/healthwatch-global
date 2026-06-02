-- Add locale preference to profiles table.
-- Used by transactional emails (welcome, upgrade, trial, churn, alerts)
-- so every user gets emails in their chosen language regardless of whether
-- they subscribed to the weekly digest.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'fr';

-- Backfill: try to inherit locale from subscriptions table where email matches
UPDATE public.profiles p
SET    locale = s.locale
FROM   public.subscriptions s
WHERE  p.email = s.email
  AND  s.locale IS NOT NULL;
