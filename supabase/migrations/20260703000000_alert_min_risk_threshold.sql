-- ── user_alert_regions.min_risk ──────────────────────────────────────────────
-- Lets a user cap regional alerts to a minimum severity (e.g. "high only")
-- instead of firing on every new outbreak regardless of risk level, which was
-- the single biggest driver of alert fatigue / notification opt-out.
-- NULL / 'low' both mean "no filter — send everything" (backward compatible
-- with every existing row, which had no threshold).

ALTER TABLE public.user_alert_regions
  ADD COLUMN IF NOT EXISTS min_risk TEXT NOT NULL DEFAULT 'low'
    CHECK (min_risk IN ('high','medium','low'));
