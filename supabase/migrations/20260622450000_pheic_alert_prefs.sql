-- Allow Pro users to opt-out of PHEIC alert emails.
-- Default: true (all Pro users notified when a new PHEIC is declared).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pheic_alerts BOOLEAN DEFAULT true;
