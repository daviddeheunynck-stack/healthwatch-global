-- Pre-confirmation early-warning signals.
-- Separate from confirmed outbreaks — shown with heavy "NOT FOR CITATION" labeling.
-- Sources: ReliefWeb (automated cron), user submissions (Pro+).
CREATE TABLE IF NOT EXISTS public.signals (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  headline     TEXT    NOT NULL,
  source_url   TEXT    UNIQUE,                   -- deduplication key
  source_name  TEXT    NOT NULL DEFAULT 'user',  -- 'ReliefWeb' | 'user' | etc.
  disease_hint TEXT,
  country_hint TEXT,
  region       TEXT,
  signal_date  DATE,
  confidence   INTEGER NOT NULL DEFAULT 30 CHECK (confidence BETWEEN 0 AND 100),
  votes_up     INTEGER NOT NULL DEFAULT 0,
  votes_down   INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  submitted_by UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  outbreak_id  UUID    REFERENCES public.outbreaks(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX signals_status_date_idx ON public.signals (status, signal_date DESC);
CREATE INDEX signals_region_idx      ON public.signals (region) WHERE region IS NOT NULL;

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- Anyone (Pro+, enforced at API level) can read pending/confirmed signals
CREATE POLICY "signals_read" ON public.signals
  FOR SELECT USING (status IN ('pending', 'confirmed'));

-- Pro+ users can insert their own signals (service role handles cron inserts)
CREATE POLICY "signals_insert" ON public.signals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Upvote/downvote counter updates via service role only (no direct user UPDATE)
