-- Deactivate two artefact rows created by the ECDC scraper detecting "DRC"
-- from ECDC page sidebars (navigation links to the Ebola/DRC article) rather
-- than from the actual article body.
--
-- MERS-CoV occurs in the Middle East, not DR Congo.
-- Hantavirus/DR Congo was inserted from the same sidebar-detection bug;
-- the legitimate cruise-ship entry is Hantavirus/Plusieurs pays (handled by QC fix).

UPDATE outbreaks
SET active = false
WHERE disease_en ILIKE '%mers%'
  AND country_en = 'DR Congo'
  AND source LIKE '%ecdc.europa.eu%';

UPDATE outbreaks
SET active = false
WHERE disease_en ILIKE '%hantavirus%'
  AND country_en = 'DR Congo'
  AND source LIKE '%ecdc.europa.eu%';
