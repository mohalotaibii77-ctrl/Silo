# Payment Workflow Documentation

> **Last Updated:** December 2024  
> **Version:** 1.0

## Overview

This document describes the complete payment workflow in the Silo POS system, including payment methods, payment statuses, and when payments are required for different order types.

---

## Payment Methods

The system supports **two** payment methods:

| Method | Code | Description |
|--------|------|-------------|
| Cash | `cash` | Physical cash payment |
| Card | `card` | Any card payment (includes Visa, Mada, Mastercard, K-Net, etc.) |

**Note:** We intentionally do not differentiate between card types (visa, mada, etc.) - they are all `card` payments. The specific card type can be recorded in the `payment_reference` field if needed.

---

## Payment Statuses

| Status | Code | Description |
|--------|------|-------------|
| Pending | `pending` | Payment not yet received (dine-in pay later, delivery COD) |
| Paid | `paid` | Payment has been received |
| App Payment | `app_payment` | Delivery partner handles payment (Jahez, Talabat, etc.) |
| Refunded | `refunded` | Payment has been refunded |
| Cancelled | `cancelled` | Payment was cancelled |

---

## Order Types & Payment Timing

### Summary Table

| Order Type | Order Source | Payment Method | Payment Timing | Initial `payment_status` | Notes |
|------------|--------------|----------------|----------------|--------------------------|-------|
| Takeaway | POS | Cash | Upfront | `paid` | - |
| Takeaway | POS | Card | Upfront (transaction # required) | `paid` | - |
| Drive Thru | POS | Cash | Upfront | `paid` | - |
| Drive Thru | POS | Card | Upfront (transaction # required) | `paid` | - |
| Dine-in | POS | Cash/Card (Pay Now) | Upfront | `paid` | - |
| Dine-in | POS | Pay Later | After eating | `pending` → `paid` | - |
| Delivery | POS (Own Driver) | Card | Upfront | `paid` | - |
| Delivery | POS (Own Driver) | Cash | Driver collects → cashier | `pending` → `paid` | - |
| Delivery | API (Partner) | Any | Partner handles | `app_payment` | Accepted on partner's device before reaching POS |

---

## Detailed Payment Flows

### 1. POS Orders (Takeaway, Drive Thru)

```
Customer orders at POS
        │
        ▼
┌─────────────────────┐
│  Payment Required   │
│  (Cash or Card)     │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
  Cash          Card
    │             │
    │             ▼
    │      Transaction #
    │        Required
    │             │
    └──────┬──────┘
           │
           ▼
   payment_status = 'paid'
           │
           ▼
   order_status = 'in_progress'
```

**Key Points:**
- Payment is **required upfront** before order enters the system
- Cash payments require `amount_received` and `change_given`
- Card payments require `transaction_number` from the terminal
- Order cannot proceed without payment

---

### 2. Dine-in Orders

#### Pay Now Flow
```
Customer orders (dine-in)
        │
        ▼
   Select "Pay Now"
        │
        ▼
┌─────────────────────┐
│  Payment Required   │
│  (Cash or Card)     │
└──────────┬──────────┘
           │
           ▼
   payment_status = 'paid'
           │
           ▼
   order_status = 'in_progress'
```

#### Pay Later Flow
```
Customer orders (dine-in)
        │
        ▼
   Select "Pay Later"
        │
        ▼
   payment_status = 'pending'
   is_pay_later = true
        │
        ▼
   order_status = 'in_progress'
        │
        ▼
   Kitchen prepares food
        │
        ▼
   Customer eats
        │
        ▼
   Customer requests bill
        │
        ▼
┌─────────────────────┐
│  Process Payment    │
│  (Cash or Card)     │
└──────────┬──────────┘
           │
           ▼
   payment_status = 'paid'
```

**Key Points:**
- Dine-in has option for "Pay Later" (common practice)
- Pay Later orders proceed **without** payment
- Customer settles bill after finishing their meal
- Cashier processes payment when customer is ready to leave

---

### 3. Delivery Orders (Restaurant's Own Drivers)

#### Card Payment (Upfront)
```
Customer orders delivery
        │
        ▼
   Card payment
        │
        ▼
   Transaction # required
        │
        ▼
   payment_status = 'paid'
        │
        ▼
   order_status = 'in_progress'
        │
        ▼
   Driver delivers order
```

#### Cash Payment (COD - Cash on Delivery)
```
Customer orders delivery
        │
        ▼
   Cash payment selected
        │
        ▼
   payment_status = 'pending'
        │
        ▼
   order_status = 'in_progress'
        │
        ▼
   Kitchen prepares
        │
        ▼
   Driver delivers & collects cash
        │
        ▼
   Driver returns to restaurant
        │
        ▼
   Driver hands cash to cashier
        │
        ▼
   Cashier processes payment
        │
        ▼
   payment_status = 'paid'
```

**Key Points:**
- Card payments are collected upfront
- Cash (COD) payments are collected by driver upon delivery
- Driver must hand cash to cashier for reconciliation
- Cashier marks order as paid in the system

---

### 4. API Orders (Delivery Partners: Jahez, Talabat, etc.)

```
┌─────────────────────────────────────────────────────────────┐
│                    DELIVERY PARTNER                          │
│           (Handles ALL customer payments)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Customer pays via partner app/driver                       │
│   (Cash or Card - partner's responsibility)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         ACCEPTANCE ON PARTNER'S DEVICE                       │
│         (at restaurant location)                             │
│                                                              │
│   Restaurant staff reviews order on partner's tablet/device  │
│   → Accepts or Rejects on that device                        │
│   → If rejected, order never reaches POS                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                   (If Accepted)
                          ▼
              Order sent to POS via API
                          │
                          ▼
              payment_status = 'app_payment'
              order_status = 'in_progress'
                          │
                          ▼
              Kitchen prepares
                          │
                          ▼
              order_status = 'completed'
                          │
                          ▼
              Partner driver picks up
                          │
                          ▼
              order_status = 'picked_up'


┌─────────────────────────────────────────────────────────────┐
│                    SETTLEMENT CYCLE                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Partner pays restaurant (weekly/bi-weekly/monthly):        │
│                                                              │
│   Total Order Revenue                                        │
│   - Partner Commission (15-25%)                              │
│   - Held Amount (≈25% for dispute reserve)                   │
│   ─────────────────────────────────                          │
│   = Settlement Payment                                       │
│                                                              │
│   Held amount released later if no disputes                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

> **Important:** Order acceptance/rejection happens on the delivery partner's device (tablet/phone at the restaurant), NOT in the POS system. Orders only reach the POS after being accepted externally, arriving with `in_progress` status ready for kitchen preparation.

**Key Points:**
- **Acceptance happens externally** - Restaurant accepts/rejects on partner's device, not in POS
- Orders arrive at POS as `in_progress` (already accepted)
- Delivery partner handles **ALL** customer payments
- Restaurant doesn't track per-order payment collection
- Payment status is always `app_payment` for API orders
- Restaurant receives bulk settlements (not per-order)
- Settlement = Orders - Commission - Held Amount
- Commission varies by partner (typically 15-25%)
- Some partners hold ~25% for potential customer disputes

---

## Payment Processing Access Control

| Action | Who Can Do It | Location |
|--------|--------------|----------|
| Process payment (mark as paid) | POS, Cashier, Owner | POS Terminal |
| View payment status | Any business user | Business App |
| Refund payment | Owner, Manager | Business App/POS |

---

## Order Editing & Payment Status

When an order is edited after payment:

### Total Increases
```
Order edited → new total > paid amount
        │
        ▼
payment_status = 'pending'
remaining_amount = new_total - paid_amount
        │
        ▼
Additional payment required
```

### Total Decreases
```
Order edited → new total < paid amount
        │
        ▼
payment_status = 'paid' (unchanged)
remaining_amount = negative (credit)
        │
        ▼
Customer has credit (refund if requested)
```

---

## API Reference

### Process Payment Endpoint

```
POST /api/pos/orders/:orderId/payment
```

**Request Body:**
```json
{
  "payment_method": "cash" | "card",
  "amount": 10.500,
  "reference": "TXN123456",           // Transaction number for card
  "amount_received": 20.000,          // Cash only
  "change_given": 9.500,              // Cash only
  "pos_session_id": 1                 // For shift tracking
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "payment_status": "paid",
    "payment_method": "cash",
    "paid_at": "2024-12-19T13:00:00Z",
    ...
  }
}
```

---

## Related Files

- **Types:** `backend/src/types/index.ts`
- **POS Service:** `backend/src/services/pos.service.ts`
- **POS Routes:** `backend/src/api/pos.routes.ts`
- **Timeline Service:** `backend/src/services/order-timeline.service.ts`
- **Order Workflow:** `backend/ORDER_WORKFLOW.md`

---

## Best Practices

1. **Always collect card transaction number** - Required for reconciliation and disputes
2. **Track cash in/out for cash payments** - Essential for cash drawer management
3. **Don't build accept/reject UI for API orders** - This happens on the delivery partner's device at the restaurant before orders reach your POS
4. **Mark COD orders paid when driver returns** - Don't mark paid at order creation
5. **Process payments before completing orders** - Except for pay later scenarios
6. **API orders arrive pre-accepted** - They reach your system as `in_progress`, ready for kitchen preparation


