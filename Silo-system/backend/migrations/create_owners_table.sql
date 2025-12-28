-- Migration: Create owners and business_owners tables
-- Owners are platform-level accounts that can own multiple businesses
-- This enables a workspace model where one owner manages multiple restaurants

-- Create owners table (platform-level owner accounts)
CREATE TABLE IF NOT EXISTS owners (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create business_owners junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS business_owners (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'owner', -- In case we want different owner roles (primary owner, co-owner, etc.)
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique owner-business combination
    UNIQUE(owner_id, business_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);
CREATE INDEX IF NOT EXISTS idx_owners_status ON owners(status);
CREATE INDEX IF NOT EXISTS idx_business_owners_owner_id ON business_owners(owner_id);
CREATE INDEX IF NOT EXISTS idx_business_owners_business_id ON business_owners(business_id);

-- Add owner_id column to businesses table (optional: for primary owner reference)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS primary_owner_id INTEGER REFERENCES owners(id) ON DELETE SET NULL;

-- Create index for primary owner lookups
CREATE INDEX IF NOT EXISTS idx_businesses_primary_owner_id ON businesses(primary_owner_id);

-- Comments
COMMENT ON TABLE owners IS 'Platform-level owner accounts that can own multiple businesses (workspace model)';
COMMENT ON TABLE business_owners IS 'Junction table linking owners to their businesses (many-to-many)';
COMMENT ON COLUMN business_owners.role IS 'Role of the owner in the business (owner, co-owner, etc.)';
COMMENT ON COLUMN businesses.primary_owner_id IS 'The primary owner of the business (optional reference)';







