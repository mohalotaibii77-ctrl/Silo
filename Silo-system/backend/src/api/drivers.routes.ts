/**
 * DRIVERS API ROUTES
 * Manage in-house delivery drivers for businesses/branches
 */

import { Router, Request, Response } from 'express';
import { driversService } from '../services/drivers.service';
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

// ==================== DRIVERS ROUTES ====================

/**
 * GET /api/drivers
 * Get all drivers for the business/branch
 */
router.get('/', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { is_active, status, branch_id } = req.query;
  
  // Use query param branch_id if provided, otherwise use header branch_id
  const branchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  const drivers = await driversService.getDrivers(req.businessUser!.business_id, {
    branchId,
    isActive: is_active !== undefined ? is_active === 'true' : undefined,
    status: status as string,
  });

  res.json({ success: true, data: drivers });
}));

/**
 * GET /api/drivers/available
 * Get available drivers for the business/branch
 */
router.get('/available', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { branch_id } = req.query;
  
  const branchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  const drivers = await driversService.getAvailableDrivers(
    req.businessUser!.business_id,
    branchId
  );

  res.json({ success: true, data: drivers });
}));

/**
 * GET /api/drivers/:id
 * Get a specific driver
 */
router.get('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const driverId = parseInt(req.params.id);
  
  const driver = await driversService.getDriver(req.businessUser!.business_id, driverId);

  if (!driver) {
    return res.status(404).json({ success: false, error: 'Driver not found' });
  }

  res.json({ success: true, data: driver });
}));

/**
 * POST /api/drivers
 * Create a new driver
 */
router.post('/', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, phone, email, vehicle_type, vehicle_number, branch_id } = req.body;

  if (!name) {
    return res.status(400).json({ 
      success: false, 
      error: 'Driver name is required' 
    });
  }

  // Use body branch_id if provided, otherwise use header branch_id (can be null for all branches)
  const branchId = branch_id !== undefined ? branch_id : req.businessUser!.branch_id;

  const driver = await driversService.createDriver(req.businessUser!.business_id, {
    name,
    name_ar,
    phone,
    email,
    vehicle_type,
    vehicle_number,
    branch_id: branchId,
  });

  res.status(201).json({ success: true, data: driver });
}));

/**
 * PUT /api/drivers/:id
 * Update a driver
 */
router.put('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const driverId = parseInt(req.params.id);
  const { name, name_ar, phone, email, vehicle_type, vehicle_number, status, is_active, branch_id } = req.body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (name_ar !== undefined) updateData.name_ar = name_ar;
  if (phone !== undefined) updateData.phone = phone;
  if (email !== undefined) updateData.email = email;
  if (vehicle_type !== undefined) updateData.vehicle_type = vehicle_type;
  if (vehicle_number !== undefined) updateData.vehicle_number = vehicle_number;
  if (status !== undefined) updateData.status = status;
  if (is_active !== undefined) updateData.is_active = is_active;
  if (branch_id !== undefined) updateData.branch_id = branch_id;

  const driver = await driversService.updateDriver(
    req.businessUser!.business_id,
    driverId,
    updateData
  );

  if (!driver) {
    return res.status(404).json({ success: false, error: 'Driver not found' });
  }

  res.json({ success: true, data: driver });
}));

/**
 * PUT /api/drivers/:id/status
 * Update driver status (available, busy, offline)
 */
router.put('/:id/status', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const driverId = parseInt(req.params.id);
  const { status } = req.body;

  if (!status || !['available', 'busy', 'offline'].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Valid status is required (available, busy, offline)' 
    });
  }

  const driver = await driversService.updateDriverStatus(
    req.businessUser!.business_id,
    driverId,
    status
  );

  if (!driver) {
    return res.status(404).json({ success: false, error: 'Driver not found' });
  }

  res.json({ success: true, data: driver });
}));

/**
 * DELETE /api/drivers/:id
 * Delete a driver
 */
router.delete('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const driverId = parseInt(req.params.id);
  
  const deleted = await driversService.deleteDriver(req.businessUser!.business_id, driverId);

  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Driver not found' });
  }

  res.json({ success: true, message: 'Driver deleted successfully' });
}));

export default router;



