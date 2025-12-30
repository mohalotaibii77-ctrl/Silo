/**
 * DRIVERS API
 * Manage in-house delivery drivers for the business
 */

import api from './api';

// ==================== TYPES ====================

export type DriverStatus = 'available' | 'busy' | 'offline';

export interface Driver {
  id: number;
  business_id: number;
  branch_id?: number | null;
  name: string;
  name_ar?: string | null;
  phone?: string | null;
  email?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  status: DriverStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDriverData {
  name: string;
  name_ar?: string;
  phone?: string;
  email?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  branch_id?: number | null;
}

export interface UpdateDriverData {
  name?: string;
  name_ar?: string;
  phone?: string;
  email?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  status?: DriverStatus;
  is_active?: boolean;
  branch_id?: number | null;
}

// ==================== API FUNCTIONS ====================

export async function getDrivers(filters?: { 
  branch_id?: number;
  is_active?: boolean;
  status?: DriverStatus;
}): Promise<Driver[]> {
  const params = new URLSearchParams();
  if (filters?.branch_id) params.append('branch_id', filters.branch_id.toString());
  if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
  if (filters?.status) params.append('status', filters.status);
  
  const url = `/drivers${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: Driver[] }>(url);
  return response.data.data;
}

export async function getAvailableDrivers(branchId?: number): Promise<Driver[]> {
  const params = new URLSearchParams();
  if (branchId) params.append('branch_id', branchId.toString());
  
  const url = `/drivers/available${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: Driver[] }>(url);
  return response.data.data;
}

export async function getDriver(id: number): Promise<Driver> {
  const response = await api.get<{ success: boolean; data: Driver }>(`/drivers/${id}`);
  return response.data.data;
}

export async function createDriver(data: CreateDriverData): Promise<Driver> {
  const response = await api.post<{ success: boolean; data: Driver }>('/drivers', data);
  return response.data.data;
}

export async function updateDriver(id: number, data: UpdateDriverData): Promise<Driver> {
  const response = await api.put<{ success: boolean; data: Driver }>(`/drivers/${id}`, data);
  return response.data.data;
}

export async function updateDriverStatus(id: number, status: DriverStatus): Promise<Driver> {
  const response = await api.put<{ success: boolean; data: Driver }>(`/drivers/${id}/status`, { status });
  return response.data.data;
}

export async function deleteDriver(id: number): Promise<void> {
  await api.delete(`/drivers/${id}`);
}





