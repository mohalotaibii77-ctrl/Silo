-- Add kitchen_display role to business_users table
-- This migration updates the role check constraint to include kitchen_display

-- Drop the existing constraint
ALTER TABLE business_users DROP CONSTRAINT IF EXISTS business_users_role_check;

-- Add the updated constraint with kitchen_display role
ALTER TABLE business_users ADD CONSTRAINT business_users_role_check 
CHECK (role IN ('owner', 'manager', 'employee', 'pos', 'kitchen_display'));



