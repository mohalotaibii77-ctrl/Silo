-- Migration: Add product_categories table
-- Run this in Supabase SQL Editor

-- Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_product_categories_business_id ON product_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_is_system ON product_categories(is_system);

-- Insert default/general categories (is_system = true, business_id = null)
INSERT INTO product_categories (name, name_ar, is_system, display_order) VALUES
('Burgers', 'برجر', TRUE, 1),
('Sandwiches', 'سندويشات', TRUE, 2),
('Pizza', 'بيتزا', TRUE, 3),
('Grills', 'مشويات', TRUE, 4),
('Steaks', 'ستيك', TRUE, 5),
('Mijots', 'مجوت', TRUE, 6),
('Pasta', 'باستا', TRUE, 7),
('Salads', 'سلطات', TRUE, 8),
('Soups', 'شوربات', TRUE, 9),
('Appetizers', 'مقبلات', TRUE, 10),
('Main Courses', 'أطباق رئيسية', TRUE, 11),
('Seafood', 'مأكولات بحرية', TRUE, 12),
('Chicken', 'دجاج', TRUE, 13),
('Rice Dishes', 'أطباق الأرز', TRUE, 14),
('Breakfast', 'فطور', TRUE, 15),
('Desserts', 'حلويات', TRUE, 16),
('Ice Cream', 'آيس كريم', TRUE, 17),
('Fresh Juices', 'عصائر طازجة', TRUE, 18),
('Smoothies', 'سموثي', TRUE, 19),
('Carbonated Drinks', 'مشروبات غازية', TRUE, 20),
('Hot Beverages', 'مشروبات ساخنة', TRUE, 21),
('Cold Beverages', 'مشروبات باردة', TRUE, 22),
('Kids Menu', 'قائمة الأطفال', TRUE, 23),
('Sides', 'إضافات', TRUE, 24),
('Sauces', 'صوصات', TRUE, 25)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON product_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_categories TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE product_categories_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE product_categories_id_seq TO authenticated;

-- Add category_id column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL;

-- Create index for category lookup
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

