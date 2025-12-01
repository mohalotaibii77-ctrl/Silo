/**
 * Discounts API Client
 * Handles all discount code-related API calls
 * 
 * IMPORTANT: Uses shared api client from './api' which has baseURL set to
 * NEXT_PUBLIC_API_URL (e.g., http://localhost:9000/api)
 * All paths should NOT include '/api' prefix as it's already in the baseURL
 */

import api from './api';

export interface DiscountCode {
  id: number;
  business_id: number;
  code: string;
  name?: string;
  name_ar?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  used_count: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDiscountData {
  code: string;
  name?: string;
  name_ar?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  start_date?: string;
  end_date?: string;
}

export interface UpdateDiscountData extends Partial<CreateDiscountData> {
  is_active?: boolean;
}

// Get all discount codes for the business
export async function getDiscounts(): Promise<DiscountCode[]> {
  const response = await api.get('/discounts');
  return response.data.data || [];
}

// Create a new discount code
export async function createDiscount(data: CreateDiscountData): Promise<DiscountCode> {
  const response = await api.post('/discounts', data);
  return response.data.data;
}

// Update a discount code
export async function updateDiscount(id: number, data: UpdateDiscountData): Promise<DiscountCode> {
  const response = await api.put(`/discounts/${id}`, data);
  return response.data.data;
}

// Delete a discount code
export async function deleteDiscount(id: number): Promise<void> {
  await api.delete(`/discounts/${id}`);
}

// Validate a discount code (for POS)
export async function validateDiscount(code: string): Promise<{ data: Partial<DiscountCode>; valid: boolean }> {
  const response = await api.get(`/discounts/validate/${code}`);
  return response.data;
}

