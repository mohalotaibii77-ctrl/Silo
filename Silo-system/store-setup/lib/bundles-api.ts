/**
 * Bundles API Client
 * Manage product bundles - 2+ products sold together as 1
 */

import api from './api';

export interface BundleProduct {
  id: number;
  name: string;
  name_ar?: string;
  price: number;
  image_url?: string;
}

export interface BundleItem {
  id: number;
  bundle_id: number;
  product_id: number;
  quantity: number;
  product?: BundleProduct;
}

export interface Bundle {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: BundleItem[];
}

export interface CreateBundleInput {
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  items: { product_id: number; quantity: number }[];
}

export interface UpdateBundleInput {
  name?: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price?: number;
  compare_at_price?: number;
  image_url?: string;
  is_active?: boolean;
  items?: { product_id: number; quantity: number }[];
}

export interface DeliveryMargin {
  partner_id: number;
  partner_name: string;
  partner_name_ar?: string;
  margin_percent: number;
}

export interface BundleStats {
  sold: number;
  total_cost: number;
  margin_percent?: number;
  delivery_margins?: DeliveryMargin[];
}

export const bundlesApi = {
  // Get all bundles
  getAll: async (): Promise<Bundle[]> => {
    const response = await api.get('/bundles');
    return response.data.data || [];
  },

  // Get bundle stats (sold count, cost for margin)
  getStats: async (): Promise<Record<number, BundleStats>> => {
    try {
      const response = await api.get('/bundles/stats');
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to fetch bundle stats:', error);
      return {};
    }
  },

  // Get a single bundle
  getById: async (id: number): Promise<Bundle> => {
    const response = await api.get(`/bundles/${id}`);
    return response.data.data;
  },

  // Create a new bundle
  create: async (data: CreateBundleInput): Promise<Bundle> => {
    const response = await api.post('/bundles', data);
    return response.data.data;
  },

  // Update a bundle
  update: async (id: number, data: UpdateBundleInput): Promise<Bundle> => {
    const response = await api.put(`/bundles/${id}`, data);
    return response.data.data;
  },

  // Delete a bundle
  delete: async (id: number): Promise<void> => {
    await api.delete(`/bundles/${id}`);
  },

  // Toggle bundle active status
  toggleStatus: async (id: number, isActive: boolean): Promise<Bundle> => {
    const response = await api.patch(`/bundles/${id}/toggle`, { is_active: isActive });
    return response.data.data;
  },
};

