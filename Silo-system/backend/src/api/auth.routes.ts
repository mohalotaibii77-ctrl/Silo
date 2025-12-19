/**
 * AUTH API ROUTES
 */

import { Router } from 'express';
import { authService } from '../services';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    const result = await authService.login(email, password);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Auth login error:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    
    res.status(401).json({
      success: false,
      error: message,
    });
  }
});

/**
 * POST /api/auth/register
 * Register new user (requires auth for non-owner roles)
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, businessId, role } = req.body;

  if (!email || !password || !firstName || !lastName || !businessId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
    });
  }

  const user = await authService.register({
    email,
    password,
    firstName,
    lastName,
    businessId,
    role,
  });
  
  res.status(201).json({
    success: true,
    data: user,
  });
}));

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user!.userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  res.json({
    success: true,
    data: user,
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh token
 */
router.post('/refresh', authenticate, asyncHandler(async (req, res) => {
  const newToken = authService.generateToken(req.user!);
  
  res.json({
    success: true,
    data: { token: newToken },
  });
}));

export default router;




