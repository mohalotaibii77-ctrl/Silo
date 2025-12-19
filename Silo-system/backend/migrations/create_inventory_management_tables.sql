-- =============================================
-- INVENTORY MANAGEMENT TABLES
-- Vendors, Purchase Orders, Transfers, Stock Counts
-- =============================================

-- ==================== VENDORS ====================
-- Suppliers and vendors for purchasing inventory
CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    code VARCHAR(50), -- Vendor code/reference
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Saudi Arabia',
    tax_number VARCHAR(50), -- VAT number
    payment_terms INTEGER DEFAULT 30, -- Days for payment
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vendors_business ON vendors(business_id);
CREATE INDEX idx_vendors_status ON vendors(status);

-- ==================== INVENTORY STOCK ====================
-- Current stock levels per item per branch
CREATE TABLE IF NOT EXISTS inventory_stock (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,4) DEFAULT 0, -- Current quantity in stock
    reserved_quantity DECIMAL(15,4) DEFAULT 0, -- Reserved for orders
    min_quantity DECIMAL(15,4) DEFAULT 0, -- Reorder point
    max_quantity DECIMAL(15,4), -- Maximum stock level
    last_count_date TIMESTAMP WITH TIME ZONE,
    last_count_quantity DECIMAL(15,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(business_id, branch_id, item_id)
);

CREATE INDEX idx_inventory_stock_business ON inventory_stock(business_id);
CREATE INDEX idx_inventory_stock_branch ON inventory_stock(branch_id);
CREATE INDEX idx_inventory_stock_item ON inventory_stock(item_id);

-- ==================== PURCHASE ORDERS ====================
-- Orders placed to vendors for inventory
CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'ordered', 'partial', 'received', 'cancelled')),
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    received_date DATE,
    subtotal DECIMAL(15,4) DEFAULT 0,
    tax_amount DECIMAL(15,4) DEFAULT 0,
    discount_amount DECIMAL(15,4) DEFAULT 0,
    total_amount DECIMAL(15,4) DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES business_users(id),
    approved_by INTEGER REFERENCES business_users(id),
    received_by INTEGER REFERENCES business_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_purchase_orders_business ON purchase_orders(business_id);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(order_date);

-- Purchase order line items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity DECIMAL(15,4) NOT NULL,
    received_quantity DECIMAL(15,4) DEFAULT 0,
    unit_cost DECIMAL(15,4) NOT NULL,
    total_cost DECIMAL(15,4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_item ON purchase_order_items(item_id);

-- ==================== INVENTORY TRANSFERS ====================
-- Transfer inventory between branches/locations
CREATE TABLE IF NOT EXISTS inventory_transfers (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    transfer_number VARCHAR(50) NOT NULL,
    from_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    to_branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'in_transit', 'completed', 'cancelled')),
    transfer_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    completed_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES business_users(id),
    approved_by INTEGER REFERENCES business_users(id),
    completed_by INTEGER REFERENCES business_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_transfers_business ON inventory_transfers(business_id);
CREATE INDEX idx_inventory_transfers_status ON inventory_transfers(status);
CREATE INDEX idx_inventory_transfers_from ON inventory_transfers(from_branch_id);
CREATE INDEX idx_inventory_transfers_to ON inventory_transfers(to_branch_id);

-- Transfer line items
CREATE TABLE IF NOT EXISTS inventory_transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity DECIMAL(15,4) NOT NULL,
    received_quantity DECIMAL(15,4) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_transfer_items_transfer ON inventory_transfer_items(transfer_id);
CREATE INDEX idx_inventory_transfer_items_item ON inventory_transfer_items(item_id);

-- ==================== INVENTORY COUNTS ====================
-- Physical inventory counting sessions
CREATE TABLE IF NOT EXISTS inventory_counts (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    count_number VARCHAR(50) NOT NULL,
    count_type VARCHAR(20) DEFAULT 'full' CHECK (count_type IN ('full', 'partial', 'cycle')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'pending_review', 'completed', 'cancelled')),
    count_date DATE DEFAULT CURRENT_DATE,
    completed_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES business_users(id),
    completed_by INTEGER REFERENCES business_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_counts_business ON inventory_counts(business_id);
CREATE INDEX idx_inventory_counts_branch ON inventory_counts(branch_id);
CREATE INDEX idx_inventory_counts_status ON inventory_counts(status);

-- Count line items
CREATE TABLE IF NOT EXISTS inventory_count_items (
    id SERIAL PRIMARY KEY,
    count_id INTEGER NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    expected_quantity DECIMAL(15,4) DEFAULT 0, -- System quantity at time of count
    counted_quantity DECIMAL(15,4), -- Actual counted quantity
    variance DECIMAL(15,4), -- Difference (counted - expected)
    variance_reason TEXT,
    counted_by INTEGER REFERENCES business_users(id),
    counted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_count_items_count ON inventory_count_items(count_id);
CREATE INDEX idx_inventory_count_items_item ON inventory_count_items(item_id);

-- ==================== INVENTORY MOVEMENTS ====================
-- Audit log of all inventory movements
CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN (
        'purchase_receive', 'purchase_return',
        'transfer_out', 'transfer_in',
        'sale', 'sale_return',
        'adjustment_add', 'adjustment_remove',
        'count_adjustment', 'waste', 'damage', 'expiry'
    )),
    reference_type VARCHAR(30), -- 'purchase_order', 'transfer', 'count', 'order', 'manual'
    reference_id INTEGER, -- ID of the related document
    quantity DECIMAL(15,4) NOT NULL, -- Positive for in, negative for out
    unit_cost DECIMAL(15,4),
    total_cost DECIMAL(15,4),
    quantity_before DECIMAL(15,4),
    quantity_after DECIMAL(15,4),
    notes TEXT,
    created_by INTEGER REFERENCES business_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_business ON inventory_movements(business_id);
CREATE INDEX idx_inventory_movements_branch ON inventory_movements(branch_id);
CREATE INDEX idx_inventory_movements_item ON inventory_movements(item_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(created_at);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);






