-- Workflow de réponse structuré — 5 étapes traçables avec responsable
CREATE TABLE IF NOT EXISTS public.outbreak_workflow (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  outbreak_id       UUID        NOT NULL REFERENCES public.outbreaks(id) ON DELETE CASCADE,
  step              TEXT        NOT NULL CHECK (step IN (
    'investigation',
    'lab_confirmation',
    'ihr_notification',
    'measures_deployed',
    'closed'
  )),
  responsible_email TEXT        CHECK (char_length(responsible_email) <= 255),
  notes             TEXT        CHECK (char_length(notes) <= 500),
  completed_by      UUID        REFERENCES auth.users(id),
  completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.outbreak_workflow ENABLE ROW LEVEL SECURITY;

-- Any authenticated Pro/Team/Enterprise user can read all steps (team transparency)
CREATE POLICY "auth_read_workflow" ON public.outbreak_workflow
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can mark steps they own
CREATE POLICY "users_insert_workflow" ON public.outbreak_workflow
  FOR INSERT WITH CHECK (completed_by = auth.uid());

-- Users can undo only their own steps
CREATE POLICY "users_delete_workflow" ON public.outbreak_workflow
  FOR DELETE USING (completed_by = auth.uid());

CREATE INDEX IF NOT EXISTS workflow_outbreak_step_idx
  ON public.outbreak_workflow (outbreak_id, step);
