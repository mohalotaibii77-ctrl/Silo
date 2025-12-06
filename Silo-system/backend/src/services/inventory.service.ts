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

// Item categories as defined in database
export type ItemCategory = 
  | 'vegetable' | 'fruit' | 'meat' | 'poultry' | 'seafood' 
  | 'dairy' | 'grain' | 'bread' | 'sauce' | 'condiment' 
  | 'spice' | 'oil' | 'beverage' | 'sweetener' | 'other';

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
    // Get the highest item ID for this business to generate next SKU
    const { data, error } = await supabaseAdmin
      .from('items')
      .select('id')
      .eq('business_id', businessId)
      .order('id', { ascending: false })
      .limit(1);
    
    // Get next sequence number based on count
    const { count } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `${businessId}-ITM-${sequence}`;
  }

  /**
   * Get all items for a business with business-specific prices
   */
  async getItems(businessId: number, filters?: {
    category?: ItemCategory;
  }): Promise<Item[]> {
    // Build base query
    let query = supabaseAdmin
      .from('items')
      .select('*')
      .eq('status', 'active');

    // Filter by category if specified
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    // Get items that belong to this business OR are general items (business_id is null)
    query = query.or(`business_id.eq.${businessId},business_id.is.null`);

    const { data: items, error } = await query.order('name');
    
    if (error) {
      console.error('Failed to fetch items:', error);
      throw new Error('Failed to fetch items');
    }

    // Get business-specific prices for this business
    const { data: businessPrices, error: pricesError } = await supabaseAdmin
      .from('business_item_prices')
      .select('*')
      .eq('business_id', businessId);

    if (pricesError) {
      console.error('Failed to fetch business prices:', pricesError);
      // Continue without business prices - will use default prices
    }

    // Create a map of item_id to business price
    const priceMap = new Map<number, number>();
    if (businessPrices) {
      businessPrices.forEach(bp => {
        priceMap.set(bp.item_id, bp.cost_per_unit);
      });
    }

    // Merge business prices with items and parse production_rate_custom_dates
    const itemsWithPrices = (items || []).map(item => {
      let parsedItem = { ...item };
      // Parse production_rate_custom_dates from JSONB if present
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
      return {
        ...parsedItem,
        business_price: priceMap.get(item.id) ?? null,
        // Use business price if available, otherwise use default
        effective_price: priceMap.get(item.id) ?? item.cost_per_unit,
      };
    });
    
    return itemsWithPrices as Item[];
  }

  /**
   * Get single item with business-specific price
   */
  async getItem(itemId: number, businessId?: number): Promise<Item | null> {
    const { data, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single();

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
    category: ItemCategory;
    unit?: ItemUnit;
    storage_unit?: StorageUnit;
    cost_per_unit?: number;
  }): Promise<Item> {
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
    category: ItemCategory;
    unit: ItemUnit;
    storage_unit: StorageUnit;
    cost_per_unit: number;
    status: 'active' | 'inactive';
  }>): Promise<Item> {
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
    const { data: item, error } = await supabaseAdmin
      .from('items')
      .insert({
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
      })
      .select()
      .single();

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
  async getCompositeItem(itemId: number, businessId: number): Promise<(Item & { components: CompositeItemComponent[] }) | null> {
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
          cost_per_unit,
          sku
        )
      `)
      .eq('composite_item_id', itemId);

    if (error) {
      console.error('Failed to fetch composite item components:', error);
      return { ...item, components: [] };
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

    // Format components with effective prices
    const formattedComponents = (components || []).map((comp: any) => {
      const componentItem = comp.items;
      const effectivePrice = priceMap.get(comp.component_item_id) ?? componentItem?.cost_per_unit ?? 0;
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
          component_cost: comp.quantity * effectivePrice,
        } : undefined,
      };
    });

    return {
      ...item,
      components: formattedComponents,
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
   * Get all composite items for a business
   */
  async getCompositeItems(businessId: number): Promise<Item[]> {
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

    return items as Item[];
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
}

export const inventoryService = new InventoryService();
