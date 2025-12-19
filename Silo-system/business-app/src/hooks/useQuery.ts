import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import api from '../api/client';

/**
 * Query options for useQuery hook
 */
interface UseQueryOptions<T> {
  /** Time-to-live for cache in milliseconds */
  ttl?: number;
  /** Whether to enable the query */
  enabled?: boolean;
  /** Whether to refetch when app comes to foreground */
  refetchOnFocus?: boolean;
  /** Refetch interval in milliseconds (0 = disabled) */
  refetchInterval?: number;
  /** Initial data to use while loading */
  initialData?: T;
  /** Callback when data is successfully fetched */
  onSuccess?: (data: T) => void;
  /** Callback when fetch fails */
  onError?: (error: Error) => void;
  /** Use stale data while revalidating */
  staleWhileRevalidate?: boolean;
  /** Number of retry attempts on failure */
  retryCount?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Query result returned by useQuery
 */
interface UseQueryResult<T> {
  /** The fetched data */
  data: T | null;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (true during any fetch, including background) */
  isFetching: boolean;
  /** Error from the last fetch */
  error: Error | null;
  /** Whether data is stale (from cache) */
  isStale: boolean;
  /** Manually refetch the data */
  refetch: (force?: boolean) => Promise<void>;
  /** Invalidate the cache for this query */
  invalidate: () => Promise<void>;
}

/**
 * Custom hook for data fetching with caching
 * 
 * @example
 * const { data, isLoading, error, refetch } = useQuery(
 *   'products',
 *   () => api.get('/store-products').then(r => r.data.data),
 *   { ttl: CACHE_TTL.MEDIUM }
 * );
 */
export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const {
    ttl = CACHE_TTL.MEDIUM,
    enabled = true,
    refetchOnFocus = true,
    refetchInterval = 0,
    initialData = null,
    onSuccess,
    onError,
    staleWhileRevalidate = true,
    retryCount = 2,
    retryDelay = 1000,
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch data with retry logic - checks cache first to avoid unnecessary loading state
  const fetchData = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!enabled) return;

    // Check cache first before showing loading state
    // This prevents skeleton flash when data is already cached
    if (!forceRefresh) {
      const cachedData = await cacheManager.get<T>(key);
      if (cachedData !== null && mountedRef.current) {
        // We have cached data - show it immediately without skeleton
        setData(cachedData);
        setIsLoading(false);
        setError(null);
        onSuccess?.(cachedData);
        
        // Still fetch in background to update cache (stale-while-revalidate)
        setIsFetching(true);
        cacheManager.getOrFetch(
          key,
          async () => {
            let lastError: Error | null = null;
            for (let attempt = 0; attempt <= retryCount; attempt++) {
              try {
                return await fetcher();
              } catch (err) {
                lastError = err as Error;
                if (attempt < retryCount) {
                  await new Promise(resolve => 
                    setTimeout(resolve, retryDelay * Math.pow(2, attempt))
                  );
                }
              }
            }
            throw lastError;
          },
          { ttl, forceRefresh: true, staleWhileRevalidate }
        ).then(result => {
          if (mountedRef.current && JSON.stringify(result) !== JSON.stringify(cachedData)) {
            setData(result);
            setIsStale(false);
            retryCountRef.current = 0;
          }
        }).catch(() => {}).finally(() => {
          if (mountedRef.current) setIsFetching(false);
        });
        return;
      }
    }

    // No cached data - show loading state and fetch
    setIsFetching(true);
    setIsLoading(true);

    try {
      const result = await cacheManager.getOrFetch(
        key,
        async () => {
          // Retry logic
          let lastError: Error | null = null;
          for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
              return await fetcher();
            } catch (err) {
              lastError = err as Error;
              if (attempt < retryCount) {
                await new Promise(resolve => 
                  setTimeout(resolve, retryDelay * Math.pow(2, attempt))
                );
              }
            }
          }
          throw lastError;
        },
        { ttl, forceRefresh, staleWhileRevalidate }
      );

      if (mountedRef.current) {
        setData(result);
        setError(null);
        setIsStale(false);
        retryCountRef.current = 0;
        onSuccess?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
        onError?.(err as Error);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, [key, fetcher, ttl, enabled, retryCount, retryDelay, staleWhileRevalidate, onSuccess, onError]);

  // Refetch function exposed to consumers
  const refetch = useCallback(async (force = true): Promise<void> => {
    await fetchData(force);
  }, [fetchData]);

  // Invalidate cache for this query
  const invalidate = useCallback(async (): Promise<void> => {
    await cacheManager.invalidate(key);
    setIsStale(true);
    await fetchData(true);
  }, [key, fetchData]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, [key, enabled]);

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && mountedRef.current) {
        fetchData();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refetchOnFocus, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval <= 0) return;

    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        fetchData();
      }
    }, refetchInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refetchInterval, fetchData]);

  // Subscribe to cache invalidation
  useEffect(() => {
    const unsubscribe = cacheManager.onInvalidate(key, () => {
      setIsStale(true);
    });

    return unsubscribe;
  }, [key]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    isStale,
    refetch,
    invalidate,
  };
}

/**
 * Prefetch data into cache
 */
export async function prefetchQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.MEDIUM
): Promise<void> {
  try {
    await cacheManager.getOrFetch(key, fetcher, { ttl });
  } catch (error) {
    console.warn('[prefetchQuery] Failed to prefetch:', key, error);
  }
}

/**
 * Invalidate queries matching a pattern
 */
export async function invalidateQueries(pattern: string): Promise<void> {
  await cacheManager.invalidatePattern(pattern);
}

/**
 * Pre-built query hooks for common data types
 */
export function useProducts(options?: UseQueryOptions<any[]>) {
  return useQuery(
    CacheKeys.products(),
    async () => {
      const response = await api.get('/store-products');
      return response.data.data || [];
    },
    { ttl: CACHE_TTL.MEDIUM, ...options }
  );
}

export function useCategories(options?: UseQueryOptions<any[]>) {
  return useQuery(
    CacheKeys.categories(),
    async () => {
      const response = await api.get('/categories');
      return response.data.data || response.data.categories || [];
    },
    { ttl: CACHE_TTL.LONG, ...options }
  );
}

export function useItems(params?: { type?: string; category?: string }, options?: UseQueryOptions<any[]>) {
  const queryParams = new URLSearchParams();
  if (params?.type) queryParams.append('item_type', params.type);
  if (params?.category) queryParams.append('category', params.category);

  return useQuery(
    CacheKeys.items(params),
    async () => {
      const response = await api.get(`/inventory/items?${queryParams.toString()}`);
      return response.data.data || [];
    },
    { ttl: CACHE_TTL.MEDIUM, ...options }
  );
}

export function useInventoryStock(options?: UseQueryOptions<any[]>) {
  return useQuery(
    CacheKeys.inventoryStock(),
    async () => {
      const response = await api.get('/inventory-stock/stock');
      return response.data.data || [];
    },
    { ttl: CACHE_TTL.SHORT, ...options }
  );
}

export function useInventoryStats(options?: UseQueryOptions<any>) {
  return useQuery(
    CacheKeys.inventoryStats(),
    async () => {
      const response = await api.get('/inventory-stock/stock/stats');
      return response.data.stats || {};
    },
    { ttl: CACHE_TTL.SHORT, ...options }
  );
}

export function useVendors(options?: UseQueryOptions<any[]>) {
  return useQuery(
    CacheKeys.vendors(),
    async () => {
      const response = await api.get('/inventory-stock/vendors');
      return response.data.data || [];
    },
    { ttl: CACHE_TTL.MEDIUM, ...options }
  );
}

export function usePurchaseOrders(options?: UseQueryOptions<any[]>) {
  return useQuery(
    CacheKeys.purchaseOrders(),
    async () => {
      const response = await api.get('/inventory-stock/purchase-orders');
      return response.data.data || [];
    },
    { ttl: CACHE_TTL.SHORT, ...options }
  );
}

export function useTransfers(options?: UseQueryOptions<any[]>) {
  return useQuery(
    CacheKeys.transfers(),
    async () => {
      const response = await api.get('/inventory-stock/transfers');
      return response.data.data || [];
    },
    { ttl: CACHE_TTL.SHORT, ...options }
  );
}

export function useProductionTemplates(options?: UseQueryOptions<any[]>) {
  return useQuery(
    CacheKeys.productionTemplates(),
    async () => {
      const response = await api.get('/inventory/production/templates');
      return response.data.templates || [];
    },
    { ttl: CACHE_TTL.MEDIUM, ...options }
  );
}

export function useProductionStats(options?: UseQueryOptions<any>) {
  return useQuery(
    CacheKeys.productionStats(),
    async () => {
      const response = await api.get('/inventory/production/stats');
      return {
        today: response.data.today_count || 0,
        week: response.data.week_count || 0,
      };
    },
    { ttl: CACHE_TTL.SHORT, ...options }
  );
}

export { CACHE_TTL, CacheKeys };

