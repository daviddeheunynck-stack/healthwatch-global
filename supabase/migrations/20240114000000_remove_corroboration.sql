-- ── Remove ProMED corroboration columns ──────────────────────────────────────
-- The multi-source corroboration feature (WHO + ProMED) has been removed.
-- These columns are dropped entirely.

ALTER TABLE public.outbreaks DROP COLUMN IF EXISTS corroborated;
ALTER TABLE public.outbreaks DROP COLUMN IF EXISTS promed_source;
