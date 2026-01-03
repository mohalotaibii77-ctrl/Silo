-- =====================================================
-- MIGRATION: PO Counting Workflow & Item Barcodes
-- =====================================================
-- This migration adds:
-- 1. item_barcodes table for barcode-to-item mapping
-- 2. Updates PO status constraint to include 'counted'
-- 3. Adds barcode_scanned column to purchase_order_items
-- =====================================================

-- ==================== ITEM BARCODES TABLE ====================
-- Store barcode-to-item mappings (one barcode per item)
-- When a barcode is scanned during PO counting, it gets associated with an item

CREATE TABLE IF NOT EXISTS item_barcodes (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    barcode VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES business_users(id) ON DELETE SET NULL,
    
    -- Each barcode must be unique globally
    CONSTRAINT item_barcodes_barcode_unique UNIQUE (barcode),
    -- Each item can only have one barcode
    CONSTRAINT item_barcodes_item_unique UNIQUE (item_id)
);

-- Index for fast barcode lookups
CREATE INDEX IF NOT EXISTS idx_item_barcodes_barcode ON item_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_item_barcodes_item ON item_barcodes(item_id);

-- ==================== UPDATE PO STATUS CONSTRAINT ====================
-- Add 'counted' status to the purchase_orders status constraint
-- Flow: pending -> counted -> received (or pending -> cancelled)

-- First, drop the existing constraint
ALTER TABLE purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Add new constraint with 'counted' status
ALTER TABLE purchase_orders 
ADD CONSTRAINT purchase_orders_status_check 
CHECK (status IN ('pending', 'counted', 'received', 'cancelled'));

-- ==================== PURCHASE ORDER ITEMS UPDATES ====================
-- Track if barcode was scanned during counting

ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS barcode_scanned BOOLEAN DEFAULT FALSE;

-- Add counted_quantity column to store the quantity entered during counting
-- This is separate from received_quantity which is set during final receiving
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS counted_quantity DECIMAL(15,4) DEFAULT NULL;

-- Add counted_at timestamp
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS counted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- ==================== COMMENTS ====================
COMMENT ON TABLE item_barcodes IS 'Stores barcode-to-item mappings. Each item can have one barcode, each barcode is unique.';
COMMENT ON COLUMN item_barcodes.barcode IS 'The scanned barcode value (EAN, UPC, etc.)';
COMMENT ON COLUMN purchase_order_items.barcode_scanned IS 'Whether at least one barcode was scanned for this item during counting';
COMMENT ON COLUMN purchase_order_items.counted_quantity IS 'The quantity entered during counting step (before receiving)';
COMMENT ON COLUMN purchase_order_items.counted_at IS 'When the item was counted';







