// types/index.ts

export interface User {
  id: number;
  business_id: number | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'super_admin' | 'owner' | 'manager' | 'employee' | 'pos';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

// Business user (employees, managers, owners assigned to a business)
export interface BusinessUser {
  id?: number;
  business_id?: number;
  username: string;
  password?: string; // Only used when creating/updating, not returned from API
  role: 'owner' | 'manager' | 'employee' | 'pos';
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
  last_login?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Business {
  id: number;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  business_type: string;
  certificate_url: string | null;
  subscription_tier: 'basic' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'inactive' | 'suspended' | 'trial';
  max_users: number;
  max_products: number;
  created_at: string;
  updated_at: string;
  user_count?: number;
  product_count?: number;
  order_count?: number;
  users?: BusinessUser[]; // Users associated with this business
}

export interface CreateBusinessInput {
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  business_type?: string;
  certificate_url?: string;
  subscription_tier?: 'basic' | 'pro' | 'enterprise';
  max_users?: number;
  max_products?: number;
  users?: BusinessUser[]; // Users to create with the business
}

export interface UpdateBusinessInput extends Partial<CreateBusinessInput> {
  subscription_status?: 'active' | 'inactive' | 'suspended' | 'trial';
  users?: BusinessUser[]; // Users to add/update
  deleteUserIds?: number[]; // IDs of users to delete
}

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
