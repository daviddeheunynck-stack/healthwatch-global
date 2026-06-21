-- Persistent dashboard display preferences per user.
-- Stores { region, country } so the table auto-applies on next load.
-- Only meaningful for Pro/Team/Enterprise (enforced at API level).
alter table profiles
  add column if not exists display_filters jsonb default null;
