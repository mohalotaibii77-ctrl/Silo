-- Add thumbnail_url columns to products and bundles tables
-- These store pre-generated thumbnail URLs for faster image loading

-- Add thumbnail_url to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add thumbnail_url to bundles table
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add logo_thumbnail_url to businesses table for business logos
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_thumbnail_url TEXT;

-- Create index for faster queries when filtering by images
CREATE INDEX IF NOT EXISTS idx_products_has_image ON products (business_id) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bundles_has_image ON bundles (business_id) WHERE image_url IS NOT NULL;

-- Comment explaining the purpose
COMMENT ON COLUMN products.thumbnail_url IS 'Pre-generated thumbnail URL for faster loading in list views';
COMMENT ON COLUMN bundles.thumbnail_url IS 'Pre-generated thumbnail URL for faster loading in list views';
COMMENT ON COLUMN businesses.logo_thumbnail_url IS 'Pre-generated thumbnail URL for business logo';




