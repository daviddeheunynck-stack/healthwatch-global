-- ── PHEIC flag ────────────────────────────────────────────────────────────────
-- PHEIC = Public Health Emergency of International Concern (USPPI en français)
-- Declared by WHO Director-General — the highest level of global health alert.
-- Set manually by admin when WHO makes an official declaration.

ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS is_pheic BOOLEAN NOT NULL DEFAULT false;

-- Index for fast PHEIC filtering
CREATE INDEX IF NOT EXISTS outbreaks_pheic_idx
  ON public.outbreaks (is_pheic)
  WHERE is_pheic = true;

-- Current active PHEIC: Mpox Clade Ib (declared August 2024)
-- Update the matching outbreak if it exists
UPDATE public.outbreaks
SET    is_pheic = true
WHERE  active = true
  AND  LOWER(disease_en) LIKE '%mpox%';
