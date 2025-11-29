/**
 * INVENTORY & ITEMS API ROUTES
 */

import { Router } from 'express';
import { inventoryService } from '../services';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireBusinessAccess } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============ ITEMS ============

/**
 * GET /api/inventory/items
 * Get all items
 */
router.get('/items', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { type, categoryId, lowStock } = req.query;

  const items = await inventoryService.getItems(req.user!.businessId, {
    type: type as string,
    categoryId: categoryId as string,
    lowStock: lowStock === 'true',
  });

  res.json({
    success: true,
    data: items,
  });
}));

/**
 * GET /api/inventory/items/:itemId
 * Get single item
 */
router.get('/items/:itemId', asyncHandler(async (req, res) => {
  const item = await inventoryService.getItem(req.params.itemId);

  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  res.json({
    success: true,
    data: item,
  });
}));

/**
 * POST /api/inventory/items
 * Create new item
 */
router.post('/items', requireBusinessAccess, asyncHandler(async (req, res) => {
  const item = await inventoryService.createItem({
    ...req.body,
    business_id: req.user!.businessId,
  });

  res.status(201).json({
    success: true,
    data: item,
  });
}));

/**
 * PUT /api/inventory/items/:itemId
 * Update item
 */
router.put('/items/:itemId', asyncHandler(async (req, res) => {
  const item = await inventoryService.updateItem(req.params.itemId, req.body);

  res.json({
    success: true,
    data: item,
  });
}));

// ============ TRANSACTIONS ============

/**
 * POST /api/inventory/transactions
 * Record stock transaction (in/out/adjustment/waste)
 */
router.post('/transactions', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { itemId, type, quantity, reason } = req.body;

  if (!itemId || !type || quantity === undefined) {
    return res.status(400).json({
      success: false,
      error: 'itemId, type, and quantity are required',
    });
  }

  const transaction = await inventoryService.recordTransaction({
    businessId: req.user!.businessId,
    itemId,
    type,
    quantity,
    reason,
    createdBy: req.user!.userId,
  });

  res.status(201).json({
    success: true,
    data: transaction,
  });
}));

/**
 * GET /api/inventory/alerts
 * Get low stock alerts
 */
router.get('/alerts', requireBusinessAccess, asyncHandler(async (req, res) => {
  const lowStockItems = await inventoryService.getLowStockItems(req.user!.businessId);

  res.json({
    success: true,
    data: lowStockItems,
  });
}));

export default router;

