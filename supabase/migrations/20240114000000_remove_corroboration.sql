-- ── Remove corroboration column ──────────────────────────────────────────────
-- Drops the corroboration column added by 20240110. The index on it is
-- removed automatically with the column.

ALTER TABLE public.outbreaks DROP COLUMN IF EXISTS corroborated;
