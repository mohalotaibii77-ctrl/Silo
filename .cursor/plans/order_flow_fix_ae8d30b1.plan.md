---
name: Order Flow Fix
overview: Simplify order statuses to 5 states (Pending, In-progress, Completed, Cancelled, Rejected), create missing database tables (customers, drivers), and add a Store Setup screen with Drivers management tab.
todos:
  - id: db-tables
    content: Create customers and drivers tables via Supabase migration
    status: completed
  - id: simplify-status
    content: Update OrderStatus type to 5 values in backend types
    status: completed
  - id: backend-routes
    content: Create customers and drivers API routes in backend
    status: completed
  - id: drivers-page
    content: Create drivers page in store-setup web app with sidebar link
    status: completed
  - id: drivers-api
    content: Create drivers-api.ts client in store-setup/lib
    status: completed
  - id: pos-customer-popup
    content: Add customer info popup for delivery orders in mobile POS
    status: completed
  - id: update-pos-service
    content: Update POS service to use new status flow with accept/reject
    status: completed
---

# Order Flow Simplification and Missing Tables

## Summary of Changes

### 1. Database Changes

**Simplify Order Statuses:**

- Current: 9 statuses (pending, confirmed, preparing, ready, out_for_delivery, completed, cancelled, refunded, failed)
- New: 5 statuses only

| Status | For | Description |

|--------|-----|-------------|

| `pending` | API orders only | Order received from delivery partner, awaiting accept/reject |

| `in_progress` | Both | First status for POS orders; API orders after acceptance |

| `completed` | Both | Order fulfilled |

| `cancelled` | Both | Order cancelled (after being in-progress) |

| `rejected` | API orders only | Store rejected the incoming order (never started) |

**Key Difference:**

- **Rejected** = Store said NO to an incoming API order (from Pending → Rejected)
- **Cancelled** = Order was cancelled after work started (from In-Progress → Cancelled)

Refunds will be handled via existing flags: `is_refunded`, `refund_amount`, `refunded_at`

**New Tables to Create:**

1. **`customers`** table:

   - `id`, `business_id`, `branch_id`
   - `name`, `phone`, `email`
   - `address`, `address_lat`, `address_lng`
   - `notes`, `is_active`
   - `created_at`, `updated_at`

2. **`drivers`** table:

   - `id`, `business_id`, `branch_id`
   - `name`, `name_ar`, `phone`, `email`
   - `vehicle_type`, `vehicle_number`
   - `status` (available, busy, offline)
   - `is_active`
   - `created_at`, `updated_at`

### 2. Backend Changes

**Files to modify:**

- [`Silo-system/backend/src/types/index.ts`](Silo-system/backend/src/types/index.ts) - Simplify OrderStatus type to 5 values
- [`Silo-system/backend/src/services/pos.service.ts`](Silo-system/backend/src/services/pos.service.ts) - Update order creation logic, add accept/reject methods
- [`Silo-system/backend/src/api/pos.routes.ts`](Silo-system/backend/src/api/pos.routes.ts) - Add accept/reject order endpoints
- [`Silo-system/backend/src/index.ts`](Silo-system/backend/src/index.ts) - Register new routes

**New files:**

- `Silo-system/backend/src/api/customers.routes.ts` - CRUD for customers (business/branch isolated)
- `Silo-system/backend/src/api/drivers.routes.ts` - CRUD for drivers (business/branch isolated)

### 3. Frontend Changes (Store Setup Web App - localhost:3002)

**Add Drivers management page** to existing store-setup app (Next.js):

**Files to create:**

- `Silo-system/store-setup/app/drivers/page.tsx` - Drivers management page (CRUD)
- `Silo-system/store-setup/lib/drivers-api.ts` - API client for drivers

**Files to modify:**

- [`Silo-system/store-setup/components/sidebar.tsx`](Silo-system/store-setup/components/sidebar.tsx) - Add "Drivers" menu item (below Tables)

**Drivers will be isolated by:**

- `business_id` - Each business has its own drivers
- `branch_id` - Drivers can be assigned to specific branch (optional, NULL = all branches)

### 3b. Mobile App Changes (React Native POS)

**Files to modify:**

- [`Silo-system/business-app/src/screens/POSScreen.tsx`](Silo-system/business-app/src/screens/POSScreen.tsx) - Add customer info popup for delivery orders created via POS

### 4. Order Flow Diagram

```mermaid
flowchart TD
    subgraph sources [Order Sources]
        POS[POS Terminal]
        API[Delivery Partner API]
    end
    
    subgraph pos_flow [POS Flow]
        POS --> InProgress1[In-Progress]
    end
    
    subgraph api_flow [API Flow]
        API --> Pending[Pending]
        Pending -->|Accept| InProgress2[In-Progress]
        Pending -->|Reject| Rejected[Rejected - Final]
    end
    
    InProgress1 --> Completed[Completed]
    InProgress1 --> Cancelled[Cancelled]
    InProgress2 --> Completed
    InProgress2 --> Cancelled
    
    Completed -->|Optional| Refund[Refund Flag]
```

**Status Transitions:**

- POS Order: `in_progress` → `completed` OR `cancelled`
- API Order: `pending` → `in_progress` (accept) OR `rejected` (reject)
- After accept: `in_progress` → `completed` OR `cancelled`

### 5. Localization

Add new translation keys for:

- Store Setup screen
- Drivers management
- Customer popup
- New order statuses