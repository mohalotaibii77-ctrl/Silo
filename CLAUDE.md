# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Silo is a multi-tenant Restaurant Operating System with a Node.js/Express backend and multiple frontends for different user roles.

## Architecture

**Backend as the Single Engine**: ALL business logic, calculations, validations, and data processing MUST happen in the backend. Frontends are purely visual interfaces that display what the backend provides.

```
Silo-system/
├── backend/          # Node.js + Express + TypeScript (Port 9000)
├── super-admin/      # Next.js 16 - Platform management (Port 3000)
├── business-app/     # Expo (React Native) - Owner/Manager/Employee app
├── store-setup/      # Next.js - Store onboarding (Port 3001)
└── Main/             # Next.js - Marketing website
```

The backend is a **Modular Monolith** containing all microservices (POS, Inventory, HR, Accounting, Operations, QHSE, etc.) and serves as the single source of truth for all frontends.

## Development Commands

### Backend (Silo-system/backend)
```bash
npm run dev                       # Start dev server (port 9000)
npm run build                     # TypeScript compilation
npm run lint                      # ESLint

# Unit Tests (Vitest - no server needed)
npm run test:unit                 # Run all unit tests
npm run test:unit:watch           # Watch mode
npm run test:unit:coverage        # With coverage report

# Integration Tests (requires running server)
npm run test:integration:all      # Run all integration tests
npm run test:integration:inventory
npm run test:integration:products
npm run test:integration:pos
npm run test:integration:users
npm run test:integration:business
npm run test:integration:delivery
npm run test:integration:config
npm run test:integration:superadmin

# Aliases (backward compatible)
npm run test:all                  # Unit + Integration
npm run test:inventory            # Same as test:integration:inventory
```

### Super Admin (Silo-system/super-admin)
```bash
npm run dev    # Start dev server (port 3000)
npm run build  # Production build
npm run lint   # ESLint
```

### Business App (Silo-system/business-app)
```bash
npm start          # Start Expo dev server
npm run start:tunnel  # Start with tunnel (for mobile testing)
npm run web        # Web only
```

### PowerShell Shortcuts (from repo root)
Source the script: `. .\dev-shortcuts.ps1`
- `k` - Kill all dev ports (9000, 3000, 3001, 3002, 8081, 19000+)
- `bb` - Run Backend
- `s` - Run SuperAdmin
- `ss` - Run Store Setup
- `bs` - Run Business App
- `bst` - Run Business App with Tunnel
- `m` - Run Main Marketing Website

## Core Workflow Documentation

**CRITICAL**: Before implementing any feature related to orders, payments, or inventory, you MUST read the corresponding workflow documentation:

| Workflow | Documentation |
|----------|--------------|
| Orders | `backend/ORDER_WORKFLOW.md` |
| Payments | `backend/PAYMENT_WORKFLOW.md` |
| Inventory | `backend/INVENTORY_FLOW.md` |

After implementing changes to these workflows, UPDATE the documentation in the same session.

## Backend Structure

```
backend/src/
├── api/           # Route handlers (*.routes.ts)
├── services/      # Business logic (*.service.ts)
├── middleware/    # Auth, validation middleware
├── config/        # Database, environment config
├── types/         # TypeScript interfaces
└── utils/         # Shared utilities
```

## Test Structure

```
backend/tests/
├── unit/                    # Vitest unit tests (isolated, no server)
│   └── *.test.ts
└── integration/             # Integration tests (requires server)
    ├── test.config.ts
    ├── test.utils.ts
    └── *.test.ts
```

**File-to-Test Mapping:**

| Source File | Unit Test | Integration Test |
|-------------|-----------|------------------|
| `src/utils/*.ts` | `tests/unit/<name>.test.ts` | - |
| `src/services/*.service.ts` | `tests/unit/<name>.test.ts` | Depends on routes |
| `src/api/inventory*.routes.ts` | - | `tests/integration/inventory.test.ts` |
| `src/api/store-products.routes.ts` | - | `tests/integration/products.test.ts` |
| `src/api/pos*.routes.ts` | - | `tests/integration/pos.test.ts` |
| `src/api/business-users.routes.ts` | - | `tests/integration/users.test.ts` |
| `src/api/business-settings.routes.ts` | - | `tests/integration/business.test.ts` |
| `src/api/delivery.routes.ts` | - | `tests/integration/delivery.test.ts` |
| `src/api/config.routes.ts` | - | `tests/integration/config.test.ts` |

## Testing Requirements

**Unit Tests** (for isolated logic):
- Pure functions, utilities, validation, calculations
- Use Vitest: `import { describe, it, expect } from 'vitest'`
- No external dependencies - mock everything

**Integration Tests** (for API endpoints):
- Every API endpoint MUST have a test
- Test: success path, validation errors (400), not found (404)
- Requires running backend server

**Use `/testagent` skill** to:
- Audit existing tests for issues
- Create missing tests
- Run tests after implementation

## Key Principles

1. **Frontend NEVER processes business data** - only displays what backend provides
2. **Exception for UX**: Frontends may show preview calculations while filling forms (mark with comment: `// UI preview only - backend calculates actual value on save`)
3. **This project uses "Silo" database project only** - don't modify other projects
4. **No documentation files** unless explicitly requested

## Tech Stack

- **Backend**: Node.js 20+, Express, TypeScript, PostgreSQL (Supabase), JWT auth, Zod validation
- **SuperAdmin**: Next.js 16, React 19, TailwindCSS v4, Zustand
- **Business App**: Expo 54, React Native, React Navigation
- **Store Setup**: Next.js 16, React 19, TailwindCSS v4

## User Roles

- **Super Admin**: Platform-level access, manage all businesses
- **Business Owner**: Full business access, HR, accounting, operations
- **Operations Manager**: Daily operations, task management
- **Employee**: POS access, check-in/out, task completion
