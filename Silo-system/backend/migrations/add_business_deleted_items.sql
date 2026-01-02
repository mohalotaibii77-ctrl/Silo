-- Migration: Add business_deleted_items table for per-business deletion of default items
-- This allows businesses to "delete" default (general) items without affecting other businesses

-- Create business_deleted_items table
-- When a business "deletes" a default item, we record it here
-- The item is then hidden from that business but still visible to others
CREATE TABLE IF NOT EXISTS business_deleted_items (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure each business can only delete an item once
    UNIQUE(business_id, item_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_business_deleted_items_business_id 
    ON business_deleted_items(business_id);
    
CREATE INDEX IF NOT EXISTS idx_business_deleted_items_item_id 
    ON business_deleted_items(item_id);

-- Enable RLS
ALTER TABLE business_deleted_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for business_deleted_items
DROP POLICY IF EXISTS business_deleted_items_select_policy ON business_deleted_items;
DROP POLICY IF EXISTS business_deleted_items_insert_policy ON business_deleted_items;
DROP POLICY IF EXISTS business_deleted_items_delete_policy ON business_deleted_items;

CREATE POLICY business_deleted_items_select_policy 
    ON business_deleted_items FOR SELECT USING (true);
CREATE POLICY business_deleted_items_insert_policy 
    ON business_deleted_items FOR INSERT WITH CHECK (true);
CREATE POLICY business_deleted_items_delete_policy 
    ON business_deleted_items FOR DELETE USING (true);

-- Grant permissions to roles
GRANT ALL ON business_deleted_items TO authenticated;
GRANT ALL ON business_deleted_items TO service_role;
GRANT ALL ON business_deleted_items TO anon;
GRANT USAGE, SELECT ON SEQUENCE business_deleted_items_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE business_deleted_items_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE business_deleted_items_id_seq TO anon;

-- Add comments for documentation
COMMENT ON TABLE business_deleted_items IS 'Tracks which default items have been "deleted" by each business';
COMMENT ON COLUMN business_deleted_items.business_id IS 'The business that deleted this item';
COMMENT ON COLUMN business_deleted_items.item_id IS 'The default item that was deleted (must have business_id = NULL)';






