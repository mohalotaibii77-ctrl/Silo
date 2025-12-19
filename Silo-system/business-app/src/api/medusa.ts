import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Medusa Backend URL
const MEDUSA_URL = 'http://localhost:9000';

// Publishable API Key from Silo database
const PUBLISHABLE_KEY = 'pk_dd11c21c40448caf17df8dab78ba41877a0d89c4d69d977574bf037bc2c7189f';

// Create Medusa API client
export const medusaApi = axios.create({
  baseURL: MEDUSA_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-publishable-api-key': PUBLISHABLE_KEY,
  },
});

// Types
export interface Product {
  id: string;
  title: string;
  description: string;
  handle: string;
  thumbnail: string | null;
  variants: ProductVariant[];
  options: ProductOption[];
}

export interface ProductVariant {
  id: string;
  title: string;
  prices: Price[];
  inventory_quantity?: number;
}

export interface ProductOption {
  id: string;
  title: string;
  values: { id: string; value: string }[];
}

export interface Price {
  id: string;
  amount: number;
  currency_code: string;
}

export interface CartItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  variant: ProductVariant;
  thumbnail: string | null;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
  subtotal: number;
  region_id: string;
}

export interface Region {
  id: string;
  name: string;
  currency_code: string;
}

// API Functions

// Get all regions
export const getRegions = async (): Promise<Region[]> => {
  const response = await medusaApi.get('/store/regions');
  return response.data.regions;
};

// Get all products
export const getProducts = async (limit = 100): Promise<Product[]> => {
  const response = await medusaApi.get('/store/products', {
    params: { limit },
  });
  return response.data.products;
};

// Get product by ID
export const getProduct = async (id: string): Promise<Product> => {
  const response = await medusaApi.get(`/store/products/${id}`);
  return response.data.product;
};

// Get product categories
export const getCategories = async () => {
  const response = await medusaApi.get('/store/product-categories', {
    params: { limit: 100 },
  });
  return response.data.product_categories;
};

// Create a new cart
export const createCart = async (regionId: string): Promise<Cart> => {
  const response = await medusaApi.post('/store/carts', {
    region_id: regionId,
  });
  return response.data.cart;
};

// Get cart by ID
export const getCart = async (cartId: string): Promise<Cart> => {
  const response = await medusaApi.get(`/store/carts/${cartId}`);
  return response.data.cart;
};

// Add item to cart
export const addToCart = async (
  cartId: string,
  variantId: string,
  quantity: number
): Promise<Cart> => {
  const response = await medusaApi.post(`/store/carts/${cartId}/line-items`, {
    variant_id: variantId,
    quantity,
  });
  return response.data.cart;
};

// Update cart item quantity
export const updateCartItem = async (
  cartId: string,
  itemId: string,
  quantity: number
): Promise<Cart> => {
  const response = await medusaApi.post(`/store/carts/${cartId}/line-items/${itemId}`, {
    quantity,
  });
  return response.data.cart;
};

// Remove item from cart
export const removeFromCart = async (
  cartId: string,
  itemId: string
): Promise<Cart> => {
  const response = await medusaApi.delete(`/store/carts/${cartId}/line-items/${itemId}`);
  return response.data.cart;
};

// Complete cart (create order)
export const completeCart = async (cartId: string) => {
  const response = await medusaApi.post(`/store/carts/${cartId}/complete`);
  return response.data;
};

// Helper to store cart ID
export const storeCartId = async (cartId: string) => {
  await AsyncStorage.setItem('medusa_cart_id', cartId);
};

export const getStoredCartId = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('medusa_cart_id');
};

export const clearStoredCartId = async () => {
  await AsyncStorage.removeItem('medusa_cart_id');
};

// Format price helper - currency must be passed from business settings
export const formatPrice = (amount: number, currencyCode: string): string => {
  if (!currencyCode) {
    // If no currency, just format the number
    return (amount / 100).toFixed(2);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode.toUpperCase(),
  }).format(amount / 100);
};

export default medusaApi;









