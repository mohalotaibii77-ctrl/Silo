/**
 * Users API Client
 * Handles all business user management API calls
 * 
 * IMPORTANT: Uses shared api client from './api' which has baseURL set to
 * NEXT_PUBLIC_API_URL (e.g., http://localhost:9000/api)
 * All paths should NOT include '/api' prefix as it's already in the baseURL
 */

import api from './api';

// User permissions for Business-App access control
export interface UserPermissions {
  orders: boolean;      // View/manage orders
  menu_edit: boolean;   // Items, Products, Bundles, Categories
  inventory: boolean;   // PO, Transfers, Vendors, Counts
  delivery: boolean;    // Delivery Partners
  tables: boolean;      // Table Management
  drivers: boolean;     // Driver Management
  discounts: boolean;   // Discount Management
  pos_access: boolean;  // POS Terminal Access
}

// Default permissions by role
export const DEFAULT_PERMISSIONS: Record<'manager' | 'employee', UserPermissions> = {
  manager: {
    orders: true,
    menu_edit: true,
    inventory: true,
    delivery: true,
    tables: true,
    drivers: true,
    discounts: true,
    pos_access: true,
  },
  employee: {
    orders: false,
    menu_edit: false,
    inventory: false,
    delivery: false,
    tables: false,
    drivers: false,
    discounts: false,
    pos_access: false,
  },
};

export interface BusinessUser {
  id: number;
  username: string;
  role: 'owner' | 'manager' | 'employee' | 'pos' | 'kitchen_display';
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  permissions?: UserPermissions | null;  // Only for manager/employee roles
  last_login?: string;
  created_at: string;
}

export interface CreateUserData {
  username: string;
  role: 'manager' | 'employee' | 'pos' | 'kitchen_display';
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  permissions?: UserPermissions;  // Only for manager/employee roles
}

export interface UpdateUserData {
  username?: string;
  role?: 'manager' | 'employee' | 'pos' | 'kitchen_display';
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
  permissions?: UserPermissions;  // Only for manager/employee roles
}

export interface UsersResponse {
  data: BusinessUser[];
  max_users: number;
  user_count: number;
  current_user_id: number;
}

// Get all users for the business
export async function getUsers(): Promise<UsersResponse> {
  const response = await api.get('/business-users');
  return response.data;
}

// Create a new user
export async function createUser(data: CreateUserData): Promise<{ data: BusinessUser; default_password: string }> {
  const response = await api.post('/business-users', data);
  return response.data;
}

// Update a user
export async function updateUser(id: number, data: UpdateUserData): Promise<BusinessUser> {
  const response = await api.put(`/business-users/${id}`, data);
  return response.data.data;
}

// Delete a user
export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/business-users/${id}`);
}

// Reset user password to default
export async function resetUserPassword(id: number): Promise<{ default_password: string }> {
  const response = await api.post(`/business-users/${id}/reset-password`);
  return response.data;
}

