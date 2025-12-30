# Inventory Flow Documentation

> **Last Updated:** December 2024  
> **Version:** 1.0

## Overview

This document describes the complete inventory management flow in the Silo system, including all ways items can enter or exit inventory, the reservation system for orders, and the kitchen decision workflow for cancelled/edited orders.

---

## Inventory Stock Structure

Each item's inventory is tracked in the `inventory_stock` table with **three quantity fields**:

| Field | Description | Impact on Availability |
|-------|-------------|------------------------|
| `quantity` | **Actual physical stock** - what's really in the warehouse | Base stock |
| `reserved_quantity` | **Locked for pending orders** - reserved but not yet consumed | Reduces availability |
| `held_quantity` | **Locked for pending transfers** - awaiting shipment to another branch | Reduces availability |

### Available to Sell Formula

```
Available = quantity - reserved_quantity - held_quantity
```

**Example:**
- `quantity`: 100 units (physical stock)
- `reserved_quantity`: 15 units (5 pending orders)
- `held_quantity`: 10 units (1 pending transfer)
- **Available to Sell**: 75 units

---

## Inventory Movement Types

All inventory movements are logged to both `inventory_movements` (legacy) and `inventory_transactions` (timeline) tables.

### Summary Table

| Source | IN (+) Types | OUT (-) Types |
|--------|--------------|---------------|
| **Manual Adjustments** | `manual_addition` | `manual_deduction` |
| **Purchase Orders** | `po_receive` | - |
| **Transfers** | `transfer_in` | `transfer_out` |
| **Orders (Completed)** | - | `order_sale` |
| **Orders (Cancelled/Edited)** | `order_cancel_return` | `order_cancel_waste` |
| **Production** | `production_yield` | `production_consume` |
| **Inventory Counts** | `inventory_count_adjustment` | `inventory_count_adjustment` |

---

## 1. Manual Adjustments

Manual adjustments allow direct modification of inventory levels with full audit trail.

### Manual Addition

**When:** Receiving samples, corrections, found stock, gifts  
**Effect:** `quantity` ↑  
**Transaction Type:** `manual_addition`  
**Requirements:** 
- Justification notes required
- User ID logged for accountability

```
Before: quantity = 100
Action: Add 10 units
After:  quantity = 110
```

### Manual Deduction

**When:** Expired, damaged, spoiled, theft, corrections  
**Effect:** `quantity` ↓  
**Transaction Type:** `manual_deduction`  
**Requirements:**
- Reason required: `expired` | `damaged` | `spoiled` | `others`
- Notes required if reason is `others`
- User ID logged for accountability

```
Before: quantity = 100
Action: Deduct 5 units (reason: expired)
After:  quantity = 95
```

---

## 2. Purchase Orders (PO)

Purchase orders add stock when items are received from vendors.

### Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Draft     │ ──► │   Pending   │ ──► │   Counted   │ ──► │  Received   │
│  (create)   │     │  (submit)   │     │ (physical)  │     │ (finalize)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                                                            quantity ↑
                                                            (po_receive)
```

### Two-Step Receiving Process

1. **Count Phase:** Physical counting of received items
2. **Receive Phase:** Enter unit prices and finalize

**Effect:** `quantity` ↑  
**Transaction Type:** `po_receive`

```
Before: quantity = 100
Action: Receive PO with 50 units @ $5.00/unit
After:  quantity = 150, cost tracked
```

---

## 3. Inventory Transfers

Transfers move stock between branches within the same business.

### Flow

```
Source Branch                              Destination Branch
┌─────────────┐                           ┌─────────────┐
│  quantity   │ ── Transfer Created ──►   │  (pending)  │
│     ↓       │                           │             │
│ held_qty ↑  │                           │             │
└─────────────┘                           └─────────────┘
      │                                          │
      │              Transfer Received           │
      │◄─────────────────────────────────────────│
      │                                          │
      ▼                                          ▼
┌─────────────┐                           ┌─────────────┐
│  quantity ↓ │                           │  quantity ↑ │
│ held_qty ↓  │                           │             │
│(transfer_out)│                          │(transfer_in)│
└─────────────┘                           └─────────────┘
```

### Transfer Stages

| Stage | Source Effect | Destination Effect |
|-------|---------------|-------------------|
| Created | `held_quantity` ↑ | - |
| Received | `quantity` ↓, `held_quantity` ↓ | `quantity` ↑ |
| Cancelled | `held_quantity` ↓ | - |

**Transaction Types:** `transfer_out` (source), `transfer_in` (destination)

---

## 4. Orders (Complete Lifecycle)

Orders have the most complex inventory flow with a **3-stage lifecycle**:

### Stage A: Order Created (Reservation)

**When:** Customer places order (POS, delivery app, phone, website)  
**Effect:** 
- `reserved_quantity` ↑ (ingredients locked)
- `quantity` unchanged (physical stock untouched)
- **Available to Sell** ↓ (prevents overselling)

```
Example: Order for 2 Burgers (each needs 0.2kg beef)

Before: quantity=10kg, reserved=0kg, available=10kg
Action: Reserve 0.4kg beef
After:  quantity=10kg, reserved=0.4kg, available=9.6kg
```

**Transaction Type:** `sale_reserve` (logged to movements only)

### Stage B: Order Completed (Consumption)

**When:** Kitchen marks order as complete/ready  
**Effect:**
- `quantity` ↓ (physical stock consumed)
- `reserved_quantity` ↓ (reservation released)
- **Available to Sell** unchanged

```
Before: quantity=10kg, reserved=0.4kg, available=9.6kg
Action: Consume 0.4kg beef
After:  quantity=9.6kg, reserved=0kg, available=9.6kg
```

**Transaction Type:** `order_sale`

### Stage C: Order Cancelled or Edited

See dedicated section below for the **Kitchen Decision Queue** workflow.

---

## 5. Kitchen Decision Queue (Cancelled/Edited Orders)

When orders are cancelled or items removed, ingredients don't immediately return to available stock. Instead, they enter a **Kitchen Decision Queue** where kitchen staff decide their fate.

### Why This Exists

**Problem:** Immediate release of reservations can cause overselling  
**Solution:** Keep items locked until kitchen confirms whether ingredients were used or not

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ORDER CANCELLED OR EDITED                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ITEMS ENTER DECISION QUEUE                           │
│           (reserved_quantity stays locked - not released)               │
│                                                                         │
│   Table: cancelled_order_items                                          │
│   Fields: item_id, quantity, decision (null), cancellation_source       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    KITCHEN DISPLAY - DECISION UI                        │
│                                                                         │
│   "Cancelled Orders" Tab → Full order cancellations                     │
│   "Edited Orders" Tab   → Item removals from edited orders              │
│                                                                         │
│   For each item, kitchen chooses:                                       │
│   ┌──────────────┐                    ┌──────────────┐                  │
│   │   RETURN     │                    │    WASTE     │                  │
│   │ (not used)   │                    │   (used up)  │                  │
│   └──────────────┘                    └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
                    │                              │
                    ▼                              ▼
┌───────────────────────────────┐  ┌───────────────────────────────────────┐
│         RETURN DECISION       │  │           WASTE DECISION              │
│                               │  │                                       │
│  • reserved_quantity ↓        │  │  • reserved_quantity ↓                │
│  • quantity unchanged         │  │  • quantity ↓ (physical stock lost)   │
│  • Items back to available    │  │  • Items deducted as waste            │
│                               │  │                                       │
│  Transaction: order_cancel_   │  │  Transaction: order_cancel_waste      │
│               return          │  │  (IMMEDIATE)                          │
│  (DEFERRED for edited orders) │  │                                       │
└───────────────────────────────┘  └───────────────────────────────────────┘
```

### Cancellation Sources

| Source | Description | Tab in Kitchen Display |
|--------|-------------|------------------------|
| `order_cancelled` | Full order was cancelled | "Cancelled Orders" |
| `order_edited` | Items removed or quantity reduced | "Edited Orders" |

### Return Processing Timing

| Source | Waste Decision | Return Decision |
|--------|----------------|-----------------|
| `order_cancelled` | Immediate | Immediate (order is done) |
| `order_edited` | Immediate | **Deferred until order completion** |

**Why defer returns for edited orders?**
- Edited orders are still in progress
- "Additions Today" should only count completed returns
- Kitchen decision is saved, but inventory transaction waits
- When order is completed, pending returns are processed

### Auto-Expire Rules

If kitchen doesn't make a decision, items are **automatically marked as WASTE**:

| Trigger | Effect |
|---------|--------|
| **24 hours elapsed** | Auto-expire to waste |
| **POS Session closed** | Auto-expire items from that session |

### Example Scenarios

**Scenario 1: Customer cancels order before preparation**
```
1. Order for 2 burgers cancelled
2. Items enter decision queue (beef, buns, cheese still reserved)
3. Kitchen checks - ingredients not touched
4. Kitchen marks as RETURN
5. reserved_quantity ↓, items available again
```

**Scenario 2: Kitchen already prepared when customer cancels**
```
1. Order for 2 burgers cancelled
2. Items enter decision queue
3. Kitchen checks - burgers already made
4. Kitchen marks as WASTE
5. quantity ↓ AND reserved_quantity ↓
6. Timeline shows waste entry
```

**Scenario 3: Customer removes item from order (edit)**
```
1. Customer says "No cheese on my burger"
2. Cheese ingredient enters decision queue (source: order_edited)
3. Kitchen marks as RETURN (cheese not used)
4. Cheese back to available stock
```

---

## 6. Production (Recipes/Composite Items)

Production converts raw ingredients into finished products.

### Flow

```
┌─────────────────┐                    ┌─────────────────┐
│  Raw Materials  │ ──── Recipe ────►  │ Finished Product│
│   (consumed)    │                    │   (produced)    │
└─────────────────┘                    └─────────────────┘
        │                                      │
        ▼                                      ▼
   quantity ↓                             quantity ↑
(production_consume)                   (production_yield)
```

### Example: Making 10 Burger Patties

```
INPUTS (consumed):
- Beef: 2kg consumed (production_consume)
- Onion: 0.3kg consumed (production_consume)
- Spices: 0.1kg consumed (production_consume)

OUTPUT (produced):
- Burger Patty: 10 pieces added (production_yield)
```

**Transaction Types:**
- `production_consume` for raw materials (OUT)
- `production_yield` for finished product (IN)

---

## 7. Inventory Counts (Physical Audit)

Inventory counts reconcile system quantities with physical counts.

### Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Create    │ ──► │    Count    │ ──► │  Complete   │
│   Count     │     │   Items     │     │   Count     │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │ Apply Variance  │
                                    │   Adjustments   │
                                    └─────────────────┘
```

### Variance Calculation

```
Variance = Counted Quantity - Expected Quantity (system)

If Variance > 0: Add to stock (found extra)
If Variance < 0: Deduct from stock (missing/lost)
```

**Transaction Type:** `inventory_count_adjustment`

---

## 8. Order Refund (Future Implementation)

> **Status:** Not yet implemented - planned for future release

**Purpose:** Handle refunds for completed orders where customer returns food after delivery/pickup.

**Planned Behavior:**
- When order is refunded after completion
- Ingredients should return to stock OR be marked as waste
- Will use Kitchen Decision Queue similar to cancellations
- Transaction Type: TBD

**Note:** For now, use Cancel for pre-completion issues and Edit for order modifications.

---

## Timeline Display

All movements appear in the Inventory Timeline with appropriate categorization:

### Additions (Green, +)
- `manual_addition`
- `po_receive`
- `transfer_in`
- `production_yield`
- `order_cancel_return`

### Deductions (Red, -)
- `manual_deduction`
- `order_sale`
- `transfer_out`
- `production_consume`
- `order_cancel_waste`
- `inventory_count_adjustment` (if negative)

---

## Business Rules & Safeguards

### 1. Stock Cannot Go Negative
All deductions are capped at 0 to prevent negative inventory.

```typescript
const newQuantity = Math.max(0, currentQuantity - deductAmount);
```

### 2. Reservation Prevents Overselling
When orders are created, ingredients are immediately reserved, reducing available quantity even though physical stock hasn't changed.

### 3. Kitchen Decision Required
Cancelled/edited orders don't release reservations until kitchen confirms the fate of ingredients. This prevents:
- Overselling if items were actually used
- Inaccurate waste tracking

### 4. Full Audit Trail
Every inventory movement is logged with:
- Timestamp
- User who performed action
- Quantity before/after
- Reference (order ID, PO ID, etc.)
- Notes/reason

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `inventory_stock` | Current stock levels per item/branch |
| `inventory_movements` | Legacy movement log |
| `inventory_transactions` | Timeline display log |
| `cancelled_order_items` | Kitchen decision queue |
| `purchase_orders` / `purchase_order_items` | PO tracking |
| `inventory_transfers` / `inventory_transfer_items` | Transfer tracking |
| `inventory_counts` / `inventory_count_items` | Count tracking |
| `productions` / `production_consumed_items` | Production tracking |

---

## Related Files

- **Stock Service:** `backend/src/services/inventory-stock.service.ts`
- **Transaction Service:** `backend/src/services/inventory-transaction.service.ts`
- **Production Service:** `backend/src/services/inventory-production.service.ts`
- **POS Service:** `backend/src/services/pos.service.ts`
- **Routes:** `backend/src/api/inventory-*.routes.ts`
- **Frontend Timeline:** `store-setup/app/inventory/page.tsx`
- **Mobile Timeline:** `business-app/src/screens/InventoryScreen.tsx`

---

## See Also

- [ORDER_WORKFLOW.md](./ORDER_WORKFLOW.md) - Order lifecycle and statuses
- [PAYMENT_WORKFLOW.md](./PAYMENT_WORKFLOW.md) - Payment processing

