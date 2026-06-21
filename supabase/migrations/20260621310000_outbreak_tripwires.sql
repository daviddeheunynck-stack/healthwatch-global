-- Per-outbreak case-threshold alert ("tripwire").
-- Fires once per threshold crossing (upward). Re-fires if cases drop below
-- then cross again (tracked via last_checked_cases).
CREATE TABLE IF NOT EXISTS public.outbreak_tripwires (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outbreak_id         TEXT        NOT NULL,
  threshold_cases     INT         NOT NULL CHECK (threshold_cases > 0),
  email               TEXT        NOT NULL,
  last_checked_cases  INT         NOT NULL DEFAULT 0,
  triggered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One tripwire per user per outbreak
CREATE UNIQUE INDEX IF NOT EXISTS tripwires_user_outbreak_idx
  ON public.outbreak_tripwires (user_id, outbreak_id);

CREATE INDEX IF NOT EXISTS tripwires_outbreak_idx
  ON public.outbreak_tripwires (outbreak_id);

ALTER TABLE public.outbreak_tripwires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_tripwires" ON public.outbreak_tripwires
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
