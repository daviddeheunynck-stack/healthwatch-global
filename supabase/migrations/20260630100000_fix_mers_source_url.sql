-- MERS-CoV row has a broken source URL (missing "-coronavirus-" in the slug).
-- Fix to the correct ECDC URL so the health-check link resolves.
UPDATE public.outbreaks
SET    source = 'https://www.ecdc.europa.eu/en/middle-east-respiratory-syndrome-coronavirus-mers-cov-situation-update'
WHERE  source = 'https://www.ecdc.europa.eu/en/middle-east-respiratory-syndrome-mers-cov-situation-update';
