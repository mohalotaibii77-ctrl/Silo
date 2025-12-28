-- Add removable column to product_ingredients if it doesn't exist
ALTER TABLE product_ingredients 
ADD COLUMN IF NOT EXISTS removable BOOLEAN DEFAULT false;

-- Create product_modifiers table for add-ons (extra items with extra charge)
CREATE TABLE IF NOT EXISTS product_modifiers (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_id INT REFERENCES items(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  removable BOOLEAN DEFAULT false,
  addable BOOLEAN DEFAULT true,
  extra_price DECIMAL(10, 3) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_modifiers_product_id ON product_modifiers(product_id);







