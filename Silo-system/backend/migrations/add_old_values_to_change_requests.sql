-- Migration: Add old/current values to business_change_requests
-- This allows super admin to see what the value was BEFORE the requested change

-- Profile fields - old values
ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_name TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_email TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_phone TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_address TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_logo_url TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_certificate_url TEXT;

-- Localization fields - old values
ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_currency TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_language TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_timezone TEXT;

-- Tax fields - old values
ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_vat_enabled BOOLEAN;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS old_vat_rate DECIMAL(5,2);

-- Add requester_notes if it doesn't exist
ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS requester_notes TEXT;



