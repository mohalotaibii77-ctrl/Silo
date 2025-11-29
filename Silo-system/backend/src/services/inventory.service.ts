/**
 * INVENTORY SERVICE
 * Stock management, transactions, alerts
 */

import { supabaseAdmin } from '../config/database';
import { Item, InventoryTransaction } from '../types';

export class InventoryService {
  
  /**
   * Get all items for a business
   */
  async getItems(businessId: string, filters?: {
    type?: string;
    categoryId?: string;
    lowStock?: boolean;
  }): Promise<Item[]> {
    let query = supabaseAdmin
      .from('items')
      .select('*, categories(*)')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }
    if (filters?.lowStock) {
      query = query.lt('current_stock', supabaseAdmin.rpc('get_min_stock'));
    }

    const { data, error } = await query.order('name');
    if (error) throw new Error('Failed to fetch items');
    
    return data as Item[];
  }

  /**
   * Get single item
   */
  async getItem(itemId: string): Promise<Item | null> {
    const { data, error } = await supabaseAdmin
      .from('items')
      .select('*, categories(*)')
      .eq('id', itemId)
      .single();

    if (error) return null;
    return data as Item;
  }

  /**
   * Create new item
   */
  async createItem(data: Partial<Item>): Promise<Item> {
    const { data: item, error } = await supabaseAdmin
      .from('items')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error('Failed to create item');
    return item as Item;
  }

  /**
   * Update item
   */
  async updateItem(itemId: string, data: Partial<Item>): Promise<Item> {
    const { data: item, error } = await supabaseAdmin
      .from('items')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw new Error('Failed to update item');
    return item as Item;
  }

  /**
   * Record inventory transaction (stock in/out)
   */
  async recordTransaction(data: {
    businessId: string;
    itemId: string;
    type: 'in' | 'out' | 'adjustment' | 'waste';
    quantity: number;
    reason?: string;
    createdBy: string;
  }): Promise<InventoryTransaction> {
    // Get current stock
    const item = await this.getItem(data.itemId);
    if (!item) throw new Error('Item not found');

    // Calculate new stock
    let newStock = item.current_stock;
    if (data.type === 'in') {
      newStock += data.quantity;
    } else if (data.type === 'out' || data.type === 'waste') {
      newStock -= data.quantity;
      if (newStock < 0) throw new Error('Insufficient stock');
    } else if (data.type === 'adjustment') {
      newStock = data.quantity; // Direct set
    }

    // Update item stock
    await this.updateItem(data.itemId, { current_stock: newStock });

    // Record transaction
    const { data: transaction, error } = await supabaseAdmin
      .from('inventory_transactions')
      .insert({
        business_id: data.businessId,
        item_id: data.itemId,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        created_by: data.createdBy,
      })
      .select()
      .single();

    if (error) throw new Error('Failed to record transaction');
    return transaction as InventoryTransaction;
  }

  /**
   * Get low stock alerts
   */
  async getLowStockItems(businessId: string): Promise<Item[]> {
    const { data, error } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .filter('current_stock', 'lt', supabaseAdmin.rpc('items.min_stock_level'));

    // Fallback: fetch all and filter
    const { data: allItems } = await supabaseAdmin
      .from('items')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true);

    const lowStock = (allItems || []).filter(
      item => item.current_stock <= item.min_stock_level
    );

    return lowStock as Item[];
  }
}

export const inventoryService = new InventoryService();

