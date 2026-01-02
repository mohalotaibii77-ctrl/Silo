# Run Tests

Run backend tests (unit and/or integration).

## Usage

```
/test                          # Run all tests (unit + integration)
/test unit                     # Run unit tests only
/test integration              # Run all integration tests
/test integration:inventory    # Run inventory integration tests
/test integration:products     # Run products integration tests
/test integration:pos          # Run POS integration tests
/test integration:users        # Run users integration tests
/test integration:business     # Run business integration tests
/test integration:delivery     # Run delivery integration tests
/test integration:config       # Run config integration tests
/test integration:superadmin   # Run superadmin integration tests
```

$ARGUMENTS

---

## Instructions

Navigate to `Silo-system/backend` and run the appropriate test command:

| Argument | Command |
|----------|---------|
| (none) or `all` | `npm run test:all` |
| `unit` | `npm run test:unit` |
| `integration` | `npm run test:integration:all` |
| `integration:inventory` | `npm run test:integration:inventory` |
| `integration:products` | `npm run test:integration:products` |
| `integration:pos` | `npm run test:integration:pos` |
| `integration:users` | `npm run test:integration:users` |
| `integration:business` | `npm run test:integration:business` |
| `integration:delivery` | `npm run test:integration:delivery` |
| `integration:config` | `npm run test:integration:config` |
| `integration:superadmin` | `npm run test:integration:superadmin` |

**Note:** Integration tests require the backend server to be running (`npm run dev`).

Working directory: `Silo-system/backend`
