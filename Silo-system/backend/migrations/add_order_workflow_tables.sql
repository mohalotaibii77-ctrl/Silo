-- =====================================================
-- ORDER WORKFLOW TABLES MIGRATION
-- Adds inventory reservation, timeline tracking, and waste/return processing
-- =====================================================

-- ==================== ORDERS TABLE UPDATES ====================

-- Track if order was edited (for kitchen display color coding)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;

-- Track remaining amount owed after edit increases price
ALTER TABLE orders ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(12, 2) DEFAULT 0;

-- ==================== ORDER ITEMS TABLE UPDATES ====================

-- Track which variant was ordered (if product has variants)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;

-- Track original quantity before any edits
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS original_quantity INTEGER;

-- Kitchen's decision for cancelled/removed items: null (pending), 'waste', or 'return'
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS waste_decision VARCHAR(20) CHECK (waste_decision IN ('waste', 'return'));

-- ==================== ORDER TIMELINE TABLE ====================
-- Tracks all events for audit trail

CREATE TABLE IF NOT EXISTS order_timeline (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_by INTEGER REFERENCES business_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast timeline lookups
CREATE INDEX IF NOT EXISTS idx_order_timeline_order_id ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_timeline_event_type ON order_timeline(event_type);
CREATE INDEX IF NOT EXISTS idx_order_timeline_created_at ON order_timeline(created_at);

-- ==================== CANCELLED ORDER ITEMS TABLE ====================
-- Queue for kitchen to process cancelled/removed items and decide waste vs return

CREATE TABLE IF NOT EXISTS cancelled_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id INTEGER REFERENCES order_items(id) ON DELETE SET NULL,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255),
    quantity DECIMAL(15, 4) NOT NULL,
    unit VARCHAR(20),
    decision VARCHAR(20) CHECK (decision IN ('waste', 'return')),
    decided_by INTEGER REFERENCES business_users(id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cancelled_order_items_order_id ON cancelled_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cancelled_order_items_decision ON cancelled_order_items(decision);
CREATE INDEX IF NOT EXISTS idx_cancelled_order_items_pending ON cancelled_order_items(id) WHERE decision IS NULL;

-- ==================== UPDATE INVENTORY MOVEMENTS CONSTRAINT ====================
-- Add new movement types for order workflow

ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;

ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check 
CHECK (movement_type IN (
    -- Existing types
    'purchase_receive', 'purchase_return',
    'transfer_out', 'transfer_in',
    'sale', 'sale_return',
    'adjustment_add', 'adjustment_remove',
    'count_adjustment', 'waste', 'damage', 'expiry',
    'production_consume', 'production_output',
    -- New order workflow types
    'sale_reserve',           -- Reserve ingredients when order created
    'sale_consume',           -- Deduct ingredients when order completed
    'sale_cancel_waste',      -- Cancelled item marked as waste
    'sale_cancel_return'      -- Cancelled item returned to inventory
));

-- ==================== RLS POLICIES ====================

ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancelled_order_items ENABLE ROW LEVEL SECURITY;

-- Timeline policies
DROP POLICY IF EXISTS timeline_select_policy ON order_timeline;
DROP POLICY IF EXISTS timeline_insert_policy ON order_timeline;

CREATE POLICY timeline_select_policy ON order_timeline FOR SELECT USING (true);
CREATE POLICY timeline_insert_policy ON order_timeline FOR INSERT WITH CHECK (true);

-- Cancelled order items policies
DROP POLICY IF EXISTS cancelled_items_select_policy ON cancelled_order_items;
DROP POLICY IF EXISTS cancelled_items_insert_policy ON cancelled_order_items;
DROP POLICY IF EXISTS cancelled_items_update_policy ON cancelled_order_items;

CREATE POLICY cancelled_items_select_policy ON cancelled_order_items FOR SELECT USING (true);
CREATE POLICY cancelled_items_insert_policy ON cancelled_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY cancelled_items_update_policy ON cancelled_order_items FOR UPDATE USING (true);

-- ==================== GRANTS ====================

GRANT ALL ON order_timeline TO authenticated;
GRANT ALL ON order_timeline TO service_role;
GRANT ALL ON order_timeline TO anon;
GRANT USAGE, SELECT ON SEQUENCE order_timeline_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE order_timeline_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE order_timeline_id_seq TO anon;

GRANT ALL ON cancelled_order_items TO authenticated;
GRANT ALL ON cancelled_order_items TO service_role;
GRANT ALL ON cancelled_order_items TO anon;
GRANT USAGE, SELECT ON SEQUENCE cancelled_order_items_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE cancelled_order_items_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE cancelled_order_items_id_seq TO anon;

-- ==================== COMMENTS ====================

COMMENT ON TABLE order_timeline IS 'Audit trail for all order events (created, edited, completed, cancelled, etc.)';
COMMENT ON COLUMN order_timeline.event_type IS 'Type of event: created, item_added, item_removed, item_modified, status_changed, payment_received, cancelled, completed, ingredient_wasted, ingredient_returned';
COMMENT ON COLUMN order_timeline.event_data IS 'JSON data with event details (items changed, amounts, reasons, etc.)';

COMMENT ON TABLE cancelled_order_items IS 'Queue for kitchen to process cancelled/removed items - decide waste vs return to inventory';
COMMENT ON COLUMN cancelled_order_items.item_id IS 'The raw ingredient item that needs a decision';
COMMENT ON COLUMN cancelled_order_items.decision IS 'Kitchen decision: waste (deduct from stock) or return (release reservation)';

COMMENT ON COLUMN orders.is_edited IS 'True if order was modified after creation (for kitchen display highlighting)';
COMMENT ON COLUMN orders.remaining_amount IS 'Amount still owed if edit increased price (0 if fully paid)';
COMMENT ON COLUMN order_items.waste_decision IS 'For removed/cancelled items: waste or return to inventory';


