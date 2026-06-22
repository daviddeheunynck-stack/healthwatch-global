ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_key UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_api_key
  ON profiles(api_key) WHERE api_key IS NOT NULL;
