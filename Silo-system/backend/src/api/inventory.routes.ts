/**
 * INVENTORY & ITEMS API ROUTES
 * Manages raw materials and ingredients with business-specific pricing
 */

import { Router, Request, Response } from 'express';
import { inventoryService, ItemCategory, ItemUnit } from '../services/inventory.service';
import { asyncHandler } from '../middleware/error.middleware';
import { businessAuthService } from '../services/business-auth.service';

const router = Router();

interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    username: string;
    role: string;
  };
}

// Business auth middleware
async function authenticateBusiness(req: AuthenticatedRequest, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = businessAuthService.verifyToken(token);
    
    const user = await businessAuthService.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    req.businessUser = {
      id: user.id,
      business_id: user.business_id,
      username: user.username,
      role: user.role,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ============ ITEMS ============

/**
 * GET /api/inventory/items
 * Get all items for the business with business-specific prices
 */
router.get('/items', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { category } = req.query;

  const items = await inventoryService.getItems(req.businessUser!.business_id, {
    category: category as ItemCategory,
  });

  res.json({
    success: true,
    data: items,
  });
}));

/**
 * GET /api/inventory/items/:itemId
 * Get single item with business-specific price
 */
router.get('/items/:itemId', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const item = await inventoryService.getItem(
    parseInt(req.params.itemId),
    req.businessUser!.business_id
  );

  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  res.json({
    success: true,
    data: item,
  });
}));

/**
 * POST /api/inventory/items
 * Create new item (business-specific)
 */
router.post('/items', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, category, unit, cost_per_unit } = req.body;

  if (!name || !category) {
    return res.status(400).json({
      success: false,
      error: 'Name and category are required',
    });
  }

  const item = await inventoryService.createItem({
    business_id: req.businessUser!.business_id,
    name,
    name_ar,
    category,
    unit,
    cost_per_unit,
  });

  res.status(201).json({
    success: true,
    data: item,
  });
}));

/**
 * PUT /api/inventory/items/:itemId
 * Update item (only for business-owned items)
 */
router.put('/items/:itemId', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, category, unit, cost_per_unit, status } = req.body;
  const itemId = parseInt(req.params.itemId);

  // First check if this item belongs to the business
  const existingItem = await inventoryService.getItem(itemId);
  
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  // If it's a general item (business_id is null), can only update price via the price endpoint
  if (existingItem.business_id === null) {
    return res.status(403).json({
      success: false,
      error: 'Cannot modify general items. Use the price endpoint to set your business price.',
    });
  }

  // If it belongs to a different business, deny
  if (existingItem.business_id !== req.businessUser!.business_id) {
    return res.status(403).json({
      success: false,
      error: 'You can only modify your own items',
    });
  }

  const item = await inventoryService.updateItem(itemId, {
    name,
    name_ar,
    category,
    unit,
    cost_per_unit,
    status,
  });

  res.json({
    success: true,
    data: item,
  });
}));

/**
 * DELETE /api/inventory/items/:itemId
 * Soft delete item (only for business-owned items)
 */
router.delete('/items/:itemId', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const itemId = parseInt(req.params.itemId);

  // First check if this item belongs to the business
  const existingItem = await inventoryService.getItem(itemId);
  
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  if (existingItem.business_id === null || existingItem.business_id !== req.businessUser!.business_id) {
    return res.status(403).json({
      success: false,
      error: 'You can only delete your own items',
    });
  }

  const item = await inventoryService.deleteItem(itemId);

  res.json({
    success: true,
    data: item,
  });
}));

// ============ BUSINESS-SPECIFIC PRICING ============

/**
 * PUT /api/inventory/items/:itemId/price
 * Set business-specific price for an item (works for both general and business items)
 */
router.put('/items/:itemId/price', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { price } = req.body;
  const itemId = parseInt(req.params.itemId);

  if (price === undefined || price === null) {
    return res.status(400).json({
      success: false,
      error: 'Price is required',
    });
  }

  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({
      success: false,
      error: 'Price must be a non-negative number',
    });
  }

  // Verify item exists
  const item = await inventoryService.getItem(itemId);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  const businessPrice = await inventoryService.setBusinessItemPrice(
    req.businessUser!.business_id,
    itemId,
    price
  );

  res.json({
    success: true,
    data: businessPrice,
    message: 'Price updated successfully',
  });
}));

/**
 * DELETE /api/inventory/items/:itemId/price
 * Remove business-specific price (revert to default)
 */
router.delete('/items/:itemId/price', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const itemId = parseInt(req.params.itemId);

  await inventoryService.removeBusinessItemPrice(req.businessUser!.business_id, itemId);

  res.json({
    success: true,
    message: 'Price reset to default',
  });
}));

// ============ PRODUCT INGREDIENTS ============

/**
 * GET /api/inventory/products/:productId/ingredients
 * Get product with ingredients and variants
 */
router.get('/products/:productId/ingredients', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const product = await inventoryService.getProductWithIngredients(
    parseInt(req.params.productId),
    req.businessUser!.business_id
  );
  
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  
  res.json({ success: true, data: product });
}));

/**
 * PUT /api/inventory/products/:productId/ingredients
 * Update product ingredients, variants, and modifiers (add-ons)
 */
router.put('/products/:productId/ingredients', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const productId = parseInt(req.params.productId);
  const { has_variants, variants, ingredients, modifiers } = req.body;

  // Validate based on whether product has variants
  if (has_variants) {
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one variant is required for products with variants' });
    }
    // Check each variant has a name and ingredients
    for (const variant of variants) {
      if (!variant.name) {
        return res.status(400).json({ success: false, error: 'Each variant must have a name' });
      }
    }
  }

  const product = await inventoryService.updateProductIngredients(productId, req.businessUser!.business_id, {
    has_variants: has_variants || false,
    variants,
    ingredients,
    modifiers,
  });

  res.json({ success: true, data: product });
}));

/**
 * GET /api/inventory/products/:productId/cost
 * Calculate product cost from ingredients
 */
router.get('/products/:productId/cost', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const cost = await inventoryService.calculateProductCost(
    parseInt(req.params.productId),
    req.businessUser!.business_id
  );
  res.json({ success: true, data: cost });
}));

// ============ COMPOSITE ITEMS ============

/**
 * GET /api/inventory/composite-items
 * Get all composite items for the business
 */
router.get('/composite-items', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const items = await inventoryService.getCompositeItems(req.businessUser!.business_id);
  res.json({ success: true, data: items });
}));

/**
 * GET /api/inventory/composite-items/:itemId
 * Get a composite item with its components
 */
router.get('/composite-items/:itemId', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const item = await inventoryService.getCompositeItem(
    parseInt(req.params.itemId),
    req.businessUser!.business_id
  );

  if (!item) {
    return res.status(404).json({ success: false, error: 'Composite item not found' });
  }

  res.json({ success: true, data: item });
}));

/**
 * POST /api/inventory/composite-items
 * Create a new composite item (item made from other items)
 * Body: { 
 *   name, name_ar?, category, unit, 
 *   batch_quantity, batch_unit,  // How much this recipe produces
 *   components: [{ item_id, quantity }] 
 * }
 * 
 * Example: "Special Sauce" with batch_quantity=500, batch_unit='grams'
 * means "this recipe produces 500 grams of sauce"
 */
router.post('/composite-items', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, category, unit, batch_quantity, batch_unit, components } = req.body;

  // Validate required fields
  if (!name || !category || !unit) {
    return res.status(400).json({
      success: false,
      error: 'Name, category, and unit are required',
    });
  }

  // Validate batch tracking fields
  if (!batch_quantity || batch_quantity <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Batch quantity is required and must be greater than 0',
    });
  }

  const validUnits: ItemUnit[] = ['grams', 'mL', 'piece'];
  if (!batch_unit || !validUnits.includes(batch_unit)) {
    return res.status(400).json({
      success: false,
      error: 'Batch unit is required and must be grams, mL, or piece',
    });
  }

  if (!components || !Array.isArray(components) || components.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one component is required for a composite item',
    });
  }

  // Validate each component has item_id and quantity
  for (const comp of components) {
    if (!comp.item_id || !comp.quantity || comp.quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Each component must have item_id and quantity > 0',
      });
    }
  }

  const item = await inventoryService.createCompositeItem({
    business_id: req.businessUser!.business_id,
    name,
    name_ar,
    category,
    unit: unit as ItemUnit,
    batch_quantity: parseFloat(batch_quantity),
    batch_unit: batch_unit as ItemUnit,
    components,
  });

  res.status(201).json({ success: true, data: item });
}));

/**
 * PUT /api/inventory/composite-items/:itemId/components
 * Update components of a composite item
 * Body: { components: [{ item_id, quantity }] }
 */
router.put('/composite-items/:itemId/components', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const itemId = parseInt(req.params.itemId);
  const { components } = req.body;

  if (!components || !Array.isArray(components)) {
    return res.status(400).json({
      success: false,
      error: 'Components array is required',
    });
  }

  // Validate each component
  for (const comp of components) {
    if (!comp.item_id || !comp.quantity || comp.quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Each component must have item_id and quantity > 0',
      });
    }
  }

  const item = await inventoryService.updateCompositeItemComponents(
    itemId,
    req.businessUser!.business_id,
    components
  );

  res.json({ success: true, data: item });
}));

/**
 * POST /api/inventory/composite-items/:itemId/recalculate-cost
 * Recalculate cost of a composite item based on current component prices
 */
router.post('/composite-items/:itemId/recalculate-cost', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const itemId = parseInt(req.params.itemId);
  
  const newCost = await inventoryService.recalculateCompositeItemCost(
    itemId,
    req.businessUser!.business_id
  );

  res.json({ 
    success: true, 
    data: { cost: newCost },
    message: 'Cost recalculated successfully',
  });
}));

export default router;
