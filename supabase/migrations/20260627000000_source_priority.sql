-- Add source_priority to outbreaks table.
-- Higher value = more authoritative source — never overwrite with lower priority.
-- 0  = unknown / seed
-- 3  = WHO DON (disease-outbreak-news)
-- 5  = WHO AFRO / WHO EMRO / ECDC / PAHO / Africa CDC
-- 10 = National ministry sitrep (INSP-RDC, MoH Uganda, etc.)

ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS source_priority SMALLINT NOT NULL DEFAULT 0;

-- Backfill existing rows
UPDATE public.outbreaks
SET source_priority = 3
WHERE source ILIKE '%who.int/emergencies/disease-outbreak-news%';

UPDATE public.outbreaks
SET source_priority = 5
WHERE source ILIKE '%afro.who.int%'
   OR source ILIKE '%emro.who.int%'
   OR source ILIKE '%ecdc.europa.eu%'
   OR source ILIKE '%paho.org%'
   OR source ILIKE '%africacdc.org%'
   OR source ILIKE '%africacdc.org%';

UPDATE public.outbreaks
SET source_priority = 10
WHERE source ILIKE '%insp.cd%'
   OR source ILIKE '%minsante.cd%'
   OR source ILIKE '%health.go.ug%';
