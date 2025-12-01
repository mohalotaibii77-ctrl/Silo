/**
 * POS Products API Client
 * For managing products with variant groups (Size, Type) and modifiers (removable items)
 */

import api from './api';

export interface VariantOption {
  id?: string;
  name: string;
  name_ar?: string;
  price_adjustment: number;
}

export interface VariantGroup {
  id?: string;
  name: string;
  name_ar?: string;
  required: boolean;
  options: VariantOption[];
}

export interface ProductModifier {
  id?: string;
  name: string;
  name_ar?: string;
  removable: boolean;
  addable: boolean;
  extra_price: number;
}

export interface POSProduct {
  id: string;
  business_id: string;
  name: string;
  name_ar?: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  base_price: number;
  image_url?: string;
  available: boolean;
  variant_groups: VariantGroup[];
  modifiers: ProductModifier[];
  created_at: string;
  updated_at: string;
}

export interface POSCategory {
  id: string;
  name: string;
  name_ar?: string;
}

export interface CreatePOSProductData {
  name: string;
  name_ar?: string;
  description?: string;
  category_id?: string;
  base_price: number;
  image_url?: string;
  variant_groups?: VariantGroup[];
  modifiers?: ProductModifier[];
}

/**
 * Get all POS products for the business
 */
export async function getPOSProducts(): Promise<POSProduct[]> {
  const response = await api.get('/products');
  return response.data.data || [];
}

/**
 * Get single POS product
 */
export async function getPOSProduct(productId: string): Promise<POSProduct | null> {
  try {
    const response = await api.get(`/products/${productId}`);
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw new Error(error.response?.data?.error || 'Failed to fetch product');
  }
}

/**
 * Create a new POS product
 */
export async function createPOSProduct(data: CreatePOSProductData): Promise<POSProduct> {
  const response = await api.post('/products', data);
  return response.data.data;
}

/**
 * Update a POS product
 */
export async function updatePOSProduct(productId: string, data: Partial<CreatePOSProductData>): Promise<POSProduct> {
  const response = await api.put(`/products/${productId}`, data);
  return response.data.data;
}

/**
 * Delete a POS product
 */
export async function deletePOSProduct(productId: string): Promise<void> {
  await api.delete(`/products/${productId}`);
}

/**
 * Toggle product availability
 */
export async function toggleProductAvailability(productId: string, available: boolean): Promise<POSProduct> {
  const response = await api.patch(`/products/${productId}/availability`, { available });
  return response.data.data;
}

/**
 * Get all POS categories
 */
export async function getPOSCategories(): Promise<POSCategory[]> {
  const response = await api.get('/products/categories');
  return response.data.data || [];
}

/**
 * Create a new category
 */
export async function createPOSCategory(name: string, name_ar?: string): Promise<POSCategory> {
  const response = await api.post('/products/categories', { name, name_ar });
  return response.data.data;
}

