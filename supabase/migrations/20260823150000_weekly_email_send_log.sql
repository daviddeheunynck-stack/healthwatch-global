-- Cross-cron weekly-email dedup by address
-- weekly-digest (subscriptions.email, explicit opt-in newsletter) and
-- weekly-signal (profiles.email, every free-plan account) each already
-- dedupe against their OWN prior sends (weekly_digest_log /
-- lifecycle_email_log), but nothing stopped the same email address from
-- receiving BOTH in the same week when it's present in both tables (a
-- free-plan user who also filled the public newsletter form) — two
-- near-identical "HealthWatch Global weekly" emails ~10 minutes apart.
-- Found 2026-08-23, David: "un seul email hebdo par adresse".
--
-- Keyed on the lowercased email itself, not a row id, since that's the only
-- identifier shared between the two source tables. See
-- claimWeeklyEmailAddress in lib/cron-monitor.ts.

CREATE TABLE IF NOT EXISTS public.weekly_email_send_log (
  email    TEXT        NOT NULL,
  week_of  DATE        NOT NULL,
  source   TEXT        NOT NULL, -- 'weekly-digest' | 'weekly-signal' — which cron claimed it
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, week_of)
);

ALTER TABLE public.weekly_email_send_log ENABLE ROW LEVEL SECURITY;

-- Service role only (the cron itself), same convention as weekly_digest_log.
CREATE POLICY "Service role only"
  ON public.weekly_email_send_log
  FOR ALL
  USING (false);
