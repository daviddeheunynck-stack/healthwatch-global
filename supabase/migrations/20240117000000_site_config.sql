-- Key-value store for internal cron state and site settings.
-- Only accessible via service role key (RLS enabled, no public policies).

CREATE TABLE IF NOT EXISTS site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

-- Seed: initial state for Mpox sitrep watcher
INSERT INTO site_config (key, value)
VALUES ('mpox_last_sitrep_url', '')
ON CONFLICT (key) DO NOTHING;
