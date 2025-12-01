/**
 * INVENTORY SERVICE
 * Items (raw materials/ingredients) management with business-specific pricing
 */

import { supabaseAdmin } from '../config/database';

// Item categories as defined in database
export type ItemCategory = 
  | 'vegetable' | 'fruit' | 'meat' | 'poultry' | 'seafood' 
  | 'dairy' | 'grain' | 'bread' | 'sauce' | 'condiment' 
  | 'spice' | 'oil' | 'beverage' | 'sweetener' | 'other';

// Item units (simplified)
export type ItemUnit = 'grams' | 'mL' | 'piece';

export interface Item {
  id: number;
  business_id: number | null;
  name: string;
  name_ar?: string | null;
  category: ItemCategory;
  unit: ItemUnit;
  cost_per_unit: number;
  is_system_item: boolean;
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

export class InventoryService {
  
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

    // Merge business prices with items
    const itemsWithPrices = (items || []).map(item => ({
      ...item,
      business_price: priceMap.get(item.id) ?? null,
      // Use business price if available, otherwise use default
      effective_price: priceMap.get(item.id) ?? item.cost_per_unit,
    }));
    
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

    // Get business-specific price if businessId provided
    if (businessId) {
      const { data: businessPrice } = await supabaseAdmin
        .from('business_item_prices')
        .select('cost_per_unit')
        .eq('business_id', businessId)
        .eq('item_id', itemId)
        .single();

      return {
        ...data,
        business_price: businessPrice?.cost_per_unit ?? null,
      } as Item;
    }

    return data as Item;
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
    cost_per_unit?: number;
  }): Promise<Item> {
    const { data: item, error } = await supabaseAdmin
      .from('items')
      .insert({
        business_id: data.business_id,
        name: data.name,
        name_ar: data.name_ar || null,
        category: data.category,
        unit: data.unit || 'grams',
        cost_per_unit: data.cost_per_unit || 0,
        is_system_item: false,
        status: 'active',
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
    cost_per_unit: number;
    status: 'active' | 'inactive';
  }>): Promise<Item> {
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
        .select('id, item_id, name, name_ar, removable, addable, extra_price, sort_order')
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
    modifiers?: { item_id: number; name: string; name_ar?: string; extra_price: number }[];
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
}

export const inventoryService = new InventoryService();
