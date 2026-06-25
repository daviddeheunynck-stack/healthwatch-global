-- Track detection lead-time: how many days earlier ECDC/PAHO detected an outbreak
-- versus the official WHO DON publication date.
--
-- first_seen_at      : publication date of the FIRST source to report the outbreak
--                      (set at insert time from item.date for ECDC/PAHO rows)
-- who_don_published_at : WHO DON article date, recorded the first time sync-outbreaks
--                      matches a non-WHO-DON row via disease+country key
--
-- Delta (days earlier) = who_don_published_at - first_seen_at

ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS first_seen_at       DATE,
  ADD COLUMN IF NOT EXISTS who_don_published_at DATE;

-- Backfill: treat each existing row's publication date as first_seen_at
UPDATE public.outbreaks SET first_seen_at = date WHERE first_seen_at IS NULL;
