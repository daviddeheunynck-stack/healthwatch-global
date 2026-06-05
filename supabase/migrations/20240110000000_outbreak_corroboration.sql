-- ── Multi-source corroboration flag ──────────────────────────────────────────
-- When both WHO DON and ProMED report the same outbreak, the record is
-- marked as corroborated. Professionals can use this as a confidence signal:
--   corroborated = false → WHO only (authoritative but may lag)
--   corroborated = true  → WHO + ProMED (faster confirmation, higher confidence)

ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS corroborated  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promed_source TEXT;              -- ProMED article URL when applicable

-- Index for filtering corroborated outbreaks
CREATE INDEX IF NOT EXISTS outbreaks_corroborated_idx
  ON public.outbreaks (corroborated)
  WHERE corroborated = true;
