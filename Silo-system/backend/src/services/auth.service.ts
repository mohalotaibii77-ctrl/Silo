/**
 * AUTH SERVICE
 * Handles authentication and authorization
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/database';
import { env } from '../config/env';
import { User, Business, AuthPayload, LoginResponse } from '../types';

export class AuthService {
  
  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    console.log('Login attempt for:', email);
    
    // Get user from database (case-insensitive email match)
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike('email', email.trim())
      .single();

    console.log('DB query result - error:', error, 'user found:', !!user);

    if (error || !user) {
      console.log('User not found or DB error');
      throw new Error('Invalid email or password');
    }

    console.log('User found, checking password...');
    console.log('Password hash from DB:', user.password_hash?.substring(0, 20) + '...');

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active (status field)
    if (user.status !== 'active') {
      throw new Error('Account is disabled');
    }

    // Generate JWT token
    const token = this.generateToken({
      userId: String(user.id),
      email: user.email,
      role: user.role,
      businessId: user.business_id ? String(user.business_id) : '',
    });

    // Get business if user has one
    let business: Business | null = null;
    if (user.business_id) {
      const { data: bizData } = await supabaseAdmin
        .from('businesses')
        .select('*')
        .eq('id', user.business_id)
        .single();
      business = bizData as Business;
    }

    // Remove sensitive data
    const { password_hash, ...safeUser } = user;

    return {
      token,
      user: safeUser as User,
      business: business as Business,
    };
  }

  /**
   * Register new user
   */
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessId: string;
    role?: string;
  }): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 12);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: data.email.toLowerCase(),
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
        business_id: data.businessId,
        role: data.role || 'employee',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Email already exists');
      }
      throw new Error('Failed to create user');
    }

    const { password_hash, ...safeUser } = user;
    return safeUser as User;
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: AuthPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): AuthPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    
    const { password_hash, ...safeUser } = data;
    return safeUser as User;
  }
}

export const authService = new AuthService();

