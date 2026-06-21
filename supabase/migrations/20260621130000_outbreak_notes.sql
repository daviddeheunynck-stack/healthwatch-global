-- Collaborative annotations on outbreaks.
-- Pro users: private notes (team_id IS NULL).
-- Team users: shared notes visible to all team members (team_id set).
CREATE TABLE IF NOT EXISTS public.outbreak_notes (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  outbreak_id UUID    NOT NULL REFERENCES public.outbreaks(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id     UUID    REFERENCES public.teams(id) ON DELETE CASCADE,
  note        TEXT    NOT NULL CHECK (char_length(note) <= 1000),
  status      TEXT    CHECK (status IN ('monitoring', 'investigating', 'closed')),
  author_email TEXT   NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX outbreak_notes_outbreak_idx ON public.outbreak_notes (outbreak_id, created_at DESC);
CREATE INDEX outbreak_notes_team_idx     ON public.outbreak_notes (team_id)    WHERE team_id IS NOT NULL;
CREATE INDEX outbreak_notes_user_idx     ON public.outbreak_notes (user_id);

ALTER TABLE public.outbreak_notes ENABLE ROW LEVEL SECURITY;

-- Own notes always visible
CREATE POLICY "notes_own_read" ON public.outbreak_notes
  FOR SELECT USING (user_id = auth.uid());

-- Team notes visible to all members of the same team
CREATE POLICY "notes_team_read" ON public.outbreak_notes
  FOR SELECT USING (
    team_id IS NOT NULL AND
    team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid())
  );

-- Users can insert their own notes only
CREATE POLICY "notes_insert" ON public.outbreak_notes
  FOR INSERT WITH CHECK (user_id = auth.uid());
