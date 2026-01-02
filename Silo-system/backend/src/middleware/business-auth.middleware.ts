/**
 * BUSINESS AUTH MIDDLEWARE
 * Shared authentication middleware for all business routes
 * Supports workspace switching via X-Business-Id header
 */

import { Request, Response, NextFunction } from 'express';
import { businessAuthService } from '../services/business-auth.service';

export interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    branch_id?: number;
    username: string;
    role: string;
  };
}

/**
 * Authenticates business users and supports workspace switching
 * - Reads token from Authorization header
 * - Supports X-Business-Id header for workspace switching (owners only)
 * - Supports X-Branch-Id header for branch selection
 */
export async function authenticateBusiness(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
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

/**
 * Middleware that only allows owners
 */
export async function authenticateOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  await authenticateBusiness(req, res, () => {
    if (req.businessUser?.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    next();
  });
}

/**
 * Middleware that allows owners and managers
 */
export async function authenticateManager(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  await authenticateBusiness(req, res, () => {
    const role = req.businessUser?.role;
    if (role !== 'owner' && role !== 'manager' && role !== 'operations_manager') {
      return res.status(403).json({ success: false, error: 'Manager access required' });
    }
    next();
  });
}






