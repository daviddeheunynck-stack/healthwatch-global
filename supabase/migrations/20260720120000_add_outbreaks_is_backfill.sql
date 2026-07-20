-- Add is_backfill to outbreaks table.
--
-- Distinguishes rows created by a live poll of a recurring/current bulletin
-- feed (is_backfill=false, the overwhelming majority) from rows created by
-- ingesting a source that is itself a historical/cumulative archive rather
-- than a "what's happening right now" feed (is_backfill=true). This is set
-- explicitly at INSERT time by each sync-* cron — it is never inferred
-- after the fact from a row's `date` value, because an old `date` at
-- insertion time can also mean a genuine pipeline catch-up delay on an
-- otherwise-live source (see sync-outbreaks' WHO DON cold-start behaviour),
-- which must NOT be mislabeled as backfill.
--
-- Distinct from `is_seed` (manually-curated rows, or WHO GHO annual
-- reference indicators flagged by sync-who-regional) — a future reader
-- computing e.g. reporting lag must exclude rows where EITHER flag is true,
-- not conflate the two into one column.

ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS is_backfill BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.outbreaks.is_backfill IS
  'True only for rows whose source is itself a historical/cumulative archive (e.g. USDA APHIS crosstab), set at insert time by the owning cron. Never inferred from date vs created_at after the fact.';

-- Backfill existing rows: the confirmed case is USDA APHIS's cumulative
-- HPAI crosstab (every premises ever confirmed since 2024, not a
-- currently-active list — see app/api/cron/sync-usda-aphis/route.ts,
-- SOURCE_PREFIX). These rows were inserted 2026-07-11 with real historical
-- dates (2024-04 through 2025-12) alongside a same-millisecond created_at,
-- which is what surfaced this whole is_backfill investigation.
UPDATE public.outbreaks
SET is_backfill = TRUE
WHERE source LIKE 'https://www.aphis.usda.gov/hpai-h5n1#%'
  AND is_backfill = FALSE;

-- Second confirmed case: WHO GHO annual reference indicators ingested by
-- sync-who-regional (malaria/measles/polio/yellow-fever/leishmaniasis/
-- diphtheria estimates) — an annual estimate 1-2 years stale by design
-- (date always YYYY-01-01), not a time-limited outbreak event. The cron
-- already marks these `active: false`; verified against dev on 2026-07-20
-- that ALL 91 such rows match `date` ending in "-01-01" with zero
-- exceptions, and only 31/91 also have `is_seed = true` — so `is_seed`
-- alone would miss most of them. Matched by source + date pattern, not by
-- is_seed, since is_seed's meaning predates and is broader than this flag.
UPDATE public.outbreaks
SET is_backfill = TRUE
WHERE source ILIKE '%who.int/data/gho/data/indicators%'
  AND date::text LIKE '%-01-01'
  AND is_backfill = FALSE;
