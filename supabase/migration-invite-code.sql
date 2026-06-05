-- Add invite_code to profit_sharing_config
-- Run this in Supabase SQL Editor

ALTER TABLE profit_sharing_config
ADD COLUMN IF NOT EXISTS invite_code VARCHAR(50) DEFAULT 'LUCI2024';

-- Set a default code if not already set
UPDATE profit_sharing_config
SET invite_code = 'LUCI2024'
WHERE invite_code IS NULL OR invite_code = '';
