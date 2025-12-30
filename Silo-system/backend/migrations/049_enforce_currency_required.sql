-- Migration: Enforce currency as required field
-- Run this in Supabase SQL Editor or via migration script

-- IMPORTANT: This migration ensures no business can exist without a currency
-- It removes the default value and makes currency NOT NULL

-- Step 1: Update any existing businesses that have NULL or empty currency
-- Setting them to KWD as a one-time fix for existing data
UPDATE businesses 
SET currency = 'KWD' 
WHERE currency IS NULL OR currency = '';

-- Step 2: Remove the default value from currency column
-- No more defaults - currency must be explicitly set
ALTER TABLE businesses 
ALTER COLUMN currency DROP DEFAULT;

-- Step 3: Make currency NOT NULL
-- This prevents any business from being created without a currency
ALTER TABLE businesses 
ALTER COLUMN currency SET NOT NULL;

-- Step 4: Add check constraint to ensure valid currency codes
-- Only allow currencies that are in the supported list
ALTER TABLE businesses
ADD CONSTRAINT businesses_currency_valid CHECK (
  currency IN (
    'KWD', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'BHD', 'OMR',
    'EGP', 'JOD', 'LBP', 'INR', 'PKR', 'CNY', 'JPY', 'KRW', 'THB',
    'MYR', 'SGD', 'AUD', 'CAD', 'CHF', 'TRY', 'RUB', 'BRL', 'MXN', 'ZAR'
  )
);

-- Add comment
COMMENT ON COLUMN businesses.currency IS 'Currency code (ISO 4217) - REQUIRED, no default. Must be set by super admin during business creation.';


