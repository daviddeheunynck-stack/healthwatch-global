CREATE TABLE country_risk_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_en    TEXT NOT NULL,
  min_risk      TEXT NOT NULL DEFAULT 'high' CHECK (min_risk IN ('high', 'medium', 'low')),
  email         TEXT NOT NULL,
  last_fired_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE country_risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own country_risk_alerts"
  ON country_risk_alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_country_risk_alerts_user ON country_risk_alerts(user_id);
