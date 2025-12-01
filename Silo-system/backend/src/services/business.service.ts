/**
 * BUSINESS SERVICE
 * Multi-tenant business/restaurant management for Super Admin
 */

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/database';
import { storageService } from './storage.service';

// Types matching the database schema
export interface DBBusiness {
  id: number;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  business_type: string | null;
  logo_url: string | null;
  certificate_url: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  max_users: number | null;
  max_products: number | null;
  user_count: number | null;
  // Localization fields
  country: string | null;
  currency: string | null;
  language: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBBusinessUser {
  id: number;
  business_id: number;
  username: string;
  password_hash: string;
  role: 'owner' | 'manager' | 'employee';
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBusinessInput {
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  business_type?: string;
  logo_url?: string;
  certificate_url?: string;
  subscription_tier?: 'basic' | 'pro' | 'enterprise';
  max_users?: number;
  max_products?: number;
  users?: {
    username: string;
    password: string;
    role: 'owner' | 'manager' | 'employee';
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  }[];
}

export interface UpdateBusinessInput extends Partial<CreateBusinessInput> {
  subscription_status?: 'active' | 'inactive' | 'suspended' | 'trial';
  deleteUserIds?: number[];  // IDs of users to delete
}

export interface UserCredentials {
  username: string;
  password: string;
  role: string;
}

export class BusinessService {
  
  /**
   * Get all businesses with stats
   */
  async getAllBusinesses(): Promise<DBBusiness[]> {
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching businesses:', error);
      throw new Error('Failed to fetch businesses');
    }

    return data || [];
  }

  /**
   * Get business by ID with users
   */
  async getBusinessById(id: number): Promise<DBBusiness & { users?: DBBusinessUser[] }> {
    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !business) {
      throw new Error('Business not found');
    }

    // Fetch associated users
    const { data: users } = await supabaseAdmin
      .from('business_users')
      .select('*')
      .eq('business_id', id);

    // Remove password hashes from users
    const safeUsers = (users || []).map(({ password_hash, ...user }) => user);

    return { ...business, users: safeUsers };
  }

  /**
   * Get business by slug
   */
  async getBusinessBySlug(slug: string): Promise<DBBusiness | null> {
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create new business with optional users
   */
  async createBusiness(input: CreateBusinessInput): Promise<{ business: DBBusiness; userCredentials: UserCredentials[] }> {
    // Check if slug already exists
    const existing = await this.getBusinessBySlug(input.slug);
    if (existing) {
      throw new Error('Business with this slug already exists');
    }

    // First create business to get ID for file uploads
    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .insert({
        name: input.name,
        slug: input.slug,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        business_type: input.business_type || 'restaurant',
        logo_url: null,
        certificate_url: null,
        subscription_tier: input.subscription_tier || 'basic',
        subscription_status: 'active',
        max_users: input.max_users || 5,
        max_products: input.max_products || 100,
        user_count: input.users?.length || 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating business:', error);
      if (error.code === '23505') {
        throw new Error('Business with this name or slug already exists');
      }
      throw new Error('Failed to create business');
    }

    // Upload logo and certificate if provided as base64
    let logoUrl = null;
    let certificateUrl = null;

    if (input.logo_url && input.logo_url.startsWith('data:')) {
      try {
        const result = await storageService.uploadBase64(input.logo_url, business.id, 'logo');
        logoUrl = result.url;
      } catch (err) {
        console.error('Error uploading logo:', err);
      }
    }

    if (input.certificate_url && input.certificate_url.startsWith('data:')) {
      try {
        const result = await storageService.uploadBase64(input.certificate_url, business.id, 'certificate');
        certificateUrl = result.url;
      } catch (err) {
        console.error('Error uploading certificate:', err);
      }
    }

    // Update business with uploaded file URLs
    if (logoUrl || certificateUrl) {
      const updateFields: Record<string, unknown> = {};
      if (logoUrl) updateFields.logo_url = logoUrl;
      if (certificateUrl) updateFields.certificate_url = certificateUrl;

      await supabaseAdmin
        .from('businesses')
        .update(updateFields)
        .eq('id', business.id);

      business.logo_url = logoUrl;
      business.certificate_url = certificateUrl;
    }

    // Create users if provided
    const userCredentials: UserCredentials[] = [];
    if (input.users && input.users.length > 0) {
      for (const user of input.users) {
        const passwordHash = await bcrypt.hash(user.password, 12);
        
        const { error: userError } = await supabaseAdmin
          .from('business_users')
          .insert({
            business_id: business.id,
            username: user.username,
            password_hash: passwordHash,
            role: user.role,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            email: user.email || null,
            phone: user.phone || null,
            status: 'active',
          });

        if (userError) {
          console.error('Error creating user:', userError);
          // Continue creating other users even if one fails
        } else {
          userCredentials.push({
            username: user.username,
            password: user.password,
            role: user.role,
          });
        }
      }
    }

    return { business, userCredentials };
  }

  /**
   * Update business
   */
  async updateBusiness(id: number, input: UpdateBusinessInput): Promise<{ business: DBBusiness; userCredentials?: UserCredentials[] }> {
    // Handle file uploads first
    let logoUrl: string | undefined;
    let certificateUrl: string | undefined;

    if (input.logo_url && input.logo_url.startsWith('data:')) {
      try {
        const result = await storageService.uploadBase64(input.logo_url, id, 'logo');
        logoUrl = result.url;
      } catch (err) {
        console.error('Error uploading logo:', err);
      }
    }

    if (input.certificate_url && input.certificate_url.startsWith('data:')) {
      try {
        const result = await storageService.uploadBase64(input.certificate_url, id, 'certificate');
        certificateUrl = result.url;
      } catch (err) {
        console.error('Error uploading certificate:', err);
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.business_type !== undefined) updateData.business_type = input.business_type;
    if (logoUrl) updateData.logo_url = logoUrl;
    else if (input.logo_url !== undefined && !input.logo_url.startsWith('data:')) updateData.logo_url = input.logo_url;
    if (certificateUrl) updateData.certificate_url = certificateUrl;
    else if (input.certificate_url !== undefined && !input.certificate_url.startsWith('data:')) updateData.certificate_url = input.certificate_url;
    if (input.subscription_tier !== undefined) updateData.subscription_tier = input.subscription_tier;
    if (input.subscription_status !== undefined) updateData.subscription_status = input.subscription_status;
    if (input.max_users !== undefined) updateData.max_users = input.max_users;
    if (input.max_products !== undefined) updateData.max_products = input.max_products;

    const { data: business, error } = await supabaseAdmin
      .from('businesses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating business:', error);
      throw new Error('Failed to update business');
    }

    // Handle user deletions first
    if (input.deleteUserIds && input.deleteUserIds.length > 0) {
      for (const userId of input.deleteUserIds) {
        await supabaseAdmin
          .from('business_users')
          .delete()
          .eq('id', userId)
          .eq('business_id', id);  // Safety: only delete if belongs to this business
      }
    }

    // Handle new user creation (only users with password are new)
    const userCredentials: UserCredentials[] = [];
    if (input.users && input.users.length > 0) {
      for (const user of input.users) {
        // Only create users that have a password (new users)
        if (!user.password) continue;
        
        const passwordHash = await bcrypt.hash(user.password, 12);
        
        const { error: userError } = await supabaseAdmin
          .from('business_users')
          .insert({
            business_id: id,
            username: user.username,
            password_hash: passwordHash,
            role: user.role,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            email: user.email || null,
            phone: user.phone || null,
            status: 'active',
          });

        if (!userError) {
          userCredentials.push({
            username: user.username,
            password: user.password,
            role: user.role,
          });
        }
      }
    }

    // Update user count if users were added or deleted
    if ((input.users && input.users.length > 0) || (input.deleteUserIds && input.deleteUserIds.length > 0)) {
      const { count } = await supabaseAdmin
        .from('business_users')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', id);

      await supabaseAdmin
        .from('businesses')
        .update({ user_count: count || 0 })
        .eq('id', id);
    }

    return { business, userCredentials: userCredentials.length > 0 ? userCredentials : undefined };
  }

  /**
   * Delete business and all related data
   */
  async deleteBusiness(id: number): Promise<void> {
    // Delete in order of dependencies
    
    // 1. Delete business users
    await supabaseAdmin
      .from('business_users')
      .delete()
      .eq('business_id', id);

    // 2. Delete order items
    await supabaseAdmin
      .from('order_items')
      .delete()
      .eq('business_id', id);

    // 3. Delete orders
    await supabaseAdmin
      .from('orders')
      .delete()
      .eq('business_id', id);

    // 4. Delete inventory
    await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('business_id', id);

    // 5. Delete products
    await supabaseAdmin
      .from('products')
      .delete()
      .eq('business_id', id);

    // 6. Delete items
    await supabaseAdmin
      .from('items')
      .delete()
      .eq('business_id', id);

    // 7. Finally delete the business
    const { error } = await supabaseAdmin
      .from('businesses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting business:', error);
      throw new Error('Failed to delete business');
    }
  }

  /**
   * Get business users
   */
  async getBusinessUsers(businessId: number): Promise<Omit<DBBusinessUser, 'password_hash'>[]> {
    const { data, error } = await supabaseAdmin
      .from('business_users')
      .select('*')
      .eq('business_id', businessId);

    if (error) {
      throw new Error('Failed to fetch business users');
    }

    // Remove password hashes
    return (data || []).map(({ password_hash, ...user }) => user);
  }
}

export const businessService = new BusinessService();
