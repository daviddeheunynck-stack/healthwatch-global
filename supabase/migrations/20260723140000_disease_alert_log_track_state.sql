-- ── Track alerted state on disease_alert_log ─────────────────────────────────
-- Same fix as 20260723130000 (outbreak_alert_log / regional-alerts), applied
-- to the disease-specific alert cron: disease_alert_log only recorded "this
-- user was ever alerted for this outbreak", so once sent, a user would never
-- hear about that outbreak again even if it escalated or surged.
--
-- No backfill needed here — user_alert_diseases / disease_alert_log both have
-- zero rows as of 2026-07-23 (the disease-alert feature has never actually
-- been used by a real subscriber), so there's no existing-row fatigue-storm
-- risk like there was for outbreak_alert_log.

ALTER TABLE public.disease_alert_log
  ADD COLUMN IF NOT EXISTS risk_level     TEXT,
  ADD COLUMN IF NOT EXISTS cases_at_alert INTEGER;
