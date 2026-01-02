/**
 * INVENTORY STOCK MANAGEMENT SERVICE
 * Handles vendors, purchase orders, transfers, and inventory counts
 * Updated: Force reload
 */

import { supabaseAdmin } from '../config/database';
import { inventoryService } from './inventory.service';
import { convertUnits, StorageUnit, ServingUnit } from '../utils/unit-conversion';

// ==================== TYPES ====================

export interface Vendor {
  id: number;
  business_id: number;
  branch_id?: number | null; // NULL = available to all branches, otherwise only for specific branch
  name: string;
  name_ar?: string | null;
  code?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  tax_number?: string | null;
  payment_terms?: number;
  notes?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  // Joined data
  branch?: { id: number; name: string; name_ar?: string } | null;
}

export interface InventoryStock {
  id: number;
  business_id: number;
  branch_id?: number | null;
  item_id: number;
  quantity: number;
  reserved_quantity: number;
  held_quantity: number; // Quantity held for pending transfers
  min_quantity: number;
  max_quantity?: number | null;
  last_count_date?: string | null;
  last_count_quantity?: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  item?: any;
  branch?: any;
}

export interface PurchaseOrder {
  id: number;
  business_id: number;
  branch_id?: number | null;
  vendor_id: number;
  order_number: string;
  status: 'draft' | 'pending' | 'counted' | 'delivered' | 'cancelled' | 'approved' | 'ordered' | 'partial' | 'received'; // 'counted' added for two-step receiving
  order_date: string;
  expected_date?: string | null;
  received_date?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string | null;
  invoice_image_url?: string | null; // URL to uploaded vendor invoice image
  created_by?: number | null;
  approved_by?: number | null;
  received_by?: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  vendor?: Vendor;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  item_id: number;
  quantity: number;
  received_quantity: number;
  unit_cost: number | null;  // Calculated at receive: total_cost / received_quantity
  total_cost: number | null; // Entered by employee at receive from invoice
  variance_reason?: 'missing' | 'canceled' | 'rejected' | null; // Required if received < ordered
  variance_note?: string | null; // Required if received > ordered (justification)
  notes?: string | null;
  // Counting step fields
  counted_quantity?: number | null; // Quantity entered during counting step
  counted_at?: string | null; // When the item was counted
  barcode_scanned?: boolean; // Whether at least one barcode was scanned for this item
  // Joined data
  item?: any;
}

export interface InventoryTransfer {
  id: number;
  business_id: number; // The business that initiated the transfer
  from_business_id?: number | null; // Source business
  to_business_id?: number | null; // Destination business
  transfer_number: string;
  from_branch_id?: number | null;
  to_branch_id?: number | null;
  status: 'pending' | 'received' | 'cancelled';
  transfer_date: string;
  expected_date?: string | null;
  completed_date?: string | null;
  notes?: string | null;
  created_by?: number | null;
  received_by?: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  from_business?: any;
  to_business?: any;
  from_branch?: any;
  to_branch?: any;
  items?: InventoryTransferItem[];
}

export interface InventoryTransferItem {
  id: number;
  transfer_id: number;
  item_id: number;
  quantity: number;
  received_quantity: number;
  notes?: string | null;
  // Joined data
  item?: any;
}

export interface InventoryCount {
  id: number;
  business_id: number;
  branch_id?: number | null;
  count_number: string;
  count_type: 'full' | 'partial' | 'cycle';
  status: 'draft' | 'in_progress' | 'pending_review' | 'completed' | 'cancelled';
  count_date: string;
  completed_date?: string | null;
  notes?: string | null;
  created_by?: number | null;
  completed_by?: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  branch?: any;
  items?: InventoryCountItem[];
}

export interface InventoryCountItem {
  id: number;
  count_id: number;
  item_id: number;
  expected_quantity: number;
  counted_quantity?: number | null;
  variance?: number | null;
  variance_reason?: string | null;
  counted_by?: number | null;
  counted_at?: string | null;
  // Joined data
  item?: any;
}

export interface InventoryMovement {
  id: number;
  business_id: number;
  branch_id?: number | null;
  item_id: number;
  movement_type: string;
  reference_type?: string | null;
  reference_id?: number | null;
  quantity: number;
  unit_cost?: number | null;
  total_cost?: number | null;
  quantity_before?: number | null;
  quantity_after?: number | null;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
}

export interface POTemplate {
  id: number;
  business_id: number;
  vendor_id: number;
  name: string;
  name_ar?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  vendor?: Vendor;
  items?: POTemplateItem[];
}

export interface POTemplateItem {
  id: number;
  template_id: number;
  item_id: number;
  quantity: number;
  created_at: string;
  // Joined data
  item?: any;
}

export interface POActivity {
  id: number;
  purchase_order_id: number;
  business_id: number;
  user_id?: number | null;
  action: 'created' | 'status_changed' | 'items_updated' | 'notes_updated' | 'cancelled' | 'counted' | 'received';
  old_status?: string | null;
  new_status?: string | null;
  changes?: any;
  notes?: string | null;
  created_at: string;
  // Joined data
  user?: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  };
}

// Item barcode mapping (business-isolated)
export interface ItemBarcode {
  id: number;
  item_id: number;
  business_id: number;
  barcode: string;
  created_at: string;
  created_by?: number | null;
}

/**
 * Ingredient requirement from order calculation
 */
export interface IngredientRequirement {
  item_id: number;
  item_name: string;
  quantity: number;          // In serving units (grams, mL, piece)
  serving_unit: string;
  storage_unit: string;
  quantity_in_storage: number; // Converted to storage units for inventory
  product_id?: number;
  product_name?: string;
  variant_id?: number;
}

export class InventoryStockService {

  // ==================== VENDORS ====================

  /**
   * Generate unique vendor code
   */
  private async generateVendorCode(businessId: number): Promise<string> {
    const { count } = await supabaseAdmin
      .from('vendors')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `VND-${sequence}`;
  }

  /**
   * Get all vendors for a business
   * Vendors with null branch_id are available to all branches
   * Vendors with a specific branch_id are only for that branch
   * Supports pagination with page and limit options
   */
  async getVendors(businessId: number, filters?: {
    status?: 'active' | 'inactive';
    search?: string;
    branchId?: number;
    page?: number;
    limit?: number;
  }): Promise<Vendor[] | { data: Vendor[]; total: number }> {
    const { page, limit } = filters || {};
    
    let query = supabaseAdmin
      .from('vendors')
      .select(`
        *,
        branches (id, name, name_ar)
      `, { count: page && limit ? 'exact' : undefined })
      .eq('business_id', businessId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,name_ar.ilike.%${filters.search}%,code.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%`);
    }

    // Filter by branch: show vendors for this branch OR vendors available to all branches (null)
    if (filters?.branchId) {
      query = query.or(`branch_id.eq.${filters.branchId},branch_id.is.null`);
    }

    // Apply pagination if provided
    if (page && limit) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order('name');

    if (error) {
      console.error('Failed to fetch vendors:', error);
      throw new Error('Failed to fetch vendors');
    }

    const vendors = (data || []).map((v: any) => ({
      ...v,
      branch: v.branches,
      branches: undefined
    })) as Vendor[];

    // Return paginated response if pagination was requested
    if (page && limit && count !== null) {
      return {
        data: vendors,
        total: count,
      };
    }

    return vendors;
  }

  /**
   * Get single vendor
   */
  async getVendor(vendorId: number, businessId: number): Promise<Vendor | null> {
    const { data, error } = await supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .eq('business_id', businessId)
      .single();

    if (error) return null;
    return data as Vendor;
  }

  /**
   * Create vendor
   * branch_id = null means vendor is available to all branches
   * branch_id = number means vendor is only for that specific branch
   */
  async createVendor(businessId: number, data: {
    name: string;
    name_ar?: string;
    branch_id?: number | null; // null = all branches, number = specific branch
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    tax_number?: string;
    payment_terms?: number;
    notes?: string;
  }): Promise<Vendor> {
    const code = await this.generateVendorCode(businessId);

    const { data: vendor, error } = await supabaseAdmin
      .from('vendors')
      .insert({
        business_id: businessId,
        branch_id: data.branch_id || null,
        name: data.name,
        name_ar: data.name_ar || null,
        code,
        contact_person: data.contact_person || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || 'Saudi Arabia',
        tax_number: data.tax_number || null,
        payment_terms: data.payment_terms || 30,
        notes: data.notes || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create vendor:', error);
      throw new Error('Failed to create vendor');
    }

    return vendor as Vendor;
  }

  /**
   * Update vendor
   */
  async updateVendor(vendorId: number, businessId: number, data: Partial<{
    name: string;
    name_ar: string;
    contact_person: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    tax_number: string;
    payment_terms: number;
    notes: string;
    status: 'active' | 'inactive';
  }>): Promise<Vendor> {
    const { data: vendor, error } = await supabaseAdmin
      .from('vendors')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', vendorId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update vendor:', error);
      throw new Error('Failed to update vendor');
    }

    return vendor as Vendor;
  }

  /**
   * Delete vendor (soft delete)
   */
  async deleteVendor(vendorId: number, businessId: number): Promise<void> {
    // Check if vendor has any purchase orders
    const { count } = await supabaseAdmin
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendorId);

    if (count && count > 0) {
      // Soft delete if has orders
      await this.updateVendor(vendorId, businessId, { status: 'inactive' });
    } else {
      // Hard delete if no orders
      const { error } = await supabaseAdmin
        .from('vendors')
        .delete()
        .eq('id', vendorId)
        .eq('business_id', businessId);

      if (error) {
        console.error('Failed to delete vendor:', error);
        throw new Error('Failed to delete vendor');
      }
    }
  }

  // ==================== INVENTORY STOCK ====================

  /**
   * Get stock levels for all items
   * Supports pagination with page and limit options
   * 
   * Branch filtering behavior:
   * - If branchId is provided: return stock for that specific branch only
   * - If branchId is undefined: return ALL stock records, then deduplicate by item_id
   *   (prefer branch-specific stock over business-level stock to avoid duplicates)
   */
  async getStockLevels(businessId: number, filters?: {
    branchId?: number;
    itemId?: number;
    lowStock?: boolean;
    page?: number;
    limit?: number;
  }): Promise<InventoryStock[] | { data: InventoryStock[]; total: number }> {
    const { page, limit, lowStock } = filters || {};
    
    // ENFORCEMENT: Stock levels are always filtered by business AND branch
    // - items!inner ensures we only get stock for items that exist and belong to this business
    // - inventory_stock.business_id must match the business
    // - When branch is specified, inventory_stock.branch_id must match
    let query = supabaseAdmin
      .from('inventory_stock')
      .select(`
        *,
        items!inner (id, name, name_ar, unit, storage_unit, category, sku, business_id),
        branches (id, name, name_ar)
      `, { count: page && limit ? 'exact' : undefined })
      .eq('business_id', businessId)
      // CRITICAL: Only show stock for items owned by THIS business
      // This filters out any stock records that reference system items (business_id IS NULL)
      // or items belonging to other businesses
      .eq('items.business_id', businessId);

    // ENFORCEMENT: When branch is specified, ONLY show stock for that specific branch
    // This ensures branch-level isolation - each branch only sees their own inventory
    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    if (filters?.itemId) {
      query = query.eq('item_id', filters.itemId);
    }

    // Apply pagination AFTER filters to get correct count
    if (page && limit) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order('item_id');

    if (error) {
      console.error('Failed to fetch stock levels:', error);
      throw new Error('Failed to fetch stock levels');
    }

    let stocks = (data || []).map((s: any) => ({
      ...s,
      item: s.items,
      branch: s.branches,
      items: undefined,
      branches: undefined,
    })) as InventoryStock[];

    // Deduplicate by item_id when no branch filter
    // This handles cases where the same item might have multiple stock records
    // (e.g., business-level and branch-level stock for legacy data)
    if (!filters?.branchId) {
      const itemStockMap = new Map<number, InventoryStock>();
      for (const stock of stocks) {
        const existing = itemStockMap.get(stock.item_id);
        if (!existing) {
          itemStockMap.set(stock.item_id, stock);
        } else if (stock.branch_id && !existing.branch_id) {
          // Prefer branch-specific stock over business-level stock
          itemStockMap.set(stock.item_id, stock);
        }
      }
      stocks = Array.from(itemStockMap.values());
    }

    // Apply lowStock filter in-memory (PostgREST doesn't support column-to-column comparison)
    if (lowStock) {
      stocks = stocks.filter((s: InventoryStock) => s.quantity <= s.min_quantity);
    }

    // Return paginated response if pagination was requested
    if (page && limit && count !== null) {
      return {
        data: stocks,
        total: stocks.length,
      };
    }

    return stocks;
  }

  /**
   * Get stock statistics - counts of low stock, out of stock, healthy items
   * Backend calculation - frontend just displays these values
   * 
   * Branch filtering: Same as getStockLevels - filter by specific branch or dedupe all
   */
  async getStockStats(businessId: number, branchId?: number): Promise<{
    total_items: number;
    low_stock_count: number;
    out_of_stock_count: number;
    healthy_stock_count: number;
    overstocked_count: number;
  }> {
    // ENFORCEMENT: Same rules as getStockLevels - business AND branch filtering
    let query = supabaseAdmin
      .from('inventory_stock')
      .select('id, item_id, branch_id, quantity, min_quantity, max_quantity, items!inner(business_id)')
      .eq('business_id', businessId)
      // CRITICAL: Only count stock for items owned by THIS business
      .eq('items.business_id', businessId);

    // ENFORCEMENT: When branch is specified, only count that branch's stock
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch stock stats:', error);
      throw new Error('Failed to fetch stock statistics');
    }

    let stocks = data || [];
    
    // When no branch filter, deduplicate by item_id (same logic as getStockLevels)
    if (!branchId) {
      const itemStockMap = new Map<number, typeof stocks[0]>();
      for (const stock of stocks) {
        const existing = itemStockMap.get(stock.item_id);
        if (!existing) {
          itemStockMap.set(stock.item_id, stock);
        } else if (stock.branch_id && !existing.branch_id) {
          itemStockMap.set(stock.item_id, stock);
        }
      }
      stocks = Array.from(itemStockMap.values());
    }
    
    // Calculate counts - same logic as was in frontend, now in backend
    const total_items = stocks.length;
    const out_of_stock_count = stocks.filter(s => s.quantity === 0).length;
    const low_stock_count = stocks.filter(s => s.quantity > 0 && s.quantity <= s.min_quantity).length;
    const overstocked_count = stocks.filter(s => s.max_quantity && s.quantity >= s.max_quantity).length;
    const healthy_stock_count = stocks.filter(s => 
      s.quantity > s.min_quantity && 
      (!s.max_quantity || s.quantity < s.max_quantity)
    ).length;

    return {
      total_items,
      low_stock_count,
      out_of_stock_count,
      healthy_stock_count,
      overstocked_count,
    };
  }

  /**
   * Get or create stock record for an item
   * Uses upsert pattern to prevent race conditions and duplicate records
   * ENFORCEMENT: Only creates stock for items owned by this business
   */
  async getOrCreateStock(businessId: number, itemId: number, branchId?: number): Promise<InventoryStock> {
    // ENFORCEMENT: Verify the item belongs to this business before creating stock
    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .select('id, business_id')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      throw new Error(`Item ${itemId} not found`);
    }

    if (item.business_id !== businessId) {
      throw new Error(`Item ${itemId} does not belong to business ${businessId}. Stock can only be created for business-owned items.`);
    }

    // Build query - use .is() for null comparison since .eq() doesn't work with NULL
    let query = supabaseAdmin
      .from('inventory_stock')
      .select('*')
      .eq('business_id', businessId)
      .eq('item_id', itemId);
    
    // Handle null branch_id properly (PostgreSQL requires IS NULL, not = NULL)
    if (branchId) {
      query = query.eq('branch_id', branchId);
    } else {
      query = query.is('branch_id', null);
    }
    
    const { data: existing } = await query.single();

    if (existing) return existing as InventoryStock;

    // Insert new stock record
    const { data: newStock, error } = await supabaseAdmin
      .from('inventory_stock')
      .insert({
        business_id: businessId,
        branch_id: branchId || null,
        item_id: itemId,
        quantity: 0,
        reserved_quantity: 0,
        held_quantity: 0,
        min_quantity: 0,
      })
      .select()
      .single();

    if (error) {
      // If insert failed due to race condition (duplicate), try to fetch the existing record
      if (error.code === '23505') {
        console.warn('Duplicate stock record, fetching existing:', error.message);
        let retryQuery = supabaseAdmin
          .from('inventory_stock')
          .select('*')
          .eq('business_id', businessId)
          .eq('item_id', itemId);
        
        if (branchId) {
          retryQuery = retryQuery.eq('branch_id', branchId);
        } else {
          retryQuery = retryQuery.is('branch_id', null);
        }
        
        const { data: retryExisting } = await retryQuery.single();
        if (retryExisting) return retryExisting as InventoryStock;
      }
      
      console.error('Failed to create stock record:', error);
      throw new Error('Failed to create stock record');
    }

    return newStock as InventoryStock;
  }

  /**
   * Update stock quantity
   * Prevents inventory from going negative - minimum is 0
   */
  async updateStock(
    businessId: number,
    itemId: number,
    quantityChange: number,
    movementType: string,
    options?: {
      branchId?: number;
      referenceType?: string;
      referenceId?: number;
      unitCost?: number;
      notes?: string;
      userId?: number;
    }
  ): Promise<InventoryStock> {
    const stock = await this.getOrCreateStock(businessId, itemId, options?.branchId);
    const quantityBefore = stock.quantity;
    
    // SAFEGUARD: Prevent inventory from going negative
    // If the change would result in negative quantity, cap at 0
    const quantityAfter = Math.max(0, quantityBefore + quantityChange);

    // Update stock
    const { data: updatedStock, error } = await supabaseAdmin
      .from('inventory_stock')
      .update({
        quantity: quantityAfter,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stock.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update stock:', error);
      throw new Error('Failed to update stock');
    }

    // Record movement (legacy table)
    await supabaseAdmin
      .from('inventory_movements')
      .insert({
        business_id: businessId,
        branch_id: options?.branchId || null,
        item_id: itemId,
        movement_type: movementType,
        reference_type: options?.referenceType || null,
        reference_id: options?.referenceId || null,
        quantity: quantityChange,
        unit_cost: options?.unitCost || null,
        total_cost: options?.unitCost ? options.unitCost * Math.abs(quantityChange) : null,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        notes: options?.notes || null,
        created_by: options?.userId || null,
      });

    // Also record in the new inventory_transactions table for timeline
    try {
      // Map movementType to transaction_type
      let transactionType: string;
      switch (movementType) {
        case 'purchase_receive':
          transactionType = 'po_receive';
          break;
        case 'sale':
        case 'order':
          transactionType = 'order_sale';
          break;
        case 'transfer_in':
          transactionType = 'transfer_in';
          break;
        case 'transfer_out':
          transactionType = 'transfer_out';
          break;
        case 'production_consume':
          transactionType = 'production_consume';
          break;
        case 'production_yield':
          transactionType = 'production_yield';
          break;
        case 'inventory_count':
        case 'count_adjustment':
          transactionType = 'inventory_count_adjustment';
          break;
        case 'manual_addition':
          transactionType = 'manual_addition';
          break;
        case 'manual_deduction':
          transactionType = 'manual_deduction';
          break;
        default:
          transactionType = quantityChange >= 0 ? 'manual_addition' : 'manual_deduction';
      }

      // Get item info for unit
      const { data: itemInfo } = await supabaseAdmin
        .from('items')
        .select('storage_unit, unit, cost_per_unit')
        .eq('id', itemId)
        .single();

      await supabaseAdmin
        .from('inventory_transactions')
        .insert({
          business_id: businessId,
          branch_id: options?.branchId || null,
          item_id: itemId,
          transaction_type: transactionType,
          quantity: Math.abs(quantityChange),
          unit: itemInfo?.storage_unit || itemInfo?.unit || 'unit',
          reference_type: options?.referenceType || null,
          reference_id: options?.referenceId || null,
          notes: options?.notes || null,
          performed_by: options?.userId || null,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          cost_per_unit_at_time: options?.unitCost || itemInfo?.cost_per_unit || null,
        });
    } catch (txError) {
      // Don't fail the main operation if transaction logging fails
      console.error('Failed to log inventory transaction:', txError);
    }

    return updatedStock as InventoryStock;
  }

  /**
   * Set stock min/max quantities
   */
  async setStockLimits(
    businessId: number,
    itemId: number,
    limits: { min_quantity?: number; max_quantity?: number },
    branchId?: number
  ): Promise<InventoryStock> {
    const stock = await this.getOrCreateStock(businessId, itemId, branchId);

    const { data, error } = await supabaseAdmin
      .from('inventory_stock')
      .update({
        ...limits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stock.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to set stock limits:', error);
      throw new Error('Failed to set stock limits');
    }

    return data as InventoryStock;
  }

  // ==================== PO ACTIVITY LOGGING ====================

  /**
   * Log purchase order activity for audit trail
   */
  async logPOActivity(data: {
    purchaseOrderId: number;
    businessId: number;
    userId?: number;
    action: POActivity['action'];
    oldStatus?: string;
    newStatus?: string;
    changes?: any;
    notes?: string;
  }): Promise<void> {
    try {
      const { error } = await supabaseAdmin.from('purchase_order_activity').insert({
        purchase_order_id: data.purchaseOrderId,
        business_id: data.businessId,
        user_id: data.userId || null,
        action: data.action,
        old_status: data.oldStatus || null,
        new_status: data.newStatus || null,
        changes: data.changes || null,
        notes: data.notes || null,
      });
      
      if (error) {
        console.error('Failed to log PO activity:', error);
      }
    } catch (err) {
      console.error('Failed to log PO activity (exception):', err);
      // Don't throw - activity logging should not break operations
    }
  }

  /**
   * Get activity history for a purchase order
   */
  async getPOActivity(orderId: number, businessId: number): Promise<POActivity[]> {
    const { data, error } = await supabaseAdmin
      .from('purchase_order_activity')
      .select(`
        *,
        business_users (id, username, first_name, last_name)
      `)
      .eq('purchase_order_id', orderId)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch PO activity:', error);
      return [];
    }

    return (data || []).map((a: any) => ({
      ...a,
      user: a.business_users || null,
      business_users: undefined,
    })) as POActivity[];
  }

  // ==================== PURCHASE ORDERS ====================

  /**
   * Generate purchase order number
   */
  private async generatePONumber(businessId: number): Promise<string> {
    const { count } = await supabaseAdmin
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `PO-${year}${month}-${sequence}`;
  }

  /**
   * Get purchase orders
   * POs are strictly branch-specific - each branch only sees its own POs
   */
  async getPurchaseOrders(businessId: number, filters?: {
    status?: string;
    vendorId?: number;
    branchId?: number;
    page?: number;
    limit?: number;
  }): Promise<PurchaseOrder[] | { data: PurchaseOrder[]; total: number }> {
    const { page, limit } = filters || {};
    
    let query = supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        vendors (id, name, name_ar, code),
        branches (id, name, name_ar)
      `, { count: page && limit ? 'exact' : undefined })
      .eq('business_id', businessId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.vendorId) {
      query = query.eq('vendor_id', filters.vendorId);
    }
    if (filters?.branchId) {
      // Strictly filter by branch - each branch only sees its own POs
      query = query.eq('branch_id', filters.branchId);
    }

    // Apply pagination if provided
    if (page && limit) {
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch purchase orders:', error);
      throw new Error('Failed to fetch purchase orders');
    }

    const purchaseOrders = (data || []).map((po: any) => ({
      ...po,
      vendor: po.vendors,
      branch: po.branches,
      vendors: undefined,
      branches: undefined,
    })) as PurchaseOrder[];

    // Return paginated response if pagination was requested
    if (page && limit && count !== null) {
      return {
        data: purchaseOrders,
        total: count,
      };
    }

    return purchaseOrders;
  }

  /**
   * Get single purchase order with items
   */
  async getPurchaseOrder(orderId: number, businessId: number): Promise<PurchaseOrder | null> {
    const { data: order, error } = await supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        vendors (id, name, name_ar, code, email, phone),
        branches (id, name, name_ar)
      `)
      .eq('id', orderId)
      .eq('business_id', businessId)
      .single();

    if (error || !order) return null;

    // Get order items
    const { data: items } = await supabaseAdmin
      .from('purchase_order_items')
      .select(`
        *,
        items (id, name, name_ar, unit, storage_unit, sku)
      `)
      .eq('purchase_order_id', orderId);

    return {
      ...order,
      vendor: order.vendors,
      branch: order.branches,
      items: (items || []).map((i: any) => ({
        ...i,
        item: i.items,
        items: undefined,
      })),
      vendors: undefined,
      branches: undefined,
    } as PurchaseOrder;
  }

  /**
   * Create purchase order
   * NOTE: PO is created with quantities only - prices are entered at receive time
   */
  async createPurchaseOrder(businessId: number, data: {
    vendor_id: number;
    branch_id?: number;
    expected_date?: string;
    notes?: string;
    items: { item_id: number; quantity: number }[]; // No prices at creation
    created_by?: number;
  }): Promise<PurchaseOrder> {
    const orderNumber = await this.generatePONumber(businessId);

    // Create order with zero totals (calculated at receive time)
    const { data: order, error } = await supabaseAdmin
      .from('purchase_orders')
      .insert({
        business_id: businessId,
        vendor_id: data.vendor_id,
        branch_id: data.branch_id || null,
        order_number: orderNumber,
        status: 'pending',
        order_date: new Date().toISOString().split('T')[0],
        expected_date: data.expected_date || null,
        subtotal: 0,           // Calculated at receive
        tax_amount: 0,         // Calculated at receive
        discount_amount: 0,
        total_amount: 0,       // Calculated at receive
        notes: data.notes || null,
        created_by: data.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create purchase order:', error);
      throw new Error('Failed to create purchase order');
    }

    // Create order items with quantities only (no prices)
    const itemsToInsert = data.items.map(item => ({
      purchase_order_id: order.id,
      item_id: item.item_id,
      quantity: item.quantity,
      received_quantity: 0,
      unit_cost: null,    // Entered at receive
      total_cost: null,   // Entered at receive
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('purchase_order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback
      await supabaseAdmin.from('purchase_orders').delete().eq('id', order.id);
      console.error('Failed to create purchase order items:', itemsError);
      throw new Error('Failed to create purchase order items');
    }

    // Log activity
    await this.logPOActivity({
      purchaseOrderId: order.id,
      businessId,
      userId: data.created_by,
      action: 'created',
      newStatus: 'pending',
      changes: {
        vendor_id: data.vendor_id,
        items_count: data.items.length,
      },
    });

    return this.getPurchaseOrder(order.id, businessId) as Promise<PurchaseOrder>;
  }

  /**
   * Update purchase order status
   * NOTE: To receive a PO, use receivePurchaseOrder() which handles counting and pricing
   * This function only handles: pending, cancelled status changes
   */
  async updatePurchaseOrderStatus(
    orderId: number,
    businessId: number,
    status: string,
    userId?: number,
    actionNote?: string
  ): Promise<PurchaseOrder> {
    // Get current order to track old status
    const currentOrder = await this.getPurchaseOrder(orderId, businessId);
    if (!currentOrder) throw new Error('Purchase order not found');
    
    // Validate status - 'received' is set via receivePurchaseOrder, 'counted' via countPurchaseOrder
    const validManualStatuses = ['pending', 'counted', 'cancelled', 'received'];
    if (!validManualStatuses.includes(status)) {
      throw new Error(`Invalid status. Use countPurchaseOrder() or receivePurchaseOrder() for processing.`);
    }

    // Prevent cancelling already received orders
    if (status === 'cancelled' && currentOrder.status === 'received') {
      throw new Error('Cannot cancel a received order');
    }
    
    const oldStatus = currentOrder.status;
    const updates: any = { status, updated_at: new Date().toISOString() };

    const { error } = await supabaseAdmin
      .from('purchase_orders')
      .update(updates)
      .eq('id', orderId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to update purchase order status:', error);
      throw new Error('Failed to update purchase order status');
    }

    // Log activity
    const action: POActivity['action'] = status === 'cancelled' ? 'cancelled' : 'status_changed';
    await this.logPOActivity({
      purchaseOrderId: orderId,
      businessId,
      userId,
      action,
      oldStatus,
      newStatus: status,
      notes: actionNote,
    });

    return this.getPurchaseOrder(orderId, businessId) as Promise<PurchaseOrder>;
  }

  /**
   * Update purchase order details (notes, expected date, item quantities)
   * NOTE: Prices are only entered at receive time, not during update
   */
  async updatePurchaseOrder(
    orderId: number,
    businessId: number,
    data: {
      notes?: string;
      expected_date?: string;
      items?: { item_id: number; quantity: number }[]; // No prices - only quantities can be updated
    },
    userId?: number
  ): Promise<PurchaseOrder> {
    const currentOrder = await this.getPurchaseOrder(orderId, businessId);
    if (!currentOrder) throw new Error('Purchase order not found');
    
    // Only allow edits on pending/draft orders
    if (!['pending', 'draft'].includes(currentOrder.status)) {
      throw new Error('Cannot edit this order - only pending/draft orders can be modified');
    }

    const changes: any = {};
    const updates: any = { updated_at: new Date().toISOString() };

    // Update notes if provided
    if (data.notes !== undefined && data.notes !== currentOrder.notes) {
      changes.notes = { old: currentOrder.notes, new: data.notes };
      updates.notes = data.notes || null;
    }

    // Update expected date if provided
    if (data.expected_date !== undefined && data.expected_date !== currentOrder.expected_date) {
      changes.expected_date = { old: currentOrder.expected_date, new: data.expected_date };
      updates.expected_date = data.expected_date || null;
    }

    // Update items if provided (quantities only - no prices)
    if (data.items && data.items.length > 0) {
      // Delete old items and insert new ones with updated quantities
      await supabaseAdmin
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', orderId);

      const itemsToInsert = data.items.map(item => ({
        purchase_order_id: orderId,
        item_id: item.item_id,
        quantity: item.quantity,
        received_quantity: 0,
        unit_cost: null,   // Prices entered at receive time
        total_cost: null,  // Prices entered at receive time
      }));

      await supabaseAdmin
        .from('purchase_order_items')
        .insert(itemsToInsert);

      changes.items = {
        old_count: currentOrder.items?.length || 0,
        new_count: data.items.length,
      };
    }

    // Update order
    if (Object.keys(updates).length > 1) { // More than just updated_at
      const { error } = await supabaseAdmin
        .from('purchase_orders')
        .update(updates)
        .eq('id', orderId)
        .eq('business_id', businessId);

      if (error) {
        console.error('Failed to update purchase order:', error);
        throw new Error('Failed to update purchase order');
      }
    }

    // Log activity if there were changes
    if (Object.keys(changes).length > 0) {
      const action: POActivity['action'] = changes.items ? 'items_updated' : 'notes_updated';
      await this.logPOActivity({
        purchaseOrderId: orderId,
        businessId,
        userId,
        action,
        changes,
      });
    }

    return this.getPurchaseOrder(orderId, businessId) as Promise<PurchaseOrder>;
  }

  // ==================== ITEM BARCODES ====================

  /**
   * Get barcode for an item within a business
   */
  async getItemBarcode(itemId: number, businessId: number): Promise<(ItemBarcode & { created_by_user?: { first_name: string | null; last_name: string | null; username: string } | null }) | null> {
    const { data, error } = await supabaseAdmin
      .from('item_barcodes')
      .select(`
        *,
        created_by_user:business_users!created_by (first_name, last_name, username)
      `)
      .eq('item_id', itemId)
      .eq('business_id', businessId)
      .single();

    if (error) return null;
    return data as (ItemBarcode & { created_by_user?: { first_name: string | null; last_name: string | null; username: string } | null });
  }

  /**
   * Lookup item by barcode within a business
   * Barcodes are unique per business, not globally
   */
  async lookupItemByBarcode(barcode: string, businessId: number): Promise<{ item_id: number; item?: any } | null> {
    const { data, error } = await supabaseAdmin
      .from('item_barcodes')
      .select(`
        *,
        items (id, name, name_ar, sku, unit, storage_unit)
      `)
      .eq('barcode', barcode)
      .eq('business_id', businessId)
      .single();

    if (error || !data) return null;
    
    return {
      item_id: data.item_id,
      item: (data as any).items,
    };
  }

  /**
   * Associate a barcode with an item for a specific business
   * Each item can have one barcode per business, and each barcode must be unique within a business
   * Different businesses can use the same barcode for different items
   */
  async associateBarcode(itemId: number, barcode: string, businessId: number, userId?: number): Promise<ItemBarcode> {
    // Check if barcode already exists for another item in this business
    const { data: existing } = await supabaseAdmin
      .from('item_barcodes')
      .select('id, item_id')
      .eq('barcode', barcode)
      .eq('business_id', businessId)
      .single();

    if (existing) {
      if (existing.item_id === itemId) {
        // Already associated with this item in this business
        return existing as ItemBarcode;
      }
      throw new Error('This barcode is already associated with another item in your business');
    }

    // Check if item already has a barcode in this business
    const { data: itemExisting } = await supabaseAdmin
      .from('item_barcodes')
      .select('id')
      .eq('item_id', itemId)
      .eq('business_id', businessId)
      .single();

    if (itemExisting) {
      // Update existing barcode for this item in this business
      const { data: updated, error } = await supabaseAdmin
        .from('item_barcodes')
        .update({ barcode, created_by: userId || null })
        .eq('item_id', itemId)
        .eq('business_id', businessId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update barcode:', error);
        throw new Error('Failed to update barcode');
      }
      return updated as ItemBarcode;
    }

    // Create new barcode association for this business
    const { data, error } = await supabaseAdmin
      .from('item_barcodes')
      .insert({
        item_id: itemId,
        barcode,
        business_id: businessId,
        created_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to associate barcode:', error);
      throw new Error('Failed to associate barcode');
    }

    return data as ItemBarcode;
  }

  /**
   * Delete barcode association for an item within a business
   */
  async deleteBarcode(itemId: number, businessId: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('item_barcodes')
      .delete()
      .eq('item_id', itemId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to delete barcode:', error);
      throw new Error('Failed to delete barcode');
    }

    return true;
  }

  // ==================== PO COUNTING (Two-Step Receiving) ====================

  /**
   * Count purchase order items (Step 1 of receiving)
   * Employee counts items, enters quantities, scans barcodes
   * Status changes from 'pending' to 'counted'
   */
  async countPurchaseOrder(
    orderId: number,
    businessId: number,
    data: {
      items: {
        item_id: number;
        counted_quantity: number;
        variance_reason?: 'missing' | 'canceled' | 'rejected'; // Required if counted < ordered
        variance_note?: string; // Required if counted > ordered
        barcode_scanned: boolean; // At least one barcode must be scanned per item
      }[];
    },
    userId?: number
  ): Promise<PurchaseOrder> {
    const order = await this.getPurchaseOrder(orderId, businessId);
    if (!order) throw new Error('Purchase order not found');
    
    // Only pending orders can be counted
    if (order.status !== 'pending') {
      throw new Error('Only pending orders can be counted');
    }

    // Validate each item
    for (const counted of data.items) {
      const orderItem = order.items?.find(i => i.item_id === counted.item_id);
      if (!orderItem) {
        throw new Error(`Item ${counted.item_id} not found in this purchase order`);
      }

      // Validate barcode was scanned
      if (!counted.barcode_scanned) {
        const itemName = orderItem.item?.name || `Item ${counted.item_id}`;
        throw new Error(`${itemName}: At least one barcode must be scanned for this item`);
      }

      // Validate counted_quantity
      if (counted.counted_quantity === undefined || counted.counted_quantity < 0) {
        const itemName = orderItem.item?.name || `Item ${counted.item_id}`;
        throw new Error(`${itemName}: Counted quantity is required`);
      }

      // Validate variance_reason if under-counted
      if (counted.counted_quantity < orderItem.quantity) {
        if (!counted.variance_reason) {
          const itemName = orderItem.item?.name || `Item ${counted.item_id}`;
          throw new Error(`${itemName}: Reason required for shortage (counted ${counted.counted_quantity} of ${orderItem.quantity}). Select: missing, canceled, or rejected`);
        }
        const validReasons = ['missing', 'canceled', 'rejected'];
        if (!validReasons.includes(counted.variance_reason)) {
          throw new Error(`Invalid variance reason. Must be: missing, canceled, or rejected`);
        }
      }

      // Validate variance_note if over-counted
      if (counted.counted_quantity > orderItem.quantity) {
        if (!counted.variance_note || counted.variance_note.trim() === '') {
          const itemName = orderItem.item?.name || `Item ${counted.item_id}`;
          throw new Error(`${itemName}: Justification note required when counting more than ordered (counted ${counted.counted_quantity} of ${orderItem.quantity})`);
        }
      }
    }

    // Update each item with counting data
    const countedAt = new Date().toISOString();
    for (const counted of data.items) {
      const orderItem = order.items?.find(i => i.item_id === counted.item_id);
      if (!orderItem) continue;

      await supabaseAdmin
        .from('purchase_order_items')
        .update({
          counted_quantity: counted.counted_quantity,
          counted_at: countedAt,
          barcode_scanned: counted.barcode_scanned,
          variance_reason: counted.variance_reason || null,
          variance_note: counted.variance_note || null,
          updated_at: countedAt,
        })
        .eq('id', orderItem.id);
    }

    // Update PO status to 'counted'
    await supabaseAdmin
      .from('purchase_orders')
      .update({
        status: 'counted',
        updated_at: countedAt,
      })
      .eq('id', orderId);

    // Log activity
    await this.logPOActivity({
      purchaseOrderId: orderId,
      businessId,
      userId,
      action: 'counted',
      oldStatus: 'pending',
      newStatus: 'counted',
      changes: {
        items_counted: data.items.map(i => ({
          item_id: i.item_id,
          counted_quantity: i.counted_quantity,
          barcode_scanned: i.barcode_scanned,
          variance_reason: i.variance_reason,
          variance_note: i.variance_note,
        })),
      },
    });

    return this.getPurchaseOrder(orderId, businessId) as Promise<PurchaseOrder>;
  }

  /**
   * Calculate Weighted Average Cost (WAC)
   * Formula: New WAC = (Existing Stock Value + New Stock Value) / Total Quantity
   */
  private calculateWeightedAverageCost(
    existingQuantity: number,
    existingCostPerUnit: number,
    newQuantity: number,
    newCostPerUnit: number
  ): number {
    const existingValue = existingQuantity * existingCostPerUnit;
    const newValue = newQuantity * newCostPerUnit;
    const totalQuantity = existingQuantity + newQuantity;
    
    if (totalQuantity <= 0) return newCostPerUnit; // If no stock, use new cost
    
    const wac = (existingValue + newValue) / totalQuantity;
    // Round to 8 decimal places to preserve precision for very small per-gram costs
    // e.g., 50 KD/kg = 0.00005 KD/gram needs at least 5 decimal places
    return Math.round(wac * 100000000) / 100000000;
  }

  /**
   * Receive purchase order (Step 2 of receiving - add items to stock)
   * Employee enters total costs from invoice and attaches invoice image
   * Uses Weighted Average Cost (WAC) for cost calculation with storage→serving unit conversion
   * 
   * For 'counted' orders: Uses counted_quantity, only requires pricing and invoice
   * For 'pending' orders (legacy): Requires quantities, variance info, pricing, and invoice
   */
  async receivePurchaseOrder(
    orderId: number,
    businessId: number,
    data: {
      invoice_image_url: string;  // Required: URL to uploaded invoice image
      items: {
        item_id: number;
        received_quantity?: number;  // Optional for 'counted' orders (uses counted_quantity)
        total_cost: number;          // Total cost from invoice (e.g., 625 for 50kg)
        variance_reason?: 'missing' | 'canceled' | 'rejected'; // Required if received < ordered (for pending orders)
        variance_note?: string;      // Required if received > ordered (for pending orders)
      }[];
    },
    userId?: number
  ): Promise<PurchaseOrder> {
    const order = await this.getPurchaseOrder(orderId, businessId);
    if (!order) throw new Error('Purchase order not found');
    
    // Only counted or pending orders can be received
    if (!['counted', 'pending'].includes(order.status)) {
      throw new Error('Cannot receive this order - must be pending or counted');
    }

    const isCounted = order.status === 'counted';

    // Validate invoice image is provided
    if (!data.invoice_image_url || data.invoice_image_url.trim() === '') {
      throw new Error('Invoice image is required');
    }

    // Validate each item
    for (const received of data.items) {
      const orderItem = order.items?.find(i => i.item_id === received.item_id);
      if (!orderItem) {
        throw new Error(`Item ${received.item_id} not found in this purchase order`);
      }

      // Validate total_cost is provided
      if (received.total_cost === undefined || received.total_cost === null || received.total_cost < 0) {
        const itemName = orderItem.item?.name || `Item ${received.item_id}`;
        throw new Error(`${itemName}: Total cost from invoice is required`);
      }

      // For counted orders, use counted_quantity; for pending orders, use received_quantity
      const finalQuantity = isCounted 
        ? (orderItem.counted_quantity ?? received.received_quantity ?? 0)
        : (received.received_quantity ?? 0);

      // Validate quantity for pending orders
      if (!isCounted) {
        if (received.received_quantity === undefined || received.received_quantity < 0) {
          const itemName = orderItem.item?.name || `Item ${received.item_id}`;
          throw new Error(`${itemName}: Received quantity is required`);
        }

        // Validate variance_reason if under-received
        if (received.received_quantity < orderItem.quantity) {
          if (!received.variance_reason) {
            const itemName = orderItem.item?.name || `Item ${received.item_id}`;
            throw new Error(`${itemName}: Reason required for shortage (received ${received.received_quantity} of ${orderItem.quantity}). Select: missing, canceled, or rejected`);
          }
          const validReasons = ['missing', 'canceled', 'rejected'];
          if (!validReasons.includes(received.variance_reason)) {
            throw new Error(`Invalid variance reason. Must be: missing, canceled, or rejected`);
          }
        }

        // Validate variance_note if over-received
        if (received.received_quantity > orderItem.quantity) {
          if (!received.variance_note || received.variance_note.trim() === '') {
            const itemName = orderItem.item?.name || `Item ${received.item_id}`;
            throw new Error(`${itemName}: Justification note required when receiving more than ordered (received ${received.received_quantity} of ${orderItem.quantity})`);
          }
        }
      }
    }

    // Get business tax settings for calculating totals
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('vat_enabled, tax_rate')
      .eq('id', businessId)
      .single();
    
    const taxRate = business?.vat_enabled ? (parseFloat(business.tax_rate) || 0) / 100 : 0;

    let poSubtotal = 0;

    // Process each received item
    for (const received of data.items) {
      const orderItem = order.items?.find(i => i.item_id === received.item_id);
      if (!orderItem) continue;

      // For counted orders, use counted_quantity; for pending orders, use received_quantity
      const finalQuantity = isCounted 
        ? (orderItem.counted_quantity ?? received.received_quantity ?? 0)
        : (received.received_quantity ?? 0);

      // Calculate storage unit cost from total_cost / finalQuantity
      // e.g., 625 SAR / 50 Kg = 12.50 SAR/Kg
      const storageUnitCost = finalQuantity > 0 
        ? received.total_cost / finalQuantity 
        : 0;

      // Update order item with costs and final received quantity
      const updateData: any = {
        received_quantity: finalQuantity,
        total_cost: received.total_cost,
        unit_cost: storageUnitCost,
        updated_at: new Date().toISOString(),
      };

      // Only update variance info if not already set (from counting step) or if legacy pending
      if (!isCounted) {
        updateData.variance_reason = received.variance_reason || null;
        updateData.variance_note = received.variance_note || null;
      }

      await supabaseAdmin
        .from('purchase_order_items')
        .update(updateData)
        .eq('id', orderItem.id);

      poSubtotal += received.total_cost;

      // Get item info for unit conversion
      const { data: itemInfo } = await supabaseAdmin
        .from('items')
        .select('id, name, unit, storage_unit, cost_per_unit, total_stock_quantity, total_stock_value')
        .eq('id', received.item_id)
        .single();

      if (itemInfo && finalQuantity > 0 && received.total_cost > 0) {
        // Convert storage unit cost to serving unit cost for WAC
        // e.g., 12.50 SAR/Kg → 0.0125 SAR/gram
        const storageUnit = (itemInfo.storage_unit || 'Kg') as StorageUnit;
        const servingUnit = (itemInfo.unit || 'grams') as ServingUnit;
        
        let servingUnitCost = storageUnitCost;
        try {
          // Convert 1 storage unit to serving units to get the factor
          const conversionFactor = convertUnits(1, storageUnit, servingUnit);
          servingUnitCost = storageUnitCost / conversionFactor;
        } catch (convErr) {
          // If conversion fails (e.g., same unit), use storage cost as-is
          console.log(`Unit conversion not needed for ${itemInfo.name}: ${storageUnit} to ${servingUnit}`);
        }

        // Get existing inventory for WAC calculation (in serving units)
        const existingQuantity = itemInfo.total_stock_quantity || 0;
        const existingCostPerUnit = itemInfo.cost_per_unit || 0;
        
        // Convert received quantity to serving units for WAC
        let receivedInServingUnits = finalQuantity;
        try {
          receivedInServingUnits = convertUnits(finalQuantity, storageUnit, servingUnit);
        } catch {
          // If conversion fails, use as-is
        }

        // Calculate new Weighted Average Cost (in serving units)
        const newWAC = this.calculateWeightedAverageCost(
          existingQuantity,
          existingCostPerUnit,
          receivedInServingUnits,
          servingUnitCost
        );

        // Calculate new totals for inventory value tracking
        const newTotalQuantity = existingQuantity + receivedInServingUnits;
        const newTotalValue = newTotalQuantity * newWAC;

        // Update item with new WAC (serving unit cost) and inventory values
        await supabaseAdmin
          .from('items')
          .update({
            cost_per_unit: newWAC,
            total_stock_quantity: newTotalQuantity,
            total_stock_value: newTotalValue,
            last_purchase_cost: servingUnitCost,
            last_purchase_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', received.item_id);

        console.log(`WAC Update for item ${received.item_id} (${itemInfo.name}):`, {
          storageUnit,
          servingUnit,
          storageUnitCost,
          servingUnitCost,
          existingQty: existingQuantity,
          existingCost: existingCostPerUnit,
          receivedInServingUnits,
          calculatedWAC: newWAC,
        });

        // Cascade cost update to composite items and products that use this item
        try {
          await inventoryService.cascadeItemCostUpdate(received.item_id, businessId);
        } catch (cascadeErr) {
          console.error(`Failed to cascade cost update for item ${received.item_id}:`, cascadeErr);
        }
      }

      // Add to stock (inventory_stock table for branch-level tracking)
      // Stock is tracked in storage units
      await this.updateStock(
        businessId,
        received.item_id,
        finalQuantity,
        'purchase_receive',
        {
          branchId: order.branch_id || undefined,
          referenceType: 'purchase_order',
          referenceId: orderId,
          unitCost: storageUnitCost,
          userId,
        }
      );
    }

    // Update PO totals and invoice image
    const poTaxAmount = poSubtotal * taxRate;
    const poTotalAmount = poSubtotal + poTaxAmount;

    await supabaseAdmin
      .from('purchase_orders')
      .update({
        invoice_image_url: data.invoice_image_url,
        subtotal: poSubtotal,
        tax_amount: poTaxAmount,
        total_amount: poTotalAmount,
        received_date: new Date().toISOString().split('T')[0],
        received_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // Log activity for received items
    await this.logPOActivity({
      purchaseOrderId: orderId,
      businessId,
      userId,
      action: 'received',
      changes: {
        invoice_image_url: data.invoice_image_url,
        subtotal: poSubtotal,
        total_amount: poTotalAmount,
        items_received: data.items.map(i => ({
          item_id: i.item_id,
          received_quantity: i.received_quantity,
          total_cost: i.total_cost,
          variance_reason: i.variance_reason,
          variance_note: i.variance_note,
        })),
      },
    });

    // Update status to received
    return this.updatePurchaseOrderStatus(orderId, businessId, 'received', userId);
  }

  // ==================== TRANSFERS ====================

  /**
   * Generate transfer number
   */
  private async generateTransferNumber(businessId: number): Promise<string> {
    const { count } = await supabaseAdmin
      .from('inventory_transfers')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `TRF-${year}${month}-${sequence}`;
  }

  /**
   * Get transfers - supports cross-business for owners
   * For PM: filters by current business only
   * For Owner: can see transfers from/to any of their businesses
   */
  async getTransfers(businessId: number, filters?: {
    status?: string;
    fromBranchId?: number;
    toBranchId?: number;
    allOwnerBusinesses?: number[]; // For owners: list of all their business IDs
  }): Promise<InventoryTransfer[]> {
    // Use simple query that works with existing schema (falls back if new columns don't exist)
    let query = supabaseAdmin
      .from('inventory_transfers')
      .select(`
        *,
        from_branch:branches!inventory_transfers_from_branch_id_fkey (id, name, name_ar),
        to_branch:branches!inventory_transfers_to_branch_id_fkey (id, name, name_ar)
      `)
      .eq('business_id', businessId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.fromBranchId) {
      query = query.eq('from_branch_id', filters.fromBranchId);
    }
    if (filters?.toBranchId) {
      query = query.eq('to_branch_id', filters.toBranchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch transfers:', error);
      throw new Error('Failed to fetch transfers');
    }

    return data as InventoryTransfer[];
  }

  /**
   * Get single transfer with items
   * Supports cross-business transfers (owner can access if they own either business)
   */
  async getTransfer(transferId: number, businessId: number, allOwnerBusinesses?: number[]): Promise<InventoryTransfer | null> {
    // Build query to find transfer
    let query = supabaseAdmin
      .from('inventory_transfers')
      .select(`
        *,
        from_branch:branches!inventory_transfers_from_branch_id_fkey (id, name, name_ar, business_id),
        to_branch:branches!inventory_transfers_to_branch_id_fkey (id, name, name_ar, business_id)
      `)
      .eq('id', transferId);

    // If owner has multiple businesses, search across all of them
    if (allOwnerBusinesses && allOwnerBusinesses.length > 0) {
      // Owner can access transfers where any of their businesses is involved
      query = query.or(
        `business_id.in.(${allOwnerBusinesses.join(',')}),` +
        `from_business_id.in.(${allOwnerBusinesses.join(',')}),` +
        `to_business_id.in.(${allOwnerBusinesses.join(',')})`
      );
    } else {
      // For non-owners, check if their business is the source, destination, or creator
      query = query.or(
        `business_id.eq.${businessId},` +
        `from_business_id.eq.${businessId},` +
        `to_business_id.eq.${businessId}`
      );
    }

    const { data: transfer, error } = await query.single();

    if (error || !transfer) return null;

    // Get transfer items
    const { data: items } = await supabaseAdmin
      .from('inventory_transfer_items')
      .select(`
        *,
        items (id, name, name_ar, unit, storage_unit, sku)
      `)
      .eq('transfer_id', transferId);

    return {
      ...transfer,
      items: (items || []).map((i: any) => ({
        ...i,
        item: i.items,
        items: undefined,
      })),
    } as InventoryTransfer;
  }

  /**
   * Create transfer - supports cross-business for owners
   * @param businessId - The initiating business ID
   * @param data - Transfer data including source/destination
   * @param userRole - 'owner' or 'pm' - determines if cross-business is allowed
   * @param ownerBusinesses - For owners: list of all their business IDs for validation
   */
  async createTransfer(businessId: number, data: {
    from_business_id: number;
    from_branch_id: number;
    to_business_id: number;
    to_branch_id: number;
    notes?: string;
    items: { item_id: number; quantity: number }[];
    created_by?: number;
  }, userRole?: string, ownerBusinesses?: number[]): Promise<InventoryTransfer> {
    // Validate source and destination are different
    if (data.from_branch_id === data.to_branch_id) {
      throw new Error('Source and destination branches must be different');
    }

    // For PM role, ensure both source and destination are within the same business
    if (userRole === 'pm' || userRole === 'manager') {
      // PM can only transfer within same business - branches are already validated via getTransferDestinations
    }

    const transferNumber = await this.generateTransferNumber(businessId);

    // Create the transfer with pending status
    // Stock is deducted from source immediately when transfer is created
    const { data: transfer, error } = await supabaseAdmin
      .from('inventory_transfers')
      .insert({
        business_id: businessId,
        from_business_id: data.from_business_id,
        to_business_id: data.to_business_id,
        transfer_number: transferNumber,
        from_branch_id: data.from_branch_id,
        to_branch_id: data.to_branch_id,
        status: 'pending',
        transfer_date: new Date().toISOString().split('T')[0],
        notes: data.notes || null,
        created_by: data.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create transfer:', error);
      throw new Error('Failed to create transfer');
    }

    // Create transfer items
    const itemsToInsert = data.items.map(item => ({
      transfer_id: transfer.id,
      item_id: item.item_id,
      quantity: item.quantity,
      received_quantity: 0,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('inventory_transfer_items')
      .insert(itemsToInsert);

    if (itemsError) {
      await supabaseAdmin.from('inventory_transfers').delete().eq('id', transfer.id);
      console.error('Failed to create transfer items:', itemsError);
      throw new Error('Failed to create transfer items');
    }

    // NOTE: Stock is NOT deducted when transfer is created
    // Stock will be deducted from source and added to destination when transfer is RECEIVED
    // This ensures items remain in source inventory until receiving branch confirms receipt

    return this.getTransfer(transfer.id, businessId, ownerBusinesses) as Promise<InventoryTransfer>;
  }

  /**
   * Receive transfer - marks transfer as received, deducts from source, adds to destination
   * Stock movement happens only when receiving (not when creating transfer)
   */
  async receiveTransfer(
    transferId: number,
    businessId: number,
    receivedItems: { item_id: number; received_quantity: number }[],
    userId?: number,
    allOwnerBusinesses?: number[]
  ): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(transferId, businessId, allOwnerBusinesses);
    if (!transfer) throw new Error('Transfer not found');
    
    if (transfer.status !== 'pending') {
      throw new Error('Transfer is not pending');
    }

    // Determine the source and destination business IDs
    const sourceBusinessId = transfer.from_business_id || 
      (transfer.from_branch as any)?.business_id || 
      transfer.business_id;
    
    const destinationBusinessId = transfer.to_business_id || 
      (transfer.to_branch as any)?.business_id || 
      businessId;

    // Process each received item
    for (const received of receivedItems) {
      const transferItem = transfer.items?.find(i => i.item_id === received.item_id);
      if (!transferItem) continue;

      // Update received quantity
      await supabaseAdmin
        .from('inventory_transfer_items')
        .update({
          received_quantity: received.received_quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferItem.id);

      // DEDUCT from source branch/business using the original transfer quantity
      await this.updateStock(
        sourceBusinessId,
        transferItem.item_id,
        -transferItem.quantity,
        'transfer_out',
        {
          branchId: transfer.from_branch_id || undefined,
          referenceType: 'transfer',
          referenceId: transferId,
          userId,
        }
      );

      // ADD to destination branch/business using the received quantity
      await this.updateStock(
        destinationBusinessId,
        received.item_id,
        received.received_quantity,
        'transfer_in',
        {
          branchId: transfer.to_branch_id || undefined,
          referenceType: 'transfer',
          referenceId: transferId,
          userId,
        }
      );
    }

    // Update status to received
    const { error } = await supabaseAdmin
      .from('inventory_transfers')
      .update({
        status: 'received',
        completed_date: new Date().toISOString().split('T')[0],
        completed_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId);

    if (error) {
      console.error('Failed to receive transfer:', error);
      throw new Error('Failed to receive transfer');
    }

    return this.getTransfer(transferId, businessId, allOwnerBusinesses) as Promise<InventoryTransfer>;
  }

  /**
   * Cancel transfer - simply marks transfer as cancelled
   * No stock movement needed since stock is only moved when transfer is received
   */
  async cancelTransfer(
    transferId: number,
    businessId: number,
    userId?: number,
    allOwnerBusinesses?: number[]
  ): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(transferId, businessId, allOwnerBusinesses);
    if (!transfer) throw new Error('Transfer not found');
    
    if (transfer.status !== 'pending') {
      throw new Error('Can only cancel pending transfers');
    }

    // Update status to cancelled - no stock movement needed
    // Stock is only deducted from source and added to destination when transfer is received
    const { error } = await supabaseAdmin
      .from('inventory_transfers')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId);

    if (error) {
      console.error('Failed to cancel transfer:', error);
      throw new Error('Failed to cancel transfer');
    }

    return this.getTransfer(transferId, businessId, allOwnerBusinesses) as Promise<InventoryTransfer>;
  }

  // ==================== INVENTORY COUNTS ====================

  /**
   * Generate count number
   */
  private async generateCountNumber(businessId: number): Promise<string> {
    const { count } = await supabaseAdmin
      .from('inventory_counts')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `CNT-${year}${month}-${sequence}`;
  }

  /**
   * Get inventory counts
   */
  async getInventoryCounts(businessId: number, filters?: {
    status?: string;
    branchId?: number;
  }): Promise<InventoryCount[]> {
    let query = supabaseAdmin
      .from('inventory_counts')
      .select(`
        *,
        branches (id, name, name_ar)
      `)
      .eq('business_id', businessId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch inventory counts:', error);
      throw new Error('Failed to fetch inventory counts');
    }

    return (data || []).map((c: any) => ({
      ...c,
      branch: c.branches,
      branches: undefined,
    })) as InventoryCount[];
  }

  /**
   * Get single inventory count with items
   */
  async getInventoryCount(countId: number, businessId: number): Promise<InventoryCount | null> {
    const { data: count, error } = await supabaseAdmin
      .from('inventory_counts')
      .select(`
        *,
        branches (id, name, name_ar)
      `)
      .eq('id', countId)
      .eq('business_id', businessId)
      .single();

    if (error || !count) return null;

    // Get count items
    const { data: items } = await supabaseAdmin
      .from('inventory_count_items')
      .select(`
        *,
        items (id, name, name_ar, unit, storage_unit, sku)
      `)
      .eq('count_id', countId);

    return {
      ...count,
      branch: count.branches,
      items: (items || []).map((i: any) => ({
        ...i,
        item: i.items,
        items: undefined,
      })),
      branches: undefined,
    } as InventoryCount;
  }

  /**
   * Create inventory count
   */
  async createInventoryCount(businessId: number, data: {
    branch_id?: number;
    count_type?: 'full' | 'partial' | 'cycle';
    notes?: string;
    item_ids?: number[]; // For partial counts
    created_by?: number;
  }): Promise<InventoryCount> {
    const countNumber = await this.generateCountNumber(businessId);

    const { data: count, error } = await supabaseAdmin
      .from('inventory_counts')
      .insert({
        business_id: businessId,
        branch_id: data.branch_id || null,
        count_number: countNumber,
        count_type: data.count_type || 'full',
        status: 'draft',
        count_date: new Date().toISOString().split('T')[0],
        notes: data.notes || null,
        created_by: data.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create inventory count:', error);
      throw new Error('Failed to create inventory count');
    }

    // Get items to count
    let itemsQuery = supabaseAdmin
      .from('items')
      .select('id')
      .eq('status', 'active')
      .or(`business_id.eq.${businessId},business_id.is.null`);

    if (data.item_ids && data.item_ids.length > 0) {
      itemsQuery = itemsQuery.in('id', data.item_ids);
    }

    const { data: items } = await itemsQuery;

    // Get current stock for each item
    const countItems = [];
    for (const item of items || []) {
      const stock = await this.getOrCreateStock(businessId, item.id, data.branch_id);
      countItems.push({
        count_id: count.id,
        item_id: item.id,
        expected_quantity: stock.quantity,
        counted_quantity: null,
        variance: null,
      });
    }

    if (countItems.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from('inventory_count_items')
        .insert(countItems);

      if (itemsError) {
        console.error('Failed to create count items:', itemsError);
      }
    }

    return this.getInventoryCount(count.id, businessId) as Promise<InventoryCount>;
  }

  /**
   * Update count item by count_id and item_id
   */
  async updateCountItem(
    countId: number,
    itemId: number,
    countedQuantity: number,
    varianceReason?: string,
    userId?: number
  ): Promise<void> {
    // Get the count item to calculate variance
    const { data: item } = await supabaseAdmin
      .from('inventory_count_items')
      .select('id, expected_quantity')
      .eq('count_id', countId)
      .eq('item_id', itemId)
      .single();

    if (!item) {
      throw new Error('Count item not found');
    }

    const variance = countedQuantity - (item?.expected_quantity || 0);

    const { error } = await supabaseAdmin
      .from('inventory_count_items')
      .update({
        counted_quantity: countedQuantity,
        variance,
        variance_reason: varianceReason || null,
        counted_by: userId || null,
        counted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      console.error('Failed to update count item:', error);
      throw new Error('Failed to update count item');
    }
  }

  /**
   * Complete inventory count (apply adjustments)
   */
  async completeInventoryCount(countId: number, businessId: number, userId?: number): Promise<InventoryCount> {
    const count = await this.getInventoryCount(countId, businessId);
    if (!count) throw new Error('Inventory count not found');
    if (count.status === 'completed' || count.status === 'cancelled') {
      throw new Error('Cannot complete this count');
    }

    // Check all items are counted
    const uncounted = count.items?.filter(i => i.counted_quantity === null);
    if (uncounted && uncounted.length > 0) {
      throw new Error(`${uncounted.length} items have not been counted`);
    }

    // Apply adjustments for items with variance
    for (const item of count.items || []) {
      if (item.variance && item.variance !== 0) {
        await this.updateStock(
          businessId,
          item.item_id,
          item.variance,
          'count_adjustment',
          {
            branchId: count.branch_id || undefined,
            referenceType: 'count',
            referenceId: countId,
            notes: item.variance_reason || 'Inventory count adjustment',
            userId,
          }
        );

        // Update last count info on stock
        await supabaseAdmin
          .from('inventory_stock')
          .update({
            last_count_date: new Date().toISOString(),
            last_count_quantity: item.counted_quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('business_id', businessId)
          .eq('item_id', item.item_id)
          .eq('branch_id', count.branch_id || null);
      }
    }

    // Update count status
    const { error } = await supabaseAdmin
      .from('inventory_counts')
      .update({
        status: 'completed',
        completed_date: new Date().toISOString().split('T')[0],
        completed_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', countId);

    if (error) {
      console.error('Failed to complete inventory count:', error);
      throw new Error('Failed to complete inventory count');
    }

    return this.getInventoryCount(countId, businessId) as Promise<InventoryCount>;
  }

  // ==================== MOVEMENTS ====================

  /**
   * Get inventory movements
   */
  async getMovements(businessId: number, filters?: {
    branchId?: number;
    itemId?: number;
    movementType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<InventoryMovement[]> {
    let query = supabaseAdmin
      .from('inventory_movements')
      .select(`
        *,
        items (id, name, name_ar, unit, sku),
        branches (id, name, name_ar)
      `)
      .eq('business_id', businessId);

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }
    if (filters?.itemId) {
      query = query.eq('item_id', filters.itemId);
    }
    if (filters?.movementType) {
      query = query.eq('movement_type', filters.movementType);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch movements:', error);
      throw new Error('Failed to fetch movements');
    }

    return (data || []).map((m: any) => ({
      ...m,
      item: m.items,
      branch: m.branches,
      items: undefined,
      branches: undefined,
    })) as InventoryMovement[];
  }

  // ==================== PO TEMPLATES ====================

  /**
   * Get all PO templates for a business
   */
  async getPOTemplates(businessId: number, filters?: {
    vendor_id?: number;
    is_active?: boolean;
  }): Promise<POTemplate[]> {
    let query = supabaseAdmin
      .from('po_templates')
      .select(`
        *,
        vendors:vendor_id (id, name, name_ar),
        po_template_items (
          id,
          item_id,
          quantity,
          items:item_id (id, name, name_ar, sku, unit, storage_unit, cost_per_unit)
        )
      `)
      .eq('business_id', businessId)
      .order('name');

    if (filters?.vendor_id) {
      query = query.eq('vendor_id', filters.vendor_id);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch PO templates:', error);
      throw new Error('Failed to fetch PO templates');
    }

    return (data || []).map((t: any) => ({
      ...t,
      vendor: t.vendors,
      items: (t.po_template_items || []).map((i: any) => ({
        ...i,
        item: i.items,
        items: undefined,
      })),
      vendors: undefined,
      po_template_items: undefined,
    })) as POTemplate[];
  }

  /**
   * Get a single PO template
   */
  async getPOTemplate(templateId: number, businessId: number): Promise<POTemplate | null> {
    const { data, error } = await supabaseAdmin
      .from('po_templates')
      .select(`
        *,
        vendors:vendor_id (id, name, name_ar),
        po_template_items (
          id,
          item_id,
          quantity,
          items:item_id (id, name, name_ar, sku, unit, storage_unit, cost_per_unit)
        )
      `)
      .eq('id', templateId)
      .eq('business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Failed to fetch PO template:', error);
      throw new Error('Failed to fetch PO template');
    }

    return {
      ...data,
      vendor: data.vendors,
      items: (data.po_template_items || []).map((i: any) => ({
        ...i,
        item: i.items,
        items: undefined,
      })),
      vendors: undefined,
      po_template_items: undefined,
    } as POTemplate;
  }

  /**
   * Create a new PO template
   */
  async createPOTemplate(businessId: number, data: {
    vendor_id: number;
    name: string;
    name_ar?: string;
    notes?: string;
    items: { item_id: number; quantity: number }[];
  }): Promise<POTemplate> {
    // Create template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('po_templates')
      .insert({
        business_id: businessId,
        vendor_id: data.vendor_id,
        name: data.name,
        name_ar: data.name_ar,
        notes: data.notes,
        is_active: true,
      })
      .select()
      .single();

    if (templateError) {
      console.error('Failed to create PO template:', templateError);
      throw new Error('Failed to create PO template');
    }

    // Create template items
    if (data.items && data.items.length > 0) {
      const templateItems = data.items.map(item => ({
        template_id: template.id,
        item_id: item.item_id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('po_template_items')
        .insert(templateItems);

      if (itemsError) {
        console.error('Failed to create template items:', itemsError);
        // Don't fail, template is created
      }
    }

    return this.getPOTemplate(template.id, businessId) as Promise<POTemplate>;
  }

  /**
   * Update a PO template
   */
  async updatePOTemplate(templateId: number, businessId: number, data: {
    name?: string;
    name_ar?: string;
    notes?: string;
    is_active?: boolean;
    items?: { item_id: number; quantity: number }[];
  }): Promise<POTemplate> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.name_ar !== undefined) updateData.name_ar = data.name_ar;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const { error: updateError } = await supabaseAdmin
      .from('po_templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('business_id', businessId);

    if (updateError) {
      console.error('Failed to update PO template:', updateError);
      throw new Error('Failed to update PO template');
    }

    // Update items if provided
    if (data.items) {
      // Delete existing items
      await supabaseAdmin
        .from('po_template_items')
        .delete()
        .eq('template_id', templateId);

      // Insert new items
      if (data.items.length > 0) {
        const templateItems = data.items.map(item => ({
          template_id: templateId,
          item_id: item.item_id,
          quantity: item.quantity,
        }));

        await supabaseAdmin
          .from('po_template_items')
          .insert(templateItems);
      }
    }

    return this.getPOTemplate(templateId, businessId) as Promise<POTemplate>;
  }

  /**
   * Delete a PO template
   */
  async deletePOTemplate(templateId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('po_templates')
      .delete()
      .eq('id', templateId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to delete PO template:', error);
      throw new Error('Failed to delete PO template');
    }
  }

  // ==================== ORDER INVENTORY WORKFLOW ====================

  /**
   * Calculate all ingredients required for an order's items
   * Gets ingredients from product_ingredients table, handles variants and quantities
   * Also handles modifiers: extras (add items) and removals (skip items)
   */
  async calculateOrderIngredients(
    businessId: number,
    orderItems: Array<{
      product_id?: number;
      variant_id?: number;
      quantity: number;
      product_name?: string;
      modifiers?: Array<{
        modifier_id?: number;
        modifier_name: string;
        modifier_type: string; // 'extra' or 'removal'
        quantity: number;
      }>;
    }>
  ): Promise<IngredientRequirement[]> {
    const ingredients: IngredientRequirement[] = [];

    for (const orderItem of orderItems) {
      if (!orderItem.product_id) continue;

      let productIngredients: any[] = [];
      let error: any = null;

      if (orderItem.variant_id) {
        // Get variant-specific ingredients
        const result = await supabaseAdmin
          .from('product_ingredients')
          .select(`
            item_id,
            quantity,
            variant_id,
            items:item_id (
              id,
              name,
              name_ar,
              unit,
              storage_unit
            )
          `)
          .eq('product_id', orderItem.product_id)
          .eq('variant_id', orderItem.variant_id);
        
        productIngredients = result.data || [];
        error = result.error;
      } else {
        // First try to get product-level ingredients (no variant)
        const productLevelResult = await supabaseAdmin
          .from('product_ingredients')
          .select(`
            item_id,
            quantity,
            variant_id,
            items:item_id (
              id,
              name,
              name_ar,
              unit,
              storage_unit
            )
          `)
          .eq('product_id', orderItem.product_id)
          .is('variant_id', null);
        
        productIngredients = productLevelResult.data || [];
        error = productLevelResult.error;
        
        // If no product-level ingredients found, get ingredients from the default variant
        if (!error && productIngredients.length === 0) {
          // First try to find a variant named "Original" (case-insensitive)
          let { data: defaultVariant } = await supabaseAdmin
            .from('product_variants')
            .select('id, name')
            .eq('product_id', orderItem.product_id)
            .ilike('name', 'original')
            .limit(1)
            .single();
          
          // If no "Original" variant, get the first variant by sort_order
          if (!defaultVariant) {
            const { data: firstVariant } = await supabaseAdmin
              .from('product_variants')
              .select('id, name')
              .eq('product_id', orderItem.product_id)
              .order('sort_order', { ascending: true })
              .order('id', { ascending: true })
              .limit(1)
              .single();
            defaultVariant = firstVariant;
          }
          
          if (defaultVariant) {
            const variantResult = await supabaseAdmin
              .from('product_ingredients')
              .select(`
                item_id,
                quantity,
                variant_id,
                items:item_id (
                  id,
                  name,
                  name_ar,
                  unit,
                  storage_unit
                )
              `)
              .eq('product_id', orderItem.product_id)
              .eq('variant_id', defaultVariant.id);
            
            productIngredients = variantResult.data || [];
            error = variantResult.error;
          }
        }
      }

      if (error) {
        console.error(`Failed to get ingredients for product ${orderItem.product_id}:`, error);
        continue;
      }

      // Build a set of removed item names (case-insensitive) to skip
      const removedItemNames = new Set<string>();
      if (orderItem.modifiers) {
        for (const mod of orderItem.modifiers) {
          if (mod.modifier_type === 'removal') {
            removedItemNames.add(mod.modifier_name.toLowerCase());
          }
        }
      }

      for (const ing of productIngredients) {
        const item = ing.items as any;
        if (!item) continue;

        // Skip this ingredient if it was marked as removed
        if (removedItemNames.has(item.name.toLowerCase())) {
          continue;
        }

        const servingUnit = item.unit || 'grams';
        const storageUnit = item.storage_unit || servingUnit;
        
        // product_ingredients.quantity is ALREADY in storage units (e.g., 0.030 Kg, not 30 grams)
        // Just multiply by order quantity - NO unit conversion needed
        const quantityInStorage = ing.quantity * orderItem.quantity;

        // Check if this ingredient already exists (aggregate)
        const existing = ingredients.find(i => i.item_id === ing.item_id);
        if (existing) {
          existing.quantity += quantityInStorage;
          existing.quantity_in_storage += quantityInStorage;
        } else {
          ingredients.push({
            item_id: ing.item_id,
            item_name: item.name,
            quantity: quantityInStorage,
            serving_unit: servingUnit,
            storage_unit: storageUnit,
            quantity_in_storage: quantityInStorage,
            product_id: orderItem.product_id,
            product_name: orderItem.product_name,
            variant_id: orderItem.variant_id,
          });
        }
      }

      // Handle extra modifiers - add their items to the ingredients
      if (orderItem.modifiers) {
        for (const mod of orderItem.modifiers) {
          if (mod.modifier_type === 'extra') {
            let modifierData: any = null;

            if (mod.modifier_id) {
              // Get by modifier_id if available
              const { data } = await supabaseAdmin
                .from('product_modifiers')
                .select(`
                  item_id,
                  quantity,
                  items:item_id (
                    id,
                    name,
                    unit,
                    storage_unit
                  )
                `)
                .eq('id', mod.modifier_id)
                .single();
              modifierData = data;
            } else if (mod.modifier_name && orderItem.product_id) {
              // Fallback: lookup by name and product_id
              const { data } = await supabaseAdmin
                .from('product_modifiers')
                .select(`
                  item_id,
                  quantity,
                  items:item_id (
                    id,
                    name,
                    unit,
                    storage_unit
                  )
                `)
                .eq('product_id', orderItem.product_id)
                .ilike('name', mod.modifier_name)
                .single();
              modifierData = data;
            }

            if (modifierData?.item_id && modifierData?.items) {
              const item = modifierData.items as any;
              const storageUnit = item.storage_unit || item.unit || 'piece';
              
              // product_modifiers.quantity is the amount per extra (already in storage units)
              // e.g., 1 piece of cheese per extra
              const perExtraQty = modifierData.quantity || 1;
              
              // Extra quantity = per_extra_qty × modifier_count × order_qty
              // e.g., 1 piece × 2 extras × 1 burger = 2 pieces
              const extraQuantity = perExtraQty * (mod.quantity || 1) * orderItem.quantity;

              // Add to existing or create new
              const existing = ingredients.find(i => i.item_id === modifierData.item_id);
              if (existing) {
                existing.quantity += extraQuantity;
                existing.quantity_in_storage += extraQuantity;
              } else {
                ingredients.push({
                  item_id: modifierData.item_id,
                  item_name: item.name,
                  quantity: extraQuantity,
                  serving_unit: item.unit || 'piece',
                  storage_unit: storageUnit,
                  quantity_in_storage: extraQuantity,
                  product_id: orderItem.product_id,
                  product_name: `${orderItem.product_name} (extra: ${mod.modifier_name})`,
                  variant_id: orderItem.variant_id,
                });
              }
            }
          }
        }
      }
    }

    return ingredients;
  }

  /**
   * Reserve ingredients for an order
   * Increases reserved_quantity for each ingredient needed
   */
  async reserveForOrder(
    businessId: number,
    branchId: number | undefined,
    orderItems: Array<{
      product_id?: number;
      variant_id?: number;
      quantity: number;
      product_name?: string;
    }>,
    orderId: number,
    userId?: number
  ): Promise<{ success: boolean; reserved: IngredientRequirement[] }> {
    const ingredients = await this.calculateOrderIngredients(businessId, orderItems);

    for (const ing of ingredients) {
      // Get or create stock record
      const stock = await this.getOrCreateStock(businessId, ing.item_id, branchId);
      
      // Update reserved_quantity
      const newReservedQty = (stock.reserved_quantity || 0) + ing.quantity_in_storage;
      
      const { error } = await supabaseAdmin
        .from('inventory_stock')
        .update({
          reserved_quantity: newReservedQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stock.id);

      if (error) {
        console.error(`Failed to reserve ingredient ${ing.item_id}:`, error);
        throw new Error(`Failed to reserve ingredient: ${ing.item_name}`);
      }

      // Log the reservation movement (optional - for audit)
      await supabaseAdmin
        .from('inventory_movements')
        .insert({
          business_id: businessId,
          branch_id: branchId || null,
          item_id: ing.item_id,
          movement_type: 'sale_reserve',
          reference_type: 'order',
          reference_id: orderId,
          quantity: ing.quantity_in_storage,
          quantity_before: stock.reserved_quantity || 0,
          quantity_after: newReservedQty,
          notes: `Reserved for order #${orderId}`,
          created_by: userId || null,
        });
    }

    return { success: true, reserved: ingredients };
  }

  /**
   * Release reserved ingredients (for cancelled orders or removed items)
   * Decreases reserved_quantity without touching actual quantity
   */
  async releaseReservation(
    businessId: number,
    branchId: number | undefined,
    ingredients: Array<{ item_id: number; quantity_in_storage: number; item_name?: string }>,
    orderId: number,
    userId?: number,
    reason?: string
  ): Promise<void> {
    for (const ing of ingredients) {
      const stock = await this.getOrCreateStock(businessId, ing.item_id, branchId);
      
      // Decrease reserved_quantity (don't go below 0)
      const newReservedQty = Math.max(0, (stock.reserved_quantity || 0) - ing.quantity_in_storage);
      
      const { error } = await supabaseAdmin
        .from('inventory_stock')
        .update({
          reserved_quantity: newReservedQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stock.id);

      if (error) {
        console.error(`Failed to release reservation for item ${ing.item_id}:`, error);
        throw new Error(`Failed to release reservation: ${ing.item_name || ing.item_id}`);
      }

      // Log the release movement
      await supabaseAdmin
        .from('inventory_movements')
        .insert({
          business_id: businessId,
          branch_id: branchId || null,
          item_id: ing.item_id,
          movement_type: 'sale_cancel_return',
          reference_type: 'order',
          reference_id: orderId,
          quantity: -ing.quantity_in_storage,
          quantity_before: stock.reserved_quantity || 0,
          quantity_after: newReservedQty,
          notes: reason || `Released reservation for order #${orderId}`,
          created_by: userId || null,
        });
    }
  }

  /**
   * Consume stock when order is completed
   * Decreases both quantity and reserved_quantity, logs sale_consume movement
   */
  async consumeForOrder(
    businessId: number,
    branchId: number | undefined,
    orderItems: Array<{
      product_id?: number;
      variant_id?: number;
      quantity: number;
      product_name?: string;
    }>,
    orderId: number,
    userId?: number,
    orderNumber?: string
  ): Promise<{ success: boolean; consumed: IngredientRequirement[] }> {
    // Use order_number for display, fallback to orderId
    const orderRef = orderNumber || `#${orderId}`;
    const ingredients = await this.calculateOrderIngredients(businessId, orderItems);

    if (ingredients.length === 0) {
      return { success: true, consumed: [] };
    }

    for (const ing of ingredients) {
      // Find stock with actual quantity - first try specified branch, then any branch with stock
      let stock = await this.getOrCreateStock(businessId, ing.item_id, branchId);
      
      // If the stock has 0 quantity and no branch was specified, look for stock in any branch
      if (stock.quantity === 0 && !branchId) {
        const { data: stockWithQty } = await supabaseAdmin
          .from('inventory_stock')
          .select('*')
          .eq('business_id', businessId)
          .eq('item_id', ing.item_id)
          .gt('quantity', 0)
          .order('quantity', { ascending: false })
          .limit(1)
          .single();
        
        if (stockWithQty) {
          stock = stockWithQty;
        }
      }
      
      const quantityBefore = stock.quantity;
      const reservedBefore = stock.reserved_quantity || 0;
      
      // Deduct from both quantity and reserved_quantity
      const newQuantity = Math.max(0, quantityBefore - ing.quantity_in_storage);
      const newReservedQty = Math.max(0, reservedBefore - ing.quantity_in_storage);
      
      const { error } = await supabaseAdmin
        .from('inventory_stock')
        .update({
          quantity: newQuantity,
          reserved_quantity: newReservedQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stock.id);

      if (error) {
        console.error(`Failed to consume ingredient ${ing.item_id}:`, error);
        throw new Error(`Failed to consume ingredient: ${ing.item_name}`);
      }

      // Use the actual branch where stock was consumed (might differ from order branch if order has no branch)
      const consumedFromBranchId = stock.branch_id;

      // Log the consumption movement
      await supabaseAdmin
        .from('inventory_movements')
        .insert({
          business_id: businessId,
          branch_id: consumedFromBranchId,
          item_id: ing.item_id,
          movement_type: 'sale_consume',
          reference_type: 'order',
          reference_id: orderId,
          quantity: -ing.quantity_in_storage,
          quantity_before: quantityBefore,
          quantity_after: newQuantity,
          notes: `Consumed for completed order ${orderRef}`,
          created_by: userId || null,
        });

      // Also record in inventory_transactions for timeline
      try {
        const { data: itemInfo } = await supabaseAdmin
          .from('items')
          .select('storage_unit, unit')
          .eq('id', ing.item_id)
          .single();

        await supabaseAdmin
          .from('inventory_transactions')
          .insert({
            business_id: businessId,
            branch_id: consumedFromBranchId,
            item_id: ing.item_id,
            transaction_type: 'order_sale',
            quantity: ing.quantity_in_storage,
            unit: itemInfo?.storage_unit || itemInfo?.unit || 'unit',
            reference_type: 'order',
            reference_id: orderId,
            notes: `Consumed for order ${orderRef}`,
            performed_by: userId || null,
            quantity_before: quantityBefore,
            quantity_after: newQuantity,
          });
      } catch (txError) {
        console.error('Failed to log inventory transaction for order consumption:', txError);
      }
    }

    return { success: true, consumed: ingredients };
  }

  /**
   * Process waste for cancelled items
   * Deducts from quantity and reserved_quantity, logs as waste
   */
  async processWaste(
    businessId: number,
    branchId: number | undefined,
    items: Array<{ item_id: number; quantity_in_storage: number; item_name?: string }>,
    orderId: number,
    userId?: number,
    reason?: string
  ): Promise<void> {
    for (const item of items) {
      const stock = await this.getOrCreateStock(businessId, item.item_id, branchId);
      
      const quantityBefore = stock.quantity;
      const reservedBefore = stock.reserved_quantity || 0;
      
      // Deduct from both quantity and reserved_quantity
      const newQuantity = Math.max(0, quantityBefore - item.quantity_in_storage);
      const newReservedQty = Math.max(0, reservedBefore - item.quantity_in_storage);
      
      const { error } = await supabaseAdmin
        .from('inventory_stock')
        .update({
          quantity: newQuantity,
          reserved_quantity: newReservedQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stock.id);

      if (error) {
        console.error(`Failed to process waste for item ${item.item_id}:`, error);
        throw new Error(`Failed to process waste: ${item.item_name || item.item_id}`);
      }

      // Log the waste movement
      await supabaseAdmin
        .from('inventory_movements')
        .insert({
          business_id: businessId,
          branch_id: branchId || null,
          item_id: item.item_id,
          movement_type: 'sale_cancel_waste',
          reference_type: 'order',
          reference_id: orderId,
          quantity: -item.quantity_in_storage,
          quantity_before: quantityBefore,
          quantity_after: newQuantity,
          notes: reason || `Waste from cancelled order #${orderId}`,
          created_by: userId || null,
        });

      // Also record in inventory_transactions for timeline
      try {
        const { data: itemInfo } = await supabaseAdmin
          .from('items')
          .select('storage_unit, unit')
          .eq('id', item.item_id)
          .single();

        await supabaseAdmin
          .from('inventory_transactions')
          .insert({
            business_id: businessId,
            branch_id: branchId || null,
            item_id: item.item_id,
            transaction_type: 'manual_deduction',
            quantity: item.quantity_in_storage,
            unit: itemInfo?.storage_unit || itemInfo?.unit || 'unit',
            deduction_reason: 'spoiled',
            reference_type: 'order',
            reference_id: orderId,
            notes: reason || `Waste from cancelled order #${orderId}`,
            performed_by: userId || null,
            quantity_before: quantityBefore,
            quantity_after: newQuantity,
          });
      } catch (txError) {
        console.error('Failed to log inventory transaction for waste:', txError);
      }
    }
  }

  /**
   * Get available quantity (quantity - reserved - held)
   */
  async getAvailableQuantity(
    businessId: number,
    itemId: number,
    branchId?: number
  ): Promise<number> {
    const stock = await this.getOrCreateStock(businessId, itemId, branchId);
    const available = stock.quantity - (stock.reserved_quantity || 0) - (stock.held_quantity || 0);
    return Math.max(0, available);
  }

  /**
   * Deduct from actual stock quantity ONLY (for waste when reservation already released)
   * Used when kitchen marks cancelled order items as waste after reservation was already released
   * NOTE: This method is deprecated - use releaseAndDeductWaste() instead
   */
  async deductWasteOnly(
    businessId: number,
    branchId: number | undefined,
    items: Array<{ item_id: number; quantity_in_storage: number; item_name?: string }>,
    orderId: number,
    userId?: number,
    reason?: string
  ): Promise<void> {
    for (const item of items) {
      const stock = await this.getOrCreateStock(businessId, item.item_id, branchId);
      
      const quantityBefore = stock.quantity;
      
      // Only deduct from quantity (reservation was already released separately)
      const newQuantity = Math.max(0, quantityBefore - item.quantity_in_storage);
      
      const { error } = await supabaseAdmin
        .from('inventory_stock')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stock.id);

      if (error) {
        console.error(`Failed to deduct waste for item ${item.item_id}:`, error);
        throw new Error(`Failed to deduct waste: ${item.item_name || item.item_id}`);
      }

      // Log the waste movement
      await supabaseAdmin
        .from('inventory_movements')
        .insert({
          business_id: businessId,
          branch_id: branchId || null,
          item_id: item.item_id,
          movement_type: 'sale_cancel_waste',
          reference_type: 'order',
          reference_id: orderId,
          quantity: -item.quantity_in_storage,
          quantity_before: quantityBefore,
          quantity_after: newQuantity,
          notes: reason || `Waste from cancelled order #${orderId}`,
          created_by: userId || null,
        });
    }
  }

  /**
   * Release reservation AND deduct from actual stock (for waste decision)
   * Used when kitchen marks cancelled order items as WASTE
   * 1. Decreases reserved_quantity (releases the lock)
   * 2. Decreases quantity (physical stock is wasted)
   */
  async releaseAndDeductWaste(
    businessId: number,
    branchId: number | undefined,
    items: Array<{ item_id: number; quantity_in_storage: number; item_name?: string }>,
    orderId: number,
    userId?: number,
    reason?: string
  ): Promise<void> {
    for (const item of items) {
      const stock = await this.getOrCreateStock(businessId, item.item_id, branchId);
      
      const quantityBefore = stock.quantity;
      const reservedBefore = stock.reserved_quantity || 0;
      
      // Decrease both quantity AND reserved_quantity
      const newQuantity = Math.max(0, quantityBefore - item.quantity_in_storage);
      const newReservedQty = Math.max(0, reservedBefore - item.quantity_in_storage);
      
      const { error } = await supabaseAdmin
        .from('inventory_stock')
        .update({
          quantity: newQuantity,
          reserved_quantity: newReservedQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stock.id);

      if (error) {
        console.error(`Failed to release and deduct waste for item ${item.item_id}:`, error);
        throw new Error(`Failed to release and deduct waste: ${item.item_name || item.item_id}`);
      }

      // Log the waste movement (covers both reservation release and stock deduction)
      await supabaseAdmin
        .from('inventory_movements')
        .insert({
          business_id: businessId,
          branch_id: branchId || null,
          item_id: item.item_id,
          movement_type: 'sale_cancel_waste',
          reference_type: 'order',
          reference_id: orderId,
          quantity: -item.quantity_in_storage,
          quantity_before: quantityBefore,
          quantity_after: newQuantity,
          notes: reason || `Waste from cancelled order #${orderId} - reservation released + stock deducted`,
          created_by: userId || null,
        });
    }
  }
}

export const inventoryStockService = new InventoryStockService();

