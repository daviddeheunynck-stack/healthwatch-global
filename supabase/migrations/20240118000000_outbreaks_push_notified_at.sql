ALTER TABLE public.outbreaks ADD COLUMN IF NOT EXISTS push_notified_at TIMESTAMPTZ;
