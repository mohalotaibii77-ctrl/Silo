-- Migration 050: Add geofence configuration for GPS-based check-in
-- Adds GPS coordinates and geofence settings to branches
-- Adds working days and check-in buffer settings to operational_settings

-- Add GPS coordinates and geofence configuration to branches table
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS geofence_enabled BOOLEAN DEFAULT FALSE;

-- Add comments for new columns
COMMENT ON COLUMN branches.latitude IS 'GPS latitude of branch location for geofence check-in';
COMMENT ON COLUMN branches.longitude IS 'GPS longitude of branch location for geofence check-in';
COMMENT ON COLUMN branches.geofence_radius_meters IS 'Radius in meters for geofence check-in boundary (default 100m)';
COMMENT ON COLUMN branches.geofence_enabled IS 'Whether GPS-based check-in is required for this branch';

-- Add working days and check-in settings to operational_settings
ALTER TABLE operational_settings
ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]'::jsonb,
ADD COLUMN IF NOT EXISTS require_gps_checkin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checkin_buffer_minutes_before INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS checkin_buffer_minutes_after INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS gps_accuracy_threshold_meters INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS default_geofence_radius_meters INTEGER DEFAULT 100;

-- Add comments for new operational settings columns
COMMENT ON COLUMN operational_settings.working_days IS 'Array of working days e.g. ["sunday","monday","tuesday","wednesday","thursday","friday"]';
COMMENT ON COLUMN operational_settings.require_gps_checkin IS 'Whether GPS-based check-in is required for employees';
COMMENT ON COLUMN operational_settings.checkin_buffer_minutes_before IS 'Minutes before opening time that employees can check in';
COMMENT ON COLUMN operational_settings.checkin_buffer_minutes_after IS 'Minutes after closing time that employees can still check out';
COMMENT ON COLUMN operational_settings.gps_accuracy_threshold_meters IS 'Maximum GPS accuracy in meters to accept a check-in';
COMMENT ON COLUMN operational_settings.default_geofence_radius_meters IS 'Default geofence radius for branches that do not have a custom setting';

-- Create index for geofence-enabled branches
CREATE INDEX IF NOT EXISTS idx_branches_geofence_enabled ON branches(business_id, geofence_enabled)
WHERE geofence_enabled = TRUE;
