import axios, { AxiosError } from 'axios';
import type { 
  Business, 
  CreateBusinessInput, 
  UpdateBusinessInput,
  AuthResponse,
  ApiResponse,
  LoginCredentials,
  BusinessUser
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: false,
});

// Types for API responses
export interface UserCredentials {
  username: string;
  password: string;
  role: string;
}

export interface CreateBusinessResponse {
  message: string;
  business: Business;
  userCredentials?: UserCredentials[];
}

export interface UpdateBusinessResponse {
  message: string;
  business: Business;
  userCredentials?: UserCredentials[];
}

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 unauthorized
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/auth/login', credentials);
    return response.data;
  },
  
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },
};

// Business APIs - All calls go through backend (backend calls Supabase)
export const businessApi = {
  getAll: async (): Promise<Business[]> => {
    const response = await api.get<{ businesses: Business[] }>('/api/businesses');
    return response.data.businesses || [];
  },
  
  getById: async (id: number): Promise<Business> => {
    const response = await api.get<{ business: Business }>(`/api/businesses/${id}`);
    return response.data.business;
  },
  
  create: async (data: CreateBusinessInput): Promise<CreateBusinessResponse> => {
    const response = await api.post<CreateBusinessResponse>('/api/businesses', data);
    return response.data;
  },
  
  update: async (id: number, data: UpdateBusinessInput): Promise<UpdateBusinessResponse> => {
    const response = await api.put<UpdateBusinessResponse>(`/api/businesses/${id}`, data);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/businesses/${id}`);
  },
};

// User APIs
export const userApi = {
  getByBusinessId: async (businessId: number): Promise<BusinessUser[]> => {
    const response = await api.get<{ users: BusinessUser[] }>(`/api/users?business_id=${businessId}`);
    return response.data.users || [];
  },
  
  create: async (data: Partial<BusinessUser> & { business_id: number }): Promise<BusinessUser> => {
    const response = await api.post<{ user: BusinessUser }>('/api/users', data);
    return response.data.user;
  },
  
  update: async (id: number, data: Partial<BusinessUser>): Promise<BusinessUser> => {
    const response = await api.put<{ user: BusinessUser }>(`/api/users/${id}`, data);
    return response.data.user;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/users/${id}`);
  },
};

export default api;



