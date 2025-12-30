-- Operational Settings table for business workflow configuration
CREATE TABLE IF NOT EXISTS operational_settings (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Order Settings
  order_number_prefix VARCHAR(10) DEFAULT 'ORD',
  auto_accept_orders BOOLEAN DEFAULT FALSE,
  require_customer_phone BOOLEAN DEFAULT FALSE,
  allow_order_notes BOOLEAN DEFAULT TRUE,
  
  -- Timing Settings
  order_preparation_time INTEGER DEFAULT 15, -- in minutes
  kitchen_display_auto_clear INTEGER DEFAULT 30, -- in minutes
  
  -- Business Hours
  opening_time TIME DEFAULT '09:00',
  closing_time TIME DEFAULT '22:00',
  
  -- Notifications
  enable_order_notifications BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one settings record per business
  CONSTRAINT unique_business_operational_settings UNIQUE (business_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_operational_settings_business_id ON operational_settings(business_id);

-- Enable RLS
ALTER TABLE operational_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (similar to receipt_settings)
CREATE POLICY "operational_settings_select_policy" ON operational_settings
  FOR SELECT USING (true);

CREATE POLICY "operational_settings_insert_policy" ON operational_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "operational_settings_update_policy" ON operational_settings
  FOR UPDATE USING (true);

CREATE POLICY "operational_settings_delete_policy" ON operational_settings
  FOR DELETE USING (true);



