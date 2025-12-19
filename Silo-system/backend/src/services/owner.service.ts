/**
 * OWNER SERVICE
 * Platform-level owner management for Super Admin
 * Owners can own multiple businesses (workspace model)
 */

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/database';

// Types matching the database schema
export interface DBOwner {
  id: number;
  email: string | null;  // Email is optional - we use username for auth
  password_hash?: string; // Not returned in queries
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: 'active' | 'inactive' | 'suspended';
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBBusinessOwner {
  id: number;
  owner_id: number;
  business_id: number;
  role: string;
  assigned_at: string;
}

export interface OwnerWithBusinesses extends DBOwner {
  businesses: {
    id: number;
    name: string;
    slug: string;
    subscription_status: string | null;
    role: string;
    assigned_at: string;
  }[];
  business_count: number;
  owner_type?: 'platform' | 'business'; // platform = multi-business capable, business = legacy single-business
}

export interface CreateOwnerInput {
  email?: string;  // Email is optional - we use username for auth
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface UpdateOwnerInput {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
}

export class OwnerService {
  
  /**
   * Get all owners with business counts
   * All owners are stored in the owners table and linked to businesses via business_owners
   */
  async getAllOwners(): Promise<OwnerWithBusinesses[]> {
    // Get all owners from owners table
    const { data: owners, error } = await supabaseAdmin
      .from('owners')
      .select('id, email, first_name, last_name, phone, status, last_login, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching owners:', error);
      throw new Error(`Failed to fetch owners: ${error.message}`);
    }

    // Get business associations for each owner
    const ownersWithBusinesses: OwnerWithBusinesses[] = [];
    
    for (const owner of owners || []) {
      const { data: businessOwners, error: boError } = await supabaseAdmin
        .from('business_owners')
        .select(`
          business_id,
          role,
          assigned_at,
          businesses (
            id,
            name,
            slug,
            subscription_status
          )
        `)
        .eq('owner_id', owner.id);

      if (boError) {
        console.error('Error fetching business owners:', boError);
      }

      const businesses = (businessOwners || []).map((bo: any) => ({
        id: bo.businesses?.id,
        name: bo.businesses?.name,
        slug: bo.businesses?.slug,
        subscription_status: bo.businesses?.subscription_status,
        role: bo.role,
        assigned_at: bo.assigned_at
      })).filter((b: any) => b.id);

      ownersWithBusinesses.push({
        ...owner,
        businesses,
        business_count: businesses.length
      });
    }

    return ownersWithBusinesses;
  }

  /**
   * Get owner by ID with associated businesses
   */
  async getOwnerById(id: number): Promise<OwnerWithBusinesses | null> {
    const { data: owner, error } = await supabaseAdmin
      .from('owners')
      .select('id, email, first_name, last_name, phone, status, last_login, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch owner: ${error.message}`);
    }

    // Get associated businesses
    const { data: businessOwners, error: boError } = await supabaseAdmin
      .from('business_owners')
      .select(`
        business_id,
        role,
        assigned_at,
        businesses (
          id,
          name,
          slug,
          subscription_status
        )
      `)
      .eq('owner_id', id);

    if (boError) {
      console.error('Error fetching business owners:', boError);
    }

    const businesses = (businessOwners || []).map((bo: any) => ({
      id: bo.businesses?.id,
      name: bo.businesses?.name,
      slug: bo.businesses?.slug,
      subscription_status: bo.businesses?.subscription_status,
      role: bo.role,
      assigned_at: bo.assigned_at
    })).filter((b: any) => b.id);

    return {
      ...owner,
      businesses,
      business_count: businesses.length
    };
  }

  /**
   * Get owner by email
   */
  async getOwnerByEmail(email: string): Promise<DBOwner | null> {
    const { data, error } = await supabaseAdmin
      .from('owners')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch owner: ${error.message}`);
    }

    return data;
  }

  /**
   * Create new owner
   */
  async createOwner(input: CreateOwnerInput): Promise<DBOwner> {
    // Check if email already exists (only if email is provided)
    if (input.email) {
      const existing = await this.getOwnerByEmail(input.email);
      if (existing) {
        throw new Error('An owner with this email already exists');
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12);

    const { data, error } = await supabaseAdmin
      .from('owners')
      .insert({
        email: input.email ? input.email.toLowerCase() : null,
        password_hash: passwordHash,
        first_name: input.first_name || null,
        last_name: input.last_name || null,
        phone: input.phone || null,
        status: 'active'
      })
      .select('id, email, first_name, last_name, phone, status, last_login, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to create owner: ${error.message}`);
    }

    return data;
  }

  /**
   * Update owner
   */
  async updateOwner(id: number, input: UpdateOwnerInput): Promise<DBOwner> {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (input.email) {
      // Check if email is taken by another owner
      const existing = await this.getOwnerByEmail(input.email);
      if (existing && existing.id !== id) {
        throw new Error('This email is already in use by another owner');
      }
      updateData.email = input.email.toLowerCase();
    }

    if (input.password) {
      updateData.password_hash = await bcrypt.hash(input.password, 12);
    }

    if (input.first_name !== undefined) updateData.first_name = input.first_name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.status !== undefined) updateData.status = input.status;

    const { data, error } = await supabaseAdmin
      .from('owners')
      .update(updateData)
      .eq('id', id)
      .select('id, email, first_name, last_name, phone, status, last_login, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to update owner: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete owner
   */
  async deleteOwner(id: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('owners')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete owner: ${error.message}`);
    }
  }

  /**
   * Link owner to a business
   * Also creates a business_users record so the owner appears in the Users list
   */
  async linkBusinessToOwner(ownerId: number, businessId: number, role: string = 'owner'): Promise<DBBusinessOwner> {
    // Check if already linked
    const { data: existing } = await supabaseAdmin
      .from('business_owners')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('business_id', businessId)
      .single();

    if (existing) {
      throw new Error('This owner is already linked to this business');
    }

    // Get owner details to create business_users record
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('owners')
      .select('username, email, first_name, last_name, phone, password_hash')
      .eq('id', ownerId)
      .single();

    if (ownerError || !owner) {
      throw new Error('Owner not found');
    }

    const { data, error } = await supabaseAdmin
      .from('business_owners')
      .insert({
        owner_id: ownerId,
        business_id: businessId,
        role
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to link business to owner: ${error.message}`);
    }

    // Also create a business_users record for the owner in this business
    // This allows the owner to appear in the Users list and manage the business
    const { data: existingBusinessUser } = await supabaseAdmin
      .from('business_users')
      .select('id')
      .eq('business_id', businessId)
      .eq('username', owner.username)
      .single();

    if (!existingBusinessUser) {
      const { error: buError } = await supabaseAdmin
        .from('business_users')
        .insert({
          business_id: businessId,
          username: owner.username,
          email: owner.email,
          password_hash: owner.password_hash,
          role: 'owner',
          first_name: owner.first_name,
          last_name: owner.last_name,
          phone: owner.phone,
          status: 'active'
        });

      if (buError) {
        console.error('Failed to create business_users record:', buError);
        // Don't throw - the business_owners link is still valid
      }
    }

    // Also update the primary_owner_id on the business if it's not set
    await supabaseAdmin
      .from('businesses')
      .update({ primary_owner_id: ownerId })
      .eq('id', businessId)
      .is('primary_owner_id', null);

    return data;
  }

  /**
   * Unlink owner from a business
   */
  async unlinkBusinessFromOwner(ownerId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('business_owners')
      .delete()
      .eq('owner_id', ownerId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to unlink business from owner: ${error.message}`);
    }

    // If this was the primary owner, clear the primary_owner_id
    await supabaseAdmin
      .from('businesses')
      .update({ primary_owner_id: null })
      .eq('id', businessId)
      .eq('primary_owner_id', ownerId);
  }

  /**
   * Get businesses without any owner assigned
   */
  async getUnassignedBusinesses(): Promise<any[]> {
    // Get all business IDs that have owners
    const { data: assignedBusinessIds } = await supabaseAdmin
      .from('business_owners')
      .select('business_id');

    const assignedIds = (assignedBusinessIds || []).map(bo => bo.business_id);

    // Get businesses not in that list
    let query = supabaseAdmin
      .from('businesses')
      .select('id, name, slug, subscription_status, created_at')
      .order('name');

    if (assignedIds.length > 0) {
      query = query.not('id', 'in', `(${assignedIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch unassigned businesses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Authenticate owner (for owner login)
   */
  async authenticateOwner(email: string, password: string): Promise<DBOwner | null> {
    const { data: owner, error } = await supabaseAdmin
      .from('owners')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !owner) {
      return null;
    }

    const isValid = await bcrypt.compare(password, owner.password_hash);
    if (!isValid) {
      return null;
    }

    // Update last login
    await supabaseAdmin
      .from('owners')
      .update({ last_login: new Date().toISOString() })
      .eq('id', owner.id);

    // Don't return password hash
    const { password_hash, ...ownerWithoutPassword } = owner;
    return ownerWithoutPassword as DBOwner;
  }

  /**
   * Get platform-wide statistics for super-admin dashboard
   * All calculations done on backend - frontend just displays values
   */
  async getPlatformStats(): Promise<{
    total_businesses: number;
    active_businesses: number;
    inactive_businesses: number;
    total_owners: number;
    total_users: number;
    total_revenue: number;
    businesses_by_tier: Record<string, number>;
  }> {
    // Get all businesses with their subscription info and user counts
    const { data: businesses, error: bizError } = await supabaseAdmin
      .from('businesses')
      .select('id, subscription_status, subscription_tier, user_count');

    if (bizError) {
      console.error('Error fetching businesses for stats:', bizError);
      throw new Error(`Failed to fetch platform stats: ${bizError.message}`);
    }

    // Get total owners count
    const { count: totalOwners, error: ownerError } = await supabaseAdmin
      .from('owners')
      .select('*', { count: 'exact', head: true });

    if (ownerError) {
      console.error('Error fetching owner count:', ownerError);
    }

    // Calculate stats
    const totalBusinesses = businesses?.length || 0;
    const activeBusinesses = businesses?.filter(b => b.subscription_status === 'active').length || 0;
    const inactiveBusinesses = businesses?.filter(b => b.subscription_status === 'inactive').length || 0;
    const totalUsers = businesses?.reduce((sum, b) => sum + (b.user_count || 0), 0) || 0;

    // Calculate revenue based on subscription tiers (monthly pricing)
    // These are the standard tier prices - should be configured in DB ideally
    const tierPrices: Record<string, number> = {
      'free': 0,
      'starter': 29,
      'pro': 99,
      'enterprise': 299,
    };

    let totalRevenue = 0;
    const businessesByTier: Record<string, number> = {};

    for (const biz of businesses || []) {
      const tier = biz.subscription_tier || 'free';
      businessesByTier[tier] = (businessesByTier[tier] || 0) + 1;
      
      if (biz.subscription_status === 'active') {
        totalRevenue += tierPrices[tier] || 0;
      }
    }

    return {
      total_businesses: totalBusinesses,
      active_businesses: activeBusinesses,
      inactive_businesses: inactiveBusinesses,
      total_owners: totalOwners || 0,
      total_users: totalUsers,
      total_revenue: totalRevenue,
      businesses_by_tier: businessesByTier,
    };
  }

  /**
   * Get all businesses for an owner by their username
   * This is used for workspace switching - finds owner by username and returns their businesses
   */
  async getBusinessesByOwnerUsername(username: string): Promise<any[]> {
    // First find the owner by username
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('owners')
      .select('id')
      .ilike('username', username.trim())
      .single();

    if (ownerError || !owner) {
      return [];
    }

    // Get all businesses for this owner
    const { data: businessOwners, error: boError } = await supabaseAdmin
      .from('business_owners')
      .select(`
        business_id,
        role,
        businesses (
          id,
          name,
          slug,
          logo_url,
          subscription_status,
          language,
          currency,
          timezone,
          country
        )
      `)
      .eq('owner_id', owner.id);

    if (boError) {
      console.error('Error fetching owner businesses:', boError);
      return [];
    }

    return (businessOwners || [])
      .map((bo: any) => ({
        id: bo.businesses?.id,
        name: bo.businesses?.name,
        slug: bo.businesses?.slug,
        logo_url: bo.businesses?.logo_url,
        subscription_status: bo.businesses?.subscription_status,
        language: bo.businesses?.language,
        currency: bo.businesses?.currency,
        timezone: bo.businesses?.timezone,
        country: bo.businesses?.country,
        role: bo.role
      }))
      .filter((b: any) => b.id);
  }
}

export const ownerService = new OwnerService();

