/**
 * CUSTOMERS API ROUTES
 * Manage customers for businesses/branches
 */

import { Router, Request, Response } from 'express';
import { customersService } from '../services/customers.service';
import { asyncHandler } from '../middleware/error.middleware';
import { businessAuthService } from '../services/business-auth.service';

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

// Business auth middleware
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
      if (user.role === 'owner') {
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

// ==================== CUSTOMERS ROUTES ====================

/**
 * GET /api/customers
 * Get all customers for the business/branch
 */
router.get('/', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { is_active, search, branch_id } = req.query;
  
  // Use query param branch_id if provided, otherwise use header branch_id
  const branchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  const customers = await customersService.getCustomers(req.businessUser!.business_id, {
    branchId,
    isActive: is_active !== undefined ? is_active === 'true' : undefined,
    search: search as string,
  });

  res.json({ success: true, data: customers });
}));

/**
 * GET /api/customers/search
 * Search customers by phone or name
 */
router.get('/search', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { q, branch_id } = req.query;
  
  if (!q) {
    return res.status(400).json({ 
      success: false, 
      error: 'Search query is required' 
    });
  }

  const branchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  const customers = await customersService.searchCustomers(
    req.businessUser!.business_id,
    q as string,
    branchId
  );

  res.json({ success: true, data: customers });
}));

/**
 * GET /api/customers/:id
 * Get a specific customer
 */
router.get('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const customerId = parseInt(req.params.id);
  
  const customer = await customersService.getCustomer(req.businessUser!.business_id, customerId);

  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  res.json({ success: true, data: customer });
}));

/**
 * POST /api/customers
 * Create a new customer
 */
router.post('/', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, phone, email, address, address_lat, address_lng, notes, branch_id } = req.body;

  if (!name && !phone) {
    return res.status(400).json({ 
      success: false, 
      error: 'Customer name or phone is required' 
    });
  }

  // Use body branch_id if provided, otherwise use header branch_id (can be null for all branches)
  const branchId = branch_id !== undefined ? branch_id : req.businessUser!.branch_id;

  const customer = await customersService.createCustomer(req.businessUser!.business_id, {
    name: name || 'Unknown',
    name_ar,
    phone,
    email,
    address,
    address_lat,
    address_lng,
    notes,
    branch_id: branchId,
  });

  res.status(201).json({ success: true, data: customer });
}));

/**
 * PUT /api/customers/:id
 * Update a customer
 */
router.put('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const customerId = parseInt(req.params.id);
  const { name, name_ar, phone, email, address, address_lat, address_lng, notes, is_active, branch_id } = req.body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (name_ar !== undefined) updateData.name_ar = name_ar;
  if (phone !== undefined) updateData.phone = phone;
  if (email !== undefined) updateData.email = email;
  if (address !== undefined) updateData.address = address;
  if (address_lat !== undefined) updateData.address_lat = address_lat;
  if (address_lng !== undefined) updateData.address_lng = address_lng;
  if (notes !== undefined) updateData.notes = notes;
  if (is_active !== undefined) updateData.is_active = is_active;
  if (branch_id !== undefined) updateData.branch_id = branch_id;

  const customer = await customersService.updateCustomer(
    req.businessUser!.business_id,
    customerId,
    updateData
  );

  if (!customer) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  res.json({ success: true, data: customer });
}));

/**
 * DELETE /api/customers/:id
 * Delete a customer
 */
router.delete('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const customerId = parseInt(req.params.id);
  
  const deleted = await customersService.deleteCustomer(req.businessUser!.business_id, customerId);

  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }

  res.json({ success: true, message: 'Customer deleted successfully' });
}));

export default router;








