-- Migration: Add SKU/code columns to items and pos_products
-- This enables unique product/item identification for inventory, POS, and integrations
-- Format: SYS-ITM-XXXX for system items, {business_id}-ITM-XXXX for business items
-- Format: {business_id}-PRD-XXXX for products, {business_id}-POS-XXXX for POS products

-- Add sku column to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS sku VARCHAR(50);

-- Add sku column to pos_products table
ALTER TABLE pos_products 
ADD COLUMN IF NOT EXISTS sku VARCHAR(50);

-- Create unique index for items sku (globally unique for all items)
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_sku_unique 
ON items(sku) WHERE sku IS NOT NULL;

-- Create unique index for pos_products sku (unique per business)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_products_sku_business_unique 
ON pos_products(business_id, sku) WHERE sku IS NOT NULL;

-- Create unique index for products sku (unique per business) - products already has sku column
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_business_unique 
ON products(business_id, sku) WHERE sku IS NOT NULL;

-- Generate SKUs for existing SYSTEM items (is_system_item = true, business_id IS NULL)
UPDATE items 
SET sku = 'SYS-ITM-' || LPAD(id::TEXT, 4, '0')
WHERE is_system_item = TRUE AND sku IS NULL;

-- Generate SKUs for existing BUSINESS items (is_system_item = false)
UPDATE items 
SET sku = business_id::TEXT || '-ITM-' || LPAD(id::TEXT, 4, '0')
WHERE is_system_item = FALSE AND business_id IS NOT NULL AND sku IS NULL;

-- Generate SKUs for existing products (if they don't have one)
UPDATE products 
SET sku = business_id::TEXT || '-PRD-' || LPAD(id::TEXT, 4, '0')
WHERE sku IS NULL AND business_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN items.sku IS 'Unique stock-keeping unit code. Format: SYS-ITM-XXXX for system items, {business_id}-ITM-XXXX for business items';
COMMENT ON COLUMN pos_products.sku IS 'Unique stock-keeping unit code. Format: {business_id}-PRD-XXXX';

