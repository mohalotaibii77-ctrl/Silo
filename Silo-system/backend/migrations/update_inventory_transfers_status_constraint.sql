-- Update inventory_transfers status constraint to include all valid statuses
-- Valid statuses: pending, received, cancelled

-- Drop the old constraint
ALTER TABLE inventory_transfers DROP CONSTRAINT IF EXISTS inventory_transfers_status_check;

-- Add the new constraint with all valid statuses
ALTER TABLE inventory_transfers ADD CONSTRAINT inventory_transfers_status_check 
  CHECK (status IN ('pending', 'received', 'cancelled'));








