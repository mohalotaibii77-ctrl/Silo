/**
 * INVENTORY STOCK MANAGEMENT API ROUTES
 * Vendors, Purchase Orders, Transfers, Inventory Counts
 */

import { Router, Request, Response } from 'express';
import { inventoryStockService } from '../services/inventory-stock.service';
import { asyncHandler } from '../middleware/error.middleware';
import { businessAuthService } from '../services/business-auth.service';
import { supabaseAdmin as supabase } from '../config/database';
import { extractPaginationParams, buildPaginatedResponse } from '../utils/pagination';

const router = Router();

interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    branch_id?: number;
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

    // Get branch ID from header
    const headerBranchId = req.headers['x-branch-id'] as string;
    const branchId = headerBranchId ? parseInt(headerBranchId) : undefined;

    req.businessUser = {
      id: user.id,
      business_id: effectiveBusinessId,
      branch_id: branchId,
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
 * Get all vendors (filtered by branch - shows branch-specific + shared vendors)
 * Supports pagination with page, limit, fields query params
 */
router.get('/vendors', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, search } = req.query;
  const pagination = extractPaginationParams(req);
  
  const result = await inventoryStockService.getVendors(req.businessUser!.business_id, {
    status: status as 'active' | 'inactive',
    search: search as string,
    branchId: req.businessUser!.branch_id,
    page: pagination.page,
    limit: pagination.limit,
  });

  // Support both paginated and non-paginated responses
  if ('total' in result) {
    const response = buildPaginatedResponse(result.data, result.total, pagination);
    res.json({ success: true, ...response });
  } else {
    res.json({ success: true, data: result });
  }
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
 * branch_id: null = available to all branches, number = specific branch only
 */
router.post('/vendors', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, branch_id, contact_person, email, phone, address, city, country, tax_number, payment_terms, notes } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, error: 'Vendor name is required' });
  }

  const vendor = await inventoryStockService.createVendor(req.businessUser!.business_id, {
    name,
    name_ar,
    branch_id: branch_id === 'all' ? null : (branch_id || null), // 'all' or null = all branches
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
 * GET /api/inventory-stock/stock/stats
 * Get stock statistics - counts of low/out/healthy stock items
 * Backend calculation - frontend just displays
 */
router.get('/stock/stats', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { branch_id } = req.query;

  // Use branch_id from query param if provided, otherwise use the one from X-Branch-Id header
  const effectiveBranchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  const stats = await inventoryStockService.getStockStats(
    req.businessUser!.business_id,
    effectiveBranchId
  );

  res.json({ success: true, stats });
}));

/**
 * GET /api/inventory-stock/stock
 * Get stock levels - filtered by branch from X-Branch-Id header or query param
 * Supports pagination with page, limit query params
 */
router.get('/stock', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { branch_id, item_id, low_stock } = req.query;
  const pagination = extractPaginationParams(req);

  // Use branch_id from query param if provided, otherwise use the one from X-Branch-Id header
  const effectiveBranchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  const result = await inventoryStockService.getStockLevels(req.businessUser!.business_id, {
    branchId: effectiveBranchId,
    itemId: item_id ? parseInt(item_id as string) : undefined,
    lowStock: low_stock === 'true',
    page: pagination.page,
    limit: pagination.limit,
  });

  // Support both paginated and non-paginated responses
  if ('total' in result) {
    const response = buildPaginatedResponse(result.data, result.total, pagination);
    res.json({ success: true, ...response });
  } else {
    res.json({ success: true, data: result });
  }
}));

/**
 * PUT /api/inventory-stock/stock/:itemId/limits
 * Set stock min/max limits - uses branch from X-Branch-Id header or body
 */
router.put('/stock/:itemId/limits', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { min_quantity, max_quantity, branch_id } = req.body;

  // Use branch_id from body if provided, otherwise use the one from X-Branch-Id header
  const effectiveBranchId = branch_id ?? req.businessUser!.branch_id;

  const stock = await inventoryStockService.setStockLimits(
    req.businessUser!.business_id,
    parseInt(req.params.itemId),
    { min_quantity, max_quantity },
    effectiveBranchId
  );

  res.json({ success: true, data: stock });
}));

/**
 * POST /api/inventory-stock/stock/:itemId/adjust
 * Manual stock adjustment - uses branch from X-Branch-Id header or body
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

  // Use branch_id from body if provided, otherwise use the one from X-Branch-Id header
  const effectiveBranchId = branch_id ?? req.businessUser!.branch_id;

  const quantityChange = type === 'adjustment_add' ? Math.abs(quantity) : -Math.abs(quantity);

  const stock = await inventoryStockService.updateStock(
    req.businessUser!.business_id,
    parseInt(req.params.itemId),
    quantityChange,
    type,
    {
      branchId: effectiveBranchId,
      notes,
      userId: req.businessUser!.id,
    }
  );

  res.json({ success: true, data: stock });
}));

// ==================== PURCHASE ORDERS ====================

/**
 * GET /api/inventory-stock/purchase-orders
 * Get purchase orders (filtered by branch from X-Branch-Id header)
 * Supports pagination with page, limit query params
 */
router.get('/purchase-orders', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, vendor_id, branch_id } = req.query;
  const pagination = extractPaginationParams(req);

  // Use branch_id from query param if provided, otherwise use the one from X-Branch-Id header
  const effectiveBranchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  const result = await inventoryStockService.getPurchaseOrders(req.businessUser!.business_id, {
    status: status as string,
    vendorId: vendor_id ? parseInt(vendor_id as string) : undefined,
    branchId: effectiveBranchId,
    page: pagination.page,
    limit: pagination.limit,
  });

  // Support both paginated and non-paginated responses
  if ('total' in result) {
    const response = buildPaginatedResponse(result.data, result.total, pagination);
    res.json({ success: true, ...response });
  } else {
    res.json({ success: true, data: result });
  }
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
 * Create purchase order with quantities only (prices entered at receive time)
 */
router.post('/purchase-orders', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { vendor_id, branch_id, expected_date, notes, items } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ success: false, error: 'Vendor is required' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one item is required' });
  }

  // Validate items - only item_id and quantity required (no prices at creation)
  for (const item of items) {
    if (!item.item_id || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Each item must have item_id and quantity > 0' 
      });
    }
  }

  // Use branch_id from body if provided, otherwise use the one from X-Branch-Id header
  const effectiveBranchId = branch_id || req.businessUser!.branch_id;

  const order = await inventoryStockService.createPurchaseOrder(req.businessUser!.business_id, {
    vendor_id,
    branch_id: effectiveBranchId,
    expected_date,
    notes,
    items: items.map((i: any) => ({ item_id: i.item_id, quantity: i.quantity })),
    created_by: req.businessUser!.id,
  });

  res.status(201).json({ success: true, data: order });
}));

/**
 * PUT /api/inventory-stock/purchase-orders/:id
 * Update purchase order details (notes, expected date, item quantities)
 * Note: Prices are only entered at receive time, not during PO creation/update
 */
router.put('/purchase-orders/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { notes, expected_date, items } = req.body;

  // Validate items if provided - only quantities can be updated (no prices)
  if (items) {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items must be a non-empty array' });
    }
    for (const item of items) {
      if (!item.item_id || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Each item must have item_id and quantity > 0' 
        });
      }
    }
  }

  const order = await inventoryStockService.updatePurchaseOrder(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    { 
      notes, 
      expected_date, 
      items: items ? items.map((i: any) => ({ item_id: i.item_id, quantity: i.quantity })) : undefined 
    },
    req.businessUser!.id
  );

  res.json({ success: true, data: order });
}));

/**
 * PUT /api/inventory-stock/purchase-orders/:id/status
 * Update purchase order status (only for pending/cancelled)
 * NOTE: To receive a PO with pricing, use POST /purchase-orders/:id/receive
 */
router.put('/purchase-orders/:id/status', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, note } = req.body;

  // Only pending and cancelled can be set manually
  // 'received' status is set via the /receive endpoint
  const validStatuses = ['pending', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid status. Valid values: pending, cancelled. Use /receive endpoint to receive PO with pricing.' 
    });
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
 * POST /api/inventory-stock/purchase-orders/:id/count
 * Count purchase order items (Step 1 of receiving)
 * Employee counts items, enters quantities, scans barcodes
 * Status changes from 'pending' to 'counted'
 * 
 * Required fields:
 * - items[].item_id: Item ID
 * - items[].counted_quantity: Counted quantity
 * - items[].barcode_scanned: Boolean - at least one barcode must be scanned per item
 * - items[].variance_reason: Required if counted < ordered ('missing' | 'canceled' | 'rejected')
 * - items[].variance_note: Required if counted > ordered (justification)
 */
router.post('/purchase-orders/:id/count', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { items } = req.body;

  // Validate items array
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Items to count are required' });
  }

  // Validate each item
  for (const item of items) {
    if (!item.item_id) {
      return res.status(400).json({ success: false, error: 'Each item must have item_id' });
    }
    if (item.counted_quantity === undefined || item.counted_quantity < 0) {
      return res.status(400).json({ success: false, error: 'Each item must have counted_quantity >= 0' });
    }
    if (!item.barcode_scanned) {
      return res.status(400).json({ success: false, error: 'Each item must have at least one barcode scanned' });
    }
  }

  const order = await inventoryStockService.countPurchaseOrder(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    {
      items: items.map((i: any) => ({
        item_id: i.item_id,
        counted_quantity: i.counted_quantity,
        barcode_scanned: i.barcode_scanned,
        variance_reason: i.variance_reason,
        variance_note: i.variance_note,
      })),
    },
    req.businessUser!.id
  );

  res.json({ success: true, data: order });
}));

/**
 * POST /api/inventory-stock/purchase-orders/:id/receive
 * Receive purchase order items with costs from invoice (Step 2 of receiving)
 * 
 * For 'counted' orders: Uses counted_quantity, only requires pricing and invoice
 * For 'pending' orders (legacy): Requires quantities, variance info, pricing, and invoice
 * 
 * Required fields:
 * - invoice_image_url: URL to uploaded invoice image
 * - items[].item_id: Item ID
 * - items[].received_quantity: (Optional for counted orders) Counted quantity
 * - items[].total_cost: Total cost from invoice for this line
 * - items[].variance_reason: Required if received < ordered ('missing' | 'canceled' | 'rejected') (for pending only)
 * - items[].variance_note: Required if received > ordered (justification) (for pending only)
 */
router.post('/purchase-orders/:id/receive', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { invoice_image_url, items } = req.body;

  // Validate invoice image
  if (!invoice_image_url || typeof invoice_image_url !== 'string' || invoice_image_url.trim() === '') {
    return res.status(400).json({ success: false, error: 'Invoice image URL is required' });
  }

  // Validate items array
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Items to receive are required' });
  }

  // Validate each item
  for (const item of items) {
    if (!item.item_id) {
      return res.status(400).json({ success: false, error: 'Each item must have item_id' });
    }
    if (item.received_quantity === undefined || item.received_quantity < 0) {
      return res.status(400).json({ success: false, error: 'Each item must have received_quantity >= 0' });
    }
    if (item.total_cost === undefined || item.total_cost === null || item.total_cost < 0) {
      return res.status(400).json({ success: false, error: 'Each item must have total_cost from invoice' });
    }
    // Note: variance_reason and variance_note validation is done in the service
    // based on comparison with ordered quantity
  }

  const order = await inventoryStockService.receivePurchaseOrder(
    parseInt(req.params.id),
    req.businessUser!.business_id,
    {
      invoice_image_url,
      items: items.map((i: any) => ({
        item_id: i.item_id,
        received_quantity: i.received_quantity,
        total_cost: i.total_cost,
        variance_reason: i.variance_reason,
        variance_note: i.variance_note,
      })),
    },
    req.businessUser!.id
  );

  res.json({ success: true, data: order });
}));

// ==================== ITEM BARCODES ====================

/**
 * GET /api/inventory-stock/items/barcode/:barcode
 * Lookup item by barcode within the user's business
 * Returns the item associated with this barcode, or null if not found
 */
router.get('/items/barcode/:barcode', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const barcode = req.params.barcode;
  
  if (!barcode || barcode.trim() === '') {
    return res.status(400).json({ success: false, error: 'Barcode is required' });
  }

  const result = await inventoryStockService.lookupItemByBarcode(
    barcode.trim(),
    req.businessUser!.business_id
  );
  
  if (!result) {
    return res.json({ success: true, data: null, message: 'Barcode not found' });
  }

  res.json({ success: true, data: result });
}));

/**
 * POST /api/inventory-stock/items/:id/barcode
 * Associate a barcode with an item for the user's business
 * Each item can have one barcode per business, barcodes are unique within a business
 */
router.post('/items/:id/barcode', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const itemId = parseInt(req.params.id);
  const { barcode } = req.body;
  
  if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
    return res.status(400).json({ success: false, error: 'Barcode is required' });
  }

  try {
    const result = await inventoryStockService.associateBarcode(
      itemId,
      barcode.trim(),
      req.businessUser!.business_id,
      req.businessUser!.id
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message.includes('already associated')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    throw error;
  }
}));

/**
 * GET /api/inventory-stock/items/:id/barcode
 * Get barcode for a specific item within the user's business
 */
router.get('/items/:id/barcode', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const itemId = parseInt(req.params.id);
  
  const result = await inventoryStockService.getItemBarcode(
    itemId,
    req.businessUser!.business_id
  );
  
  res.json({ success: true, data: result });
}));

// ==================== TRANSFERS ====================

/**
 * Helper function to get owner's accessible businesses
 */
async function getOwnerBusinesses(username: string): Promise<number[]> {
  const { data } = await businessAuthService.getOwnerBusinesses(username);
  return data?.map((b: any) => b.id) || [];
}

/**
 * GET /api/inventory-stock/transfers/destinations
 * Get available destination businesses/branches for transfer
 * - Owner: can see all their businesses and branches
 * - PM: can only see branches within current business
 * NOTE: This route MUST be defined BEFORE /transfers/:id to avoid matching "destinations" as an ID
 */
router.get('/transfers/destinations', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { business_id, role, username } = req.businessUser!;
  
  interface Destination {
    business_id: number;
    business_name: string;
    branches: { id: number; name: string; name_ar?: string }[];
  }
  
  const destinations: Destination[] = [];

  if (role === 'owner') {
    // Get all owner's businesses with their branches
    const ownerBusinesses = await getOwnerBusinesses(username);
    
    for (const bizId of ownerBusinesses) {
      const { data: business } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('id', bizId)
        .single();
      
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name, name_ar')
        .eq('business_id', bizId)
        .eq('is_active', true);
      
      if (business) {
        destinations.push({
          business_id: business.id,
          business_name: business.name,
          branches: branches || [],
        });
      }
    }
  } else {
    // PM: only current business branches
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', business_id)
      .single();
    
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name, name_ar')
      .eq('business_id', business_id)
      .eq('is_active', true);
    
    if (business) {
      destinations.push({
        business_id: business.id,
        business_name: business.name,
        branches: branches || [],
      });
    }
  }

  res.json({ success: true, data: destinations, role });
}));

/**
 * GET /api/inventory-stock/transfers
 * Get transfers
 * - Owner: can see transfers from/to any of their businesses
 * - PM: can only see transfers within their current business
 */
router.get('/transfers', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, from_branch_id, to_branch_id } = req.query;
  const { business_id, role, username } = req.businessUser!;

  let allOwnerBusinesses: number[] | undefined;
  
  // For owners, get all their accessible businesses
  if (role === 'owner') {
    allOwnerBusinesses = await getOwnerBusinesses(username);
  }

  const transfers = await inventoryStockService.getTransfers(business_id, {
    status: status as string,
    fromBranchId: from_branch_id ? parseInt(from_branch_id as string) : undefined,
    toBranchId: to_branch_id ? parseInt(to_branch_id as string) : undefined,
    allOwnerBusinesses,
  });

  res.json({ success: true, data: transfers });
}));

/**
 * GET /api/inventory-stock/transfers/:id
 * Get single transfer
 */
router.get('/transfers/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { business_id, role, username } = req.businessUser!;
  
  let allOwnerBusinesses: number[] | undefined;
  if (role === 'owner') {
    allOwnerBusinesses = await getOwnerBusinesses(username);
  }

  const transfer = await inventoryStockService.getTransfer(
    parseInt(req.params.id),
    business_id,
    allOwnerBusinesses
  );

  if (!transfer) {
    return res.status(404).json({ success: false, error: 'Transfer not found' });
  }

  res.json({ success: true, data: transfer });
}));

/**
 * POST /api/inventory-stock/transfers
 * Create transfer
 * - Owner: can transfer between any of their businesses/branches
 * - PM: can only transfer within their current business branches
 */
router.post('/transfers', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { from_business_id, from_branch_id, to_business_id, to_branch_id, notes, items } = req.body;
  const { business_id, role, username, id: userId } = req.businessUser!;

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

  let ownerBusinesses: number[] | undefined;
  if (role === 'owner') {
    ownerBusinesses = await getOwnerBusinesses(username);
  }

  // Default to current business if not specified
  const effectiveFromBusinessId = from_business_id || business_id;
  const effectiveToBusinessId = to_business_id || business_id;

  const transfer = await inventoryStockService.createTransfer(
    business_id,
    {
      from_business_id: effectiveFromBusinessId,
      from_branch_id,
      to_business_id: effectiveToBusinessId,
      to_branch_id,
      notes,
      items,
      created_by: userId,
    },
    role,
    ownerBusinesses
  );

  res.status(201).json({ success: true, data: transfer });
}));

/**
 * POST /api/inventory-stock/transfers/:id/receive
 * Receive transfer (mark as received and add stock to destination)
 */
router.post('/transfers/:id/receive', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { items } = req.body;
  const { business_id, role, username, id: userId } = req.businessUser!;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Items to receive are required' });
  }

  let allOwnerBusinesses: number[] | undefined;
  if (role === 'owner') {
    allOwnerBusinesses = await getOwnerBusinesses(username);
  }

  const transfer = await inventoryStockService.receiveTransfer(
    parseInt(req.params.id),
    business_id,
    items,
    userId,
    allOwnerBusinesses
  );

  res.json({ success: true, data: transfer });
}));

/**
 * POST /api/inventory-stock/transfers/:id/cancel
 * Cancel a pending transfer
 */
router.post('/transfers/:id/cancel', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { business_id, role, username, id: userId } = req.businessUser!;

  let allOwnerBusinesses: number[] | undefined;
  if (role === 'owner') {
    allOwnerBusinesses = await getOwnerBusinesses(username);
  }

  const transfer = await inventoryStockService.cancelTransfer(
    parseInt(req.params.id),
    business_id,
    userId,
    allOwnerBusinesses
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

