-- =====================================================
-- CANCELLED ITEMS RESERVATION FIX MIGRATION
-- Adds cancellation_source to distinguish between cancelled orders vs edited orders
-- Also adds pos_session_id for session-based auto-expire
-- =====================================================

-- Add cancellation_source column to distinguish between:
-- 'order_cancelled' - Full order cancellation
-- 'order_edited' - Item removed or quantity reduced during edit
ALTER TABLE cancelled_order_items 
ADD COLUMN IF NOT EXISTS cancellation_source VARCHAR(20) 
DEFAULT 'order_cancelled'
CHECK (cancellation_source IN ('order_cancelled', 'order_edited'));

-- Add pos_session_id to track which session the cancellation happened in
-- This enables auto-expire when session closes
ALTER TABLE cancelled_order_items 
ADD COLUMN IF NOT EXISTS pos_session_id INTEGER REFERENCES pos_sessions(id) ON DELETE SET NULL;

-- Index for fast filtering by cancellation source
CREATE INDEX IF NOT EXISTS idx_cancelled_order_items_source 
ON cancelled_order_items(cancellation_source) 
WHERE decision IS NULL;

-- Index for session-based queries
CREATE INDEX IF NOT EXISTS idx_cancelled_order_items_session 
ON cancelled_order_items(pos_session_id) 
WHERE decision IS NULL;

-- Update existing records to have the default cancellation_source
UPDATE cancelled_order_items 
SET cancellation_source = 'order_cancelled' 
WHERE cancellation_source IS NULL;

-- Comments
COMMENT ON COLUMN cancelled_order_items.cancellation_source IS 'Source of cancellation: order_cancelled (full order) or order_edited (item removed/reduced)';
COMMENT ON COLUMN cancelled_order_items.pos_session_id IS 'POS session during which the cancellation occurred - used for session-based auto-expire';





