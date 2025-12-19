/**
 * UNIFIED AUTH ROUTES
 * Single login endpoint that determines user type and returns appropriate redirect URL
 */

import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { businessAuthService } from '../services/business-auth.service';

const router = Router();

/**
 * POST /api/unified-auth/login
 * Unified login that checks both superadmin and business users
 * Returns redirect URL based on user type
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({
        success: false,
        error: 'Username/Email and password are required',
      });
      return;
    }

    // Determine redirect URLs based on environment
    // Important: Redirect to /login path so the login page can process the token from URL params
    const isProduction = process.env.NODE_ENV === 'production';
    const adminUrl = isProduction ? 'https://admin.syloco.com/login' : 'http://localhost:3000/login';
    const appUrl = isProduction ? 'https://app.syloco.com/login' : 'http://localhost:3002/login';

    // First, try to login as SuperAdmin (uses email)
    try {
      const result = await authService.login(identifier, password);
      
      // Check if user is superadmin
      if (result.user.role === 'super_admin') {
        res.json({
          success: true,
          userType: 'superadmin',
          redirectUrl: adminUrl,
          token: result.token,
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.first_name,
            lastName: result.user.last_name,
            role: result.user.role,
          },
        });
        return;
      }
    } catch (superAdminError) {
      // SuperAdmin login failed, try business user login
      console.log('SuperAdmin login failed, trying business auth...');
    }

    // Try to login as Business user (uses username)
    try {
      const result = await businessAuthService.login(identifier, password);
      
      res.json({
        success: true,
        userType: 'business',
        redirectUrl: appUrl,
        token: result.token,
        user: {
          id: result.user.id,
          username: result.user.username,
          firstName: result.user.first_name,
          lastName: result.user.last_name,
          role: result.user.role,
        },
        business: result.business ? {
          id: result.business.id,
          name: result.business.name,
          slug: result.business.slug,
        } : null,
        requiresPasswordChange: result.requiresPasswordChange,
      });
      return;
    } catch (businessError) {
      // Both login attempts failed
      console.log('Business auth also failed');
    }

    // If we reach here, both login attempts failed
    res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  } catch (error) {
    console.error('Unified auth login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
    });
  }
});

export default router;

