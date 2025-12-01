/**
 * Items/Inventory API Client
 * Handles all inventory item-related API calls
 * 
 * IMPORTANT: Uses shared api client from './api' which has baseURL set to
 * NEXT_PUBLIC_API_URL (e.g., http://localhost:9000/api)
 * All paths should NOT include '/api' prefix as it's already in the baseURL
 */

import api from './api';
import { Item, CreateItemData, UpdateItemData, ItemCategory } from '@/types/items';

// Re-export types for convenience
export type { Item, CreateItemData, UpdateItemData, ItemCategory };

// Get all items for the current business
export async function getItems(filters?: {
  category?: ItemCategory;
}): Promise<Item[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);

  const response = await api.get(`/inventory/items?${params.toString()}`);
  return response.data.data;
}

// Get single item
export async function getItem(itemId: number): Promise<Item> {
  const response = await api.get(`/inventory/items/${itemId}`);
  return response.data.data;
}

// Create new item
export async function createItem(data: CreateItemData): Promise<Item> {
  const response = await api.post('/inventory/items', data);
  return response.data.data;
}

// Update item
export async function updateItem(itemId: number, data: UpdateItemData): Promise<Item> {
  const response = await api.put(`/inventory/items/${itemId}`, data);
  return response.data.data;
}

// Delete item (soft delete - set status to inactive)
export async function deleteItem(itemId: number): Promise<Item> {
  const response = await api.put(`/inventory/items/${itemId}`, { status: 'inactive' });
  return response.data.data;
}

// Set business-specific price for an item
export async function setItemPrice(itemId: number, price: number): Promise<void> {
  await api.put(`/inventory/items/${itemId}/price`, { price });
}

// Reset item price to default (remove business-specific price)
export async function resetItemPrice(itemId: number): Promise<void> {
  await api.delete(`/inventory/items/${itemId}/price`);
}

