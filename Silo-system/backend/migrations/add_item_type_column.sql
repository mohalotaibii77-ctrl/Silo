-- Migration: Add item_type column to items table
-- Two types: food (ingredients for recipes) and non_food (accessories for products)
-- Non-food items can be linked to products as "accessories" for inventory tracking

-- Add item_type column to distinguish food from non-food items
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS item_type VARCHAR(30) DEFAULT 'food';

-- Add check constraint for valid item types (simplified to just food and non_food)
ALTER TABLE items 
DROP CONSTRAINT IF EXISTS items_item_type_check;

ALTER TABLE items 
ADD CONSTRAINT items_item_type_check 
CHECK (item_type IN ('food', 'non_food'));

-- Set existing items to 'food' type (they are all food ingredients currently)
UPDATE items SET item_type = 'food' WHERE item_type IS NULL;

-- Create index for filtering by item_type
CREATE INDEX IF NOT EXISTS idx_items_item_type ON items(item_type);

-- Add comment for documentation
COMMENT ON COLUMN items.item_type IS 'Type of item: food (ingredients for recipes) or non_food (accessories for products)';

