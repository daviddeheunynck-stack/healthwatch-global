-- ── Track alerted state on outbreak_alert_log ────────────────────────────────
-- Until now, outbreak_alert_log only recorded "this user was ever alerted for
-- this outbreak", which meant an outbreak could escalate (risk_level going up)
-- or its case count could surge for weeks after the first alert and no
-- follow-up would ever be sent — the regional-alerts cron only looked at
-- outbreaks.created_at, so an outbreak that just sits there getting worse
-- (the common case: Ebola/Uganda-DRC, cholera/Chad, etc., updated daily by
-- sync-outbreaks) never re-notified anyone after the first email.
--
-- These two columns let the cron compare the outbreak's current risk_level
-- and case count against the state it last alerted this specific user at,
-- so it can re-fire on a real escalation or case surge instead of going
-- silent forever after the first send.

ALTER TABLE public.outbreak_alert_log
  ADD COLUMN IF NOT EXISTS risk_level     TEXT,
  ADD COLUMN IF NOT EXISTS cases_at_alert INTEGER;

-- Backfill existing rows with the outbreak's CURRENT state as a baseline.
-- Without this, every already-alerted row would look like risk_level/cases
-- jumped from NULL to whatever it is today, which would fire a re-alert to
-- every existing subscriber on the very next cron run — exactly the alert
-- fatigue regression the min_risk threshold (2026-07-03) was built to avoid.
UPDATE public.outbreak_alert_log AS log
SET    risk_level     = o.risk_level,
       cases_at_alert = o.cases
FROM   public.outbreaks AS o
WHERE  o.id::text = log.outbreak_id
  AND  log.risk_level IS NULL;
