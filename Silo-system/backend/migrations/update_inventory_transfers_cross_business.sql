-- =============================================
-- INVENTORY TRANSFERS - CROSS-BUSINESS SUPPORT
-- Allows owners to transfer between their businesses
-- =============================================

-- Add columns for cross-business transfers
ALTER TABLE inventory_transfers
ADD COLUMN IF NOT EXISTS from_business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS to_business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE;

-- Add received_by column (renamed from approved_by for clarity)
ALTER TABLE inventory_transfers
ADD COLUMN IF NOT EXISTS received_by INTEGER REFERENCES business_users(id);

-- Update existing records to have from_business_id = business_id and to_business_id = business_id
UPDATE inventory_transfers 
SET from_business_id = business_id, to_business_id = business_id 
WHERE from_business_id IS NULL OR to_business_id IS NULL;

-- Create indexes for cross-business queries
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from_business ON inventory_transfers(from_business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to_business ON inventory_transfers(to_business_id);

-- Update existing statuses to match new schema (only pending and received)
UPDATE inventory_transfers SET status = 'pending' WHERE status IN ('draft', 'in_transit', 'approved');
UPDATE inventory_transfers SET status = 'received' WHERE status = 'completed';

-- Add transfer_cancel to inventory_movements movement_type
-- Note: PostgreSQL doesn't allow easy modification of CHECK constraints
-- Run these commands manually if needed:
-- ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;
-- ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check 
--   CHECK (movement_type IN (
--     'purchase_receive', 'purchase_return',
--     'transfer_out', 'transfer_in', 'transfer_cancel',
--     'sale', 'sale_return',
--     'adjustment_add', 'adjustment_remove',
--     'count_adjustment', 'waste', 'damage', 'expiry'
--   ));

-- Add comment explaining the cross-business transfer feature
COMMENT ON COLUMN inventory_transfers.from_business_id IS 'Source business for the transfer (can be different from to_business_id for cross-business transfers)';
COMMENT ON COLUMN inventory_transfers.to_business_id IS 'Destination business for the transfer';
COMMENT ON COLUMN inventory_transfers.business_id IS 'The business that initiated the transfer (owner perspective)';
COMMENT ON COLUMN inventory_transfers.received_by IS 'User who marked the transfer as received';


