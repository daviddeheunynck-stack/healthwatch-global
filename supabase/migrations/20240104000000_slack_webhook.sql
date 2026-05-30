-- Add Slack (or Teams) incoming webhook URL to user profiles.
-- NULL = no Slack integration configured.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;
