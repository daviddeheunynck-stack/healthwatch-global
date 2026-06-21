-- Clusters multi-pays : regroupe plusieurs foyers appartenant au même événement
ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS event_id UUID;

COMMENT ON COLUMN public.outbreaks.event_id IS
  'Regroupe les foyers appartenant au même événement multi-pays (ex: épidémie Ebola en RDC+Ouganda). NULL = foyer autonome.';

CREATE INDEX IF NOT EXISTS outbreaks_event_id_idx
  ON public.outbreaks (event_id)
  WHERE event_id IS NOT NULL;
