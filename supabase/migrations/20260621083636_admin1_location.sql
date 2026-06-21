-- Sub-national (admin1) location fields
-- admin1      : province / region / state / health-zone name (English)
-- admin1_lat  : geocoded latitude of admin1 location
-- admin1_lng  : geocoded longitude of admin1 location
-- Source: extracted via regex from WHO DON article text + Nominatim geocoding
ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS admin1     TEXT,
  ADD COLUMN IF NOT EXISTS admin1_lat FLOAT8,
  ADD COLUMN IF NOT EXISTS admin1_lng FLOAT8;
