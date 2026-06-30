-- Ebola disease (Bundibugyo virus) declared PHEIC on 2026-05-17.
-- Source: ECDC epidemiological update, last updated 2026-06-29 13:10 UTC.
-- DRC: 1,274 confirmed cases / 360 deaths as of 2026-06-29.
-- Uganda: 20 confirmed cases / 2 deaths as of 2026-06-29.

-- 1. Update Ebola DRC row (source_priority 10 = PHEIC, never overwritten by automated crons)
UPDATE public.outbreaks
SET
  cases           = 1274,
  deaths          = 360,
  date            = '2026-06-29',
  source          = 'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
  description     = 'Ebola disease (Bundibugyo virus) PHEIC — As of 29 June 2026, 1,274 confirmed cases and 360 deaths in the DRC. WHO declared Public Health Emergency of International Concern on 17 May 2026. Source: ECDC epidemiological update.',
  risk_level      = 'high',
  active          = true,
  source_priority = 10,
  updated_at      = NOW()
WHERE
  LOWER(disease_en) LIKE '%ebola%'
  AND LOWER(country_en) LIKE '%congo%'
  AND active = true;

-- 2. Insert Uganda entry if it doesn't already exist
INSERT INTO public.outbreaks (
  disease, disease_en, disease_ar,
  country, country_en, country_ar,
  region, lat, lng,
  cases, deaths,
  risk_level,
  date, source, description,
  active, source_priority,
  updated_at
)
SELECT
  'Ébola', 'Ebola', 'إيبولا',
  'Ouganda', 'Uganda', 'أوغندا',
  'africa', 1.3733, 32.2903,
  20, 2,
  'critical',
  '2026-06-29',
  'https://www.ecdc.europa.eu/en/ebola-outbreak-democratic-republic-congo-and-uganda',
  'Ebola disease (Bundibugyo virus) PHEIC — As of 29 June 2026, 20 confirmed cases and 2 deaths in Uganda, linked to the ongoing DRC outbreak. WHO PHEIC declared 17 May 2026. Source: ECDC epidemiological update.',
  true, 10,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.outbreaks
  WHERE LOWER(disease_en) LIKE '%ebola%'
    AND LOWER(country_en) = 'uganda'
    AND active = true
);
