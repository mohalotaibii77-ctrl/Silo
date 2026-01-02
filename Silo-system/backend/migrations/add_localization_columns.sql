-- Migration: Add localization columns to businesses table
-- Run this in Supabase SQL Editor

-- Add country column
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Kuwait';

-- Add currency column
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KWD';

-- Add language column (en or ar)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Add timezone column
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kuwait';

-- Create business_change_requests table for profile change requests
CREATE TABLE IF NOT EXISTS business_change_requests (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('info', 'logo', 'certificate')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  new_name TEXT,
  new_email TEXT,
  new_phone TEXT,
  new_address TEXT,
  new_logo_url TEXT,
  new_certificate_url TEXT,
  admin_notes TEXT,
  reviewed_by INTEGER,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_business_change_requests_business_id ON business_change_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_business_change_requests_status ON business_change_requests(status);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON business_change_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON business_change_requests TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE business_change_requests_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE business_change_requests_id_seq TO authenticated;










