-- Migration: Add unique constraint on username within business (case-insensitive)
-- This prevents duplicate usernames within the same business at the database level
-- Note: Uses LOWER() for case-insensitive uniqueness to match login behavior

-- Create a unique index on (business_id, LOWER(username))
-- This ensures "John" and "john" are treated as duplicates within the same business
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_users_unique_username 
ON business_users (business_id, LOWER(username));

-- Add a comment explaining the constraint
COMMENT ON INDEX idx_business_users_unique_username IS 'Ensures usernames are unique within a business (case-insensitive)';


