import axios, { AxiosError } from 'axios';
import type { 
  Business, 
  Branch,
  CreateBusinessInput, 
  UpdateBusinessInput,
  AuthResponse,
  ApiResponse,
  LoginCredentials,
  BusinessUser,
  BranchInput,
  Owner,
  CreateOwnerInput,
  UpdateOwnerInput,
  UnassignedBusiness
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
  branches?: Branch[];
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
      // Don't redirect on login endpoint failures - let the login page handle the error
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      
      if (!isLoginRequest && typeof window !== 'undefined') {
        // Unauthorized on protected routes - redirect to login
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

  deleteWithPassword: async (id: number, password: string): Promise<void> => {
    await api.delete(`/api/businesses/${id}`, {
      data: { password }
    });
  },

  // Branch management
  getBranches: async (businessId: number): Promise<Branch[]> => {
    const response = await api.get<{ branches: Branch[] }>(`/api/businesses/${businessId}/branches`);
    return response.data.branches || [];
  },

  createBranch: async (businessId: number, data: BranchInput): Promise<Branch> => {
    const response = await api.post<{ branch: Branch }>(`/api/businesses/${businessId}/branches`, data);
    return response.data.branch;
  },

  updateBranch: async (businessId: number, branchId: number, data: Partial<BranchInput>): Promise<Branch> => {
    const response = await api.put<{ branch: Branch }>(`/api/businesses/${businessId}/branches/${branchId}`, data);
    return response.data.branch;
  },

  deleteBranch: async (businessId: number, branchId: number): Promise<void> => {
    await api.delete(`/api/businesses/${businessId}/branches/${branchId}`);
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

// Owner APIs (platform-level owners who can own multiple businesses)
export const ownerApi = {
  // Get all owners with their business counts
  getAll: async (): Promise<Owner[]> => {
    const response = await api.get<{ owners: Owner[] }>('/api/owners');
    return response.data.owners || [];
  },

  // Get owner by ID with associated businesses
  getById: async (id: number): Promise<Owner> => {
    const response = await api.get<{ owner: Owner }>(`/api/owners/${id}`);
    return response.data.owner;
  },

  // Create a new owner
  create: async (data: CreateOwnerInput): Promise<{ message: string; owner: Owner }> => {
    const response = await api.post<{ message: string; owner: Owner }>('/api/owners', data);
    return response.data;
  },

  // Update an owner
  update: async (id: number, data: UpdateOwnerInput): Promise<{ message: string; owner: Owner }> => {
    const response = await api.put<{ message: string; owner: Owner }>(`/api/owners/${id}`, data);
    return response.data;
  },

  // Delete an owner
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/owners/${id}`);
  },

  // Get businesses without any owner
  getUnassignedBusinesses: async (): Promise<UnassignedBusiness[]> => {
    const response = await api.get<{ businesses: UnassignedBusiness[] }>('/api/owners/unassigned-businesses');
    return response.data.businesses || [];
  },

  // Link a business to an owner
  linkBusiness: async (ownerId: number, businessId: number, role?: string): Promise<void> => {
    await api.post(`/api/owners/${ownerId}/link-business`, { 
      business_id: businessId, 
      role: role || 'owner' 
    });
  },

  // Unlink a business from an owner
  unlinkBusiness: async (ownerId: number, businessId: number): Promise<void> => {
    await api.delete(`/api/owners/${ownerId}/unlink-business/${businessId}`);
  },
};

export default api;



