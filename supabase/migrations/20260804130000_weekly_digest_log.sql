-- Weekly digest dedup
-- weekly-digest (app/api/cron/weekly-digest/route.ts) sent unconditionally to
-- every active subscriber on every invocation, with no record of "already
-- sent this week" -- a manual re-invocation, or a genuine duplicate Vercel
-- Cron trigger (see isLiveCronInvocation's own doc in lib/cron-monitor.ts),
-- would resend the same digest to every real subscriber. Found 2026-08-04
-- after 4 manual health-check re-invocations spammed the founder; David
-- asked for the same protection on the two customer-facing routes that had
-- none, weekly-digest and send-welcome.
--
-- claimEmailSend()/lifecycle_email_log doesn't fit here: subscriptions.email
-- is a standalone newsletter address, not necessarily tied to an auth.users
-- row, so this is keyed on subscription_id instead of user_id.

CREATE TABLE IF NOT EXISTS public.weekly_digest_log (
  subscription_id UUID        NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  week_of         DATE        NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, week_of)
);

ALTER TABLE public.weekly_digest_log ENABLE ROW LEVEL SECURITY;

-- Service role only (the cron itself), same convention as lifecycle_email_log.
CREATE POLICY "Service role only"
  ON public.weekly_digest_log
  FOR ALL
  USING (false);
