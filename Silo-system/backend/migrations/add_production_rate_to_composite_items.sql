-- Migration: Add production rate fields to composite items
-- Production rate determines when/how often a composite item should be produced

-- Add production rate type: 'daily', 'weekly', 'monthly', or 'custom'
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS production_rate_type VARCHAR(20) DEFAULT NULL;

-- For weekly: day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS production_rate_weekly_day INTEGER DEFAULT NULL CHECK (production_rate_weekly_day >= 0 AND production_rate_weekly_day <= 6);

-- For monthly: day of month (1-31)
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS production_rate_monthly_day INTEGER DEFAULT NULL CHECK (production_rate_monthly_day >= 1 AND production_rate_monthly_day <= 31);

-- For custom: JSONB array of specific dates (stored as ISO date strings)
-- Example: ["2024-01-15", "2024-01-20", "2024-02-01"]
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS production_rate_custom_dates JSONB DEFAULT NULL;

-- Add constraint: production_rate_type must be one of the valid values
ALTER TABLE items 
ADD CONSTRAINT check_production_rate_type 
CHECK (
  production_rate_type IS NULL OR 
  production_rate_type IN ('daily', 'weekly', 'monthly', 'custom')
);

-- Add constraint: weekly_day must be set if type is 'weekly'
ALTER TABLE items 
ADD CONSTRAINT check_weekly_day_set 
CHECK (
  production_rate_type != 'weekly' OR production_rate_weekly_day IS NOT NULL
);

-- Add constraint: monthly_day must be set if type is 'monthly'
ALTER TABLE items 
ADD CONSTRAINT check_monthly_day_set 
CHECK (
  production_rate_type != 'monthly' OR production_rate_monthly_day IS NOT NULL
);

-- Add constraint: custom_dates must be set if type is 'custom'
ALTER TABLE items 
ADD CONSTRAINT check_custom_dates_set 
CHECK (
  production_rate_type != 'custom' OR production_rate_custom_dates IS NOT NULL
);

-- Add constraint: production rate fields should only be set for composite items
ALTER TABLE items 
ADD CONSTRAINT check_production_rate_composite_only 
CHECK (
  (production_rate_type IS NULL AND production_rate_weekly_day IS NULL AND 
   production_rate_monthly_day IS NULL AND production_rate_custom_dates IS NULL) OR
  is_composite = TRUE
);

-- Add comments for documentation
COMMENT ON COLUMN items.production_rate_type IS 'Production rate type: daily, weekly, monthly, or custom. Only for composite items.';
COMMENT ON COLUMN items.production_rate_weekly_day IS 'Day of week for weekly production (0=Sunday, 1=Monday, ..., 6=Saturday). Required if production_rate_type is weekly.';
COMMENT ON COLUMN items.production_rate_monthly_day IS 'Day of month for monthly production (1-31). Required if production_rate_type is monthly.';
COMMENT ON COLUMN items.production_rate_custom_dates IS 'JSONB array of ISO date strings for custom production schedule. Required if production_rate_type is custom.';







