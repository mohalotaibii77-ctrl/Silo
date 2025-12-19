/**
 * Products API Client
 * Handles all product-related API calls including ingredients
 * 
 * IMPORTANT: Uses shared api client from './api' which has baseURL set to
 * NEXT_PUBLIC_API_URL (e.g., http://localhost:9000/api)
 * All paths should NOT include '/api' prefix as it's already in the baseURL
 */

import api from './api';

export interface DeliveryMargin {
  partner_id: number;
  partner_name: string;
  partner_name_ar?: string;
  margin_percent: number;
}

export interface ProductVariant {
  id?: number;
  name: string;
  name_ar?: string;
  price_adjustment: number;
  sort_order?: number;
  ingredients: ProductIngredient[];
  total_cost?: number;
  margin_percent?: number;
  variant_price?: number;
  in_stock?: boolean;
  delivery_margins?: DeliveryMargin[];
}

export interface ProductIngredient {
  id?: number;
  variant_id?: number;
  item_id: number;
  item_name?: string;
  item_name_ar?: string;
  quantity: number;
  unit?: string;
  cost_per_unit?: number;
  total_cost?: number;
  removable?: boolean; // Can customer remove this ingredient?
}

export interface ProductModifier {
  id?: string;
  item_id?: number;
  name: string;
  name_ar?: string;
  removable: boolean;
  addable: boolean;
  quantity?: number;
  extra_price: number;
}

export interface Product {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  category?: string;
  category_id?: number;
  price: number;
  cost?: number;
  tax_rate?: number;
  is_active: boolean;
  has_variants: boolean;
  image_url?: string;
  variants?: ProductVariant[];
  ingredients?: ProductIngredient[];
  modifiers?: ProductModifier[];
  total_cost?: number;
  margin_percent?: number;
  delivery_margins?: DeliveryMargin[];
  in_stock?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductData {
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  category_id?: number;
  price: number;
  tax_rate?: number;
  has_variants: boolean;
  image_url?: string;
  variants?: { name: string; name_ar?: string; price_adjustment?: number; ingredients: { item_id: number; quantity: number; removable?: boolean }[] }[];
  ingredients?: { item_id: number; quantity: number; removable?: boolean }[];
  modifiers?: { item_id: number; name: string; name_ar?: string; removable: boolean; addable: boolean; quantity?: number; extra_price: number }[];
}

export interface UpdateProductData extends Partial<CreateProductData> {
  is_active?: boolean;
}

/**
 * Get all products for the business
 */
export async function getProducts(): Promise<Product[]> {
  const response = await api.get('/store-products');
  return response.data.data || [];
}

/**
 * Get single product with ingredients
 */
export async function getProduct(productId: number): Promise<Product | null> {
  try {
    const response = await api.get(`/inventory/products/${productId}/ingredients`);
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw new Error(error.response?.data?.error || 'Failed to fetch product');
  }
}

/**
 * Create a new product
 */
export async function createProduct(productData: CreateProductData): Promise<Product> {
  const response = await api.post('/store-products', productData);
  return response.data.data;
}

/**
 * Update product ingredients (and optionally variants) with removable flags and modifiers
 */
export async function updateProductIngredients(
  productId: number,
  ingredientData: {
    has_variants: boolean;
    variants?: { name: string; name_ar?: string; price_adjustment?: number; ingredients: { item_id: number; quantity: number; removable?: boolean }[] }[];
    ingredients?: { item_id: number; quantity: number; removable?: boolean }[];
    modifiers?: { item_id: number; name: string; name_ar?: string; quantity?: number; extra_price: number }[];
  }
): Promise<Product> {
  const response = await api.put(`/inventory/products/${productId}/ingredients`, ingredientData);
  return response.data.data;
}

/**
 * Update product basic info
 */
export async function updateProduct(productId: number, productData: UpdateProductData): Promise<Product> {
  const response = await api.put(`/store-products/${productId}`, productData);
  return response.data.data;
}

/**
 * Delete product
 */
export async function deleteProduct(productId: number): Promise<void> {
  await api.delete(`/store-products/${productId}`);
}

/**
 * Get product cost calculation
 */
export async function getProductCost(productId: number): Promise<{ cost: number; variantCosts?: { variantId: number; name: string; cost: number }[] }> {
  const response = await api.get(`/inventory/products/${productId}/cost`);
  return response.data.data;
}

/**
 * Product stats type
 */
export interface ProductStats {
  sold: number;
  profit_margin: number;
}

/**
 * Get product sales stats (sold count, profit margin)
 */
export async function getProductStats(): Promise<Record<number, ProductStats>> {
  try {
    const response = await api.get('/inventory/products/stats');
    return response.data.data || {};
  } catch (error) {
    console.error('Failed to fetch product stats:', error);
    return {};
  }
}

// ============ PRODUCT ACCESSORIES ============

export type AccessoryOrderType = 'always' | 'dine_in' | 'takeaway' | 'delivery';

export interface ProductAccessory {
  id?: number;
  product_id?: number;
  variant_id?: number | null;
  item_id: number;
  quantity: number;
  applicable_order_types: AccessoryOrderType[];
  is_required?: boolean;
  notes?: string | null;
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    unit: string;
    item_type?: string;
    cost_per_unit: number;
    effective_price?: number;
  };
}

/**
 * Get product accessories
 */
export async function getProductAccessories(productId: number): Promise<ProductAccessory[]> {
  try {
    const response = await api.get(`/inventory/products/${productId}/accessories`);
    return response.data.data || [];
  } catch (error: any) {
    console.error('Failed to fetch product accessories:', error);
    return [];
  }
}

/**
 * Update product accessories (replaces all existing)
 */
export async function updateProductAccessories(
  productId: number,
  accessories: Array<{
    item_id: number;
    quantity: number;
    variant_id?: number | null;
    applicable_order_types: AccessoryOrderType[];
    is_required?: boolean;
    notes?: string | null;
  }>
): Promise<ProductAccessory[]> {
  const response = await api.put(`/inventory/products/${productId}/accessories`, {
    accessories
  });
  return response.data.data || [];
}
