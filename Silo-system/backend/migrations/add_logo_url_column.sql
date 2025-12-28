-- Migration: Add logo_url column to businesses table
-- Run this in Supabase SQL Editor

-- Add logo_url column to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create storage bucket for business assets (logos and certificates)
-- Note: This may need to be done via Supabase dashboard or Storage API
-- The bucket should be created with:
-- - Name: business-assets
-- - Public: true
-- - File size limit: 5MB
-- - Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml, application/pdf

-- Grant public access to the storage bucket (run these policies in storage policies)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('business-assets', 'business-assets', true)
-- ON CONFLICT (id) DO NOTHING;







