/**
 * BUSINESS SERVICE
 * Multi-tenant business/restaurant management for Super Admin
 */

import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/database';
import { storageService } from './storage.service';
import { inventoryService } from './inventory.service';

// Valid currency codes - must match /config/currencies
const VALID_CURRENCIES = [
  'KWD', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'BHD', 'OMR',
  'EGP', 'JOD', 'LBP', 'INR', 'PKR', 'CNY', 'JPY', 'KRW', 'THB',
  'MYR', 'SGD', 'AUD', 'CAD', 'CHF', 'TRY', 'RUB', 'BRL', 'MXN', 'ZAR'
];

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
  branch_count: number | null;
  // Localization fields
  country: string | null;
  currency: string | null;
  language: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBBranch {
  id: number;
  business_id: number;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_main: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DBBusinessUser {
  id: number;
  business_id: number;
  branch_id: number | null;
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

export interface BranchInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  is_main?: boolean;
}

export interface CreateBusinessInput {
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  business_type?: string;
  country: string; // Required - no default
  currency: string; // Required - no default
  timezone: string; // Required - no default
  language?: string; // Optional, defaults to 'en'
  logo_url?: string;
  certificate_url?: string;
  subscription_tier?: 'basic' | 'pro' | 'enterprise';
  max_users?: number;
  max_products?: number;
  branch_count?: number;
  branches?: BranchInput[];
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
  subscription_status?: 'active' | 'inactive';
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
   * Get business by ID with users and branches
   */
  async getBusinessById(id: number): Promise<DBBusiness & { users?: DBBusinessUser[]; branches?: DBBranch[] }> {
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

    // Fetch associated branches
    const { data: branches } = await supabaseAdmin
      .from('branches')
      .select('*')
      .eq('business_id', id)
      .order('is_main', { ascending: false })
      .order('created_at', { ascending: true });

    // Remove password hashes from users
    const safeUsers = (users || []).map(({ password_hash, ...user }) => user);

    return { ...business, users: safeUsers, branches: branches || [] };
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
   * Create new business with optional users and branches
   */
  async createBusiness(input: CreateBusinessInput): Promise<{ business: DBBusiness; userCredentials: UserCredentials[]; branches: DBBranch[] }> {
    // Check if slug already exists
    const existing = await this.getBusinessBySlug(input.slug);
    if (existing) {
      throw new Error('Business with this slug already exists');
    }

    // Validate required localization fields - NO DEFAULTS
    if (!input.country) {
      throw new Error('Country is required');
    }
    if (!input.currency) {
      throw new Error('Currency is required');
    }
    if (!VALID_CURRENCIES.includes(input.currency)) {
      throw new Error(`Invalid currency code: ${input.currency}. Must be one of: ${VALID_CURRENCIES.join(', ')}`);
    }
    if (!input.timezone) {
      throw new Error('Timezone is required');
    }

    // Determine branch count (minimum 1)
    const branchCount = Math.max(1, input.branch_count || 1);

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
        branch_count: branchCount,
        // Localization settings - REQUIRED, no defaults
        country: input.country,
        currency: input.currency,
        timezone: input.timezone,
        language: input.language || 'en',
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

    // Create branches
    const createdBranches: DBBranch[] = [];
    
    if (input.branches && input.branches.length > 0) {
      // Use provided branches configuration
      for (let i = 0; i < input.branches.length; i++) {
        const branchInput = input.branches[i];
        const branchSlug = branchInput.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        // Generate unique branch code (max 20 chars)
        const shortTs = (Date.now() % 100000000).toString(36).toUpperCase();
        const branchCode = `B${business.id}-${shortTs}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        
        const { data: branch, error: branchError } = await supabaseAdmin
          .from('branches')
          .insert({
            business_id: business.id,
            name: branchInput.name,
            slug: branchSlug,
            branch_code: branchCode,
            address: branchInput.address || null,
            phone: branchInput.phone || null,
            email: branchInput.email || null,
            is_main: branchInput.is_main || i === 0, // First branch is main by default
            is_active: true,
          })
          .select()
          .single();

        if (branchError) {
          console.error('Error creating branch:', branchError);
        } else if (branch) {
          createdBranches.push(branch);
        }
      }
    } else {
      // Create default branches based on branch_count
      for (let i = 0; i < branchCount; i++) {
        const branchName = branchCount === 1 ? 'Main Branch' : `Branch ${i + 1}`;
        const branchSlug = branchCount === 1 ? 'main' : `branch-${i + 1}`;
        // Generate unique branch code (max 20 chars)
        const shortTs = (Date.now() % 100000000).toString(36).toUpperCase();
        const branchCode = `B${business.id}-${shortTs}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        
        const { data: branch, error: branchError } = await supabaseAdmin
          .from('branches')
          .insert({
            business_id: business.id,
            name: branchName,
            slug: branchSlug,
            branch_code: branchCode,
            address: i === 0 ? input.address : null, // Main branch inherits business address
            phone: i === 0 ? input.phone : null,
            email: i === 0 ? input.email : null,
            is_main: i === 0,
            is_active: true,
          })
          .select()
          .single();

        if (branchError) {
          console.error('Error creating branch:', branchError);
        } else if (branch) {
          createdBranches.push(branch);
        }
      }
    }

    // Create users if provided
    const userCredentials: UserCredentials[] = [];
    const mainBranch = createdBranches.find(b => b.is_main) || createdBranches[0];
    
    if (input.users && input.users.length > 0) {
      for (const user of input.users) {
        const passwordHash = await bcrypt.hash(user.password, 12);
        
        const { error: userError } = await supabaseAdmin
          .from('business_users')
          .insert({
            business_id: business.id,
            branch_id: mainBranch?.id || null, // Associate owner with main branch
            username: user.username,
            password_hash: passwordHash,
            role: user.role,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            email: user.email || null,
            phone: user.phone || null,
            status: 'active',
            password_changed: false, // Requires password change on first login
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

          // Auto-create platform owner if this is an owner role
          if (user.role === 'owner') {
            await this.createPlatformOwner({
              username: user.username,
              email: user.email || null,  // Email is optional, don't auto-generate
              passwordHash,
              firstName: user.first_name,
              lastName: user.last_name,
              phone: user.phone,
              businessId: business.id
            });
          }
        }
      }
    }

    // Initialize business items by copying all system items
    // Each business owns their own items from day 1
    try {
      const result = await inventoryService.initializeBusinessItems(business.id);
      console.log(`[createBusiness] Initialized ${result.copied} items for business ${business.id}`);
    } catch (itemError) {
      // Log error but don't fail business creation
      console.error('[createBusiness] Failed to initialize items:', itemError);
    }

    return { business, userCredentials, branches: createdBranches };
  }

  /**
   * Auto-create platform owner and link to business
   */
  private async createPlatformOwner(data: {
    username: string;
    email: string | null;  // Email is optional
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    businessId: number;
  }): Promise<void> {
    try {
      const username = data.username.trim();
      const email = data.email ? data.email.toLowerCase() : null;
      
      // Check if owner already exists by username
      const { data: existingOwner } = await supabaseAdmin
        .from('owners')
        .select('id')
        .ilike('username', username)
        .single();

      let ownerId: number;

      if (existingOwner) {
        ownerId = existingOwner.id;
      } else {
        // Create new platform owner
        const { data: newOwner, error: ownerError } = await supabaseAdmin
          .from('owners')
          .insert({
            username,
            email,
            password_hash: data.passwordHash,
            first_name: data.firstName || null,
            last_name: data.lastName || null,
            phone: data.phone || null,
            status: 'active'
          })
          .select('id')
          .single();

        if (ownerError) {
          console.error('Error creating platform owner:', ownerError);
          return;
        }
        ownerId = newOwner.id;
      }

      // Link owner to business (if not already linked)
      const { data: existingLink } = await supabaseAdmin
        .from('business_owners')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('business_id', data.businessId)
        .single();

      if (!existingLink) {
        await supabaseAdmin
          .from('business_owners')
          .insert({
            owner_id: ownerId,
            business_id: data.businessId,
            role: 'owner'
          });

        // Update primary_owner_id on business
        await supabaseAdmin
          .from('businesses')
          .update({ primary_owner_id: ownerId })
          .eq('id', data.businessId)
          .is('primary_owner_id', null);
      }
    } catch (err) {
      console.error('Error in createPlatformOwner:', err);
    }
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
            password_changed: false, // Requires password change on first login
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

  /**
   * Get all branches for a business
   */
  async getBranches(businessId: number): Promise<DBBranch[]> {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('*')
      .eq('business_id', businessId)
      .order('is_main', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching branches:', error);
      throw new Error('Failed to fetch branches');
    }

    return data || [];
  }

  /**
   * Get a single branch by ID
   */
  async getBranchById(branchId: number): Promise<DBBranch | null> {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create a new branch for a business
   */
  async createBranch(businessId: number, input: BranchInput): Promise<DBBranch> {
    const branchSlug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    // Generate unique branch code (max 20 chars): B{businessId}-{short timestamp}-{random}
    const shortTimestamp = (Date.now() % 100000000).toString(36).toUpperCase();
    const branchCode = `B${businessId}-${shortTimestamp}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const { data: branch, error } = await supabaseAdmin
      .from('branches')
      .insert({
        business_id: businessId,
        name: input.name,
        slug: branchSlug,
        branch_code: branchCode,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        is_main: input.is_main || false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating branch:', error);
      throw new Error('Failed to create branch');
    }

    // Update branch count on business
    await supabaseAdmin.rpc('increment_branch_count', { business_id_param: businessId });

    return branch;
  }

  /**
   * Update a branch
   */
  async updateBranch(branchId: number, input: Partial<BranchInput> & { is_active?: boolean }): Promise<DBBranch> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
      updateData.slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (input.address !== undefined) updateData.address = input.address;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.is_main !== undefined) updateData.is_main = input.is_main;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const { data: branch, error } = await supabaseAdmin
      .from('branches')
      .update(updateData)
      .eq('id', branchId)
      .select()
      .single();

    if (error) {
      console.error('Error updating branch:', error);
      throw new Error('Failed to update branch');
    }

    return branch;
  }

  /**
   * Delete a branch (soft delete - sets is_active to false)
   */
  async deleteBranch(branchId: number): Promise<void> {
    // Check if this is the main branch
    const branch = await this.getBranchById(branchId);
    if (!branch) {
      throw new Error('Branch not found');
    }

    if (branch.is_main) {
      throw new Error('Cannot delete the main branch');
    }

    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('branches')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', branchId);

    if (error) {
      console.error('Error deleting branch:', error);
      throw new Error('Failed to delete branch');
    }

    // Update branch count on business
    await supabaseAdmin.rpc('decrement_branch_count', { business_id_param: branch.business_id });
  }
}

export const businessService = new BusinessService();
