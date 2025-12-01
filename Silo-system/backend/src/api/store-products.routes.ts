/**
 * STORE PRODUCTS API ROUTES
 * Products management for store-setup
 */

import { Router } from 'express';
import { storeProductsService } from '../services/store-products.service';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireBusinessAccess } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/store-products
 * Get all products for business
 */
router.get('/', requireBusinessAccess, asyncHandler(async (req, res) => {
  const products = await storeProductsService.getProducts(req.user!.businessId);
  
  res.json({
    success: true,
    data: products,
  });
}));

/**
 * GET /api/store-products/:id
 * Get single product
 */
router.get('/:id', requireBusinessAccess, asyncHandler(async (req, res) => {
  const product = await storeProductsService.getProduct(
    parseInt(req.params.id),
    req.user!.businessId
  );
  
  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  res.json({
    success: true,
    data: product,
  });
}));

/**
 * POST /api/store-products
 * Create a new product
 */
router.post('/', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { name, name_ar, description, description_ar, sku, category_id, price, tax_rate, has_variants, image_url } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Name and price are required',
    });
  }

  const product = await storeProductsService.createProduct(req.user!.businessId, {
    name,
    name_ar,
    description,
    description_ar,
    sku,
    category_id,
    price,
    tax_rate,
    has_variants,
    image_url,
  });

  res.status(201).json({
    success: true,
    data: product,
  });
}));

/**
 * PUT /api/store-products/:id
 * Update a product
 */
router.put('/:id', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { name, name_ar, description, description_ar, sku, category_id, price, tax_rate, has_variants, image_url, is_active } = req.body;

  const product = await storeProductsService.updateProduct(
    parseInt(req.params.id),
    req.user!.businessId,
    { name, name_ar, description, description_ar, sku, category_id, price, tax_rate, has_variants, image_url, is_active }
  );

  res.json({
    success: true,
    data: product,
  });
}));

/**
 * DELETE /api/store-products/:id
 * Delete a product (soft delete)
 */
router.delete('/:id', requireBusinessAccess, asyncHandler(async (req, res) => {
  await storeProductsService.deleteProduct(
    parseInt(req.params.id),
    req.user!.businessId
  );
  
  res.json({
    success: true,
    message: 'Product deleted',
  });
}));

export default router;

