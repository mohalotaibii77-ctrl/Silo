/**
 * API ROUTER
 * Main entry point for all API routes
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import businessAuthRoutes from './business-auth.routes';
import posRoutes from './pos.routes';
import inventoryRoutes from './inventory.routes';
import businessRoutes from './business.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Silo API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/business-auth', businessAuthRoutes);  // Business App login (business_users table)
router.use('/pos', posRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/businesses', businessRoutes);

// TODO: Add more routes as services are implemented
// router.use('/hr', hrRoutes);
// router.use('/operations', operationsRoutes);

export default router;

