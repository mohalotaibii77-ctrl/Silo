/**
 * POS SERVICE
 * Point of Sale operations - orders, payments, receipts
 */

import { supabaseAdmin } from '../config/database';
import { Order, OrderItem, ApiResponse } from '../types';
import { v4 as uuid } from 'uuid';

export class POSService {
  
  /**
   * Create new order
   */
  async createOrder(data: {
    businessId: string;
    type: 'dine_in' | 'takeaway' | 'delivery';
    tableNumber?: string;
    customerName?: string;
    customerPhone?: string;
    items: Array<{
      itemId: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
    }>;
    createdBy: string;
  }): Promise<Order> {
    // Generate order number
    const orderNumber = await this.generateOrderNumber(data.businessId);
    
    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = subtotal * 0.15; // 15% VAT (configurable)
    const total = subtotal + tax;

    // Create order
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        business_id: data.businessId,
        order_number: orderNumber,
        status: 'pending',
        type: data.type,
        table_number: data.tableNumber,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        subtotal,
        tax,
        discount: 0,
        total,
        created_by: data.createdBy,
      })
      .select()
      .single();

    if (error) throw new Error('Failed to create order');

    // Create order items
    const orderItems = data.items.map(item => ({
      id: uuid(),
      order_id: order.id,
      item_id: item.itemId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.quantity * item.unitPrice,
      notes: item.notes,
    }));

    await supabaseAdmin.from('order_items').insert(orderItems);

    return order as Order;
  }

  /**
   * Get orders by business
   */
  async getOrders(businessId: string, filters?: {
    status?: string;
    date?: string;
    limit?: number;
    offset?: number;
  }): Promise<Order[]> {
    let query = supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.date) {
      query = query.gte('created_at', `${filters.date}T00:00:00`)
                   .lt('created_at', `${filters.date}T23:59:59`);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw new Error('Failed to fetch orders');
    
    return data as Order[];
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'completed') {
      updateData.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw new Error('Failed to update order');
    return data as Order;
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const { count } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', `${new Date().toISOString().slice(0, 10)}T00:00:00`);

    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `ORD-${today}-${sequence}`;
  }
}

export const posService = new POSService();

