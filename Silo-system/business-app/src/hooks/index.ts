/**
 * Custom Hooks for Business App
 * 
 * Provides data fetching hooks with caching, pagination, and background refresh.
 */

// Core query hook
export { 
  useQuery, 
  prefetchQuery, 
  invalidateQueries,
  CACHE_TTL,
  CacheKeys,
  // Pre-built query hooks
  useProducts,
  useCategories,
  useItems,
  useInventoryStock,
  useInventoryStats,
  useVendors,
  usePurchaseOrders,
  useTransfers,
  useProductionTemplates,
  useProductionStats,
} from './useQuery';

// Paginated list hook
export { 
  usePaginatedList,
  // Pre-built paginated hooks
  usePaginatedItems,
  usePaginatedProducts,
  usePaginatedOrders,
  usePaginatedStock,
  usePaginatedPurchaseOrders,
  usePaginatedVendors,
} from './usePaginatedList';


