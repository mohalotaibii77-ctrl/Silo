/**
 * BUSINESS AUTH SERVICE
 * Handles authentication for business users (owner, manager, employee)
 * These users are created via SuperAdmin and stored in business_users table
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/database';
import { env } from '../config/env';

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

export interface BusinessLoginResponse {
  token: string;
  user: Omit<BusinessUser, 'password_hash'>;
  business: {
    id: number;
    name: string;
    slug: string;
    currency?: string;
    tax_rate?: number;
    language?: string;
    logo_url?: string;
    branch_count?: number;
  } | null;
  branch: Branch | null;
}

export class BusinessAuthService {
  
  /**
   * Login business user with username and password
   */
  async login(username: string, password: string): Promise<BusinessLoginResponse> {
    console.log('Business user login attempt for:', username);
    
    // Get user from business_users table (case-insensitive username match)
    const { data: user, error } = await supabaseAdmin
      .from('business_users')
      .select('*')
      .ilike('username', username.trim())
      .single();

    console.log('DB query result - error:', error, 'user found:', !!user);

    if (error || !user) {
      console.log('Business user not found or DB error');
      throw new Error('Invalid username or password');
    }

    console.log('Business user found, checking password...');

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new Error('Account is disabled');
    }

    // Get business info including settings
    let business = null;
    if (user.business_id) {
      const { data: bizData } = await supabaseAdmin
        .from('businesses')
        .select('id, name, slug, currency, tax_rate, language, logo_url, branch_count')
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

    return {
      token,
      user: safeUser,
      business,
      branch,
    };
  }

  /**
   * Generate JWT token for business user
   */
  generateToken(payload: BusinessAuthPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
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
}

export const businessAuthService = new BusinessAuthService();

