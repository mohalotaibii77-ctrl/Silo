-- Migration 052: Create employee_schedule_overrides table for Special Attendance
-- Allows owners to set custom working hours/days for specific employees

CREATE TABLE IF NOT EXISTS employee_schedule_overrides (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,

    -- Override working days (null = use business default)
    -- Format: ["sunday", "monday", "tuesday", "wednesday", "thursday"]
    working_days JSONB,

    -- Override working hours (null = use business default)
    opening_time TIME,
    closing_time TIME,

    -- Override check-in buffer (null = use business default)
    checkin_buffer_minutes_before INTEGER,
    checkin_buffer_minutes_after INTEGER,

    -- Metadata
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one override per employee
    CONSTRAINT unique_employee_schedule_override UNIQUE (business_id, employee_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_business ON employee_schedule_overrides(business_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_employee ON employee_schedule_overrides(employee_id);
CREATE INDEX IF NOT EXISTS idx_schedule_overrides_active ON employee_schedule_overrides(business_id, is_active)
WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE employee_schedule_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "schedule_overrides_select_policy" ON employee_schedule_overrides
    FOR SELECT USING (true);

CREATE POLICY "schedule_overrides_insert_policy" ON employee_schedule_overrides
    FOR INSERT WITH CHECK (true);

CREATE POLICY "schedule_overrides_update_policy" ON employee_schedule_overrides
    FOR UPDATE USING (true);

CREATE POLICY "schedule_overrides_delete_policy" ON employee_schedule_overrides
    FOR DELETE USING (true);

-- Comments
COMMENT ON TABLE employee_schedule_overrides IS 'Per-employee schedule overrides for special attendance rules. NULL values mean use business default.';
COMMENT ON COLUMN employee_schedule_overrides.working_days IS 'Override working days array e.g. ["sunday","monday","tuesday"]. NULL = use business default';
COMMENT ON COLUMN employee_schedule_overrides.opening_time IS 'Override opening time for this employee. NULL = use business default';
COMMENT ON COLUMN employee_schedule_overrides.closing_time IS 'Override closing time for this employee. NULL = use business default';
COMMENT ON COLUMN employee_schedule_overrides.is_active IS 'Whether this override is currently active';
