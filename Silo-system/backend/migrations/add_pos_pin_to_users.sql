-- Migration: Add POS PIN to business_users
-- Purpose: Enable quick PIN-based authentication for POS terminals
-- The PIN is used for screen unlock after idle timeout, not for initial login

-- Add pos_pin column (stores the plain PIN for display to owner)
ALTER TABLE business_users 
ADD COLUMN IF NOT EXISTS pos_pin VARCHAR(6);

-- Add pos_pin_hash column (stores bcrypt hash for verification)
ALTER TABLE business_users 
ADD COLUMN IF NOT EXISTS pos_pin_hash VARCHAR(255);

-- Create unique index: Each PIN must be unique within a business
-- This allows the same PIN to exist in different businesses
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pos_pin_per_business 
ON business_users(business_id, pos_pin) 
WHERE pos_pin IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN business_users.pos_pin IS 'POS PIN code (4-6 digits) for quick terminal authentication. Unique per business.';
COMMENT ON COLUMN business_users.pos_pin_hash IS 'Bcrypt hash of the POS PIN for secure verification.';


