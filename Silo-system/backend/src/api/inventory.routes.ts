/**
 * INVENTORY & ITEMS API ROUTES
 * Manages raw materials and ingredients with business-specific pricing
 */

import { Router, Response } from 'express';
import { inventoryService, ItemCategory, ItemUnit, ItemType } from '../services/inventory.service';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticateBusiness, AuthenticatedRequest } from '../middleware/business-auth.middleware';
import { areUnitsCompatible, getCompatibleStorageUnits } from './config.routes';
import { extractPaginationParams, buildPaginatedResponse } from '../utils/pagination';

const router = Router();

// ============ ITEMS ============

/**
 * GET /api/inventory/items
 * Get all items for the business with business-specific prices
 * Query params: category, item_type, page, limit, fields
 */
router.get('/items', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { category, item_type } = req.query;
  const pagination = extractPaginationParams(req);

  const result = await inventoryService.getItems(req.businessUser!.business_id, {
    category: category as ItemCategory,
    item_type: item_type as ItemType,
    page: pagination.page,
    limit: pagination.limit,
    fields: pagination.fields,
  });

  // Support both paginated and non-paginated responses for backward compatibility
  if ('total' in result) {
    const response = buildPaginatedResponse(result.data, result.total, pagination, !!pagination.fields);
    res.json({
      success: true,
      ...response,
    });
  } else {
    // Legacy response format
    res.json({
      success: true,
      data: result,
    });
  }
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
  const { name, name_ar, item_type, category, unit, storage_unit, cost_per_unit } = req.body;

  if (!name || !category) {
    return res.status(400).json({
      success: false,
      error: 'Name and category are required',
    });
  }

  // Check for duplicate name
  const duplicateCheck = await inventoryService.checkDuplicateItemName(
    req.businessUser!.business_id,
    name
  );

  if (duplicateCheck.isDuplicate) {
    return res.status(400).json({
      success: false,
      error: 'duplicate_name',
      message: `An item with the name "${name}" already exists`,
      existing_item: duplicateCheck.existingItem,
    });
  }

  // Validate unit compatibility before creating item
  if (unit && storage_unit && !areUnitsCompatible(storage_unit, unit)) {
    const compatibleOptions = getCompatibleStorageUnits(unit);
    return res.status(400).json({
      success: false,
      error: 'incompatible_units',
      message: `Storage unit '${storage_unit}' is not compatible with serving unit '${unit}'`,
      compatible_storage_units: compatibleOptions,
    });
  }

  try {
    const item = await inventoryService.createItem({
      business_id: req.businessUser!.business_id,
      name,
      name_ar,
      item_type: item_type as ItemType,
      category,
      unit,
      storage_unit,
      cost_per_unit,
    });

    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (err: any) {
    // Handle unit validation errors from service
    if (err.message && err.message.includes('Storage unit')) {
      const compatibleOptions = unit ? getCompatibleStorageUnits(unit) : [];
      return res.status(400).json({
        success: false,
        error: 'incompatible_units',
        message: err.message,
        compatible_storage_units: compatibleOptions,
      });
    }
    throw err;
  }
}));

/**
 * PUT /api/inventory/items/:itemId
 * Update item - works for both default items (clones them) and business items (updates them)
 * When editing a default item, it creates a business-specific copy
 */
router.put('/items/:itemId', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, item_type, category, unit, storage_unit, cost_per_unit, status } = req.body;
  const itemId = parseInt(req.params.itemId);

  // First check if this item exists
  const existingItem = await inventoryService.getItem(itemId);
  
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  // Check for duplicate name if name is being changed
  if (name && name.toLowerCase() !== existingItem.name.toLowerCase()) {
    const duplicateCheck = await inventoryService.checkDuplicateItemName(
      req.businessUser!.business_id,
      name,
      itemId // Exclude current item from check
    );

    if (duplicateCheck.isDuplicate) {
      return res.status(400).json({
        success: false,
        error: 'duplicate_name',
        message: `An item with the name "${name}" already exists`,
        existing_item: duplicateCheck.existingItem,
      });
    }
  }

  // Validate unit compatibility before updating item
  const effectiveUnit = unit || existingItem.unit;
  const effectiveStorageUnit = storage_unit || existingItem.storage_unit;
  
  if (effectiveUnit && effectiveStorageUnit && !areUnitsCompatible(effectiveStorageUnit, effectiveUnit)) {
    const compatibleOptions = getCompatibleStorageUnits(effectiveUnit);
    return res.status(400).json({
      success: false,
      error: 'incompatible_units',
      message: `Storage unit '${effectiveStorageUnit}' is not compatible with serving unit '${effectiveUnit}'`,
      compatible_storage_units: compatibleOptions,
    });
  }

  try {
    // Use the new editItem method which handles both default and business items
    // Note: item_type is not updatable after creation
    const item = await inventoryService.editItem(
      itemId,
      req.businessUser!.business_id,
      {
        name,
        name_ar,
        category,
        unit,
        storage_unit,
        cost_per_unit,
        status,
      }
    );

    // If the original was a default item, it was cloned
    const wasCloned = existingItem.business_id === null;

    res.json({
      success: true,
      data: item,
      message: wasCloned 
        ? 'Default item was customized for your business' 
        : 'Item updated successfully',
      cloned: wasCloned,
    });
  } catch (err: any) {
    // Handle specific errors
    if (err.message && (err.message.includes('Storage unit') || err.message.includes('only edit your own'))) {
      const compatibleOptions = effectiveUnit ? getCompatibleStorageUnits(effectiveUnit) : [];
      return res.status(400).json({
        success: false,
        error: 'incompatible_units',
        message: err.message,
        compatible_storage_units: compatibleOptions,
      });
    }
    throw err;
  }
}));

/**
 * GET /api/inventory/items/:itemId/usage
 * Get usage information for an item (what products, composites, bundles use it)
 * Used to show confirmation dialog before deletion
 */
router.get('/items/:itemId/usage', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const itemId = parseInt(req.params.itemId);

  // First check if this item exists
  const existingItem = await inventoryService.getItem(itemId);
  
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  const usage = await inventoryService.getItemUsage(itemId, req.businessUser!.business_id);

  res.json({
    success: true,
    data: {
      item: {
        id: existingItem.id,
        name: existingItem.name,
        name_ar: existingItem.name_ar,
        is_default: existingItem.business_id === null,
      },
      usage,
    },
  });
}));

/**
 * DELETE /api/inventory/items/:itemId
 * Delete item - works for both default items (hides for business) and business items (soft delete)
 * Query param: cascade=true to delete all related products, composites, bundles
 */
router.delete('/items/:itemId', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const itemId = parseInt(req.params.itemId);
  const cascade = req.query.cascade === 'true';

  // First check if this item exists
  const existingItem = await inventoryService.getItem(itemId);
  
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  // Check if it's a business item belonging to another business
  if (existingItem.business_id !== null && existingItem.business_id !== req.businessUser!.business_id) {
    return res.status(403).json({
      success: false,
      error: 'You can only delete your own items',
    });
  }

  // Get usage info first
  const usage = await inventoryService.getItemUsage(itemId, req.businessUser!.business_id);

  // If item is in use and cascade is not enabled, return error with usage info
  if (usage.totalUsageCount > 0 && !cascade) {
    return res.status(400).json({
      success: false,
      error: 'item_in_use',
      message: 'This item is being used by other entities. Use cascade=true to delete all related entities.',
      usage,
    });
  }

  // Perform the deletion
  const result = await inventoryService.deleteItemForBusiness(
    itemId,
    req.businessUser!.business_id,
    cascade
  );

  res.json({
    success: true,
    data: {
      item_deleted: true,
      is_default_item: existingItem.business_id === null,
      cascade_results: cascade ? {
        deleted_products: result.deletedProducts.length,
        deleted_composite_items: result.deletedCompositeItems.length,
        deleted_bundles: result.deletedBundles.length,
        cleared_inventory_branches: result.clearedInventoryBranches.length,
      } : null,
    },
    message: existingItem.business_id === null 
      ? 'Default item has been hidden from your business'
      : 'Item deleted successfully',
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

/**
 * GET /api/inventory/products/stats
 * Get sales stats (sold count, profit margin) for all products
 */
router.get('/products/stats', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const stats = await inventoryService.getProductStats(req.businessUser!.business_id);
  res.json({ success: true, data: stats });
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
 *   name, name_ar?, category, unit, storage_unit?,
 *   batch_quantity, batch_unit,  // How much this recipe produces
 *   components: [{ item_id, quantity }] 
 * }
 * 
 * Example: "Special Sauce" with batch_quantity=500, batch_unit='grams'
 * means "this recipe produces 500 grams of sauce"
 */
router.post('/composite-items', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, name_ar, category, unit, storage_unit, batch_quantity, batch_unit, components } = req.body;

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

  // Validate unit compatibility
  if (storage_unit && !areUnitsCompatible(storage_unit, unit)) {
    const compatibleOptions = getCompatibleStorageUnits(unit);
    return res.status(400).json({
      success: false,
      error: 'incompatible_units',
      message: `Storage unit '${storage_unit}' is not compatible with serving unit '${unit}'`,
      compatible_storage_units: compatibleOptions,
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

  try {
    const item = await inventoryService.createCompositeItem({
      business_id: req.businessUser!.business_id,
      name,
      name_ar,
      category,
      unit: unit as ItemUnit,
      storage_unit: storage_unit,
      batch_quantity: parseFloat(batch_quantity),
      batch_unit: batch_unit as ItemUnit,
      components,
      production_rate_type: req.body.production_rate_type,
      production_rate_weekly_day: req.body.production_rate_weekly_day !== undefined ? parseInt(req.body.production_rate_weekly_day) : undefined,
      production_rate_monthly_day: req.body.production_rate_monthly_day !== undefined ? parseInt(req.body.production_rate_monthly_day) : undefined,
      production_rate_custom_dates: req.body.production_rate_custom_dates,
    });

    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    // Handle unit validation errors from service
    if (err.message && err.message.includes('Storage unit')) {
      const compatibleOptions = getCompatibleStorageUnits(unit);
      return res.status(400).json({
        success: false,
        error: 'incompatible_units',
        message: err.message,
        compatible_storage_units: compatibleOptions,
      });
    }
    throw err;
  }
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

// ============ PRODUCT ACCESSORIES ============
// NOTE: More specific routes must come BEFORE generic routes to prevent route interception

/**
 * GET /api/inventory/products/:productId/accessories/cost
 * Calculate total accessory cost for a product
 * IMPORTANT: This route must be defined BEFORE /accessories to prevent route interception
 */
router.get('/products/:productId/accessories/cost', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const productId = parseInt(req.params.productId);

  const cost = await inventoryService.calculateProductAccessoryCost(
    productId,
    req.businessUser!.business_id
  );

  res.json({
    success: true,
    data: { cost },
  });
}));

/**
 * GET /api/inventory/products/:productId/accessories
 * Get all accessories for a product
 */
router.get('/products/:productId/accessories', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const productId = parseInt(req.params.productId);

  const accessories = await inventoryService.getProductAccessories(
    productId,
    req.businessUser!.business_id
  );

  res.json({
    success: true,
    data: accessories,
  });
}));

/**
 * PUT /api/inventory/products/:productId/accessories
 * Update accessories for a product (replaces all existing accessories)
 * Body: { accessories: [{ item_id, variant_id?, quantity, applicable_order_types?, is_required?, notes? }] }
 */
router.put('/products/:productId/accessories', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const productId = parseInt(req.params.productId);
  const { accessories } = req.body;

  if (!Array.isArray(accessories)) {
    return res.status(400).json({
      success: false,
      error: 'accessories must be an array',
    });
  }

  // Validate each accessory
  for (const acc of accessories) {
    if (!acc.item_id || typeof acc.item_id !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Each accessory must have a valid item_id',
      });
    }
    if (!acc.quantity || acc.quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Each accessory must have quantity > 0',
      });
    }
    // Validate applicable_order_types if provided
    if (acc.applicable_order_types) {
      const validTypes = ['always', 'dine_in', 'takeaway', 'delivery'];
      for (const type of acc.applicable_order_types) {
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            success: false,
            error: `Invalid order type: ${type}. Valid types: ${validTypes.join(', ')}`,
          });
        }
      }
    }
  }

  const updatedAccessories = await inventoryService.updateProductAccessories(
    productId,
    req.businessUser!.business_id,
    accessories
  );

  res.json({
    success: true,
    data: updatedAccessories,
    message: 'Product accessories updated successfully',
  });
}));

export default router;
