/**
 * DELIVERY PARTNERS API
 * Manage delivery partners for the business
 */

import api from './api';

// ==================== TYPES ====================

export interface DeliveryPartner {
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
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  minimum_order?: number | null;
  delivery_fee?: number | null;
  estimated_time?: number | null; // minutes
  service_areas?: string | null;
  notes?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  branch?: { id: number; name: string; name_ar?: string } | null;
}

export interface CreateDeliveryPartnerData {
  name: string;
  name_ar?: string;
  branch_id?: number | 'all' | null;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  minimum_order?: number;
  delivery_fee?: number;
  estimated_time?: number;
  service_areas?: string;
  notes?: string;
}

export interface UpdateDeliveryPartnerData {
  name?: string;
  name_ar?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  commission_type?: 'percentage' | 'fixed';
  commission_value?: number;
  minimum_order?: number;
  delivery_fee?: number;
  estimated_time?: number;
  service_areas?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

// ==================== API FUNCTIONS ====================

export async function getDeliveryPartners(filters?: { 
  status?: string; 
  search?: string;
  branchId?: number;
}): Promise<DeliveryPartner[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.branchId) params.append('branch_id', filters.branchId.toString());
  
  const url = `/delivery/partners${params.toString() ? `?${params}` : ''}`;
  const response = await api.get<{ success: boolean; data: DeliveryPartner[] }>(url);
  return response.data.data;
}

export async function getDeliveryPartner(id: number): Promise<DeliveryPartner> {
  const response = await api.get<{ success: boolean; data: DeliveryPartner }>(`/delivery/partners/${id}`);
  return response.data.data;
}

export async function createDeliveryPartner(data: CreateDeliveryPartnerData): Promise<DeliveryPartner> {
  const response = await api.post<{ success: boolean; data: DeliveryPartner }>('/delivery/partners', data);
  return response.data.data;
}

export async function updateDeliveryPartner(id: number, data: UpdateDeliveryPartnerData): Promise<DeliveryPartner> {
  const response = await api.put<{ success: boolean; data: DeliveryPartner }>(`/delivery/partners/${id}`, data);
  return response.data.data;
}

export async function deleteDeliveryPartner(id: number): Promise<void> {
  await api.delete(`/delivery/partners/${id}`);
}



