-- Migration: Add password_changed column to business_users table
-- This tracks whether the user has changed their default password

-- Add the column with default false (meaning password has not been changed)
ALTER TABLE business_users 
ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT false;

-- Existing users who have logged in before can be assumed to have changed their password
-- (This is a conservative approach - new users will definitely have password_changed = false)
UPDATE business_users 
SET password_changed = true 
WHERE last_login IS NOT NULL;

COMMENT ON COLUMN business_users.password_changed IS 'Tracks whether user has changed their default password. False means they need to set a new password on first login.';







