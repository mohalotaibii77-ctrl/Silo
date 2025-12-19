/**
 * DELIVERY PARTNERS SERVICE
 * Manage delivery partners for businesses
 */

import { supabaseAdmin as supabase } from '../config/database';

export interface DeliveryPartner {
  id: number;
  business_id: number;
  branch_id?: number | null;
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
  estimated_time?: number | null;
  service_areas?: string | null;
  notes?: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryPartnerData {
  name: string;
  name_ar?: string;
  branch_id?: number | null;
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

class DeliveryService {
  /**
   * Get all delivery partners for a business
   */
  async getDeliveryPartners(
    businessId: number, 
    options?: { 
      status?: 'active' | 'inactive'; 
      search?: string;
      branchId?: number;
    }
  ): Promise<DeliveryPartner[]> {
    let query = supabase
      .from('delivery_partners')
      .select(`
        *,
        branch:branches!delivery_partners_branch_id_fkey(id, name, name_ar)
      `)
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.search) {
      query = query.or(`name.ilike.%${options.search}%,name_ar.ilike.%${options.search}%,contact_person.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
    }

    // Filter by branch - show only partners for this specific branch
    if (options?.branchId) {
      query = query.eq('branch_id', options.branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching delivery partners:', error);
      throw new Error('Failed to fetch delivery partners');
    }

    return data || [];
  }

  /**
   * Get a single delivery partner by ID
   */
  async getDeliveryPartner(businessId: number, partnerId: number): Promise<DeliveryPartner | null> {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select(`
        *,
        branch:branches!delivery_partners_branch_id_fkey(id, name, name_ar)
      `)
      .eq('id', partnerId)
      .eq('business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching delivery partner:', error);
      throw new Error('Failed to fetch delivery partner');
    }

    return data;
  }

  /**
   * Create a new delivery partner
   */
  async createDeliveryPartner(
    businessId: number, 
    data: CreateDeliveryPartnerData
  ): Promise<DeliveryPartner> {
    // Generate a unique code if not provided
    const code = `DP-${Date.now().toString(36).toUpperCase()}`;

    const insertData = {
      business_id: businessId,
      branch_id: data.branch_id === null ? null : data.branch_id,
      name: data.name,
      name_ar: data.name_ar || null,
      code,
      contact_person: data.contact_person || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      commission_type: data.commission_type,
      commission_value: data.commission_value,
      minimum_order: data.minimum_order || null,
      delivery_fee: data.delivery_fee || null,
      estimated_time: data.estimated_time || null,
      service_areas: data.service_areas || null,
      notes: data.notes || null,
      status: 'active' as const,
    };

    const { data: partner, error } = await supabase
      .from('delivery_partners')
      .insert(insertData)
      .select(`
        *,
        branch:branches!delivery_partners_branch_id_fkey(id, name, name_ar)
      `)
      .single();

    if (error) {
      console.error('Error creating delivery partner:', error);
      throw new Error('Failed to create delivery partner');
    }

    return partner;
  }

  /**
   * Update a delivery partner
   */
  async updateDeliveryPartner(
    businessId: number, 
    partnerId: number, 
    data: UpdateDeliveryPartnerData
  ): Promise<DeliveryPartner> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.name_ar !== undefined) updateData.name_ar = data.name_ar;
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.commission_type !== undefined) updateData.commission_type = data.commission_type;
    if (data.commission_value !== undefined) updateData.commission_value = data.commission_value;
    if (data.minimum_order !== undefined) updateData.minimum_order = data.minimum_order;
    if (data.delivery_fee !== undefined) updateData.delivery_fee = data.delivery_fee;
    if (data.estimated_time !== undefined) updateData.estimated_time = data.estimated_time;
    if (data.service_areas !== undefined) updateData.service_areas = data.service_areas;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) updateData.status = data.status;

    const { data: partner, error } = await supabase
      .from('delivery_partners')
      .update(updateData)
      .eq('id', partnerId)
      .eq('business_id', businessId)
      .select(`
        *,
        branch:branches!delivery_partners_branch_id_fkey(id, name, name_ar)
      `)
      .single();

    if (error) {
      console.error('Error updating delivery partner:', error);
      throw new Error('Failed to update delivery partner');
    }

    return partner;
  }

  /**
   * Delete a delivery partner
   */
  async deleteDeliveryPartner(businessId: number, partnerId: number): Promise<void> {
    const { error } = await supabase
      .from('delivery_partners')
      .delete()
      .eq('id', partnerId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Error deleting delivery partner:', error);
      throw new Error('Failed to delete delivery partner');
    }
  }
}

export const deliveryService = new DeliveryService();



