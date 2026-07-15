-- Tracks the plan a user had before joining a team, so team/members removal
-- can restore it correctly instead of reading profiles.plan after it has
-- already been overwritten to "team" by team/accept. See
-- app/api/team/accept/route.ts and app/api/team/members/route.ts.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pre_team_plan TEXT;
