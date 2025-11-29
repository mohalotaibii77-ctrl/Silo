/**
 * POS API ROUTES
 */

import { Router } from 'express';
import { posService } from '../services';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireBusinessAccess } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/pos/orders
 * Create new order
 */
router.post('/orders', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { type, tableNumber, customerName, customerPhone, items } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({
      success: false,
      error: 'Order must have at least one item',
    });
  }

  const order = await posService.createOrder({
    businessId: req.user!.businessId,
    type: type || 'dine_in',
    tableNumber,
    customerName,
    customerPhone,
    items,
    createdBy: req.user!.userId,
  });

  res.status(201).json({
    success: true,
    data: order,
  });
}));

/**
 * GET /api/pos/orders
 * Get orders
 */
router.get('/orders', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { status, date, limit, offset } = req.query;

  const orders = await posService.getOrders(req.user!.businessId, {
    status: status as string,
    date: date as string,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });

  res.json({
    success: true,
    data: orders,
  });
}));

/**
 * PATCH /api/pos/orders/:orderId/status
 * Update order status
 */
router.patch('/orders/:orderId/status', asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'Status is required',
    });
  }

  const order = await posService.updateOrderStatus(orderId, status);

  res.json({
    success: true,
    data: order,
  });
}));

export default router;

