-- Remove two incorrect Ebola entries created by the sync-ecdc-threats cron:
--
-- 1. Germany / 1 155 cases: The ECDC article on DRC+Uganda outbreak mentions
--    Germany in its risk-assessment section; extractNumbers captured the DRC
--    cumulative total (1 155 at the time) and the cron attributed it to Germany.
--    Germany has never had a community Ebola outbreak.
--
-- 2. "Ebola virus disease (Bundibugyo)" / DR Congo / 896 cases (2026-06-17):
--    Stale WHO DON entry superseded by the active row at 1 274 cases.
--    Disease name variant could cause duplicate display in the dashboard.
--
-- Both rows were active=false, source_priority<=5 — deleted via REST API on
-- 2026-06-30. This migration documents the cleanup for schema history.
-- (Rows already deleted; the DELETE below is a no-op if run again.)

DELETE FROM public.outbreaks
WHERE id IN (
  '533393ea-0954-4737-90ce-564fba51bb7c',  -- Ebola / Germany / 1 155 cases (ECDC artifact)
  '50b2900d-d45f-4030-8503-76a62ceedbdd'   -- Ebola (Bundibugyo) / DR Congo / 896 cases (stale)
);
