-- ── lifecycle_email_log ────────────────────────────────────────────────────────
-- Closes the gap flagged in the 2026-08-02 security audit (known-findings.json,
-- id cron-monitor::design::isLiveCronInvocation-does-not-cover-vercel-duplicate-delivery):
-- isLiveCronInvocation() only guards against *accidental* manual replay, not
-- Vercel occasionally invoking the same scheduled run twice (documented Vercel
-- behavior). expire-trials/regional-alerts/disease-alerts already have a natural
-- or explicit dedup (a state-changing update, or outbreak_alert_log/
-- disease_alert_log) — expire-trials/onboarding-sequence/trial-reminders/
-- winback-sequence's pure time-window queries did not, so a genuine duplicate
-- Vercel invocation could re-send the same lifecycle email twice (the actual
-- 2026-07-15 incident this file's isLiveCronInvocation doc references, before
-- that fix — this closes the remaining gap that fix didn't cover).
--
-- One row per (user, cron, step) ever sent — never per calendar day, since
-- each of these lifecycle emails (J+1, J-3, trial-expired...) is meant to fire
-- exactly once per user for the life of that trial/account state, not once per
-- day. Claimed with INSERT ... ON CONFLICT DO NOTHING *before* sending (see
-- claimEmailSend() in lib/cron-monitor.ts) so two near-simultaneous invocations
-- racing on the same user+step only ever let one of them send — unlike
-- outbreak_alert_log's send-then-log ordering, which optimizes for a different
-- failure mode (a crash between send and log) and is the wrong order for this.

CREATE TABLE IF NOT EXISTS public.lifecycle_email_log (
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cron_name TEXT NOT NULL,
  step      TEXT NOT NULL,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, cron_name, step)
);

ALTER TABLE public.lifecycle_email_log ENABLE ROW LEVEL SECURITY;

-- Only the service role (cron) writes/reads here — same pattern as
-- outbreak_alert_log / disease_alert_log.
CREATE POLICY "Service role only"
  ON public.lifecycle_email_log
  FOR ALL
  USING (false);
