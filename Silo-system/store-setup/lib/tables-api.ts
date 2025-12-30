/**
 * RESTAURANT TABLES API
 * Manage dine-in tables for the business
 */

import api from './api';

// ==================== TYPES ====================

export interface RestaurantTable {
  id: number;
  business_id: number;
  branch_id: number;
  table_number: string;
  table_code?: string | null;
  seats: number;
  zone?: string | null;
  description?: string | null;
  is_active: boolean;
  is_occupied: boolean;
  current_order_id?: number | null;
  created_at: string;
  updated_at: string;
  branch?: { id: number; name: string; name_ar?: string } | null;
}

export interface CreateTableData {
  table_number: string;
  table_code?: string;
  seats: number;
  zone?: string;
  description?: string;
  branch_id: number;
}

export interface UpdateTableData {
  table_number?: string;
  table_code?: string;
  seats?: number;
  zone?: string;
  description?: string;
  is_active?: boolean;
}

// ==================== API FUNCTIONS ====================

export async function getTables(filters?: { 
  branch_id?: number;
  is_active?: boolean;
  is_occupied?: boolean;
  zone?: string;
}): Promise<RestaurantTable[]> {
  const params = new URLSearchParams();
  if (filters?.branch_id) params.append('branch_id', filters.branch_id.toString());
  if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
  if (filters?.is_occupied !== undefined) params.append('is_occupied', filters.is_occupied.toString());
  if (filters?.zone) params.append('zone', filters.zone);
  
  const url = `/tables${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: RestaurantTable[] }>(url);
  return response.data.data;
}

export async function getAvailableTables(branchId: number, minSeats?: number): Promise<RestaurantTable[]> {
  const params = new URLSearchParams();
  params.append('branch_id', branchId.toString());
  if (minSeats) params.append('min_seats', minSeats.toString());
  
  const response = await api.get<{ success: boolean; data: RestaurantTable[] }>(`/tables/available?${params}`);
  return response.data.data;
}

export async function getTable(id: number): Promise<RestaurantTable> {
  const response = await api.get<{ success: boolean; data: RestaurantTable }>(`/tables/${id}`);
  return response.data.data;
}

export async function createTable(data: CreateTableData): Promise<RestaurantTable> {
  const response = await api.post<{ success: boolean; data: RestaurantTable }>('/tables', data);
  return response.data.data;
}

export async function updateTable(id: number, data: UpdateTableData): Promise<RestaurantTable> {
  const response = await api.put<{ success: boolean; data: RestaurantTable }>(`/tables/${id}`, data);
  return response.data.data;
}

export async function deleteTable(id: number): Promise<void> {
  await api.delete(`/tables/${id}`);
}

export async function occupyTable(id: number, orderId?: number): Promise<RestaurantTable> {
  const response = await api.post<{ success: boolean; data: RestaurantTable }>(`/tables/${id}/occupy`, { order_id: orderId });
  return response.data.data;
}

export async function releaseTable(id: number): Promise<RestaurantTable> {
  const response = await api.post<{ success: boolean; data: RestaurantTable }>(`/tables/${id}/release`);
  return response.data.data;
}





