-- Migration: Simplify order_source enum
-- Removes hardcoded delivery partner names and uses 'api' for all external API orders
-- The specific delivery partner is identified via delivery_partner_id column
--
-- Old values: pos, talabat, jahez, hungerstation, careem, toyou, mrsool, deliveroo, ubereats, phone, website, mobile_app, walk_in, other
-- New values: pos, api, phone, website, mobile_app, walk_in, other

-- =====================================================
-- STEP 1: Migrate existing data to use 'api' for delivery partners
-- =====================================================

-- First, update any existing orders with delivery partner sources to 'other' temporarily
-- (We'll use 'other' as intermediate since 'api' might not exist yet)
UPDATE orders 
SET order_source = 'other'
WHERE order_source IN ('talabat', 'jahez', 'hungerstation', 'careem', 'toyou', 'mrsool', 'deliveroo', 'ubereats');

-- =====================================================
-- STEP 2: Recreate the ENUM type with new values
-- =====================================================

-- Create new enum type
DO $$ BEGIN
    CREATE TYPE order_source_new AS ENUM (
        'pos', 'api', 'phone', 'website', 'mobile_app', 'walk_in', 'other'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Alter column to use new type (if using ENUM)
-- Note: If your DB uses VARCHAR with CHECK constraint instead of ENUM, this will be handled differently

-- Try to alter column type (this works if order_source is VARCHAR)
DO $$ 
BEGIN
    -- Check if column is VARCHAR (not ENUM)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_source' AND data_type = 'character varying'
    ) THEN
        -- No type change needed for VARCHAR
        RAISE NOTICE 'order_source is VARCHAR, no type change needed';
    ELSE
        -- Column might be ENUM, try to convert
        ALTER TABLE orders 
        ALTER COLUMN order_source TYPE order_source_new 
        USING order_source::text::order_source_new;
        
        -- Drop old enum type if it exists
        DROP TYPE IF EXISTS order_source;
        
        -- Rename new type to order_source
        ALTER TYPE order_source_new RENAME TO order_source;
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not alter column type: %', SQLERRM;
END $$;

-- =====================================================
-- STEP 3: Update orders that were migrated to 'other' to 'api'
-- =====================================================

-- Now that 'api' exists, update the temporary 'other' values back
-- We identify them by having a delivery_partner_id set
UPDATE orders 
SET order_source = 'api'
WHERE order_source = 'other' AND delivery_partner_id IS NOT NULL;

-- =====================================================
-- STEP 4: Add comment for documentation
-- =====================================================

COMMENT ON COLUMN orders.order_source IS 
'Where the order originated: pos (POS terminal), api (external delivery partner API), phone, website, mobile_app, walk_in, other. Specific delivery partner identified by delivery_partner_id.';


