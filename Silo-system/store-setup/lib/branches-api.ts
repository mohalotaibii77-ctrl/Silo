/**
 * Branches API Client
 * Handles branch management API calls for the authenticated business
 */

import api from './api';

export interface Branch {
  id: number;
  name: string;
  branch_code?: string;
  address?: string;
  phone?: string;
  is_main: boolean;
  latitude?: number;
  longitude?: number;
}

export interface BranchesResponse {
  success: boolean;
  data: Branch[];
}

// Get all branches for the authenticated business
export async function getBranches(): Promise<Branch[]> {
  const response = await api.get<BranchesResponse>('/business-settings/branches');
  return response.data.data;
}
