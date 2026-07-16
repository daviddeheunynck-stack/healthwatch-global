-- Remove the MERS-CoV/DR Congo row created by the sync-ecdc-threats cron: a
-- sidebar/nav link on ECDC's "MERS-CoV worldwide overview" page (a global
-- rollup bulletin with zero DR Congo-specific content) was picked up by the
-- body-text country fallback scan and misattributed the worldwide total
-- (2 649 cases / 960 deaths) to DR Congo. MERS-CoV is Arabian-Peninsula
-- endemic; DR Congo has no known connection to it. Exact duplicate of the
-- separate legitimate "Global" MERS-CoV row.
--
-- Previously only deactivated (20260628000000_deactivate_bad_ecdc_rows.sql)
-- without a root-cause code fix; an unrelated broad update
-- (20260630100000_fix_mers_source_url.sql) then incidentally bumped
-- updated_at, which kept resurrecting the row on public disease pages via
-- isDisplayActive()'s 60-day recency fallback. Root cause now fixed in
-- app/api/cron/sync-ecdc-threats/route.ts (extractItemData skips any
-- "X worldwide overview" article entirely instead of falling back to a
-- body-text country scan). Deleting for good this time, matching
-- 20260630150000_cleanup_ebola_artifacts.sql's precedent for the same bug
-- family.
--
-- Row was active=false, source_priority=5 — deleted via REST API on
-- 2026-07-16. This migration documents the cleanup for schema history.
-- (Row already deleted; the DELETE below is a no-op if run again.)

DELETE FROM public.outbreaks
WHERE id = '6dc280fc-032e-4aae-b9c4-64ba2a991a5c';  -- MERS-CoV / DR Congo / 2 649 cases (ECDC sidebar artifact)
