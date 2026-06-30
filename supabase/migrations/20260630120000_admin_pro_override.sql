-- Grant permanent Pro access to the admin account.
-- Sets a synthetic subscription_id so the trial-expiry guard never triggers.
UPDATE public.profiles
SET
  stripe_subscription_id = 'admin_override',
  plan                   = 'pro',
  trial_ends_at          = NULL
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'david.deheunynck@yahoo.fr'
);
