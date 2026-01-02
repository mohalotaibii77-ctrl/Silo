-- =============================================
-- PURCHASE ORDER ACTIVITY LOG
-- Tracks all changes to purchase orders with user and timestamp
-- =============================================

CREATE TABLE IF NOT EXISTS purchase_order_activity (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES business_users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- created, status_changed, items_updated, notes_updated, cancelled, received
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changes JSONB, -- Store detailed changes (e.g., which items changed, quantity differences)
    notes TEXT, -- Optional note for the action
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_po_activity_order ON purchase_order_activity(purchase_order_id);
CREATE INDEX idx_po_activity_business ON purchase_order_activity(business_id);
CREATE INDEX idx_po_activity_user ON purchase_order_activity(user_id);
CREATE INDEX idx_po_activity_action ON purchase_order_activity(action);
CREATE INDEX idx_po_activity_date ON purchase_order_activity(created_at);

-- Comment on table
COMMENT ON TABLE purchase_order_activity IS 'Audit log for all purchase order changes with user attribution';
COMMENT ON COLUMN purchase_order_activity.action IS 'Type of action: created, status_changed, items_updated, notes_updated, cancelled, received';
COMMENT ON COLUMN purchase_order_activity.changes IS 'JSON object containing detailed changes for auditing';










