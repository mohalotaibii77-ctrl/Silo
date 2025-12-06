/**
 * BUSINESS AUTH SERVICE
 * Handles authentication for business users (owner, manager, employee)
 * These users are created via SuperAdmin and stored in business_users table
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/database';
import { env } from '../config/env';

export interface UserSettings {
  preferred_language: string;
  preferred_theme: 'light' | 'dark' | 'system';
  settings: Record<string, any>;
}

export interface BusinessUser {
  id: number;
  business_id: number;
  branch_id: number | null;
  username: string;
  role: 'owner' | 'manager' | 'employee' | 'pos';
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  // User settings
  preferred_language: string | null;
  preferred_theme: string | null;
  settings: Record<string, any> | null;
}

export interface Branch {
  id: number;
  business_id: number;
  name: string;
  slug: string;
  is_main: boolean;
}

export interface BusinessAuthPayload {
  userId: string;
  username: string;
  role: string;
  businessId: string;
  branchId?: string;
}

export interface BusinessInfo {
  id: number;
  name: string;
  slug: string;
  // Localization settings
  country?: string;
  currency?: string;
  timezone?: string;
  language?: string;
  // Tax/VAT settings
  tax_rate?: number;
  vat_enabled?: boolean;
  tax_number?: string;
  // Other
  logo_url?: string;
  branch_count?: number;
}

export interface BusinessLoginResponse {
  token: string;
  user: Omit<BusinessUser, 'password_hash'>;
  business: BusinessInfo | null;
  branch: Branch | null;
  businesses?: BusinessInfo[];  // All businesses user can access (for workspace switching)
  userSettings: UserSettings;  // User-specific settings (language, theme, etc.)
}

export class BusinessAuthService {
  
  /**
   * Login business user with username and password
   */
  async login(username: string, password: string): Promise<BusinessLoginResponse> {
    console.log('Business user login attempt for:', username);
    
    // Get users from business_users table (case-insensitive username match)
    // Handle case where multiple users might have same username across different businesses
    const { data: users, error } = await supabaseAdmin
      .from('business_users')
      .select('*')
      .ilike('username', username.trim())
      .eq('status', 'active');

    console.log('DB query result - error:', error, 'users found:', users?.length || 0);

    if (error || !users || users.length === 0) {
      console.log('Business user not found or DB error');
      throw new Error('Invalid username or password');
    }

    console.log('Business user(s) found, checking password...');

    // Find a user with matching password (handles duplicate usernames across businesses)
    let user = null;
    for (const u of users) {
      const isValidPassword = await bcrypt.compare(password, u.password_hash);
      if (isValidPassword) {
        user = u;
        break;
      }
    }
    
    if (!user) {
      console.log('Password did not match any user');
      throw new Error('Invalid username or password');
    }

    console.log('Password valid for user:', user.id);

    // Get business info including ALL settings (localization, tax, etc.)
    let business: BusinessInfo | null = null;
    if (user.business_id) {
      const { data: bizData } = await supabaseAdmin
        .from('businesses')
        .select('id, name, slug, country, currency, timezone, language, tax_rate, vat_enabled, tax_number, logo_url, branch_count')
        .eq('id', user.business_id)
        .single();
      business = bizData;
    }

    // Get branch info if user is assigned to a branch
    let branch: Branch | null = null;
    if (user.branch_id) {
      const { data: branchData } = await supabaseAdmin
        .from('branches')
        .select('id, business_id, name, slug, is_main')
        .eq('id', user.branch_id)
        .single();
      branch = branchData;
    }

    // For owners, get all businesses they have access to (for workspace switching)
    let businesses: BusinessInfo[] = [];
    if (user.role === 'owner') {
      // Find owner record by username
      const { data: ownerData } = await supabaseAdmin
        .from('owners')
        .select('id')
        .eq('username', user.username)
        .single();
      
      if (ownerData) {
        // Get all business IDs linked to this owner
        const { data: businessOwnerLinks } = await supabaseAdmin
          .from('business_owners')
          .select('business_id')
          .eq('owner_id', ownerData.id);
        
        if (businessOwnerLinks && businessOwnerLinks.length > 0) {
          const businessIds = businessOwnerLinks.map((bo: any) => bo.business_id);
          
          // Fetch all businesses with full settings
          const { data: businessList } = await supabaseAdmin
            .from('businesses')
            .select('id, name, slug, country, currency, timezone, language, tax_rate, vat_enabled, tax_number, logo_url, branch_count')
            .in('id', businessIds);
          
          if (businessList) {
            businesses = businessList;
          }
        }
      }
    }

    // Generate JWT token with branch info
    const token = this.generateToken({
      userId: String(user.id),
      username: user.username,
      role: user.role,
      businessId: String(user.business_id),
      branchId: user.branch_id ? String(user.branch_id) : undefined,
    });

    // Update last login
    await supabaseAdmin
      .from('business_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Remove password hash from response
    const { password_hash, ...safeUser } = user;

    // Build user settings object (with defaults for new users)
    const userSettings: UserSettings = {
      preferred_language: user.preferred_language || business?.language || 'en',
      preferred_theme: (user.preferred_theme as 'light' | 'dark' | 'system') || 'system',
      settings: user.settings || {},
    };

    return {
      token,
      user: safeUser,
      business,
      branch,
      businesses: businesses.length > 0 ? businesses : undefined,
      userSettings,
    };
  }

  /**
   * Generate JWT token for business user
   */
  generateToken(payload: BusinessAuthPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as string,
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): BusinessAuthPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as BusinessAuthPayload;
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get business user by ID
   */
  async getUserById(userId: string): Promise<Omit<BusinessUser, 'password_hash'> | null> {
    const { data, error } = await supabaseAdmin
      .from('business_users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    
    const { password_hash, ...safeUser } = data;
    return safeUser;
  }

  /**
   * Check if owner has access to a specific business
   * Used for workspace switching validation
   */
  async checkOwnerBusinessAccess(username: string, businessId: number): Promise<boolean> {
    try {
      // Check if the owner has a record in the owners table that links to this business
      const { data: ownerAccess, error } = await supabaseAdmin
        .from('owners')
        .select(`
          id,
          business_owners!inner (
            business_id
          )
        `)
        .ilike('username', username)
        .eq('business_owners.business_id', businessId);

      if (error) {
        console.error('Error checking owner business access:', error);
        return false;
      }

      return ownerAccess && ownerAccess.length > 0;
    } catch (err) {
      console.error('Exception checking owner business access:', err);
      return false;
    }
  }
}

export const businessAuthService = new BusinessAuthService();

