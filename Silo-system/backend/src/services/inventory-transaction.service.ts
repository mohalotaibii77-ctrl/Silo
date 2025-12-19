/**
 * INVENTORY TRANSACTION SERVICE
 * Single source of truth for all inventory movements and audit trail
 * 
 * Handles:
 * - Recording ALL inventory transactions (orders, transfers, POs, production, manual)
 * - Manual stock adjustments (additions/deductions)
 * - Timeline queries (global and per-item)
 */

import { supabaseAdmin } from '../config/database';

// ==================== TYPES ====================

export type TransactionType = 
  | 'manual_addition'
  | 'manual_deduction'
  | 'transfer_in'
  | 'transfer_out'
  | 'order_sale'
  | 'po_receive'
  | 'production_consume'
  | 'production_yield'
  | 'inventory_count_adjustment'
  | 'order_void_return';

export type DeductionReason = 'expired' | 'damaged' | 'spoiled' | 'others';

export type ReferenceType = 'order' | 'transfer' | 'purchase_order' | 'production' | 'inventory_count' | 'manual';

export interface InventoryTransaction {
  id: number;
  business_id: number;
  branch_id: number | null;
  item_id: number;
  transaction_type: TransactionType;
  quantity: number;
  unit: string;
  deduction_reason: DeductionReason | null;
  reference_type: ReferenceType | null;
  reference_id: number | null;
  notes: string | null;
  performed_by: number | null;
  created_at: string;
  quantity_before: number | null;
  quantity_after: number | null;
  cost_per_unit_at_time: number | null;
  // Joined data
  item?: {
    id: number;
    name: string;
    name_ar: string | null;
    sku: string | null;
    unit: string;
    storage_unit: string;
  };
  branch?: {
    id: number;
    name: string;
    name_ar: string | null;
  };
  user?: {
    id: number;
    username: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export interface CreateTransactionInput {
  business_id: number;
  branch_id?: number | null;
  item_id: number;
  transaction_type: TransactionType;
  quantity: number;
  unit: string;
  deduction_reason?: DeductionReason | null;
  reference_type?: ReferenceType | null;
  reference_id?: number | null;
  notes?: string | null;
  performed_by?: number | null;
  quantity_before?: number | null;
  quantity_after?: number | null;
  cost_per_unit_at_time?: number | null;
}

export interface ManualAdjustmentInput {
  business_id: number;
  branch_id?: number | null;
  item_id: number;
  quantity: number;
  notes: string;
  performed_by?: number | null;
}

export interface ManualDeductionInput {
  business_id: number;
  branch_id?: number | null;
  item_id: number;
  quantity: number;
  reason: DeductionReason;
  notes?: string | null; // Required only if reason is 'others'
  performed_by?: number | null;
}

export interface TimelineFilters {
  branch_id?: number;
  item_id?: number;
  transaction_type?: TransactionType;
  reference_type?: ReferenceType;
  deduction_reason?: DeductionReason;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface TimelineResponse {
  transactions: InventoryTransaction[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

// ==================== SERVICE ====================

class InventoryTransactionService {
  
  /**
   * Record a transaction in the audit log
   * Called by other services when inventory changes occur
   */
  async recordTransaction(input: CreateTransactionInput): Promise<InventoryTransaction> {
    const { data, error } = await supabaseAdmin
      .from('inventory_transactions')
      .insert({
        business_id: input.business_id,
        branch_id: input.branch_id || null,
        item_id: input.item_id,
        transaction_type: input.transaction_type,
        quantity: input.quantity,
        unit: input.unit,
        deduction_reason: input.deduction_reason || null,
        reference_type: input.reference_type || null,
        reference_id: input.reference_id || null,
        notes: input.notes || null,
        performed_by: input.performed_by || null,
        quantity_before: input.quantity_before ?? null,
        quantity_after: input.quantity_after ?? null,
        cost_per_unit_at_time: input.cost_per_unit_at_time ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to record inventory transaction:', error);
      throw new Error('Failed to record inventory transaction');
    }

    return data;
  }

  /**
   * Get current stock quantity for an item at a branch
   */
  private async getCurrentStock(businessId: number, itemId: number, branchId?: number | null): Promise<{
    quantity: number;
    cost_per_unit: number;
    storage_unit: string;
  }> {
    // Get from inventory_stock table
    let query = supabaseAdmin
      .from('inventory_stock')
      .select('quantity, item:items(cost_per_unit, storage_unit)')
      .eq('business_id', businessId)
      .eq('item_id', itemId);
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    } else {
      query = query.is('branch_id', null);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      // No stock record exists, return 0
      const { data: item } = await supabaseAdmin
        .from('items')
        .select('cost_per_unit, storage_unit')
        .eq('id', itemId)
        .single();
      
      return {
        quantity: 0,
        cost_per_unit: item?.cost_per_unit || 0,
        storage_unit: item?.storage_unit || 'Kg',
      };
    }

    const itemData = data.item as any;
    return {
      quantity: data.quantity || 0,
      cost_per_unit: itemData?.cost_per_unit || 0,
      storage_unit: itemData?.storage_unit || 'Kg',
    };
  }

  /**
   * Update stock quantity in inventory_stock table
   */
  private async updateStockQuantity(
    businessId: number,
    itemId: number,
    newQuantity: number,
    branchId?: number | null
  ): Promise<void> {
    // Check if stock record exists
    let query = supabaseAdmin
      .from('inventory_stock')
      .select('id')
      .eq('business_id', businessId)
      .eq('item_id', itemId);
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    } else {
      query = query.is('branch_id', null);
    }

    const { data: existing } = await query.single();

    if (existing) {
      // Update existing record
      let updateQuery = supabaseAdmin
        .from('inventory_stock')
        .update({ 
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('business_id', businessId)
        .eq('item_id', itemId);
      
      if (branchId) {
        updateQuery = updateQuery.eq('branch_id', branchId);
      } else {
        updateQuery = updateQuery.is('branch_id', null);
      }

      await updateQuery;
    } else {
      // Create new record
      await supabaseAdmin
        .from('inventory_stock')
        .insert({
          business_id: businessId,
          branch_id: branchId || null,
          item_id: itemId,
          quantity: newQuantity,
          reserved_quantity: 0,
          held_quantity: 0,
          min_quantity: 0,
        });
    }
  }

  /**
   * Manual stock addition
   * Requires justification notes
   */
  async addStock(input: ManualAdjustmentInput): Promise<{
    transaction: InventoryTransaction;
    new_quantity: number;
  }> {
    const { business_id, branch_id, item_id, quantity, notes, performed_by } = input;

    // Validate
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    if (!notes || notes.trim().length === 0) {
      throw new Error('Justification notes are required for stock additions');
    }

    // Get current stock
    const currentStock = await this.getCurrentStock(business_id, item_id, branch_id);
    const newQuantity = currentStock.quantity + quantity;

    // Update stock
    await this.updateStockQuantity(business_id, item_id, newQuantity, branch_id);

    // Record transaction
    const transaction = await this.recordTransaction({
      business_id,
      branch_id,
      item_id,
      transaction_type: 'manual_addition',
      quantity,
      unit: currentStock.storage_unit,
      reference_type: 'manual',
      notes,
      performed_by,
      quantity_before: currentStock.quantity,
      quantity_after: newQuantity,
      cost_per_unit_at_time: currentStock.cost_per_unit,
    });

    return {
      transaction,
      new_quantity: newQuantity,
    };
  }

  /**
   * Manual stock deduction
   * Requires reason (expired, damaged, spoiled, others)
   * If reason is 'others', notes are required
   */
  async deductStock(input: ManualDeductionInput): Promise<{
    transaction: InventoryTransaction;
    new_quantity: number;
  }> {
    const { business_id, branch_id, item_id, quantity, reason, notes, performed_by } = input;

    // Validate
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    if (!['expired', 'damaged', 'spoiled', 'others'].includes(reason)) {
      throw new Error('Invalid deduction reason');
    }
    if (reason === 'others' && (!notes || notes.trim().length === 0)) {
      throw new Error('Justification notes are required when reason is "others"');
    }

    // Get current stock
    const currentStock = await this.getCurrentStock(business_id, item_id, branch_id);
    
    // Check sufficient stock
    if (currentStock.quantity < quantity) {
      throw new Error(`Insufficient stock. Available: ${currentStock.quantity} ${currentStock.storage_unit}`);
    }

    const newQuantity = currentStock.quantity - quantity;

    // Update stock
    await this.updateStockQuantity(business_id, item_id, newQuantity, branch_id);

    // Record transaction
    const transaction = await this.recordTransaction({
      business_id,
      branch_id,
      item_id,
      transaction_type: 'manual_deduction',
      quantity,
      unit: currentStock.storage_unit,
      deduction_reason: reason,
      reference_type: 'manual',
      notes: notes || null,
      performed_by,
      quantity_before: currentStock.quantity,
      quantity_after: newQuantity,
      cost_per_unit_at_time: currentStock.cost_per_unit,
    });

    return {
      transaction,
      new_quantity: newQuantity,
    };
  }

  /**
   * Get global timeline for a business
   * Shows all inventory transactions with filters
   */
  async getTimeline(businessId: number, filters?: TimelineFilters): Promise<TimelineResponse> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('inventory_transactions')
      .select(`
        *,
        item:items(id, name, name_ar, sku, unit, storage_unit),
        branch:branches(id, name, name_ar),
        user:business_users!performed_by(id, username, first_name, last_name)
      `, { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.branch_id) {
      query = query.eq('branch_id', filters.branch_id);
    }
    if (filters?.item_id) {
      query = query.eq('item_id', filters.item_id);
    }
    if (filters?.transaction_type) {
      query = query.eq('transaction_type', filters.transaction_type);
    }
    if (filters?.reference_type) {
      query = query.eq('reference_type', filters.reference_type);
    }
    if (filters?.deduction_reason) {
      query = query.eq('deduction_reason', filters.deduction_reason);
    }
    if (filters?.date_from) {
      query = query.gte('created_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Failed to fetch inventory timeline:', error);
      throw new Error('Failed to fetch inventory timeline');
    }

    return {
      transactions: data || [],
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
    };
  }

  /**
   * Get timeline for a specific item
   */
  async getItemTimeline(businessId: number, itemId: number, filters?: TimelineFilters): Promise<TimelineResponse> {
    return this.getTimeline(businessId, { ...filters, item_id: itemId });
  }

  /**
   * Get timeline statistics for dashboard
   */
  async getTimelineStats(businessId: number, branchId?: number): Promise<{
    today_transactions: number;
    today_additions: number;
    today_deductions: number;
    week_transactions: number;
    top_deduction_reasons: { reason: string; count: number }[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    const weekAgoISO = weekAgo.toISOString();

    // Today's transactions
    let todayQuery = supabaseAdmin
      .from('inventory_transactions')
      .select('transaction_type', { count: 'exact' })
      .eq('business_id', businessId)
      .gte('created_at', todayISO);
    
    if (branchId) {
      todayQuery = todayQuery.eq('branch_id', branchId);
    }

    const { count: todayCount } = await todayQuery;

    // Today's additions
    let additionsQuery = supabaseAdmin
      .from('inventory_transactions')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .in('transaction_type', ['manual_addition', 'po_receive', 'transfer_in', 'production_yield', 'order_void_return'])
      .gte('created_at', todayISO);
    
    if (branchId) {
      additionsQuery = additionsQuery.eq('branch_id', branchId);
    }

    const { count: additionsCount } = await additionsQuery;

    // Today's deductions
    let deductionsQuery = supabaseAdmin
      .from('inventory_transactions')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .in('transaction_type', ['manual_deduction', 'order_sale', 'transfer_out', 'production_consume'])
      .gte('created_at', todayISO);
    
    if (branchId) {
      deductionsQuery = deductionsQuery.eq('branch_id', branchId);
    }

    const { count: deductionsCount } = await deductionsQuery;

    // Week's transactions
    let weekQuery = supabaseAdmin
      .from('inventory_transactions')
      .select('id', { count: 'exact' })
      .eq('business_id', businessId)
      .gte('created_at', weekAgoISO);
    
    if (branchId) {
      weekQuery = weekQuery.eq('branch_id', branchId);
    }

    const { count: weekCount } = await weekQuery;

    // Top deduction reasons (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    let reasonsQuery = supabaseAdmin
      .from('inventory_transactions')
      .select('deduction_reason')
      .eq('business_id', businessId)
      .eq('transaction_type', 'manual_deduction')
      .not('deduction_reason', 'is', null)
      .gte('created_at', monthAgo.toISOString());
    
    if (branchId) {
      reasonsQuery = reasonsQuery.eq('branch_id', branchId);
    }

    const { data: reasons } = await reasonsQuery;

    // Count reasons
    const reasonCounts: Record<string, number> = {};
    (reasons || []).forEach(r => {
      if (r.deduction_reason) {
        reasonCounts[r.deduction_reason] = (reasonCounts[r.deduction_reason] || 0) + 1;
      }
    });

    const topReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      today_transactions: todayCount || 0,
      today_additions: additionsCount || 0,
      today_deductions: deductionsCount || 0,
      week_transactions: weekCount || 0,
      top_deduction_reasons: topReasons,
    };
  }
}

export const inventoryTransactionService = new InventoryTransactionService();

