-- Add user settings columns to business_users table
-- These store per-user preferences that persist across devices

ALTER TABLE business_users
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS preferred_theme VARCHAR(20) DEFAULT 'system',
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Add comment explaining the columns
COMMENT ON COLUMN business_users.preferred_language IS 'User preferred language (en, ar, etc.)';
COMMENT ON COLUMN business_users.preferred_theme IS 'User preferred theme (light, dark, system)';
COMMENT ON COLUMN business_users.settings IS 'Additional user settings as JSON (for future extensibility)';










