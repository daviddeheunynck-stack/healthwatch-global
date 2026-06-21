CREATE TABLE IF NOT EXISTS public.org_activity_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  action     TEXT        NOT NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_activity_log_org_created_idx
  ON public.org_activity_log (org_id, created_at DESC);

ALTER TABLE public.org_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_activity" ON public.org_activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id    = org_activity_log.org_id
        AND om.user_id   = auth.uid()
        AND om.status    = 'active'
    )
  );

CREATE POLICY "org_members_insert_activity" ON public.org_activity_log
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id    = org_activity_log.org_id
        AND om.user_id   = auth.uid()
        AND om.status    = 'active'
    )
  );
