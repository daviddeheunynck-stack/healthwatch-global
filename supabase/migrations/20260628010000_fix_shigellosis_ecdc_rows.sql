-- Deactivate per-country Shigellosis rows created with the total EU/EEA case
-- count (2300) applied to each individual country — data is misleading.
-- The next ECDC sync (Friday) will insert a single correct EU/EEA row instead.

UPDATE outbreaks
SET active = false
WHERE disease_en ILIKE '%shigel%'
  AND source LIKE '%ecdc.europa.eu%'
  AND country_en IN (
    'Norway', 'Netherlands', 'Germany', 'Belgium',
    'Denmark', 'Ireland', 'France', 'Sweden',
    'Spain', 'Luxembourg'
  );
