-- Migration: Create branches table for multi-branch support
-- Each business can have multiple branches
-- Branches share business-level config (products, recipes, etc.)
-- But have separate operational data (orders, employees, inventory quantities)

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    is_main BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique slug within a business
    UNIQUE(business_id, slug)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_branches_business_id ON branches(business_id);
CREATE INDEX IF NOT EXISTS idx_branches_is_main ON branches(is_main);

-- Add branch_id to business_users table (employees belong to specific branches)
ALTER TABLE business_users 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- Create index for branch lookups on users
CREATE INDEX IF NOT EXISTS idx_business_users_branch_id ON business_users(branch_id);

-- Add branch_count to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS branch_count INTEGER DEFAULT 1;

-- Add branch_id to orders table (orders belong to specific branches)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- Create index for branch lookups on orders
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);

-- Comment on table
COMMENT ON TABLE branches IS 'Store branches/locations for multi-branch businesses. Each branch shares business-level config but has separate operational data.';
COMMENT ON COLUMN branches.is_main IS 'Indicates if this is the main/headquarters branch';
COMMENT ON COLUMN branches.business_id IS 'Parent business that owns this branch';










