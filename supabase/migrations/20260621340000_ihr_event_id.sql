-- P1: IHR event tracking — link outbreak to a WHO IHR event reference
ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS ihr_event_id TEXT;

CREATE INDEX IF NOT EXISTS outbreaks_ihr_event_id_idx
  ON public.outbreaks (ihr_event_id)
  WHERE ihr_event_id IS NOT NULL;
