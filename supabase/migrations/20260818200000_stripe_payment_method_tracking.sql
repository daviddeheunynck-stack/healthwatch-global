-- Tracks whether a Stripe subscription actually has a payment method attached,
-- distinct from `stripe_subscription_id` (set the moment checkout completes,
-- even with `payment_method_collection: if_required` and no card — see
-- app/api/checkout/route.ts:150-152). Every surface that reads
-- stripe_subscription_id as a proxy for "paying customer" (admin go/no-go
-- checklist, trial banner, outbreak-detail CTA) currently treats a no-card
-- trialing subscriber as fully converted. Found 2026-08-17/18:
-- otitamorgan@gmail.com went through checkout on 2026-08-12 with no card
-- attached (trial_settings.end_behavior.missing_payment_method = "cancel",
-- silent cancellation scheduled 2026-08-26) and is invisible to every
-- mechanism gated on stripe_subscription_id alone.
--
-- Written by the webhook (app/api/webhook/route.ts) from
-- Stripe subscription.default_payment_method — already read there for the
-- trial_will_end email (see hasPaymentMethod at line ~484) — and also set
-- true on invoice.payment_succeeded (a succeeded charge proves a working
-- payment method regardless of default_payment_method's exact state).
alter table profiles
  add column if not exists stripe_has_payment_method boolean not null default false;

-- Billing period ("monthly" | "annual") of the active Stripe subscription —
-- not tracked anywhere today, so admin's MRR estimate (PLAN_MRR) treats every
-- Pro subscriber as the €29/mo price even when they bought the €249/yr plan
-- (~€20.75/mo equivalent). Set from checkout's own
-- subscription_data[metadata][billing] at checkout.session.completed; not
-- backfillable for existing rows without a live Stripe read, so this starts
-- null for pre-existing subscribers rather than guessing.
alter table profiles
  add column if not exists stripe_billing_period text;
