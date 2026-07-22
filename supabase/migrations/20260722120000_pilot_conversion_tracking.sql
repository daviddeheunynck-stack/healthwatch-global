-- Tracks which trials came from the institutional pilot program (/pilot), so the
-- trial-ending flow can treat them differently from a plain 14-day self-serve trial.
--
-- Why: the pilot page promises a "45-min closing feedback session" that ends with a
-- concrete paid proposal, but nothing in the codebase distinguished a pilot signup
-- from a regular trial — both got the same generic "€29/month, activate my
-- subscription" email with no human follow-up and no Team-plan framing. Since pilot
-- capacity is capped at 3 institutions/month, a personal reminder to David is the
-- right fix, not another automated email.
alter table profiles
  add column if not exists is_pilot boolean not null default false,
  add column if not exists pilot_organization text;

comment on column profiles.is_pilot is 'True if this account was activated via the institutional pilot program (/pilot), not the plain self-serve trial.';
comment on column profiles.pilot_organization is 'Organization name submitted on the pilot application form, for personalized follow-up.';
