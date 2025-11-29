/**
 * AUTH MIDDLEWARE
 * JWT verification and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { AuthPayload, UserRole } from '../types';

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
 * Require same business access
 */
export function requireBusinessAccess(req: Request, res: Response, next: NextFunction) {
  const businessId = req.params.businessId || req.body.businessId || req.query.businessId;
  
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

  if (businessId && businessId !== req.user.businessId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to this business',
    });
  }

  next();
}

