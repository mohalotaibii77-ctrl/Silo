/**
 * AUTH MIDDLEWARE
 * JWT verification and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { AuthPayload, UserRole } from '../types';
import { supabaseAdmin } from '../config/database';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Verify JWT token
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    const payload = authService.verifyToken(token);
    
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Require specific roles
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    next();
  };
}

/**
 * Require POS terminal access (for order editing)
 * Only POS operators, cashiers, and owners can edit orders
 */
export function requirePOSAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const allowedRoles: UserRole[] = ['pos', 'cashier', 'owner', 'super_admin'];
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'POS access required. Only POS operators can edit orders.',
    });
  }

  next();
}

/**
 * Require Kitchen Display access (for completing orders)
 * Only kitchen display role can mark orders as complete
 */
export function requireKitchenAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const allowedRoles: UserRole[] = ['kitchen_display', 'super_admin'];
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Kitchen Display access required. Only kitchen staff can complete orders.',
    });
  }

  next();
}

/**
 * Require same business access
 * Supports workspace switching via X-Business-Id header for owners
 */
export async function requireBusinessAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  // Super admin can access any business
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Check for workspace switching header (X-Business-Id)
  const headerBusinessId = req.headers['x-business-id'] as string;
  
  if (headerBusinessId && headerBusinessId !== req.user.businessId) {
    // Owner is trying to access a different business (workspace switching)
    // Verify they have access via the business_owners table
    if (req.user.role === 'owner') {
      try {
        const { data: ownerAccess } = await supabaseAdmin
          .from('owners')
          .select(`
            id,
            business_owners!inner (
              business_id
            )
          `)
          .ilike('username', req.user.username || '')
          .eq('business_owners.business_id', parseInt(headerBusinessId))
          .single();

        if (ownerAccess) {
          // Owner has access - update the businessId for this request (as number)
          (req.user as any).businessId = parseInt(headerBusinessId);
          return next();
        }
      } catch (err) {
        console.error('Error checking owner business access:', err);
      }
    }
    
    return res.status(403).json({
      success: false,
      error: 'Access denied to this business',
    });
  }

  next();
}

