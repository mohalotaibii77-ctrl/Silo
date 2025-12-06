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
    // Don't log 404 errors - they're often expected (e.g., product without ingredients)
    // Let individual pages handle errors appropriately
    if (error.response?.status !== 404) {
      console.error('API Error:', error.response?.status, error.response?.data);
    }
    return Promise.reject(error);
  }
);

export default api;
