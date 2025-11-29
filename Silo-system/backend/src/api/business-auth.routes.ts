/**
 * BUSINESS AUTH ROUTES
 * Authentication endpoints for business users (owner, manager, employee)
 * These users login via the Business App (not SuperAdmin)
 */

import { Router, Request, Response } from 'express';
import { businessAuthService } from '../services/business-auth.service';

const router = Router();

/**
 * POST /api/business-auth/login
 * Login with username and password for business users
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Support both 'email' and 'username' fields (business app sends 'email' but it's actually username)
    const { email, username, password } = req.body;
    const loginUsername = username || email;

    if (!loginUsername || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
      return;
    }

    const result = await businessAuthService.login(loginUsername, password);
    
    res.json({
      success: true,
      token: result.token,
      user: result.user,
      business: result.business,
    });
  } catch (error) {
    console.error('Business auth login error:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    
    res.status(401).json({
      success: false,
      error: message,
    });
  }
});

/**
 * GET /api/business-auth/me
 * Get current business user (requires token in header)
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = businessAuthService.verifyToken(token);
    const user = await businessAuthService.getUserById(payload.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Business auth me error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
});

export default router;

