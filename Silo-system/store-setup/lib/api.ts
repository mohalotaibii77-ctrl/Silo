import axios from 'axios';

// Base API client for store-setup frontend
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth tokens
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('setup_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('setup_token');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

