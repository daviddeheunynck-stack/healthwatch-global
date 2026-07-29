-- ── Brevo blocklist visibility ────────────────────────────────────────────────
-- Discovered 2026-07-29: Brevo silently blocks a contact ("unsubscribedViaEmail"
-- via its own List-Unsubscribe header, or hardBounce) with zero trace in our DB.
-- regional-alerts kept upserting outbreak_alert_log as "sent" for two blocked
-- trial users because the log write happens before the Brevo call and its
-- failure isn't rolled back — so our own data claimed delivery that never
-- happened. This column, populated by the new sync-brevo-blocklist cron,
-- makes the block visible in profiles so sending crons can skip (and skip
-- logging) known-blocked addresses instead of writing false "sent" state.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_blocked_reason TEXT;
