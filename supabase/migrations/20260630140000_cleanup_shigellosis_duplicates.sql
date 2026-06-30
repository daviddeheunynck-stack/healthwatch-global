-- Remove per-country Shigellosis rows that incorrectly hold the EU/EEA aggregate total.
-- The EU/EEA entry (id=bac370f5-...) is the only correct row — 2 300 cases is an EU-wide
-- figure from the ECDC epidemiological update, not attributable to individual member states.
-- The sync-ecdc-threats cron now writes a single EU/EEA row for multi-country EU articles.

DELETE FROM public.outbreaks
WHERE disease_en = 'Shigellosis'
  AND country_en IN (
    'Norway', 'Netherlands', 'France', 'Germany',
    'Belgium', 'Denmark', 'Ireland', 'Sweden'
  )
  AND cases = 2300
  AND date = '2026-05-20'
  AND source LIKE '%ecdc.europa.eu%';
