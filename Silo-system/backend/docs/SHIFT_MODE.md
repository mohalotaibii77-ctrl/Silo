# POS Shift Mode - Future Implementation Guide

## Overview

This document outlines the **Shift Mode** feature for individual cash drawer accountability. This is a future enhancement to the current **Shared Drawer** model.

---

## Current Model: Shared Drawer (Implemented)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SHARED DRAWER MODEL (Current Implementation)                        │
│                                                                     │
│  • One cash drawer session per day/shift                            │
│  • Manager opens session with starting float                        │
│  • Multiple employees share the same drawer                         │
│  • PIN identifies WHO processed each order (for attribution)        │
│  • Manager counts and closes at end of day                          │
│  • Cash variance is at the session level, not per-employee          │
│                                                                     │
│  Best for: Fast-paced restaurants, trusted teams, simplicity        │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Database Schema

```sql
-- pos_sessions table (existing)
CREATE TABLE pos_sessions (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  branch_id INTEGER,
  session_number VARCHAR(50) NOT NULL,
  cashier_id INTEGER NOT NULL,        -- Who opened the session
  cashier_name VARCHAR(100) NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_float DECIMAL(10,2) NOT NULL,
  total_cash_sales DECIMAL(10,2) DEFAULT 0,
  total_cash_received DECIMAL(10,2) DEFAULT 0,
  total_change_given DECIMAL(10,2) DEFAULT 0,
  expected_cash DECIMAL(10,2),
  actual_cash_count DECIMAL(10,2),
  variance DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'open',
  opening_notes TEXT,
  closing_notes TEXT
);

-- Orders tagged with employee who processed them
CREATE TABLE orders (
  ...
  cashier_id INTEGER,     -- Employee who processed the order
  pos_session_id INTEGER, -- Links to the shared session
  ...
);
```

---

## Future Model: Shift Mode (Individual Accountability)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SHIFT MODE (Future Implementation)                                  │
│                                                                     │
│  • Each employee has their own "shift" within the session           │
│  • Employee A takes over drawer → counts in                         │
│  • Employee A works → all transactions tracked to them              │
│  • Employee A hands off → counts out                                │
│  • Employee B counts in (verifies) → takes ownership                │
│  • Each handoff = cash accountability transfer                      │
│                                                                     │
│  Best for: High-value cash, low trust, individual accountability    │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation Requirements

#### 1. Database Changes

```sql
-- New table: Employee shifts within a session
CREATE TABLE pos_employee_shifts (
  id SERIAL PRIMARY KEY,
  pos_session_id INTEGER REFERENCES pos_sessions(id),
  employee_id INTEGER NOT NULL,
  employee_name VARCHAR(100) NOT NULL,
  
  -- Shift timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Cash tracking for this shift
  counted_in DECIMAL(10,2) NOT NULL,      -- Cash count when taking over
  expected_at_handoff DECIMAL(10,2),       -- System calculated expected
  counted_out DECIMAL(10,2),               -- Actual count when handing off
  variance DECIMAL(10,2),                  -- Difference (counted_out - expected)
  
  -- Handoff details
  handed_off_to INTEGER,                   -- Next employee ID
  handoff_verified BOOLEAN DEFAULT FALSE,  -- Did next employee verify count?
  handoff_notes TEXT,
  
  status VARCHAR(20) DEFAULT 'active'      -- active, handed_off, closed
);

-- Add business setting for shift mode
ALTER TABLE businesses ADD COLUMN pos_shift_mode_enabled BOOLEAN DEFAULT FALSE;

-- Update orders to track employee shift
ALTER TABLE orders ADD COLUMN pos_employee_shift_id INTEGER REFERENCES pos_employee_shifts(id);
```

#### 2. Backend API Endpoints

```typescript
// New endpoints for shift mode

// Start employee shift (take over drawer)
POST /api/pos-sessions/:sessionId/start-shift
Body: { employee_id, counted_in, notes? }
Response: { shift_id, employee_name, started_at, counted_in }

// End employee shift (hand off drawer)
POST /api/pos-sessions/shifts/:shiftId/end
Body: { counted_out, notes?, hand_off_to_employee_id? }
Response: { shift, variance, expected, actual }

// Verify handoff (next employee confirms count)
POST /api/pos-sessions/shifts/:shiftId/verify-handoff
Body: { employee_id, verified_amount }
Response: { verified, discrepancy_if_any }

// Get shift summary for employee
GET /api/pos-sessions/shifts/:shiftId/summary
Response: { 
  employee, 
  transactions: [...], 
  cash_received, 
  change_given, 
  expected, 
  actual?, 
  variance? 
}

// Get all shifts for a session
GET /api/pos-sessions/:sessionId/shifts
Response: { shifts: [...] }
```

#### 3. Frontend Changes

```typescript
// New component: ShiftHandoffScreen
// Shown when:
// 1. Employee enters different PIN (not same as current shift owner)
// 2. Shift mode is enabled in business settings

interface ShiftHandoffFlow {
  // Step 1: Current employee counts out
  currentEmployeeCountOut: number;
  
  // Step 2: Next employee verifies count
  nextEmployeeVerification: {
    verified: boolean;
    discrepancy?: number;
    accepted: boolean;
  };
  
  // Step 3: Next employee counts in (should match)
  nextEmployeeCountIn: number;
}

// Blind count feature
// Employee enters their count WITHOUT seeing expected amount first
// Prevents "adjusting" count to match expected
interface BlindCountMode {
  showExpectedAfterCount: boolean;  // Only show expected after they enter actual
  requireRecount: boolean;          // If variance > threshold, require recount
  varianceThreshold: number;        // e.g., 5.00 (only alert if variance > $5)
}
```

#### 4. Business Settings UI

Add to Settings > POS Settings:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Cash Drawer Mode                                                   │
│                                                                     │
│  ○ Shared Drawer (Current)                                         │
│    Multiple employees share one drawer. Cash accountability         │
│    is tracked at the session level.                                │
│                                                                     │
│  ○ Shift Mode                                                       │
│    Each employee owns the drawer during their shift.               │
│    Handoffs require counting and verification.                     │
│                                                                     │
│  [Save]                                                             │
└─────────────────────────────────────────────────────────────────────┘

│  Shift Mode Options (if enabled)                                    │
│                                                                     │
│  ☑ Blind count mode (employee can't see expected until counted)    │
│  ☑ Require manager approval for variance > $10                     │
│  ☑ Allow skip verification (trusted handoffs)                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Flow Comparison

### Current Flow (Shared Drawer)

```
Manager opens session (9:00 AM)
    ↓
Employee A enters PIN → processes orders (tagged to A)
    ↓
Employee B enters PIN → processes orders (tagged to B)
    ↓
Employee A enters PIN → processes more orders (tagged to A)
    ↓
Manager closes session (10:00 PM)
    ↓
Count drawer → variance for entire day
```

### Future Flow (Shift Mode)

```
Manager opens session (9:00 AM)
    ↓
Employee A starts shift → counts in $200
    ↓
Employee A processes orders
    ↓
Employee A ends shift (2:00 PM)
    ↓
  └── Counts out: $850 (expected: $855)
  └── Variance: -$5 (recorded against Employee A)
    ↓
Employee B starts shift → verifies $850 → counts in $850
    ↓
Employee B processes orders
    ↓
Employee B ends shift (10:00 PM)
    ↓
  └── Counts out: $1,200 (expected: $1,195)
  └── Variance: +$5 (recorded against Employee B)
    ↓
Manager closes session
    ↓
Report shows: Employee A: -$5, Employee B: +$5, Net: $0
```

---

## Reporting Enhancements

With Shift Mode enabled, add these reports:

### 1. Employee Cash Accountability Report

| Employee | Shifts | Total Handled | Avg Variance | Total Variance |
|----------|--------|---------------|--------------|----------------|
| John D.  | 15     | $12,450       | -$0.33       | -$5.00         |
| Jane S.  | 12     | $9,800        | +$0.42       | +$5.00         |
| Mike R.  | 8      | $6,200        | $0.00        | $0.00          |

### 2. Shift Details Report

| Date | Session | Employee | Start | End | In | Out | Expected | Variance |
|------|---------|----------|-------|-----|-----|-----|----------|----------|
| Dec 25 | #1234 | John D. | 9:00 | 14:00 | $200 | $850 | $855 | -$5 |
| Dec 25 | #1234 | Jane S. | 14:00 | 22:00 | $850 | $1,200 | $1,195 | +$5 |

### 3. Variance Alert Report

Shows shifts with variance exceeding threshold:
- Large shortages flagged for manager review
- Patterns identified (same employee, same time, etc.)

---

## Migration Path

When enabling Shift Mode for existing businesses:

1. **Setting Change**: Enable `pos_shift_mode_enabled` in business settings
2. **Current Session**: Complete any open sessions under old model
3. **New Sessions**: All new sessions use Shift Mode
4. **Historical Data**: Remains unchanged (shared drawer attribution)

---

## Security Considerations

1. **Manager Override**: All shift operations logged, manager can void/adjust
2. **Audit Trail**: Every count, handoff, and variance permanently recorded
3. **Cameras**: Recommend camera coverage of cash drawer area
4. **PIN Security**: PINs are unique per business, stored hashed

---

## Timeline Estimate

| Phase | Tasks | Estimate |
|-------|-------|----------|
| 1. Database | New tables, migrations | 2-3 hours |
| 2. Backend API | New endpoints, service | 4-6 hours |
| 3. Frontend | Handoff flow, settings | 6-8 hours |
| 4. Reports | New reports/dashboards | 4-6 hours |
| 5. Testing | End-to-end testing | 4-6 hours |
| **Total** | | **20-29 hours** |

---

## Summary

- **Current State**: Shared Drawer model is implemented and working
- **Shift Mode**: Future enhancement for businesses needing individual accountability
- **Trigger**: Business setting toggle
- **Impact**: Additional counting/verification steps at employee changes
- **Benefit**: Know exactly who is responsible for any cash variance


