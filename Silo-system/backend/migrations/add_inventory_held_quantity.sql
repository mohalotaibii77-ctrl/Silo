-- =============================================
-- INVENTORY HELD QUANTITY FOR TRANSFERS
-- Items being transferred are held (reserved) until 
-- transfer is received or cancelled
-- =============================================

-- Add held_quantity column to inventory_stock table
-- This tracks items that are reserved for pending transfers
ALTER TABLE inventory_stock
ADD COLUMN IF NOT EXISTS held_quantity DECIMAL(15,4) DEFAULT 0;

-- Add comment explaining the column purpose
COMMENT ON COLUMN inventory_stock.held_quantity IS 'Quantity held for pending transfers - cannot be used for production, sales, or other transfers';

-- Note: Available quantity = quantity - held_quantity - reserved_quantity
-- held_quantity: reserved for pending inventory transfers
-- reserved_quantity: reserved for pending orders/other reservations

-- Create index for queries that filter by held quantity
CREATE INDEX IF NOT EXISTS idx_inventory_stock_held ON inventory_stock(held_quantity) WHERE held_quantity > 0;




