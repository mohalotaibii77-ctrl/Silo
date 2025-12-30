/**
 * INVENTORY SERVICE
 * Items (raw materials/ingredients) management with business-specific pricing
 */

import { supabaseAdmin } from '../config/database';
import { 
  validateUnitPairing, 
  getDefaultStorageUnit,
  StorageUnit,
  ServingUnit 
} from '../utils/unit-conversion';

// Item types: Food (ingredients) vs Non-Food (accessories)
export type ItemType = 'food' | 'non_food';

// Item categories
// - Food items have multiple categories for organization
// - Non-food items (accessories) use a single 'non_food' category
export type ItemCategory = 
  // Food categories
  | 'vegetable' | 'fruit' | 'meat' | 'poultry' | 'seafood' 
  | 'dairy' | 'grain' | 'bread' | 'sauce' | 'condiment' 
  | 'spice' | 'oil' | 'beverage' | 'sweetener'
  // Non-food (accessories) - single category
  | 'non_food';

// Accessory order types - when product accessories should be deducted
export type AccessoryOrderType = 'always' | 'dine_in' | 'takeaway' | 'delivery';

// Item units (simplified) - serving units
export type ItemUnit = 'grams' | 'mL' | 'piece';

// Storage units (for inventory storage)
export type { StorageUnit };

export interface Item {
  id: number;
  business_id: number | null;
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  item_type: ItemType;               // Type: food or non_food
  category: ItemCategory;
  unit: ItemUnit;                    // Serving unit (for recipes/products)
  storage_unit: StorageUnit;         // Storage unit (for inventory)
  cost_per_unit: number;
  is_system_item: boolean;
  is_composite: boolean;
  // Batch tracking for composite items
  batch_quantity?: number | null;
  batch_unit?: ItemUnit | null;
  // Production rate for composite items
  production_rate_type?: 'daily' | 'weekly' | 'monthly' | 'custom' | null;
  production_rate_weekly_day?: number | null; // 0=Sunday, 1=Monday, ..., 6=Saturday
  production_rate_monthly_day?: number | null; // 1-31
  production_rate_custom_dates?: string[] | null; // ISO date strings
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  // Business-specific price (if set)
  business_price?: number | null;
}

// Product Accessories (non-food items linked to products)
export interface ProductAccessory {
  id: number;
  product_id: number;
  variant_id?: number | null;
  item_id: number;
  quantity: number;
  applicable_order_types: AccessoryOrderType[];
  is_required: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  item?: Item;
}

export interface BusinessItemPrice {
  id: number;
  business_id: number;
  item_id: number;
  cost_per_unit: number;
  created_at: string;
  updated_at: string;
}

export interface CompositeItemComponent {
  id: number;
  composite_item_id: number;
  component_item_id: number;
  quantity: number;
  created_at: string;
  updated_at: string;
  // Joined data
  component_item?: Item;
}

export interface CreateCompositeItemInput {
  business_id: number;
  name: string;
  name_ar?: string;
  category: ItemCategory;
  unit: ItemUnit;
  storage_unit?: StorageUnit;   // Storage unit for inventory
  // Batch tracking: how much this recipe produces
  batch_quantity: number;
  batch_unit: ItemUnit;
  components: { item_id: number; quantity: number }[];
  // Production rate for composite items
  production_rate_type?: 'daily' | 'weekly' | 'monthly' | 'custom';
  production_rate_weekly_day?: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  production_rate_monthly_day?: number; // 1-31
  production_rate_custom_dates?: string[]; // ISO date strings
}

export class InventoryService {
  
  /**
   * Generate unique SKU for a new business item
   */
  private async generateItemSku(businessId: number): Promise<string> {
    // Get the highest existing SKU number for this business
    // This handles the case where items have been deleted
    const { data, error } = await supabaseAdmin
      .from('items')
      .select('sku')
      .eq('business_id', businessId)
      .not('sku', 'is', null)
      .order('sku', { ascending: false })
      .limit(1);
    
    let nextSequence = 1;
    
    if (data && data.length > 0 && data[0].sku) {
      // Parse the existing SKU to get the sequence number
      // Format: {businessId}-ITM-{sequence}
      const match = data[0].sku.match(/-ITM-(\d+)$/);
      if (match) {
        nextSequence = parseInt(match[1], 10) + 1;
      }
    }
    
    const sequence = String(nextSequence).padStart(4, '0');
    return `${businessId}-ITM-${sequence}`;
  }

  /**
   * Get all items for a business with business-specific prices
   * Supports pagination with page, limit, fields options
   */
  async getItems(businessId: number, filters?: {
    category?: ItemCategory;
    item_type?: ItemType;
    page?: number;
    limit?: number;
    fields?: string[];
  }): Promise<Item[] | { data: Item[]; total: number }> {
    const { page, limit, fields } = filters || {};
    
    // ENFORCEMENT: ONLY return items owned by this business
    // System items (business_id IS NULL) are NEVER returned
    // Each business must have their own items
    let query = supabaseAdmin
      .from('items')
      .select('*', { count: page && limit ? 'exact' : undefined })
      .eq('status', 'active')
      .eq('business_id', businessId);  // Strict business ownership enforcement

    // Filter by item_type if specified
    if (filters?.item_type) {
      query = query.eq('item_type', filters.item_type);
    }

    // Filter by category if specified
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    // Apply pagination if provided
    if (page && limit) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data: items, error, count } = await query.order('name');
    
    if (error) {
      console.error('Failed to fetch items:', error);
      throw new Error('Failed to fetch items');
    }

    // Parse production_rate_custom_dates from JSONB if present
    const processedItems = (items || []).map(item => {
      let parsedItem = { ...item };
      if (item.production_rate_custom_dates) {
        try {
          parsedItem.production_rate_custom_dates = typeof item.production_rate_custom_dates === 'string' 
            ? JSON.parse(item.production_rate_custom_dates)
            : item.production_rate_custom_dates;
        } catch (e) {
          console.error('Failed to parse production_rate_custom_dates:', e);
          parsedItem.production_rate_custom_dates = null;
        }
      }
      return parsedItem;
    });
    
    // Return paginated response if pagination was requested
    if (page && limit && count !== null) {
      return {
        data: processedItems as Item[],
        total: count,
      };
    }

    return processedItems as Item[];
  }

  /**
   * Get single item with business-specific price
   */
  async getItem(itemId: number, businessId?: number): Promise<Item | null> {
    // Build query - if businessId is provided, enforce ownership
    let query = supabaseAdmin
      .from('items')
      .select('*')
      .eq('id', itemId);

    // ENFORCEMENT: If businessId is provided, only return item if it belongs to this business
    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query.single();

    if (error) return null;

    // Parse production_rate_custom_dates from JSONB if present
    let parsedData = { ...data };
    if (data.production_rate_custom_dates) {
      try {
        parsedData.production_rate_custom_dates = typeof data.production_rate_custom_dates === 'string' 
          ? JSON.parse(data.production_rate_custom_dates)
          : data.production_rate_custom_dates;
      } catch (e) {
        console.error('Failed to parse production_rate_custom_dates:', e);
        parsedData.production_rate_custom_dates = null;
      }
    }

    // Get business-specific price if businessId provided
    if (businessId) {
      const { data: businessPrice } = await supabaseAdmin
        .from('business_item_prices')
        .select('cost_per_unit')
        .eq('business_id', businessId)
        .eq('item_id', itemId)
        .single();

      return {
        ...parsedData,
        business_price: businessPrice?.cost_per_unit ?? null,
      } as Item;
    }

    return parsedData as Item;
  }

  /**
   * Create new item for a business
   */
  async createItem(data: {
    business_id: number;
    name: string;
    name_ar?: string;
    item_type?: ItemType;
    category: ItemCategory;
    unit?: ItemUnit;
    storage_unit?: StorageUnit;
    cost_per_unit?: number;
  }): Promise<Item> {
    // Check for duplicate name using the comprehensive public method
    const duplicateCheck = await this.checkDuplicateItemName(data.business_id, data.name);
    if (duplicateCheck.isDuplicate) {
      const existingItem = duplicateCheck.existingItem;
      const itemType = existingItem?.business_id === null ? 'system' : 'business';
      throw new Error(
        `An item with this name already exists. ` +
        `Existing item: "${existingItem?.name}" (ID: ${existingItem?.id}, Type: ${itemType}). ` +
        `Please use the existing item or choose a different name.`
      );
    }

    const servingUnit = data.unit || 'grams';
    const storageUnit = data.storage_unit || getDefaultStorageUnit(servingUnit as ServingUnit);
    
    // Validate unit pairing
    const validationError = validateUnitPairing(storageUnit, servingUnit as ServingUnit);
    if (validationError) {
      throw new Error(validationError);
    }
    
    // Generate unique SKU for this business item
    const sku = await this.generateItemSku(data.business_id);
    
    const { data: item, error } = await supabaseAdmin
      .from('items')
      .insert({
        business_id: data.business_id,
        name: data.name,
        name_ar: data.name_ar || null,
        item_type: data.item_type || 'food',
        category: data.category,
        unit: servingUnit,
        storage_unit: storageUnit,
        cost_per_unit: data.cost_per_unit || 0,
        is_system_item: false,
        status: 'active',
        sku: sku,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create item:', error);
      throw new Error('Failed to create item');
    }
    return item as Item;
  }

  /**
   * Update item (only for business-owned items)
   */
  async updateItem(itemId: number, data: Partial<{
    name: string;
    name_ar: string;
    item_type: ItemType;
    category: ItemCategory;
    unit: ItemUnit;
    storage_unit: StorageUnit;
    cost_per_unit: number;
    status: 'active' | 'inactive';
  }>, businessId?: number): Promise<Item> {
    // If name is being updated, check for duplicates
    if (data.name && businessId) {
      const duplicateCheck = await this.checkDuplicateItemName(businessId, data.name, itemId);
      if (duplicateCheck.isDuplicate) {
        const existingItem = duplicateCheck.existingItem;
        const itemType = existingItem?.business_id === null ? 'system' : 'business';
        throw new Error(
          `An item with this name already exists. ` +
          `Existing item: "${existingItem?.name}" (ID: ${existingItem?.id}, Type: ${itemType}). ` +
          `Please use a different name.`
        );
      }
    }

    // If both unit and storage_unit are being updated, validate pairing
    if (data.unit && data.storage_unit) {
      const validationError = validateUnitPairing(data.storage_unit, data.unit as ServingUnit);
      if (validationError) {
        throw new Error(validationError);
      }
    }
    
    const { data: item, error } = await supabaseAdmin
      .from('items')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update item:', error);
      throw new Error('Failed to update item');
    }
    return item as Item;
  }

  /**
   * Clone a default item to create a business-specific version
   * This is called when a business wants to edit a default item
   * The default item is copied and linked to the business
   */
  async cloneDefaultItemForBusiness(itemId: number, businessId: number, updates: Partial<{
    name: string;
    name_ar: string;
    category: ItemCategory;
    unit: ItemUnit;
    storage_unit: StorageUnit;
    cost_per_unit: number;
  }>): Promise<Item> {
    // Get the original default item
    const originalItem = await this.getItem(itemId);
    if (!originalItem) {
      throw new Error('Item not found');
    }
    
    // Verify it's a default item (business_id is null)
    if (originalItem.business_id !== null) {
      throw new Error('This item is not a default item - use updateItem instead');
    }

    // Merge original data with updates
    const servingUnit = updates.unit || originalItem.unit;
    const storageUnit = updates.storage_unit || originalItem.storage_unit || getDefaultStorageUnit(servingUnit as ServingUnit);
    
    // Validate unit pairing
    const validationError = validateUnitPairing(storageUnit, servingUnit as ServingUnit);
    if (validationError) {
      throw new Error(validationError);
    }
    
    // Generate unique SKU for the new business item
    const sku = await this.generateItemSku(businessId);
    
    // Create a new item for the business based on the default item
    const { data: newItem, error } = await supabaseAdmin
      .from('items')
      .insert({
        business_id: businessId,
        name: updates.name || originalItem.name,
        name_ar: updates.name_ar !== undefined ? updates.name_ar : originalItem.name_ar,
        category: updates.category || originalItem.category,
        unit: servingUnit,
        storage_unit: storageUnit,
        cost_per_unit: updates.cost_per_unit !== undefined ? updates.cost_per_unit : originalItem.cost_per_unit,
        is_system_item: false,  // Not a system item anymore
        is_composite: originalItem.is_composite,
        status: 'active',
        sku: sku,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to clone item:', error);
      throw new Error('Failed to create business-specific item');
    }

    // Update all product ingredients that reference the old default item to point to the new cloned item
    // This ensures products use the business's customized version
    try {
      // Get all products for this business
      const { data: businessProducts } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('business_id', businessId);

      if (businessProducts && businessProducts.length > 0) {
        const productIds = businessProducts.map(p => p.id);
        
        // Update product_ingredients to use the new item
        await supabaseAdmin
          .from('product_ingredients')
          .update({ item_id: newItem.id })
          .eq('item_id', itemId)
          .in('product_id', productIds);
        
        // Update product_modifiers to use the new item
        await supabaseAdmin
          .from('product_modifiers')
          .update({ item_id: newItem.id })
          .eq('item_id', itemId)
          .in('product_id', productIds);
      }

      // Also update composite item components that reference the old default item
      const { data: businessComposites } = await supabaseAdmin
        .from('items')
        .select('id')
        .eq('business_id', businessId)
        .eq('is_composite', true);

      if (businessComposites && businessComposites.length > 0) {
        const compositeIds = businessComposites.map(c => c.id);
        
        await supabaseAdmin
          .from('composite_item_components')
          .update({ component_item_id: newItem.id })
          .eq('component_item_id', itemId)
          .in('composite_item_id', compositeIds);
      }

      // Transfer inventory stock from system item to the new business item
      // This ensures the business's stock is tracked under their own item
      const { data: existingStock } = await supabaseAdmin
        .from('inventory_stock')
        .select('*')
        .eq('business_id', businessId)
        .eq('item_id', itemId);

      if (existingStock && existingStock.length > 0) {
        for (const stock of existingStock) {
          // Check if stock already exists for the new item at this branch
          const { data: newItemStock } = await supabaseAdmin
            .from('inventory_stock')
            .select('id, quantity')
            .eq('business_id', businessId)
            .eq('item_id', newItem.id)
            .eq('branch_id', stock.branch_id)
            .maybeSingle();

          if (newItemStock) {
            // Add to existing stock
            await supabaseAdmin
              .from('inventory_stock')
              .update({ 
                quantity: newItemStock.quantity + stock.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', newItemStock.id);
          } else {
            // Create new stock record for the business item
            await supabaseAdmin
              .from('inventory_stock')
              .insert({
                business_id: businessId,
                branch_id: stock.branch_id,
                item_id: newItem.id,
                quantity: stock.quantity,
                reserved_quantity: stock.reserved_quantity || 0,
                held_quantity: stock.held_quantity || 0,
                min_quantity: stock.min_quantity || 0,
                max_quantity: stock.max_quantity,
              });
          }

          // Zero out the old system item stock for this business (don't delete, just zero)
          await supabaseAdmin
            .from('inventory_stock')
            .update({ 
              quantity: 0,
              reserved_quantity: 0,
              held_quantity: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', stock.id);
        }
        
        console.log(`Transferred inventory stock from system item ${itemId} to business item ${newItem.id} for business ${businessId}`);
      }

      // Also update inventory_movements to reference the new item (for history accuracy)
      await supabaseAdmin
        .from('inventory_movements')
        .update({ item_id: newItem.id })
        .eq('business_id', businessId)
        .eq('item_id', itemId);

      // Update inventory_transactions to reference the new item
      await supabaseAdmin
        .from('inventory_transactions')
        .update({ item_id: newItem.id })
        .eq('business_id', businessId)
        .eq('item_id', itemId);

    } catch (updateError) {
      console.error('Failed to update references to new item:', updateError);
      // Don't fail the whole operation - the item was cloned successfully
    }

    // Mark the system item as "deleted" for this business so they don't see duplicates
    try {
      await supabaseAdmin
        .from('business_deleted_items')
        .upsert({
          business_id: businessId,
          item_id: itemId,
          deleted_at: new Date().toISOString(),
        }, {
          onConflict: 'business_id,item_id',
        });
    } catch (deleteError) {
      console.error('Failed to mark system item as deleted for business:', deleteError);
    }

    return newItem as Item;
  }

  /**
   * Edit an item - handles both default items (clones them) and business items (updates them)
   * Returns the updated/new item
   */
  async editItem(itemId: number, businessId: number, updates: Partial<{
    name: string;
    name_ar: string;
    category: ItemCategory;
    unit: ItemUnit;
    storage_unit: StorageUnit;
    cost_per_unit: number;
    status: 'active' | 'inactive';
  }>): Promise<Item> {
    // Get the existing item
    const existingItem = await this.getItem(itemId);
    if (!existingItem) {
      throw new Error('Item not found');
    }

    // If it's a default item (business_id is null), clone it for the business
    if (existingItem.business_id === null) {
      return this.cloneDefaultItemForBusiness(itemId, businessId, updates);
    }

    // If it belongs to a different business, deny access
    if (existingItem.business_id !== businessId) {
      throw new Error('You can only edit your own items');
    }

    // Validate unit pairing if units are being changed
    const newUnit = updates.unit || existingItem.unit;
    const newStorageUnit = updates.storage_unit || existingItem.storage_unit;
    
    if (newStorageUnit && newUnit) {
      const validationError = validateUnitPairing(newStorageUnit as StorageUnit, newUnit as ServingUnit);
      if (validationError) {
        throw new Error(validationError);
      }
    }

    // Update the existing business item
    return this.updateItem(itemId, updates);
  }

  /**
   * Delete item (soft delete - set status to inactive)
   */
  async deleteItem(itemId: number): Promise<Item> {
    return this.updateItem(itemId, { status: 'inactive' });
  }

  /**
   * Set business-specific price for an item
   */
  async setBusinessItemPrice(businessId: number, itemId: number, price: number): Promise<BusinessItemPrice> {
    // Upsert: Insert or update the price
    const { data, error } = await supabaseAdmin
      .from('business_item_prices')
      .upsert({
        business_id: businessId,
        item_id: itemId,
        cost_per_unit: price,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'business_id,item_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to set business item price:', error);
      throw new Error('Failed to set item price');
    }

    return data as BusinessItemPrice;
  }

  /**
   * Get business-specific price for an item
   */
  async getBusinessItemPrice(businessId: number, itemId: number): Promise<number | null> {
    const { data, error } = await supabaseAdmin
      .from('business_item_prices')
      .select('cost_per_unit')
      .eq('business_id', businessId)
      .eq('item_id', itemId)
      .single();

    if (error || !data) return null;
    return data.cost_per_unit;
  }

  /**
   * Remove business-specific price (revert to default)
   */
  async removeBusinessItemPrice(businessId: number, itemId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('business_item_prices')
      .delete()
      .eq('business_id', businessId)
      .eq('item_id', itemId);

    if (error) {
      console.error('Failed to remove business item price:', error);
      throw new Error('Failed to remove item price');
    }
  }

  // ============ PRODUCT INGREDIENTS ============

  /**
   * Get product with ingredients, variants, and modifiers
   */
  async getProductWithIngredients(productId: number, businessId: number): Promise<any | null> {
    // First get product with ingredients (these tables always exist)
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        product_variants (
          id,
          name,
          name_ar,
          price_adjustment,
          sort_order
        ),
        product_ingredients (
          id,
          variant_id,
          item_id,
          quantity,
          removable,
          items (
            id,
            name,
            name_ar,
            unit,
            cost_per_unit
          )
        )
      `)
      .eq('id', productId)
      .eq('business_id', businessId)
      .single();

    if (error || !product) {
      console.error('Failed to fetch product:', error);
      return null;
    }

    // Fetch modifiers separately (table might be new)
    let productModifiers: any[] = [];
    try {
      const { data: modifiers, error: modError } = await supabaseAdmin
        .from('product_modifiers')
        .select('id, item_id, name, name_ar, removable, addable, quantity, extra_price, sort_order')
        .eq('product_id', productId)
        .order('sort_order');
      
      if (!modError && modifiers) {
        productModifiers = modifiers;
      }
    } catch (e) {
      // Table might not exist yet, ignore
      console.log('product_modifiers table not available yet');
    }

    // Attach modifiers to product
    (product as any).product_modifiers = productModifiers;

    // Get business-specific prices
    const { data: businessPrices } = await supabaseAdmin
      .from('business_item_prices')
      .select('item_id, cost_per_unit')
      .eq('business_id', businessId);

    const priceMap = new Map<number, number>();
    if (businessPrices) {
      businessPrices.forEach(bp => priceMap.set(bp.item_id, bp.cost_per_unit));
    }

    const allIngredients = (product.product_ingredients || []).map((ing: any) => {
      const itemPrice = priceMap.get(ing.item_id) ?? ing.items?.cost_per_unit ?? 0;
      return {
        id: ing.id,
        variant_id: ing.variant_id,
        item_id: ing.item_id,
        item_name: ing.items?.name,
        item_name_ar: ing.items?.name_ar,
        quantity: ing.quantity,
        removable: ing.removable || false,
        unit: ing.items?.unit,
        cost_per_unit: itemPrice,
        total_cost: ing.quantity * itemPrice,
      };
    });

    // Format modifiers (add-ons)
    const modifiers = (product.product_modifiers || [])
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((mod: any) => ({
        id: mod.id,
        item_id: mod.item_id,
        name: mod.name,
        name_ar: mod.name_ar,
        removable: mod.removable || false,
        addable: mod.addable ?? true,
        quantity: mod.quantity || 1,
        extra_price: mod.extra_price || 0,
      }));

    if (product.has_variants) {
      const variants = (product.product_variants || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((v: any) => {
          const variantIngredients = allIngredients.filter((ing: any) => ing.variant_id === v.id);
          const totalCost = variantIngredients.reduce((sum: number, ing: any) => sum + ing.total_cost, 0);
          return {
            id: v.id,
            name: v.name,
            name_ar: v.name_ar,
            price_adjustment: v.price_adjustment,
            sort_order: v.sort_order,
            ingredients: variantIngredients,
            total_cost: totalCost,
          };
        });

      return {
        ...product,
        variants,
        modifiers,
        product_variants: undefined,
        product_ingredients: undefined,
        product_modifiers: undefined,
      };
    } else {
      const ingredients = allIngredients.filter((ing: any) => !ing.variant_id);
      const totalCost = ingredients.reduce((sum: number, ing: any) => sum + ing.total_cost, 0);

      return {
        ...product,
        ingredients,
        modifiers,
        total_cost: totalCost,
        product_variants: undefined,
        product_ingredients: undefined,
        product_modifiers: undefined,
      };
    }
  }

  /**
   * Update product ingredients (and optionally variants) with removable flags and modifiers
   */
  async updateProductIngredients(productId: number, businessId: number, data: {
    has_variants: boolean;
    variants?: { name: string; name_ar?: string; price_adjustment?: number; ingredients: { item_id: number; quantity: number; removable?: boolean }[] }[];
    ingredients?: { item_id: number; quantity: number; removable?: boolean }[];
    modifiers?: { item_id: number; name: string; name_ar?: string; quantity?: number; extra_price: number }[];
  }): Promise<any> {
    // Update product has_variants flag
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({ has_variants: data.has_variants, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('business_id', businessId);

    if (updateError) {
      console.error('Failed to update product:', updateError);
      throw new Error('Failed to update product');
    }

    // Clear existing variants and ingredients
    await supabaseAdmin.from('product_ingredients').delete().eq('product_id', productId);
    await supabaseAdmin.from('product_variants').delete().eq('product_id', productId);

    if (data.has_variants && data.variants) {
      for (let i = 0; i < data.variants.length; i++) {
        const variant = data.variants[i];
        const { data: createdVariant, error: variantError } = await supabaseAdmin
          .from('product_variants')
          .insert({
            product_id: productId,
            name: variant.name,
            name_ar: variant.name_ar || null,
            price_adjustment: variant.price_adjustment || 0,
            sort_order: i,
          })
          .select()
          .single();

        if (variantError || !createdVariant) continue;

        if (variant.ingredients && variant.ingredients.length > 0) {
          const ingredientsToInsert = variant.ingredients.map(ing => ({
            product_id: productId,
            variant_id: createdVariant.id,
            item_id: ing.item_id,
            quantity: ing.quantity,
            removable: ing.removable || false,
          }));

          await supabaseAdmin.from('product_ingredients').insert(ingredientsToInsert);
        }
      }
    } else if (data.ingredients && data.ingredients.length > 0) {
      const ingredientsToInsert = data.ingredients.map(ing => ({
        product_id: productId,
        variant_id: null,
        item_id: ing.item_id,
        quantity: ing.quantity,
        removable: ing.removable || false,
      }));

      await supabaseAdmin.from('product_ingredients').insert(ingredientsToInsert);
    }

    // Clear and insert modifiers (add-ons)
    await supabaseAdmin.from('product_modifiers').delete().eq('product_id', productId);
    
    if (data.modifiers && data.modifiers.length > 0) {
      const modifiersToInsert = data.modifiers.map((mod, idx) => ({
        product_id: productId,
        item_id: mod.item_id,
        name: mod.name,
        name_ar: mod.name_ar || null,
        quantity: mod.quantity || 1,
        extra_price: mod.extra_price || 0,
        removable: false,
        addable: true,
        sort_order: idx,
      }));

      const { error: modError } = await supabaseAdmin.from('product_modifiers').insert(modifiersToInsert);
      if (modError) {
        console.error('Failed to insert modifiers:', modError);
        // Don't throw - modifiers table might not exist yet
      }
    }

    return this.getProductWithIngredients(productId, businessId);
  }

  /**
   * Calculate product cost from ingredients
   */
  async calculateProductCost(productId: number, businessId: number): Promise<{ cost: number; variantCosts?: { variantId: number; cost: number }[] }> {
    const product = await this.getProductWithIngredients(productId, businessId);
    if (!product) throw new Error('Product not found');

    if (product.has_variants && product.variants) {
      const variantCosts = product.variants.map((v: any) => ({
        variantId: v.id,
        name: v.name,
        cost: v.total_cost || 0,
      }));
      const avgCost = variantCosts.reduce((sum: number, v: any) => sum + v.cost, 0) / variantCosts.length || 0;
      return { cost: avgCost, variantCosts };
    } else {
      return { cost: product.total_cost || 0 };
    }
  }

  // ============ COMPOSITE ITEMS ============

  /**
   * Create a composite item (item made from other items)
   * Example: "Special Sauce" made from "Tomato (50g)" + "Mayo (50mL)"
   * 
   * batch_quantity & batch_unit define how much this recipe produces
   * e.g., batch_quantity=500, batch_unit='grams' means "this makes 500g"
   * 
   * cost_per_unit = batch_price / batch_quantity (unit price)
   */
  async createCompositeItem(input: CreateCompositeItemInput): Promise<Item & { components: CompositeItemComponent[]; batch_price: number; unit_price: number }> {
    const { 
      business_id, 
      name, 
      name_ar, 
      category, 
      unit,
      storage_unit: inputStorageUnit,
      batch_quantity, 
      batch_unit, 
      components,
      production_rate_type,
      production_rate_weekly_day,
      production_rate_monthly_day,
      production_rate_custom_dates
    } = input;
    
    // Check for duplicate name (composite items are stored in the items table)
    const duplicateCheck = await this.checkDuplicateItemName(business_id, name);
    if (duplicateCheck.isDuplicate) {
      const existingItem = duplicateCheck.existingItem;
      const itemType = existingItem?.business_id === null ? 'system' : 'business';
      throw new Error(
        `An item with this name already exists. ` +
        `Existing item: "${existingItem?.name}" (ID: ${existingItem?.id}, Type: ${itemType}). ` +
        `Please use a different name.`
      );
    }

    // Determine storage unit (default based on serving unit)
    const storageUnit = inputStorageUnit || getDefaultStorageUnit(unit as ServingUnit);
    
    // Validate unit pairing
    const validationError = validateUnitPairing(storageUnit, unit as ServingUnit);
    if (validationError) {
      throw new Error(validationError);
    }

    // Validate batch_quantity
    if (!batch_quantity || batch_quantity <= 0) {
      throw new Error('Batch quantity must be greater than 0');
    }

    // Validate components exist and belong to this business or are system items
    for (const comp of components) {
      const item = await this.getItem(comp.item_id, business_id);
      if (!item) {
        throw new Error(`Component item ${comp.item_id} not found`);
      }
      // Check if item belongs to this business or is a system item
      if (item.business_id !== null && item.business_id !== business_id) {
        throw new Error(`Component item ${comp.item_id} does not belong to this business`);
      }
      // Prevent using composite items as components (avoid circular references)
      const { data: isComposite } = await supabaseAdmin
        .from('items')
        .select('is_composite')
        .eq('id', comp.item_id)
        .single();
      
      if (isComposite?.is_composite) {
        throw new Error(`Cannot use composite item ${comp.item_id} as a component. Only raw items allowed.`);
      }
    }

    // Calculate batch cost from all components (total cost to make one batch)
    const batchPrice = await this.calculateCompositeItemCost(components, business_id);
    
    // Calculate unit price (cost per unit of the composite item)
    // e.g., if batch costs $10 and makes 500g, unit price = $10/500 = $0.02 per gram
    const unitPrice = batchPrice / batch_quantity;

    // Generate unique SKU
    const sku = await this.generateItemSku(business_id);

    // Validate production rate fields
    if (production_rate_type === 'weekly' && (production_rate_weekly_day === undefined || production_rate_weekly_day === null)) {
      throw new Error('production_rate_weekly_day is required when production_rate_type is weekly');
    }
    if (production_rate_type === 'monthly' && (production_rate_monthly_day === undefined || production_rate_monthly_day === null)) {
      throw new Error('production_rate_monthly_day is required when production_rate_type is monthly');
    }
    if (production_rate_type === 'custom' && (!production_rate_custom_dates || production_rate_custom_dates.length === 0)) {
      throw new Error('production_rate_custom_dates is required when production_rate_type is custom');
    }

    // Create the composite item
    // cost_per_unit stores the unit price for inventory calculations
    const itemData = {
      business_id,
      name,
      name_ar: name_ar || null,
      category,
      unit, // The serving unit used for this item in recipes/products (e.g., grams)
      storage_unit: storageUnit, // The storage unit for inventory (e.g., Kg)
      cost_per_unit: unitPrice, // Cost per single unit (e.g., per gram)
      batch_quantity, // How much one batch produces
      batch_unit, // Unit of the batch quantity
      is_system_item: false,
      is_composite: true,
      status: 'active',
      sku,
      production_rate_type: production_rate_type || null,
      production_rate_weekly_day: production_rate_weekly_day ?? null,
      production_rate_monthly_day: production_rate_monthly_day ?? null,
      production_rate_custom_dates: production_rate_custom_dates ? JSON.stringify(production_rate_custom_dates) : null,
    };

    let { data: item, error } = await supabaseAdmin
      .from('items')
      .insert(itemData)
      .select()
      .single();

    // Handle duplicate SKU error - retry with a timestamp-based SKU
    if (error && error.code === '23505' && error.message?.includes('sku')) {
      console.warn('SKU collision detected, retrying with timestamp-based SKU');
      const timestamp = Date.now().toString().slice(-6);
      const retrySku = `${business_id}-ITM-T${timestamp}`;
      
      const retryResult = await supabaseAdmin
        .from('items')
        .insert({ ...itemData, sku: retrySku })
        .select()
        .single();
      
      item = retryResult.data;
      error = retryResult.error;
    }

    if (error) {
      console.error('Failed to create composite item:', error);
      throw new Error('Failed to create composite item');
    }

    // Insert components
    const componentsToInsert = components.map(comp => ({
      composite_item_id: item.id,
      component_item_id: comp.item_id,
      quantity: comp.quantity,
    }));

    const { error: compError } = await supabaseAdmin
      .from('composite_item_components')
      .insert(componentsToInsert);

    if (compError) {
      console.error('Failed to insert composite item components:', compError);
      // Rollback: delete the item
      await supabaseAdmin.from('items').delete().eq('id', item.id);
      throw new Error('Failed to create composite item components');
    }

    // Return the item with components and calculated prices
    const compositeItem = await this.getCompositeItem(item.id, business_id);
    return {
      ...compositeItem!,
      batch_price: batchPrice,
      unit_price: unitPrice,
    };
  }

  /**
   * Get a composite item with its components
   */
  async getCompositeItem(itemId: number, businessId: number): Promise<(Item & { components: CompositeItemComponent[]; batch_cost: number; cost_per_serving_unit: number }) | null> {
    // Get the item
    const item = await this.getItem(itemId, businessId);
    if (!item) return null;

    // Get components with joined item data
    const { data: components, error } = await supabaseAdmin
      .from('composite_item_components')
      .select(`
        id,
        composite_item_id,
        component_item_id,
        quantity,
        created_at,
        updated_at,
        items:component_item_id (
          id,
          name,
          name_ar,
          unit,
          storage_unit,
          cost_per_unit,
          sku
        )
      `)
      .eq('composite_item_id', itemId);

    if (error) {
      console.error('Failed to fetch composite item components:', error);
      return { ...item, components: [], batch_cost: 0, cost_per_serving_unit: 0 };
    }

    // Get business-specific prices for components
    const componentItemIds = (components || []).map((c: any) => c.component_item_id);
    const { data: businessPrices } = await supabaseAdmin
      .from('business_item_prices')
      .select('item_id, cost_per_unit')
      .eq('business_id', businessId)
      .in('item_id', componentItemIds);

    const priceMap = new Map<number, number>();
    if (businessPrices) {
      businessPrices.forEach(bp => priceMap.set(bp.item_id, bp.cost_per_unit));
    }

    // Format components with effective prices and calculate batch cost
    let batchCost = 0;
    const formattedComponents = (components || []).map((comp: any) => {
      const componentItem = comp.items;
      const effectivePrice = priceMap.get(comp.component_item_id) ?? componentItem?.cost_per_unit ?? 0;
      const componentCost = comp.quantity * effectivePrice;
      batchCost += componentCost;
      return {
        id: comp.id,
        composite_item_id: comp.composite_item_id,
        component_item_id: comp.component_item_id,
        quantity: comp.quantity,
        created_at: comp.created_at,
        updated_at: comp.updated_at,
        component_item: componentItem ? {
          ...componentItem,
          effective_price: effectivePrice,
          component_cost: componentCost,
        } : undefined,
      };
    });

    // Calculate cost per serving unit based on batch quantity
    const batchQuantity = item.batch_quantity || 1;
    const costPerServingUnit = batchQuantity > 0 ? batchCost / batchQuantity : 0;

    return {
      ...item,
      components: formattedComponents,
      // Calculated fields from backend
      batch_cost: batchCost,
      cost_per_serving_unit: costPerServingUnit,
    };
  }

  /**
   * Update composite item components
   */
  async updateCompositeItemComponents(
    itemId: number,
    businessId: number,
    components: { item_id: number; quantity: number }[]
  ): Promise<Item & { components: CompositeItemComponent[] }> {
    // Verify the item exists and belongs to this business
    const item = await this.getItem(itemId);
    if (!item) {
      throw new Error('Item not found');
    }
    if (item.business_id !== businessId) {
      throw new Error('Item does not belong to this business');
    }

    // Validate components
    for (const comp of components) {
      const componentItem = await this.getItem(comp.item_id, businessId);
      if (!componentItem) {
        throw new Error(`Component item ${comp.item_id} not found`);
      }
      if (componentItem.business_id !== null && componentItem.business_id !== businessId) {
        throw new Error(`Component item ${comp.item_id} does not belong to this business`);
      }
      // Check for circular reference
      const { data: isComposite } = await supabaseAdmin
        .from('items')
        .select('is_composite')
        .eq('id', comp.item_id)
        .single();
      
      if (isComposite?.is_composite) {
        throw new Error(`Cannot use composite item ${comp.item_id} as a component`);
      }
    }

    // Delete existing components
    await supabaseAdmin
      .from('composite_item_components')
      .delete()
      .eq('composite_item_id', itemId);

    // Insert new components
    if (components.length > 0) {
      const componentsToInsert = components.map(comp => ({
        composite_item_id: itemId,
        component_item_id: comp.item_id,
        quantity: comp.quantity,
      }));

      const { error } = await supabaseAdmin
        .from('composite_item_components')
        .insert(componentsToInsert);

      if (error) {
        console.error('Failed to update composite item components:', error);
        throw new Error('Failed to update components');
      }
    }

    // Recalculate and update cost
    const totalCost = await this.calculateCompositeItemCost(components, businessId);
    await supabaseAdmin
      .from('items')
      .update({ 
        cost_per_unit: totalCost, 
        is_composite: components.length > 0,
        updated_at: new Date().toISOString() 
      })
      .eq('id', itemId);

    return this.getCompositeItem(itemId, businessId) as Promise<Item & { components: CompositeItemComponent[] }>;
  }

  /**
   * Calculate total cost of a composite item from its components
   */
  private async calculateCompositeItemCost(
    components: { item_id: number; quantity: number }[],
    businessId: number
  ): Promise<number> {
    let totalCost = 0;

    for (const comp of components) {
      // Get the component item with business-specific price
      const item = await this.getItem(comp.item_id, businessId);
      if (item) {
        const effectivePrice = item.business_price ?? item.cost_per_unit;
        totalCost += comp.quantity * effectivePrice;
      }
    }

    return totalCost;
  }

  /**
   * Recalculate cost for all composite items (useful when component prices change)
   */
  async recalculateCompositeItemCost(itemId: number, businessId: number): Promise<number> {
    // Get current components
    const { data: components, error } = await supabaseAdmin
      .from('composite_item_components')
      .select('component_item_id, quantity')
      .eq('composite_item_id', itemId);

    if (error || !components) {
      throw new Error('Failed to fetch components');
    }

    const componentsList = components.map((c: any) => ({
      item_id: c.component_item_id,
      quantity: c.quantity,
    }));

    const totalCost = await this.calculateCompositeItemCost(componentsList, businessId);

    // Update the item cost
    await supabaseAdmin
      .from('items')
      .update({ cost_per_unit: totalCost, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    return totalCost;
  }

  /**
   * Get all composite items for a business with calculated costs
   */
  async getCompositeItems(businessId: number): Promise<(Item & { batch_cost: number; cost_per_serving_unit: number })[]> {
    const { data: items, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_composite', true)
      .eq('status', 'active')
      .order('name');

    if (error) {
      console.error('Failed to fetch composite items:', error);
      throw new Error('Failed to fetch composite items');
    }

    // For each composite item, fetch components and calculate batch_cost and cost_per_serving_unit
    const itemsWithCosts = await Promise.all(
      (items || []).map(async (item) => {
        // Get components for this item
        const { data: components } = await supabaseAdmin
          .from('composite_item_components')
          .select(`
            quantity,
            items:component_item_id (
              id,
              cost_per_unit
            )
          `)
          .eq('composite_item_id', item.id);

        // Get business-specific prices
        const componentItemIds = (components || []).map((c: any) => c.items?.id).filter(Boolean);
        const { data: businessPrices } = await supabaseAdmin
          .from('business_item_prices')
          .select('item_id, cost_per_unit')
          .eq('business_id', businessId)
          .in('item_id', componentItemIds);

        const priceMap = new Map<number, number>();
        if (businessPrices) {
          businessPrices.forEach(bp => priceMap.set(bp.item_id, bp.cost_per_unit));
        }

        // Calculate batch cost
        let batchCost = 0;
        (components || []).forEach((comp: any) => {
          const componentItem = comp.items;
          if (componentItem) {
            const effectivePrice = priceMap.get(componentItem.id) ?? componentItem.cost_per_unit ?? 0;
            batchCost += comp.quantity * effectivePrice;
          }
        });

        // Calculate cost per serving unit
        const batchQuantity = item.batch_quantity || 1;
        const costPerServingUnit = batchQuantity > 0 ? batchCost / batchQuantity : 0;

        return {
          ...item,
          batch_cost: batchCost,
          cost_per_serving_unit: costPerServingUnit,
        };
      })
    );

    return itemsWithCosts as (Item & { batch_cost: number; cost_per_serving_unit: number })[];
  }

  // ============ COST CASCADE RECALCULATION ============

  /**
   * Recalculate all composite items that use a specific item as component
   * Returns list of composite item IDs that were updated
   */
  async recalculateCompositeItemsUsingItem(itemId: number, businessId: number): Promise<number[]> {
    // Find all composite items that use this item as a component
    const { data: components, error } = await supabaseAdmin
      .from('composite_item_components')
      .select('composite_item_id')
      .eq('component_item_id', itemId);

    if (error) {
      console.error('Failed to find composite items using item:', error);
      return [];
    }

    const updatedIds: number[] = [];
    const uniqueCompositeIds = [...new Set(components?.map(c => c.composite_item_id) || [])];

    for (const compositeId of uniqueCompositeIds) {
      try {
        await this.recalculateCompositeItemCost(compositeId, businessId);
        updatedIds.push(compositeId);
        console.log(`Recalculated composite item ${compositeId} cost due to item ${itemId} price change`);
      } catch (err) {
        console.error(`Failed to recalculate composite item ${compositeId}:`, err);
      }
    }

    return updatedIds;
  }

  /**
   * Recalculate all products that use a specific item (raw or composite) as ingredient
   * Updates the product's calculated cost based on new ingredient prices
   */
  async recalculateProductsUsingItem(itemId: number, businessId: number): Promise<number[]> {
    // Find all products that use this item as an ingredient
    const { data: ingredients, error } = await supabaseAdmin
      .from('product_ingredients')
      .select('product_id, variant_id, quantity')
      .eq('item_id', itemId);

    if (error) {
      console.error('Failed to find products using item:', error);
      return [];
    }

    // Get the item's current cost
    const item = await this.getItem(itemId, businessId);
    if (!item) return [];

    const effectiveCost = item.business_price ?? item.cost_per_unit;
    const updatedProductIds: number[] = [];
    const uniqueProductIds = [...new Set(ingredients?.map(i => i.product_id) || [])];

    for (const productId of uniqueProductIds) {
      try {
        // Get all ingredients for this product
        const { data: productIngredients } = await supabaseAdmin
          .from('product_ingredients')
          .select(`
            id,
            item_id,
            quantity,
            variant_id,
            items:item_id (
              id,
              cost_per_unit,
              business_price:business_item_prices(price)
            )
          `)
          .eq('product_id', productId);

        if (!productIngredients) continue;

        // Calculate total cost for base product (no variant)
        let baseCost = 0;
        const baseIngredients = productIngredients.filter((i: any) => !i.variant_id);
        for (const ing of baseIngredients) {
          const itemData = ing.items as any;
          const ingCost = itemData?.business_price?.[0]?.price ?? itemData?.cost_per_unit ?? 0;
          baseCost += ing.quantity * ingCost;
        }

        // Update product's total_cost
        await supabaseAdmin
          .from('products')
          .update({ 
            total_cost: baseCost,
            updated_at: new Date().toISOString() 
          })
          .eq('id', productId)
          .eq('business_id', businessId);

        // Also update variant costs if any
        const variantIngredients = productIngredients.filter((i: any) => i.variant_id);
        const variantIds = [...new Set(variantIngredients.map((i: any) => i.variant_id))];
        
        for (const variantId of variantIds) {
          let variantCost = 0;
          const vIngredients = variantIngredients.filter((i: any) => i.variant_id === variantId);
          for (const ing of vIngredients) {
            const itemData = ing.items as any;
            const ingCost = itemData?.business_price?.[0]?.price ?? itemData?.cost_per_unit ?? 0;
            variantCost += ing.quantity * ingCost;
          }

          await supabaseAdmin
            .from('product_variants')
            .update({ 
              total_cost: variantCost,
              updated_at: new Date().toISOString() 
            })
            .eq('id', variantId);
        }

        updatedProductIds.push(productId);
        console.log(`Recalculated product ${productId} cost due to item ${itemId} price change`);
      } catch (err) {
        console.error(`Failed to recalculate product ${productId}:`, err);
      }
    }

    return updatedProductIds;
  }

  /**
   * Cascade cost update when an item's cost changes
   * This updates all composite items and products that use this item
   */
  async cascadeItemCostUpdate(itemId: number, businessId: number): Promise<{
    updatedCompositeItems: number[];
    updatedProducts: number[];
  }> {
    console.log(`Starting cost cascade for item ${itemId} in business ${businessId}`);

    // Step 1: Update composite items that use this item
    const updatedCompositeItems = await this.recalculateCompositeItemsUsingItem(itemId, businessId);

    // Step 2: Update products that use this item directly
    const updatedProducts = await this.recalculateProductsUsingItem(itemId, businessId);

    // Step 3: For each updated composite item, also update products that use them
    for (const compositeId of updatedCompositeItems) {
      const productsUsingComposite = await this.recalculateProductsUsingItem(compositeId, businessId);
      for (const pid of productsUsingComposite) {
        if (!updatedProducts.includes(pid)) {
          updatedProducts.push(pid);
        }
      }
    }

    console.log(`Cost cascade complete: ${updatedCompositeItems.length} composite items, ${updatedProducts.length} products updated`);

    return {
      updatedCompositeItems,
      updatedProducts,
    };
  }

  // ============ PRODUCT STATS ============

  /**
   * Get sales stats for all products
   * Returns sold count and average profit margin per product
   * Includes products sold directly AND products sold as part of bundles
   */
  async getProductStats(businessId: number): Promise<Record<number, { sold: number; profit_margin: number }>> {
    // Get all order items for this business from completed orders (not voided)
    const { data: orderItems, error } = await supabaseAdmin
      .from('order_items')
      .select(`
        product_id,
        quantity,
        profit_margin,
        is_combo,
        combo_id,
        orders!inner (
          business_id,
          is_void,
          order_status
        )
      `)
      .eq('orders.business_id', businessId)
      .eq('orders.is_void', false)
      .in('orders.order_status', ['completed', 'ready', 'out_for_delivery']);

    if (error) {
      console.error('Failed to fetch order items for stats:', error);
      return {};
    }

    // Get bundle items to map bundle_id -> products
    const { data: bundleItems, error: bundleError } = await supabaseAdmin
      .from('bundle_items')
      .select(`
        bundle_id,
        product_id,
        quantity,
        bundles!inner (
          business_id
        )
      `)
      .eq('bundles.business_id', businessId);

    if (bundleError) {
      console.error('Failed to fetch bundle items:', bundleError);
    }

    // Create a map of bundle_id -> array of { product_id, quantity }
    const bundleProductsMap: Record<number, { product_id: number; quantity: number }[]> = {};
    for (const item of bundleItems || []) {
      if (!bundleProductsMap[item.bundle_id]) {
        bundleProductsMap[item.bundle_id] = [];
      }
      bundleProductsMap[item.bundle_id].push({
        product_id: item.product_id,
        quantity: item.quantity
      });
    }

    // Aggregate stats by product_id
    const statsMap: Record<number, { sold: number; totalMargin: number; count: number }> = {};

    for (const item of orderItems || []) {
      // Direct product sale (not a combo/bundle)
      if (!item.is_combo && item.product_id) {
        if (!statsMap[item.product_id]) {
          statsMap[item.product_id] = { sold: 0, totalMargin: 0, count: 0 };
        }
        
        statsMap[item.product_id].sold += item.quantity || 0;
        statsMap[item.product_id].totalMargin += (item.profit_margin || 0) * (item.quantity || 0);
        statsMap[item.product_id].count += item.quantity || 0;
      }
      
      // Bundle sale - count products within the bundle
      if (item.is_combo && item.combo_id) {
        const bundleProducts = bundleProductsMap[item.combo_id] || [];
        const bundleQty = item.quantity || 1;
        
        for (const bundleProduct of bundleProducts) {
          if (!statsMap[bundleProduct.product_id]) {
            statsMap[bundleProduct.product_id] = { sold: 0, totalMargin: 0, count: 0 };
          }
          // Each bundle sold means each product in the bundle is sold (qty in bundle * bundles sold)
          statsMap[bundleProduct.product_id].sold += bundleProduct.quantity * bundleQty;
        }
      }
    }

    // Calculate average profit margin
    const result: Record<number, { sold: number; profit_margin: number }> = {};
    for (const [productId, stats] of Object.entries(statsMap)) {
      result[parseInt(productId)] = {
        sold: stats.sold,
        profit_margin: stats.count > 0 ? Math.round((stats.totalMargin / stats.count) * 100) / 100 : 0,
      };
    }

    return result;
  }

  // ============ ITEM DELETION & VALIDATION ============

  /**
   * Check if an item name already exists for this business
   * Checks both business-owned items and visible default items
   * @param businessId - The business ID
   * @param name - The item name to check
   * @param excludeItemId - Optional item ID to exclude (for editing)
   * @returns true if duplicate exists, false otherwise
   */
  async checkDuplicateItemName(
    businessId: number, 
    name: string, 
    excludeItemId?: number
  ): Promise<{ isDuplicate: boolean; existingItem?: { id: number; name: string; business_id: number | null } }> {
    const normalizedName = name.toLowerCase().trim();

    // Get business-deleted items to exclude from default items check
    const { data: deletedItems } = await supabaseAdmin
      .from('business_deleted_items')
      .select('item_id')
      .eq('business_id', businessId);
    
    const deletedItemIds = (deletedItems || []).map(d => d.item_id);

    // Check business-owned items
    let businessQuery = supabaseAdmin
      .from('items')
      .select('id, name, business_id')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .ilike('name', normalizedName);
    
    if (excludeItemId) {
      businessQuery = businessQuery.neq('id', excludeItemId);
    }

    const { data: businessItems } = await businessQuery;

    if (businessItems && businessItems.length > 0) {
      return { 
        isDuplicate: true, 
        existingItem: businessItems[0] 
      };
    }

    // Check default items (not deleted by this business)
    let defaultQuery = supabaseAdmin
      .from('items')
      .select('id, name, business_id')
      .is('business_id', null)
      .eq('status', 'active')
      .ilike('name', normalizedName);
    
    if (excludeItemId) {
      defaultQuery = defaultQuery.neq('id', excludeItemId);
    }

    const { data: defaultItems } = await defaultQuery;

    // Filter out items that are deleted by this business
    const visibleDefaultItems = (defaultItems || []).filter(
      item => !deletedItemIds.includes(item.id)
    );

    if (visibleDefaultItems.length > 0) {
      return { 
        isDuplicate: true, 
        existingItem: visibleDefaultItems[0] 
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Get usage information for an item
   * Returns what products, composite items, bundles, and inventory use this item
   * @param itemId - The item ID to check
   * @param businessId - The business ID
   */
  async getItemUsage(itemId: number, businessId: number): Promise<{
    products: Array<{ id: number; name: string; name_ar?: string }>;
    compositeItems: Array<{ id: number; name: string; name_ar?: string }>;
    bundles: Array<{ id: number; name: string; name_ar?: string }>;
    inventoryBranches: Array<{ id: number; name: string; quantity: number }>;
    totalUsageCount: number;
  }> {
    // Get products that use this item as ingredient
    const { data: productIngredients } = await supabaseAdmin
      .from('product_ingredients')
      .select(`
        product_id,
        products!inner (
          id,
          name,
          name_ar,
          business_id
        )
      `)
      .eq('item_id', itemId)
      .eq('products.business_id', businessId)
      .eq('products.is_active', true);

    // Get products that use this item as modifier
    const { data: productModifiers } = await supabaseAdmin
      .from('product_modifiers')
      .select(`
        product_id,
        products!inner (
          id,
          name,
          name_ar,
          business_id
        )
      `)
      .eq('item_id', itemId)
      .eq('products.business_id', businessId)
      .eq('products.is_active', true);

    // Combine and deduplicate products
    const productMap = new Map<number, { id: number; name: string; name_ar?: string }>();
    
    for (const ing of productIngredients || []) {
      const product = ing.products as any;
      if (product && !productMap.has(product.id)) {
        productMap.set(product.id, {
          id: product.id,
          name: product.name,
          name_ar: product.name_ar,
        });
      }
    }
    
    for (const mod of productModifiers || []) {
      const product = mod.products as any;
      if (product && !productMap.has(product.id)) {
        productMap.set(product.id, {
          id: product.id,
          name: product.name,
          name_ar: product.name_ar,
        });
      }
    }

    const products = Array.from(productMap.values());

    // Get composite items that use this item as component
    const { data: compositeComponents } = await supabaseAdmin
      .from('composite_item_components')
      .select(`
        composite_item_id,
        items!composite_item_components_composite_item_id_fkey (
          id,
          name,
          name_ar,
          business_id
        )
      `)
      .eq('component_item_id', itemId);

    const compositeItems = (compositeComponents || [])
      .filter((comp: any) => comp.items && comp.items.business_id === businessId)
      .map((comp: any) => ({
        id: comp.items.id,
        name: comp.items.name,
        name_ar: comp.items.name_ar,
      }));

    // Get bundles that contain products using this item
    const productIds = products.map(p => p.id);
    let bundles: Array<{ id: number; name: string; name_ar?: string }> = [];

    if (productIds.length > 0) {
      const { data: bundleItems } = await supabaseAdmin
        .from('bundle_items')
        .select(`
          bundle_id,
          bundles!inner (
            id,
            name,
            name_ar,
            business_id,
            is_active
          )
        `)
        .in('product_id', productIds)
        .eq('bundles.business_id', businessId)
        .eq('bundles.is_active', true);

      const bundleMap = new Map<number, { id: number; name: string; name_ar?: string }>();
      for (const item of bundleItems || []) {
        const bundle = item.bundles as any;
        if (bundle && !bundleMap.has(bundle.id)) {
          bundleMap.set(bundle.id, {
            id: bundle.id,
            name: bundle.name,
            name_ar: bundle.name_ar,
          });
        }
      }
      bundles = Array.from(bundleMap.values());
    }

    // Get inventory stock for this item
    const { data: inventoryStock } = await supabaseAdmin
      .from('inventory_stock')
      .select(`
        id,
        branch_id,
        quantity,
        branches (
          id,
          name
        )
      `)
      .eq('item_id', itemId)
      .eq('business_id', businessId)
      .gt('quantity', 0);

    const inventoryBranches = (inventoryStock || []).map((stock: any) => ({
      id: stock.branches?.id || stock.branch_id,
      name: stock.branches?.name || 'Main Branch',
      quantity: stock.quantity,
    }));

    const totalUsageCount = products.length + compositeItems.length + bundles.length + inventoryBranches.length;

    return {
      products,
      compositeItems,
      bundles,
      inventoryBranches,
      totalUsageCount,
    };
  }

  /**
   * Delete an item for a specific business with cascade
   * - For default items: marks as deleted for this business only
   * - For business items: performs cascade deletion
   * @param itemId - The item ID to delete
   * @param businessId - The business ID
   * @param cascade - Whether to cascade delete related entities
   */
  async deleteItemForBusiness(
    itemId: number, 
    businessId: number,
    cascade: boolean = false
  ): Promise<{
    success: boolean;
    deletedProducts: number[];
    deletedCompositeItems: number[];
    deletedBundles: number[];
    clearedInventoryBranches: number[];
  }> {
    const item = await this.getItem(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    const result = {
      success: true,
      deletedProducts: [] as number[],
      deletedCompositeItems: [] as number[],
      deletedBundles: [] as number[],
      clearedInventoryBranches: [] as number[],
    };

    // If cascade is true, delete all related entities first
    if (cascade) {
      const usage = await this.getItemUsage(itemId, businessId);

      // Delete bundles first (they depend on products)
      for (const bundle of usage.bundles) {
        await supabaseAdmin
          .from('bundles')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', bundle.id)
          .eq('business_id', businessId);
        result.deletedBundles.push(bundle.id);
      }

      // Delete products (soft delete)
      for (const product of usage.products) {
        await supabaseAdmin
          .from('products')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', product.id)
          .eq('business_id', businessId);
        result.deletedProducts.push(product.id);
      }

      // Delete composite items (soft delete)
      for (const composite of usage.compositeItems) {
        await supabaseAdmin
          .from('items')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('id', composite.id)
          .eq('business_id', businessId);
        result.deletedCompositeItems.push(composite.id);
      }

      // Clear inventory stock
      for (const branch of usage.inventoryBranches) {
        await supabaseAdmin
          .from('inventory_stock')
          .update({ quantity: 0, updated_at: new Date().toISOString() })
          .eq('item_id', itemId)
          .eq('business_id', businessId)
          .eq('branch_id', branch.id);
        result.clearedInventoryBranches.push(branch.id);
      }
    }

    // Now handle the item itself
    if (item.business_id === null) {
      // Default item - mark as deleted for this business only
      const { error } = await supabaseAdmin
        .from('business_deleted_items')
        .upsert({
          business_id: businessId,
          item_id: itemId,
          deleted_at: new Date().toISOString(),
        }, {
          onConflict: 'business_id,item_id',
        });

      if (error) {
        console.error('Failed to mark default item as deleted:', error);
        throw new Error('Failed to delete item');
      }
    } else if (item.business_id === businessId) {
      // Business-owned item - soft delete it
      const { error } = await supabaseAdmin
        .from('items')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('business_id', businessId);

      if (error) {
        console.error('Failed to delete business item:', error);
        throw new Error('Failed to delete item');
      }
    } else {
      throw new Error('You can only delete your own items or default items');
    }

    return result;
  }

  /**
   * Restore a deleted default item for a business
   * (Removes the entry from business_deleted_items)
   */
  async restoreDeletedItem(itemId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('business_deleted_items')
      .delete()
      .eq('business_id', businessId)
      .eq('item_id', itemId);

    if (error) {
      console.error('Failed to restore deleted item:', error);
      throw new Error('Failed to restore item');
    }
  }

  // ============ PRODUCT ACCESSORIES ============

  /**
   * Get all accessories for a product
   */
  async getProductAccessories(productId: number, businessId: number): Promise<ProductAccessory[]> {
    // First verify the product belongs to this business
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('business_id', businessId)
      .single();

    if (!product) {
      throw new Error('Product not found');
    }

    const { data: accessories, error } = await supabaseAdmin
      .from('product_accessories')
      .select(`
        *,
        item:items (
          id, name, name_ar, item_type, category, unit, storage_unit, 
          cost_per_unit, is_system_item, status
        )
      `)
      .eq('product_id', productId);

    if (error) {
      console.error('Failed to fetch product accessories:', error);
      throw new Error('Failed to fetch product accessories');
    }

    // Get business-specific prices for accessories
    const itemIds = (accessories || []).map(a => a.item_id);
    if (itemIds.length > 0) {
      const { data: businessPrices } = await supabaseAdmin
        .from('business_item_prices')
        .select('item_id, cost_per_unit')
        .eq('business_id', businessId)
        .in('item_id', itemIds);

      const priceMap = new Map<number, number>();
      (businessPrices || []).forEach(bp => priceMap.set(bp.item_id, bp.cost_per_unit));

      // Merge business prices with accessories
      return (accessories || []).map(acc => ({
        ...acc,
        item: acc.item ? {
          ...acc.item,
          business_price: priceMap.get(acc.item_id) ?? null,
          effective_price: priceMap.get(acc.item_id) ?? acc.item.cost_per_unit,
        } : undefined,
      })) as ProductAccessory[];
    }

    return (accessories || []) as ProductAccessory[];
  }

  /**
   * Update accessories for a product (replaces all existing accessories)
   */
  async updateProductAccessories(
    productId: number,
    businessId: number,
    accessories: Array<{
      item_id: number;
      variant_id?: number | null;
      quantity: number;
      applicable_order_types?: AccessoryOrderType[];
      is_required?: boolean;
      notes?: string;
    }>
  ): Promise<ProductAccessory[]> {
    // Verify product belongs to this business
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('business_id', businessId)
      .single();

    if (!product) {
      throw new Error('Product not found');
    }

    // Delete existing accessories for this product
    await supabaseAdmin
      .from('product_accessories')
      .delete()
      .eq('product_id', productId);

    // Insert new accessories if any
    if (accessories.length > 0) {
      const accessoriesToInsert = accessories.map(acc => ({
        product_id: productId,
        variant_id: acc.variant_id || null,
        item_id: acc.item_id,
        quantity: acc.quantity,
        applicable_order_types: acc.applicable_order_types || ['always'],
        is_required: acc.is_required ?? true,
        notes: acc.notes || null,
      }));

      const { error } = await supabaseAdmin
        .from('product_accessories')
        .insert(accessoriesToInsert);

      if (error) {
        console.error('Failed to update product accessories:', error);
        throw new Error('Failed to update product accessories');
      }
    }

    // Return updated accessories
    return this.getProductAccessories(productId, businessId);
  }

  /**
   * Calculate total accessory cost for a product
   */
  async calculateProductAccessoryCost(productId: number, businessId: number): Promise<number> {
    const accessories = await this.getProductAccessories(productId, businessId);
    
    let totalCost = 0;
    for (const acc of accessories) {
      if (acc.item) {
        const itemCost = (acc.item as any).effective_price ?? acc.item.cost_per_unit ?? 0;
        totalCost += itemCost * acc.quantity;
      }
    }
    
    return totalCost;
  }

  /**
   * Get accessories for a product filtered by order type
   * Used by POS service to determine which accessories to deduct
   */
  async getApplicableAccessories(
    productId: number, 
    businessId: number, 
    orderType: 'dine_in' | 'takeaway' | 'delivery'
  ): Promise<ProductAccessory[]> {
    const accessories = await this.getProductAccessories(productId, businessId);
    
    // Filter accessories that apply to this order type
    return accessories.filter(acc => {
      const types = acc.applicable_order_types || ['always'];
      return types.includes('always') || types.includes(orderType as AccessoryOrderType);
    });
  }

  // ==================== BUSINESS ITEM INITIALIZATION ====================

  /**
   * Copy all system items for a new business
   * This ensures each business has their own items from day 1
   * Called when a business is created
   */
  async initializeBusinessItems(businessId: number): Promise<{ copied: number; skipped: number }> {
    console.log(`[initializeBusinessItems] Starting for business ${businessId}`);
    
    // Get all system items (business_id IS NULL)
    const { data: systemItems, error: fetchError } = await supabaseAdmin
      .from('items')
      .select('*')
      .is('business_id', null)
      .eq('status', 'active');

    if (fetchError) {
      console.error('Failed to fetch system items:', fetchError);
      throw new Error('Failed to fetch system items');
    }

    if (!systemItems || systemItems.length === 0) {
      console.log('[initializeBusinessItems] No system items to copy');
      return { copied: 0, skipped: 0 };
    }

    // Get existing business items to avoid duplicates
    const { data: existingItems } = await supabaseAdmin
      .from('items')
      .select('name')
      .eq('business_id', businessId)
      .eq('status', 'active');

    const existingNames = new Set((existingItems || []).map(i => i.name.toLowerCase()));

    let copied = 0;
    let skipped = 0;

    for (const systemItem of systemItems) {
      // Skip if business already has an item with this name
      if (existingNames.has(systemItem.name.toLowerCase())) {
        console.log(`[initializeBusinessItems] Skipping "${systemItem.name}" - already exists`);
        skipped++;
        continue;
      }

      // Generate unique SKU for the business item
      const sku = await this.generateItemSku(businessId);

      // Copy the system item for this business
      const { error: insertError } = await supabaseAdmin
        .from('items')
        .insert({
          business_id: businessId,
          name: systemItem.name,
          name_ar: systemItem.name_ar,
          item_type: systemItem.item_type,
          category: systemItem.category,
          unit: systemItem.unit,
          storage_unit: systemItem.storage_unit,
          cost_per_unit: systemItem.cost_per_unit,
          is_system_item: false,  // Now owned by business
          is_composite: systemItem.is_composite || false,
          status: 'active',
          sku: sku,
        });

      if (insertError) {
        console.error(`Failed to copy item "${systemItem.name}":`, insertError);
        skipped++;
      } else {
        copied++;
      }
    }

    console.log(`[initializeBusinessItems] Completed for business ${businessId}: copied=${copied}, skipped=${skipped}`);
    return { copied, skipped };
  }

  /**
   * Migrate existing business to have their own items
   * - Copies system items that the business doesn't have
   * - Updates all references (products, composites, inventory) to use business items
   * - Transfers inventory stock from system items to business items
   */
  async migrateBusinessToOwnItems(businessId: number): Promise<{
    itemsCopied: number;
    referencesUpdated: number;
    stockTransferred: number;
  }> {
    console.log(`[migrateBusinessToOwnItems] Starting migration for business ${businessId}`);
    
    let itemsCopied = 0;
    let referencesUpdated = 0;
    let stockTransferred = 0;

    // Get all system items
    const { data: systemItems } = await supabaseAdmin
      .from('items')
      .select('*')
      .is('business_id', null)
      .eq('status', 'active');

    if (!systemItems || systemItems.length === 0) {
      return { itemsCopied: 0, referencesUpdated: 0, stockTransferred: 0 };
    }

    // Get existing business items
    const { data: existingBusinessItems } = await supabaseAdmin
      .from('items')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('status', 'active');

    const existingNameToId = new Map<string, number>();
    (existingBusinessItems || []).forEach(i => existingNameToId.set(i.name.toLowerCase(), i.id));

    // Map: system item ID -> business item ID
    const systemToBusinessMap = new Map<number, number>();

    for (const systemItem of systemItems) {
      const normalizedName = systemItem.name.toLowerCase();
      
      // Check if business already has this item
      if (existingNameToId.has(normalizedName)) {
        // Use existing business item
        systemToBusinessMap.set(systemItem.id, existingNameToId.get(normalizedName)!);
        continue;
      }

      // Create business-owned copy of the system item
      const sku = await this.generateItemSku(businessId);
      
      const { data: newItem, error: insertError } = await supabaseAdmin
        .from('items')
        .insert({
          business_id: businessId,
          name: systemItem.name,
          name_ar: systemItem.name_ar,
          item_type: systemItem.item_type,
          category: systemItem.category,
          unit: systemItem.unit,
          storage_unit: systemItem.storage_unit,
          cost_per_unit: systemItem.cost_per_unit,
          is_system_item: false,
          is_composite: systemItem.is_composite || false,
          status: 'active',
          sku: sku,
        })
        .select('id')
        .single();

      if (insertError || !newItem) {
        console.error(`Failed to create business item for "${systemItem.name}":`, insertError);
        continue;
      }

      systemToBusinessMap.set(systemItem.id, newItem.id);
      itemsCopied++;
    }

    // Now update all references from system items to business items
    for (const [systemItemId, businessItemId] of systemToBusinessMap) {
      if (systemItemId === businessItemId) continue; // Same item, no update needed

      // Update product_ingredients
      const { count: ingredientCount } = await supabaseAdmin
        .from('product_ingredients')
        .update({ item_id: businessItemId })
        .eq('item_id', systemItemId)
        .in('product_id', supabaseAdmin
          .from('products')
          .select('id')
          .eq('business_id', businessId)
        );
      
      // Update composite_item_components
      const { count: componentCount } = await supabaseAdmin
        .from('composite_item_components')
        .update({ component_item_id: businessItemId })
        .eq('component_item_id', systemItemId)
        .in('composite_item_id', supabaseAdmin
          .from('items')
          .select('id')
          .eq('business_id', businessId)
          .eq('is_composite', true)
        );

      referencesUpdated += (ingredientCount || 0) + (componentCount || 0);

      // Transfer inventory stock
      const { data: stockRecords } = await supabaseAdmin
        .from('inventory_stock')
        .select('*')
        .eq('business_id', businessId)
        .eq('item_id', systemItemId);

      for (const stock of stockRecords || []) {
        // Check if stock exists for business item
        const { data: existingStock } = await supabaseAdmin
          .from('inventory_stock')
          .select('id, quantity')
          .eq('business_id', businessId)
          .eq('item_id', businessItemId)
          .eq('branch_id', stock.branch_id)
          .maybeSingle();

        if (existingStock) {
          // Add to existing
          await supabaseAdmin
            .from('inventory_stock')
            .update({ quantity: existingStock.quantity + stock.quantity })
            .eq('id', existingStock.id);
        } else {
          // Create new stock record
          await supabaseAdmin
            .from('inventory_stock')
            .insert({
              business_id: businessId,
              branch_id: stock.branch_id,
              item_id: businessItemId,
              quantity: stock.quantity,
              reserved_quantity: stock.reserved_quantity || 0,
              held_quantity: stock.held_quantity || 0,
              min_quantity: stock.min_quantity || 0,
              max_quantity: stock.max_quantity,
            });
        }

        // DELETE the old stock record (not just zero it out)
        await supabaseAdmin
          .from('inventory_stock')
          .delete()
          .eq('id', stock.id);

        stockTransferred++;
      }

      // Update inventory movements history
      await supabaseAdmin
        .from('inventory_movements')
        .update({ item_id: businessItemId })
        .eq('business_id', businessId)
        .eq('item_id', systemItemId);

      // Update inventory transactions history  
      await supabaseAdmin
        .from('inventory_transactions')
        .update({ item_id: businessItemId })
        .eq('business_id', businessId)
        .eq('item_id', systemItemId);
    }

    console.log(`[migrateBusinessToOwnItems] Completed for business ${businessId}: items=${itemsCopied}, refs=${referencesUpdated}, stock=${stockTransferred}`);
    return { itemsCopied, referencesUpdated, stockTransferred };
  }

  /**
   * Cleanup orphaned stock records that reference system items
   * This removes any stock records where the item belongs to a different business or is a system item
   * Should be run after business migration to clean up any duplicate records
   */
  async cleanupOrphanedStockRecords(businessId: number): Promise<{ deleted: number }> {
    console.log(`[cleanupOrphanedStockRecords] Starting cleanup for business ${businessId}`);

    // Find all stock records for this business that reference non-business items
    const { data: orphanedStock, error: fetchError } = await supabaseAdmin
      .from('inventory_stock')
      .select('id, item_id, items!inner(id, business_id)')
      .eq('business_id', businessId)
      .neq('items.business_id', businessId);

    if (fetchError) {
      console.error('Failed to find orphaned stock:', fetchError);
      throw new Error('Failed to find orphaned stock records');
    }

    if (!orphanedStock || orphanedStock.length === 0) {
      console.log(`[cleanupOrphanedStockRecords] No orphaned stock found for business ${businessId}`);
      return { deleted: 0 };
    }

    const orphanedIds = orphanedStock.map(s => s.id);
    console.log(`[cleanupOrphanedStockRecords] Found ${orphanedIds.length} orphaned stock records`);

    // Delete all orphaned stock records
    const { error: deleteError } = await supabaseAdmin
      .from('inventory_stock')
      .delete()
      .in('id', orphanedIds);

    if (deleteError) {
      console.error('Failed to delete orphaned stock:', deleteError);
      throw new Error('Failed to delete orphaned stock records');
    }

    console.log(`[cleanupOrphanedStockRecords] Deleted ${orphanedIds.length} orphaned stock records for business ${businessId}`);
    return { deleted: orphanedIds.length };
  }
}

export const inventoryService = new InventoryService();
