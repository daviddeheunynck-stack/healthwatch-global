-- One weekly email per address, across all four Monday-morning mailers.
--
-- Until now each of the four routes deduped on its own key space:
--   weekly-signal            -> lifecycle_email_log   (profiles.id)
--   weekly-digest            -> weekly_digest_log     (subscriptions.id)
--   trigger-regional-digest  -> alert_notifications   (profiles.id, 6d cooldown)
--   send-sitrep-emails       -> scheduled_reports.last_sent_at (report id)
-- None of them deduped on the email address, which is the only thing the four
-- audiences have in common. weekly-digest in particular reads `subscriptions`,
-- a standalone newsletter table with no join to profiles and no plan filter, so
-- one person who is both a logged-in user and a newsletter subscriber received
-- two emails ten minutes apart; with an active scheduled_reports row listing
-- their address, three in twenty minutes. Found 2026-08-23.
--
-- The claim is keyed on the ADDRESS so it cuts across all four. First route to
-- claim in a given week wins; the others see the row taken and skip. That only
-- produces the intended priority (sitrep > regional digest > digest > signal)
-- because the cron schedule was reordered to run them in that order in the same
-- commit -- an email already sent at 06:50 cannot be recalled, so the ordering
-- is load-bearing, not cosmetic. If you ever reorder those four in vercel.json,
-- you are also changing which email wins.
--
-- Side effect, deliberate: this also closes the intra-route fan-out. Two
-- `subscriptions` rows sharing one address used to yield two digests (the old
-- claim was on subscription_id); one address listed in three scheduled_reports
-- used to yield three sitreps.

CREATE TABLE IF NOT EXISTS public.weekly_email_claim (
  email      TEXT        NOT NULL,
  week_of    DATE        NOT NULL,
  cron_name  TEXT        NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, week_of)
);

-- Addresses are compared lowercased in application code (same convention as
-- lib/brevo-blocklist.ts); this index keeps the weekly cleanup cheap.
CREATE INDEX IF NOT EXISTS weekly_email_claim_week_idx
  ON public.weekly_email_claim (week_of);

ALTER TABLE public.weekly_email_claim ENABLE ROW LEVEL SECURITY;

-- Service role only (the crons themselves), same convention as
-- lifecycle_email_log and weekly_digest_log.
CREATE POLICY "Service role only"
  ON public.weekly_email_claim
  FOR ALL
  USING (false);
