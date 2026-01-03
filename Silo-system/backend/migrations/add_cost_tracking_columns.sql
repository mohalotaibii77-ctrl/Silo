-- =====================================================
-- MIGRATION: Add Cost Tracking Columns for Accurate COGS & Profit
-- =====================================================
-- This migration adds:
-- 1. Cost snapshot columns to order_items (capture cost at time of sale)
-- 2. Inventory value tracking columns to items (for WAC calculation)
-- =====================================================

-- ==================== ORDER ITEMS COST SNAPSHOT ====================
-- Capture cost at the time of sale for accurate profit calculations

-- Cost per unit at the time of sale (from product's total_cost)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_cost_at_sale DECIMAL(12, 4) DEFAULT 0;

-- Total cost for this line item (unit_cost_at_sale * quantity)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 4) DEFAULT 0;

-- Profit for this line item (total - total_cost)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS profit DECIMAL(12, 4) DEFAULT 0;

-- Profit margin percentage ((profit / total) * 100)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(6, 2) DEFAULT 0;

-- ==================== ITEMS INVENTORY VALUE TRACKING ====================
-- Track total inventory value for Weighted Average Cost calculations

-- Total quantity currently in stock (across all branches)
ALTER TABLE items ADD COLUMN IF NOT EXISTS total_stock_quantity DECIMAL(15, 4) DEFAULT 0;

-- Total value of inventory (quantity * cost per unit)
ALTER TABLE items ADD COLUMN IF NOT EXISTS total_stock_value DECIMAL(15, 4) DEFAULT 0;

-- Last purchase cost (for reference, not used in WAC)
ALTER TABLE items ADD COLUMN IF NOT EXISTS last_purchase_cost DECIMAL(12, 4) DEFAULT 0;

-- Last purchase date
ALTER TABLE items ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMP WITH TIME ZONE;

-- ==================== PRODUCTS COST TRACKING ====================
-- Track product costs more comprehensively

-- Last cost update timestamp
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMP WITH TIME ZONE;

-- ==================== COMMENTS ====================
COMMENT ON COLUMN order_items.unit_cost_at_sale IS 'Product cost at time of sale - snapshot for accurate profit calculation';
COMMENT ON COLUMN order_items.total_cost IS 'Total cost for line item (unit_cost_at_sale × quantity)';
COMMENT ON COLUMN order_items.profit IS 'Profit for line item (total - total_cost)';
COMMENT ON COLUMN order_items.profit_margin IS 'Profit margin percentage ((profit / total) × 100)';
COMMENT ON COLUMN items.total_stock_quantity IS 'Total stock across all branches for WAC calculation';
COMMENT ON COLUMN items.total_stock_value IS 'Total inventory value for WAC calculation';
COMMENT ON COLUMN items.last_purchase_cost IS 'Last purchase price for reference';
COMMENT ON COLUMN items.last_purchase_date IS 'Date of last purchase';











