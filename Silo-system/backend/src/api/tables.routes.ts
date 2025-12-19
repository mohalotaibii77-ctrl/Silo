/**
 * RESTAURANT TABLES API ROUTES
 * Manage dine-in tables for branches
 */

import { Router, Request, Response } from 'express';
import { tablesService } from '../services/tables.service';
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

// ==================== TABLES ROUTES ====================

/**
 * GET /api/tables
 * Get all tables for the current branch
 */
router.get('/', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { is_active, is_occupied, zone, branch_id } = req.query;
  
  // Use query param branch_id if provided, otherwise use header branch_id
  let branchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  // If no branch specified, get the main branch for this business
  if (!branchId) {
    const { data: mainBranch } = await tablesService.getMainBranch(req.businessUser!.business_id);
    if (mainBranch) {
      branchId = mainBranch.id;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'No branch found for this business' 
      });
    }
  }

  const tables = await tablesService.getTables(req.businessUser!.business_id, branchId, {
    isActive: is_active !== undefined ? is_active === 'true' : undefined,
    isOccupied: is_occupied !== undefined ? is_occupied === 'true' : undefined,
    zone: zone as string,
  });

  res.json({ success: true, data: tables });
}));

/**
 * GET /api/tables/available
 * Get available tables for the current branch
 */
router.get('/available', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { min_seats, branch_id } = req.query;
  
  let branchId = branch_id 
    ? parseInt(branch_id as string) 
    : req.businessUser!.branch_id;

  // If no branch specified, get the main branch
  if (!branchId) {
    const { data: mainBranch } = await tablesService.getMainBranch(req.businessUser!.business_id);
    if (mainBranch) {
      branchId = mainBranch.id;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'No branch found for this business' 
      });
    }
  }

  const tables = await tablesService.getAvailableTables(
    req.businessUser!.business_id,
    branchId,
    min_seats ? parseInt(min_seats as string) : undefined
  );

  res.json({ success: true, data: tables });
}));

/**
 * GET /api/tables/:id
 * Get a specific table
 */
router.get('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tableId = parseInt(req.params.id);
  
  const table = await tablesService.getTable(req.businessUser!.business_id, tableId);

  if (!table) {
    return res.status(404).json({ success: false, error: 'Table not found' });
  }

  res.json({ success: true, data: table });
}));

/**
 * POST /api/tables
 * Create a new table
 */
router.post('/', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { table_number, table_code, seats, zone, description, branch_id } = req.body;

  if (!table_number) {
    return res.status(400).json({ 
      success: false, 
      error: 'Table number is required' 
    });
  }

  if (!seats || seats < 1) {
    return res.status(400).json({ 
      success: false, 
      error: 'Number of seats must be at least 1' 
    });
  }

  // Use body branch_id if provided, otherwise use header branch_id
  let branchId = branch_id || req.businessUser!.branch_id;

  // If no branch specified, get the main branch
  if (!branchId) {
    const { data: mainBranch } = await tablesService.getMainBranch(req.businessUser!.business_id);
    if (mainBranch) {
      branchId = mainBranch.id;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'No branch found for this business' 
      });
    }
  }

  try {
    const table = await tablesService.createTable(req.businessUser!.business_id, branchId, {
      table_number,
      table_code,
      seats: parseInt(seats),
      zone,
      description,
    });

    res.status(201).json({ success: true, data: table });
  } catch (err: any) {
    if (err.message === 'Table number already exists for this branch') {
      return res.status(400).json({ success: false, error: err.message });
    }
    throw err;
  }
}));

/**
 * PUT /api/tables/:id
 * Update a table
 */
router.put('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tableId = parseInt(req.params.id);
  const { table_number, table_code, seats, zone, description, is_active } = req.body;

  const updateData: any = {};
  if (table_number !== undefined) updateData.table_number = table_number;
  if (table_code !== undefined) updateData.table_code = table_code;
  if (seats !== undefined) updateData.seats = parseInt(seats);
  if (zone !== undefined) updateData.zone = zone;
  if (description !== undefined) updateData.description = description;
  if (is_active !== undefined) updateData.is_active = is_active;

  try {
    const table = await tablesService.updateTable(
      req.businessUser!.business_id,
      tableId,
      updateData
    );

    res.json({ success: true, data: table });
  } catch (err: any) {
    if (err.message === 'Table number already exists for this branch') {
      return res.status(400).json({ success: false, error: err.message });
    }
    throw err;
  }
}));

/**
 * POST /api/tables/:id/occupy
 * Mark table as occupied
 */
router.post('/:id/occupy', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tableId = parseInt(req.params.id);
  const { order_id } = req.body;

  const table = await tablesService.occupyTable(
    req.businessUser!.business_id,
    tableId,
    order_id ? parseInt(order_id) : undefined
  );

  res.json({ success: true, data: table });
}));

/**
 * POST /api/tables/:id/release
 * Mark table as available
 */
router.post('/:id/release', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tableId = parseInt(req.params.id);

  const table = await tablesService.releaseTable(req.businessUser!.business_id, tableId);

  res.json({ success: true, data: table });
}));

/**
 * DELETE /api/tables/:id
 * Delete a table
 */
router.delete('/:id', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const tableId = parseInt(req.params.id);
  
  await tablesService.deleteTable(req.businessUser!.business_id, tableId);

  res.json({ success: true, message: 'Table deleted successfully' });
}));

export default router;


