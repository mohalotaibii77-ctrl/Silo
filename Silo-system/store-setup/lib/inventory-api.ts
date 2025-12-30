/**
 * INVENTORY STOCK MANAGEMENT API
 * Vendors, Purchase Orders, Transfers, Inventory Counts
 */

import api from './api';

// ==================== TYPES ====================

export interface Vendor {
  id: number;
  business_id: number;
  branch_id?: number | null; // null = available to all branches
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
  branch?: { id: number; name: string; name_ar?: string } | null;
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
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    unit: string;
    storage_unit?: string;
    category: string;
    sku?: string;
  };
  branch?: {
    id: number;
    name: string;
    name_ar?: string;
  };
}

export interface PurchaseOrder {
  id: number;
  business_id: number;
  branch_id?: number | null;
  vendor_id: number;
  order_number: string;
  status: 'draft' | 'pending' | 'delivered' | 'cancelled' | 'approved' | 'ordered' | 'partial' | 'received'; // Legacy statuses for backwards compatibility
  order_date: string;
  expected_date?: string | null;
  received_date?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string | null;
  invoice_image_url?: string | null; // URL to uploaded vendor invoice image
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
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    unit: string;
    storage_unit?: string;
    sku?: string;
  };
}

export interface InventoryTransfer {
  id: number;
  business_id: number;
  from_business_id?: number | null;
  to_business_id?: number | null;
  transfer_number: string;
  from_branch_id?: number | null;
  to_branch_id?: number | null;
  status: 'pending' | 'received' | 'cancelled';
  transfer_date: string;
  expected_date?: string | null;
  completed_date?: string | null;
  notes?: string | null;
  from_business?: { id: number; name: string };
  to_business?: { id: number; name: string };
  from_branch?: { id: number; name: string; name_ar?: string };
  to_branch?: { id: number; name: string; name_ar?: string };
  items?: InventoryTransferItem[];
}

export interface TransferDestination {
  business_id: number;
  business_name: string;
  branches: { id: number; name: string; name_ar?: string }[];
}

export interface TransferDestinationsResponse {
  destinations: TransferDestination[];
  role: string;
}

export interface InventoryTransferItem {
  id: number;
  transfer_id: number;
  item_id: number;
  quantity: number;
  received_quantity: number;
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    unit: string;
    storage_unit?: string;
    sku?: string;
  };
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
  branch?: { id: number; name: string; name_ar?: string };
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
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    unit: string;
    storage_unit?: string;
    sku?: string;
  };
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
  created_at: string;
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    unit: string;
    sku?: string;
  };
  branch?: { id: number; name: string; name_ar?: string };
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
  user?: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  };
}

// ==================== VENDORS ====================

export async function getVendors(filters?: { status?: string; search?: string }): Promise<Vendor[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  
  const url = `/inventory-stock/vendors${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: Vendor[] }>(url);
  return response.data.data;
}

export async function getVendor(id: number): Promise<Vendor> {
  const response = await api.get<{ success: boolean; data: Vendor }>(`/inventory-stock/vendors/${id}`);
  return response.data.data;
}

export async function createVendor(data: {
  name: string;
  name_ar?: string;
  branch_id?: number | 'all' | null; // null or 'all' = available to all branches
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
  const response = await api.post<{ success: boolean; data: Vendor }>('/inventory-stock/vendors', data);
  return response.data.data;
}

export async function updateVendor(id: number, data: Partial<{
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
  const response = await api.put<{ success: boolean; data: Vendor }>(`/inventory-stock/vendors/${id}`, data);
  return response.data.data;
}

export async function deleteVendor(id: number): Promise<void> {
  await api.delete(`/inventory-stock/vendors/${id}`);
}

// ==================== STOCK LEVELS ====================

export async function getStockLevels(filters?: {
  branch_id?: number;
  item_id?: number;
  low_stock?: boolean;
  limit?: number;
}): Promise<InventoryStock[]> {
  const params = new URLSearchParams();
  if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
  if (filters?.item_id) params.append('item_id', String(filters.item_id));
  if (filters?.low_stock) params.append('low_stock', 'true');
  // Default to 1000 to load all items for inventory management
  params.append('limit', String(filters?.limit || 1000));
  
  const url = `/inventory-stock/stock${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: InventoryStock[] }>(url);
  return response.data.data;
}

// Stock stats type
export interface StockStats {
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  healthy_stock_count: number;
  overstocked_count: number;
}

/**
 * Get stock statistics from backend
 * All calculations done server-side
 */
export async function getStockStats(branchId?: number): Promise<StockStats> {
  const params = new URLSearchParams();
  if (branchId) params.append('branch_id', String(branchId));
  
  const url = `/inventory-stock/stock/stats${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; stats: StockStats }>(url);
  return response.data.stats;
}

export async function setStockLimits(itemId: number, data: {
  min_quantity?: number;
  max_quantity?: number;
  branch_id?: number;
}): Promise<InventoryStock> {
  const response = await api.put<{ success: boolean; data: InventoryStock }>(
    `/inventory-stock/stock/${itemId}/limits`,
    data
  );
  return response.data.data;
}

export async function adjustStock(itemId: number, data: {
  quantity: number;
  type: 'adjustment_add' | 'adjustment_remove' | 'waste' | 'damage' | 'expiry';
  branch_id?: number;
  notes?: string;
}): Promise<InventoryStock> {
  const response = await api.post<{ success: boolean; data: InventoryStock }>(
    `/inventory-stock/stock/${itemId}/adjust`,
    data
  );
  return response.data.data;
}

// ==================== PURCHASE ORDERS ====================

export async function getPurchaseOrders(filters?: {
  status?: string;
  vendor_id?: number;
  branch_id?: number;
}): Promise<PurchaseOrder[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.vendor_id) params.append('vendor_id', String(filters.vendor_id));
  if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
  
  const url = `/inventory-stock/purchase-orders${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: PurchaseOrder[] }>(url);
  return response.data.data;
}

export async function getPurchaseOrder(id: number): Promise<PurchaseOrder> {
  const response = await api.get<{ success: boolean; data: PurchaseOrder }>(
    `/inventory-stock/purchase-orders/${id}`
  );
  return response.data.data;
}

export async function createPurchaseOrder(data: {
  vendor_id: number;
  branch_id?: number;
  expected_date?: string;
  notes?: string;
  items: { item_id: number; quantity: number }[]; // No prices at creation - entered at receive
}): Promise<PurchaseOrder> {
  const response = await api.post<{ success: boolean; data: PurchaseOrder }>(
    '/inventory-stock/purchase-orders',
    data
  );
  return response.data.data;
}

export async function updatePurchaseOrderStatus(id: number, status: string, note?: string): Promise<PurchaseOrder> {
  const response = await api.put<{ success: boolean; data: PurchaseOrder }>(
    `/inventory-stock/purchase-orders/${id}/status`,
    { status, note }
  );
  return response.data.data;
}

export async function updatePurchaseOrder(id: number, data: {
  notes?: string;
  expected_date?: string;
  items?: { item_id: number; quantity: number }[]; // No prices - only quantities can be updated
}): Promise<PurchaseOrder> {
  const response = await api.put<{ success: boolean; data: PurchaseOrder }>(
    `/inventory-stock/purchase-orders/${id}`,
    data
  );
  return response.data.data;
}

export async function getPOActivity(orderId: number): Promise<POActivity[]> {
  const response = await api.get<{ success: boolean; data: POActivity[] }>(
    `/inventory-stock/purchase-orders/${orderId}/activity`
  );
  return response.data.data;
}

export async function receivePurchaseOrder(
  id: number,
  data: {
    invoice_image_url: string;
    items: {
      item_id: number;
      received_quantity: number;
      total_cost: number;
      variance_reason?: 'missing' | 'canceled' | 'rejected';
      variance_note?: string;
    }[];
  }
): Promise<PurchaseOrder> {
  const response = await api.post<{ success: boolean; data: PurchaseOrder }>(
    `/inventory-stock/purchase-orders/${id}/receive`,
    data
  );
  return response.data.data;
}

// ==================== TRANSFERS ====================

export async function getTransfers(filters?: {
  status?: string;
  from_branch_id?: number;
  to_branch_id?: number;
}): Promise<InventoryTransfer[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.from_branch_id) params.append('from_branch_id', String(filters.from_branch_id));
  if (filters?.to_branch_id) params.append('to_branch_id', String(filters.to_branch_id));
  
  const url = `/inventory-stock/transfers${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: InventoryTransfer[] }>(url);
  return response.data.data;
}

export async function getTransfer(id: number): Promise<InventoryTransfer> {
  const response = await api.get<{ success: boolean; data: InventoryTransfer }>(
    `/inventory-stock/transfers/${id}`
  );
  return response.data.data;
}

export async function getTransferDestinations(): Promise<TransferDestinationsResponse> {
  const response = await api.get<{ success: boolean; data: TransferDestination[]; role: string }>(
    '/inventory-stock/transfers/destinations'
  );
  return { destinations: response.data.data, role: response.data.role };
}

export async function createTransfer(data: {
  from_business_id?: number;
  from_branch_id: number;
  to_business_id?: number;
  to_branch_id: number;
  notes?: string;
  items: { item_id: number; quantity: number }[];
}): Promise<InventoryTransfer> {
  const response = await api.post<{ success: boolean; data: InventoryTransfer }>(
    '/inventory-stock/transfers',
    data
  );
  return response.data.data;
}

export async function receiveTransfer(
  id: number,
  items: { item_id: number; received_quantity: number }[]
): Promise<InventoryTransfer> {
  const response = await api.post<{ success: boolean; data: InventoryTransfer }>(
    `/inventory-stock/transfers/${id}/receive`,
    { items }
  );
  return response.data.data;
}

export async function cancelTransfer(id: number): Promise<InventoryTransfer> {
  const response = await api.post<{ success: boolean; data: InventoryTransfer }>(
    `/inventory-stock/transfers/${id}/cancel`
  );
  return response.data.data;
}

// ==================== INVENTORY COUNTS ====================

export async function getInventoryCounts(filters?: {
  status?: string;
  branch_id?: number;
}): Promise<InventoryCount[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
  
  const url = `/inventory-stock/counts${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: InventoryCount[] }>(url);
  return response.data.data;
}

export async function getInventoryCount(id: number): Promise<InventoryCount> {
  const response = await api.get<{ success: boolean; data: InventoryCount }>(
    `/inventory-stock/counts/${id}`
  );
  return response.data.data;
}

export async function createInventoryCount(data: {
  branch_id?: number;
  count_type?: 'full' | 'partial' | 'cycle';
  notes?: string;
  item_ids?: number[];
}): Promise<InventoryCount> {
  const response = await api.post<{ success: boolean; data: InventoryCount }>(
    '/inventory-stock/counts',
    data
  );
  return response.data.data;
}

export async function updateCountItem(
  countId: number,
  itemId: number,
  data: { counted_quantity: number; variance_reason?: string }
): Promise<void> {
  await api.put(`/inventory-stock/counts/${countId}/items/${itemId}`, data);
}

export async function completeInventoryCount(id: number): Promise<InventoryCount> {
  const response = await api.post<{ success: boolean; data: InventoryCount }>(
    `/inventory-stock/counts/${id}/complete`
  );
  return response.data.data;
}

// ==================== MOVEMENTS ====================

export async function getInventoryMovements(filters?: {
  branch_id?: number;
  item_id?: number;
  movement_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<InventoryMovement[]> {
  const params = new URLSearchParams();
  if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
  if (filters?.item_id) params.append('item_id', String(filters.item_id));
  if (filters?.movement_type) params.append('movement_type', filters.movement_type);
  if (filters?.start_date) params.append('start_date', filters.start_date);
  if (filters?.end_date) params.append('end_date', filters.end_date);
  if (filters?.limit) params.append('limit', String(filters.limit));
  
  const url = `/inventory-stock/movements${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: InventoryMovement[] }>(url);
  return response.data.data;
}

// ==================== PO TEMPLATES ====================

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
  vendor?: Vendor;
  items?: POTemplateItem[];
}

export interface POTemplateItem {
  id: number;
  template_id: number;
  item_id: number;
  quantity: number;
  created_at: string;
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    sku?: string;
    unit: string;
    storage_unit?: string;
    cost_per_unit?: number;
  };
}

export async function getPOTemplates(filters?: {
  vendor_id?: number;
  is_active?: boolean;
}): Promise<POTemplate[]> {
  const params = new URLSearchParams();
  if (filters?.vendor_id) params.append('vendor_id', String(filters.vendor_id));
  if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
  
  const url = `/inventory-stock/po-templates${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: POTemplate[] }>(url);
  return response.data.data;
}

export async function getPOTemplate(id: number): Promise<POTemplate> {
  const response = await api.get<{ success: boolean; data: POTemplate }>(
    `/inventory-stock/po-templates/${id}`
  );
  return response.data.data;
}

export async function createPOTemplate(data: {
  vendor_id: number;
  name: string;
  name_ar?: string;
  notes?: string;
  items: { item_id: number; quantity: number }[];
}): Promise<POTemplate> {
  const response = await api.post<{ success: boolean; data: POTemplate }>(
    '/inventory-stock/po-templates',
    data
  );
  return response.data.data;
}

export async function updatePOTemplate(id: number, data: {
  name?: string;
  name_ar?: string;
  notes?: string;
  is_active?: boolean;
  items?: { item_id: number; quantity: number }[];
}): Promise<POTemplate> {
  const response = await api.put<{ success: boolean; data: POTemplate }>(
    `/inventory-stock/po-templates/${id}`,
    data
  );
  return response.data.data;
}

export async function deletePOTemplate(id: number): Promise<void> {
  await api.delete(`/inventory-stock/po-templates/${id}`);
}

// ==================== INVENTORY TRANSACTIONS & TIMELINE ====================

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
  | 'order_cancel_waste'
  | 'order_cancel_return';

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
    full_name: string | null;
  };
}

export interface TimelineResponse {
  transactions: InventoryTransaction[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface TimelineStats {
  today_transactions: number;
  today_additions: number;
  today_deductions: number;
  week_transactions: number;
  top_deduction_reasons: { reason: string; count: number }[];
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

/**
 * Add stock to inventory (manual addition)
 * Requires justification notes
 */
export async function addStock(data: {
  item_id: number;
  branch_id?: number | null;
  quantity: number;
  notes: string;
}): Promise<{ transaction: InventoryTransaction; new_quantity: number }> {
  const response = await api.post<{ success: boolean; data: { transaction: InventoryTransaction; new_quantity: number } }>(
    '/inventory/adjustments/add',
    data
  );
  return response.data.data;
}

/**
 * Deduct stock from inventory (manual deduction)
 * Requires reason (expired, damaged, spoiled, others)
 * If reason is 'others', notes are required
 */
export async function deductStock(data: {
  item_id: number;
  branch_id?: number | null;
  quantity: number;
  reason: DeductionReason;
  notes?: string | null;
}): Promise<{ transaction: InventoryTransaction; new_quantity: number }> {
  const response = await api.post<{ success: boolean; data: { transaction: InventoryTransaction; new_quantity: number } }>(
    '/inventory/adjustments/deduct',
    data
  );
  return response.data.data;
}

/**
 * Get global inventory timeline
 */
export async function getInventoryTimeline(filters?: TimelineFilters): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
  if (filters?.item_id) params.append('item_id', String(filters.item_id));
  if (filters?.transaction_type) params.append('transaction_type', filters.transaction_type);
  if (filters?.reference_type) params.append('reference_type', filters.reference_type);
  if (filters?.deduction_reason) params.append('deduction_reason', filters.deduction_reason);
  if (filters?.date_from) params.append('date_from', filters.date_from);
  if (filters?.date_to) params.append('date_to', filters.date_to);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const url = `/inventory/timeline${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean } & TimelineResponse>(url);
  return {
    transactions: response.data.transactions,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    has_more: response.data.has_more,
  };
}

/**
 * Get timeline for a specific item
 */
export async function getItemTimeline(itemId: number, filters?: Omit<TimelineFilters, 'item_id'>): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
  if (filters?.transaction_type) params.append('transaction_type', filters.transaction_type);
  if (filters?.reference_type) params.append('reference_type', filters.reference_type);
  if (filters?.deduction_reason) params.append('deduction_reason', filters.deduction_reason);
  if (filters?.date_from) params.append('date_from', filters.date_from);
  if (filters?.date_to) params.append('date_to', filters.date_to);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const url = `/inventory/items/${itemId}/timeline${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean } & TimelineResponse>(url);
  return {
    transactions: response.data.transactions,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    has_more: response.data.has_more,
  };
}

/**
 * Get timeline statistics
 */
export async function getTimelineStats(branchId?: number): Promise<TimelineStats> {
  const params = new URLSearchParams();
  if (branchId) params.append('branch_id', String(branchId));

  const url = `/inventory/timeline/stats${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: TimelineStats }>(url);
  return response.data.data;
}

