/**
 * CUSTOMERS SERVICE
 * Business logic for managing customers
 */

import { supabaseAdmin } from '../config/database';
import { Customer } from '../types';

interface GetCustomersOptions {
  branchId?: number;
  isActive?: boolean;
  search?: string;
}

interface CreateCustomerInput {
  name: string;
  name_ar?: string;
  phone?: string;
  email?: string;
  address?: string;
  address_lat?: number;
  address_lng?: number;
  notes?: string;
  branch_id?: number | null;
}

interface UpdateCustomerInput {
  name?: string;
  name_ar?: string;
  phone?: string;
  email?: string;
  address?: string;
  address_lat?: number;
  address_lng?: number;
  notes?: string;
  is_active?: boolean;
  branch_id?: number | null;
}

class CustomersService {
  /**
   * Get all customers for a business
   */
  async getCustomers(businessId: number, options: GetCustomersOptions = {}): Promise<Customer[]> {
    let query = supabaseAdmin
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    // Filter by branch - show customers for specific branch OR customers available to all branches (null)
    if (options.branchId) {
      query = query.or(`branch_id.eq.${options.branchId},branch_id.is.null`);
    }

    if (options.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,phone.ilike.%${options.search}%,email.ilike.%${options.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching customers:', error);
      throw new Error('Failed to fetch customers');
    }

    return data || [];
  }

  /**
   * Search customers by phone or name
   */
  async searchCustomers(businessId: number, searchTerm: string, branchId?: number): Promise<Customer[]> {
    let query = supabaseAdmin
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .order('name', { ascending: true })
      .limit(20);

    // Filter by branch
    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error searching customers:', error);
      throw new Error('Failed to search customers');
    }

    return data || [];
  }

  /**
   * Get a single customer by ID
   */
  async getCustomer(businessId: number, customerId: number): Promise<Customer | null> {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('id', customerId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching customer:', error);
      throw new Error('Failed to fetch customer');
    }

    return data;
  }

  /**
   * Get customer by phone number
   */
  async getCustomerByPhone(businessId: number, phone: string): Promise<Customer | null> {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .eq('phone', phone)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching customer by phone:', error);
      throw new Error('Failed to fetch customer');
    }

    return data;
  }

  /**
   * Create a new customer
   */
  async createCustomer(businessId: number, input: CreateCustomerInput): Promise<Customer> {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        business_id: businessId,
        branch_id: input.branch_id || null,
        name: input.name,
        name_ar: input.name_ar || null,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        address_lat: input.address_lat || null,
        address_lng: input.address_lng || null,
        notes: input.notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      throw new Error('Failed to create customer');
    }

    return data;
  }

  /**
   * Create or get existing customer by phone
   */
  async getOrCreateCustomer(businessId: number, input: CreateCustomerInput): Promise<Customer> {
    if (input.phone) {
      const existing = await this.getCustomerByPhone(businessId, input.phone);
      if (existing) {
        // Update existing customer with new info if provided
        return this.updateCustomer(businessId, existing.id, {
          name: input.name || existing.name,
          address: input.address || existing.address || undefined,
          address_lat: input.address_lat || existing.address_lat || undefined,
          address_lng: input.address_lng || existing.address_lng || undefined,
        }) as Promise<Customer>;
      }
    }
    
    return this.createCustomer(businessId, input);
  }

  /**
   * Update a customer
   */
  async updateCustomer(businessId: number, customerId: number, input: UpdateCustomerInput): Promise<Customer | null> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.name_ar !== undefined) updateData.name_ar = input.name_ar;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.address_lat !== undefined) updateData.address_lat = input.address_lat;
    if (input.address_lng !== undefined) updateData.address_lng = input.address_lng;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.branch_id !== undefined) updateData.branch_id = input.branch_id;

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updateData)
      .eq('business_id', businessId)
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error updating customer:', error);
      throw new Error('Failed to update customer');
    }

    return data;
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(businessId: number, customerId: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('customers')
      .delete()
      .eq('business_id', businessId)
      .eq('id', customerId);

    if (error) {
      console.error('Error deleting customer:', error);
      throw new Error('Failed to delete customer');
    }

    return true;
  }
}

export const customersService = new CustomersService();

