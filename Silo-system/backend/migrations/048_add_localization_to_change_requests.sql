-- Migration: Add localization and tax columns to business_change_requests table
-- This allows tracking currency, language, timezone, and VAT change requests

-- Update request_type constraint to include localization and tax types
ALTER TABLE business_change_requests 
DROP CONSTRAINT IF EXISTS business_change_requests_request_type_check;

ALTER TABLE business_change_requests 
ADD CONSTRAINT business_change_requests_request_type_check 
CHECK (request_type IN ('info', 'logo', 'certificate', 'localization', 'tax'));

-- Add localization columns
ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS new_currency TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS new_language TEXT;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS new_timezone TEXT;

-- Add tax/VAT columns
ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS new_vat_enabled BOOLEAN;

ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS new_vat_rate NUMERIC(5,2);

-- Add requester notes column for businesses to explain their request
ALTER TABLE business_change_requests 
ADD COLUMN IF NOT EXISTS requester_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN business_change_requests.new_currency IS 'New currency code (e.g., KWD, SAR, USD)';
COMMENT ON COLUMN business_change_requests.new_language IS 'New language preference (en, ar)';
COMMENT ON COLUMN business_change_requests.new_timezone IS 'New timezone (e.g., Asia/Kuwait)';
COMMENT ON COLUMN business_change_requests.new_vat_enabled IS 'New VAT enabled status';
COMMENT ON COLUMN business_change_requests.new_vat_rate IS 'New VAT rate percentage';
COMMENT ON COLUMN business_change_requests.requester_notes IS 'Notes from the business explaining the change request';





