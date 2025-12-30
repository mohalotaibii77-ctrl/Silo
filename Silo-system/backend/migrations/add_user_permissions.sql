-- Add permissions column to business_users table
-- This stores granular permissions for manager/employee roles
-- Used by Business-App to control feature access

ALTER TABLE business_users
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN business_users.permissions IS 'User permissions JSON: { orders, menu_edit, inventory, delivery, tables, drivers, discounts }';

-- Update existing managers to have all permissions by default
UPDATE business_users 
SET permissions = '{
  "orders": true,
  "menu_edit": true,
  "inventory": true,
  "delivery": true,
  "tables": true,
  "drivers": true,
  "discounts": true
}'::jsonb
WHERE role = 'manager' AND (permissions IS NULL OR permissions = '{}'::jsonb);

-- Update existing employees to have no permissions by default
UPDATE business_users 
SET permissions = '{
  "orders": false,
  "menu_edit": false,
  "inventory": false,
  "delivery": false,
  "tables": false,
  "drivers": false,
  "discounts": false
}'::jsonb
WHERE role = 'employee' AND (permissions IS NULL OR permissions = '{}'::jsonb);





