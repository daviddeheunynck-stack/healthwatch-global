-- description_fr/es/ar/id exist on production but were added directly via the
-- Supabase dashboard at some point, never through a migration. Backfilling the
-- migration history here so schema replays (e.g. a fresh dev/test project) match
-- reality. IF NOT EXISTS makes this a no-op anywhere the columns already exist.
alter table public.outbreaks
  add column if not exists description_fr text,
  add column if not exists description_es text,
  add column if not exists description_ar text,
  add column if not exists description_id text;
