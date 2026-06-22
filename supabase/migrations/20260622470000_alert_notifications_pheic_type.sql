-- Add 'pheic' to the allowed types in alert_notifications
-- Required by trigger-pheic-alerts cron for dedup tracking

ALTER TABLE public.alert_notifications
  DROP CONSTRAINT IF EXISTS alert_notifications_type_check;

ALTER TABLE public.alert_notifications
  ADD CONSTRAINT alert_notifications_type_check
    CHECK (type IN ('tripwire', 'category_alert', 'subscriber', 'watchlist', 'pheic'));
