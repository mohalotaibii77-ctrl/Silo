/**
 * API ROUTER
 * Main entry point for all API routes
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import businessAuthRoutes from './business-auth.routes';
import unifiedAuthRoutes from './unified-auth.routes';
import posRoutes from './pos.routes';
import inventoryRoutes from './inventory.routes';
import businessRoutes from './business.routes';
import businessSettingsRoutes from './business-settings.routes';
import storeProductsRoutes from './store-products.routes';
import categoriesRoutes from './categories.routes';
import discountsRoutes from './discounts.routes';
import bundlesRoutes from './bundles.routes';
import businessUsersRoutes from './business-users.routes';
import ownerRoutes from './owner.routes';
import analyticsRoutes from './analytics.routes';
import inventoryStockRoutes from './inventory-stock.routes';
import inventoryProductionRoutes from './inventory-production.routes';
import inventoryTransactionRoutes from './inventory-transaction.routes';
import deliveryRoutes from './delivery.routes';
import tablesRoutes from './tables.routes';
import driversRoutes from './drivers.routes';
import customersRoutes from './customers.routes';
import configRoutes from './config.routes';
import imagesRoutes from './images.routes';
import posSessionRoutes from './pos-session.routes';

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
router.use('/unified-auth', unifiedAuthRoutes);  // Unified login for Main website (redirects based on role)
router.use('/pos', posRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/businesses', businessRoutes);
router.use('/business-settings', businessSettingsRoutes);  // Business settings (localization, change requests)
router.use('/store-products', storeProductsRoutes);  // Products with ingredients for menu & POS
router.use('/categories', categoriesRoutes);  // Product categories (system + business-specific)
router.use('/discounts', discountsRoutes);  // Discount codes management
router.use('/bundles', bundlesRoutes);  // Product bundles (2+ products sold as 1)
router.use('/business-users', businessUsersRoutes);  // Business users management (for store-setup)
router.use('/owners', ownerRoutes);  // Platform-level owner management (SuperAdmin)
router.use('/analytics', analyticsRoutes);  // Dashboard analytics for business owners
router.use('/inventory-stock', inventoryStockRoutes);  // Vendors, Purchase Orders, Transfers, Counts
router.use('/inventory/production', inventoryProductionRoutes);  // Composite item production, schedules, notifications
router.use('/inventory', inventoryTransactionRoutes);  // Inventory adjustments and timeline
router.use('/delivery', deliveryRoutes);  // Delivery partners management
router.use('/tables', tablesRoutes);  // Restaurant tables management (dine-in)
router.use('/drivers', driversRoutes);  // In-house delivery drivers management
router.use('/customers', customersRoutes);  // Customer management
router.use('/config', configRoutes);  // System configuration (categories, units, currencies, etc.)
router.use('/images', imagesRoutes);  // Image processing and thumbnails
router.use('/pos-sessions', posSessionRoutes);  // POS shift management (cash drawer, reconciliation)

// TODO: Add more routes as services are implemented
// router.use('/hr', hrRoutes);
// router.use('/operations', operationsRoutes);

export default router;

