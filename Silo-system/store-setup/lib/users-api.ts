/**
 * Users API Client
 * Handles all business user management API calls
 * 
 * IMPORTANT: Uses shared api client from './api' which has baseURL set to
 * NEXT_PUBLIC_API_URL (e.g., http://localhost:9000/api)
 * All paths should NOT include '/api' prefix as it's already in the baseURL
 */

import api from './api';

export interface BusinessUser {
  id: number;
  username: string;
  role: 'owner' | 'manager' | 'employee' | 'pos';
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  last_login?: string;
  created_at: string;
}

export interface CreateUserData {
  username: string;
  role: 'manager' | 'employee' | 'pos';
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface UpdateUserData {
  username?: string;
  role?: 'manager' | 'employee' | 'pos';
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
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

