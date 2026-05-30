-- ============================================================
-- HealthWatch Global — Initial Schema
-- ============================================================

-- ── outbreaks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.outbreaks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disease     TEXT NOT NULL,
  disease_en  TEXT,
  disease_ar  TEXT,
  country     TEXT NOT NULL,
  country_en  TEXT,
  country_ar  TEXT,
  region      TEXT NOT NULL,
  lat         FLOAT8 NOT NULL,
  lng         FLOAT8 NOT NULL,
  cases       INTEGER NOT NULL DEFAULT 0,
  deaths      INTEGER NOT NULL DEFAULT 0,
  risk_level  TEXT NOT NULL,
  date        DATE NOT NULL,
  source      TEXT NOT NULL,
  description TEXT NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  is_seed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                   TEXT,
  plan                    TEXT DEFAULT 'free',
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── subscriptions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  region     TEXT NOT NULL DEFAULT 'allRegions',
  locale     TEXT DEFAULT 'fr',
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auto-create profile on signup ────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_outbreaks_updated_at ON public.outbreaks;
CREATE TRIGGER set_outbreaks_updated_at
  BEFORE UPDATE ON public.outbreaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.outbreaks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- outbreaks : lecture publique
CREATE POLICY "outbreaks_public_read" ON public.outbreaks
  FOR SELECT USING (true);

-- profiles : lecture/écriture sur son propre profil uniquement
CREATE POLICY "profiles_own_read" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- subscriptions : service role uniquement (pas de RLS utilisateur)
CREATE POLICY "subscriptions_service_only" ON public.subscriptions
  USING (false);
