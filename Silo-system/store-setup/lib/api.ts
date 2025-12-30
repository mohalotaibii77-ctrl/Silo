/**
 * Shared API Client for Store-Setup Frontend
 * 
 * IMPORTANT CONVENTION:
 * - The baseURL MUST include '/api' suffix (e.g., http://localhost:9000/api)
 * - All API paths should NOT include '/api' prefix
 * - Example: Use '/inventory/items' NOT '/api/inventory/items'
 * 
 * This ensures consistent URL construction across all API files:
 * - items-api.ts     → '/inventory/items'
 * - products-api.ts  → '/store-products'
 * - categories-api.ts → '/categories'
 * - discounts-api.ts → '/discounts'
 * - users-api.ts     → '/business-users'
 */

import axios from 'axios';

// Base API client - baseURL should include /api
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens and business/branch context
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('setup_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add current business ID from workspace selection
    const storedBusiness = localStorage.getItem('setup_business');
    if (storedBusiness) {
      try {
        const business = JSON.parse(storedBusiness);
        if (business.id) {
          config.headers['X-Business-Id'] = business.id.toString();
        }
      } catch {}
    }
    
    // Add current branch ID from branch selection
    const storedBranch = localStorage.getItem('setup_branch');
    if (storedBranch) {
      try {
        const branch = JSON.parse(storedBranch);
        if (branch.id) {
          config.headers['X-Branch-Id'] = branch.id.toString();
        }
      } catch {}
    }
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't spam Next.js dev overlay for expected client errors (4xx).
    // Pages handle validation/expected errors (e.g., "pending request") themselves.
    const status = error.response?.status;
    if (!status) {
      console.error('API Error: no response', error);
    } else if (status >= 500) {
      console.error('API Error:', status, error.response?.data);
    } else if (status !== 404) {
      // Use warn to avoid red overlay while still surfacing info during dev
      console.warn('API Warning:', status, error.response?.data);
    }
    return Promise.reject(error);
  }
);

export default api;
