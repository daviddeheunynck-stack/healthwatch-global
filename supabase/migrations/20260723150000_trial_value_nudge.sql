-- ── Usage-triggered trial conversion nudge ───────────────────────────────────
-- Every trial user who has ever converted got the same generic countdown
-- reminder (trial-reminders cron, J-3/J-1 before trial_ends_at) — a calendar
-- event with no connection to whether they'd actually seen the product work.
-- Zero real Stripe payments have ever happened on this account.
--
-- This column lets regional-alerts send a one-time "you just saw this work —
-- keep it after your trial" nudge the first time a trial user (no Stripe
-- subscription yet) receives a real "new outbreak" alert, instead of only
-- ever prompting them on a fixed calendar date unrelated to product value.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_value_email_sent_at TIMESTAMPTZ;
