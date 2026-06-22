CREATE TABLE IF NOT EXISTS geofence_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT 'Zone',
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  radius_km     INTEGER NOT NULL DEFAULT 500,
  email         TEXT NOT NULL,
  last_fired_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE geofence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own geofence_alerts"
  ON geofence_alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_geofence_alerts_user ON geofence_alerts(user_id);
