-- ── App settings key/value store ──────────────────────────────────────────────
-- Discovered 2026-08-02: this table already exists in production (used by
-- resolveAnthropicKey() in lib/geo-extract-llm.ts and app/api/admin/check-env
-- as the fallback source for ANTHROPIC_API_KEY when it isn't set as a Vercel
-- env var) but was never captured by a migration — the repo silently drifted
-- from prod. Schema below matches prod exactly (verified via the PostgREST
-- OpenAPI schema with the service role key): key/value both NOT NULL, key is
-- the primary key, created_at defaults to now(). This migration does not and
-- must not set any value — it only documents structure so a freshly created
-- environment (dev, preview, a restore) ends up with the right shape instead
-- of silently falling back to "" and returning null geocoding results.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: no direct public access — only service role reads/writes (same pattern
-- as outbreak_snapshots). Confirmed against prod: the anon key gets HTTP 200
-- with 0 rows despite the table holding data, i.e. RLS enabled, zero policies.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
