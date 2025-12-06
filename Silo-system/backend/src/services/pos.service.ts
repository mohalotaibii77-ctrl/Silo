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
  OrderSource
} from '../types';

export class POSService {
  
  /**
   * Create new order
   * Works for POS terminal orders, delivery app orders, phone orders, etc.
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
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
    
    // Calculate tax (15% VAT in KSA by default)
    const taxRate = 15;
    const taxAmount = afterDiscount * (taxRate / 100);
    
    // Calculate total
    const total = afterDiscount + taxAmount + deliveryFee + packagingFee + serviceCharge + tipAmount;

    // Determine initial payment status
    const paymentStatus: PaymentStatus = input.payment_method ? 'pending' : 'pending';

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
        
        order_status: 'pending',  // Using existing column name
        
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

    // Create order items with cost snapshot for accurate profit tracking
    const orderItems: OrderItem[] = [];
    for (const { item, itemSubtotal, itemTotal, modifiersTotal } of processedItems) {
      // Get product's current cost for profit calculation
      let unitCostAtSale = 0;
      if (item.product_id) {
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('total_cost')
          .eq('id', item.product_id)
          .single();
        
        unitCostAtSale = product?.total_cost || 0;
      }

      // Calculate cost-related metrics
      const totalCost = unitCostAtSale * item.quantity;
      const profit = itemTotal - totalCost;
      const profitMargin = itemTotal > 0 ? (profit / itemTotal) * 100 : 0;

      const { data: orderItem, error: itemError } = await supabaseAdmin
        .from('order_items')
        .insert({
          business_id: input.business_id,  // Required by existing schema
          order_id: order.id,
          
          product_id: item.product_id,
          product_name: item.product_name,
          product_name_ar: item.product_name_ar,
          product_sku: item.product_sku,
          product_category: item.product_category,
          
          quantity: item.quantity,
          unit_price: item.unit_price,
          
          // Cost snapshot at time of sale
          unit_cost_at_sale: unitCostAtSale,
          total_cost: totalCost,
          profit: profit,
          profit_margin: Math.round(profitMargin * 100) / 100, // Round to 2 decimal places
          
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
        })
        .select()
        .single();

      if (itemError) {
        console.error('Failed to create order item:', itemError);
        throw new Error(`Failed to create order item: ${itemError.message}`);
      }

      // Create modifiers for this item
      if (item.modifiers && item.modifiers.length > 0) {
        const modifiers: OrderItemModifier[] = [];
        for (const mod of item.modifiers) {
          const modQuantity = mod.quantity || 1;
          const modTotal = modQuantity * mod.unit_price;
          
          const { data: modifier, error: modError } = await supabaseAdmin
            .from('order_item_modifiers')
            .insert({
              order_item_id: orderItem.id,
              
              modifier_id: mod.modifier_id,
              modifier_group_id: mod.modifier_group_id,
              modifier_name: mod.modifier_name,
              modifier_name_ar: mod.modifier_name_ar,
              
              quantity: modQuantity,
              unit_price: mod.unit_price,
              total: modTotal,
              
              modifier_type: mod.modifier_type,
            })
            .select()
            .single();

          if (modError) {
            console.error('Failed to create order item modifier:', modError);
          } else {
            modifiers.push(modifier as OrderItemModifier);
          }
        }
        orderItem.modifiers = modifiers;
      }

      orderItems.push(orderItem as OrderItem);
    }

    // Log status history
    await this.logStatusChange(order.id, undefined, 'pending', input.created_by, 'Order created');

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
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    let query = supabaseAdmin
      .from('orders')
      .select('*, order_items(*, order_item_modifiers(*))')
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
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch orders: ${error.message}`);
    
    return data as Order[];
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
    if (status === 'ready') {
      updateData.actual_ready_time = new Date().toISOString();
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
   * Process payment for order
   */
  async processPayment(
    orderId: number,
    paymentMethod: string,
    amount: number,
    reference?: string,
    processedBy?: number
  ): Promise<Order> {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    // Create payment record
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

    await this.logStatusChange(orderId, order.order_status as OrderStatus, 'refunded', processedBy, `Refund: ${reason}`);

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
}

export const posService = new POSService();
