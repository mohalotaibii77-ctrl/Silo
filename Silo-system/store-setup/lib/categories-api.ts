/**
 * Categories API Client
 * Handles all product category-related API calls
 * 
 * IMPORTANT: Uses shared api client from './api' which has baseURL set to
 * NEXT_PUBLIC_API_URL (e.g., http://localhost:9000/api)
 * All paths should NOT include '/api' prefix as it's already in the baseURL
 */

import api from './api';

export interface Category {
  id: number;
  name: string;
  name_ar?: string;
  description?: string;
  business_id?: number;
  is_system: boolean;
  is_general: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryData {
  name: string;
  name_ar?: string;
  description?: string;
  display_order?: number;
}

export interface UpdateCategoryData {
  name?: string;
  name_ar?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

// Get all categories (system + business-specific)
export async function getCategories(): Promise<Category[]> {
  const response = await api.get('/categories');
  return response.data.data || [];
}

// Create a new category (business-specific)
export async function createCategory(data: CreateCategoryData): Promise<Category> {
  const response = await api.post('/categories', data);
  return response.data.data;
}

// Update a category
export async function updateCategory(id: number, data: UpdateCategoryData): Promise<Category> {
  const response = await api.put(`/categories/${id}`, data);
  return response.data.data;
}

// Delete a category
export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/categories/${id}`);
}

