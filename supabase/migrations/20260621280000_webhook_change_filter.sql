-- P1: Alert fatigue filter — track last-fired case counts + risk per outbreak,
-- and add min_change_pct to webhook filters (stored in the JSON filters column).
ALTER TABLE public.webhooks
  ADD COLUMN IF NOT EXISTS last_fired_cases JSONB NOT NULL DEFAULT '{}';
