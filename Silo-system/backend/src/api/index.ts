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
import businessSettingsRoutes from './business-settings.routes';
import productsRoutes from './products.routes';
import storeProductsRoutes from './store-products.routes';
import categoriesRoutes from './categories.routes';
import discountsRoutes from './discounts.routes';
import bundlesRoutes from './bundles.routes';
import businessUsersRoutes from './business-users.routes';
import ownerRoutes from './owner.routes';

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
router.use('/business-settings', businessSettingsRoutes);  // Business settings (localization, change requests)
router.use('/products', productsRoutes);  // POS Products with variants and modifiers
router.use('/store-products', storeProductsRoutes);  // Store-setup products with ingredients
router.use('/categories', categoriesRoutes);  // Product categories (system + business-specific)
router.use('/discounts', discountsRoutes);  // Discount codes management
router.use('/bundles', bundlesRoutes);  // Product bundles (2+ products sold as 1)
router.use('/business-users', businessUsersRoutes);  // Business users management (for store-setup)
router.use('/owners', ownerRoutes);  // Platform-level owner management (SuperAdmin)

// TODO: Add more routes as services are implemented
// router.use('/hr', hrRoutes);
// router.use('/operations', operationsRoutes);

export default router;

