-- Migration: Update PO Receiving Workflow
-- Date: 2025-12-15
-- Description: 
--   1. Add invoice_image_url to purchase_orders for invoice attachment
--   2. Add variance_reason and variance_note to purchase_order_items for discrepancy tracking
--   3. Make unit_cost and total_cost nullable (prices entered at receive, not create)

-- Add invoice image URL to purchase_orders
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS invoice_image_url TEXT NULL;

-- Add variance tracking fields to purchase_order_items
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS variance_reason VARCHAR(20) NULL;

ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS variance_note TEXT NULL;

-- Make unit_cost and total_cost nullable (prices entered at receive, not create)
ALTER TABLE purchase_order_items 
ALTER COLUMN unit_cost DROP NOT NULL;

ALTER TABLE purchase_order_items 
ALTER COLUMN total_cost DROP NOT NULL;

-- Set defaults for unit_cost and total_cost
ALTER TABLE purchase_order_items 
ALTER COLUMN unit_cost SET DEFAULT 0;

ALTER TABLE purchase_order_items 
ALTER COLUMN total_cost SET DEFAULT 0;

-- Add comments explaining fields
COMMENT ON COLUMN purchase_order_items.variance_reason IS 'Reason for under-receiving: missing, canceled, rejected';
COMMENT ON COLUMN purchase_order_items.variance_note IS 'Justification note required when over-receiving';
COMMENT ON COLUMN purchase_orders.invoice_image_url IS 'URL to uploaded vendor invoice image';







