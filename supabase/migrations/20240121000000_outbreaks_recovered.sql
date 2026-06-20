-- Add recovered column to outbreaks table
ALTER TABLE outbreaks ADD COLUMN IF NOT EXISTS recovered integer;
