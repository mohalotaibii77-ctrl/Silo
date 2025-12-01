/**
 * PRODUCTS API ROUTES
 * Products with variants and modifiers for POS
 */

import { Router } from 'express';
import { productsService } from '../services/products.service';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireBusinessAccess } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/products
 * Get all products for business (for POS)
 */
router.get('/', requireBusinessAccess, asyncHandler(async (req, res) => {
  const products = await productsService.getProducts(req.user!.businessId);
  
  res.json({
    success: true,
    data: products,
  });
}));

/**
 * GET /api/products/categories
 * Get all categories for business
 */
router.get('/categories', requireBusinessAccess, asyncHandler(async (req, res) => {
  const categories = await productsService.getCategories(req.user!.businessId);
  
  res.json({
    success: true,
    data: categories,
  });
}));

/**
 * POST /api/products/categories
 * Create a new category
 */
router.post('/categories', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { name, name_ar } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Category name is required',
    });
  }

  const category = await productsService.createCategory(req.user!.businessId, name, name_ar);
  
  res.status(201).json({
    success: true,
    data: category,
  });
}));

/**
 * GET /api/products/:id
 * Get single product with variants and modifiers
 */
router.get('/:id', requireBusinessAccess, asyncHandler(async (req, res) => {
  const product = await productsService.getProduct(req.params.id, req.user!.businessId);
  
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
 * POST /api/products
 * Create a new product
 */
router.post('/', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { name, name_ar, description, category_id, base_price, image_url, variant_groups, modifiers } = req.body;

  if (!name || base_price === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Name and base price are required',
    });
  }

  const product = await productsService.createProduct({
    business_id: req.user!.businessId,
    name,
    name_ar,
    description,
    category_id,
    base_price,
    image_url,
    variant_groups,
    modifiers,
  });

  res.status(201).json({
    success: true,
    data: product,
  });
}));

/**
 * PUT /api/products/:id
 * Update a product
 */
router.put('/:id', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { name, name_ar, description, category_id, base_price, image_url, variant_groups, modifiers } = req.body;

  const product = await productsService.updateProduct(req.params.id, req.user!.businessId, {
    name,
    name_ar,
    description,
    category_id,
    base_price,
    image_url,
    variant_groups,
    modifiers,
  });

  res.json({
    success: true,
    data: product,
  });
}));

/**
 * DELETE /api/products/:id
 * Delete a product (soft delete)
 */
router.delete('/:id', requireBusinessAccess, asyncHandler(async (req, res) => {
  await productsService.deleteProduct(req.params.id, req.user!.businessId);
  
  res.json({
    success: true,
    message: 'Product deleted',
  });
}));

/**
 * PATCH /api/products/:id/availability
 * Toggle product availability
 */
router.patch('/:id/availability', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { available } = req.body;

  if (available === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Available status is required',
    });
  }

  const product = await productsService.toggleAvailability(req.params.id, req.user!.businessId, available);

  res.json({
    success: true,
    data: product,
  });
}));

export default router;

