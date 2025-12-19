/**
 * STORE PRODUCTS SERVICE
 * Products management for store-setup (simpler than POS products)
 */

import { supabaseAdmin } from '../config/database';
import { storageService } from './storage.service';
import { storageToServing, StorageUnit, ServingUnit } from '../utils/unit-conversion';

export interface StoreProduct {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  category?: string;
  category_id?: number;
  price: number;
  cost?: number;
  tax_rate: number;
  is_active: boolean;
  has_variants: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStoreProductInput {
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  category_id?: number;
  price: number;
  tax_rate?: number;
  has_variants?: boolean;
  image_url?: string;
}

export class StoreProductsService {
  
  /**
   * Generate unique SKU for a new store product
   */
  private async generateProductSku(businessId: number): Promise<string> {
    // Get count of products for this business
    const { count } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `${businessId}-PRD-${sequence}`;
  }

  /**
   * Check if a product can be made with current inventory levels
   * Returns true if all required ingredients are available
   */
  private checkProductStockAvailability(
    ingredients: Array<{ item_id: number; quantity: number; unit?: string }>,
    stockMap: Map<number, { quantity: number; storage_unit: string }>
  ): boolean {
    // If product has no ingredients, consider it always in stock
    if (!ingredients || ingredients.length === 0) {
      return true;
    }

    // Check each ingredient
    for (const ingredient of ingredients) {
      const stock = stockMap.get(ingredient.item_id);
      if (!stock) {
        // No stock record for this item means it's out of stock
        return false;
      }

      // Available quantity in storage units
      const availableInStorage = stock.quantity;
      
      // Convert storage units to serving units for comparison
      const storageUnit = (stock.storage_unit || 'grams') as StorageUnit;
      const servingUnit = (ingredient.unit || 'grams') as ServingUnit;
      
      let availableInServingUnits: number;
      try {
        availableInServingUnits = storageToServing(availableInStorage, storageUnit, servingUnit);
      } catch {
        // If units are incompatible, compare directly
        availableInServingUnits = availableInStorage;
      }

      // Required quantity for 1 unit of product (in serving units)
      const requiredQuantity = ingredient.quantity;

      if (availableInServingUnits < requiredQuantity) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate delivery margin after partner commission
   */
  private calculateDeliveryMargin(
    price: number, 
    cost: number, 
    commissionType: 'percentage' | 'fixed', 
    commissionValue: number
  ): number {
    if (price <= 0) return 0;
    
    const commission = commissionType === 'percentage' 
      ? (price * commissionValue / 100) 
      : commissionValue;
    
    const profit = price - cost - commission;
    return (profit / price) * 100;
  }

  /**
   * Get all products for a business (with variants, ingredients, and modifiers for POS)
   * @param businessId - The business ID
   * @param branchId - Optional branch ID to check stock availability
   * @param options - Optional pagination options
   */
  async getProducts(
    businessId: number, 
    branchId?: number,
    options?: {
      page?: number;
      limit?: number;
      fields?: string[];
    }
  ): Promise<any[] | { data: any[]; total: number }> {
    const { page, limit, fields } = options || {};
    
    // Build the base query
    let query = supabaseAdmin
      .from('products')
      .select(`
        *,
        product_categories (
          id,
          name,
          name_ar
        ),
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
            storage_unit
          )
        )
      `, { count: page && limit ? 'exact' : undefined })
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Apply pagination if provided
    if (page && limit) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data: products, error, count } = await query;

    if (error) {
      console.error('Failed to fetch products:', error);
      throw new Error('Failed to fetch products');
    }

    // Fetch active delivery partners for margin calculations
    const { data: deliveryPartners } = await supabaseAdmin
      .from('delivery_partners')
      .select('id, name, name_ar, commission_type, commission_value')
      .eq('business_id', businessId)
      .eq('status', 'active');

    // Fetch modifiers separately (table might be new) - include item_id and quantity for stock checking
    const productIds = (products || []).map(p => p.id);
    let modifiersMap: Map<number, any[]> = new Map();
    
    if (productIds.length > 0) {
      try {
        const { data: allModifiers } = await supabaseAdmin
          .from('product_modifiers')
          .select(`
            *,
            items:item_id (
              id,
              unit,
              storage_unit
            )
          `)
          .in('product_id', productIds)
          .order('sort_order');
        
        if (allModifiers) {
          allModifiers.forEach(mod => {
            if (!modifiersMap.has(mod.product_id)) {
              modifiersMap.set(mod.product_id, []);
            }
            modifiersMap.get(mod.product_id)!.push(mod);
          });
        }
      } catch (e) {
        console.log('product_modifiers not available yet');
      }
    }

    // Fetch inventory stock levels for all items used in products
    // Collect all unique item IDs from ingredients and modifiers
    const itemIds = new Set<number>();
    (products || []).forEach((p: any) => {
      (p.product_ingredients || []).forEach((ing: any) => {
        if (ing.item_id) itemIds.add(ing.item_id);
      });
    });
    modifiersMap.forEach(modifiers => {
      modifiers.forEach(mod => {
        if (mod.item_id) itemIds.add(mod.item_id);
      });
    });

    // Build stock map: item_id -> { quantity, storage_unit }
    const stockMap = new Map<number, { quantity: number; storage_unit: string }>();
    // Build cost map: item_id -> cost_per_unit (for margin calculations)
    const costMap = new Map<number, number>();
    
    if (itemIds.size > 0) {
      // Build query for stock levels
      let stockQuery = supabaseAdmin
        .from('inventory_stock')
        .select('item_id, quantity, items(storage_unit)')
        .eq('business_id', businessId)
        .in('item_id', Array.from(itemIds));
      
      // Filter by branch if provided, otherwise get business-level stock
      if (branchId) {
        stockQuery = stockQuery.eq('branch_id', branchId);
      } else {
        stockQuery = stockQuery.is('branch_id', null);
      }

      const { data: stockData } = await stockQuery;
      
      if (stockData) {
        stockData.forEach((s: any) => {
          // Get storage unit from the items join
          const storageUnit = s.items?.storage_unit || 'grams';
          stockMap.set(s.item_id, { 
            quantity: s.quantity || 0,
            storage_unit: storageUnit
          });
        });
      }

      // Fetch item details including cost_per_unit
      const { data: itemsData } = await supabaseAdmin
        .from('items')
        .select('id, storage_unit, cost_per_unit')
        .in('id', Array.from(itemIds));
      
      if (itemsData) {
        itemsData.forEach((item: any) => {
          if (!stockMap.has(item.id)) {
            stockMap.set(item.id, {
              quantity: 0,
              storage_unit: item.storage_unit || 'grams'
            });
          }
          costMap.set(item.id, item.cost_per_unit || 0);
        });
      }

      // Fetch business-specific prices (override default costs)
      const { data: businessPrices } = await supabaseAdmin
        .from('business_item_prices')
        .select('item_id, cost_per_unit')
        .eq('business_id', businessId)
        .in('item_id', Array.from(itemIds));

      if (businessPrices) {
        businessPrices.forEach((bp: any) => {
          costMap.set(bp.item_id, bp.cost_per_unit);
        });
      }
    }

    // Helper function to calculate ingredient cost
    const calculateIngredientsCost = (ings: any[]): number => {
      return ings.reduce((sum, ing) => {
        const itemCost = costMap.get(ing.item_id) || 0;
        return sum + (ing.quantity * itemCost);
      }, 0);
    };

    // Helper function to calculate margin percentage
    const calculateMargin = (price: number, cost: number): number => {
      if (price <= 0) return 0;
      return ((price - cost) / price) * 100;
    };

    // Map products with all related data and stock availability
    const mappedProducts = (products || []).map(p => {
      // Format ingredients with item names, units, and costs
      const ingredients = (p.product_ingredients || [])
        .filter((ing: any) => !ing.variant_id)
        .map((ing: any) => {
          const itemCost = costMap.get(ing.item_id) || 0;
          return {
            id: ing.id,
            item_id: ing.item_id,
            item_name: ing.items?.name,
            item_name_ar: ing.items?.name_ar,
            quantity: ing.quantity,
            removable: ing.removable || false,
            unit: ing.items?.unit,
            cost_per_unit: itemCost,
            total_cost: ing.quantity * itemCost,
          };
        });

      // Calculate base product cost (for non-variant products)
      const baseCost = calculateIngredientsCost(ingredients);

      // Format variants with their ingredients, costs, and check stock availability
      const variants = (p.product_variants || [])
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((v: any) => {
          const variantIngredients = (p.product_ingredients || [])
            .filter((ing: any) => ing.variant_id === v.id)
            .map((ing: any) => {
              const itemCost = costMap.get(ing.item_id) || 0;
              return {
                id: ing.id,
                item_id: ing.item_id,
                item_name: ing.items?.name,
                item_name_ar: ing.items?.name_ar,
                quantity: ing.quantity,
                removable: ing.removable || false,
                unit: ing.items?.unit,
                cost_per_unit: itemCost,
                total_cost: ing.quantity * itemCost,
              };
            });
          
          // Calculate variant cost and price
          // Use ingredient-based cost if available, otherwise fall back to product's base cost
          const ingredientsCost = calculateIngredientsCost(variantIngredients);
          const variantCost = ingredientsCost > 0 ? ingredientsCost : (p.cost || 0);
          const variantPrice = p.price + (v.price_adjustment || 0);
          const variantMargin = calculateMargin(variantPrice, variantCost);
          
          // Check if this specific variant can be made
          let variantInStock = true;
          if (variantIngredients.length > 0) {
            variantInStock = this.checkProductStockAvailability(variantIngredients, stockMap);
          }
          // Variants with no ingredients are always available
          
          // Calculate delivery margins for each partner
          const variantDeliveryMargins = (deliveryPartners || []).map((partner: any) => ({
            partner_id: partner.id,
            partner_name: partner.name,
            partner_name_ar: partner.name_ar,
            margin_percent: this.calculateDeliveryMargin(
              variantPrice, 
              variantCost, 
              partner.commission_type, 
              partner.commission_value
            ),
          }));
          
          return {
            id: v.id,
            name: v.name,
            name_ar: v.name_ar,
            price_adjustment: v.price_adjustment || 0,
            ingredients: variantIngredients,
            total_cost: variantCost,
            variant_price: variantPrice,
            margin_percent: variantMargin,
            delivery_margins: variantDeliveryMargins,
            in_stock: variantInStock,
          };
        });

      // Get modifiers for this product
      const modifiers = modifiersMap.get(p.id) || [];

      // Check stock availability
      let inStock = true;
      
      if (p.has_variants && variants.length > 0) {
        // For variant products, check if AT LEAST ONE variant can be made
        inStock = variants.some((v: { in_stock: boolean }) => v.in_stock);
      } else if (ingredients.length > 0) {
        // For non-variant products, check all ingredients
        inStock = this.checkProductStockAvailability(ingredients, stockMap);
      }
      // Products with no ingredients are always in stock

      // Calculate final cost and margin for the product
      // Priority: ingredient-based cost > product's manual cost field > 0
      let productCost: number;
      if (p.has_variants && variants.length > 0) {
        // For variant products, use lowest variant cost
        const variantCosts = variants.map((v: any) => v.total_cost).filter((c: number) => c > 0);
        productCost = variantCosts.length > 0 ? Math.min(...variantCosts) : (p.cost || 0);
      } else {
        // For non-variant products, use ingredient cost or fall back to manual cost
        productCost = baseCost > 0 ? baseCost : (p.cost || 0);
      }
      const productMargin = calculateMargin(p.price, productCost);

      // Calculate delivery margins for each partner (for non-variant products)
      const productDeliveryMargins = (deliveryPartners || []).map((partner: any) => ({
        partner_id: partner.id,
        partner_name: partner.name,
        partner_name_ar: partner.name_ar,
        margin_percent: this.calculateDeliveryMargin(
          p.price, 
          productCost, 
          partner.commission_type, 
          partner.commission_value
        ),
      }));

      return {
        ...p,
        category_name: p.product_categories?.name || null,
        category: p.product_categories?.name || null,
        variants: p.has_variants ? variants : undefined,
        ingredients: !p.has_variants ? ingredients : undefined,
        modifiers: modifiers.map((m: any) => ({
          id: m.id,
          item_id: m.item_id,
          name: m.name,
          name_ar: m.name_ar,
          extra_price: m.extra_price || 0,
          removable: m.removable || false,
          addable: m.addable ?? true,
          quantity: m.quantity || 1,
        })),
        // Calculated fields
        total_cost: productCost,
        margin_percent: productMargin,
        delivery_margins: productDeliveryMargins,
        in_stock: inStock,
        // Clean up raw relations
        product_categories: undefined,
        product_variants: undefined,
        product_ingredients: undefined,
      };
    });

    // Return paginated response if pagination was requested
    if (page && limit && count !== null) {
      return {
        data: mappedProducts,
        total: count,
      };
    }

    return mappedProducts;
  }

  /**
   * Get single product
   */
  async getProduct(productId: number, businessId: number): Promise<StoreProduct | null> {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('business_id', businessId)
      .single();

    if (error || !product) return null;
    return product;
  }

  /**
   * Check if a product name already exists for this business
   */
  private async checkDuplicateProductName(businessId: number, name: string, excludeProductId?: number): Promise<boolean> {
    let query = supabaseAdmin
      .from('products')
      .select('id')
      .eq('business_id', businessId)
      .ilike('name', name.trim());
    
    if (excludeProductId) {
      query = query.neq('id', excludeProductId);
    }
    
    const { data } = await query.limit(1);
    return !!(data && data.length > 0);
  }

  /**
   * Create a new product
   */
  async createProduct(businessId: number, data: CreateStoreProductInput): Promise<StoreProduct> {
    // Check for duplicate name
    const isDuplicate = await this.checkDuplicateProductName(businessId, data.name);
    if (isDuplicate) {
      throw new Error('A product with this name already exists');
    }

    // Generate SKU if not provided
    const sku = data.sku || await this.generateProductSku(businessId);
    
    // Handle base64 image upload if provided
    let finalImageUrl: string | null = null;
    if (data.image_url && data.image_url.startsWith('data:')) {
      try {
        const uploadResult = await storageService.uploadBase64(data.image_url, businessId, 'product' as any);
        finalImageUrl = uploadResult.url;
      } catch (err) {
        console.error('Failed to upload product image:', err);
        // Continue without image if upload fails
      }
    } else if (data.image_url) {
      finalImageUrl = data.image_url;
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert({
        business_id: businessId,
        name: data.name,
        name_ar: data.name_ar || null,
        description: data.description || null,
        description_ar: data.description_ar || null,
        sku: sku,
        category_id: data.category_id || null,
        price: data.price,
        tax_rate: data.tax_rate || 0,
        has_variants: data.has_variants || false,
        image_url: finalImageUrl,
        is_active: true,
      })
      .select()
      .single();

    if (error || !product) {
      console.error('Failed to create product:', error);
      throw new Error('Failed to create product');
    }

    return product;
  }

  /**
   * Update a product
   */
  async updateProduct(productId: number, businessId: number, data: Partial<CreateStoreProductInput> & { is_active?: boolean }): Promise<StoreProduct> {
    // Check for duplicate name if name is being updated
    if (data.name !== undefined) {
      const isDuplicate = await this.checkDuplicateProductName(businessId, data.name, productId);
      if (isDuplicate) {
        throw new Error('A product with this name already exists');
      }
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.name_ar !== undefined) updateData.name_ar = data.name_ar;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.description_ar !== undefined) updateData.description_ar = data.description_ar;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.category_id !== undefined) updateData.category_id = data.category_id;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate;
    if (data.has_variants !== undefined) updateData.has_variants = data.has_variants;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    
    // Handle base64 image upload if provided
    if (data.image_url !== undefined) {
      if (data.image_url && data.image_url.startsWith('data:')) {
        try {
          const uploadResult = await storageService.uploadBase64(data.image_url, businessId, 'product' as any);
          updateData.image_url = uploadResult.url;
        } catch (err) {
          console.error('Failed to upload product image:', err);
          // Don't update image if upload fails
        }
      } else {
        updateData.image_url = data.image_url;
      }
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error || !product) {
      console.error('Failed to update product:', error);
      throw new Error('Failed to update product');
    }

    return product;
  }

  /**
   * Delete a product (soft delete)
   */
  async deleteProduct(productId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to delete product:', error);
      throw new Error('Failed to delete product');
    }
  }
}

export const storeProductsService = new StoreProductsService();

