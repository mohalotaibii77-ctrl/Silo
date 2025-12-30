-- Migration: Add unique constraint on item names per business
-- This prevents duplicate item names within the same business or among system items
-- Date: 2025-12-20

-- First, let's identify and log any existing duplicates (for manual review)
-- Create a temp table to store duplicate info for logging
DO $$
DECLARE
    dup_record RECORD;
BEGIN
    RAISE NOTICE 'Checking for duplicate item names...';
    
    -- Check for business-level duplicates (same name within same business)
    FOR dup_record IN 
        SELECT business_id, LOWER(name) as name_lower, COUNT(*) as cnt, 
               array_agg(id ORDER BY id) as item_ids,
               array_agg(sku ORDER BY id) as skus
        FROM items 
        WHERE status = 'active' AND business_id IS NOT NULL
        GROUP BY business_id, LOWER(name)
        HAVING COUNT(*) > 1
    LOOP
        RAISE WARNING 'DUPLICATE FOUND - Business %: name="%" has % items (IDs: %, SKUs: %)', 
            dup_record.business_id, dup_record.name_lower, dup_record.cnt, 
            dup_record.item_ids, dup_record.skus;
    END LOOP;
    
    -- Check for system-level duplicates (same name among system items)
    FOR dup_record IN 
        SELECT LOWER(name) as name_lower, COUNT(*) as cnt,
               array_agg(id ORDER BY id) as item_ids,
               array_agg(sku ORDER BY id) as skus
        FROM items 
        WHERE status = 'active' AND business_id IS NULL
        GROUP BY LOWER(name)
        HAVING COUNT(*) > 1
    LOOP
        RAISE WARNING 'DUPLICATE SYSTEM ITEM: name="%" has % items (IDs: %, SKUs: %)', 
            dup_record.name_lower, dup_record.cnt, dup_record.item_ids, dup_record.skus;
    END LOOP;
    
    -- Check for conflicts between business and system items
    FOR dup_record IN 
        SELECT b.business_id, LOWER(b.name) as name_lower, 
               b.id as business_item_id, b.sku as business_sku,
               s.id as system_item_id, s.sku as system_sku
        FROM items b
        JOIN items s ON LOWER(b.name) = LOWER(s.name) AND s.business_id IS NULL
        WHERE b.business_id IS NOT NULL AND b.status = 'active' AND s.status = 'active'
    LOOP
        RAISE WARNING 'BUSINESS/SYSTEM CONFLICT - Business %: name="%" has business item (ID: %, SKU: %) AND system item (ID: %, SKU: %)', 
            dup_record.business_id, dup_record.name_lower, 
            dup_record.business_item_id, dup_record.business_sku,
            dup_record.system_item_id, dup_record.system_sku;
    END LOOP;
END $$;

-- Add unique index for system items (business_id IS NULL)
-- This ensures no two system items can have the same name (case-insensitive)
DROP INDEX IF EXISTS idx_items_unique_system_name;
CREATE UNIQUE INDEX idx_items_unique_system_name 
ON items (LOWER(name)) 
WHERE business_id IS NULL AND status = 'active';

-- Add unique index for business items
-- This ensures no two items within the same business can have the same name (case-insensitive)
DROP INDEX IF EXISTS idx_items_unique_business_name;
CREATE UNIQUE INDEX idx_items_unique_business_name 
ON items (business_id, LOWER(name)) 
WHERE business_id IS NOT NULL AND status = 'active';

-- Note: We intentionally allow the same name to exist as both a system item and a business item
-- This is because businesses may want to "override" a system item with their own customized version
-- The application logic should ensure that when a business creates an item with the same name as a system item,
-- the system item is marked as "deleted" for that business in the business_deleted_items table

COMMENT ON INDEX idx_items_unique_system_name IS 'Ensures unique item names among system items (case-insensitive)';
COMMENT ON INDEX idx_items_unique_business_name IS 'Ensures unique item names within each business (case-insensitive)';



