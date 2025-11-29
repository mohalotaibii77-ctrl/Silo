import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend API URL - all routes are under /api
const API_URL = 'http://localhost:9000/api';

export const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;



