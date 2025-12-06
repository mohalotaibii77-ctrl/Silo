/**
 * INVENTORY STOCK MANAGEMENT SERVICE
 * Handles vendors, purchase orders, transfers, and inventory counts
 */

import { supabaseAdmin } from '../config/database';
import { inventoryService } from './inventory.service';

// ==================== TYPES ====================

export interface Vendor {
  id: number;
  business_id: number;
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
}

export interface InventoryStock {
  id: number;
  business_id: number;
  branch_id?: number | null;
  item_id: number;
  quantity: number;
  reserved_quantity: number;
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
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'partial' | 'received' | 'cancelled';
  order_date: string;
  expected_date?: string | null;
  received_date?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string | null;
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
  unit_cost: number;
  total_cost: number;
  notes?: string | null;
  // Joined data
  item?: any;
}

export interface InventoryTransfer {
  id: number;
  business_id: number;
  transfer_number: string;
  from_branch_id?: number | null;
  to_branch_id?: number | null;
  status: 'draft' | 'pending' | 'in_transit' | 'completed' | 'cancelled';
  transfer_date: string;
  expected_date?: string | null;
  completed_date?: string | null;
  notes?: string | null;
  created_by?: number | null;
  approved_by?: number | null;
  completed_by?: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
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
  action: 'created' | 'status_changed' | 'items_updated' | 'notes_updated' | 'cancelled' | 'received';
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
   */
  async getVendors(businessId: number, filters?: {
    status?: 'active' | 'inactive';
    search?: string;
  }): Promise<Vendor[]> {
    let query = supabaseAdmin
      .from('vendors')
      .select('*')
      .eq('business_id', businessId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,name_ar.ilike.%${filters.search}%,code.ilike.%${filters.search}%,contact_person.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error('Failed to fetch vendors:', error);
      throw new Error('Failed to fetch vendors');
    }

    return data as Vendor[];
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
   */
  async createVendor(businessId: number, data: {
    name: string;
    name_ar?: string;
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
   */
  async getStockLevels(businessId: number, filters?: {
    branchId?: number;
    itemId?: number;
    lowStock?: boolean;
  }): Promise<InventoryStock[]> {
    let query = supabaseAdmin
      .from('inventory_stock')
      .select(`
        *,
        items (id, name, name_ar, unit, storage_unit, category, sku),
        branches (id, name, name_ar)
      `)
      .eq('business_id', businessId);

    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    if (filters?.itemId) {
      query = query.eq('item_id', filters.itemId);
    }

    const { data, error } = await query.order('item_id');

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
    }));

    // Filter low stock if requested
    if (filters?.lowStock) {
      stocks = stocks.filter((s: InventoryStock) => s.quantity <= s.min_quantity);
    }

    return stocks as InventoryStock[];
  }

  /**
   * Get or create stock record for an item
   */
  async getOrCreateStock(businessId: number, itemId: number, branchId?: number): Promise<InventoryStock> {
    const { data: existing } = await supabaseAdmin
      .from('inventory_stock')
      .select('*')
      .eq('business_id', businessId)
      .eq('item_id', itemId)
      .eq('branch_id', branchId || null)
      .single();

    if (existing) return existing as InventoryStock;

    const { data: newStock, error } = await supabaseAdmin
      .from('inventory_stock')
      .insert({
        business_id: businessId,
        branch_id: branchId || null,
        item_id: itemId,
        quantity: 0,
        reserved_quantity: 0,
        min_quantity: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create stock record:', error);
      throw new Error('Failed to create stock record');
    }

    return newStock as InventoryStock;
  }

  /**
   * Update stock quantity
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
    const quantityAfter = quantityBefore + quantityChange;

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

    // Record movement
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
   */
  async getPurchaseOrders(businessId: number, filters?: {
    status?: string;
    vendorId?: number;
    branchId?: number;
  }): Promise<PurchaseOrder[]> {
    let query = supabaseAdmin
      .from('purchase_orders')
      .select(`
        *,
        vendors (id, name, name_ar, code),
        branches (id, name, name_ar)
      `)
      .eq('business_id', businessId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.vendorId) {
      query = query.eq('vendor_id', filters.vendorId);
    }
    if (filters?.branchId) {
      query = query.eq('branch_id', filters.branchId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch purchase orders:', error);
      throw new Error('Failed to fetch purchase orders');
    }

    return (data || []).map((po: any) => ({
      ...po,
      vendor: po.vendors,
      branch: po.branches,
      vendors: undefined,
      branches: undefined,
    })) as PurchaseOrder[];
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
   */
  async createPurchaseOrder(businessId: number, data: {
    vendor_id: number;
    branch_id?: number;
    expected_date?: string;
    notes?: string;
    items: { item_id: number; quantity: number; unit_cost: number }[];
    created_by?: number;
  }): Promise<PurchaseOrder> {
    const orderNumber = await this.generatePONumber(businessId);

    // Get business tax settings
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('vat_enabled, tax_rate')
      .eq('id', businessId)
      .single();
    
    const taxRate = business?.vat_enabled ? (parseFloat(business.tax_rate) || 0) / 100 : 0;

    // Calculate totals
    let subtotal = 0;
    const orderItems = data.items.map(item => {
      const totalCost = item.quantity * item.unit_cost;
      subtotal += totalCost;
      return { ...item, total_cost: totalCost };
    });

    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    // Create order
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
        subtotal,
        tax_amount: taxAmount,
        discount_amount: 0,
        total_amount: totalAmount,
        notes: data.notes || null,
        created_by: data.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create purchase order:', error);
      throw new Error('Failed to create purchase order');
    }

    // Create order items
    const itemsToInsert = orderItems.map(item => ({
      purchase_order_id: order.id,
      item_id: item.item_id,
      quantity: item.quantity,
      received_quantity: 0,
      unit_cost: item.unit_cost,
      total_cost: item.total_cost,
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
        total_amount: totalAmount,
      },
    });

    return this.getPurchaseOrder(order.id, businessId) as Promise<PurchaseOrder>;
  }

  /**
   * Update purchase order status
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
    
    const oldStatus = currentOrder.status;
    const updates: any = { status, updated_at: new Date().toISOString() };

    if (status === 'approved') {
      updates.approved_by = userId;
    } else if (status === 'received') {
      updates.received_by = userId;
      updates.received_date = new Date().toISOString().split('T')[0];
    }

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
   * Update purchase order details (notes, expected date, items)
   */
  async updatePurchaseOrder(
    orderId: number,
    businessId: number,
    data: {
      notes?: string;
      expected_date?: string;
      items?: { item_id: number; quantity: number; unit_cost: number }[];
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

    // Update items if provided
    if (data.items && data.items.length > 0) {
      // Get business tax settings
      const { data: business } = await supabaseAdmin
        .from('businesses')
        .select('vat_enabled, tax_rate')
        .eq('id', businessId)
        .single();
      
      const taxRate = business?.vat_enabled ? (parseFloat(business.tax_rate) || 0) / 100 : 0;

      // Calculate new totals
      let subtotal = 0;
      const orderItems = data.items.map(item => {
        const totalCost = item.quantity * item.unit_cost;
        subtotal += totalCost;
        return { ...item, total_cost: totalCost };
      });

      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount;

      updates.subtotal = subtotal;
      updates.tax_amount = taxAmount;
      updates.total_amount = totalAmount;

      // Delete old items and insert new ones
      await supabaseAdmin
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', orderId);

      const itemsToInsert = orderItems.map(item => ({
        purchase_order_id: orderId,
        item_id: item.item_id,
        quantity: item.quantity,
        received_quantity: 0,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
      }));

      await supabaseAdmin
        .from('purchase_order_items')
        .insert(itemsToInsert);

      changes.items = {
        old_count: currentOrder.items?.length || 0,
        new_count: data.items.length,
        old_total: currentOrder.total_amount,
        new_total: totalAmount,
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
    return Math.round(wac * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Receive purchase order (add items to stock)
   * Uses Weighted Average Cost (WAC) for cost calculation
   */
  async receivePurchaseOrder(
    orderId: number,
    businessId: number,
    receivedItems: { item_id: number; received_quantity: number }[],
    userId?: number
  ): Promise<PurchaseOrder> {
    const order = await this.getPurchaseOrder(orderId, businessId);
    if (!order) throw new Error('Purchase order not found');
    if (order.status === 'received' || order.status === 'cancelled') {
      throw new Error('Cannot receive this order');
    }

    // Update received quantities and add to stock
    for (const received of receivedItems) {
      const orderItem = order.items?.find(i => i.item_id === received.item_id);
      if (!orderItem) continue;

      // Update order item received quantity
      await supabaseAdmin
        .from('purchase_order_items')
        .update({
          received_quantity: received.received_quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderItem.id);

      // Calculate Weighted Average Cost (WAC) and update item
      if (orderItem.unit_cost && orderItem.unit_cost > 0) {
        // Get current item data for WAC calculation
        const { data: currentItem } = await supabaseAdmin
          .from('items')
          .select('cost_per_unit, total_stock_quantity, total_stock_value')
          .eq('id', received.item_id)
          .eq('business_id', businessId)
          .single();

        const existingQuantity = currentItem?.total_stock_quantity || 0;
        const existingCostPerUnit = currentItem?.cost_per_unit || 0;
        const newQuantity = received.received_quantity;
        const newCostPerUnit = orderItem.unit_cost;

        // Calculate new Weighted Average Cost
        const newWAC = this.calculateWeightedAverageCost(
          existingQuantity,
          existingCostPerUnit,
          newQuantity,
          newCostPerUnit
        );

        // Calculate new totals for inventory value tracking
        const newTotalQuantity = existingQuantity + newQuantity;
        const newTotalValue = newTotalQuantity * newWAC;

        // Update item with new WAC and inventory values
        await supabaseAdmin
          .from('items')
          .update({
            cost_per_unit: newWAC,
            total_stock_quantity: newTotalQuantity,
            total_stock_value: newTotalValue,
            last_purchase_cost: newCostPerUnit,
            last_purchase_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', received.item_id)
          .eq('business_id', businessId);

        console.log(`WAC Update for item ${received.item_id}:`, {
          existingQty: existingQuantity,
          existingCost: existingCostPerUnit,
          newQty: newQuantity,
          newCost: newCostPerUnit,
          calculatedWAC: newWAC,
        });

        // Cascade cost update to composite items and products that use this item
        try {
          await inventoryService.cascadeItemCostUpdate(received.item_id, businessId);
        } catch (cascadeErr) {
          console.error(`Failed to cascade cost update for item ${received.item_id}:`, cascadeErr);
          // Don't fail the whole operation if cascade fails
        }
      }

      // Add to stock (inventory_stock table for branch-level tracking)
      await this.updateStock(
        businessId,
        received.item_id,
        received.received_quantity,
        'purchase_receive',
        {
          branchId: order.branch_id || undefined,
          referenceType: 'purchase_order',
          referenceId: orderId,
          unitCost: orderItem.unit_cost,
          userId,
        }
      );
    }

    // Log activity for received items
    await this.logPOActivity({
      purchaseOrderId: orderId,
      businessId,
      userId,
      action: 'received',
      changes: {
        items_received: receivedItems.map(i => ({
          item_id: i.item_id,
          quantity: i.received_quantity,
        })),
      },
    });

    // Check if all items received
    const updatedOrder = await this.getPurchaseOrder(orderId, businessId);
    const allReceived = updatedOrder?.items?.every(i => i.received_quantity >= i.quantity);
    const partialReceived = updatedOrder?.items?.some(i => i.received_quantity > 0);

    let newStatus = order.status;
    if (allReceived) {
      newStatus = 'received';
    } else if (partialReceived) {
      newStatus = 'partial';
    }

    return this.updatePurchaseOrderStatus(orderId, businessId, newStatus, userId);
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
   * Get transfers
   */
  async getTransfers(businessId: number, filters?: {
    status?: string;
    fromBranchId?: number;
    toBranchId?: number;
  }): Promise<InventoryTransfer[]> {
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
   */
  async getTransfer(transferId: number, businessId: number): Promise<InventoryTransfer | null> {
    const { data: transfer, error } = await supabaseAdmin
      .from('inventory_transfers')
      .select(`
        *,
        from_branch:branches!inventory_transfers_from_branch_id_fkey (id, name, name_ar),
        to_branch:branches!inventory_transfers_to_branch_id_fkey (id, name, name_ar)
      `)
      .eq('id', transferId)
      .eq('business_id', businessId)
      .single();

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
   * Create transfer
   */
  async createTransfer(businessId: number, data: {
    from_branch_id: number;
    to_branch_id: number;
    expected_date?: string;
    notes?: string;
    items: { item_id: number; quantity: number }[];
    created_by?: number;
  }): Promise<InventoryTransfer> {
    if (data.from_branch_id === data.to_branch_id) {
      throw new Error('Source and destination branches must be different');
    }

    const transferNumber = await this.generateTransferNumber(businessId);

    const { data: transfer, error } = await supabaseAdmin
      .from('inventory_transfers')
      .insert({
        business_id: businessId,
        transfer_number: transferNumber,
        from_branch_id: data.from_branch_id,
        to_branch_id: data.to_branch_id,
        status: 'draft',
        transfer_date: new Date().toISOString().split('T')[0],
        expected_date: data.expected_date || null,
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

    return this.getTransfer(transfer.id, businessId) as Promise<InventoryTransfer>;
  }

  /**
   * Start transfer (deduct from source)
   */
  async startTransfer(transferId: number, businessId: number, userId?: number): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(transferId, businessId);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'draft' && transfer.status !== 'pending') {
      throw new Error('Cannot start this transfer');
    }

    // Deduct from source branch
    for (const item of transfer.items || []) {
      await this.updateStock(
        businessId,
        item.item_id,
        -item.quantity,
        'transfer_out',
        {
          branchId: transfer.from_branch_id || undefined,
          referenceType: 'transfer',
          referenceId: transferId,
          userId,
        }
      );
    }

    // Update status
    const { error } = await supabaseAdmin
      .from('inventory_transfers')
      .update({ status: 'in_transit', updated_at: new Date().toISOString() })
      .eq('id', transferId);

    if (error) {
      console.error('Failed to start transfer:', error);
      throw new Error('Failed to start transfer');
    }

    return this.getTransfer(transferId, businessId) as Promise<InventoryTransfer>;
  }

  /**
   * Complete transfer (add to destination)
   */
  async completeTransfer(
    transferId: number,
    businessId: number,
    receivedItems: { item_id: number; received_quantity: number }[],
    userId?: number
  ): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(transferId, businessId);
    if (!transfer) throw new Error('Transfer not found');
    if (transfer.status !== 'in_transit') {
      throw new Error('Transfer is not in transit');
    }

    // Add to destination branch
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

      // Add to destination stock
      await this.updateStock(
        businessId,
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

    // Update status
    const { error } = await supabaseAdmin
      .from('inventory_transfers')
      .update({
        status: 'completed',
        completed_date: new Date().toISOString().split('T')[0],
        completed_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId);

    if (error) {
      console.error('Failed to complete transfer:', error);
      throw new Error('Failed to complete transfer');
    }

    return this.getTransfer(transferId, businessId) as Promise<InventoryTransfer>;
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
}

export const inventoryStockService = new InventoryStockService();

