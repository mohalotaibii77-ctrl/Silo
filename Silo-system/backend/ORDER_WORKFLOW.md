# Order Workflow Documentation

> **Last Updated:** December 2024  
> **Version:** 2.1

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
| Pending | `pending` | API orders awaiting acceptance/rejection on delivery partner's device |
| In Progress | `in_progress` | Order is being prepared (initial status for POS orders, and for accepted API orders) |
| Completed | `completed` | Food is ready - for delivery orders, waiting for driver pickup |
| Picked Up | `picked_up` | **Delivery orders only** - Driver has collected the order |
| Cancelled | `cancelled` | Order cancelled |
| Rejected | `rejected` | API orders rejected on delivery partner's device |

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
│  (Customer orders via    │
│   partner's app)         │
└───────────┬──────────────┘
            │
            ▼
┌─────────────────────────────────────────────┐
│     DELIVERY PARTNER'S TABLET/DEVICE        │
│     (at restaurant location)                │
│                                             │
│   Restaurant staff accepts or rejects       │
│   order on partner's device                 │
└───────────┬─────────────────────────────────┘
            │
       ┌────┴────┐
       │         │
       ▼         ▼
   ACCEPTED   REJECTED
       │         │
       │         └─► Order never enters POS
       │
       ▼
┌─────────────────────────────────────────────┐
│   Order sent to POS via API                 │
└───────────┬─────────────────────────────────┘
            │
            ▼
      ┌───────────┐
      │IN_PROGRESS│ ◄──── Arrives ready for kitchen (shows in POS Orders tab)
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

> **Note:** Acceptance/rejection happens on the delivery partner's device (tablet/phone at restaurant), NOT in the POS system. Orders only reach the POS after being accepted externally.

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
   - **Inventory adjustments** (see "Order Editing & Inventory" section below)

---

## Inventory Reservation on Order Creation

When an order is created, ingredients are **immediately reserved** to prevent overselling:

```
Order Created → Calculate Required Ingredients → Reserve Each Ingredient
                                                       │
                                                       ▼
                                               reserved_quantity ↑
                                               (available to sell ↓)
```

### Why Reserve Immediately?

- Prevents selling the same ingredient to multiple orders
- Ensures "Available to Sell" accurately reflects what can be ordered
- Physical stock (`quantity`) unchanged until order completes

### Example

```
Initial: Beef stock = 10kg, reserved = 0kg, available = 10kg

Order 1: 2 burgers (0.4kg beef needed)
→ reserved = 0.4kg, available = 9.6kg

Order 2: 3 burgers (0.6kg beef needed)  
→ reserved = 1.0kg, available = 9.0kg

Order 1 Completed:
→ quantity = 9.6kg, reserved = 0.6kg, available = 9.0kg
```

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
   - Inventory is **consumed** (see below)
   - Payment status is finalized
   - Timeline event is logged
5. **For delivery orders:** `completed` means "food ready for pickup" - not end of workflow

### Inventory Consumption on Completion

When an order is marked as completed:

```
For each ingredient in the order:
  - quantity ↓ (physical stock reduced)
  - reserved_quantity ↓ (reservation released)
  - Transaction logged as 'order_sale'
```

**Note:** Inventory is reserved at order creation time, but only consumed when the order is completed. This ensures accurate tracking of when ingredients are actually used.

---

## Order Pickup Rules (Delivery Orders Only)

1. **POS is the only place to mark orders as picked up**
2. **Only `completed` delivery orders can be marked as picked up**
3. **On pickup:**
   - Status changes to `picked_up`
   - Timeline event is logged
   - Order workflow is complete

---

## Order Cancellation & Kitchen Decision Queue

When orders are cancelled or edited, ingredients enter a **Kitchen Decision Queue** instead of being immediately released. This prevents overselling and ensures accurate waste tracking.

### Why Kitchen Decisions?

**Problem:** If reservations are released immediately on cancellation, another order could claim those ingredients. But if the kitchen already prepared the food, those ingredients are actually wasted - leading to overselling.

**Solution:** Keep ingredients locked until kitchen confirms:
- **RETURN** - Ingredients weren't used, return to available stock
- **WASTE** - Ingredients were used/prepared, deduct from physical stock

### Cancellation Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                    ORDER CANCELLED                                 │
│              (or item removed from order)                          │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│              ITEMS ENTER DECISION QUEUE                            │
│         (reserved_quantity stays LOCKED)                           │
│                                                                    │
│   • Items NOT released to available stock                          │
│   • Appears in Kitchen Display for decision                        │
│   • Tracks: item, quantity, order_id, cancellation_source          │
└───────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│   Kitchen Marks     │             │   Kitchen Marks     │
│      RETURN         │             │       WASTE         │
│                     │             │                     │
│ • Not prepared      │             │ • Already prepared  │
│ • Ingredients ok    │             │ • Must discard      │
└─────────────────────┘             └─────────────────────┘
            │                                   │
            ▼                                   ▼
┌─────────────────────┐             ┌─────────────────────┐
│ reserved_qty ↓      │             │ reserved_qty ↓      │
│ quantity unchanged  │             │ quantity ↓ (waste)  │
│                     │             │                     │
│ → Back to available │             │ → Deducted as waste │
│ → Timeline: return  │             │ → Timeline: waste   │
└─────────────────────┘             └─────────────────────┘
```

### Kitchen Display Tabs

| Tab | Shows | Source |
|-----|-------|--------|
| **Cancelled Orders** | Full order cancellations | `cancellation_source = 'order_cancelled'` |
| **Edited Orders** | Items removed from orders | `cancellation_source = 'order_edited'` |

### Ingredient Breakdown

In both tabs, kitchen staff see:
- Order details
- Each affected product
- **Ingredient breakdown** with quantities
- Return/Waste buttons per ingredient

### Auto-Expire Rules

If kitchen doesn't make a decision, items automatically become **WASTE**:

| Trigger | Action |
|---------|--------|
| 24 hours elapsed | Auto-mark as waste |
| POS Session closed | Auto-mark items from that session as waste |

This ensures no items remain indefinitely locked.

### Cancellation Permissions

| Action | Who Can Do It |
|--------|---------------|
| Cancel Order | Any business user |
| Make Return/Waste Decision | `kitchen_display` role |

---

## Order Editing & Inventory

When orders are edited, inventory is adjusted accordingly:

### Item Additions
- New ingredients are **reserved immediately**
- Consumed when order completes

### Item Removals / Quantity Reductions
- Affected ingredients enter **Kitchen Decision Queue**
- Kitchen decides Return or Waste (see above)
- NOT immediately released to prevent overselling
- **IMPORTANT**: Return decisions are **deferred** until order completion
  - Kitchen marks item as "return" → decision saved
  - Inventory transaction created **only when order is completed**
  - This ensures "Additions Today" count only updates after order is done
- Waste decisions are processed immediately (item is gone regardless)

### Modifier Removals (e.g., "No Cheese")
- If removing an ingredient that's in the recipe
- That ingredient enters **Kitchen Decision Queue**
- Kitchen decides if the removed ingredient was wasted
- Same deferred behavior for returns as above

---

## Delivery Partner Integration

### How It Works

1. **Customer Orders** - Customer places order on delivery partner's app (Talabat, Jahez, etc.)
2. **Partner's Device** - Order appears on delivery partner's tablet/phone at the restaurant
3. **Accept/Reject** - Restaurant staff accepts or rejects the order **on the partner's device**
4. **If Accepted** - Order is sent to POS via API webhook
5. **If Rejected** - Order never enters POS system

> **Important:** The POS system does NOT have accept/reject functionality. This happens exclusively on the delivery partner's device before the order reaches your system.

### Incoming Orders
- Orders arrive via webhook/API **after being accepted** on partner's device
- Initial status: `in_progress` (already accepted, ready for kitchen)
- Orders appear in the POS Orders tab alongside all other orders

### Order Flow (in POS System)
1. **Order arrives** → `in_progress` (kitchen starts preparing)
2. **Kitchen completes** → `completed` (food ready, waiting for driver)
3. **Driver picks up** → `picked_up` (POS marks when driver collects)

### Order Visibility
- All **accepted** delivery partner orders show in the POS Orders tab
- Kitchen Display shows orders to prepare
- POS can see completed delivery orders awaiting pickup
- Rejected orders never appear in the system

---

## Timeline Events

Every order action is logged for audit trail:

### Order Timeline Events

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
| `ingredient_wasted` | Ingredient marked as waste by kitchen |
| `ingredient_returned` | Ingredient returned to inventory by kitchen |

### Inventory Timeline Events (related to orders)

| Transaction Type | Description | Effect |
|------------------|-------------|--------|
| `sale_reserve` | Ingredients reserved for order | reserved_qty ↑ |
| `order_sale` | Ingredients consumed on completion | quantity ↓, reserved_qty ↓ |
| `order_cancel_return` | Kitchen returned ingredients | reserved_qty ↓ |
| `order_cancel_waste` | Kitchen marked as waste | quantity ↓, reserved_qty ↓ |

> **See Also:** [INVENTORY_FLOW.md](./INVENTORY_FLOW.md) for complete inventory documentation

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
4. **API orders** - Acceptance/rejection happens on delivery partner's device (tablet at restaurant), not in the POS system. Orders arrive pre-accepted as `in_progress`.
5. **Don't build accept/reject UI** for API orders in the POS - this functionality exists only on partner devices
6. Always check `is_edited` flag in kitchen display to highlight modified orders

---

## Related Files

- **Middleware:** `backend/src/middleware/auth.middleware.ts`
- **Routes:** `backend/src/api/pos.routes.ts`
- **Service:** `backend/src/services/pos.service.ts`
- **Types:** `backend/src/types/index.ts`
- **Timeline Service:** `backend/src/services/order-timeline.service.ts`
- **Inventory Stock Service:** `backend/src/services/inventory-stock.service.ts`
- **Migrations:** `backend/migrations/add_order_workflow_tables.sql`

---

## Related Documentation

- [INVENTORY_FLOW.md](./INVENTORY_FLOW.md) - Complete inventory management documentation
- [PAYMENT_WORKFLOW.md](./PAYMENT_WORKFLOW.md) - Payment processing documentation

