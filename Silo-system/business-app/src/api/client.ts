import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SECURE_TOKEN_KEY = 'auth_token';

/**
 * Backend API URL Configuration
 * 
 * Priority order:
 * 1. EXPO_PUBLIC_API_URL environment variable
 * 2. app.json extra.apiUrl config
 * 3. Default to localhost:9000
 * 
 * FOR PHYSICAL DEVICES:
 * Replace 'localhost' with your computer's local IP address
 * e.g., http://192.168.1.100:9000
 * 
 * Find your IP:
 * - Windows: ipconfig (look for IPv4 Address)
 * - Mac/Linux: ifconfig or ip addr
 */
const getApiBase = () => {
  // Hardcoded LAN IP for development
  return 'http://192.168.0.244:9000';
};

const API_BASE = getApiBase();
export const API_URL = `${API_BASE}/api`;

// Log the API URL in development for debugging
if (__DEV__) {
  console.log('📡 API Base URL:', API_BASE);
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15 seconds timeout for mobile networks
});

// Helper function to get token with migration from AsyncStorage to SecureStore
const getAuthToken = async (): Promise<string | null> => {
  try {
    // First try SecureStore (preferred)
    let token = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    if (token) {
      return token;
    }

    // Fall back to AsyncStorage for backward compatibility
    token = await AsyncStorage.getItem('token');
    if (token) {
      // Migrate token to SecureStore
      try {
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
        // Don't remove from AsyncStorage yet - other code may still use it
        console.log('[Auth] Token migrated to SecureStore');
      } catch (migrateError) {
        console.warn('[Auth] Could not migrate token to SecureStore:', migrateError);
      }
      return token;
    }

    return null;
  } catch (error) {
    console.warn('[Auth] Error getting token:', error);
    // Fall back to AsyncStorage if SecureStore fails
    return AsyncStorage.getItem('token');
  }
};

// Add auth token and business/branch headers to requests
api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add business ID header for workspace switching
  const businessStr = await AsyncStorage.getItem('business');
  if (businessStr) {
    try {
      const business = JSON.parse(businessStr);
      if (business?.id) {
        config.headers['X-Business-Id'] = business.id.toString();
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Add branch ID header if available
  const branchStr = await AsyncStorage.getItem('branch');
  if (branchStr) {
    try {
      const branch = JSON.parse(branchStr);
      if (branch?.id) {
        config.headers['X-Branch-Id'] = branch.id.toString();
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  return config;
});

// Store token securely (use this instead of AsyncStorage.setItem('token', ...))
export const storeAuthToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
    // Also store in AsyncStorage for backward compatibility
    await AsyncStorage.setItem('token', token);
  } catch (error) {
    console.error('[Auth] Error storing token:', error);
    // Fall back to AsyncStorage only
    await AsyncStorage.setItem('token', token);
  }
};

// Clear token from both storages
export const clearAuthToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
    await AsyncStorage.removeItem('token');
  } catch (error) {
    console.error('[Auth] Error clearing token:', error);
    await AsyncStorage.removeItem('token');
  }
};

// Export the getAuthToken function for use elsewhere
export { getAuthToken };

export default api;



