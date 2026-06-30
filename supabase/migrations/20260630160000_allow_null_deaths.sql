-- Allow deaths to be NULL in the outbreaks table.
--
-- deaths = 0 and deaths = NULL are semantically different:
--   deaths = 0   → confirmed zero deaths (e.g. early outbreak, or source explicitly states 0)
--   deaths = NULL → death count not reported / unreliable in the source
--
-- Use cases:
--   - Mpox / DRC: WHO sitrep 67 explicitly flags DRC death data as incomplete
--     due to ongoing Bundibugyo response; the stored value (78) is not reliable.
--   - Yellow fever / Global: WHO DON-610 reports 95 cases but does not publish
--     a death count for the Jan–May 2026 period; 0 was a default, not a fact.
--
-- The DEFAULT 0 is preserved so that inserts without an explicit deaths value
-- still behave as before. Only explicit NULL writes will produce NULL.

ALTER TABLE public.outbreaks ALTER COLUMN deaths DROP NOT NULL;
