-- Migration: Create product_accessories table
-- Links non-food items (packaging, supplies) to products for automatic inventory deduction
-- Supports order-type-based conditional deduction (e.g., containers only for takeaway/delivery)

-- Create product_accessories table
CREATE TABLE IF NOT EXISTS product_accessories (
    id SERIAL PRIMARY KEY,
    
    -- Link to product (and optionally variant)
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
    
    -- Link to accessory item (non-food item like container, napkin, etc.)
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    
    -- Quantity of this accessory per product unit
    quantity DECIMAL(10, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    
    -- When to include this accessory
    -- 'always' = all order types
    -- 'delivery' = delivery orders only
    -- 'takeaway' = takeaway/pickup orders only  
    -- 'dine_in' = dine-in orders only
    applicable_order_types TEXT[] DEFAULT ARRAY['always'],
    
    -- Is this accessory required or optional?
    is_required BOOLEAN DEFAULT true,
    
    -- Optional notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique indexes to prevent duplicate accessories
-- One for when variant_id IS NULL (product-level accessories)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_accessories_product_item_no_variant 
ON product_accessories(product_id, item_id) WHERE variant_id IS NULL;

-- One for when variant_id IS NOT NULL (variant-level accessories)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_accessories_product_variant_item 
ON product_accessories(product_id, variant_id, item_id) WHERE variant_id IS NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_accessories_product_id ON product_accessories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_accessories_variant_id ON product_accessories(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_accessories_item_id ON product_accessories(item_id);

-- Enable Row Level Security
ALTER TABLE product_accessories ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_accessories
DROP POLICY IF EXISTS product_accessories_select_policy ON product_accessories;
DROP POLICY IF EXISTS product_accessories_insert_policy ON product_accessories;
DROP POLICY IF EXISTS product_accessories_update_policy ON product_accessories;
DROP POLICY IF EXISTS product_accessories_delete_policy ON product_accessories;

CREATE POLICY product_accessories_select_policy ON product_accessories FOR SELECT USING (true);
CREATE POLICY product_accessories_insert_policy ON product_accessories FOR INSERT WITH CHECK (true);
CREATE POLICY product_accessories_update_policy ON product_accessories FOR UPDATE USING (true);
CREATE POLICY product_accessories_delete_policy ON product_accessories FOR DELETE USING (true);

-- Add comments for documentation
COMMENT ON TABLE product_accessories IS 'Links non-food items (packaging, supplies) to products for inventory tracking';
COMMENT ON COLUMN product_accessories.applicable_order_types IS 'Order types where this accessory applies: always, delivery, takeaway, dine_in';
COMMENT ON COLUMN product_accessories.is_required IS 'Whether this accessory is required (deducted automatically) or optional';
