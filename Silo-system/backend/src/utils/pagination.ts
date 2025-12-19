/**
 * Pagination Utilities
 * 
 * Provides consistent pagination across all API endpoints
 * Updated: Fixed MAX_LIMIT to 1000
 */

import { Request } from 'express';

/**
 * Pagination parameters extracted from request
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  fields?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination metadata for response
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Default pagination settings
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 1000;  // Increased to support loading all items for management pages

/**
 * Extract pagination parameters from request query
 */
export function extractPaginationParams(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit as string) || DEFAULT_LIMIT)
  );
  const offset = (page - 1) * limit;

  // Extract fields for partial response
  let fields: string[] | undefined;
  if (req.query.fields) {
    fields = (req.query.fields as string).split(',').map(f => f.trim());
  }

  // Extract sorting
  const sortBy = req.query.sort_by as string | undefined;
  const sortOrder = (req.query.sort_order as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

  return { page, limit, offset, fields, sortBy, sortOrder };
}

/**
 * Build pagination metadata from total count
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Apply pagination to a Supabase query
 * Returns the query with range applied
 */
export function applyPagination<T>(
  query: any,
  params: PaginationParams
): any {
  return query.range(params.offset, params.offset + params.limit - 1);
}

/**
 * Filter object properties based on allowed fields
 * Used for partial responses
 */
export function filterFields<T extends Record<string, any>>(
  data: T[],
  fields?: string[]
): Partial<T>[] {
  if (!fields || fields.length === 0) {
    return data;
  }

  return data.map(item => {
    const filtered: Partial<T> = {};
    for (const field of fields) {
      if (field in item) {
        (filtered as any)[field] = item[field];
      }
    }
    return filtered;
  });
}

/**
 * Build SQL SELECT fields clause from fields array
 */
export function buildSelectFields(fields?: string[], defaultFields: string = '*'): string {
  if (!fields || fields.length === 0) {
    return defaultFields;
  }
  
  // Always include id for reference
  if (!fields.includes('id')) {
    fields = ['id', ...fields];
  }
  
  return fields.join(', ');
}

/**
 * Build paginated response object
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
  filterByFields: boolean = false
): PaginatedResponse<T> {
  const pagination = buildPaginationMeta(total, params.page, params.limit);
  const filteredData = filterByFields && params.fields 
    ? filterFields(data as any[], params.fields) as T[]
    : data;

  return {
    data: filteredData,
    pagination,
  };
}

/**
 * Helper to get count from Supabase query
 */
export async function getCount(
  supabase: any,
  table: string,
  conditions?: Record<string, any>
): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  
  if (conditions) {
    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
  }
  
  const { count } = await query;
  return count || 0;
}

