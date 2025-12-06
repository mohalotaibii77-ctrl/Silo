/**
 * INVENTORY STOCK MANAGEMENT API
 * Vendors, Purchase Orders, Transfers, Inventory Counts
 */

import api from './api';

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
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'partial' | 'received' | 'cancelled';
  order_date: string;
  expected_date?: string | null;
  received_date?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string | null;
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
  transfer_number: string;
  from_branch_id?: number | null;
  to_branch_id?: number | null;
  status: 'draft' | 'pending' | 'in_transit' | 'completed' | 'cancelled';
  transfer_date: string;
  expected_date?: string | null;
  completed_date?: string | null;
  notes?: string | null;
  from_branch?: { id: number; name: string; name_ar?: string };
  to_branch?: { id: number; name: string; name_ar?: string };
  items?: InventoryTransferItem[];
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
}): Promise<InventoryStock[]> {
  const params = new URLSearchParams();
  if (filters?.branch_id) params.append('branch_id', String(filters.branch_id));
  if (filters?.item_id) params.append('item_id', String(filters.item_id));
  if (filters?.low_stock) params.append('low_stock', 'true');
  
  const url = `/inventory-stock/stock${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: InventoryStock[] }>(url);
  return response.data.data;
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
  items: { item_id: number; quantity: number; unit_cost: number }[];
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
  items?: { item_id: number; quantity: number; unit_cost: number }[];
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
  items: { item_id: number; received_quantity: number }[]
): Promise<PurchaseOrder> {
  const response = await api.post<{ success: boolean; data: PurchaseOrder }>(
    `/inventory-stock/purchase-orders/${id}/receive`,
    { items }
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

export async function createTransfer(data: {
  from_branch_id: number;
  to_branch_id: number;
  expected_date?: string;
  notes?: string;
  items: { item_id: number; quantity: number }[];
}): Promise<InventoryTransfer> {
  const response = await api.post<{ success: boolean; data: InventoryTransfer }>(
    '/inventory-stock/transfers',
    data
  );
  return response.data.data;
}

export async function startTransfer(id: number): Promise<InventoryTransfer> {
  const response = await api.post<{ success: boolean; data: InventoryTransfer }>(
    `/inventory-stock/transfers/${id}/start`
  );
  return response.data.data;
}

export async function completeTransfer(
  id: number,
  items: { item_id: number; received_quantity: number }[]
): Promise<InventoryTransfer> {
  const response = await api.post<{ success: boolean; data: InventoryTransfer }>(
    `/inventory-stock/transfers/${id}/complete`,
    { items }
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

