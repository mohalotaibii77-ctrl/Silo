# Comprehensive Attendance & Leave Management System

## Overview

Build a complete attendance tracking and leave management system with:
1. **Calendar-based attendance view** (by employee + by date)
2. **Leave request system** (sick leave, vacation)
3. **Owner notification & approval workflow**
4. **Sick leave limit setting** in operational settings

---

## Current State

| Feature | Status |
|---------|--------|
| Attendance check-in/out | Implemented |
| Leaves tab in HRScreen | Placeholder only |
| Notification bell | Non-functional UI |
| Leave database tables | Not created |
| Operational settings | Extensible structure |

---

## Phase 1: Database Schema

### New Migration: `055_leave_management.sql`

```sql
-- Leave request types
CREATE TYPE leave_type AS ENUM ('sick', 'vacation', 'unpaid');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

-- Leave requests table
CREATE TABLE leave_requests (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  employee_id INTEGER NOT NULL REFERENCES business_users(id),
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5,2) NOT NULL,
  reason TEXT,
  document_url TEXT, -- For sick leave attachments
  status leave_status DEFAULT 'pending',
  reviewed_by INTEGER REFERENCES business_users(id),
  reviewed_at TIMESTAMP,
  reviewer_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Leave balances per employee per year
CREATE TABLE leave_balances (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES business_users(id),
  year INTEGER NOT NULL,
  sick_leave_total DECIMAL(5,2) DEFAULT 10,
  sick_leave_used DECIMAL(5,2) DEFAULT 0,
  vacation_total DECIMAL(5,2) DEFAULT 0,
  vacation_used DECIMAL(5,2) DEFAULT 0,
  UNIQUE(employee_id, year)
);

-- Add sick_leave_days_per_year to operational_settings
ALTER TABLE operational_settings
ADD COLUMN IF NOT EXISTS sick_leave_days_per_year DECIMAL(5,2) DEFAULT 10;

-- Indexes
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_business_status ON leave_requests(business_id, status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
```

---

## Phase 2: Backend API

### File: `backend/src/api/hr.routes.ts`

#### Employee Endpoints (authenticateUser)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/hr/leave-requests` | Submit leave request |
| GET | `/hr/leave-requests` | Get my leave requests |
| GET | `/hr/leave-balance` | Get my leave balance |
| DELETE | `/hr/leave-requests/:id` | Cancel pending request |

#### Manager/Owner Endpoints (authenticateManager)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hr/leave-requests/pending` | Get all pending requests |
| GET | `/hr/leave-requests/all` | Get all requests (with filters) |
| PUT | `/hr/leave-requests/:id/approve` | Approve request |
| PUT | `/hr/leave-requests/:id/reject` | Reject request |
| GET | `/hr/attendance/calendar` | Get calendar view data |

### File: `backend/src/services/hr.service.ts`

Add methods:
- `submitLeaveRequest(employeeId, data)` - Validate dates, check balance, create request
- `getLeaveRequests(employeeId, filters)` - Get requests with filters
- `getLeaveBalance(employeeId, year)` - Get/create leave balance
- `approveLeaveRequest(requestId, reviewerId, notes)` - Approve + update balance
- `rejectLeaveRequest(requestId, reviewerId, notes)` - Reject request
- `getAttendanceCalendar(businessId, branchId, startDate, endDate)` - Calendar data

---

## Phase 3: Attendance Calendar API

### New Endpoint: `GET /hr/attendance/calendar`

**Query params:** `start_date`, `end_date`, `employee_id` (optional), `branch_id` (optional)

**Response structure:**
```typescript
{
  employees: [{
    id: number,
    name: string,
    role: string,
    days: [{
      date: string,
      day_name: string,
      is_working_day: boolean,
      status: 'attended' | 'attended_late' | 'left_early' | 'late_left_early' | 'absent' | 'on_leave' | 'sick_leave' | 'rest_day',
      checkin_time: string | null,
      checkout_time: string | null,
      late_minutes: number,
      early_leave_minutes: number,
      total_hours: number | null,
      leave_request_id: number | null
    }]
  }],
  summary: {
    total_working_days: number,
    attended: number,
    late: number,
    absent: number,
    on_leave: number
  }
}
```

**Logic:**
1. Get all employees for business/branch
2. Get each employee's effective schedule (working days)
3. For each date in range:
   - Check if working day for this employee
   - Check attendance_records for actual check-in/out
   - Check leave_requests for approved leaves
   - Calculate status based on combined data

---

## Phase 4: Frontend - Business App

### 4.1 Update HRScreen Leaves Tab

**File:** `business-app/src/screens/HRScreen.tsx`

Replace placeholder with:
- **My Leave Balance** card (sick/vacation remaining)
- **Request Leave** button -> modal with:
  - Leave type selector (Sick/Vacation)
  - Date range picker
  - Reason text input
  - Document upload (for sick leave)
- **My Requests** list with status badges

### 4.2 Update OwnerAttendanceScreen

**File:** `business-app/src/screens/OwnerAttendanceScreen.tsx`

Redesign with tabs:
1. **By Date Tab** - Select date, see all employees' attendance
2. **By Employee Tab** - Select employee, see their calendar

**Status badges:**
- Green: Attended (on time, full shift)
- Yellow: Late (arrived late)
- Orange: Left Early (left before closing)
- Red: Absent (no show, no leave)
- Blue: On Leave (approved vacation)
- Purple: Sick Leave (approved sick)
- Gray: Rest Day (not scheduled)

**Expandable card details:**
- Check-in time with late indicator
- Check-out time with early indicator
- Total hours worked
- GPS location (if available)

### 4.3 Owner Notifications

**File:** `business-app/src/screens/OwnerDashboardScreen.tsx`

Make bell icon functional:
- Navigate to new `NotificationsScreen`
- Show badge count for pending leave requests

**New File:** `business-app/src/screens/NotificationsScreen.tsx`
- List pending leave requests
- Approve/Reject buttons
- Add reviewer notes

---

## Phase 5: Frontend - Store Setup

### 5.1 Operational Settings

**File:** `store-setup/app/settings/operational/page.tsx`

Add new section "Leave Management":
- Sick leave days per year (number input, default 10)
- Vacation days per year (future enhancement)

### 5.2 Attendance Page

**File:** `store-setup/app/attendance/page.tsx`

Redesign with:
- **Date selector** at top
- **View toggle:** By Date | By Employee
- **Employee cards** with status badges
- **Expandable details** on click
- **Leave indicator** for approved leaves

---

## Phase 6: Translations

**File:** `business-app/src/localization/translations.ts`

Add keys for both English and Arabic:
- Leave types, statuses
- Request form labels
- Calendar view labels
- Notification messages

---

## Implementation Order

### Step 0: Pre-Implementation Scan (REQUIRED)
Before creating ANY UI component, scan the codebase to identify:
- Existing UI components to REUSE (e.g., HRScreen Leaves tab - currently placeholder)
- Existing patterns to FOLLOW (modals, forms, lists)
- Components that need MODIFICATION vs NEW creation

**Known existing UI to MODIFY (not create):**
- `business-app/src/screens/HRScreen.tsx` - Has Leaves tab (placeholder) -> implement functionality
- `business-app/src/screens/OwnerAttendanceScreen.tsx` - Already created -> redesign with calendar
- `store-setup/app/attendance/page.tsx` - Already created -> redesign with calendar
- `business-app/src/screens/OwnerDashboardScreen.tsx` - Has bell icon -> make functional

### Step 1: Database & Backend Core
1. Create migration `055_leave_management.sql`
2. Add leave types to `backend/src/types/index.ts`
3. Implement leave service methods in `hr.service.ts`
4. Add leave API endpoints in `hr.routes.ts`

### Step 2: Attendance Calendar API
1. Implement `getAttendanceCalendar` in `hr.service.ts`
2. Add calendar endpoint in `hr.routes.ts`

### Step 3: Business App - Employee Side
1. **MODIFY** existing HRScreen Leaves tab (replace placeholder with functionality)
2. Add leave request form modal
3. Add leave balance display
4. Add translations

### Step 4: Business App - Owner Side
1. **MODIFY** existing OwnerAttendanceScreen with calendar view
2. **CREATE** NotificationsScreen (only if no existing one found)
3. **MODIFY** bell icon in OwnerDashboardScreen to navigate to notifications
4. Add translations

### Step 5: Store Setup
1. **MODIFY** operational settings page - add sick/vacation days settings
2. **MODIFY** existing attendance page with calendar view

### Step 6: Testing & Polish
1. Test full leave request flow
2. Test attendance calendar accuracy
3. Verify RTL support

---

## Subagent Strategy for Implementation

Use separate subagents for:
1. **Backend Implementation** - Database, types, services, routes
2. **Business App Employee UI** - HRScreen leaves functionality
3. **Business App Owner UI** - OwnerAttendanceScreen calendar, notifications
4. **Store Setup UI** - Settings and attendance page
5. **Translations** - All language strings
6. **Final Scan & Test** - Verify all components work together

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `backend/migrations/055_leave_management.sql` |
| MODIFY | `backend/src/types/index.ts` |
| MODIFY | `backend/src/services/hr.service.ts` |
| MODIFY | `backend/src/api/hr.routes.ts` |
| MODIFY | `business-app/src/screens/HRScreen.tsx` |
| MODIFY | `business-app/src/screens/OwnerAttendanceScreen.tsx` |
| CREATE | `business-app/src/screens/NotificationsScreen.tsx` |
| MODIFY | `business-app/src/screens/OwnerDashboardScreen.tsx` |
| MODIFY | `business-app/src/navigation/AppNavigator.tsx` |
| MODIFY | `business-app/src/localization/translations.ts` |
| MODIFY | `store-setup/app/settings/operational/page.tsx` |
| MODIFY | `store-setup/app/attendance/page.tsx` |

---

## Status Badge Definitions

### Check-in/Check-out Rules

**"On Time" check-in:**
- Checked in within the starting buffer window
- Example: Opening 9:00 AM, buffer 15 min -> check-in by 9:15 AM is "on time"

**"Proper" check-out:**
- Checked out within the ending buffer window (closing - buffer to closing)
- AND completed minimum required hours (if restrictions enabled)
- Example: Closing 6:00 PM, buffer 30 min, min hours 8 -> can checkout from 5:30 PM if worked 8+ hours

### Status Definitions

| Badge | Check-in | Check-out | Description |
|-------|----------|-----------|-------------|
| **Attended** | On time | Proper | Perfect attendance |
| **Attended Late** | Late | Proper | Arrived late but worked full shift |
| **Left Early** | On time | Before allowed | Arrived on time but left too early |
| **Late + Left Early** | Late | Before allowed | Arrived late AND left early |
| **Absent** | None | N/A | No check-in after buffer, no approved leave |
| **On Leave** | N/A | N/A | Approved vacation for this date |
| **Sick Leave** | N/A | N/A | Approved sick leave for this date |
| **Rest Day** | N/A | N/A | Not a scheduled working day |

### "Left Early" Conditions (any of these)
1. Checked out before (closing time - checkout buffer)
2. Did not complete minimum shift hours (if restrictions enabled)

### Status Transitions
- **Absent** -> **Late**: If employee checks in after buffer passed
- **Absent** -> **Sick Leave**: If sick leave submitted and approved for that day

---

## Absent Detection Logic

**Real-time absent marking:**
1. After check-in buffer time passes (e.g., opening + 30 min buffer)
2. If employee hasn't checked in AND no approved leave exists
3. Mark as **Absent** in attendance_records
4. If employee later checks in -> status changes to **Late**
5. If employee submits sick leave for today -> status changes to **Sick Leave** (pending approval)

**Background job or on-demand calculation:**
- When viewing attendance, calculate status based on:
  - Current time vs check-in deadline
  - Existing attendance_records
  - Approved leave_requests

---

## Vacation Days Configuration

**Operational Settings additions:**
- `sick_leave_days_per_year` (default: 10)
- `vacation_days_per_year` (default: 21)

**Leave Balance tracking:**
- Each employee gets annual balance initialized from settings
- Balance decremented when leave approved
- Balance resets at year start (or configurable)
