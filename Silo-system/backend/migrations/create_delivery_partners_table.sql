-- Create delivery_partners table for managing delivery service providers
-- This table stores delivery partners that businesses work with (e.g., Talabat, Deliveroo, etc.)

CREATE TABLE IF NOT EXISTS delivery_partners (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255),
    code VARCHAR(50) UNIQUE,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
    commission_value DECIMAL(10, 3) NOT NULL DEFAULT 0,
    minimum_order DECIMAL(10, 3),
    delivery_fee DECIMAL(10, 3),
    estimated_time INTEGER, -- in minutes
    service_areas TEXT,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_delivery_partners_business_id ON delivery_partners(business_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_branch_id ON delivery_partners(branch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_status ON delivery_partners(status);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_name ON delivery_partners(name);

-- Add comment to the table
COMMENT ON TABLE delivery_partners IS 'Stores delivery service providers that businesses work with';
COMMENT ON COLUMN delivery_partners.branch_id IS 'NULL means available to all branches';
COMMENT ON COLUMN delivery_partners.commission_type IS 'percentage = % of order, fixed = fixed amount per order';
COMMENT ON COLUMN delivery_partners.commission_value IS 'Commission amount (percentage or fixed based on commission_type)';
COMMENT ON COLUMN delivery_partners.estimated_time IS 'Estimated delivery time in minutes';
COMMENT ON COLUMN delivery_partners.service_areas IS 'Comma-separated list of areas the partner serves';






