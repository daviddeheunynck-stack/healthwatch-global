-- Cross-cron per-user-per-outbreak daily alert dedup.
--
-- regional-alerts, watchlist-alerts and disease-alerts each maintain their
-- OWN state log (outbreak_alert_log / watchlist_alert_log / disease_alert_log)
-- and each independently decides "new"/"escalated"/"surge" for a given
-- (user, outbreak) pair. Nothing stopped the same outbreak from matching a
-- user's region subscription AND their disease subscription AND their
-- starred watchlist entry on the same day — three near-identical emails
-- ~10-20min apart. Flagged in the 2026-08-24 handoff notes as chantier #1.
--
-- Reordered by specificity (watchlist -> disease -> regional, most targeted
-- to broadest) and gated on this lock: the first of the three crons to claim
-- (user, outbreak, day) is the one that actually emails; the other two still
-- update their own state log (so they don't re-detect the same unchanged
-- state as "new" again tomorrow) but skip the send/Slack/push for that item.
-- See claimOutbreakAlertDaily / releaseOutbreakAlertDaily in
-- lib/cron-monitor.ts.
--
-- outbreak_id is TEXT rather than a UUID FK because the three source tables
-- disagree on the column's type (outbreak_alert_log stores it as TEXT,
-- watchlist_alert_log/disease_alert_log as UUID) — TEXT avoids cast friction
-- for whichever cron is writing. Same reasoning as weekly_email_send_log's
-- shared TEXT key.

CREATE TABLE IF NOT EXISTS public.outbreak_alert_daily_lock (
  user_id     UUID        NOT NULL,
  outbreak_id TEXT        NOT NULL,
  alert_date  DATE        NOT NULL,
  source      TEXT        NOT NULL, -- 'watchlist-alerts' | 'disease-alerts' | 'regional-alerts'
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, outbreak_id, alert_date)
);

ALTER TABLE public.outbreak_alert_daily_lock ENABLE ROW LEVEL SECURITY;

-- Service role only (the cron itself), same convention as weekly_email_send_log.
CREATE POLICY "Service role only"
  ON public.outbreak_alert_daily_lock
  FOR ALL
  USING (false);
