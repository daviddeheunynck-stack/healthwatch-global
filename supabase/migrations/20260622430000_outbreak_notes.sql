-- Add missing DELETE policy so users can remove their own notes.
-- The table was created in 20260621130000_outbreak_notes.sql without one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'outbreak_notes'
      AND policyname = 'notes_delete_own'
  ) THEN
    EXECUTE 'CREATE POLICY notes_delete_own ON public.outbreak_notes
             FOR DELETE USING (user_id = auth.uid())';
  END IF;
END;
$$;
