ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disease_watchlist TEXT[] NOT NULL DEFAULT '{}';
