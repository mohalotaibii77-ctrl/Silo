/**
 * DELIVERY PARTNERS API ROUTES
 * Manage delivery partners for businesses
 */

import { Router, Request, Response } from 'express';
import { deliveryService } from '../services/delivery.service';
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

// ==================== DELIVERY PARTNERS ====================

/**
 * GET /api/delivery/partners
 * Get all delivery partners for a branch
 */
router.get('/partners', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { status, search, branch_id } = req.query;
  
  // Use query param branch_id if provided, otherwise use header branch_id
  const branchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;
  
  const partners = await deliveryService.getDeliveryPartners(req.businessUser!.business_id, {
    status: status as 'active' | 'inactive',
    search: search as string,
    branchId,
  });

  res.json({ success: true, data: partners });
}));

/**
 * GET /api/delivery/partners/:id
 * Get a specific delivery partner
 */
router.get('/partners/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const partnerId = parseInt(req.params.id);
  
  const partner = await deliveryService.getDeliveryPartner(
    req.businessUser!.business_id,
    partnerId
  );

  if (!partner) {
    return res.status(404).json({ success: false, error: 'Delivery partner not found' });
  }

  res.json({ success: true, data: partner });
}));

/**
 * POST /api/delivery/partners
 * Create a new delivery partner
 */
router.post('/partners', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { 
    name, 
    name_ar, 
    branch_id,
    contact_person,
    email,
    phone,
    address,
    city,
    country,
    commission_type,
    commission_value,
    minimum_order,
    delivery_fee,
    estimated_time,
    service_areas,
    notes 
  } = req.body;

  if (!name || !commission_type || commission_value === undefined) {
    return res.status(400).json({ 
      success: false, 
      error: 'Name, commission type, and commission value are required' 
    });
  }

  // Branch is required for delivery partners
  if (!branch_id || branch_id === 'all') {
    return res.status(400).json({ 
      success: false, 
      error: 'Branch is required for delivery partners' 
    });
  }

  const partner = await deliveryService.createDeliveryPartner(req.businessUser!.business_id, {
    name,
    name_ar,
    branch_id: parseInt(branch_id),
    contact_person,
    email,
    phone,
    address,
    city,
    country,
    commission_type,
    commission_value: parseFloat(commission_value),
    minimum_order: minimum_order ? parseFloat(minimum_order) : undefined,
    delivery_fee: delivery_fee ? parseFloat(delivery_fee) : undefined,
    estimated_time: estimated_time ? parseInt(estimated_time) : undefined,
    service_areas,
    notes,
  });

  res.status(201).json({ success: true, data: partner });
}));

/**
 * PUT /api/delivery/partners/:id
 * Update a delivery partner
 */
router.put('/partners/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const partnerId = parseInt(req.params.id);
  const { 
    name, 
    name_ar, 
    contact_person,
    email,
    phone,
    address,
    city,
    country,
    commission_type,
    commission_value,
    minimum_order,
    delivery_fee,
    estimated_time,
    service_areas,
    notes,
    status 
  } = req.body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (name_ar !== undefined) updateData.name_ar = name_ar;
  if (contact_person !== undefined) updateData.contact_person = contact_person;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (city !== undefined) updateData.city = city;
  if (country !== undefined) updateData.country = country;
  if (commission_type !== undefined) updateData.commission_type = commission_type;
  if (commission_value !== undefined) updateData.commission_value = parseFloat(commission_value);
  if (minimum_order !== undefined) updateData.minimum_order = parseFloat(minimum_order);
  if (delivery_fee !== undefined) updateData.delivery_fee = parseFloat(delivery_fee);
  if (estimated_time !== undefined) updateData.estimated_time = parseInt(estimated_time);
  if (service_areas !== undefined) updateData.service_areas = service_areas;
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;

  const partner = await deliveryService.updateDeliveryPartner(
    req.businessUser!.business_id,
    partnerId,
    updateData
  );

  res.json({ success: true, data: partner });
}));

/**
 * DELETE /api/delivery/partners/:id
 * Delete a delivery partner
 */
router.delete('/partners/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const partnerId = parseInt(req.params.id);
  
  await deliveryService.deleteDeliveryPartner(
    req.businessUser!.business_id,
    partnerId
  );

  res.json({ success: true, message: 'Delivery partner deleted successfully' });
}));

export default router;



