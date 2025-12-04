-- Migration: Add support for composite items (items made from other items)
-- Example: "Special Sauce" made from "Tomato Paste (50g)" + "Mayo (50mL)"
-- With batch tracking: "This recipe makes 500g of sauce"

-- Add is_composite flag and batch tracking fields to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS is_composite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add batch tracking columns for composite items
-- batch_quantity: how much this recipe produces (e.g., 500 for "makes 500g")
-- batch_unit: the unit for batch quantity (e.g., 'grams')
-- This allows calculating unit_price = cost_per_unit / batch_quantity
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS batch_quantity DECIMAL(10, 3) DEFAULT NULL;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS batch_unit VARCHAR(20) DEFAULT NULL;

-- Create composite_item_components table
-- This tracks which items make up a composite item and their quantities
CREATE TABLE IF NOT EXISTS composite_item_components (
    id SERIAL PRIMARY KEY,
    
    -- The composite (parent) item
    composite_item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    
    -- The component (child) item used to make the composite
    component_item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    
    -- Quantity of the component item needed (in the component's unit)
    quantity DECIMAL(10, 3) NOT NULL CHECK (quantity > 0),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate components in the same composite item
    UNIQUE(composite_item_id, component_item_id),
    
    -- Prevent an item from being a component of itself
    CHECK (composite_item_id != component_item_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_composite_item_components_composite_id 
    ON composite_item_components(composite_item_id);
    
CREATE INDEX IF NOT EXISTS idx_composite_item_components_component_id 
    ON composite_item_components(component_item_id);

CREATE INDEX IF NOT EXISTS idx_items_is_composite 
    ON items(is_composite) WHERE is_composite = TRUE;

-- Enable RLS
ALTER TABLE composite_item_components ENABLE ROW LEVEL SECURITY;

-- RLS policies for composite_item_components
DROP POLICY IF EXISTS composite_item_components_select_policy ON composite_item_components;
DROP POLICY IF EXISTS composite_item_components_insert_policy ON composite_item_components;
DROP POLICY IF EXISTS composite_item_components_update_policy ON composite_item_components;
DROP POLICY IF EXISTS composite_item_components_delete_policy ON composite_item_components;

CREATE POLICY composite_item_components_select_policy 
    ON composite_item_components FOR SELECT USING (true);
CREATE POLICY composite_item_components_insert_policy 
    ON composite_item_components FOR INSERT WITH CHECK (true);
CREATE POLICY composite_item_components_update_policy 
    ON composite_item_components FOR UPDATE USING (true);
CREATE POLICY composite_item_components_delete_policy 
    ON composite_item_components FOR DELETE USING (true);

-- Grant permissions to roles (required for service role access)
GRANT ALL ON composite_item_components TO authenticated;
GRANT ALL ON composite_item_components TO service_role;
GRANT ALL ON composite_item_components TO anon;
GRANT USAGE, SELECT ON SEQUENCE composite_item_components_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE composite_item_components_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE composite_item_components_id_seq TO anon;

-- Add comments for documentation
COMMENT ON COLUMN items.is_composite IS 'TRUE if this item is made from other items (composite item)';
COMMENT ON COLUMN items.batch_quantity IS 'For composite items: how much this recipe produces (e.g., 500 for making 500g of sauce)';
COMMENT ON COLUMN items.batch_unit IS 'For composite items: the unit for batch_quantity (grams, mL, piece)';
COMMENT ON TABLE composite_item_components IS 'Junction table linking composite items to their component items with quantities';
COMMENT ON COLUMN composite_item_components.quantity IS 'Amount of component item needed, in the component item''s unit (grams, mL, or piece)';

