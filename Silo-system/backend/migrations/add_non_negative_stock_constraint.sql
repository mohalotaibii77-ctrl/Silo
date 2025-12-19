-- =============================================
-- ADD NON-NEGATIVE STOCK CONSTRAINT
-- Inventory should never go below 0
-- =============================================

-- First, fix any existing negative values
UPDATE inventory_stock 
SET quantity = 0, updated_at = NOW()
WHERE quantity < 0;

UPDATE inventory_stock 
SET reserved_quantity = 0, updated_at = NOW()
WHERE reserved_quantity < 0;

UPDATE inventory_stock 
SET held_quantity = 0, updated_at = NOW()
WHERE held_quantity < 0;

-- Add CHECK constraint to prevent negative quantities
-- Note: If constraint already exists, this will fail silently
DO $$
BEGIN
  -- Add constraint for quantity
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_quantity_non_negative'
  ) THEN
    ALTER TABLE inventory_stock 
    ADD CONSTRAINT inventory_stock_quantity_non_negative 
    CHECK (quantity >= 0);
  END IF;
  
  -- Add constraint for reserved_quantity
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_reserved_non_negative'
  ) THEN
    ALTER TABLE inventory_stock 
    ADD CONSTRAINT inventory_stock_reserved_non_negative 
    CHECK (reserved_quantity >= 0);
  END IF;
  
  -- Add constraint for held_quantity  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_held_non_negative'
  ) THEN
    ALTER TABLE inventory_stock 
    ADD CONSTRAINT inventory_stock_held_non_negative 
    CHECK (held_quantity >= 0);
  END IF;
  
  RAISE NOTICE 'Non-negative constraints added/verified for inventory_stock';
END $$;

