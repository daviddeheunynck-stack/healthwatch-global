-- Fix: enable RLS on the two alert-log tables that were missing it.
-- Both tables are internal to the cron/service role — users never read or
-- write them directly. Policy mirrors outbreak_alert_log: USING (false)
-- blocks all anon/authenticated access while the service role bypasses RLS.

ALTER TABLE public.disease_alert_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disease_alert_log_service_only"
  ON public.disease_alert_log
  FOR ALL
  USING (false);

CREATE POLICY "watchlist_alert_log_service_only"
  ON public.watchlist_alert_log
  FOR ALL
  USING (false);
