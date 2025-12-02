-- Migration: Enhance orders table with comprehensive fields
-- Adds support for delivery apps (Talabat, Jahez, etc.), detailed pricing, and audit trail
-- NOTE: This migration ALTERS the existing orders table, not creates new one

-- =====================================================
-- CREATE ENUMS (if not exist)
-- =====================================================
DO $$ BEGIN
    CREATE TYPE order_source AS ENUM (
        'pos', 'talabat', 'jahez', 'hungerstation', 'careem', 'toyou', 
        'mrsool', 'deliveroo', 'ubereats', 'phone', 'website', 
        'mobile_app', 'walk_in', 'other'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_type_enum AS ENUM ('dine_in', 'takeaway', 'delivery', 'drive_thru');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ADD NEW COLUMNS TO ORDERS TABLE
-- =====================================================

-- Order Identification
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS display_number VARCHAR(20);

-- Order Source & Type
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source VARCHAR(50) DEFAULT 'pos';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'dine_in';

-- Timing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_time TIME DEFAULT CURRENT_TIME;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_ready_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_ready_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Customer (additional fields)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Dine-in specific
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zone_area VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS number_of_guests INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS server_id INTEGER;

-- Delivery specific
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address_lat DECIMAL(10, 8);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address_lng DECIMAL(11, 8);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id VARCHAR(100);

-- Discount details
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_reason TEXT;

-- Tax details
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 15.00;

-- Additional fees
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packaging_fee DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(12, 2) DEFAULT 0;

-- Payment details
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_split_payment BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS split_payment_details JSONB;

-- Cancellation/Refund
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reference VARCHAR(255);

-- POS Terminal Info
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pos_terminal_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pos_session_id INTEGER;

-- Staff
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_by INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_id INTEGER;

-- Additional flags
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_rush_order BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_void BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS void_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided_by INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Metadata from delivery apps
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_metadata JSONB;

-- =====================================================
-- ENHANCE ORDER_ITEMS TABLE
-- =====================================================

-- Product details snapshot
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name_ar VARCHAR(255);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_category VARCHAR(100);

-- Item-level discount
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5, 2) DEFAULT 0;

-- Modifiers
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS has_modifiers BOOLEAN DEFAULT FALSE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS modifiers_total DECIMAL(12, 2) DEFAULT 0;

-- Special Instructions
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Status (for kitchen display)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_status VARCHAR(50) DEFAULT 'pending';

-- Combo/Bundle
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_combo BOOLEAN DEFAULT FALSE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS combo_id INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS parent_item_id INTEGER;

-- Void
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_void BOOLEAN DEFAULT FALSE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_by INTEGER;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- CREATE NEW SUPPORTING TABLES
-- =====================================================

-- Order Item Modifiers
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id INTEGER,
    modifier_group_id INTEGER,
    modifier_name VARCHAR(255) NOT NULL,
    modifier_name_ar VARCHAR(255),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    modifier_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Payments (for split payments)
CREATE TABLE IF NOT EXISTS order_payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_reference VARCHAR(255),
    payment_details JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    paid_at TIMESTAMP WITH TIME ZONE,
    processed_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Status History (Audit Trail)
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by INTEGER,
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON orders(order_source);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_order_item_id ON order_item_modifiers(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);

-- =====================================================
-- ADD COMMENTS
-- =====================================================
COMMENT ON COLUMN orders.order_source IS 'Where the order originated: pos, talabat, jahez, hungerstation, phone, etc.';
COMMENT ON COLUMN orders.external_order_id IS 'Order ID from external delivery app (e.g., Talabat order #)';
COMMENT ON COLUMN orders.display_number IS 'Short number displayed to customer and kitchen (e.g., #42)';
COMMENT ON TABLE order_item_modifiers IS 'Modifiers/customizations for order items (extra cheese, no onions, etc.)';
COMMENT ON TABLE order_payments IS 'Payment records, supports split payments across multiple methods';
COMMENT ON TABLE order_status_history IS 'Audit trail of all status changes for each order';
