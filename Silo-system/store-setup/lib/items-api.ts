/**
 * Items/Inventory API Client
 * Handles all inventory item-related API calls
 * 
 * IMPORTANT: Uses shared api client from './api' which has baseURL set to
 * NEXT_PUBLIC_API_URL (e.g., http://localhost:9000/api)
 * All paths should NOT include '/api' prefix as it's already in the baseURL
 */

import api from './api';
import { 
  Item, 
  CreateItemData, 
  UpdateItemData, 
  ItemCategory, 
  ItemType,
  CompositeItem,
  CreateCompositeItemData,
  StorageUnit,
  ItemUnit,
  ProductAccessory,
  AccessoryOrderType
} from '@/types/items';

// Re-export types for convenience
export type { Item, CreateItemData, UpdateItemData, ItemCategory, ItemType, CompositeItem, CreateCompositeItemData, StorageUnit, ItemUnit, ProductAccessory, AccessoryOrderType };

// Get all items for the current business
export async function getItems(filters?: {
  category?: ItemCategory;
  item_type?: ItemType;
}): Promise<Item[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.item_type) params.append('item_type', filters.item_type);
  // Request all items (no pagination limit) for the items management page
  params.append('limit', '1000');

  const response = await api.get(`/inventory/items?${params.toString()}`);
  return response.data.data;
}

// Get single item
export async function getItem(itemId: number): Promise<Item> {
  const response = await api.get(`/inventory/items/${itemId}`);
  return response.data.data;
}

// Create new item
export async function createItem(data: CreateItemData): Promise<Item> {
  const response = await api.post('/inventory/items', data);
  return response.data.data;
}

// Update item
export async function updateItem(itemId: number, data: UpdateItemData): Promise<Item> {
  const response = await api.put(`/inventory/items/${itemId}`, data);
  return response.data.data;
}

// Item usage information for deletion confirmation
export interface ItemUsage {
  products: Array<{ id: number; name: string; name_ar?: string }>;
  compositeItems: Array<{ id: number; name: string; name_ar?: string }>;
  bundles: Array<{ id: number; name: string; name_ar?: string }>;
  inventoryBranches: Array<{ id: number; name: string; quantity: number }>;
  totalUsageCount: number;
}

export interface ItemUsageResponse {
  item: {
    id: number;
    name: string;
    name_ar?: string;
    is_default: boolean;
  };
  usage: ItemUsage;
}

// Get item usage information (what uses this item)
export async function getItemUsage(itemId: number): Promise<ItemUsageResponse> {
  const response = await api.get(`/inventory/items/${itemId}/usage`);
  return response.data.data;
}

// Delete item with optional cascade
// cascade=true will delete all related products, composites, bundles, and clear inventory
export async function deleteItem(itemId: number, cascade: boolean = false): Promise<{
  item_deleted: boolean;
  is_default_item: boolean;
  cascade_results?: {
    deleted_products: number;
    deleted_composite_items: number;
    deleted_bundles: number;
    cleared_inventory_branches: number;
  };
}> {
  const response = await api.delete(`/inventory/items/${itemId}?cascade=${cascade}`);
  return response.data.data;
}

// Set business-specific price for an item
export async function setItemPrice(itemId: number, price: number): Promise<void> {
  await api.put(`/inventory/items/${itemId}/price`, { price });
}

// Reset item price to default (remove business-specific price)
export async function resetItemPrice(itemId: number): Promise<void> {
  await api.delete(`/inventory/items/${itemId}/price`);
}

// ============ ITEM BARCODES ============

export interface ItemBarcode {
  id: number;
  item_id: number;
  business_id: number;
  barcode: string;
  created_at: string;
  created_by?: number | null;
  created_by_user?: {
    first_name: string | null;
    last_name: string | null;
    username: string;
  } | null;
}

// Get barcode for an item (if any)
export async function getItemBarcode(itemId: number): Promise<ItemBarcode | null> {
  const response = await api.get(`/inventory-stock/items/${itemId}/barcode`);
  return response.data.data;
}

// Delete barcode for an item
export async function deleteItemBarcode(itemId: number): Promise<void> {
  await api.delete(`/inventory-stock/items/${itemId}/barcode`);
}

// ============ COMPOSITE ITEMS ============

// Get all composite items
export async function getCompositeItems(): Promise<Item[]> {
  const response = await api.get('/inventory/composite-items');
  return response.data.data;
}

// Get a composite item with its components
export async function getCompositeItem(itemId: number): Promise<CompositeItem> {
  const response = await api.get(`/inventory/composite-items/${itemId}`);
  return response.data.data;
}

// Create a new composite item
export async function createCompositeItem(data: CreateCompositeItemData): Promise<CompositeItem> {
  const response = await api.post('/inventory/composite-items', data);
  return response.data.data;
}

// Update components of a composite item
export async function updateCompositeItemComponents(
  itemId: number, 
  components: { item_id: number; quantity: number }[]
): Promise<CompositeItem> {
  const response = await api.put(`/inventory/composite-items/${itemId}/components`, { components });
  return response.data.data;
}

// Recalculate cost of a composite item
export async function recalculateCompositeItemCost(itemId: number): Promise<number> {
  const response = await api.post(`/inventory/composite-items/${itemId}/recalculate-cost`);
  return response.data.data.cost;
}

// ============ PRODUCTION TEMPLATES ============

export interface ProductionTemplate {
  id: number;
  business_id: number;
  composite_item_id: number;
  name: string;
  name_ar?: string | null;
  default_batch_count: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  composite_item?: any;
}

export interface Production {
  id: number;
  business_id: number;
  branch_id?: number | null;
  composite_item_id: number;
  template_id?: number | null;
  batch_count: number;
  total_yield: number;
  yield_unit: string;
  total_cost: number;
  cost_per_batch: number;
  status: 'completed' | 'failed';
  production_date: string;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  composite_item?: any;
  consumed_items?: any[];
  branch?: any;
  template?: ProductionTemplate;
}

export interface InventoryAvailability {
  item_id: number;
  item_name: string;
  item_name_ar?: string;
  required_quantity: number;
  available_quantity: number;
  unit: string;
  is_sufficient: boolean;
  shortage: number;
}

export interface ProductionStats {
  today_count: number;
  week_count: number;
}

// Get all production templates
export async function getProductionTemplates(): Promise<ProductionTemplate[]> {
  const storedBusiness = localStorage.getItem('setup_business');
  if (!storedBusiness) throw new Error('No business selected');
  const business = JSON.parse(storedBusiness);
  
  const response = await api.get(`/inventory/production/templates?business_id=${business.id}`);
  return response.data.templates;
}

// Create a production template
export async function createProductionTemplate(data: {
  composite_item_id: number;
  name: string;
  name_ar?: string;
  default_batch_count?: number;
}): Promise<ProductionTemplate> {
  const storedBusiness = localStorage.getItem('setup_business');
  if (!storedBusiness) throw new Error('No business selected');
  const business = JSON.parse(storedBusiness);
  
  const storedUser = localStorage.getItem('setup_user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  const response = await api.post('/inventory/production/templates', {
    business_id: business.id,
    ...data,
    created_by: user?.id,
  });
  return response.data.template;
}

// Update a production template
export async function updateProductionTemplate(
  templateId: number,
  data: Partial<{
    composite_item_id: number;
    name: string;
    name_ar: string;
    default_batch_count: number;
  }>
): Promise<ProductionTemplate> {
  const storedBusiness = localStorage.getItem('setup_business');
  if (!storedBusiness) throw new Error('No business selected');
  const business = JSON.parse(storedBusiness);

  const response = await api.put(`/inventory/production/templates/${templateId}`, {
    business_id: business.id,
    ...data,
  });
  return response.data.template;
}

// Delete a production template
export async function deleteProductionTemplate(templateId: number): Promise<void> {
  const storedBusiness = localStorage.getItem('setup_business');
  if (!storedBusiness) throw new Error('No business selected');
  const business = JSON.parse(storedBusiness);

  await api.delete(`/inventory/production/templates/${templateId}?business_id=${business.id}`);
}

// Check inventory availability for production
export async function checkProductionAvailability(
  compositeItemId: number,
  batchCount: number,
  branchId?: number
): Promise<{ canProduce: boolean; availability: InventoryAvailability[] }> {
  const storedBusiness = localStorage.getItem('setup_business');
  if (!storedBusiness) throw new Error('No business selected');
  const business = JSON.parse(storedBusiness);
  
  const params = new URLSearchParams();
  params.append('business_id', business.id.toString());
  params.append('composite_item_id', compositeItemId.toString());
  params.append('batch_count', batchCount.toString());
  if (branchId) params.append('branch_id', branchId.toString());

  const response = await api.get(`/inventory/production/check-availability?${params.toString()}`);
  return response.data;
}

// Get production statistics
export async function getProductionStats(branchId?: number): Promise<ProductionStats> {
  const storedBusiness = localStorage.getItem('setup_business');
  if (!storedBusiness) throw new Error('No business selected');
  const business = JSON.parse(storedBusiness);
  
  const params = new URLSearchParams();
  params.append('business_id', business.id.toString());
  if (branchId) params.append('branch_id', branchId.toString());

  const response = await api.get(`/inventory/production/stats?${params.toString()}`);
  return response.data;
}

// Get all productions
export async function getProductions(filters?: {
  branchId?: number;
  compositeItemId?: number;
  templateId?: number;
  limit?: number;
}): Promise<Production[]> {
  const storedBusiness = localStorage.getItem('setup_business');
  if (!storedBusiness) throw new Error('No business selected');
  const business = JSON.parse(storedBusiness);
  
  const params = new URLSearchParams();
  params.append('business_id', business.id.toString());
  if (filters?.branchId) params.append('branch_id', filters.branchId.toString());
  if (filters?.compositeItemId) params.append('composite_item_id', filters.compositeItemId.toString());
  if (filters?.templateId) params.append('template_id', filters.templateId.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const response = await api.get(`/inventory/production?${params.toString()}`);
  return response.data.productions;
}

// Create a new production
export async function createProduction(data: {
  composite_item_id: number;
  batch_count: number;
  branch_id?: number;
  template_id?: number;
  notes?: string;
}): Promise<Production> {
  const storedBusiness = localStorage.getItem('setup_business');
  if (!storedBusiness) throw new Error('No business selected');
  const business = JSON.parse(storedBusiness);
  
  const storedUser = localStorage.getItem('setup_user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  const response = await api.post('/inventory/production', {
    business_id: business.id,
    ...data,
    created_by: user?.id,
  });
  return response.data.production;
}

// ============ PRODUCT ACCESSORIES ============

// Get accessories for a product
export async function getProductAccessories(productId: number): Promise<ProductAccessory[]> {
  const response = await api.get(`/inventory/products/${productId}/accessories`);
  return response.data.data;
}

// Update accessories for a product
export async function updateProductAccessories(
  productId: number,
  accessories: Array<{
    item_id: number;
    variant_id?: number | null;
    quantity: number;
    applicable_order_types?: AccessoryOrderType[];
    is_required?: boolean;
    notes?: string;
  }>
): Promise<ProductAccessory[]> {
  const response = await api.put(`/inventory/products/${productId}/accessories`, { accessories });
  return response.data.data;
}

// Get accessory cost for a product
export async function getProductAccessoryCost(productId: number): Promise<number> {
  const response = await api.get(`/inventory/products/${productId}/accessories/cost`);
  return response.data.data.cost;
}

