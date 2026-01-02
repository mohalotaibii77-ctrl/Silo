-- Migration: Update batch_count to support decimal values
-- This allows fractional batch production (0.5 batch, 0.1 batch, etc.)

-- Change batch_count from integer to numeric(10,2) in composite_item_productions
ALTER TABLE composite_item_productions 
ALTER COLUMN batch_count TYPE NUMERIC(10,2) USING batch_count::NUMERIC(10,2);

-- Also update the total_yield column if needed
ALTER TABLE composite_item_productions 
ALTER COLUMN total_yield TYPE NUMERIC(10,2) USING total_yield::NUMERIC(10,2);

-- Update default_batch_count in production_templates to support decimals
ALTER TABLE production_templates 
ALTER COLUMN default_batch_count TYPE NUMERIC(10,2) USING default_batch_count::NUMERIC(10,2);

COMMENT ON COLUMN composite_item_productions.batch_count IS 'Number of batches produced (supports decimals like 0.5 for half batch)';
COMMENT ON COLUMN production_templates.default_batch_count IS 'Default number of batches (supports decimals like 0.5 for half batch)';










