-- Migration 054: Add checkout restriction settings
-- Allows businesses to control when employees can check out

ALTER TABLE operational_settings
ADD COLUMN IF NOT EXISTS min_shift_hours DECIMAL(4, 2) DEFAULT 4.0,
ADD COLUMN IF NOT EXISTS checkout_buffer_minutes_before INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS require_checkout_restrictions BOOLEAN DEFAULT TRUE;

-- Add comments for new columns
COMMENT ON COLUMN operational_settings.min_shift_hours IS 'Minimum hours an employee must work before being allowed to check out';
COMMENT ON COLUMN operational_settings.checkout_buffer_minutes_before IS 'Minutes before closing time that employees can check out';
COMMENT ON COLUMN operational_settings.require_checkout_restrictions IS 'Whether checkout time/hours restrictions are enforced';
