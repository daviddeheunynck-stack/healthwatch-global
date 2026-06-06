-- ── Multi-source corroboration flag (later removed) ──────────────────────────
-- Historical migration. The columns added here were subsequently dropped by
-- migration 20240114000000_remove_corroboration.sql. Retained for migration
-- replay ordering; net schema effect with the later migration is nil.

ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS corroborated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS outbreaks_corroborated_idx
  ON public.outbreaks (corroborated)
  WHERE corroborated = true;
