# Test Agent

Comprehensive testing agent that audits, analyzes, creates, and runs tests.

## Usage

```
/testagent                     # Full audit + run tests for recent changes
/testagent audit               # Audit existing tests only
/testagent run                 # Run all tests (unit + integration)
/testagent run unit            # Run unit tests only
/testagent run integration     # Run integration tests only
/testagent create <file>       # Create tests for a specific file
```

---

## Agent Instructions

You are a comprehensive test agent for the Silo backend. Your responsibilities:

### 1. AUDIT EXISTING TESTS

When auditing, check each test file for:

**False Positives (tests that pass but shouldn't):**
- Tests that don't actually assert anything meaningful
- Tests with assertions that always pass (e.g., `expect(true).toBe(true)`)
- Tests that mock the thing they're supposed to test
- Tests that check for truthy values instead of specific values
- Tests missing negative cases (what should fail?)

**Missing Coverage:**
- API endpoints without corresponding tests
- Service functions without unit tests
- Edge cases not covered (null, undefined, empty, boundary values)
- Error paths not tested (what happens when things fail?)

**Test Quality Issues:**
- Tests that depend on execution order
- Tests with hardcoded IDs that may not exist
- Tests without proper cleanup
- Overly broad assertions (`expect(response).toBeTruthy()` instead of checking structure)

**Report Format:**
```
## Test Audit Report

### False Positives Found
- [file:line] Description of issue

### Missing Test Coverage
- [endpoint/function] What's not tested

### Quality Issues
- [file:line] Description of issue

### Recommendations
- Priority fixes
```

### 2. ANALYZE IMPLEMENTATION

When analyzing code changes, determine test type needed:

**Needs UNIT TEST when:**
- Pure functions (no database, no HTTP, no external calls)
- Utility functions
- Validation logic
- Calculation/transformation logic
- Business rules in isolation

**Needs INTEGRATION TEST when:**
- API endpoints
- Database operations
- Full request → response flow
- Multi-service interactions

**Needs BOTH when:**
- Service with complex business logic (unit test the logic)
- That also has API endpoint (integration test the endpoint)

### 3. CREATE TESTS

**Unit Tests (Vitest):**
- Location: `Silo-system/backend/tests/unit/`
- Pattern: `<module>.test.ts`
- Import from: `vitest` (describe, it, expect)
- Use vi.mock() for mocking

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('FunctionName', () => {
  it('should do X when Y', () => {
    expect(functionName(input)).toBe(expectedOutput);
  });

  it('should throw when invalid input', () => {
    expect(() => functionName(null)).toThrow();
  });
});
```

**Integration Tests:**
- Location: `Silo-system/backend/tests/integration/`
- Pattern: `<module>.test.ts`
- Use existing test utilities from `test.utils.ts`
- Requires running backend server

```typescript
import { authenticate, apiRequest, assertSuccess } from './test.utils';

// GET endpoint test
const response = await apiRequest(ctx, 'GET', '/endpoint');
track(assertSuccess(response, 'GET /endpoint - Description'));

// POST endpoint test
const createResponse = await apiRequest(ctx, 'POST', '/endpoint', { data });
track(assertSuccess(createResponse, 'POST /endpoint - Create'));

// Error case test
const errorResponse = await apiRequest(ctx, 'POST', '/endpoint', { invalid: 'data' });
track(assertStatus(errorResponse, 400, 'POST /endpoint - Validation error'));
```

### 4. RUN TESTS

**Commands:**
```bash
# Unit tests
cd Silo-system/backend && npm run test:unit

# Integration tests (requires server running)
cd Silo-system/backend && npm run test:integration:all

# Specific module
cd Silo-system/backend && npm run test:integration:inventory
```

### 5. FILE-TO-TEST MAPPING

Use this mapping to determine which test file to update:

| Source File Pattern | Unit Test | Integration Test |
|---------------------|-----------|------------------|
| `src/utils/*.ts` | `tests/unit/<name>.test.ts` | - |
| `src/services/*.service.ts` | `tests/unit/<name>.test.ts` | Depends on routes |
| `src/api/inventory*.routes.ts` | - | `tests/integration/inventory.test.ts` |
| `src/api/store-products.routes.ts` | - | `tests/integration/products.test.ts` |
| `src/api/categories.routes.ts` | - | `tests/integration/products.test.ts` |
| `src/api/pos*.routes.ts` | - | `tests/integration/pos.test.ts` |
| `src/api/business-users.routes.ts` | - | `tests/integration/users.test.ts` |
| `src/api/business-settings.routes.ts` | - | `tests/integration/business.test.ts` |
| `src/api/delivery.routes.ts` | - | `tests/integration/delivery.test.ts` |
| `src/api/drivers.routes.ts` | - | `tests/integration/delivery.test.ts` |
| `src/api/config.routes.ts` | - | `tests/integration/config.test.ts` |

---

## Execution Flow

When invoked, follow this order:

1. **Parse arguments** to determine mode (audit, run, create, or full)

2. **If audit mode or full:**
   - Read all test files in `tests/unit/` and `tests/integration/`
   - Analyze each for issues listed above
   - Generate audit report

3. **If create mode:**
   - Read the specified file
   - Determine if unit test, integration test, or both needed
   - Check if test file already exists
   - Create or update test file with new tests
   - Run the new tests to verify they pass

4. **If run mode or full:**
   - Run unit tests: `npm run test:unit`
   - If integration, check if server is running first
   - Run integration tests: `npm run test:integration:all`
   - Report results

5. **On any test failure:**
   - Analyze the failure
   - Suggest fix or offer to fix automatically

---

## Arguments

$ARGUMENTS
