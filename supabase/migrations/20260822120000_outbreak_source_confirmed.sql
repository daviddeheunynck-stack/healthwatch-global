-- Distinguishes "no newer edition exists — the primary source was checked and
-- genuinely stopped publishing" from an ordinary reporting gap, on active
-- outbreak rows. Until now this fact only existed as a hardcoded
-- disease_en|country_en|date Set (VERIFIED_STALE, app/api/cron/data-quality/
-- route.ts) used solely to stop re-flagging the same row in an internal
-- email — the client-facing "⚠ NO UPDATE · Xd" badge (staleOutbreakDays,
-- lib/outbreaks.ts) and the sourceScore -0.5 penalty had no way to read it,
-- so a row confirmed current still displayed to visitors as "may be resolved
-- or unreported". Found 2026-08-21/22: 9 rows verified against their actual
-- primary source over two days (ea80fd4, c9377bf) carry exactly this
-- information and only a cron comment could see it.
--
-- Self-invalidating by design, same property the old Set had via its `date`
-- key: a row counts as confirmed only while `source_confirmed_at >= date`
-- (see isSourceConfirmed, lib/outbreaks.ts). The moment any cron legitimately
-- advances `date` with a real new bulletin, the comparison stops holding and
-- the row falls back to ordinary staleness handling — no cron needs to
-- explicitly clear this column, and an incidental touch that leaves `date`
-- unchanged (a QC edit, a locale backfill) can't invalidate it either.
alter table outbreaks
  add column if not exists source_confirmed_at timestamptz;

comment on column outbreaks.source_confirmed_at is
  'When the primary source was last opened and confirmed to carry no newer edition than `date`. Valid only while source_confirmed_at >= date; superseded automatically once date advances. NULL means never manually verified.';
