-- =============================================
-- FIX DUPLICATE INVENTORY STOCK RECORDS
-- PostgreSQL treats NULL as distinct in UNIQUE constraints
-- We need to create partial unique indexes to handle NULL branch_id
-- =============================================

-- Step 1: Find and merge duplicates (keep the one with highest quantity, sum quantities)
-- First, identify duplicates where branch_id IS NULL
WITH duplicates AS (
  SELECT 
    business_id, 
    item_id,
    COUNT(*) as cnt,
    MAX(id) as keep_id,
    SUM(quantity) as total_quantity,
    SUM(reserved_quantity) as total_reserved,
    SUM(COALESCE(held_quantity, 0)) as total_held,
    MAX(min_quantity) as max_min_qty,
    MAX(max_quantity) as max_max_qty
  FROM inventory_stock 
  WHERE branch_id IS NULL
  GROUP BY business_id, item_id 
  HAVING COUNT(*) > 1
),
-- Update the record we're keeping with combined quantities
updated AS (
  UPDATE inventory_stock s
  SET 
    quantity = d.total_quantity,
    reserved_quantity = d.total_reserved,
    held_quantity = d.total_held,
    min_quantity = d.max_min_qty,
    max_quantity = d.max_max_qty,
    updated_at = NOW()
  FROM duplicates d
  WHERE s.id = d.keep_id
  RETURNING s.id
)
-- Delete the duplicate records (not the one we kept)
DELETE FROM inventory_stock s
USING duplicates d
WHERE s.business_id = d.business_id 
  AND s.item_id = d.item_id 
  AND s.branch_id IS NULL
  AND s.id != d.keep_id;

-- Step 2: Same for duplicates WITH branch_id (shouldn't happen due to unique constraint, but just in case)
WITH duplicates_branch AS (
  SELECT 
    business_id, 
    branch_id,
    item_id,
    COUNT(*) as cnt,
    MAX(id) as keep_id,
    SUM(quantity) as total_quantity,
    SUM(reserved_quantity) as total_reserved,
    SUM(COALESCE(held_quantity, 0)) as total_held,
    MAX(min_quantity) as max_min_qty,
    MAX(max_quantity) as max_max_qty
  FROM inventory_stock 
  WHERE branch_id IS NOT NULL
  GROUP BY business_id, branch_id, item_id 
  HAVING COUNT(*) > 1
),
updated_branch AS (
  UPDATE inventory_stock s
  SET 
    quantity = d.total_quantity,
    reserved_quantity = d.total_reserved,
    held_quantity = d.total_held,
    min_quantity = d.max_min_qty,
    max_quantity = d.max_max_qty,
    updated_at = NOW()
  FROM duplicates_branch d
  WHERE s.id = d.keep_id
  RETURNING s.id
)
DELETE FROM inventory_stock s
USING duplicates_branch d
WHERE s.business_id = d.business_id 
  AND s.branch_id = d.branch_id
  AND s.item_id = d.item_id 
  AND s.id != d.keep_id;

-- Step 3: Create proper unique indexes that handle NULL values
-- Drop the existing constraint if it exists (it doesn't properly handle NULLs)
ALTER TABLE inventory_stock DROP CONSTRAINT IF EXISTS inventory_stock_business_id_branch_id_item_id_key;

-- Create partial unique index for NULL branch_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_stock_unique_null_branch 
ON inventory_stock (business_id, item_id) 
WHERE branch_id IS NULL;

-- Create partial unique index for non-NULL branch_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_stock_unique_with_branch 
ON inventory_stock (business_id, branch_id, item_id) 
WHERE branch_id IS NOT NULL;

-- Verify no duplicates remain
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT business_id, branch_id, item_id, COUNT(*) 
    FROM inventory_stock 
    GROUP BY business_id, branch_id, item_id 
    HAVING COUNT(*) > 1
  ) t;
  
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Still have % duplicate inventory stock records!', dup_count;
  END IF;
  
  RAISE NOTICE 'Successfully cleaned up inventory_stock duplicates. No duplicates remain.';
END $$;

