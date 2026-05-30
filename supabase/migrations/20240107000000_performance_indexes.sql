-- ── Performance indexes ───────────────────────────────────────────────────────
-- Added after audit: several hot query paths were doing full table scans.

-- profiles.stripe_customer_id
-- Queried on EVERY Stripe webhook event (6 event types) to resolve userId.
-- Without this index, each webhook is an O(n) scan of the entire profiles table.
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- profiles.stripe_subscription_id
-- Queried by subscription lifecycle webhooks (updated, deleted).
CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_id_idx
  ON public.profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- subscriptions.email
-- Queried by: checkout webhook (upsert), onboarding cron (locale lookup),
-- regional alerts cron (locale lookup), weekly digest cron (active filter).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_email_idx
  ON public.subscriptions (email);

-- subscriptions.active
-- Weekly digest cron: WHERE active = true — partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS subscriptions_active_idx
  ON public.subscriptions (active)
  WHERE active = true;

-- outbreaks.active + date
-- Dashboard query: WHERE active = true ORDER BY date DESC
-- Crons: WHERE active = true AND risk_level = 'high' AND date >= ...
CREATE INDEX IF NOT EXISTS outbreaks_active_date_idx
  ON public.outbreaks (active, date DESC)
  WHERE active = true;

-- outbreaks.active + risk_level + date
-- Weekly digest & regional alerts: high-risk filter
CREATE INDEX IF NOT EXISTS outbreaks_active_risk_date_idx
  ON public.outbreaks (risk_level, date DESC)
  WHERE active = true;

-- outbreaks.region
-- Regional alerts cron: filters by region after fetching active outbreaks.
CREATE INDEX IF NOT EXISTS outbreaks_region_idx
  ON public.outbreaks (region)
  WHERE active = true;

-- profiles.plan + trial_ends_at
-- Trial reminders cron: WHERE plan IN ('starter','pro') AND trial_ends_at IS NOT NULL
CREATE INDEX IF NOT EXISTS profiles_plan_trial_idx
  ON public.profiles (plan, trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;
