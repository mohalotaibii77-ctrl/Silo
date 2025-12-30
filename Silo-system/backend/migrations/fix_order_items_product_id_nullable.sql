-- Migration: Make product_id nullable in order_items table
-- This allows bundles to have order items without a specific product_id
-- Bundles use combo_id instead

-- Make product_id nullable for bundles
ALTER TABLE order_items 
ALTER COLUMN product_id DROP NOT NULL;

-- Add comment explaining the nullable constraint
COMMENT ON COLUMN order_items.product_id IS 'Product ID - nullable when is_combo is true (bundles use combo_id instead)';


