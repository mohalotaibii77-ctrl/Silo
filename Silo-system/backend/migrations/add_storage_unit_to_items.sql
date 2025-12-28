-- Add storage_unit column to items table
-- Storage units: Kg, grams, L, mL, piece
-- This tracks how items are stored in inventory, separate from serving unit

ALTER TABLE items 
ADD COLUMN storage_unit VARCHAR(20) DEFAULT 'Kg';

-- Add comment for clarity
COMMENT ON COLUMN items.storage_unit IS 'Unit for storing item in inventory (Kg, grams, L, mL, piece)';
COMMENT ON COLUMN items.unit IS 'Unit for serving/using item in products (grams, mL, piece)';

-- Update existing items with sensible defaults based on their current unit
-- If unit is grams, set storage_unit to Kg (common storage)
-- If unit is mL, set storage_unit to L (common storage)
-- If unit is piece, set storage_unit to piece
UPDATE items SET storage_unit = 
  CASE 
    WHEN unit = 'grams' THEN 'Kg'
    WHEN unit = 'mL' THEN 'L'
    WHEN unit = 'piece' THEN 'piece'
    ELSE 'Kg'
  END
WHERE storage_unit IS NULL OR storage_unit = 'Kg';







