/**
 * INVENTORY STOCK MANAGEMENT API ROUTES
 * Vendors, Purchase Orders, Transfers, Inventory Counts
 */

import { Router, Request, Response } from 'express';
import { inventoryStockService } from '../services/inventory-stock.service';
import { asyncHandler } from '../middleware/error.middleware';
import { businessAuthService } from '../services/business-auth.service';

const router = Router();

interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    username: string;
    role: string;
  };
}

// Business auth middleware with workspace switching support
async function authenticateBusiness(req: AuthenticatedRequest, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = businessAuthService.verifyToken(token);
    
    const user = await businessAuthService.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Check for workspace switching via X-Business-Id header
    const headerBusinessId = req.headers['x-business-id'] as string;
    let effectiveBusinessId = user.business_id;

    if (headerBusinessId && parseInt(headerBusinessId) !== user.business_id) {
      // User is trying to access a different business - verify access
      if (user.role === 'owner') {
        // Check if owner has access to this business via owners/business_owners table
        const hasAccess = await businessAuthService.checkOwnerBusinessAccess(
          user.username,
          parseInt(headerBusinessId)
        );
        
        if (hasAccess) {
          effectiveBusinessId = parseInt(headerBusinessId);
        } else {
          return res.status(403).json({ success: false, error: 'Access denied to this business' });
        }
      } else {
        return res.status(403).json({ success: false, error: 'Access denied to this business' });
      }
    }

    req.businessUser = {
      id: user.id,
      business_id: effectiveBusinessId,
      username: user.username,
      role: user.role,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ==================== VENDORS ====================

/**
 * GET /api/inventory-stock/vendors
 * Get all vendors
 */
router.get('/vendors', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, search } = req.query;
  
  const vendors = await inventoryStockService.getVendors(req.businessUser!.business_id, {
    status: status as 'active' | 'inactive',
    search: search as string,
  });

  res.json({ success: true, data: vendors });
}));

/**
 * GET /api/inventory-stock/vendors/:id
 * Get single vendor
 */
router.get('/vendors/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const vendor = await inventoryStockService.getVendor(
    parseInt(req.params.id),
    req.businessUser!.business_id
  );

  if (!vendor) {
    return res.status(404).json({ success: false, error: 'Vendor not found' });
  }

  res.json({ success: true, data: vendor });
}));

/**
 * POST /api/inventory-stock/vendors
 * Create vendor
 */
router.post('/vendors', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, contact_person, email, phone, address, city, country, tax_number, payment_terms, notes } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Vendor name is required' });
  }

  const vendor = await inventoryStockService.createVendor(req.businessUser!.business_id, {
    name,
    name_ar,
    contact_person,
    email,
    phone,
    address,
    city,
    country,
    tax_number,
    payment_terms,
    notes,
  });

  res.status(201).json({ success: true, data: vendor });
}));

/**
 * PUT /api/inventory-stock/vendors/:id
 * Update vendor
 */
router.put('/vendors/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const vendor = await inventoryStockService.updateVendor(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    req.body
  );

  res.json({ success: true, data: vendor });
}));

/**
 * DELETE /api/inventory-stock/vendors/:id
 * Delete vendor
 */
router.delete('/vendors/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  await inventoryStockService.deleteVendor(
    parseInt(req.params.id),
    req.businessUser!.business_id
  );

  res.json({ success: true, message: 'Vendor deleted' });
}));

// ==================== STOCK LEVELS ====================

/**
 * GET /api/inventory-stock/stock
 * Get stock levels
 */
router.get('/stock', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { branch_id, item_id, low_stock } = req.query;

  const stock = await inventoryStockService.getStockLevels(req.businessUser!.business_id, {
    branchId: branch_id ? parseInt(branch_id as string) : undefined,
    itemId: item_id ? parseInt(item_id as string) : undefined,
    lowStock: low_stock === 'true',
  });

  res.json({ success: true, data: stock });
}));

/**
 * PUT /api/inventory-stock/stock/:itemId/limits
 * Set stock min/max limits
 */
router.put('/stock/:itemId/limits', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { min_quantity, max_quantity, branch_id } = req.body;

  const stock = await inventoryStockService.setStockLimits(
    req.businessUser!.business_id,
    parseInt(req.params.itemId),
    { min_quantity, max_quantity },
    branch_id
  );

  res.json({ success: true, data: stock });
}));

/**
 * POST /api/inventory-stock/stock/:itemId/adjust
 * Manual stock adjustment
 */
router.post('/stock/:itemId/adjust', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { quantity, type, branch_id, notes } = req.body;

  if (quantity === undefined || !type) {
    return res.status(400).json({ success: false, error: 'Quantity and type are required' });
  }

  const validTypes = ['adjustment_add', 'adjustment_remove', 'waste', 'damage', 'expiry'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ success: false, error: 'Invalid adjustment type' });
  }

  const quantityChange = type === 'adjustment_add' ? Math.abs(quantity) : -Math.abs(quantity);

  const stock = await inventoryStockService.updateStock(
    req.businessUser!.business_id,
    parseInt(req.params.itemId),
    quantityChange,
    type,
    {
      branchId: branch_id,
      notes,
      userId: req.businessUser!.id,
    }
  );

  res.json({ success: true, data: stock });
}));

// ==================== PURCHASE ORDERS ====================

/**
 * GET /api/inventory-stock/purchase-orders
 * Get purchase orders
 */
router.get('/purchase-orders', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, vendor_id, branch_id } = req.query;

  const orders = await inventoryStockService.getPurchaseOrders(req.businessUser!.business_id, {
    status: status as string,
    vendorId: vendor_id ? parseInt(vendor_id as string) : undefined,
    branchId: branch_id ? parseInt(branch_id as string) : undefined,
  });

  res.json({ success: true, data: orders });
}));

/**
 * GET /api/inventory-stock/purchase-orders/:id
 * Get single purchase order
 */
router.get('/purchase-orders/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const order = await inventoryStockService.getPurchaseOrder(
    parseInt(req.params.id),
    req.businessUser!.business_id
  );

  if (!order) {
    return res.status(404).json({ success: false, error: 'Purchase order not found' });
  }

  res.json({ success: true, data: order });
}));

/**
 * GET /api/inventory-stock/purchase-orders/:id/activity
 * Get purchase order activity history
 */
router.get('/purchase-orders/:id/activity', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const activity = await inventoryStockService.getPOActivity(
    parseInt(req.params.id),
    req.businessUser!.business_id
  );

  res.json({ success: true, data: activity });
}));

/**
 * POST /api/inventory-stock/purchase-orders
 * Create purchase order
 */
router.post('/purchase-orders', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { vendor_id, branch_id, expected_date, notes, items } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ success: false, error: 'Vendor is required' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one item is required' });
  }

  for (const item of items) {
    if (!item.item_id || !item.quantity || item.quantity <= 0 || item.unit_cost === undefined || item.unit_cost === null) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each item must have item_id, quantity > 0, and unit_cost' 
      });
    }
  }

  const order = await inventoryStockService.createPurchaseOrder(req.businessUser!.business_id, {
    vendor_id,
    branch_id,
    expected_date,
    notes,
    items,
    created_by: req.businessUser!.id,
  });

  res.status(201).json({ success: true, data: order });
}));

/**
 * PUT /api/inventory-stock/purchase-orders/:id
 * Update purchase order details (notes, expected date, items)
 */
router.put('/purchase-orders/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { notes, expected_date, items } = req.body;

  // Validate items if provided
  if (items) {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items must be a non-empty array' });
    }
    for (const item of items) {
      if (!item.item_id || !item.quantity || item.quantity <= 0 || item.unit_cost === undefined || item.unit_cost === null) {
        return res.status(400).json({ 
          success: false, 
          error: 'Each item must have item_id, quantity > 0, and unit_cost' 
        });
      }
    }
  }

  const order = await inventoryStockService.updatePurchaseOrder(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    { notes, expected_date, items },
    req.businessUser!.id
  );

  res.json({ success: true, data: order });
}));

/**
 * PUT /api/inventory-stock/purchase-orders/:id/status
 * Update purchase order status
 */
router.put('/purchase-orders/:id/status', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, note } = req.body;

  const validStatuses = ['pending', 'approved', 'ordered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  const order = await inventoryStockService.updatePurchaseOrderStatus(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    status,
    req.businessUser!.id,
    note
  );

  res.json({ success: true, data: order });
}));

/**
 * POST /api/inventory-stock/purchase-orders/:id/receive
 * Receive purchase order items
 */
router.post('/purchase-orders/:id/receive', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Items to receive are required' });
  }

  for (const item of items) {
    if (!item.item_id || item.received_quantity === undefined || item.received_quantity < 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each item must have item_id and received_quantity >= 0' 
      });
    }
  }

  const order = await inventoryStockService.receivePurchaseOrder(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    items,
    req.businessUser!.id
  );

  res.json({ success: true, data: order });
}));

// ==================== TRANSFERS ====================

/**
 * GET /api/inventory-stock/transfers
 * Get transfers
 */
router.get('/transfers', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, from_branch_id, to_branch_id } = req.query;

  const transfers = await inventoryStockService.getTransfers(req.businessUser!.business_id, {
    status: status as string,
    fromBranchId: from_branch_id ? parseInt(from_branch_id as string) : undefined,
    toBranchId: to_branch_id ? parseInt(to_branch_id as string) : undefined,
  });

  res.json({ success: true, data: transfers });
}));

/**
 * GET /api/inventory-stock/transfers/:id
 * Get single transfer
 */
router.get('/transfers/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const transfer = await inventoryStockService.getTransfer(
    parseInt(req.params.id),
    req.businessUser!.business_id
  );

  if (!transfer) {
    return res.status(404).json({ success: false, error: 'Transfer not found' });
  }

  res.json({ success: true, data: transfer });
}));

/**
 * POST /api/inventory-stock/transfers
 * Create transfer
 */
router.post('/transfers', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { from_branch_id, to_branch_id, expected_date, notes, items } = req.body;

  if (!from_branch_id || !to_branch_id) {
    return res.status(400).json({ success: false, error: 'Source and destination branches are required' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one item is required' });
  }

  for (const item of items) {
    if (!item.item_id || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each item must have item_id and quantity > 0' 
      });
    }
  }

  const transfer = await inventoryStockService.createTransfer(req.businessUser!.business_id, {
    from_branch_id,
    to_branch_id,
    expected_date,
    notes,
    items,
    created_by: req.businessUser!.id,
  });

  res.status(201).json({ success: true, data: transfer });
}));

/**
 * POST /api/inventory-stock/transfers/:id/start
 * Start transfer (ship items)
 */
router.post('/transfers/:id/start', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const transfer = await inventoryStockService.startTransfer(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    req.businessUser!.id
  );

  res.json({ success: true, data: transfer });
}));

/**
 * POST /api/inventory-stock/transfers/:id/complete
 * Complete transfer (receive items)
 */
router.post('/transfers/:id/complete', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Items to receive are required' });
  }

  const transfer = await inventoryStockService.completeTransfer(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    items,
    req.businessUser!.id
  );

  res.json({ success: true, data: transfer });
}));

// ==================== INVENTORY COUNTS ====================

/**
 * GET /api/inventory-stock/counts
 * Get inventory counts
 */
router.get('/counts', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, branch_id } = req.query;

  const counts = await inventoryStockService.getInventoryCounts(req.businessUser!.business_id, {
    status: status as string,
    branchId: branch_id ? parseInt(branch_id as string) : undefined,
  });

  res.json({ success: true, data: counts });
}));

/**
 * GET /api/inventory-stock/counts/:id
 * Get single inventory count
 */
router.get('/counts/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const count = await inventoryStockService.getInventoryCount(
    parseInt(req.params.id),
    req.businessUser!.business_id
  );

  if (!count) {
    return res.status(404).json({ success: false, error: 'Inventory count not found' });
  }

  res.json({ success: true, data: count });
}));

/**
 * POST /api/inventory-stock/counts
 * Create inventory count
 */
router.post('/counts', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { branch_id, count_type, notes, item_ids } = req.body;

  const count = await inventoryStockService.createInventoryCount(req.businessUser!.business_id, {
    branch_id,
    count_type,
    notes,
    item_ids,
    created_by: req.businessUser!.id,
  });

  res.status(201).json({ success: true, data: count });
}));

/**
 * PUT /api/inventory-stock/counts/:countId/items/:itemId
 * Update count item (itemId here is the item_id from items table, not count_item id)
 */
router.put('/counts/:countId/items/:itemId', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { counted_quantity, variance_reason } = req.body;

  if (counted_quantity === undefined || counted_quantity < 0) {
    return res.status(400).json({ success: false, error: 'Valid counted_quantity is required' });
  }

  await inventoryStockService.updateCountItem(
    parseInt(req.params.countId),
    parseInt(req.params.itemId),
    counted_quantity,
    variance_reason,
    req.businessUser!.id
  );

  res.json({ success: true, message: 'Count item updated' });
}));

/**
 * POST /api/inventory-stock/counts/:id/complete
 * Complete inventory count
 */
router.post('/counts/:id/complete', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const count = await inventoryStockService.completeInventoryCount(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    req.businessUser!.id
  );

  res.json({ success: true, data: count });
}));

// ==================== MOVEMENTS ====================

/**
 * GET /api/inventory-stock/movements
 * Get inventory movements
 */
router.get('/movements', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { branch_id, item_id, movement_type, start_date, end_date, limit } = req.query;

  const movements = await inventoryStockService.getMovements(req.businessUser!.business_id, {
    branchId: branch_id ? parseInt(branch_id as string) : undefined,
    itemId: item_id ? parseInt(item_id as string) : undefined,
    movementType: movement_type as string,
    startDate: start_date as string,
    endDate: end_date as string,
    limit: limit ? parseInt(limit as string) : undefined,
  });

  res.json({ success: true, data: movements });
}));

// ==================== PO TEMPLATES ====================

/**
 * GET /api/inventory-stock/po-templates
 * Get all PO templates
 */
router.get('/po-templates', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { vendor_id, is_active } = req.query;

  const templates = await inventoryStockService.getPOTemplates(req.businessUser!.business_id, {
    vendor_id: vendor_id ? parseInt(vendor_id as string) : undefined,
    is_active: is_active !== undefined ? is_active === 'true' : undefined,
  });

  res.json({ success: true, data: templates });
}));

/**
 * GET /api/inventory-stock/po-templates/:id
 * Get a single PO template
 */
router.get('/po-templates/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const template = await inventoryStockService.getPOTemplate(
    parseInt(req.params.id),
    req.businessUser!.business_id
  );

  if (!template) {
    return res.status(404).json({ success: false, error: 'Template not found' });
  }

  res.json({ success: true, data: template });
}));

/**
 * POST /api/inventory-stock/po-templates
 * Create a new PO template
 */
router.post('/po-templates', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { vendor_id, name, name_ar, notes, items } = req.body;

  if (!vendor_id || !name || !items || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Vendor, name, and items are required' });
  }

  const template = await inventoryStockService.createPOTemplate(req.businessUser!.business_id, {
    vendor_id,
    name,
    name_ar,
    notes,
    items,
  });

  res.status(201).json({ success: true, data: template });
}));

/**
 * PUT /api/inventory-stock/po-templates/:id
 * Update a PO template
 */
router.put('/po-templates/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, notes, is_active, items } = req.body;

  const template = await inventoryStockService.updatePOTemplate(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    { name, name_ar, notes, is_active, items }
  );

  res.json({ success: true, data: template });
}));

/**
 * DELETE /api/inventory-stock/po-templates/:id
 * Delete a PO template
 */
router.delete('/po-templates/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  await inventoryStockService.deletePOTemplate(
    parseInt(req.params.id),
    req.businessUser!.business_id
  );

  res.json({ success: true, message: 'Template deleted' });
}));

export default router;

