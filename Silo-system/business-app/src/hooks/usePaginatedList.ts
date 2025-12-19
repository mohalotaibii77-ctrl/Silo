import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { cacheManager, CACHE_TTL } from '../services/CacheManager';
import api from '../api/client';

/**
 * Pagination metadata from API response
 */
interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Options for usePaginatedList hook
 */
interface UsePaginatedListOptions<T> {
  /** API endpoint path */
  endpoint: string;
  /** Number of items per page */
  pageSize?: number;
  /** Fields to fetch for list view (comma-separated or array) */
  fields?: string | string[];
  /** Additional query parameters */
  params?: Record<string, string | number | boolean>;
  /** Whether to enable the query */
  enabled?: boolean;
  /** Cache TTL in milliseconds */
  ttl?: number;
  /** Transform response data */
  transform?: (data: any) => T[];
  /** Data key in response (default: 'data') */
  dataKey?: string;
  /** Refetch when app comes to foreground */
  refetchOnFocus?: boolean;
  /** Callback when data is loaded */
  onSuccess?: (data: T[], meta: PaginationMeta) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Result returned by usePaginatedList hook
 */
interface UsePaginatedListResult<T> {
  /** All loaded data items */
  data: T[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Loading state for loading more */
  isLoadingMore: boolean;
  /** Refreshing state */
  isRefreshing: boolean;
  /** Error from the last fetch */
  error: Error | null;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Current page number */
  page: number;
  /** Total number of items */
  total: number;
  /** Load more items (for infinite scroll) */
  loadMore: () => Promise<void>;
  /** Refresh data (pull to refresh) */
  refresh: () => Promise<void>;
  /** Manually refetch with new params */
  refetch: (newParams?: Record<string, string | number | boolean>) => Promise<void>;
}

/**
 * Custom hook for paginated data fetching with infinite scroll
 * 
 * @example
 * const { data, isLoading, hasMore, loadMore, refresh } = usePaginatedList({
 *   endpoint: '/inventory/items',
 *   pageSize: 20,
 *   fields: ['id', 'name', 'category', 'unit', 'cost_per_unit'],
 * });
 * 
 * // In FlatList
 * <FlatList
 *   data={data}
 *   onEndReached={loadMore}
 *   onRefresh={refresh}
 *   refreshing={isRefreshing}
 * />
 */
export function usePaginatedList<T = any>(
  options: UsePaginatedListOptions<T>
): UsePaginatedListResult<T> {
  const {
    endpoint,
    pageSize = 20,
    fields,
    params = {},
    enabled = true,
    ttl = CACHE_TTL.MEDIUM,
    transform,
    dataKey = 'data',
    refetchOnFocus = false,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const mountedRef = useRef(true);
  const currentParamsRef = useRef(params);
  const isFetchingRef = useRef(false);

  // Build cache key from endpoint and params
  const getCacheKey = useCallback((pageNum: number, queryParams: Record<string, any>) => {
    const paramString = Object.entries({ ...queryParams, page: pageNum, limit: pageSize })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `paginated_${endpoint}_${paramString}`;
  }, [endpoint, pageSize]);

  // Fetch a single page of data
  const fetchPage = useCallback(async (
    pageNum: number,
    queryParams: Record<string, any>,
    forceRefresh = false
  ): Promise<{ items: T[]; meta: PaginationMeta }> => {
    const cacheKey = getCacheKey(pageNum, queryParams);

    return cacheManager.getOrFetch(
      cacheKey,
      async () => {
        // Build query string
        const urlParams = new URLSearchParams();
        urlParams.append('page', pageNum.toString());
        urlParams.append('limit', pageSize.toString());
        
        // Add fields parameter
        if (fields) {
          const fieldList = Array.isArray(fields) ? fields.join(',') : fields;
          urlParams.append('fields', fieldList);
        }

        // Add additional params
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            urlParams.append(key, String(value));
          }
        });

        const response = await api.get(`${endpoint}?${urlParams.toString()}`);
        const responseData = response.data;

        // Extract items from response
        let items = responseData[dataKey] || responseData.items || responseData.data || [];
        
        // Apply transform if provided
        if (transform) {
          items = transform(items);
        }

        // Extract pagination metadata
        const meta: PaginationMeta = {
          page: responseData.page || responseData.pagination?.page || pageNum,
          limit: responseData.limit || responseData.pagination?.limit || pageSize,
          total: responseData.total || responseData.pagination?.total || responseData.count || items.length,
          totalPages: responseData.totalPages || responseData.pagination?.totalPages || 
                      Math.ceil((responseData.total || items.length) / pageSize),
          hasMore: responseData.hasMore ?? responseData.pagination?.hasMore ?? 
                   (items.length >= pageSize),
        };

        return { items, meta };
      },
      { ttl, forceRefresh }
    );
  }, [endpoint, pageSize, fields, dataKey, transform, ttl, getCacheKey]);

  // Initial load - checks cache first to avoid unnecessary loading state
  const loadInitial = useCallback(async (queryParams: Record<string, any>, forceRefresh = false) => {
    if (!enabled || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setError(null);

    // Check cache first before showing loading state
    // This prevents skeleton flash when data is already cached
    const cacheKey = getCacheKey(1, queryParams);
    const cachedData = !forceRefresh ? await cacheManager.get<{ items: any[]; meta: PaginationMeta }>(cacheKey) : null;
    
    if (cachedData && mountedRef.current) {
      // We have cached data - show it immediately without skeleton
      setData(cachedData.items);
      setPage(1);
      setHasMore(cachedData.meta.hasMore);
      setTotal(cachedData.meta.total);
      setIsLoading(false);
      setIsRefreshing(false);
      onSuccess?.(cachedData.items, cachedData.meta);
      
      // Check if cache is stale and refresh in background
      // The fetchPage will handle stale-while-revalidate
      fetchPage(1, queryParams, false).then(({ items, meta }) => {
        if (mountedRef.current && JSON.stringify(items) !== JSON.stringify(cachedData.items)) {
          setData(items);
          setHasMore(meta.hasMore);
          setTotal(meta.total);
        }
      }).catch(() => {}); // Silent background refresh
      
      isFetchingRef.current = false;
      return;
    }

    // No cached data - show loading state and fetch
    setIsLoading(true);

    try {
      const { items, meta } = await fetchPage(1, queryParams, forceRefresh);

      if (mountedRef.current) {
        setData(items);
        setPage(1);
        setHasMore(meta.hasMore);
        setTotal(meta.total);
        onSuccess?.(items, meta);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
        onError?.(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  }, [enabled, fetchPage, getCacheKey, onSuccess, onError]);

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || isLoadingMore || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const { items, meta } = await fetchPage(nextPage, currentParamsRef.current);

      if (mountedRef.current) {
        setData(prev => [...prev, ...items]);
        setPage(nextPage);
        setHasMore(meta.hasMore);
        setTotal(meta.total);
        onSuccess?.([...data, ...items], meta);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
        onError?.(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMore(false);
      }
      isFetchingRef.current = false;
    }
  }, [enabled, hasMore, isLoadingMore, page, fetchPage, data, onSuccess, onError]);

  // Refresh (pull to refresh)
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadInitial(currentParamsRef.current, true);
  }, [loadInitial]);

  // Refetch with new params
  const refetch = useCallback(async (newParams?: Record<string, string | number | boolean>) => {
    if (newParams) {
      currentParamsRef.current = newParams;
    }
    
    // Invalidate all cached pages for this endpoint to prevent stale data
    // This ensures all pages are fresh when refetching, not just page 1
    const cachePattern = `^paginated_${endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_`;
    await cacheManager.invalidatePattern(cachePattern);
    
    setData([]);
    setPage(1);
    setHasMore(true);
    await loadInitial(currentParamsRef.current, true);
  }, [loadInitial, endpoint]);

  // Initial fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    currentParamsRef.current = params;
    loadInitial(params);

    return () => {
      mountedRef.current = false;
    };
  }, [endpoint, enabled]);

  // Refetch when params change
  useEffect(() => {
    const paramsChanged = JSON.stringify(params) !== JSON.stringify(currentParamsRef.current);
    if (paramsChanged && enabled) {
      currentParamsRef.current = params;
      setData([]);
      setPage(1);
      setHasMore(true);
      loadInitial(params);
    }
  }, [params, enabled, loadInitial]);

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && mountedRef.current && !isFetchingRef.current) {
        loadInitial(currentParamsRef.current);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refetchOnFocus, loadInitial]);

  return {
    data,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    hasMore,
    page,
    total,
    loadMore,
    refresh,
    refetch,
  };
}

/**
 * Pre-built paginated list hooks for common data types
 */
export function usePaginatedItems(options?: Partial<UsePaginatedListOptions<any>>) {
  return usePaginatedList({
    endpoint: '/inventory/items',
    pageSize: 30,
    fields: ['id', 'name', 'name_ar', 'category', 'unit', 'storage_unit', 'cost_per_unit', 'is_composite', 'is_system_item', 'sku', 'status', 'business_id'],
    dataKey: 'data',
    ...options,
  });
}

export function usePaginatedProducts(options?: Partial<UsePaginatedListOptions<any>>) {
  return usePaginatedList({
    endpoint: '/store-products',
    pageSize: 30,
    fields: ['id', 'name', 'name_ar', 'price', 'category', 'category_id', 'is_active', 'has_variants', 'image_url', 'thumbnail_url'],
    dataKey: 'data',
    ...options,
  });
}

export function usePaginatedOrders(status?: string, options?: Partial<UsePaginatedListOptions<any>>) {
  return usePaginatedList({
    endpoint: '/orders',
    pageSize: 20,
    params: status ? { status } : {},
    fields: ['id', 'order_number', 'display_number', 'order_status', 'payment_status', 'total_amount', 'order_type', 'customer_name', 'created_at'],
    dataKey: 'orders',
    ...options,
  });
}

export function usePaginatedStock(options?: Partial<UsePaginatedListOptions<any>>) {
  return usePaginatedList({
    endpoint: '/inventory-stock/stock',
    pageSize: 30,
    dataKey: 'data',
    ...options,
  });
}

export function usePaginatedPurchaseOrders(options?: Partial<UsePaginatedListOptions<any>>) {
  return usePaginatedList({
    endpoint: '/inventory-stock/purchase-orders',
    pageSize: 20,
    dataKey: 'data',
    ...options,
  });
}

export function usePaginatedVendors(options?: Partial<UsePaginatedListOptions<any>>) {
  return usePaginatedList({
    endpoint: '/inventory-stock/vendors',
    pageSize: 30,
    dataKey: 'data',
    ...options,
  });
}

