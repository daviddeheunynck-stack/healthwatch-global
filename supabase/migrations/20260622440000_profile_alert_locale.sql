ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS alert_locale TEXT DEFAULT 'en'
    CHECK (alert_locale IN ('en', 'fr', 'es', 'ar', 'id'));
