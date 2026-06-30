-- 1. Extend type CHECK to include all alert types used by crons
ALTER TABLE public.alert_notifications
  DROP CONSTRAINT IF EXISTS alert_notifications_type_check;

ALTER TABLE public.alert_notifications
  ADD CONSTRAINT alert_notifications_type_check
    CHECK (type IN (
      'tripwire',
      'category_alert',
      'subscriber',
      'watchlist',
      'pheic',
      'country_risk',
      'regional_digest'
    ));

-- 2. Partial unique index: prevents duplicate notifications for the same
--    user + outbreak + type. Partial (WHERE outbreak_id IS NOT NULL) because
--    NULL = NULL is false in SQL, so a full unique index would not catch
--    duplicate NULL rows (regional_digest, country_risk use time-based dedup instead).
CREATE UNIQUE INDEX IF NOT EXISTS alert_notifications_user_outbreak_type_uniq
  ON public.alert_notifications (user_id, outbreak_id, type)
  WHERE outbreak_id IS NOT NULL;
