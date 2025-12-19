-- Inventory Transactions Table
-- Tracks ALL inventory movements for complete audit trail
-- This is the single source of truth for inventory history

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type VARCHAR(50) NOT NULL, 
  -- Types: 'manual_addition', 'manual_deduction', 'transfer_in', 'transfer_out', 
  --        'order_sale', 'po_receive', 'production_consume', 'production_yield',
  --        'inventory_count_adjustment', 'order_void_return'
  
  quantity DECIMAL(15, 6) NOT NULL, -- Always positive, direction determined by type
  unit VARCHAR(20) NOT NULL, -- Storage unit (Kg, L, piece, etc.)
  
  -- For manual deductions - reason categorization
  deduction_reason VARCHAR(50), -- 'expired', 'damaged', 'spoiled', 'others'
  
  -- Reference to source transaction
  reference_type VARCHAR(50), -- 'order', 'transfer', 'purchase_order', 'production', 'inventory_count', 'manual'
  reference_id INTEGER, -- ID of the related record (order_id, transfer_id, po_id, etc.)
  
  -- Audit info
  notes TEXT,
  performed_by INTEGER REFERENCES business_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Snapshot of item state at transaction time
  quantity_before DECIMAL(15, 6),
  quantity_after DECIMAL(15, 6),
  cost_per_unit_at_time DECIMAL(15, 8) -- High precision for small per-unit costs
);

-- Indexes for common queries
CREATE INDEX idx_inventory_transactions_business ON inventory_transactions(business_id);
CREATE INDEX idx_inventory_transactions_branch ON inventory_transactions(branch_id);
CREATE INDEX idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_created ON inventory_transactions(created_at DESC);
CREATE INDEX idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);

-- Composite index for timeline queries
CREATE INDEX idx_inventory_transactions_timeline ON inventory_transactions(business_id, created_at DESC);
CREATE INDEX idx_inventory_transactions_item_timeline ON inventory_transactions(item_id, created_at DESC);

COMMENT ON TABLE inventory_transactions IS 'Audit log for all inventory movements - orders, transfers, POs, adjustments, production';
COMMENT ON COLUMN inventory_transactions.quantity IS 'Always positive. Direction (in/out) determined by transaction_type';
COMMENT ON COLUMN inventory_transactions.deduction_reason IS 'Only for manual_deduction: expired, damaged, spoiled, others';
COMMENT ON COLUMN inventory_transactions.cost_per_unit_at_time IS 'Snapshot of item cost at transaction time for historical accuracy';

