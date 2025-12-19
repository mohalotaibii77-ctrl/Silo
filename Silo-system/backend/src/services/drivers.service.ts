/**
 * DRIVERS SERVICE
 * Business logic for managing in-house delivery drivers
 */

import { supabaseAdmin } from '../config/database';
import { Driver, DriverStatus } from '../types';

interface GetDriversOptions {
  branchId?: number;
  isActive?: boolean;
  status?: string;
}

interface CreateDriverInput {
  name: string;
  name_ar?: string;
  phone?: string;
  email?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  branch_id?: number | null;
}

interface UpdateDriverInput {
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

class DriversService {
  /**
   * Get all drivers for a business
   */
  async getDrivers(businessId: number, options: GetDriversOptions = {}): Promise<Driver[]> {
    let query = supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    // Filter by branch - show drivers for specific branch OR drivers available to all branches (null)
    if (options.branchId) {
      query = query.or(`branch_id.eq.${options.branchId},branch_id.is.null`);
    }

    if (options.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching drivers:', error);
      throw new Error('Failed to fetch drivers');
    }

    return data || [];
  }

  /**
   * Get available drivers for a business/branch
   */
  async getAvailableDrivers(businessId: number, branchId?: number): Promise<Driver[]> {
    let query = supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .eq('status', 'available')
      .order('name', { ascending: true });

    // Filter by branch - show drivers for specific branch OR drivers available to all branches (null)
    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching available drivers:', error);
      throw new Error('Failed to fetch available drivers');
    }

    return data || [];
  }

  /**
   * Get a single driver by ID
   */
  async getDriver(businessId: number, driverId: number): Promise<Driver | null> {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('business_id', businessId)
      .eq('id', driverId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching driver:', error);
      throw new Error('Failed to fetch driver');
    }

    return data;
  }

  /**
   * Create a new driver
   */
  async createDriver(businessId: number, input: CreateDriverInput): Promise<Driver> {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .insert({
        business_id: businessId,
        branch_id: input.branch_id || null,
        name: input.name,
        name_ar: input.name_ar || null,
        phone: input.phone || null,
        email: input.email || null,
        vehicle_type: input.vehicle_type || null,
        vehicle_number: input.vehicle_number || null,
        status: 'available',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating driver:', error);
      throw new Error('Failed to create driver');
    }

    return data;
  }

  /**
   * Update a driver
   */
  async updateDriver(businessId: number, driverId: number, input: UpdateDriverInput): Promise<Driver | null> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.name_ar !== undefined) updateData.name_ar = input.name_ar;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.vehicle_type !== undefined) updateData.vehicle_type = input.vehicle_type;
    if (input.vehicle_number !== undefined) updateData.vehicle_number = input.vehicle_number;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.branch_id !== undefined) updateData.branch_id = input.branch_id;

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .update(updateData)
      .eq('business_id', businessId)
      .eq('id', driverId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error updating driver:', error);
      throw new Error('Failed to update driver');
    }

    return data;
  }

  /**
   * Update driver status
   */
  async updateDriverStatus(businessId: number, driverId: number, status: DriverStatus): Promise<Driver | null> {
    return this.updateDriver(businessId, driverId, { status });
  }

  /**
   * Delete a driver
   */
  async deleteDriver(businessId: number, driverId: number): Promise<boolean> {
    const { error, count } = await supabaseAdmin
      .from('drivers')
      .delete()
      .eq('business_id', businessId)
      .eq('id', driverId);

    if (error) {
      console.error('Error deleting driver:', error);
      throw new Error('Failed to delete driver');
    }

    return true;
  }
}

export const driversService = new DriversService();

