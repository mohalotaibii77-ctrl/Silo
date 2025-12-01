-- POS Products with Variants and Modifiers
-- Run this migration in Supabase SQL Editor

-- Categories for organizing products
CREATE TABLE IF NOT EXISTS pos_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS pos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES pos_categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200),
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'active', -- active, deleted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variant groups (e.g., "Size", "Type")
CREATE TABLE IF NOT EXISTS pos_product_variant_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- "Size", "Type"
  name_ar VARCHAR(100),
  required BOOLEAN DEFAULT TRUE, -- Must select one option
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variant options (e.g., "Small", "Medium", "Large" or "Original", "Spicy")
CREATE TABLE IF NOT EXISTS pos_product_variant_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_group_id UUID NOT NULL REFERENCES pos_product_variant_groups(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- "Large", "Spicy"
  name_ar VARCHAR(100),
  price_adjustment DECIMAL(10,2) DEFAULT 0, -- +5 for Large
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product modifiers (items that can be removed or added)
CREATE TABLE IF NOT EXISTS pos_product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES pos_products(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- "Tomato", "Onion", "Extra Cheese"
  name_ar VARCHAR(100),
  removable BOOLEAN DEFAULT TRUE, -- Can be removed (No Tomato)
  addable BOOLEAN DEFAULT FALSE, -- Can be added extra (Extra Cheese)
  extra_price DECIMAL(10,2) DEFAULT 0, -- Price if added extra
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pos_products_business ON pos_products(business_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_category ON pos_products(category_id);
CREATE INDEX IF NOT EXISTS idx_pos_categories_business ON pos_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_pos_variant_groups_product ON pos_product_variant_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_pos_variant_options_group ON pos_product_variant_options(variant_group_id);
CREATE INDEX IF NOT EXISTS idx_pos_modifiers_product ON pos_product_modifiers(product_id);

-- Enable RLS
ALTER TABLE pos_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_product_variant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_product_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_product_modifiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow service role full access)
CREATE POLICY "Service role full access to pos_categories" ON pos_categories FOR ALL USING (true);
CREATE POLICY "Service role full access to pos_products" ON pos_products FOR ALL USING (true);
CREATE POLICY "Service role full access to pos_product_variant_groups" ON pos_product_variant_groups FOR ALL USING (true);
CREATE POLICY "Service role full access to pos_product_variant_options" ON pos_product_variant_options FOR ALL USING (true);
CREATE POLICY "Service role full access to pos_product_modifiers" ON pos_product_modifiers FOR ALL USING (true);

