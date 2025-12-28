# Currency Policy and Enforcement

## Overview

This document describes the **strict currency enforcement system** implemented across the Silo platform. The core principle is: **Every business MUST have a currency set, with NO defaults and NO fallbacks anywhere in the system.**

## Core Principles

### 1. Single Source of Truth
- **Database Column**: `businesses.currency` (VARCHAR, NOT NULL)
- Currency is set once during business creation by Super Admin
- All frontends and services retrieve currency from this single source
- No component should ever have a hardcoded or fallback currency value

### 2. No Defaults, No Fallbacks
- Database has NO default value for currency column
- Backend APIs return errors if currency is missing
- Frontends block access if currency is not loaded
- All currency fallback code (e.g., `|| 'KWD'`) has been removed

### 3. Change Workflow
- Currency changes require Super Admin approval
- Owners submit change requests via the change request workflow
- Super Admin reviews and approves/rejects the request
- Changes apply immediately upon approval

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENCY LIFECYCLE                        │
└─────────────────────────────────────────────────────────────┘

1. BUSINESS CREATION (Super Admin)
   ├─> Super Admin selects currency from supported list
   ├─> Validation: Currency code must exist in /config/currencies
   ├─> Database: INSERT with currency (NOT NULL constraint)
   └─> Result: Business created with required currency

2. BUSINESS LOAD (Any User)
   ├─> Backend: Query businesses table
   ├─> Validation: Check currency field is not null/empty
   ├─> If missing: Return 500 error
   └─> If exists: Return business data to frontend

3. FRONTEND DISPLAY
   ├─> Receive business data from backend
   ├─> Validate currency exists
   ├─> Fetch currency symbol from /config/currencies
   └─> Display prices with proper formatting

4. CURRENCY CHANGE (Business Owner)
   ├─> Owner submits change request via /business-settings/change-requests
   ├─> Request status: pending
   ├─> Super Admin reviews in dashboard
   ├─> Super Admin approves: currency updated
   └─> Super Admin rejects: no change, owner notified
```

---

## Database Layer

### Schema

```sql
-- businesses table
CREATE TABLE businesses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(3) NOT NULL,  -- REQUIRED, NO DEFAULT
  -- ... other columns
);

-- Constraints
ALTER TABLE businesses 
  ALTER COLUMN currency SET NOT NULL;

ALTER TABLE businesses 
  ALTER COLUMN currency DROP DEFAULT;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_currency_valid CHECK (
    currency IN ('KWD', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'BHD', 'OMR', 
                 'EGP', 'JOD', 'LBP', 'INR', 'PKR', 'CNY', 'JPY', 'KRW', 'THB',
                 'MYR', 'SGD', 'AUD', 'CAD', 'CHF', 'TRY', 'RUB', 'BRL', 'MXN', 'ZAR')
  );
```

### Migration

**File**: `backend/migrations/049_enforce_currency_required.sql`

This migration:
1. Updates existing businesses with NULL currency (one-time fix)
2. Removes the default value
3. Adds NOT NULL constraint
4. Adds check constraint for valid currency codes

---

## Backend Layer

### Validation Points

#### 1. Business Creation (`business.service.ts`)

```typescript
// Validates currency is required and valid
if (!input.currency) {
  throw new Error('Currency is required');
}

if (!VALID_CURRENCIES.includes(input.currency)) {
  throw new Error(`Invalid currency code: ${input.currency}`);
}
```

#### 2. Business Load Endpoints (`business-settings.routes.ts`)

All endpoints that return business data validate currency exists:

- `GET /business-settings` (line 78-87)
- `GET /business-settings/localization` (line 135-147)
- `POST /business-settings/change-requests` (line 236-243)

```typescript
// Validate currency exists - no fallback allowed
if (!data.currency) {
  return res.status(500).json({ 
    error: 'Business configuration incomplete: currency not set. Contact administrator.' 
  });
}
```

### Supported Currencies

**Source**: `backend/src/api/config.routes.ts` (lines 132-161)

The backend serves 28 supported currencies via `/config/currencies`:

- KWD, USD, EUR, GBP, AED, SAR, QAR, BHD, OMR
- EGP, JOD, LBP, INR, PKR, CNY, JPY, KRW, THB
- MYR, SGD, AUD, CAD, CHF, TRY, RUB, BRL, MXN, ZAR

Each currency includes:
- `code`: ISO 4217 currency code
- `symbol`: Display symbol (e.g., $, €, SR)
- `name`: English name
- `name_ar`: Arabic name
- `decimals`: Number of decimal places (2 or 3)

---

## Frontend Layer

### Business App (React Native)

#### Files Updated

1. **SettingsScreen.tsx**
   - Removed `useState('KWD')` → `useState('')`
   - Removed `|| 'KWD'` fallbacks
   - Shows alert if currency missing

2. **LocalizationContext.tsx**
   - Removed hardcoded `CURRENCY_SYMBOLS` dictionary
   - Uses `ConfigContext.getCurrencySymbol()` from backend
   - Logs error if currency missing

3. **POSScreen.tsx**
   - Added validation on currency load (lines 1304, 1320)
   - Shows blocking alert if currency missing
   - Prevents POS access without currency

#### Currency Symbol Resolution

```typescript
// OLD (hardcoded)
const CURRENCY_SYMBOLS = { KWD: 'KD', USD: '$', ... };
const symbol = CURRENCY_SYMBOLS[code] || code;

// NEW (from backend)
import { useConfig } from '../context/ConfigContext';
const { getCurrencySymbol } = useConfig();
const symbol = getCurrencySymbol(code);  // Fetched from /config/currencies
```

### Store Setup (Next.js)

#### Files Updated

1. **app/settings/localization/page.tsx**
   - Removed `|| ''` fallbacks
   - Shows error message if currency missing

2. **lib/currency.ts**
   - `formatCurrency()` validates currency exists
   - Returns plain number if currency missing (defensive)

3. **lib/language-context.tsx**
   - Logs error if currency missing
   - Updates localStorage with currency from backend

4. **app/items/page.tsx**
   - `formatPrice()` validates currency exists
   - Returns plain number if currency missing

#### Components Updated

All item modals now use `config-context.getCurrencySymbol()`:
- `components/items/edit-price-modal.tsx`
- `components/items/add-composite-item-modal.tsx`
- `components/items/edit-item-modal.tsx`

---

## Error Handling

### Backend Errors

**Status 500** - Currency Missing
```json
{
  "success": false,
  "error": "Business configuration incomplete: currency not set. Contact administrator."
}
```

**Status 400** - Invalid Currency
```json
{
  "error": "Invalid currency code: INVALID. Must be one of: KWD, USD, EUR..."
}
```

### Frontend Behavior

**Business App**:
- Shows blocking alert
- Prevents app usage
- Message: "Business currency not set. Please contact your administrator."

**Store Setup**:
- Shows error message in UI
- Blocks page functionality
- Message: "Business currency not set. Please contact your administrator."

---

## Testing

### Backend Tests

**File**: `backend/tests/business.test.ts`

New test function: `testCurrencyValidation()`
- Verifies `GET /business-settings` returns currency
- Verifies `GET /business-settings/localization` returns currency
- Confirms no fallback values exist

**File**: `backend/tests/superadmin.test.ts`

New validation tests:
- Business creation without currency → 400 error
- Business creation with invalid currency → 400 error
- Business creation with valid currency → Success

### Running Tests

```bash
# Run all tests
npm run test:all

# Run specific tests
npm run test:business    # Business settings tests
npm run test:superadmin  # SuperAdmin tests
```

---

## Change Request Workflow

### Submit Change Request (Owner)

```typescript
POST /business-settings/change-requests
{
  "request_type": "localization",
  "new_currency": "EUR",
  "requester_notes": "Expanding to European market"
}
```

### Review Request (Super Admin)

1. Login to Super Admin dashboard
2. Navigate to change requests
3. View old and new currency values
4. Approve or reject with admin notes

### Apply Change (System)

On approval:
1. Update `businesses.currency = new_currency`
2. Update `business_change_requests.status = 'approved'`
3. Set `reviewed_by` and `reviewed_at`
4. Owner sees change reflected immediately

---

## Developer Guidelines

### When Adding New Features

**✅ DO:**
- Always retrieve currency from `business.currency` (no fallbacks)
- Use `getCurrencySymbol()` from ConfigContext/config-context
- Validate currency exists before using it
- Return error if currency is missing
- Add tests for currency validation

**❌ DON'T:**
- Hardcode currency codes (e.g., 'KWD', 'USD')
- Add fallback values (e.g., `|| 'KWD'`)
- Create new currency symbol dictionaries
- Assume currency always exists
- Skip currency validation in new endpoints

### Code Review Checklist

Before merging code that touches currency:

- [ ] No hardcoded currency codes
- [ ] No fallback values (e.g., `|| 'KWD'`)
- [ ] Uses `getCurrencySymbol()` from context
- [ ] Validates currency exists
- [ ] Returns appropriate error if missing
- [ ] Tests include currency validation
- [ ] Documentation updated if needed

---

## Troubleshooting

### Issue: Business Has No Currency

**Cause**: Database was created before currency enforcement migration

**Solution**:
1. Run migration: `049_enforce_currency_required.sql`
2. Migration sets NULL currencies to 'KWD' (one-time fix)
3. Contact Super Admin to update currency if needed

### Issue: Frontend Shows "Currency Not Set"

**Possible Causes**:
1. Business data not loaded from backend
2. Network error during business settings fetch
3. Token expired or invalid

**Debug Steps**:
1. Check browser/app console for API errors
2. Verify token is valid: `localStorage.getItem('token')`
3. Test API directly: `GET /business-settings`
4. Check backend logs for errors

### Issue: Currency Symbol Not Displaying

**Possible Causes**:
1. Config context not initialized
2. Currency code not in supported list
3. Backend `/config/currencies` endpoint failing

**Debug Steps**:
1. Verify config loads: check ConfigContext state
2. Check network tab for `/config/currencies` call
3. Verify currency code matches supported list
4. Check backend config.routes.ts for currency

---

## Migration Checklist

If updating an existing business that might have NULL currency:

1. **Backup database** before running migration
2. **Run migration**: `049_enforce_currency_required.sql`
3. **Verify**: `SELECT id, name, currency FROM businesses WHERE currency IS NULL;`
4. **Test**: Create test business, verify currency required
5. **Deploy**: Backend first, then frontends
6. **Monitor**: Check for currency-related errors in logs

---

## Summary

The currency enforcement system ensures:

✅ **Every business has a currency** (NOT NULL constraint)  
✅ **No default values** (must be explicitly set)  
✅ **No fallback values** (removed from all code)  
✅ **Single source of truth** (`businesses.currency`)  
✅ **Validated at all layers** (database, backend, frontend)  
✅ **Change workflow** (owner requests, admin approves)  
✅ **Comprehensive testing** (business & superadmin tests)  
✅ **Clear error messages** (configuration incomplete)

This architecture eliminates currency-related bugs and ensures data consistency across the entire platform.

---

**Last Updated**: December 2025  
**Migration**: `049_enforce_currency_required.sql`  
**Version**: 1.0

