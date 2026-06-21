-- P1: verification status (suspected → under_investigation → confirmed → closed)
-- P3: response phase (monitoring → investigating → active_response → contained)
ALTER TABLE public.outbreaks
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'suspected'
    CHECK (verification_status IN ('suspected', 'under_investigation', 'confirmed', 'closed')),
  ADD COLUMN IF NOT EXISTS response_phase TEXT NOT NULL DEFAULT 'monitoring'
    CHECK (response_phase IN ('monitoring', 'investigating', 'active_response', 'contained'));

CREATE INDEX IF NOT EXISTS outbreaks_vstatus_idx ON public.outbreaks (verification_status);
CREATE INDEX IF NOT EXISTS outbreaks_rphase_idx  ON public.outbreaks (response_phase);
