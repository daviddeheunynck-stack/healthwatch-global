-- Find admin profile by both possible emails and update.
-- Also catches the case where email is stored in profiles directly.
UPDATE public.profiles
SET
  stripe_subscription_id = 'admin_override',
  plan                   = 'pro',
  trial_ends_at          = NULL
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('david.deheunynck@yahoo.fr', 'david.deheunynck@gmail.com')
);
