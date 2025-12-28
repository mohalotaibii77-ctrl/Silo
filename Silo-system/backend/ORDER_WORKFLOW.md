# Order Workflow Documentation

> **Last Updated:** December 2024  
> **Version:** 2.0

## Overview

This document describes the complete order workflow in the Silo POS system, including order sources, statuses, transitions, and access control.

---

## Order Sources

Orders can originate from multiple sources:

| Source | Code | Description |
|--------|------|-------------|
| POS Terminal | `pos` | Direct orders from the point-of-sale terminal |
| Walk-in | `walk_in` | Customers who walk in without prior order |
| Phone | `phone` | Orders taken over the phone |
| External API | `api` | Orders from delivery partner APIs (Talabat, Jahez, etc.) |
| Website | `website` | Online orders from business website |
| Mobile App | `mobile_app` | Orders from business mobile app |
| Other | `other` | Other sources |

> **Note:** The specific delivery partner is identified via `delivery_partner_id`, which references the business's configured delivery partners in the `delivery_partners` table. This allows businesses to use any delivery partner (major platforms or local services) without code changes.

---

## Order Types

| Type | Code | Description |
|------|------|-------------|
| Dine In | `dine_in` | Customer eats at the restaurant |
| Takeaway | `takeaway` | Customer takes food to go |
| Delivery | `delivery` | Food delivered to customer |
| Drive Thru | `drive_thru` | Customer picks up at drive-thru |

---

## Order Statuses

The system uses 6 statuses:

| Status | Code | Description |
|--------|------|-------------|
| Pending | `pending` | Reserved for future use (scheduled orders) |
| In Progress | `in_progress` | Order is being prepared (initial status for all orders) |
| Completed | `completed` | Food is ready - for delivery orders, waiting for driver pickup |
| Picked Up | `picked_up` | **Delivery orders only** - Driver has collected the order |
| Cancelled | `cancelled` | Order cancelled |
| Rejected | `rejected` | Reserved for future use |

---

## Order Flow Diagrams

### POS Orders (walk_in, phone, pos - Dine-in, Takeaway, Drive-thru)

```
┌─────────────────┐
│   CREATE ORDER  │
│   (POS Terminal)│
└────────┬────────┘
         │
         ▼
   ┌───────────┐
   │IN_PROGRESS│ ◄──── Initial status
   └─────┬─────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌─────────┐
│COMPLETED│ │CANCELLED│
└────────┘ └─────────┘
     │
     ▼
  Order Done
  (Customer served)
```

### Delivery Partner API Orders (Jahez, Talabat, HungerStation, etc.)

```
┌──────────────────────────┐
│  ORDER FROM DELIVERY APP │
│  (via API integration)   │
└───────────┬──────────────┘
            │
            ▼
      ┌───────────┐
      │IN_PROGRESS│ ◄──── Direct to kitchen (shows in POS Orders tab)
      └─────┬─────┘
            │
       ┌────┴────┐
       │         │
       ▼         ▼
┌───────────┐ ┌─────────┐
│ COMPLETED │ │CANCELLED│
└─────┬─────┘ └─────────┘
      │
      │ (Food ready, waiting for driver)
      │
      ▼ POS marks pickup
┌───────────┐
│ PICKED_UP │ ◄──── Driver collected the order
└───────────┘
      │
      ▼
   Order Done
```

---

## Access Control

### Who Can Do What

| Action | Who Has Access | Location | Notes |
|--------|---------------|----------|-------|
| **Create Order** | Users with `pos_access` permission | POS Terminal | New orders from POS |
| **Edit Order** | Users with `pos_access` permission | POS Terminal | Only POS orders, `pending` or `in_progress` status |
| **Complete Order** | Depends on kitchen mode (see below) | Kitchen Display or Orders tab | Marks food as ready |
| **Mark Picked Up** | Users with `pos_access` permission | POS Terminal | Only delivery orders in `completed` status |
| **Cancel Order** | Any business user | POS/Management | `pending` or `in_progress` orders |
| **View Orders** | Users with `orders` permission | Business App | Managers have permission by default |

#### Complete Order Access by Kitchen Mode
| Kitchen Mode | Who Can Complete | How |
|-------------|-----------------|-----|
| `display` (default) | `kitchen_display` role | Tap "Ready" on Kitchen Display screen |
| `receipt_scan` | Users with `orders` permission | Scan QR code in Orders tab |

> **Note:** `pos_access` permission can be granted to any employee. Owners always have full access.

### Middleware Implementation

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND MIDDLEWARE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  requirePOSAccess          →  owner, pos role, OR pos_access    │
│  requireKitchenAccess      →  kitchen_display only              │
│  requireBusinessAccess     →  Any authenticated business user   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Route Protection

| Endpoint | Middleware | Access |
|----------|------------|--------|
| `PATCH /api/pos/orders/:id/edit` | `requirePOSAccess` | POS only |
| `POST /api/pos/orders/:id/complete` | `requireKitchenAccess` | Kitchen Display mode only |
| `POST /api/pos/orders/scan-complete` | `requireBusinessAccess` | Receipt Scan mode - users with `orders` permission |
| `POST /api/pos/orders/:id/pickup` | `requirePOSAccess` | POS only |
| `POST /api/pos/orders/:id/cancel` | `requireBusinessAccess` | Any business user |
| `GET /api/pos/orders` | `requireBusinessAccess` | Any business user |

---

## Order Editing Rules

1. **Only POS orders can be edited** - API orders from delivery partners cannot be modified
2. **Status restriction** - Orders with status `pending` or `in_progress` can be edited
3. **Permission restriction** - Only users with `pos_access` permission can edit orders
4. **What can be edited:**
   - Add items
   - Remove items
   - Modify quantities
   - Change modifiers
5. **What happens on edit:**
   - Order is marked as `is_edited = true` (for kitchen display color coding)
   - If total increases after payment, `remaining_amount` is updated
   - Timeline event is logged for audit

---

## Order Completion Rules

### Kitchen Operation Modes

The system supports two modes for completing orders, configured in **Settings → Operations → Kitchen Settings**:

#### Mode 1: Kitchen Display (Default)
- Dedicated screen/tablet in kitchen shows incoming orders
- Kitchen staff taps "Ready" to mark order as completed
- Requires `kitchen_display` role to access

#### Mode 2: Receipt Scan
- QR code is printed on each receipt
- Receipt travels with the order through kitchen
- When food is ready, employee opens **Orders** tab and taps **Scan** button
- Scans QR code from receipt to complete order
- Requires `orders` permission to use scanner

> **Note:** Receipt Scan mode is ideal for small restaurants that don't use kitchen displays. The workflow mirrors traditional paper-based kitchen operations.

### Completion Rules

1. **Kitchen Display mode:** Only `kitchen_display` role can complete orders
2. **Receipt Scan mode:** Users with `orders` permission can complete via scan
3. **Only `in_progress` orders can be completed**
4. **On completion:**
   - Inventory is consumed (deducted from stock)
   - Payment status is finalized
   - Timeline event is logged
4. **For delivery orders:** `completed` means "food ready for pickup" - not end of workflow

---

## Order Pickup Rules (Delivery Orders Only)

1. **POS is the only place to mark orders as picked up**
2. **Only `completed` delivery orders can be marked as picked up**
3. **On pickup:**
   - Status changes to `picked_up`
   - Timeline event is logged
   - Order workflow is complete

---

## Delivery Partner Integration

### Incoming Orders
- Orders from delivery partners arrive via webhook/API
- Initial status: `in_progress` (immediately goes to kitchen)
- Orders appear in the POS Orders tab alongside all other orders

### Order Flow
1. **Order arrives** → `in_progress` (kitchen starts preparing)
2. **Kitchen completes** → `completed` (food ready, waiting for driver)
3. **Driver picks up** → `picked_up` (POS marks when driver collects)

### Order Visibility
- All delivery partner orders show in the POS Orders tab
- Kitchen Display shows orders to prepare
- POS can see completed delivery orders awaiting pickup

---

## Timeline Events

Every order action is logged for audit trail:

| Event Type | Description |
|------------|-------------|
| `created` | Order created |
| `item_added` | Item added to order |
| `item_removed` | Item removed from order |
| `item_modified` | Item quantity/variant/modifiers changed |
| `status_changed` | Order status changed |
| `payment_received` | Payment received |
| `payment_updated` | Payment status changed |
| `cancelled` | Order cancelled |
| `completed` | Order completed |
| `ingredient_wasted` | Ingredient marked as waste |
| `ingredient_returned` | Ingredient returned to inventory |

---

## Payment Flow

> **See Also:** [PAYMENT_WORKFLOW.md](./PAYMENT_WORKFLOW.md) for complete payment documentation.

### Payment Methods
- `cash` - Cash payment
- `card` - Card payment (all card types)

### Payment Statuses
- `pending` - Awaiting payment (dine-in pay later, delivery COD)
- `paid` - Payment received
- `app_payment` - Delivery partner handles payment
- `refunded` - Payment refunded
- `cancelled` - Payment cancelled

### Payment Timing by Order Type
| Order Type | Payment Timing | Initial Status |
|------------|----------------|----------------|
| Takeaway/Drive Thru | Upfront required | `paid` |
| Dine-in (Pay Now) | Upfront | `paid` |
| Dine-in (Pay Later) | After eating | `pending` → `paid` |
| Delivery (Card) | Upfront | `paid` |
| Delivery (Cash/COD) | Driver collects → cashier | `pending` → `paid` |
| API Orders | Partner handles | `app_payment` |

---

## Best Practices

1. **POS operators** should focus on order creation and editing
2. **Kitchen display** should only mark orders complete when food is ready
3. **Managers** can view and monitor all orders but editing is restricted to POS
4. **API orders** flow through delivery partner devices - don't build accept/reject UI
5. Always check `is_edited` flag in kitchen display to highlight modified orders

---

## Related Files

- **Middleware:** `backend/src/middleware/auth.middleware.ts`
- **Routes:** `backend/src/api/pos.routes.ts`
- **Service:** `backend/src/services/pos.service.ts`
- **Types:** `backend/src/types/index.ts`
- **Timeline Service:** `backend/src/services/order-timeline.service.ts`
- **Migrations:** `backend/migrations/add_order_workflow_tables.sql`

