-- Add branch_id to vendors table
-- NULL means vendor is available to all branches
-- A specific branch_id means vendor is only for that branch

ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vendors_branch_id ON vendors(branch_id);

-- Add comment
COMMENT ON COLUMN vendors.branch_id IS 'NULL = vendor available to all branches, otherwise only for specific branch';











