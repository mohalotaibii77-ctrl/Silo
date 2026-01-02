-- Migration: Create receipt_settings table
-- Description: Stores receipt configuration per business for POS receipt printing

CREATE TABLE IF NOT EXISTS receipt_settings (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Logo for receipt (can be different from business logo)
  receipt_logo_url TEXT,
  
  -- Language settings
  print_languages TEXT[] DEFAULT ARRAY['en']::TEXT[],  -- Array of language codes
  main_language VARCHAR(10) DEFAULT 'en',
  
  -- Header and Footer
  receipt_header TEXT,
  receipt_footer TEXT,
  
  -- Display options
  show_order_number BOOLEAN DEFAULT true,
  show_subtotal BOOLEAN DEFAULT true,
  show_closer_username BOOLEAN DEFAULT false,
  show_creator_username BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one setting per business
  CONSTRAINT unique_business_receipt_settings UNIQUE (business_id)
);

-- Add comment to table
COMMENT ON TABLE receipt_settings IS 'Stores receipt configuration per business for POS receipt printing';

-- Add comments to columns
COMMENT ON COLUMN receipt_settings.receipt_logo_url IS 'URL to logo image printed on receipts (can differ from main business logo)';
COMMENT ON COLUMN receipt_settings.print_languages IS 'Array of language codes for receipt printing (e.g., en, ar)';
COMMENT ON COLUMN receipt_settings.main_language IS 'Primary language used when receipt is printed';
COMMENT ON COLUMN receipt_settings.receipt_header IS 'Custom text shown at the top of the receipt';
COMMENT ON COLUMN receipt_settings.receipt_footer IS 'Custom text shown at the bottom of the receipt';
COMMENT ON COLUMN receipt_settings.show_order_number IS 'Whether to display order number on receipt';
COMMENT ON COLUMN receipt_settings.show_subtotal IS 'Whether to display subtotal (before taxes) with final price';
COMMENT ON COLUMN receipt_settings.show_closer_username IS 'Whether to display the order closer username';
COMMENT ON COLUMN receipt_settings.show_creator_username IS 'Whether to display the order creator username';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_receipt_settings_business_id ON receipt_settings(business_id);





