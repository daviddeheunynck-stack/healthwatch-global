-- GHO annual data rows were inserted as is_seed=false, making them vulnerable to
-- stale deactivation by sync-outbreaks (STALE_DAYS=60). Since their date is annual
-- (e.g. 2024-01-01), they get cycled out daily, creating duplicates.
--
-- Fix: deactivate all existing GHO rows so the cron re-inserts them with is_seed=true
-- (the code fix ships with this migration). The WHERE clause targets rows by their
-- GHO source URL pattern.

UPDATE public.outbreaks
SET    active = false
WHERE  source LIKE 'https://ghoapi.azureedge.net/%'
    OR source LIKE '%gho/data/indicators/indicator-details/GHO/%'
    OR source LIKE '%who.int/data/gho/%';
