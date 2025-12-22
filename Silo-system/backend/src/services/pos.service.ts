/**
 * POS SERVICE
 * Point of Sale operations - orders, payments, receipts
 * Handles orders from POS terminal, delivery apps (Talabat, Jahez, etc.), phone, website
 */

import { supabaseAdmin } from '../config/database';
import { 
  Order, 
  OrderItem, 
  OrderItemModifier,
  OrderPayment,
  CreateOrderInput,
  CreateOrderItemInput,
  OrderStatus,
  PaymentStatus,
  OrderSource,
  StorageUnit
} from '../types';
import { storageToServing, ServingUnit } from '../utils/unit-conversion';
import { inventoryStockService } from './inventory-stock.service';
import { orderTimelineService } from './order-timeline.service';

// Type for inventory check result
interface InventoryCheckResult {
  canFulfill: boolean;
  insufficientItems: Array<{
    productName: string;
    variantName?: string;
    ingredientName: string;
    required: number;
    available: number;
    unit: string;
  }>;
}

export class POSService {

  /**
   * Check inventory availability for all items in an order
   * Returns whether the order can be fulfilled and details about any shortages
   * Also checks product accessories based on order type
   */
  private async checkOrderInventory(
    businessId: number,
    branchId: number | undefined,
    items: CreateOrderItemInput[],
    orderType?: 'dine_in' | 'takeaway' | 'delivery'
  ): Promise<InventoryCheckResult> {
    const insufficientItems: InventoryCheckResult['insufficientItems'] = [];

    // Get all stock levels for this business/branch
    let stockQuery = supabaseAdmin
      .from('inventory_stock')
      .select('item_id, quantity')
      .eq('business_id', businessId);
    
    if (branchId) {
      stockQuery = stockQuery.eq('branch_id', branchId);
    }

    const { data: stockData } = await stockQuery;
    
    // Build stock map: item_id -> { quantity, storage_unit }
    const stockMap = new Map<number, number>();
    if (stockData) {
      stockData.forEach((s: any) => {
        const currentQty = stockMap.get(s.item_id) || 0;
        stockMap.set(s.item_id, currentQty + (s.quantity || 0));
      });
    }

    // Get item storage units
    const { data: itemsData } = await supabaseAdmin
      .from('items')
      .select('id, name, unit, storage_unit');
    
    const itemInfoMap = new Map<number, { name: string; unit: string; storage_unit: string }>();
    if (itemsData) {
      itemsData.forEach((item: any) => {
        itemInfoMap.set(item.id, {
          name: item.name,
          unit: item.unit || 'grams',
          storage_unit: item.storage_unit || 'grams'
        });
      });
    }

    // Aggregate required ingredients across all items
    const requiredIngredients = new Map<number, { 
      quantity: number; 
      productName: string; 
      variantName?: string;
    }>();

    for (const item of items) {
      // Skip bundles for now - they should check ingredients of contained products
      if (item.is_combo && item.bundle_id) {
        // Get bundle items and their ingredients
        const { data: bundleData } = await supabaseAdmin
          .from('bundles')
          .select(`
            bundle_items (
              product_id,
              quantity,
              products (
                name,
                has_variants,
                product_variants (id, name),
                product_ingredients (item_id, variant_id, quantity)
              )
            )
          `)
          .eq('id', item.bundle_id)
          .single();

        if (bundleData?.bundle_items) {
          for (const bundleItem of bundleData.bundle_items) {
            const bundleProduct = bundleItem.products as any;
            if (!bundleProduct) continue;
            
            const bundleQty = (bundleItem.quantity || 1) * item.quantity;
            
            // Get ingredients for the first variant or product-level ingredients
            const ingredients = bundleProduct.product_ingredients || [];
            for (const ing of ingredients) {
              if (ing.variant_id && bundleProduct.has_variants) continue; // Skip variant-specific if product has variants
              
              const current = requiredIngredients.get(ing.item_id) || { quantity: 0, productName: '', variantName: undefined };
              requiredIngredients.set(ing.item_id, {
                quantity: current.quantity + (ing.quantity * bundleQty),
                productName: current.productName || `${item.product_name} (${bundleProduct.name})`,
                variantName: current.variantName
              });
            }
          }
        }
        continue;
      }

      // For regular products with variants
      if (item.product_id && item.variant_id) {
        // Get variant ingredients
        const { data: ingredientsData } = await supabaseAdmin
          .from('product_ingredients')
          .select('item_id, quantity')
          .eq('variant_id', item.variant_id);

        const { data: variantData } = await supabaseAdmin
          .from('product_variants')
          .select('name')
          .eq('id', item.variant_id)
          .single();

        if (ingredientsData && ingredientsData.length > 0) {
          for (const ing of ingredientsData) {
            const current = requiredIngredients.get(ing.item_id) || { quantity: 0, productName: '', variantName: undefined };
            requiredIngredients.set(ing.item_id, {
              quantity: current.quantity + (ing.quantity * item.quantity),
              productName: current.productName || item.product_name,
              variantName: current.variantName || variantData?.name
            });
          }
        }
      } 
      // For products without variants
      else if (item.product_id) {
        // Get product-level ingredients (not variant-specific)
        const { data: ingredientsData } = await supabaseAdmin
          .from('product_ingredients')
          .select('item_id, quantity')
          .eq('product_id', item.product_id)
          .is('variant_id', null);

        if (ingredientsData && ingredientsData.length > 0) {
          for (const ing of ingredientsData) {
            const current = requiredIngredients.get(ing.item_id) || { quantity: 0, productName: '', variantName: undefined };
            requiredIngredients.set(ing.item_id, {
              quantity: current.quantity + (ing.quantity * item.quantity),
              productName: current.productName || item.product_name,
              variantName: undefined
            });
          }
        }
      }

      // Also check product accessories (non-food items like packaging)
      if (item.product_id) {
        const { data: accessoriesData } = await supabaseAdmin
          .from('product_accessories')
          .select('item_id, quantity, applicable_order_types')
          .eq('product_id', item.product_id);

        if (accessoriesData && accessoriesData.length > 0) {
          for (const acc of accessoriesData) {
            // Filter by order type - include if 'always' or matches order type
            const applicableTypes = acc.applicable_order_types || ['always'];
            
            // Determine if this accessory should be included:
            // - Always include if 'always' is in applicable types
            // - If orderType is defined, include if it matches
            // - If orderType is undefined, only include 'always' accessories (safe default)
            const hasAlways = applicableTypes.includes('always');
            const matchesOrderType = orderType ? applicableTypes.includes(orderType) : false;
            
            if (!hasAlways && !matchesOrderType) {
              continue; // Skip this accessory - doesn't apply to this order type
            }

            const current = requiredIngredients.get(acc.item_id) || { quantity: 0, productName: '', variantName: undefined };
            requiredIngredients.set(acc.item_id, {
              quantity: current.quantity + (acc.quantity * item.quantity),
              productName: current.productName || `${item.product_name} (accessory)`,
              variantName: undefined
            });
          }
        }
      }
    }

    // Check each required ingredient against stock
    for (const [itemId, required] of requiredIngredients) {
      const itemInfo = itemInfoMap.get(itemId);
      if (!itemInfo) continue;

      const stockQty = stockMap.get(itemId) || 0;
      
      // Convert storage units to serving units for comparison
      const storageUnit = (itemInfo.storage_unit || 'grams') as StorageUnit;
      const servingUnit = (itemInfo.unit || 'grams') as ServingUnit;
      
      let availableInServingUnits: number;
      try {
        availableInServingUnits = storageToServing(stockQty, storageUnit, servingUnit);
      } catch {
        // If units are incompatible, compare directly
        availableInServingUnits = stockQty;
      }

      if (availableInServingUnits < required.quantity) {
        insufficientItems.push({
          productName: required.productName,
          variantName: required.variantName,
          ingredientName: itemInfo.name,
          required: required.quantity,
          available: availableInServingUnits,
          unit: servingUnit
        });
      }
    }

    return {
      canFulfill: insufficientItems.length === 0,
      insufficientItems
    };
  }

  /**
   * Calculate max orderable quantity for each product based on inventory
   * Returns a map of product_id -> max_quantity
   */
  async getProductAvailability(
    businessId: number,
    branchId?: number
  ): Promise<Map<number, number>> {
    console.log('[getProductAvailability] Starting for business:', businessId, 'branch:', branchId);
    const productMaxQuantities = new Map<number, number>();

    // Get all stock levels
    let stockQuery = supabaseAdmin
      .from('inventory_stock')
      .select('item_id, quantity')
      .eq('business_id', businessId);
    
    if (branchId) {
      stockQuery = stockQuery.eq('branch_id', branchId);
    }

    const { data: stockData, error: stockError } = await stockQuery;
    console.log('[getProductAvailability] Stock data:', stockData?.length, 'items, error:', stockError);
    
    // Build stock map: item_id -> quantity
    const stockMap = new Map<number, number>();
    if (stockData) {
      stockData.forEach((s: any) => {
        const currentQty = stockMap.get(s.item_id) || 0;
        stockMap.set(s.item_id, currentQty + (s.quantity || 0));
      });
    }
    console.log('[getProductAvailability] Stock map entries:', Array.from(stockMap.entries()));

    // Get item storage units
    const { data: itemsData } = await supabaseAdmin
      .from('items')
      .select('id, unit, storage_unit');
    
    const itemUnitMap = new Map<number, { unit: string; storage_unit: string }>();
    if (itemsData) {
      itemsData.forEach((item: any) => {
        itemUnitMap.set(item.id, {
          unit: item.unit || 'grams',
          storage_unit: item.storage_unit || 'grams'
        });
      });
    }

    // Get all products with their variants in a single query
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        is_active,
        has_variants,
        product_variants (id)
      `)
      .eq('business_id', businessId)
      .eq('is_active', true);

    console.log('[getProductAvailability] Products query error:', productsError);

    const variantsByProduct = new Map<number, number[]>();
    if (products) {
      products.forEach((p: any) => {
        if (p.product_variants && p.product_variants.length > 0) {
          variantsByProduct.set(p.id, p.product_variants.map((v: any) => v.id));
        }
      });
    }
    console.log('[getProductAvailability] Variants by product:', Array.from(variantsByProduct.entries()));

    // Get all product_ingredients (includes both product-level and variant-level)
    // Filter by product_ids to ensure we only get ingredients for this business's products
    const productIds = products?.map(p => p.id) || [];
    const { data: allIngredients, error: ingError } = await supabaseAdmin
      .from('product_ingredients')
      .select('product_id, variant_id, item_id, quantity')
      .in('product_id', productIds.length > 0 ? productIds : [-1]); // Use -1 as fallback to avoid empty IN clause

    console.log('[getProductAvailability] Ingredients data:', allIngredients?.length, 'items, error:', ingError);
    console.log('[getProductAvailability] Products found:', products?.length);

    // Build maps for ingredients
    const productIngredients = new Map<number, { item_id: number; quantity: number }[]>();
    const variantIngredients = new Map<number, { item_id: number; quantity: number }[]>();
    
    if (allIngredients) {
      allIngredients.forEach((ing: any) => {
        if (ing.variant_id) {
          // Variant-specific ingredient
          const existing = variantIngredients.get(ing.variant_id) || [];
          existing.push({ item_id: ing.item_id, quantity: ing.quantity });
          variantIngredients.set(ing.variant_id, existing);
        } else {
          // Product-level ingredient
          const existing = productIngredients.get(ing.product_id) || [];
          existing.push({ item_id: ing.item_id, quantity: ing.quantity });
          productIngredients.set(ing.product_id, existing);
        }
      });
    }
    
    console.log('[getProductAvailability] Product ingredients map:', Array.from(productIngredients.entries()));
    console.log('[getProductAvailability] Variant ingredients map:', Array.from(variantIngredients.entries()));

    // Calculate max quantity for each product
    if (products) {
      for (const product of products) {
        const variantIds = variantsByProduct.get(product.id) || [];
        
        console.log(`[getProductAvailability] Product ${product.id}: has_variants=${product.has_variants}, variantIds=`, variantIds);
        
        // If product has variants, calculate max for each variant
        if (product.has_variants && variantIds.length > 0) {
          let maxAcrossVariants = 0;
          
          for (const variantId of variantIds) {
            const ingredients = variantIngredients.get(variantId) || [];
            console.log(`[getProductAvailability] Variant ${variantId} ingredients:`, ingredients);
            if (ingredients.length === 0) {
              // No recipe means can't determine stock - treat as unlimited for now
              maxAcrossVariants = 999;
              continue;
            }
            
            let maxForVariant = Infinity;
            for (const ing of ingredients) {
              const itemUnits = itemUnitMap.get(ing.item_id);
              if (!itemUnits) continue;
              
              const stockQty = stockMap.get(ing.item_id) || 0;
              const storageUnit = (itemUnits.storage_unit || 'grams') as StorageUnit;
              const servingUnit = (itemUnits.unit || 'grams') as ServingUnit;
              
              let availableInServingUnits: number;
              try {
                availableInServingUnits = storageToServing(stockQty, storageUnit, servingUnit);
              } catch {
                availableInServingUnits = stockQty;
              }
              
              const maxFromIngredient = ing.quantity > 0 
                ? Math.floor(availableInServingUnits / ing.quantity) 
                : Infinity;
              maxForVariant = Math.min(maxForVariant, maxFromIngredient);
            }
            
            maxAcrossVariants = Math.max(maxAcrossVariants, maxForVariant === Infinity ? 999 : maxForVariant);
          }
          
          productMaxQuantities.set(product.id, maxAcrossVariants);
        } else {
          // Non-variant product - use product-level ingredients
          const ingredients = productIngredients.get(product.id) || [];
          if (ingredients.length === 0) {
            // No recipe means can't determine stock
            productMaxQuantities.set(product.id, 999);
            continue;
          }
          
          let maxQuantity = Infinity;
          for (const ing of ingredients) {
            const itemUnits = itemUnitMap.get(ing.item_id);
            if (!itemUnits) continue;
            
            const stockQty = stockMap.get(ing.item_id) || 0;
            const storageUnit = (itemUnits.storage_unit || 'grams') as StorageUnit;
            const servingUnit = (itemUnits.unit || 'grams') as ServingUnit;
            
            let availableInServingUnits: number;
            try {
              availableInServingUnits = storageToServing(stockQty, storageUnit, servingUnit);
            } catch {
              availableInServingUnits = stockQty;
            }
            
            const maxFromIngredient = ing.quantity > 0 
              ? Math.floor(availableInServingUnits / ing.quantity) 
              : Infinity;
            maxQuantity = Math.min(maxQuantity, maxFromIngredient);
          }
          
          productMaxQuantities.set(product.id, maxQuantity === Infinity ? 999 : maxQuantity);
        }
      }
    }

    return productMaxQuantities;
  }
  
  /**
   * Create new order
   * Works for POS terminal orders, delivery app orders, phone orders, etc.
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    // INVENTORY CHECK: Validate all items have sufficient stock before creating order
    // Also checks product accessories based on order type
    const inventoryCheck = await this.checkOrderInventory(
      input.business_id,
      input.branch_id,
      input.items,
      input.order_type as 'dine_in' | 'takeaway' | 'delivery'
    );

    if (!inventoryCheck.canFulfill) {
      const shortages = inventoryCheck.insufficientItems
        .map(item => {
          const variantInfo = item.variantName ? ` (${item.variantName})` : '';
          return `${item.productName}${variantInfo}: needs ${item.required} ${item.unit} of ${item.ingredientName}, only ${item.available.toFixed(2)} available`;
        })
        .join('; ');
      
      throw new Error(`Insufficient inventory: ${shortages}`);
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber(input.business_id);
    const displayNumber = await this.generateDisplayNumber(input.business_id);
    
    // Calculate item totals
    let subtotal = 0;
    const processedItems: Array<{
      item: CreateOrderItemInput;
      itemSubtotal: number;
      itemTotal: number;
      modifiersTotal: number;
    }> = [];

    for (const item of input.items) {
      const itemSubtotal = item.quantity * item.unit_price;
      
      // Calculate modifiers total
      let modifiersTotal = 0;
      if (item.modifiers && item.modifiers.length > 0) {
        modifiersTotal = item.modifiers.reduce((sum, mod) => {
          return sum + ((mod.quantity || 1) * mod.unit_price);
        }, 0);
      }
      
      // Apply item-level discount
      const itemDiscount = item.discount_amount || 0;
      const itemTotal = itemSubtotal + modifiersTotal - itemDiscount;
      
      subtotal += itemTotal;
      processedItems.push({ item, itemSubtotal, itemTotal, modifiersTotal });
    }
    
    // Apply order-level discount
    const discountAmount = input.discount_amount || 0;
    const afterDiscount = subtotal - discountAmount;
    
    // Add fees
    const deliveryFee = input.delivery_fee || 0;
    const packagingFee = input.packaging_fee || 0;
    const serviceCharge = input.service_charge || 0;
    const tipAmount = input.tip_amount || 0;
    
    // Get business VAT settings - ONLY apply tax if VAT is enabled
    const { data: businessData } = await supabaseAdmin
      .from('businesses')
      .select('vat_enabled, tax_rate')
      .eq('id', input.business_id)
      .single();

    // Calculate tax ONLY if VAT is enabled for this business
    const taxRate = businessData?.vat_enabled ? (businessData?.tax_rate || 0) : 0;
    const taxAmount = afterDiscount * (taxRate / 100);
    
    // Calculate total
    const total = afterDiscount + taxAmount + deliveryFee + packagingFee + serviceCharge + tipAmount;

    // Determine if this is an API order (from delivery partners)
    const isPOSOrder = ['pos', 'phone', 'walk_in'].includes(input.order_source);
    const isApiOrder = !isPOSOrder;

    // Determine initial payment status based on order source and type
    // Payment Workflow:
    // - API orders: Delivery partner handles all payments → 'app_payment'
    // - POS Delivery Partner orders: Partner handles payment → 'app_payment'
    // - POS Dine-in with pay_later: Customer pays after eating → 'pending'
    // - POS In-house Delivery with cash (own driver COD): Driver collects, hands to cashier → 'pending'
    // - All other POS orders: Payment received upfront → 'paid'
    let paymentStatus: PaymentStatus;
    
    if (isApiOrder) {
      // Delivery partner handles payment (settled weekly/monthly)
      paymentStatus = 'app_payment';
    } else if (input.order_type === 'delivery' && input.delivery_partner_id) {
      // POS Delivery Partner order (Talabat, etc.) - partner handles all payments
      paymentStatus = 'app_payment';
    } else if (input.order_type === 'dine_in' && input.is_pay_later) {
      // Dine-in pay later: customer pays after eating
      paymentStatus = 'pending';
    } else if (input.order_type === 'delivery' && input.payment_method === 'cash') {
      // In-house delivery with cash: driver collects, returns to cashier
      paymentStatus = 'pending';
    } else {
      // All other POS orders: payment upfront (cash or card)
      paymentStatus = 'paid';
    }

    // All orders start as 'in_progress' (being prepared)
    // - POS orders: in_progress → completed
    // - Delivery partner API orders: in_progress → completed (food ready) → picked_up (driver collected)
    const initialOrderStatus = 'in_progress';

    // Create order - using correct column names from existing schema
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        business_id: input.business_id,
        branch_id: input.branch_id,
        
        order_number: orderNumber,
        external_order_id: input.external_order_id,
        display_number: displayNumber,
        
        order_source: input.order_source,
        order_type: input.order_type,
        
        order_status: initialOrderStatus,  // POS = in_progress, API = pending
        
        order_date: new Date().toISOString().split('T')[0],
        order_time: new Date().toISOString().split('T')[1],
        scheduled_time: input.scheduled_time,
        
        customer_id: input.customer_id,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_email: input.customer_email,
        customer_notes: input.customer_notes,
        
        table_number: input.table_number,
        zone_area: input.zone_area,
        number_of_guests: input.number_of_guests,
        server_id: input.server_id,
        
        delivery_address: input.delivery_address,
        delivery_address_lat: input.delivery_address_lat,
        delivery_address_lng: input.delivery_address_lng,
        delivery_instructions: input.delivery_instructions,
        driver_name: input.driver_name,
        driver_phone: input.driver_phone,
        driver_id: input.driver_id,
        delivery_partner_id: input.delivery_partner_id,
        
        subtotal,
        discount_amount: discountAmount,
        discount_id: input.discount_id,
        discount_code: input.discount_code,
        discount_type: input.discount_type,
        discount_reason: input.discount_reason,
        
        tax_amount: taxAmount,  // Using existing column name
        tax_rate: taxRate,
        
        service_charge: serviceCharge,
        delivery_fee: deliveryFee,
        packaging_fee: packagingFee,
        tip_amount: tipAmount,
        
        total_amount: total,  // Using existing column name
        
        payment_method: input.payment_method,
        payment_status: paymentStatus,
        payment_reference: input.payment_reference,
        is_split_payment: false,
        
        pos_terminal_id: input.pos_terminal_id,
        pos_session_id: input.pos_session_id,
        
        created_by: input.created_by,
        cashier_id: input.cashier_id,
        
        is_rush_order: input.is_rush_order || false,
        is_void: false,
        
        internal_notes: input.internal_notes,
        external_metadata: input.external_metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create order:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }

    // OPTIMIZATION: Batch fetch all product costs from ingredients in ONE query
    const productIds = processedItems
      .map(p => p.item.product_id)
      .filter((id): id is number => id !== undefined && id !== null);
    const variantIds = processedItems
      .map(p => p.item.variant_id)
      .filter((id): id is number => id !== undefined && id !== null);
    
    const productCostsMap = new Map<number, number>();
    const variantCostsMap = new Map<number, number>();
    
    if (productIds.length > 0 || variantIds.length > 0) {
      // Get all ingredients for these products/variants
      let ingredientsQuery = supabaseAdmin
        .from('product_ingredients')
        .select('product_id, variant_id, item_id, quantity');
      
      if (productIds.length > 0) {
        ingredientsQuery = ingredientsQuery.in('product_id', productIds);
      }
      
      const { data: ingredients } = await ingredientsQuery;
      
      // Get item costs
      const itemIds = new Set<number>();
      (ingredients || []).forEach((ing: any) => itemIds.add(ing.item_id));
      
      const itemCostMap = new Map<number, number>();
      if (itemIds.size > 0) {
        // First get default costs from items table
        const { data: items } = await supabaseAdmin
          .from('items')
          .select('id, cost_per_unit')
          .in('id', Array.from(itemIds));
        
        items?.forEach((item: any) => itemCostMap.set(item.id, item.cost_per_unit || 0));
        
        // Override with business-specific prices if available
        const { data: businessPrices } = await supabaseAdmin
          .from('business_item_prices')
          .select('item_id, cost_per_unit')
          .eq('business_id', input.business_id)
          .in('item_id', Array.from(itemIds));
        
        businessPrices?.forEach((bp: any) => {
          if (bp.cost_per_unit) itemCostMap.set(bp.item_id, bp.cost_per_unit);
        });
      }
      
      // Calculate product/variant costs from ingredients
      (ingredients || []).forEach((ing: any) => {
        const itemCost = itemCostMap.get(ing.item_id) || 0;
        const ingredientCost = ing.quantity * itemCost;
        
        if (ing.variant_id) {
          // Variant-specific ingredient
          const current = variantCostsMap.get(ing.variant_id) || 0;
          variantCostsMap.set(ing.variant_id, current + ingredientCost);
        } else if (ing.product_id) {
          // Product-level ingredient (for non-variant products)
          const current = productCostsMap.get(ing.product_id) || 0;
          productCostsMap.set(ing.product_id, current + ingredientCost);
        }
      });
    }

    // OPTIMIZATION: Build all order items for batch insert
    const orderItemsToInsert = processedItems.map(({ item, itemSubtotal, itemTotal, modifiersTotal }) => {
      // Get cost: prefer variant cost, then product cost, then 0
      let unitCostAtSale = 0;
      if (item.variant_id && variantCostsMap.has(item.variant_id)) {
        unitCostAtSale = variantCostsMap.get(item.variant_id) || 0;
      } else if (item.product_id && productCostsMap.has(item.product_id)) {
        unitCostAtSale = productCostsMap.get(item.product_id) || 0;
      }
      const totalCost = unitCostAtSale * item.quantity;
      const profit = itemTotal - totalCost;
      const profitMargin = itemTotal > 0 ? (profit / itemTotal) * 100 : 0;
      
      return {
        business_id: input.business_id,
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        product_name_ar: item.product_name_ar,
        product_sku: item.product_sku,
        product_category: item.product_category,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost_at_sale: unitCostAtSale,
        total_cost: totalCost,
        profit: profit,
        profit_margin: Math.round(profitMargin * 100) / 100,
        discount_amount: item.discount_amount || 0,
        discount_percentage: item.discount_percentage || 0,
        subtotal: itemSubtotal,
        total: itemTotal,
        has_modifiers: (item.modifiers && item.modifiers.length > 0) || false,
        modifiers_total: modifiersTotal,
        special_instructions: item.special_instructions,
        item_status: 'pending',
        is_combo: item.is_combo || false,
        combo_id: item.combo_id,
        is_void: false,
      };
    });

    // OPTIMIZATION: Single batch insert for all order items
    const { data: insertedItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsToInsert)
      .select();

    if (itemsError) {
      console.error('Failed to create order items:', itemsError);
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // OPTIMIZATION: Batch insert all modifiers
    const allModifiersToInsert: Array<{
      order_item_id: number;
      modifier_id?: number;
      modifier_group_id?: number;
      modifier_name: string;
      modifier_name_ar?: string;
      quantity: number;
      unit_price: number;
      total: number;
      modifier_type?: string;
    }> = [];

    // Map inserted items back to their modifiers
    processedItems.forEach(({ item }, index) => {
      const orderItem = insertedItems[index];
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modQuantity = mod.quantity || 1;
          const modTotal = modQuantity * mod.unit_price;
          allModifiersToInsert.push({
            order_item_id: orderItem.id,
            modifier_id: mod.modifier_id,
            modifier_group_id: mod.modifier_group_id,
            modifier_name: mod.modifier_name,
            modifier_name_ar: mod.modifier_name_ar,
            quantity: modQuantity,
            unit_price: mod.unit_price,
            total: modTotal,
            modifier_type: mod.modifier_type,
          });
        }
      }
    });

    // Single batch insert for all modifiers
    let insertedModifiers: OrderItemModifier[] = [];
    if (allModifiersToInsert.length > 0) {
      const { data: modifiers, error: modsError } = await supabaseAdmin
        .from('order_item_modifiers')
        .insert(allModifiersToInsert)
        .select();

      if (modsError) {
        console.error('Failed to create order item modifiers:', modsError);
      } else {
        insertedModifiers = modifiers as OrderItemModifier[];
      }
    }

    // Build final orderItems with their modifiers
    const orderItems: OrderItem[] = insertedItems.map((orderItem, index) => {
      const itemModifiers = insertedModifiers.filter(m => m.order_item_id === orderItem.id);
      return {
        ...orderItem,
        modifiers: itemModifiers,
      } as OrderItem;
    });

    // OPTIMIZATION: Fire-and-forget inventory reservation (non-blocking)
    // Doesn't affect order creation - run in background
    const itemsForReservation = orderItems.map(oi => ({
      product_id: oi.product_id,
      variant_id: (oi as any).variant_id,
      quantity: oi.quantity,
      product_name: oi.product_name,
    }));
    
    inventoryStockService.reserveForOrder(
      input.business_id,
      input.branch_id,
      itemsForReservation,
      order.id,
      input.created_by
    ).catch(err => console.error('Failed to reserve ingredients:', err));

    // OPTIMIZATION: Fire-and-forget logging (non-blocking)
    // These don't affect order creation - run them in background
    orderTimelineService.logOrderCreated(order.id, {
      order_number: orderNumber,
      order_source: input.order_source,
      order_type: input.order_type,
      items_count: orderItems.length,
      total_amount: total,
      customer_name: input.customer_name,
    }, input.created_by).catch(err => console.error('Failed to log timeline:', err));
    
    this.logStatusChange(order.id, undefined, initialOrderStatus, input.created_by, 'Order created')
      .catch(err => console.error('Failed to log status change:', err));

    return {
      ...order,
      items: orderItems,
    } as Order;
  }

  /**
   * Create order from delivery app webhook
   */
  async createDeliveryAppOrder(
    source: OrderSource,
    externalOrderId: string,
    businessId: number,
    branchId: number | undefined,
    orderData: {
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      delivery_address?: string;
      delivery_instructions?: string;
      driver_name?: string;
      driver_phone?: string;
      driver_id?: string;
      items: CreateOrderItemInput[];
      delivery_fee?: number;
      discount_amount?: number;
      total?: number;
      external_metadata?: Record<string, unknown>;
    },
    createdBy: number
  ): Promise<Order> {
    return this.createOrder({
      business_id: businessId,
      branch_id: branchId,
      order_source: source,
      order_type: 'delivery',
      external_order_id: externalOrderId,
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      customer_email: orderData.customer_email,
      delivery_address: orderData.delivery_address,
      delivery_instructions: orderData.delivery_instructions,
      driver_name: orderData.driver_name,
      driver_phone: orderData.driver_phone,
      driver_id: orderData.driver_id,
      items: orderData.items,
      delivery_fee: orderData.delivery_fee,
      discount_amount: orderData.discount_amount,
      external_metadata: orderData.external_metadata,
      created_by: createdBy,
    });
  }

  /**
   * Get orders by business with filters
   * Supports pagination with page and limit options
   */
  async getOrders(businessId: number, filters?: {
    branch_id?: number;
    status?: OrderStatus | OrderStatus[];
    order_source?: OrderSource | OrderSource[];
    order_type?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
    customer_phone?: string;
    external_order_id?: string;
    page?: number;
    limit?: number;
    fields?: string[];
  }): Promise<Order[] | { data: Order[]; total: number }> {
    const { page, limit, fields } = filters || {};
    
    let query = supabaseAdmin
      .from('orders')
      .select('*, order_items(*, order_item_modifiers(*))', { count: page && limit ? 'exact' : undefined })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.branch_id) {
      query = query.eq('branch_id', filters.branch_id);
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('order_status', filters.status);  // Using existing column name
      } else {
        query = query.eq('order_status', filters.status);  // Using existing column name
      }
    }
    if (filters?.order_source) {
      if (Array.isArray(filters.order_source)) {
        query = query.in('order_source', filters.order_source);
      } else {
        query = query.eq('order_source', filters.order_source);
      }
    }
    if (filters?.order_type) {
      query = query.eq('order_type', filters.order_type);
    }
    if (filters?.date) {
      query = query.eq('order_date', filters.date);
    }
    if (filters?.date_from) {
      query = query.gte('order_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('order_date', filters.date_to);
    }
    if (filters?.customer_phone) {
      query = query.eq('customer_phone', filters.customer_phone);
    }
    if (filters?.external_order_id) {
      query = query.eq('external_order_id', filters.external_order_id);
    }

    // Apply pagination if provided
    if (page && limit) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch orders: ${error.message}`);
    
    // Return paginated response if pagination was requested
    if (page && limit && count !== null) {
      return {
        data: data as Order[],
        total: count,
      };
    }

    return data as Order[];
  }

  /**
   * Get order list stats for filters (without pagination)
   * Used to get accurate stats when paginating order lists
   * Calculates total_profit = items_profit - delivery_partner_commission
   */
  async getOrderListStats(businessId: number, filters?: {
    branch_id?: number;
    status?: OrderStatus | OrderStatus[];
    order_source?: OrderSource | OrderSource[];
    order_type?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
    customer_phone?: string;
    external_order_id?: string;
  }): Promise<{
    total_orders: number;
    completed_orders: number;
    in_progress_orders: number;
    total_revenue: number;
    total_profit: number;
  }> {
    // Get orders with items profit and delivery partner info
    let query = supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_status,
        total_amount,
        delivery_partner_id,
        delivery_partners (
          commission_type,
          commission_value
        ),
        order_items (
          profit
        )
      `)
      .eq('business_id', businessId);

    // Apply same filters as getOrders
    if (filters?.branch_id) {
      query = query.eq('branch_id', filters.branch_id);
    }
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('order_status', filters.status);
      } else {
        query = query.eq('order_status', filters.status);
      }
    }
    if (filters?.order_source) {
      if (Array.isArray(filters.order_source)) {
        query = query.in('order_source', filters.order_source);
      } else {
        query = query.eq('order_source', filters.order_source);
      }
    }
    if (filters?.order_type) {
      query = query.eq('order_type', filters.order_type);
    }
    if (filters?.date) {
      query = query.eq('order_date', filters.date);
    }
    if (filters?.date_from) {
      query = query.gte('order_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('order_date', filters.date_to);
    }
    if (filters?.customer_phone) {
      query = query.eq('customer_phone', filters.customer_phone);
    }
    if (filters?.external_order_id) {
      query = query.eq('external_order_id', filters.external_order_id);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch order stats: ${error.message}`);

    const orders = data || [];
    const completedOrders = orders.filter(o => o.order_status === 'completed');
    const inProgressOrders = orders.filter(o => o.order_status === 'in_progress' || o.order_status === 'pending');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

    // Calculate total profit: sum of item profits minus delivery partner commissions
    let totalProfit = 0;
    for (const order of completedOrders) {
      // Sum item profits for this order
      const itemsProfit = (order.order_items || []).reduce(
        (sum: number, item: any) => sum + parseFloat(item.profit || '0'), 
        0
      );
      
      // Calculate delivery partner commission (if applicable)
      let commission = 0;
      const partner = order.delivery_partners as any;
      if (partner && order.delivery_partner_id) {
        const orderTotal = parseFloat(order.total_amount || '0');
        if (partner.commission_type === 'percentage') {
          commission = orderTotal * (parseFloat(partner.commission_value || '0') / 100);
        } else if (partner.commission_type === 'fixed') {
          commission = parseFloat(partner.commission_value || '0');
        }
      }
      
      // Order profit = items profit - commission
      totalProfit += (itemsProfit - commission);
    }

    return {
      total_orders: orders.length,
      completed_orders: completedOrders.length,
      in_progress_orders: inProgressOrders.length,
      total_revenue: totalRevenue,
      total_profit: totalProfit,
    };
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: number): Promise<Order | null> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, order_item_modifiers(*))')
      .eq('id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
    
    return data as Order;
  }

  /**
   * Get order by external ID (for delivery apps)
   */
  async getOrderByExternalId(businessId: number, externalOrderId: string): Promise<Order | null> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, order_item_modifiers(*))')
      .eq('business_id', businessId)
      .eq('external_order_id', externalOrderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
    
    return data as Order;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: number, 
    status: OrderStatus, 
    changedBy?: number,
    reason?: string
  ): Promise<Order> {
    // Get current order for status history
    const currentOrder = await this.getOrderById(orderId);
    if (!currentOrder) throw new Error('Order not found');

    const updateData: Record<string, unknown> = { 
      order_status: status,  // Using existing column name
      updated_by: changedBy,
    };
    
    // Handle specific status updates
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = changedBy;
      updateData.cancellation_reason = reason;
    }
    if (status === 'rejected') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = changedBy;
      updateData.cancellation_reason = reason || 'Order rejected';
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select('*, order_items(*, order_item_modifiers(*))')
      .single();

    if (error) throw new Error(`Failed to update order: ${error.message}`);

    // Log status change
    await this.logStatusChange(orderId, currentOrder.order_status as OrderStatus, status, changedBy, reason);

    return data as Order;
  }

  /**
   * Accept an API order (pending → in_progress)
   * Only applicable for orders with status 'pending' from delivery partner APIs
   */
  async acceptOrder(orderId: number, acceptedBy: number): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    
    if (order.order_status !== 'pending') {
      throw new Error(`Cannot accept order: order is not in pending status (current: ${order.order_status})`);
    }

    return this.updateOrderStatus(orderId, 'in_progress', acceptedBy, 'Order accepted');
  }

  /**
   * Reject an API order (pending → rejected)
   * Only applicable for orders with status 'pending' from delivery partner APIs
   */
  async rejectOrder(orderId: number, rejectedBy: number, reason?: string): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    
    if (order.order_status !== 'pending') {
      throw new Error(`Cannot reject order: order is not in pending status (current: ${order.order_status})`);
    }

    return this.updateOrderStatus(orderId, 'rejected', rejectedBy, reason || 'Order rejected by store');
  }

  /**
   * Complete an order (in_progress → completed)
   * Kitchen marks food as ready
   * For delivery orders, this means "ready for pickup" - driver still needs to collect
   * Consumes inventory for all items in the order
   */
  async completeOrder(orderId: number, completedBy: number): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    
    if (order.order_status !== 'in_progress') {
      throw new Error(`Cannot complete order: order is not in progress (current: ${order.order_status})`);
    }

    // Consume inventory for all items
    // Note: Supabase returns order_items, not items
    const orderItems = (order as any).order_items || [];
    try {
      const itemsForConsumption = orderItems.map((oi: any) => ({
        product_id: oi.product_id,
        variant_id: oi.variant_id,
        quantity: oi.quantity,
        product_name: oi.product_name,
        // Include modifiers for inventory adjustment (extras/removals)
        modifiers: (oi.order_item_modifiers || []).map((mod: any) => ({
          modifier_id: mod.modifier_id,
          modifier_name: mod.modifier_name,
          modifier_type: mod.modifier_type, // 'extra' or 'removal'
          quantity: mod.quantity || 1,
        })),
      }));
      
      await inventoryStockService.consumeForOrder(
        order.business_id,
        order.branch_id,
        itemsForConsumption,
        orderId,
        completedBy,
        order.order_number
      );
    } catch (consumeError) {
      console.error('Failed to consume inventory:', consumeError);
      // Log but don't fail - inventory can be adjusted manually
    }

    // Log timeline event
    try {
      await orderTimelineService.logOrderCompleted(orderId, {
        completed_by_kitchen: true,
        items_completed: orderItems.length,
      }, completedBy);
    } catch (timelineError) {
      console.error('Failed to log timeline:', timelineError);
    }

    return this.updateOrderStatus(orderId, 'completed', completedBy);
  }

  /**
   * Mark a delivery order as picked up (completed → picked_up)
   * POS marks order when delivery driver has collected the food
   * Only applicable for delivery orders from delivery partner APIs
   */
  async pickupOrder(orderId: number, pickedUpBy: number): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    
    // Only delivery orders can be marked as picked up
    if (order.order_type !== 'delivery') {
      throw new Error('Only delivery orders can be marked as picked up');
    }

    // Order must be completed (food ready) before it can be picked up
    if (order.order_status !== 'completed') {
      throw new Error(`Cannot mark order as picked up: order must be completed first (current: ${order.order_status})`);
    }

    // Log timeline event
    try {
      await orderTimelineService.logStatusChanged(
        orderId,
        'completed',
        'picked_up',
        'Delivery driver picked up the order',
        pickedUpBy
      );
    } catch (timelineError) {
      console.error('Failed to log timeline:', timelineError);
    }

    return this.updateOrderStatus(orderId, 'picked_up', pickedUpBy, 'Order picked up by driver');
  }

  /**
   * Cancel an order (in_progress → cancelled)
   * Releases reserved ingredients immediately and creates queue for kitchen to decide waste vs return
   */
  async cancelOrder(orderId: number, cancelledBy: number, reason?: string): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    
    if (order.order_status !== 'in_progress' && order.order_status !== 'pending') {
      throw new Error(`Cannot cancel order: order must be pending or in progress (current: ${order.order_status})`);
    }

    // Calculate ingredients and handle reservation + cancellation queue
    // Note: Supabase returns order_items, not items
    const orderItems = (order as any).order_items || [];
    try {
      const itemsForCancellation = orderItems.map((oi: any) => ({
        product_id: oi.product_id,
        variant_id: oi.variant_id,
        quantity: oi.quantity,
        product_name: oi.product_name,
      }));
      
      // Calculate ingredients
      const ingredients = await inventoryStockService.calculateOrderIngredients(
        order.business_id,
        itemsForCancellation
      );

      // IMMEDIATELY release all reservations to free up inventory
      // Kitchen will later decide if items should be wasted (deducted from actual stock)
      await inventoryStockService.releaseReservation(
        order.business_id,
        order.branch_id,
        ingredients.map(ing => ({
          item_id: ing.item_id,
          quantity_in_storage: ing.quantity_in_storage,
          item_name: ing.item_name,
        })),
        orderId,
        cancelledBy,
        `Order #${orderId} cancelled - reservation released`
      );

      // Create cancellation queue entries for kitchen to decide waste vs return
      for (const ing of ingredients) {
        await supabaseAdmin
          .from('cancelled_order_items')
          .insert({
            order_id: orderId,
            item_id: ing.item_id,
            product_id: ing.product_id,
            product_name: ing.product_name,
            quantity: ing.quantity_in_storage,
            unit: ing.storage_unit,
            decision: null, // Kitchen will decide: waste (deduct stock) or return (do nothing)
          });
      }
    } catch (cancelError) {
      console.error('Failed to process cancellation:', cancelError);
    }

    // Log timeline event
    try {
      await orderTimelineService.logOrderCancelled(orderId, reason || 'Order cancelled', cancelledBy);
    } catch (timelineError) {
      console.error('Failed to log timeline:', timelineError);
    }

    return this.updateOrderStatus(orderId, 'cancelled', cancelledBy, reason || 'Order cancelled');
  }

  /**
   * Process payment for order
   * For cash payments: tracks amount_received and change_given for cash drawer reconciliation
   */
  async processPayment(
    orderId: number,
    paymentMethod: string,
    amount: number,
    reference?: string,
    processedBy?: number,
    cashDetails?: { amount_received: number; change_given: number },
    posSessionId?: number
  ): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    // Create payment record with cash details if provided
    await supabaseAdmin
      .from('order_payments')
      .insert({
        order_id: orderId,
        payment_method: paymentMethod,
        amount,
        payment_reference: reference,
        status: 'paid',
        paid_at: new Date().toISOString(),
        processed_by: processedBy,
        // Cash-specific fields for drawer reconciliation
        amount_received: cashDetails?.amount_received,
        change_given: cashDetails?.change_given,
        // Link to POS session for shift tracking
        pos_session_id: posSessionId,
      });

    // Update order payment status
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        payment_method: paymentMethod,
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        payment_reference: reference,
        cashier_id: processedBy,
        pos_session_id: posSessionId,
      })
      .eq('id', orderId)
      .select('*, order_items(*, order_item_modifiers(*))')
      .single();

    if (error) throw new Error(`Failed to process payment: ${error.message}`);

    return data as Order;
  }

  /**
   * Void order
   */
  async voidOrder(orderId: number, reason: string, voidedBy: number): Promise<Order> {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        is_void: true,
        void_reason: reason,
        void_at: new Date().toISOString(),
        voided_by: voidedBy,
        order_status: 'cancelled',  // Using existing column name
      })
      .eq('id', orderId)
      .select('*, order_items(*, order_item_modifiers(*))')
      .single();

    if (error) throw new Error(`Failed to void order: ${error.message}`);

    await this.logStatusChange(orderId, undefined, 'cancelled', voidedBy, `Voided: ${reason}`);

    return data as Order;
  }

  /**
   * Refund order
   */
  async refundOrder(
    orderId: number, 
    refundAmount: number, 
    reason: string,
    refundReference?: string,
    processedBy?: number
  ): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const isPartialRefund = refundAmount < (order.total_amount || order.total || 0);
    
    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({
        refund_amount: refundAmount,
        refunded_at: new Date().toISOString(),
        refund_reference: refundReference,
        payment_status: isPartialRefund ? 'partial_refund' : 'refunded',
        order_status: 'refunded',  // Using existing column name
        cancellation_reason: reason,
      })
      .eq('id', orderId)
      .select('*, order_items(*, order_item_modifiers(*))')
      .single();

    if (error) throw new Error(`Failed to refund order: ${error.message}`);

    await this.logStatusChange(orderId, order.order_status as OrderStatus, 'completed', processedBy, `Refund processed: ${reason}`);

    return data as Order;
  }

  /**
   * Get order statistics for a date range
   */
  async getOrderStats(businessId: number, dateFrom: string, dateTo: string, branchId?: number): Promise<{
    total_orders: number;
    total_revenue: number;
    average_order_value: number;
    orders_by_source: Record<string, number>;
    orders_by_type: Record<string, number>;
    orders_by_status: Record<string, number>;
  }> {
    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_void', false)
      .gte('order_date', dateFrom)
      .lte('order_date', dateTo);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch order stats: ${error.message}`);

    const orders = data || [];
    const completedOrders = orders.filter(o => o.order_status === 'completed');
    
    const totalRevenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    const ordersBySource: Record<string, number> = {};
    const ordersByType: Record<string, number> = {};
    const ordersByStatus: Record<string, number> = {};

    orders.forEach(order => {
      ordersBySource[order.order_source || 'pos'] = (ordersBySource[order.order_source || 'pos'] || 0) + 1;
      ordersByType[order.order_type || 'dine_in'] = (ordersByType[order.order_type || 'dine_in'] || 0) + 1;
      ordersByStatus[order.order_status || 'pending'] = (ordersByStatus[order.order_status || 'pending'] || 0) + 1;
    });

    return {
      total_orders: orders.length,
      total_revenue: totalRevenue,
      average_order_value: avgOrderValue,
      orders_by_source: ordersBySource,
      orders_by_type: ordersByType,
      orders_by_status: ordersByStatus,
    };
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(businessId: number): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const { count } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', `${new Date().toISOString().slice(0, 10)}T00:00:00`);

    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `ORD-${today}-${sequence}`;
  }

  /**
   * Generate display number (short number for customer/kitchen)
   */
  private async generateDisplayNumber(businessId: number): Promise<string> {
    const { count } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', `${new Date().toISOString().slice(0, 10)}T00:00:00`);

    const num = ((count || 0) % 999) + 1;
    return `#${num}`;
  }

  /**
   * Log order status change for audit trail
   */
  private async logStatusChange(
    orderId: number,
    fromStatus: OrderStatus | undefined,
    toStatus: OrderStatus,
    changedBy?: number,
    reason?: string
  ): Promise<void> {
    await supabaseAdmin
      .from('order_status_history')
      .insert({
        order_id: orderId,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: changedBy,
        change_reason: reason,
      });
  }

  /**
   * Calculate order totals from cart items
   * This should be used by frontends instead of calculating on client-side
   */
  async calculateOrderTotals(
    businessId: number,
    items: Array<{
      product_id?: number;
      bundle_id?: number;
      variant_id?: number;
      quantity: number;
      modifiers?: Array<{
        modifier_id?: number;
        extra_price: number;
        quantity: number;
      }>;
    }>,
    options?: {
      discount_type?: 'percentage' | 'fixed';
      discount_value?: number;
      delivery_fee?: number;
      packaging_fee?: number;
      service_charge?: number;
      tip_amount?: number;
    }
  ): Promise<{
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    delivery_fee: number;
    packaging_fee: number;
    service_charge: number;
    tip_amount: number;
    total: number;
    items: Array<{
      product_id?: number;
      bundle_id?: number;
      unit_price: number;
      quantity: number;
      item_total: number;
    }>;
  }> {
    // Get business settings for tax rate
    const { data: businessData } = await supabaseAdmin
      .from('businesses')
      .select('vat_enabled, tax_rate')
      .eq('id', businessId)
      .single();

    const taxRate = businessData?.vat_enabled ? (businessData?.tax_rate || 0) : 0;

    // Get product prices
    const productIds = items.filter(i => i.product_id).map(i => i.product_id!);
    const bundleIds = items.filter(i => i.bundle_id).map(i => i.bundle_id!);
    const variantIds = items.filter(i => i.variant_id).map(i => i.variant_id!);

    // Fetch product prices
    const productPriceMap = new Map<number, number>();
    if (productIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, price')
        .in('id', productIds);
      
      products?.forEach(p => productPriceMap.set(p.id, p.price));
    }

    // Fetch variant price adjustments
    const variantAdjustmentMap = new Map<number, number>();
    if (variantIds.length > 0) {
      const { data: variants } = await supabaseAdmin
        .from('product_variants')
        .select('id, product_id, price_adjustment')
        .in('id', variantIds);
      
      variants?.forEach(v => variantAdjustmentMap.set(v.id, v.price_adjustment || 0));
    }

    // Fetch bundle prices
    const bundlePriceMap = new Map<number, number>();
    if (bundleIds.length > 0) {
      const { data: bundles } = await supabaseAdmin
        .from('bundles')
        .select('id, price')
        .in('id', bundleIds);
      
      bundles?.forEach(b => bundlePriceMap.set(b.id, b.price));
    }

    // Calculate each item's price
    const calculatedItems = items.map(item => {
      let unitPrice = 0;

      if (item.bundle_id) {
        unitPrice = bundlePriceMap.get(item.bundle_id) || 0;
      } else if (item.product_id) {
        unitPrice = productPriceMap.get(item.product_id) || 0;
        
        // Add variant adjustment if applicable
        if (item.variant_id) {
          unitPrice += variantAdjustmentMap.get(item.variant_id) || 0;
        }
      }

      // Add modifier prices
      if (item.modifiers) {
        for (const mod of item.modifiers) {
          unitPrice += (mod.extra_price || 0) * (mod.quantity || 1);
        }
      }

      const itemTotal = unitPrice * item.quantity;

      return {
        product_id: item.product_id,
        bundle_id: item.bundle_id,
        unit_price: unitPrice,
        quantity: item.quantity,
        item_total: itemTotal,
      };
    });

    // Calculate subtotal
    const subtotal = calculatedItems.reduce((sum, item) => sum + item.item_total, 0);

    // Calculate discount
    let discountAmount = 0;
    if (options?.discount_value && options.discount_value > 0) {
      if (options.discount_type === 'percentage') {
        discountAmount = subtotal * (options.discount_value / 100);
      } else {
        discountAmount = options.discount_value;
      }
    }

    // Calculate tax on subtotal after discount
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (taxRate / 100);

    // Get fees
    const deliveryFee = options?.delivery_fee || 0;
    const packagingFee = options?.packaging_fee || 0;
    const serviceCharge = options?.service_charge || 0;
    const tipAmount = options?.tip_amount || 0;

    // Calculate total
    const total = taxableAmount + taxAmount + deliveryFee + packagingFee + serviceCharge + tipAmount;

    return {
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      delivery_fee: deliveryFee,
      packaging_fee: packagingFee,
      service_charge: serviceCharge,
      tip_amount: tipAmount,
      total,
      items: calculatedItems,
    };
  }

  /**
   * Calculate delivery margin after commission
   * @param price - Product selling price
   * @param cost - Product cost
   * @param commissionType - 'percentage' or 'fixed'
   * @param commissionValue - Commission amount or percentage
   */
  calculateDeliveryMargin(
    price: number,
    cost: number,
    commissionType: 'percentage' | 'fixed',
    commissionValue: number
  ): number {
    if (price <= 0) return 0;
    const commission = commissionType === 'percentage'
      ? price * (commissionValue / 100)
      : commissionValue;
    return ((price - cost - commission) / price) * 100;
  }

  // ==================== ORDER EDITING (POS ONLY) ====================

  /**
   * Edit an order (POS orders only)
   * Handles adding, removing, and modifying items
   * Updates inventory reservations accordingly
   */
  async editOrder(
    orderId: number,
    updates: {
      items_to_add?: CreateOrderItemInput[];
      items_to_remove?: number[];           // order_item_ids to remove
      items_to_modify?: Array<{
        order_item_id: number;
        quantity?: number;
        modifiers?: Array<{
          modifier_id: number;
          quantity: number;
          modifier_name: string;
          unit_price: number;
          modifier_type: 'extra' | 'removal';
        }>;
      }>;
    },
    editedBy: number
  ): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    // Only POS orders can be edited for items
    if (order.order_source !== 'pos') {
      throw new Error('Only POS orders can have items edited');
    }

    // Can only edit pending or in_progress orders
    if (!['pending', 'in_progress'].includes(order.order_status || '')) {
      throw new Error(`Cannot edit order: order must be pending or in progress (current: ${order.order_status})`);
    }

    const previousTotal = parseFloat(String(order.total_amount || order.total || 0));
    let totalChange = 0;

    // Note: Supabase returns order_items, not items
    const orderItems = (order as any).order_items || [];

    // Handle items to remove
    if (updates.items_to_remove && updates.items_to_remove.length > 0) {
      for (const orderItemId of updates.items_to_remove) {
        const orderItem = orderItems.find((oi: any) => oi.id === orderItemId);
        if (!orderItem) continue;

        // Calculate ingredients for removed item
        const itemsForCancellation = [{
          product_id: orderItem.product_id,
          variant_id: orderItem.variant_id,
          quantity: orderItem.quantity,
          product_name: orderItem.product_name,
        }];

        const ingredients = await inventoryStockService.calculateOrderIngredients(
          order.business_id,
          itemsForCancellation
        );

        // IMMEDIATELY release reservations for removed items
        await inventoryStockService.releaseReservation(
          order.business_id,
          order.branch_id,
          ingredients.map(ing => ({
            item_id: ing.item_id,
            quantity_in_storage: ing.quantity_in_storage,
            item_name: ing.item_name,
          })),
          orderId,
          editedBy,
          `Item removed from order #${orderId}`
        );

        // Create cancellation queue for kitchen to decide waste vs no-action
        for (const ing of ingredients) {
          await supabaseAdmin
            .from('cancelled_order_items')
            .insert({
              order_id: orderId,
              order_item_id: orderItemId,
              item_id: ing.item_id,
              product_id: ing.product_id,
              product_name: ing.product_name,
              quantity: ing.quantity_in_storage,
              unit: ing.storage_unit,
              decision: null,
            });
        }

        // Subtract from total
        totalChange -= parseFloat(String(orderItem.total || 0));

        // Log timeline
        await orderTimelineService.logItemRemoved(orderId, {
          product_id: orderItem.product_id!,
          product_name: orderItem.product_name,
          quantity: orderItem.quantity,
        }, editedBy);

        // Delete the order item
        await supabaseAdmin
          .from('order_items')
          .delete()
          .eq('id', orderItemId);
      }
    }

    // Handle items to add
    if (updates.items_to_add && updates.items_to_add.length > 0) {
      for (const newItem of updates.items_to_add) {
        // Get product details
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('*')
          .eq('id', newItem.product_id)
          .single();

        if (!product) continue;

        // Calculate price
        let unitPrice = product.price || 0;
        if (newItem.variant_id) {
          const { data: variant } = await supabaseAdmin
            .from('product_variants')
            .select('*')
            .eq('id', newItem.variant_id)
            .single();
          if (variant) unitPrice = variant.price || unitPrice;
        }

        const itemTotal = unitPrice * newItem.quantity;
        totalChange += itemTotal;

        // Create order item
        const { data: orderItem, error } = await supabaseAdmin
          .from('order_items')
          .insert({
            order_id: orderId,
            product_id: newItem.product_id,
            variant_id: newItem.variant_id,
            product_name: newItem.product_name || product.name,
            product_sku: product.sku,
            quantity: newItem.quantity,
            original_quantity: newItem.quantity,
            unit_price: unitPrice,
            subtotal: itemTotal,
            total: itemTotal,
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to add order item:', error);
          continue;
        }

        // Reserve ingredients for new item
        await inventoryStockService.reserveForOrder(
          order.business_id,
          order.branch_id,
          [{
            product_id: newItem.product_id,
            variant_id: newItem.variant_id,
            quantity: newItem.quantity,
            product_name: newItem.product_name || product.name,
          }],
          orderId,
          editedBy
        );

        // Log timeline
        await orderTimelineService.logItemAdded(orderId, {
          product_id: newItem.product_id || 0,
          product_name: newItem.product_name || product.name,
          quantity: newItem.quantity,
          unit_price: unitPrice,
          variant_id: newItem.variant_id,
        }, editedBy);
      }
    }

    // Handle item modifications (quantity changes and modifier changes)
    if (updates.items_to_modify && updates.items_to_modify.length > 0) {
      for (const mod of updates.items_to_modify) {
        const orderItem = orderItems.find((oi: any) => oi.id === mod.order_item_id);
        if (!orderItem) continue;

        // Handle quantity changes
        if (mod.quantity !== undefined && mod.quantity !== orderItem.quantity) {
          const qtyDiff = mod.quantity - orderItem.quantity;
          const unitPrice = parseFloat(String(orderItem.unit_price || 0));
          const priceChange = qtyDiff * unitPrice;
          totalChange += priceChange;

          if (qtyDiff > 0) {
            // Reserve additional ingredients
            await inventoryStockService.reserveForOrder(
              order.business_id,
              order.branch_id,
              [{
                product_id: orderItem.product_id,
                variant_id: orderItem.variant_id,
                quantity: qtyDiff,
                product_name: orderItem.product_name,
              }],
              orderId,
              editedBy
            );
          } else {
            // Quantity reduced - calculate ingredients for the reduced amount
            const ingredients = await inventoryStockService.calculateOrderIngredients(
              order.business_id,
              [{
                product_id: orderItem.product_id,
                variant_id: orderItem.variant_id,
                quantity: Math.abs(qtyDiff),
                product_name: orderItem.product_name,
              }]
            );

            // IMMEDIATELY release reservations for reduced quantity
            await inventoryStockService.releaseReservation(
              order.business_id,
              order.branch_id,
              ingredients.map(ing => ({
                item_id: ing.item_id,
                quantity_in_storage: ing.quantity_in_storage,
                item_name: ing.item_name,
              })),
              orderId,
              editedBy,
              `Quantity reduced in order #${orderId}`
            );

            // Create cancellation entries for kitchen to decide waste vs no-action
            for (const ing of ingredients) {
              await supabaseAdmin
                .from('cancelled_order_items')
                .insert({
                  order_id: orderId,
                  order_item_id: mod.order_item_id,
                  item_id: ing.item_id,
                  product_id: ing.product_id,
                  product_name: ing.product_name,
                  quantity: ing.quantity_in_storage,
                  unit: ing.storage_unit,
                  decision: null,
                });
            }
          }

          // Update order item quantity
          await supabaseAdmin
            .from('order_items')
            .update({
              quantity: mod.quantity,
              subtotal: unitPrice * mod.quantity,
              total: unitPrice * mod.quantity,
            })
            .eq('id', mod.order_item_id);

          // Log timeline
          await orderTimelineService.logItemModified(orderId, {
            product_id: orderItem.product_id!,
            product_name: orderItem.product_name,
            changes: [{
              field: 'quantity',
              from: orderItem.quantity,
              to: mod.quantity,
            }],
            price_difference: priceChange,
          }, editedBy);
        }

        // Handle modifier changes
        if (mod.modifiers !== undefined) {
          // Get current modifiers for this item
          const { data: currentModifiers } = await supabaseAdmin
            .from('order_item_modifiers')
            .select('*')
            .eq('order_item_id', mod.order_item_id);

          const currentMods = currentModifiers || [];
          
          // Calculate old modifiers total
          const oldModifiersTotal = currentMods
            .filter((m: any) => m.modifier_type === 'extra')
            .reduce((sum: number, m: any) => sum + (parseFloat(m.unit_price || 0) * (m.quantity || 1)), 0);

          // Delete existing modifiers for this item
          await supabaseAdmin
            .from('order_item_modifiers')
            .delete()
            .eq('order_item_id', mod.order_item_id);

          // Insert new modifiers
          let newModifiersTotal = 0;
          const modifierNames: string[] = [];
          
          for (const newMod of mod.modifiers) {
            const modTotal = (newMod.unit_price || 0) * (newMod.quantity || 1);
            
            await supabaseAdmin
              .from('order_item_modifiers')
              .insert({
                order_item_id: mod.order_item_id,
                modifier_name: newMod.modifier_name,
                quantity: newMod.quantity || 1,
                unit_price: newMod.unit_price || 0,
                total: modTotal,
                modifier_type: newMod.modifier_type,
              });

            if (newMod.modifier_type === 'extra') {
              newModifiersTotal += modTotal;
              modifierNames.push(`+${newMod.modifier_name}`);
            } else if (newMod.modifier_type === 'removal') {
              modifierNames.push(`No ${newMod.modifier_name}`);
            }
          }

          // Calculate modifier price difference
          const modifierPriceDiff = newModifiersTotal - oldModifiersTotal;
          totalChange += modifierPriceDiff;

          // Update order item with new modifiers total
          const unitPrice = parseFloat(String(orderItem.unit_price || 0));
          const quantity = orderItem.quantity || 1;
          const newSubtotal = unitPrice * quantity;
          const newTotal = newSubtotal + newModifiersTotal;
          
          // Build special instructions string
          const specialInstructions = modifierNames.join(', ') || null;

          await supabaseAdmin
            .from('order_items')
            .update({
              modifiers_total: newModifiersTotal,
              has_modifiers: mod.modifiers.length > 0,
              subtotal: newSubtotal,
              total: newTotal,
              special_instructions: specialInstructions,
            })
            .eq('id', mod.order_item_id);

          // Log timeline for modifier changes
          if (modifierPriceDiff !== 0 || mod.modifiers.length !== currentMods.length) {
            await orderTimelineService.logItemModified(orderId, {
              product_id: orderItem.product_id!,
              product_name: orderItem.product_name,
              changes: [{
                field: 'modifiers',
                from: currentMods.map((m: any) => m.modifier_name).join(', ') || 'none',
                to: modifierNames.join(', ') || 'none',
              }],
              price_difference: modifierPriceDiff,
            }, editedBy);
          }
        }
      }
    }

    // Update order totals and is_edited flag
    const newTotal = previousTotal + totalChange;
    const paidAmount = parseFloat(String((order as any).paid_amount || previousTotal));
    let remainingAmount = 0;
    let paymentStatus = order.payment_status;

    if (newTotal > paidAmount) {
      remainingAmount = newTotal - paidAmount;
      paymentStatus = 'pending';  // Additional payment required

      // Log payment status change
      await orderTimelineService.logPaymentUpdated(orderId, {
        previous_status: order.payment_status || 'paid',
        new_status: 'pending',
        remaining_amount: remainingAmount,
        reason: 'Order edited - additional payment required',
      }, editedBy);
    } else if (newTotal < paidAmount) {
      // Credit to customer (less to pay)
      remainingAmount = newTotal - paidAmount; // Negative = credit
    }

    await supabaseAdmin
      .from('orders')
      .update({
        total_amount: newTotal,
        is_edited: true,
        remaining_amount: remainingAmount,
        payment_status: paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // Get and return updated order
    return this.getOrderById(orderId) as Promise<Order>;
  }

  // ==================== KITCHEN WASTE/RETURN PROCESSING ====================

  /**
   * Get cancelled order items pending kitchen decision
   */
  async getCancelledItemsPendingDecision(businessId: number, branchId?: number): Promise<any[]> {
    let query = supabaseAdmin
      .from('cancelled_order_items')
      .select(`
        *,
        orders!inner (
          id,
          order_number,
          business_id,
          branch_id,
          order_status,
          created_at
        ),
        items (
          id,
          name,
          name_ar,
          unit,
          storage_unit
        )
      `)
      .is('decision', null)
      .eq('orders.business_id', businessId);

    if (branchId) {
      query = query.eq('orders.branch_id', branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch cancelled items:', error);
      throw new Error('Failed to fetch cancelled items');
    }

    return data || [];
  }

  /**
   * Process waste/return decisions from kitchen
   * Kitchen decides for each cancelled/removed item whether it's waste or can return to inventory
   */
  async processWasteDecisions(
    decisions: Array<{
      cancelled_item_id: number;
      decision: 'waste' | 'return';
    }>,
    decidedBy: number
  ): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    for (const { cancelled_item_id, decision } of decisions) {
      try {
        // Get the cancelled item
        const { data: cancelledItem, error: fetchError } = await supabaseAdmin
          .from('cancelled_order_items')
          .select(`
            *,
            orders (
              id,
              business_id,
              branch_id
            )
          `)
          .eq('id', cancelled_item_id)
          .single();

        if (fetchError || !cancelledItem) {
          errors.push(`Cancelled item ${cancelled_item_id} not found`);
          continue;
        }

        const orderInfo = cancelledItem.orders as any;

        if (decision === 'waste') {
          // Process as waste - only deduct from actual quantity
          // (reservation was already released when order/item was cancelled)
          await inventoryStockService.deductWasteOnly(
            orderInfo.business_id,
            orderInfo.branch_id,
            [{
              item_id: cancelledItem.item_id,
              quantity_in_storage: cancelledItem.quantity,
              item_name: cancelledItem.product_name,
            }],
            cancelledItem.order_id,
            decidedBy,
            'Marked as waste by kitchen'
          );

          // Log timeline
          await orderTimelineService.logIngredientWasted(cancelledItem.order_id, {
            item_id: cancelledItem.item_id,
            item_name: cancelledItem.product_name || `Item ${cancelledItem.item_id}`,
            quantity: cancelledItem.quantity,
            unit: cancelledItem.unit || 'units',
            reason: 'Marked as waste by kitchen',
          }, decidedBy);

        } else {
          // Process as return - no action needed
          // Reservation was already released when order/item was cancelled
          // Actual stock quantity doesn't need to change (items weren't used)

          // Log timeline for audit
          await orderTimelineService.logIngredientReturned(cancelledItem.order_id, {
            item_id: cancelledItem.item_id,
            item_name: cancelledItem.product_name || `Item ${cancelledItem.item_id}`,
            quantity: cancelledItem.quantity,
            unit: cancelledItem.unit || 'units',
          }, decidedBy);
        }

        // Update the cancelled item record
        await supabaseAdmin
          .from('cancelled_order_items')
          .update({
            decision,
            decided_by: decidedBy,
            decided_at: new Date().toISOString(),
          })
          .eq('id', cancelled_item_id);

        processed++;

      } catch (err: any) {
        errors.push(`Failed to process item ${cancelled_item_id}: ${err.message}`);
      }
    }

    return { processed, errors };
  }

  /**
   * Get order timeline
   */
  async getOrderTimeline(orderId: number): Promise<any[]> {
    return orderTimelineService.getTimeline(orderId);
  }

  /**
   * Auto-expire cancelled items older than 24 hours
   * Marks all pending decisions as 'waste' automatically
   * Should be called by a scheduled job (cron)
   */
  async autoExpireCancelledItems(): Promise<{ expired: number; errors: string[] }> {
    const errors: string[] = [];
    let expired = 0;

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Find all cancelled items older than 24 hours with no decision
    const { data: expiredItems, error: fetchError } = await supabaseAdmin
      .from('cancelled_order_items')
      .select(`
        *,
        orders (
          id,
          business_id,
          branch_id
        )
      `)
      .is('decision', null)
      .lt('created_at', twentyFourHoursAgo.toISOString());

    if (fetchError) {
      console.error('Failed to fetch expired cancelled items:', fetchError);
      return { expired: 0, errors: ['Failed to fetch expired items'] };
    }

    if (!expiredItems || expiredItems.length === 0) {
      console.log('[Auto-Expire] No expired cancelled items found');
      return { expired: 0, errors: [] };
    }

    console.log(`[Auto-Expire] Found ${expiredItems.length} items to auto-expire as waste`);

    // Process each expired item as waste
    for (const item of expiredItems) {
      try {
        const orderInfo = item.orders as any;

        // Process as waste - deduct from actual quantity
        await inventoryStockService.deductWasteOnly(
          orderInfo.business_id,
          orderInfo.branch_id,
          [{
            item_id: item.item_id,
            quantity_in_storage: item.quantity,
            item_name: item.product_name,
          }],
          item.order_id,
          undefined, // No user - auto-expired
          'Auto-expired as waste after 24 hours'
        );

        // Log timeline
        await orderTimelineService.logIngredientWasted(item.order_id, {
          item_id: item.item_id,
          item_name: item.product_name || `Item ${item.item_id}`,
          quantity: item.quantity,
          unit: item.unit || 'units',
          reason: 'Auto-expired as waste after 24 hours (no kitchen decision)',
        }, undefined);

        // Update the cancelled item record
        await supabaseAdmin
          .from('cancelled_order_items')
          .update({
            decision: 'waste',
            decided_at: new Date().toISOString(),
            // decided_by is NULL - indicates auto-expired
          })
          .eq('id', item.id);

        expired++;

      } catch (err: any) {
        console.error(`[Auto-Expire] Failed to process item ${item.id}:`, err);
        errors.push(`Failed to auto-expire item ${item.id}: ${err.message}`);
      }
    }

    console.log(`[Auto-Expire] Completed: ${expired} items expired, ${errors.length} errors`);
    return { expired, errors };
  }

  /**
   * Get cancelled items statistics for dashboard/monitoring
   */
  async getCancelledItemsStats(businessId: number, branchId?: number): Promise<{
    pending_count: number;
    expired_soon_count: number; // Items that will expire in next 6 hours
    oldest_pending_hours: number | null;
  }> {
    // Get all pending items
    let query = supabaseAdmin
      .from('cancelled_order_items')
      .select(`
        id,
        created_at,
        orders!inner (business_id, branch_id)
      `)
      .is('decision', null)
      .eq('orders.business_id', businessId);

    if (branchId) {
      query = query.eq('orders.branch_id', branchId);
    }

    const { data: pendingItems } = await query;

    if (!pendingItems || pendingItems.length === 0) {
      return { pending_count: 0, expired_soon_count: 0, oldest_pending_hours: null };
    }

    const now = new Date();
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let expiredSoonCount = 0;
    let oldestCreatedAt: Date | null = null;

    for (const item of pendingItems) {
      const createdAt = new Date(item.created_at);
      
      // Check if this item will expire within 6 hours (created 18+ hours ago)
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
      if (expiresAt <= sixHoursFromNow) {
        expiredSoonCount++;
      }

      // Track oldest item
      if (!oldestCreatedAt || createdAt < oldestCreatedAt) {
        oldestCreatedAt = createdAt;
      }
    }

    // Calculate hours since oldest item was created
    const oldestPendingHours = oldestCreatedAt
      ? Math.floor((now.getTime() - oldestCreatedAt.getTime()) / (60 * 60 * 1000))
      : null;

    return {
      pending_count: pendingItems.length,
      expired_soon_count: expiredSoonCount,
      oldest_pending_hours: oldestPendingHours,
    };
  }
}

export const posService = new POSService();
