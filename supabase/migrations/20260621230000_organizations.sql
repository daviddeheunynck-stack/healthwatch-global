-- Team workspace: organizations + members
CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  owner_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email  TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  invite_token   TEXT        UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations: owner can do all; active members can read
CREATE POLICY "org_owner_all"    ON public.organizations FOR ALL     USING (owner_id = auth.uid());
CREATE POLICY "org_member_read"  ON public.organizations FOR SELECT  USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = organizations.id AND user_id = auth.uid() AND status = 'active'
  )
);

-- Members: members of same org can read; owner can insert/delete
CREATE POLICY "org_members_read" ON public.organization_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.organization_members om2
    WHERE om2.org_id = organization_members.org_id
      AND om2.user_id = auth.uid()
      AND om2.status = 'active'
  )
);
CREATE POLICY "org_owner_manage_members" ON public.organization_members FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_members.org_id AND owner_id = auth.uid()
  )
);
-- Allow invitees to update their own pending membership (to accept)
CREATE POLICY "member_accept_own" ON public.organization_members FOR UPDATE USING (
  invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR user_id = auth.uid()
);

-- Shared signal investigations for org members (read + insert)
CREATE POLICY "org_members_share_investigations"
  ON public.signal_investigations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om1
      WHERE om1.user_id = signal_investigations.user_id AND om1.status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.organization_members om2
          WHERE om2.org_id = om1.org_id AND om2.user_id = auth.uid() AND om2.status = 'active'
        )
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS org_members_user_idx   ON public.organization_members (user_id, status);
CREATE INDEX IF NOT EXISTS org_members_org_idx    ON public.organization_members (org_id, status);
CREATE INDEX IF NOT EXISTS org_members_token_idx  ON public.organization_members (invite_token);
CREATE INDEX IF NOT EXISTS org_members_email_idx  ON public.organization_members (invited_email);
