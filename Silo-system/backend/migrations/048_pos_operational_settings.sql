-- Add POS Operation settings to operational_settings table
-- These control how POS sessions are opened and who can manage them

ALTER TABLE operational_settings
ADD COLUMN IF NOT EXISTS pos_opening_float_fixed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pos_opening_float_amount DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS pos_session_allowed_user_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Add comments explaining the new columns
COMMENT ON COLUMN operational_settings.pos_opening_float_fixed IS 'Whether opening float is a fixed amount (true) or entered by employee (false)';
COMMENT ON COLUMN operational_settings.pos_opening_float_amount IS 'Fixed opening float amount if pos_opening_float_fixed is true';
COMMENT ON COLUMN operational_settings.pos_session_allowed_user_ids IS 'Array of user IDs allowed to open/close POS sessions. Empty array means all users with POS permission can open/close sessions';


