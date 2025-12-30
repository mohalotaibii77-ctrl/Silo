-- Migration: Update purchase_orders status check constraint to include 'delivered'
-- This simplifies the status flow to: pending -> delivered -> cancelled

-- Drop the existing constraint
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Add new constraint with 'delivered' status (keeping legacy statuses for backwards compatibility)
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check 
  CHECK (status IN ('draft', 'pending', 'delivered', 'cancelled', 'approved', 'ordered', 'partial', 'received'));

-- Update any existing 'received' status to 'delivered' for consistency
UPDATE purchase_orders SET status = 'delivered' WHERE status = 'received';








