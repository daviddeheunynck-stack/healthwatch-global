-- ── Enable Supabase Realtime for the outbreaks table ─────────────────────────
-- Required for RealtimeAlertFeed (Pro/Enterprise) to receive live INSERT/UPDATE
-- events via postgres_changes subscriptions.
--
-- REPLICA IDENTITY FULL ensures UPDATE payloads include the full new row,
-- not just the changed columns (default only tracks primary key).

ALTER TABLE public.outbreaks REPLICA IDENTITY FULL;

-- Add outbreaks to the supabase_realtime publication.
-- This is idempotent — safe to run if already added.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'outbreaks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outbreaks;
  END IF;
END $$;
