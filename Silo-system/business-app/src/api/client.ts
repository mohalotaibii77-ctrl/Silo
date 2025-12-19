import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

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
  // First check environment variable
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Then check app.json config
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl;
  }
  // Default fallback
  return 'http://localhost:9000';
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

// Add auth token and business/branch headers to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
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

export default api;



