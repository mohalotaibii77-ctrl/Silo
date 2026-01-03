-- Migration 051: Create attendance_records table for employee check-in/out tracking
-- Stores GPS-verified attendance data with on-time/late/absent status

CREATE TABLE IF NOT EXISTS attendance_records (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    employee_id INTEGER NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,

    -- The date this attendance record is for
    date DATE NOT NULL,

    -- Check-in data
    checkin_time TIMESTAMP WITH TIME ZONE,
    checkin_latitude DECIMAL(10, 8),
    checkin_longitude DECIMAL(11, 8),
    checkin_accuracy_meters DECIMAL(8, 2),
    checkin_distance_meters DECIMAL(8, 2),
    checkin_device_info JSONB,

    -- Check-out data
    checkout_time TIMESTAMP WITH TIME ZONE,
    checkout_latitude DECIMAL(10, 8),
    checkout_longitude DECIMAL(11, 8),
    checkout_accuracy_meters DECIMAL(8, 2),
    checkout_distance_meters DECIMAL(8, 2),
    checkout_device_info JSONB,

    -- Calculated fields
    total_hours DECIMAL(5, 2),

    -- Status: on_time, late, absent, checked_in, checked_out, rest_day
    status VARCHAR(20) DEFAULT 'checked_in'
        CHECK (status IN ('on_time', 'late', 'absent', 'checked_in', 'checked_out', 'rest_day')),

    -- Minutes late if status is 'late'
    late_minutes INTEGER DEFAULT 0,

    -- Audit fields for manual adjustments
    notes TEXT,
    adjusted_by INTEGER REFERENCES business_users(id),
    adjustment_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one attendance record per employee per date
    CONSTRAINT unique_employee_attendance_date UNIQUE (employee_id, date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_business_date ON attendance_records(business_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON attendance_records(branch_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(business_id, status, date);
CREATE INDEX IF NOT EXISTS idx_attendance_checkin_time ON attendance_records(checkin_time);

-- Enable RLS
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "attendance_records_select_policy" ON attendance_records
    FOR SELECT USING (true);

CREATE POLICY "attendance_records_insert_policy" ON attendance_records
    FOR INSERT WITH CHECK (true);

CREATE POLICY "attendance_records_update_policy" ON attendance_records
    FOR UPDATE USING (true);

CREATE POLICY "attendance_records_delete_policy" ON attendance_records
    FOR DELETE USING (true);

-- Comments
COMMENT ON TABLE attendance_records IS 'Historical record of employee check-ins and check-outs with GPS verification data';
COMMENT ON COLUMN attendance_records.date IS 'The working day this attendance record is for';
COMMENT ON COLUMN attendance_records.status IS 'Attendance status: on_time, late, absent, checked_in (active), checked_out, rest_day';
COMMENT ON COLUMN attendance_records.late_minutes IS 'Number of minutes late if status is late';
COMMENT ON COLUMN attendance_records.checkin_distance_meters IS 'Distance from branch location at check-in time';
