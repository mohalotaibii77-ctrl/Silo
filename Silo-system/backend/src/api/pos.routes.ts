/**
 * POS API ROUTES
 * Handles orders from POS terminal, delivery apps (Talabat, Jahez, etc.), phone, website
 */

import { Router } from 'express';
import { posService } from '../services';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireBusinessAccess } from '../middleware/auth.middleware';
import { OrderSource, CreateOrderInput, CreateOrderItemInput } from '../types';

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
 * Get orders with filters
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
    limit, 
    offset 
  } = req.query;

  const orders = await posService.getOrders(parseInt(req.user!.businessId), {
    branch_id: branch_id ? parseInt(branch_id as string) : undefined,
    status: status as string | undefined,
    order_source: order_source as OrderSource | undefined,
    order_type: order_type as string | undefined,
    date: date as string | undefined,
    date_from: date_from as string | undefined,
    date_to: date_to as string | undefined,
    customer_phone: customer_phone as string | undefined,
    external_order_id: external_order_id as string | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });

  res.json({
    success: true,
    data: orders,
    count: orders.length,
  });
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

  const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'refunded', 'failed'];
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
 * POST /api/pos/orders/:orderId/payment
 * Process payment for order
 */
router.post('/orders/:orderId/payment', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { payment_method, amount, reference } = req.body;

  if (!payment_method || amount === undefined) {
    return res.status(400).json({
      success: false,
      error: 'payment_method and amount are required',
    });
  }

  const order = await posService.processPayment(
    parseInt(orderId),
    payment_method,
    amount,
    reference,
    parseInt(req.user!.userId)
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

export default router;
