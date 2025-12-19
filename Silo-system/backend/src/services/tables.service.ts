/**
 * RESTAURANT TABLES SERVICE
 * Manage dine-in tables for branches
 */

import { supabaseAdmin as supabase } from '../config/database';

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
}

export interface UpdateTableData {
  table_number?: string;
  table_code?: string;
  seats?: number;
  zone?: string;
  description?: string;
  is_active?: boolean;
  is_occupied?: boolean;
  current_order_id?: number | null;
}

class TablesService {
  /**
   * Get the main branch for a business (or first active branch)
   */
  async getMainBranch(businessId: number): Promise<{ data: { id: number; name: string } | null }> {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('is_main', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching main branch:', error);
      return { data: null };
    }

    return { data };
  }

  /**
   * Get all tables for a branch
   */
  async getTables(
    businessId: number,
    branchId: number,
    options?: {
      isActive?: boolean;
      isOccupied?: boolean;
      zone?: string;
    }
  ): Promise<RestaurantTable[]> {
    let query = supabase
      .from('restaurant_tables')
      .select(`
        *,
        branch:branches!restaurant_tables_branch_id_fkey(id, name, name_ar)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .order('table_number', { ascending: true });

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options?.isOccupied !== undefined) {
      query = query.eq('is_occupied', options.isOccupied);
    }

    if (options?.zone) {
      query = query.eq('zone', options.zone);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tables:', error);
      throw new Error('Failed to fetch tables');
    }

    return data || [];
  }

  /**
   * Get a single table by ID
   */
  async getTable(businessId: number, tableId: number): Promise<RestaurantTable | null> {
    const { data, error } = await supabase
      .from('restaurant_tables')
      .select(`
        *,
        branch:branches!restaurant_tables_branch_id_fkey(id, name, name_ar)
      `)
      .eq('id', tableId)
      .eq('business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching table:', error);
      throw new Error('Failed to fetch table');
    }

    return data;
  }

  /**
   * Create a new table
   */
  async createTable(
    businessId: number,
    branchId: number,
    data: CreateTableData
  ): Promise<RestaurantTable> {
    // Generate a unique code if not provided
    const tableCode = data.table_code || `TBL-${branchId}-${data.table_number}`;

    const insertData = {
      business_id: businessId,
      branch_id: branchId,
      table_number: data.table_number,
      table_code: tableCode,
      seats: data.seats,
      zone: data.zone || null,
      description: data.description || null,
      is_active: true,
      is_occupied: false,
    };

    const { data: table, error } = await supabase
      .from('restaurant_tables')
      .insert(insertData)
      .select(`
        *,
        branch:branches!restaurant_tables_branch_id_fkey(id, name, name_ar)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Table number already exists for this branch');
      }
      console.error('Error creating table:', error);
      throw new Error('Failed to create table');
    }

    return table;
  }

  /**
   * Update a table
   */
  async updateTable(
    businessId: number,
    tableId: number,
    data: UpdateTableData
  ): Promise<RestaurantTable> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.table_number !== undefined) updateData.table_number = data.table_number;
    if (data.table_code !== undefined) updateData.table_code = data.table_code;
    if (data.seats !== undefined) updateData.seats = data.seats;
    if (data.zone !== undefined) updateData.zone = data.zone;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.is_occupied !== undefined) updateData.is_occupied = data.is_occupied;
    if (data.current_order_id !== undefined) updateData.current_order_id = data.current_order_id;

    const { data: table, error } = await supabase
      .from('restaurant_tables')
      .update(updateData)
      .eq('id', tableId)
      .eq('business_id', businessId)
      .select(`
        *,
        branch:branches!restaurant_tables_branch_id_fkey(id, name, name_ar)
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Table number already exists for this branch');
      }
      console.error('Error updating table:', error);
      throw new Error('Failed to update table');
    }

    return table;
  }

  /**
   * Delete a table
   */
  async deleteTable(businessId: number, tableId: number): Promise<void> {
    const { error } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', tableId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Error deleting table:', error);
      throw new Error('Failed to delete table');
    }
  }

  /**
   * Set table as occupied
   */
  async occupyTable(businessId: number, tableId: number, orderId?: number): Promise<RestaurantTable> {
    return this.updateTable(businessId, tableId, {
      is_occupied: true,
      current_order_id: orderId || null,
    });
  }

  /**
   * Set table as available
   */
  async releaseTable(businessId: number, tableId: number): Promise<RestaurantTable> {
    return this.updateTable(businessId, tableId, {
      is_occupied: false,
      current_order_id: null,
    });
  }

  /**
   * Get available tables for a branch
   */
  async getAvailableTables(businessId: number, branchId: number, minSeats?: number): Promise<RestaurantTable[]> {
    let query = supabase
      .from('restaurant_tables')
      .select('*')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .eq('is_occupied', false)
      .order('table_number', { ascending: true });

    if (minSeats) {
      query = query.gte('seats', minSeats);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching available tables:', error);
      throw new Error('Failed to fetch available tables');
    }

    return data || [];
  }
}

export const tablesService = new TablesService();


