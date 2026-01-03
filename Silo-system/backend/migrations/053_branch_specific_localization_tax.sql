-- Migration 053: Add branch-specific localization and tax settings
-- Each branch can have its own currency, language, timezone, country, and tax settings
-- Falls back to business defaults if null

-- Add localization columns to branches table
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS currency VARCHAR(10),
ADD COLUMN IF NOT EXISTS language VARCHAR(10),
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50),
ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Add tax columns to branches table
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS vat_enabled BOOLEAN,
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100);

-- Add comments for new columns
COMMENT ON COLUMN branches.currency IS 'Branch-specific currency code (e.g., KWD, USD). Falls back to business.currency if null.';
COMMENT ON COLUMN branches.language IS 'Branch-specific language code (e.g., en, ar). Falls back to business.language if null.';
COMMENT ON COLUMN branches.timezone IS 'Branch-specific timezone (e.g., Asia/Kuwait). Falls back to business.timezone if null.';
COMMENT ON COLUMN branches.country IS 'Branch-specific country. Falls back to business.country if null.';
COMMENT ON COLUMN branches.vat_enabled IS 'Whether VAT is enabled for this branch. Falls back to business.vat_enabled if null.';
COMMENT ON COLUMN branches.tax_rate IS 'Tax rate percentage for this branch. Falls back to business.tax_rate if null.';
COMMENT ON COLUMN branches.tax_number IS 'Tax registration number for this branch. Falls back to business.tax_number if null.';

-- Grant permissions
GRANT ALL ON branches TO authenticated;
GRANT ALL ON branches TO service_role;
GRANT ALL ON branches TO anon;
