-- Migration: Add delivery_partner_id to orders table
-- Links orders to delivery partners for POS-initiated delivery partner orders
-- When set, indicates the delivery partner handles payment (app_payment status)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_partner_id INTEGER;

-- Add foreign key constraint referencing delivery_partners table
DO $$ BEGIN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_delivery_partner
        FOREIGN KEY (delivery_partner_id) REFERENCES delivery_partners(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add comment
COMMENT ON COLUMN orders.delivery_partner_id IS 'Reference to delivery partner (Talabat, Jahez, etc.) - when set, partner handles payment';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON orders(delivery_partner_id) WHERE delivery_partner_id IS NOT NULL;


