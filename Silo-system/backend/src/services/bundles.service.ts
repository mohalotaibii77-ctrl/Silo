/**
 * BUNDLES SERVICE
 * Manage product bundles - 2+ products sold together as 1
 */

import { supabaseAdmin } from '../config/database';
import { storageToServing, StorageUnit, ServingUnit } from '../utils/unit-conversion';

export interface Bundle {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: BundleItem[];
}

export interface BundleItem {
  id: number;
  bundle_id: number;
  product_id: number;
  quantity: number;
  product?: {
    id: number;
    name: string;
    name_ar?: string;
    price: number;
    image_url?: string;
  };
}

export interface CreateBundleInput {
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  items: { product_id: number; quantity: number }[];
}

export interface UpdateBundleInput {
  name?: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price?: number;
  compare_at_price?: number;
  image_url?: string;
  is_active?: boolean;
  items?: { product_id: number; quantity: number }[];
}

class BundlesService {
  /**
   * Check if a product can be made with current inventory levels
   */
  private checkProductStockAvailability(
    ingredients: Array<{ item_id: number; quantity: number; unit?: string }>,
    stockMap: Map<number, { quantity: number; storage_unit: string }>,
    productQuantity: number = 1
  ): boolean {
    // Products without ingredients cannot be verified for stock, treat as out of stock
    if (!ingredients || ingredients.length === 0) {
      return false;
    }

    for (const ingredient of ingredients) {
      const stock = stockMap.get(ingredient.item_id);
      if (!stock) {
        return false;
      }

      const availableInStorage = stock.quantity;
      const storageUnit = (stock.storage_unit || 'grams') as StorageUnit;
      const servingUnit = (ingredient.unit || 'grams') as ServingUnit;
      
      let availableInServingUnits: number;
      try {
        availableInServingUnits = storageToServing(availableInStorage, storageUnit, servingUnit);
      } catch {
        availableInServingUnits = availableInStorage;
      }

      // Required quantity = ingredient quantity per product * product quantity in bundle
      const requiredQuantity = ingredient.quantity * productQuantity;

      if (availableInServingUnits < requiredQuantity) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all bundles for a business
   * @param businessId - The business ID
   * @param branchId - Optional branch ID to check stock availability
   */
  async getBundles(businessId: number, branchId?: number): Promise<(Bundle & { in_stock?: boolean })[]> {
    const { data: bundles, error } = await supabaseAdmin
      .from('bundles')
      .select(`
        *,
        bundle_items (
          id,
          product_id,
          quantity,
          products (
            id,
            name,
            name_ar,
            price,
            image_url
          )
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bundles:', error);
      throw new Error(`Failed to fetch bundles: ${error.message}`);
    }

    // Collect all product IDs from bundles to check their ingredients
    const productIds = new Set<number>();
    for (const bundle of bundles || []) {
      for (const item of bundle.bundle_items || []) {
        productIds.add(item.product_id);
      }
    }

    // Fetch product ingredients for all products in bundles
    let productIngredientsMap: Map<number, Array<{ item_id: number; quantity: number; unit?: string }>> = new Map();
    let stockMap: Map<number, { quantity: number; storage_unit: string }> = new Map();

    if (productIds.size > 0) {
      // Get all product ingredients with their item units
      const { data: productIngredients } = await supabaseAdmin
        .from('product_ingredients')
        .select(`
          product_id,
          item_id,
          quantity,
          variant_id,
          items (
            id,
            unit,
            storage_unit
          )
        `)
        .in('product_id', Array.from(productIds))
        .is('variant_id', null); // Only get base ingredients, not variant-specific

      // Group ingredients by product
      if (productIngredients) {
        for (const ing of productIngredients) {
          if (!productIngredientsMap.has(ing.product_id)) {
            productIngredientsMap.set(ing.product_id, []);
          }
          productIngredientsMap.get(ing.product_id)!.push({
            item_id: ing.item_id,
            quantity: ing.quantity,
            unit: (ing.items as any)?.unit
          });
        }
      }

      // Collect all unique item IDs from ingredients
      const itemIds = new Set<number>();
      productIngredientsMap.forEach(ingredients => {
        ingredients.forEach(ing => itemIds.add(ing.item_id));
      });

      if (itemIds.size > 0) {
        // Fetch inventory stock for all items
        let stockQuery = supabaseAdmin
          .from('inventory_stock')
          .select('item_id, quantity, items(storage_unit)')
          .eq('business_id', businessId)
          .in('item_id', Array.from(itemIds));

        if (branchId) {
          stockQuery = stockQuery.eq('branch_id', branchId);
        } else {
          stockQuery = stockQuery.is('branch_id', null);
        }

        const { data: stockData } = await stockQuery;
        
        if (stockData) {
          stockData.forEach((s: any) => {
            stockMap.set(s.item_id, {
              quantity: s.quantity || 0,
              storage_unit: s.items?.storage_unit || 'grams'
            });
          });
        }

        // Also fetch item storage units for items without stock records
        const { data: itemsData } = await supabaseAdmin
          .from('items')
          .select('id, storage_unit')
          .in('id', Array.from(itemIds));
        
        if (itemsData) {
          itemsData.forEach((item: any) => {
            if (!stockMap.has(item.id)) {
              stockMap.set(item.id, {
                quantity: 0,
                storage_unit: item.storage_unit || 'grams'
              });
            }
          });
        }
      }
    }

    // Transform the data to match our interface and check stock
    return (bundles || []).map((bundle: any) => {
      const items = (bundle.bundle_items || []).map((item: any) => ({
        id: item.id,
        bundle_id: bundle.id,
        product_id: item.product_id,
        quantity: item.quantity,
        product: item.products
      }));

      // Calculate original price (sum of product prices × quantities)
      const originalPrice = items.reduce((sum: number, item: any) => {
        const productPrice = item.product?.price || 0;
        return sum + (productPrice * item.quantity);
      }, 0);

      // Calculate savings amount
      const savingsAmount = originalPrice - bundle.price;
      const savingsPercent = originalPrice > 0 ? (savingsAmount / originalPrice) * 100 : 0;

      // Bundle is in stock only if ALL its products are in stock
      let inStock = true;
      for (const item of items) {
        const productIngredients = productIngredientsMap.get(item.product_id) || [];
        // Check if this product can be made for the quantity needed in the bundle
        if (!this.checkProductStockAvailability(productIngredients, stockMap, item.quantity)) {
          inStock = false;
          break;
        }
      }

      return {
        ...bundle,
        items,
        original_price: originalPrice,
        savings_amount: savingsAmount,
        savings_percent: savingsPercent,
        in_stock: inStock
      };
    });
  }

  /**
   * Get a single bundle by ID
   */
  async getBundle(bundleId: number, businessId: number): Promise<Bundle | null> {
    const { data: bundle, error } = await supabaseAdmin
      .from('bundles')
      .select(`
        *,
        bundle_items (
          id,
          product_id,
          quantity,
          products (
            id,
            name,
            name_ar,
            price,
            image_url
          )
        )
      `)
      .eq('id', bundleId)
      .eq('business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch bundle: ${error.message}`);
    }

    const items = (bundle.bundle_items || []).map((item: any) => ({
      id: item.id,
      bundle_id: bundle.id,
      product_id: item.product_id,
      quantity: item.quantity,
      product: item.products
    }));

    // Calculate original price (sum of product prices × quantities)
    const originalPrice = items.reduce((sum: number, item: any) => {
      const productPrice = item.product?.price || 0;
      return sum + (productPrice * item.quantity);
    }, 0);

    // Calculate savings
    const savingsAmount = originalPrice - bundle.price;
    const savingsPercent = originalPrice > 0 ? (savingsAmount / originalPrice) * 100 : 0;

    return {
      ...bundle,
      items,
      original_price: originalPrice,
      savings_amount: savingsAmount,
      savings_percent: savingsPercent
    };
  }

  /**
   * Check if a bundle name already exists for this business
   */
  private async checkDuplicateBundleName(businessId: number, name: string, excludeBundleId?: number): Promise<boolean> {
    let query = supabaseAdmin
      .from('bundles')
      .select('id')
      .eq('business_id', businessId)
      .ilike('name', name.trim());
    
    if (excludeBundleId) {
      query = query.neq('id', excludeBundleId);
    }
    
    const { data } = await query.limit(1);
    return !!(data && data.length > 0);
  }

  /**
   * Create a new bundle
   */
  async createBundle(businessId: number, input: CreateBundleInput): Promise<Bundle> {
    // Validate at least 2 products
    if (!input.items || input.items.length < 2) {
      throw new Error('A bundle must contain at least 2 products');
    }

    // Check for duplicate name
    const isDuplicate = await this.checkDuplicateBundleName(businessId, input.name);
    if (isDuplicate) {
      throw new Error('A bundle with this name already exists');
    }

    // Create the bundle
    const { data: bundle, error } = await supabaseAdmin
      .from('bundles')
      .insert({
        business_id: businessId,
        name: input.name,
        name_ar: input.name_ar || null,
        description: input.description || null,
        description_ar: input.description_ar || null,
        sku: input.sku || null,
        price: input.price,
        compare_at_price: input.compare_at_price || null,
        image_url: input.image_url || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create bundle: ${error.message}`);
    }

    // Add bundle items
    const bundleItems = input.items.map(item => ({
      bundle_id: bundle.id,
      product_id: item.product_id,
      quantity: item.quantity
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('bundle_items')
      .insert(bundleItems);

    if (itemsError) {
      // Rollback bundle creation
      await supabaseAdmin.from('bundles').delete().eq('id', bundle.id);
      throw new Error(`Failed to add bundle items: ${itemsError.message}`);
    }

    // Fetch and return the complete bundle
    return this.getBundle(bundle.id, businessId) as Promise<Bundle>;
  }

  /**
   * Update a bundle
   */
  async updateBundle(bundleId: number, businessId: number, input: UpdateBundleInput): Promise<Bundle> {
    // Check for duplicate name if name is being updated
    if (input.name !== undefined) {
      const isDuplicate = await this.checkDuplicateBundleName(businessId, input.name, bundleId);
      if (isDuplicate) {
        throw new Error('A bundle with this name already exists');
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.name_ar !== undefined) updateData.name_ar = input.name_ar;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.description_ar !== undefined) updateData.description_ar = input.description_ar;
    if (input.sku !== undefined) updateData.sku = input.sku;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.compare_at_price !== undefined) updateData.compare_at_price = input.compare_at_price;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const { error } = await supabaseAdmin
      .from('bundles')
      .update(updateData)
      .eq('id', bundleId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to update bundle: ${error.message}`);
    }

    // Update items if provided
    if (input.items !== undefined) {
      if (input.items.length < 2) {
        throw new Error('A bundle must contain at least 2 products');
      }

      // Delete existing items
      await supabaseAdmin
        .from('bundle_items')
        .delete()
        .eq('bundle_id', bundleId);

      // Insert new items
      const bundleItems = input.items.map(item => ({
        bundle_id: bundleId,
        product_id: item.product_id,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('bundle_items')
        .insert(bundleItems);

      if (itemsError) {
        throw new Error(`Failed to update bundle items: ${itemsError.message}`);
      }
    }

    return this.getBundle(bundleId, businessId) as Promise<Bundle>;
  }

  /**
   * Delete a bundle
   */
  async deleteBundle(bundleId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('bundles')
      .delete()
      .eq('id', bundleId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to delete bundle: ${error.message}`);
    }
  }

  /**
   * Toggle bundle active status
   */
  async toggleBundleStatus(bundleId: number, businessId: number, isActive: boolean): Promise<Bundle> {
    const { error } = await supabaseAdmin
      .from('bundles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', bundleId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to toggle bundle status: ${error.message}`);
    }

    return this.getBundle(bundleId, businessId) as Promise<Bundle>;
  }

  /**
   * Get bundle stats - sold count and cost for margin calculation
   * Returns stats for all bundles in a business
   */
  async getBundleStats(businessId: number): Promise<Record<number, { sold: number; total_cost: number }>> {
    // Get all bundles with their items and products
    const { data: bundles, error } = await supabaseAdmin
      .from('bundles')
      .select(`
        id,
        bundle_items (
          product_id,
          quantity
        )
      `)
      .eq('business_id', businessId);

    if (error) {
      console.error('Error fetching bundle stats:', error);
      return {};
    }

    // Get all unique product IDs from bundles
    const productIds = new Set<number>();
    for (const bundle of bundles || []) {
      for (const item of bundle.bundle_items || []) {
        productIds.add(item.product_id);
      }
    }

    // Fetch products with their manual cost field as fallback
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, cost')
      .in('id', Array.from(productIds));

    // Create a map of product manual costs
    const productManualCosts = new Map<number, number>();
    if (products) {
      products.forEach(p => productManualCosts.set(p.id, p.cost || 0));
    }

    // Fetch product ingredients with item costs for all products in bundles
    const { data: productIngredients } = await supabaseAdmin
      .from('product_ingredients')
      .select(`
        product_id,
        variant_id,
        item_id,
        quantity,
        items (
          id,
          cost_per_unit
        )
      `)
      .in('product_id', Array.from(productIds));

    // Fetch business-specific prices
    const { data: businessPrices } = await supabaseAdmin
      .from('business_item_prices')
      .select('item_id, cost_per_unit')
      .eq('business_id', businessId);

    const priceMap = new Map<number, number>();
    if (businessPrices) {
      businessPrices.forEach(bp => priceMap.set(bp.item_id, bp.cost_per_unit));
    }

    // Calculate cost for each product (sum of ingredient costs)
    const productCosts: Record<number, number> = {};
    for (const ing of productIngredients || []) {
      // Skip variant ingredients, only calculate base cost (or use variant if product has variants)
      const itemPrice = priceMap.get(ing.item_id) ?? (ing.items as any)?.cost_per_unit ?? 0;
      const ingredientCost = ing.quantity * itemPrice;
      
      if (!productCosts[ing.product_id]) {
        productCosts[ing.product_id] = 0;
      }
      productCosts[ing.product_id] += ingredientCost;
    }

    // For products with no ingredients, use manual cost as fallback
    for (const productId of productIds) {
      if (!productCosts[productId] || productCosts[productId] === 0) {
        productCosts[productId] = productManualCosts.get(productId) || 0;
      }
    }

    // Calculate total cost for each bundle
    const bundleCosts: Record<number, number> = {};
    for (const bundle of bundles || []) {
      let totalCost = 0;
      for (const item of bundle.bundle_items || []) {
        const productCost = productCosts[item.product_id] || 0;
        totalCost += productCost * item.quantity;
      }
      bundleCosts[bundle.id] = totalCost;
    }

    // Get sold counts from order_items where combo_id matches bundle
    const { data: orderItems, error: orderError } = await supabaseAdmin
      .from('order_items')
      .select(`
        combo_id,
        quantity,
        orders!inner (
          business_id,
          is_void,
          order_status
        )
      `)
      .eq('orders.business_id', businessId)
      .eq('orders.is_void', false)
      .eq('is_combo', true)
      .in('orders.order_status', ['completed', 'ready', 'out_for_delivery']);

    if (orderError) {
      console.error('Error fetching bundle order items:', orderError);
    }

    // Aggregate sold counts by bundle
    const soldCounts: Record<number, number> = {};
    for (const item of orderItems || []) {
      if (item.combo_id) {
        soldCounts[item.combo_id] = (soldCounts[item.combo_id] || 0) + (item.quantity || 1);
      }
    }

    // Fetch active delivery partners for margin calculations
    const { data: deliveryPartners } = await supabaseAdmin
      .from('delivery_partners')
      .select('id, name, name_ar, commission_type, commission_value')
      .eq('business_id', businessId)
      .eq('status', 'active');

    // Helper to calculate delivery margin
    const calculateDeliveryMargin = (
      price: number, 
      cost: number, 
      commissionType: 'percentage' | 'fixed', 
      commissionValue: number
    ): number => {
      if (price <= 0) return 0;
      const commission = commissionType === 'percentage' 
        ? (price * commissionValue / 100) 
        : commissionValue;
      const profit = price - cost - commission;
      return (profit / price) * 100;
    };

    // Combine stats with margin calculation
    const result: Record<number, { 
      sold: number; 
      total_cost: number; 
      margin_percent: number;
      delivery_margins: Array<{
        partner_id: number;
        partner_name: string;
        partner_name_ar?: string;
        margin_percent: number;
      }>;
    }> = {};
    
    for (const bundle of bundles || []) {
      const totalCost = bundleCosts[bundle.id] || 0;
      // We need to fetch bundle price - bundle object only has id and bundle_items
      result[bundle.id] = {
        sold: soldCounts[bundle.id] || 0,
        total_cost: totalCost,
        margin_percent: 0, // Will be set after fetching prices
        delivery_margins: []
      };
    }

    // Fetch bundle prices to calculate margin
    if (bundles && bundles.length > 0) {
      const { data: bundlePrices } = await supabaseAdmin
        .from('bundles')
        .select('id, price')
        .in('id', bundles.map(b => b.id));

      if (bundlePrices) {
        for (const bp of bundlePrices) {
          if (result[bp.id]) {
            const totalCost = result[bp.id].total_cost;
            // Calculate dine-in margin
            result[bp.id].margin_percent = bp.price > 0 
              ? ((bp.price - totalCost) / bp.price) * 100 
              : 0;
            
            // Calculate delivery margins for each partner
            result[bp.id].delivery_margins = (deliveryPartners || []).map((partner: any) => ({
              partner_id: partner.id,
              partner_name: partner.name,
              partner_name_ar: partner.name_ar,
              margin_percent: calculateDeliveryMargin(
                bp.price,
                totalCost,
                partner.commission_type,
                partner.commission_value
              ),
            }));
          }
        }
      }
    }

    return result;
  }
}

export const bundlesService = new BundlesService();

