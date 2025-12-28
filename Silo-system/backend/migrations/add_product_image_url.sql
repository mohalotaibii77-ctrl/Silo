-- Add image_url column to products table
-- This allows products to have an associated image

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN products.image_url IS 'URL to the product image stored in Supabase storage';







