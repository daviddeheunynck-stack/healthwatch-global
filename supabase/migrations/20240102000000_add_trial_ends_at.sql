-- Add trial_ends_at to profiles so the dashboard can show a countdown
-- without hitting the Stripe API on every page load.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
