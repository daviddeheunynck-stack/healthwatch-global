-- Let Pro users choose a region for their weekly auto-digest email.
-- 'all' = global digest (default), any other value = regional digest.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS digest_region TEXT DEFAULT 'all'
    CHECK (digest_region IN ('all', 'africa', 'asia', 'americas', 'europe', 'oceania'));
