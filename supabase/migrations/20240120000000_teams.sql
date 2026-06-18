-- ============================================================
-- HealthWatch Global — Team Accounts
-- ============================================================

-- ── teams ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_seats  INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── team_members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- ── team_invites ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  invited_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── team_id on profiles ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- ── indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON public.team_members (team_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS team_invites_token_idx   ON public.team_invites  (token);
CREATE INDEX IF NOT EXISTS team_invites_team_id_idx ON public.team_invites  (team_id);
CREATE INDEX IF NOT EXISTS profiles_team_id_idx     ON public.profiles      (team_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- teams: owner has full access; members can read
CREATE POLICY "teams_owner_all" ON public.teams
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "teams_member_read" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = id AND user_id = auth.uid()
    )
  );

-- team_members: own team members can read; owner can write
CREATE POLICY "team_members_read" ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "team_members_owner_write" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()
    )
  );

-- team_invites: all operations via service role (no user-level policies)
