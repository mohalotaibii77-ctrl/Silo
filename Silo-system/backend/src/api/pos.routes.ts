/**
 * POS API ROUTES
 * Handles orders from POS terminal, delivery apps (Talabat, Jahez, etc.), phone, website
 */

import { Router } from 'express';
import { posService } from '../services';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireBusinessAccess, requirePOSAccess, requireKitchenAccess } from '../middleware/auth.middleware';
import { OrderSource, OrderStatus, CreateOrderInput, CreateOrderItemInput } from '../types';
import { extractPaginationParams, buildPaginatedResponse } from '../utils/pagination';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/pos/orders
 * Create new order (from POS terminal)
 */
router.post('/orders', requireBusinessAccess, asyncHandler(async (req, res) => {
  const {
    branch_id,
    order_source = 'pos',
    order_type = 'dine_in',
    external_order_id,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    customer_notes,
    table_number,
    zone_area,
    number_of_guests,
    server_id,
    delivery_address,
    delivery_address_lat,
    delivery_address_lng,
    delivery_instructions,
    driver_name,
    driver_phone,
    driver_id,
    delivery_partner_id,
    items,
    discount_id,
    discount_code,
    discount_amount,
    discount_type,
    discount_reason,
    delivery_fee,
    packaging_fee,
    service_charge,
    tip_amount,
    payment_method,
    payment_reference,
    scheduled_time,
    pos_terminal_id,
    pos_session_id,
    is_rush_order,
    internal_notes,
  } = req.body;

  // Validate items
  if (!items || !items.length) {
    return res.status(400).json({
      success: false,
      error: 'Order must have at least one item',
    });
  }

  // Validate each item has required fields
  for (const item of items) {
    if (!item.product_name || item.quantity === undefined || item.unit_price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Each item must have product_name, quantity, and unit_price',
      });
    }
  }

  const orderInput: CreateOrderInput = {
    business_id: parseInt(req.user!.businessId),
    branch_id: branch_id ? parseInt(branch_id) : undefined,
    order_source: order_source as OrderSource,
    order_type,
    external_order_id,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    customer_notes,
    table_number,
    zone_area,
    number_of_guests,
    server_id,
    delivery_address,
    delivery_address_lat,
    delivery_address_lng,
    delivery_instructions,
    driver_name,
    driver_phone,
    driver_id,
    delivery_partner_id: delivery_partner_id ? parseInt(delivery_partner_id) : undefined,
    items: items as CreateOrderItemInput[],
    discount_id,
    discount_code,
    discount_amount,
    discount_type,
    discount_reason,
    delivery_fee,
    packaging_fee,
    service_charge,
    tip_amount,
    payment_method,
    payment_reference,
    scheduled_time,
    created_by: parseInt(req.user!.userId),
    cashier_id: parseInt(req.user!.userId),
    pos_terminal_id,
    pos_session_id,
    is_rush_order,
    internal_notes,
  };

  const order = await posService.createOrder(orderInput);

  res.status(201).json({
    success: true,
    data: order,
  });
}));

/**
 * POST /api/pos/orders/delivery-app
 * Create order from delivery app webhook (Talabat, Jahez, etc.)
 */
router.post('/orders/delivery-app', requireBusinessAccess, asyncHandler(async (req, res) => {
  const {
    source,
    external_order_id,
    branch_id,
    customer_name,
    customer_phone,
    customer_email,
    delivery_address,
    delivery_instructions,
    driver_name,
    driver_phone,
    driver_id,
    items,
    delivery_fee,
    discount_amount,
    total,
    external_metadata,
  } = req.body;

  // Validate required fields
  if (!source || !external_order_id || !items || !items.length) {
    return res.status(400).json({
      success: false,
      error: 'source, external_order_id, and items are required',
    });
  }

  // Validate source is a valid delivery app
  const validSources: OrderSource[] = ['talabat', 'jahez', 'hungerstation', 'careem', 'toyou', 'mrsool', 'deliveroo', 'ubereats'];
  if (!validSources.includes(source)) {
    return res.status(400).json({
      success: false,
      error: `Invalid source. Must be one of: ${validSources.join(', ')}`,
    });
  }

  const order = await posService.createDeliveryAppOrder(
    source,
    external_order_id,
    parseInt(req.user!.businessId),
    branch_id ? parseInt(branch_id) : undefined,
    {
      customer_name,
      customer_phone,
      customer_email,
      delivery_address,
      delivery_instructions,
      driver_name,
      driver_phone,
      driver_id,
      items,
      delivery_fee,
      discount_amount,
      total,
      external_metadata,
    },
    parseInt(req.user!.userId)
  );

  res.status(201).json({
    success: true,
    data: order,
  });
}));

/**
 * GET /api/pos/orders
 * Get orders with filters and pagination
 */
router.get('/orders', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { 
    branch_id,
    status, 
    order_source,
    order_type,
    date, 
    date_from,
    date_to,
    customer_phone,
    external_order_id,
  } = req.query;

  const pagination = extractPaginationParams(req);

  const result = await posService.getOrders(parseInt(req.user!.businessId), {
    branch_id: branch_id ? parseInt(branch_id as string) : undefined,
    status: status as OrderStatus | OrderStatus[] | undefined,
    order_source: order_source as OrderSource | undefined,
    order_type: order_type as string | undefined,
    date: date as string | undefined,
    date_from: date_from as string | undefined,
    date_to: date_to as string | undefined,
    customer_phone: customer_phone as string | undefined,
    external_order_id: external_order_id as string | undefined,
    page: pagination.page,
    limit: pagination.limit,
    fields: pagination.fields,
  });

  // Support both paginated and non-paginated responses
  if ('total' in result) {
    const response = buildPaginatedResponse(result.data, result.total, pagination, !!pagination.fields);
    
    // Get accurate stats from full filtered dataset (not just current page)
    const stats = await posService.getOrderListStats(parseInt(req.user!.businessId), {
      branch_id: branch_id ? parseInt(branch_id as string) : undefined,
      status: status as OrderStatus | OrderStatus[] | undefined,
      order_source: order_source as OrderSource | undefined,
      order_type: order_type as string | undefined,
      date: date as string | undefined,
      date_from: date_from as string | undefined,
      date_to: date_to as string | undefined,
      customer_phone: customer_phone as string | undefined,
      external_order_id: external_order_id as string | undefined,
    });

    res.json({
      success: true,
      ...response,
      stats,
    });
  } else {
    // Legacy response format - stats calculated from full result set
    const orders = result as any[];
    const completedOrders = orders.filter((o: any) => o.order_status === 'completed');
    const stats = {
      total_orders: orders.length,
      completed_orders: completedOrders.length,
      in_progress_orders: orders.filter((o: any) => o.order_status === 'in_progress' || o.order_status === 'pending').length,
      total_revenue: completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.total_amount || '0'), 0),
    };

    res.json({
      success: true,
      data: orders,
      count: orders.length,
      stats,
    });
  }
}));

/**
 * GET /api/pos/orders/:orderId
 * Get single order by ID
 */
router.get('/orders/:orderId', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await posService.getOrderById(parseInt(orderId));

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found',
    });
  }

  // Verify order belongs to this business
  if (order.business_id !== parseInt(req.user!.businessId)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
    });
  }

  res.json({
    success: true,
    data: order,
  });
}));

/**
 * GET /api/pos/orders/external/:externalOrderId
 * Get order by external ID (for delivery apps)
 */
router.get('/orders/external/:externalOrderId', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { externalOrderId } = req.params;

  const order = await posService.getOrderByExternalId(
    parseInt(req.user!.businessId), 
    externalOrderId
  );

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found',
    });
  }

  res.json({
    success: true,
    data: order,
  });
}));

/**
 * PATCH /api/pos/orders/:orderId/status
 * Update order status
 * 
 * Order Status Flow:
 * - POS orders: in_progress → completed/cancelled
 * - API orders: pending → in_progress (accept) or rejected → completed/cancelled
 */
router.patch('/orders/:orderId/status', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, reason } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'Status is required',
    });
  }

  // Valid order statuses
  const validStatuses = ['pending', 'in_progress', 'completed', 'picked_up', 'cancelled', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  const order = await posService.updateOrderStatus(
    parseInt(orderId), 
    status,
    parseInt(req.user!.userId),
    reason
  );

  res.json({
    success: true,
    data: order,
  });
}));

/**
 * POST /api/pos/orders/:orderId/accept
 * Accept a pending order (from delivery partner API)
 * Changes status: pending → in_progress
 */
router.post('/orders/:orderId/accept', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await posService.acceptOrder(
    parseInt(orderId),
    parseInt(req.user!.userId)
  );

  res.json({
    success: true,
    data: order,
    message: 'Order accepted successfully',
  });
}));

/**
 * POST /api/pos/orders/:orderId/reject
 * Reject a pending order (from delivery partner API)
 * Changes status: pending → rejected
 */
router.post('/orders/:orderId/reject', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  const order = await posService.rejectOrder(
    parseInt(orderId),
    parseInt(req.user!.userId),
    reason
  );

  res.json({
    success: true,
    data: order,
    message: 'Order rejected',
  });
}));

/**
 * POST /api/pos/orders/:orderId/complete
 * Complete an in-progress order (food is ready)
 * Changes status: in_progress → completed
 * For delivery orders: completed means "ready for pickup" - driver still needs to collect
 * 
 * ACCESS: Kitchen Display only - orders can only be completed from kitchen
 */
router.post('/orders/:orderId/complete', requireBusinessAccess, requireKitchenAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await posService.completeOrder(
    parseInt(orderId),
    parseInt(req.user!.userId)
  );

  res.json({
    success: true,
    data: order,
    message: 'Order completed',
  });
}));

/**
 * POST /api/pos/orders/:orderId/pickup
 * Mark a completed delivery order as picked up by driver
 * Changes status: completed → picked_up
 * Only for delivery orders - marks when delivery driver has collected the food
 * 
 * ACCESS: POS operators only
 */
router.post('/orders/:orderId/pickup', requireBusinessAccess, requirePOSAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await posService.pickupOrder(
    parseInt(orderId),
    parseInt(req.user!.userId)
  );

  res.json({
    success: true,
    data: order,
    message: 'Order marked as picked up',
  });
}));

/**
 * POST /api/pos/orders/:orderId/cancel
 * Cancel an in-progress order
 * Changes status: in_progress → cancelled
 */
router.post('/orders/:orderId/cancel', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  const order = await posService.cancelOrder(
    parseInt(orderId),
    parseInt(req.user!.userId),
    reason
  );

  res.json({
    success: true,
    data: order,
    message: 'Order cancelled',
  });
}));

/**
 * POST /api/pos/orders/:orderId/payment
 * Process payment for order
 * For cash payments: include amount_received and change_given for cash drawer tracking
 */
router.post('/orders/:orderId/payment', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { payment_method, amount, reference, amount_received, change_given, pos_session_id } = req.body;

  if (!payment_method || amount === undefined) {
    return res.status(400).json({
      success: false,
      error: 'payment_method and amount are required',
    });
  }

  // Build cash details if provided (for cash payments)
  const cashDetails = (amount_received !== undefined && change_given !== undefined)
    ? { amount_received, change_given }
    : undefined;

  const order = await posService.processPayment(
    parseInt(orderId),
    payment_method,
    amount,
    reference,
    parseInt(req.user!.userId),
    cashDetails,
    pos_session_id ? parseInt(pos_session_id) : undefined
  );

  res.json({
    success: true,
    data: order,
  });
}));

/**
 * POST /api/pos/orders/:orderId/void
 * Void an order
 */
router.post('/orders/:orderId/void', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({
      success: false,
      error: 'Reason is required to void an order',
    });
  }

  const order = await posService.voidOrder(
    parseInt(orderId),
    reason,
    parseInt(req.user!.userId)
  );

  res.json({
    success: true,
    data: order,
  });
}));

/**
 * POST /api/pos/orders/:orderId/refund
 * Refund an order
 */
router.post('/orders/:orderId/refund', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { amount, reason, reference } = req.body;

  if (amount === undefined || !reason) {
    return res.status(400).json({
      success: false,
      error: 'amount and reason are required for refund',
    });
  }

  const order = await posService.refundOrder(
    parseInt(orderId),
    amount,
    reason,
    reference,
    parseInt(req.user!.userId)
  );

  res.json({
    success: true,
    data: order,
  });
}));

/**
 * GET /api/pos/orders/stats
 * Get order statistics
 */
router.get('/stats', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { date_from, date_to, branch_id } = req.query;

  // Default to today if no dates provided
  const today = new Date().toISOString().split('T')[0];
  const fromDate = (date_from as string) || today;
  const toDate = (date_to as string) || today;

  const stats = await posService.getOrderStats(
    parseInt(req.user!.businessId),
    fromDate,
    toDate,
    branch_id ? parseInt(branch_id as string) : undefined
  );

  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * POST /api/pos/calculate-totals
 * Calculate order totals from cart items (use this instead of frontend calculation)
 */
router.post('/calculate-totals', requireBusinessAccess, asyncHandler(async (req, res) => {
  const {
    items,
    discount_type,
    discount_value,
    delivery_fee,
    packaging_fee,
    service_charge,
    tip_amount,
  } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({
      success: false,
      error: 'Items array is required',
    });
  }

  const totals = await posService.calculateOrderTotals(
    parseInt(req.user!.businessId),
    items,
    {
      discount_type,
      discount_value,
      delivery_fee,
      packaging_fee,
      service_charge,
      tip_amount,
    }
  );

  res.json({
    success: true,
    data: totals,
  });
}));

/**
 * POST /api/pos/calculate-delivery-margin
 * Calculate profit margin for delivery orders (after commission)
 */
router.post('/calculate-delivery-margin', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { price, cost, commission_type, commission_value } = req.body;

  if (price === undefined || cost === undefined || !commission_type || commission_value === undefined) {
    return res.status(400).json({
      success: false,
      error: 'price, cost, commission_type, and commission_value are required',
    });
  }

  const margin = posService.calculateDeliveryMargin(
    price,
    cost,
    commission_type,
    commission_value
  );

  res.json({
    success: true,
    data: {
      margin_percent: margin,
    },
  });
}));

// ==================== ORDER EDITING ROUTES ====================

/**
 * PATCH /api/pos/orders/:orderId/edit
 * Edit order items (POS orders only)
 * Can add items, remove items, or modify quantities
 * 
 * ACCESS: POS operators, cashiers, and owners only
 */
router.patch('/orders/:orderId/edit', requireBusinessAccess, requirePOSAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { items_to_add, items_to_remove, items_to_modify } = req.body;

  // Must have at least one edit operation
  if (!items_to_add?.length && !items_to_remove?.length && !items_to_modify?.length) {
    return res.status(400).json({
      success: false,
      error: 'At least one edit operation is required (items_to_add, items_to_remove, or items_to_modify)',
    });
  }

  const order = await posService.editOrder(
    parseInt(orderId),
    {
      items_to_add,
      items_to_remove,
      items_to_modify,
    },
    parseInt(req.user!.userId)
  );

  res.json({
    success: true,
    data: order,
    message: 'Order edited successfully',
  });
}));

/**
 * GET /api/pos/orders/:orderId/timeline
 * Get order timeline/audit trail
 */
router.get('/orders/:orderId/timeline', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const timeline = await posService.getOrderTimeline(parseInt(orderId));

  res.json({
    success: true,
    data: timeline,
  });
}));

// ==================== KITCHEN DISPLAY ROUTES ====================

/**
 * GET /api/pos/kitchen/orders
 * Get all orders for kitchen display with filters
 * Supports filtering by status for different tabs
 */
router.get('/kitchen/orders', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { branch_id, status, date } = req.query;

  const today = date as string || new Date().toISOString().split('T')[0];

  let statusFilter: OrderStatus | OrderStatus[] | undefined;
  if (status) {
    statusFilter = (status as string).includes(',') 
      ? (status as string).split(',') as OrderStatus[]
      : status as OrderStatus;
  }

  const result = await posService.getOrders(parseInt(req.user!.businessId), {
    branch_id: branch_id ? parseInt(branch_id as string) : undefined,
    status: statusFilter,
    date: today,
    limit: 100, // Kitchen display shows more orders
  });

  // Transform order_items to items for frontend compatibility
  const rawOrders = 'data' in result ? result.data : result;
  const orders = rawOrders.map((order: any) => ({
    ...order,
    items: order.order_items?.map((item: any) => ({
      id: item.id,
      product_name: item.product_name || item.name,
      product_name_ar: item.product_name_ar || item.name_ar,
      variant_name: item.variant_name,
      quantity: item.quantity,
      original_quantity: item.original_quantity,
      special_instructions: item.special_instructions || item.notes,
      modifiers: item.order_item_modifiers?.map((mod: any) => ({
        modifier_name: mod.modifier_name || mod.name,
        modifier_name_ar: mod.modifier_name_ar || mod.name_ar,
        quantity: mod.quantity || 1,
      })) || [],
    })) || [],
  }));

  res.json({
    success: true,
    data: orders,
    count: orders.length,
  });
}));

/**
 * GET /api/pos/kitchen/cancelled-items
 * Get cancelled order items awaiting kitchen decision (waste vs return)
 */
router.get('/kitchen/cancelled-items', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { branch_id } = req.query;

  const items = await posService.getCancelledItemsPendingDecision(
    parseInt(req.user!.businessId),
    branch_id ? parseInt(branch_id as string) : undefined
  );

  res.json({
    success: true,
    data: items,
    count: items.length,
  });
}));

/**
 * POST /api/pos/kitchen/process-waste
 * Process waste/return decisions from kitchen
 * Kitchen decides for each cancelled item whether it's waste or can return to inventory
 */
router.post('/kitchen/process-waste', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { decisions } = req.body;

  if (!decisions || !Array.isArray(decisions) || decisions.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'decisions array is required with at least one decision',
    });
  }

  // Validate each decision
  for (const decision of decisions) {
    if (!decision.cancelled_item_id || !['waste', 'return'].includes(decision.decision)) {
      return res.status(400).json({
        success: false,
        error: 'Each decision must have cancelled_item_id and decision (waste or return)',
      });
    }
  }

  const result = await posService.processWasteDecisions(
    decisions,
    parseInt(req.user!.userId)
  );

  res.json({
    success: true,
    data: result,
    message: `Processed ${result.processed} items`,
  });
}));

export default router;
