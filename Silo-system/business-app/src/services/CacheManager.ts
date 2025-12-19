import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache Manager Service
 * 
 * Provides a robust caching layer with:
 * - In-memory LRU cache for fast access
 * - AsyncStorage persistence for offline support
 * - Configurable TTL per data type
 * - Stale-while-revalidate pattern
 * - Cache invalidation hooks
 */

// Cache entry structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// LRU Node for doubly linked list
interface LRUNode<T> {
  key: string;
  value: CacheEntry<T>;
  prev: LRUNode<T> | null;
  next: LRUNode<T> | null;
}

// Default TTL values (in milliseconds)
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1 minute - for frequently changing data
  MEDIUM: 5 * 60 * 1000,     // 5 minutes - default
  LONG: 30 * 60 * 1000,      // 30 minutes - for stable data
  VERY_LONG: 60 * 60 * 1000, // 1 hour - for rarely changing data
  INFINITE: -1,              // Never expires (manual invalidation only)
};

// Cache configuration
interface CacheConfig {
  maxMemoryItems: number;
  persistToStorage: boolean;
  storagePrefix: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxMemoryItems: 100,
  persistToStorage: true,
  storagePrefix: 'silo_cache_',
};

class CacheManager {
  private config: CacheConfig;
  private memoryCache: Map<string, LRUNode<any>>;
  private head: LRUNode<any> | null = null;
  private tail: LRUNode<any> | null = null;
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private invalidationListeners: Map<string, Set<() => void>> = new Map();

  private isWarmingUp: boolean = false;
  private warmupPromise: Promise<void> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new Map();
  }

  /**
   * Warm up the memory cache from AsyncStorage
   * Called on app start to preload cached data into memory for instant access
   */
  async warmUp(): Promise<void> {
    if (this.isWarmingUp) {
      return this.warmupPromise || Promise.resolve();
    }
    
    this.isWarmingUp = true;
    this.warmupPromise = this._performWarmUp();
    
    try {
      await this.warmupPromise;
    } finally {
      this.isWarmingUp = false;
      this.warmupPromise = null;
    }
  }

  private async _performWarmUp(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(this.config.storagePrefix));
      
      if (cacheKeys.length === 0) return;
      
      // Load all cached items in parallel
      const pairs = await AsyncStorage.multiGet(cacheKeys);
      
      for (const [storageKey, value] of pairs) {
        if (!value) continue;
        
        try {
          const entry: CacheEntry<any> = JSON.parse(value);
          if (this.isValid(entry)) {
            const key = storageKey.replace(this.config.storagePrefix, '');
            this.setMemory(key, entry);
          }
        } catch {
          // Skip invalid entries
        }
      }
      
      console.log(`[CacheManager] Warmed up ${this.memoryCache.size} items from storage`);
    } catch (error) {
      console.warn('[CacheManager] Warm up failed:', error);
    }
  }

  /**
   * Get data from cache
   * Returns null if not found or expired
   */
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryNode = this.memoryCache.get(key);
    if (memoryNode) {
      const entry = memoryNode.value;
      if (this.isValid(entry)) {
        // Move to front (most recently used)
        this.moveToFront(memoryNode);
        return entry.data as T;
      } else {
        // Remove expired entry
        this.removeFromMemory(key);
      }
    }

    // Check persistent storage
    if (this.config.persistToStorage) {
      try {
        const stored = await AsyncStorage.getItem(this.getStorageKey(key));
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored);
          if (this.isValid(entry)) {
            // Restore to memory cache
            this.setMemory(key, entry);
            return entry.data;
          } else {
            // Remove expired entry from storage
            await AsyncStorage.removeItem(this.getStorageKey(key));
          }
        }
      } catch (error) {
        console.warn('[CacheManager] Error reading from storage:', error);
      }
    }

    return null;
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, ttl: number = CACHE_TTL.MEDIUM): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    // Set in memory cache
    this.setMemory(key, entry);

    // Persist to storage
    if (this.config.persistToStorage) {
      try {
        await AsyncStorage.setItem(this.getStorageKey(key), JSON.stringify(entry));
      } catch (error) {
        console.warn('[CacheManager] Error writing to storage:', error);
      }
    }
  }

  /**
   * Get or fetch data with automatic caching
   * Implements stale-while-revalidate pattern
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      ttl?: number;
      forceRefresh?: boolean;
      staleWhileRevalidate?: boolean;
    } = {}
  ): Promise<T> {
    const { 
      ttl = CACHE_TTL.MEDIUM, 
      forceRefresh = false,
      staleWhileRevalidate = true 
    } = options;

    // Check for pending request (deduplication)
    const pendingRequest = this.pendingRequests.get(key);
    if (pendingRequest && !forceRefresh) {
      return pendingRequest;
    }

    // Try to get from cache
    if (!forceRefresh) {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        // Check if stale but still within extended window
        const memoryNode = this.memoryCache.get(key);
        if (memoryNode && staleWhileRevalidate) {
          const entry = memoryNode.value;
          const age = Date.now() - entry.timestamp;
          const isStale = age > entry.ttl && entry.ttl !== CACHE_TTL.INFINITE;
          
          if (isStale) {
            // Return stale data immediately, refresh in background
            this.refreshInBackground(key, fetcher, ttl);
          }
        }
        return cached;
      }
    }

    // Fetch fresh data
    const fetchPromise = this.fetchAndCache(key, fetcher, ttl);
    this.pendingRequests.set(key, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  /**
   * Invalidate a specific cache key
   */
  async invalidate(key: string): Promise<void> {
    this.removeFromMemory(key);
    
    if (this.config.persistToStorage) {
      try {
        await AsyncStorage.removeItem(this.getStorageKey(key));
      } catch (error) {
        console.warn('[CacheManager] Error removing from storage:', error);
      }
    }

    // Notify listeners
    this.notifyInvalidation(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keysToInvalidate: string[] = [];

    // Find matching keys in memory
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        keysToInvalidate.push(key);
      }
    }

    // Invalidate each key
    await Promise.all(keysToInvalidate.map(key => this.invalidate(key)));

    // Also check storage for matching keys
    if (this.config.persistToStorage) {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const storageKeysToRemove = allKeys.filter(k => {
          if (k.startsWith(this.config.storagePrefix)) {
            const cacheKey = k.substring(this.config.storagePrefix.length);
            return regex.test(cacheKey);
          }
          return false;
        });
        
        if (storageKeysToRemove.length > 0) {
          await AsyncStorage.multiRemove(storageKeysToRemove);
        }
      } catch (error) {
        console.warn('[CacheManager] Error clearing pattern from storage:', error);
      }
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    this.head = null;
    this.tail = null;

    // Clear storage
    if (this.config.persistToStorage) {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(k => k.startsWith(this.config.storagePrefix));
        if (cacheKeys.length > 0) {
          await AsyncStorage.multiRemove(cacheKeys);
        }
      } catch (error) {
        console.warn('[CacheManager] Error clearing storage:', error);
      }
    }

    console.log('[CacheManager] Cache cleared');
  }

  /**
   * Subscribe to cache invalidation for a key
   */
  onInvalidate(key: string, callback: () => void): () => void {
    if (!this.invalidationListeners.has(key)) {
      this.invalidationListeners.set(key, new Set());
    }
    this.invalidationListeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.invalidationListeners.get(key);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.invalidationListeners.delete(key);
        }
      }
    };
  }

  /**
   * Get cache statistics
   */
  getStats(): { memorySize: number; maxSize: number } {
    return {
      memorySize: this.memoryCache.size,
      maxSize: this.config.maxMemoryItems,
    };
  }

  /**
   * Check if entry is still valid
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    if (entry.ttl === CACHE_TTL.INFINITE) {
      return true;
    }
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Set entry in memory cache with LRU eviction
   */
  private setMemory<T>(key: string, entry: CacheEntry<T>): void {
    // Check if key already exists
    if (this.memoryCache.has(key)) {
      const node = this.memoryCache.get(key)!;
      node.value = entry;
      this.moveToFront(node);
      return;
    }

    // Create new node
    const node: LRUNode<T> = {
      key,
      value: entry,
      prev: null,
      next: null,
    };

    // Add to front
    this.addToFront(node);
    this.memoryCache.set(key, node);

    // Evict if over capacity
    while (this.memoryCache.size > this.config.maxMemoryItems) {
      this.evictLRU();
    }
  }

  /**
   * Remove entry from memory cache
   */
  private removeFromMemory(key: string): void {
    const node = this.memoryCache.get(key);
    if (!node) return;

    // Remove from linked list
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    this.memoryCache.delete(key);
  }

  /**
   * Add node to front of LRU list
   */
  private addToFront<T>(node: LRUNode<T>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Move node to front of LRU list
   */
  private moveToFront<T>(node: LRUNode<T>): void {
    if (node === this.head) return;

    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
    if (node === this.tail) {
      this.tail = node.prev;
    }

    // Add to front
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    if (!this.tail) return;

    const key = this.tail.key;
    this.removeFromMemory(key);

    // Also remove from storage to keep in sync
    if (this.config.persistToStorage) {
      AsyncStorage.removeItem(this.getStorageKey(key)).catch(() => {});
    }
  }

  /**
   * Fetch data and cache it
   */
  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const data = await fetcher();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Refresh cache in background
   */
  private refreshInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): void {
    // Don't await - fire and forget
    this.fetchAndCache(key, fetcher, ttl).catch(error => {
      console.warn('[CacheManager] Background refresh failed:', error);
    });
  }

  /**
   * Get storage key with prefix
   */
  private getStorageKey(key: string): string {
    return `${this.config.storagePrefix}${key}`;
  }

  /**
   * Notify invalidation listeners
   */
  private notifyInvalidation(key: string): void {
    const listeners = this.invalidationListeners.get(key);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.warn('[CacheManager] Invalidation listener error:', error);
        }
      });
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Export class for custom instances
export { CacheManager };

// Cache key generators for consistent key naming
export const CacheKeys = {
  products: () => 'products',
  productById: (id: string | number) => `product_${id}`,
  categories: () => 'categories',
  items: (params?: { type?: string; category?: string }) => {
    const parts = ['items'];
    if (params?.type) parts.push(`type_${params.type}`);
    if (params?.category) parts.push(`cat_${params.category}`);
    return parts.join('_');
  },
  itemById: (id: string | number) => `item_${id}`,
  inventoryStock: () => 'inventory_stock',
  inventoryStats: () => 'inventory_stats',
  orders: (status?: string) => status ? `orders_${status}` : 'orders',
  orderById: (id: string | number) => `order_${id}`,
  vendors: () => 'vendors',
  purchaseOrders: () => 'purchase_orders',
  transfers: () => 'transfers',
  dashboard: (period: string) => `dashboard_${period}`,
  business: (id: string | number) => `business_${id}`,
  branches: (businessId: string | number) => `branches_${businessId}`,
  productionTemplates: () => 'production_templates',
  productions: () => 'productions',
  productionStats: () => 'production_stats',
  
  // Management screens - standardized cache keys
  deliveryPartners: () => 'management_delivery_partners',
  tables: () => 'management_tables',
  drivers: () => 'management_drivers',
  discounts: () => 'management_discounts',
  staffUsers: () => 'management_staff_users',
  bundles: () => 'management_bundles',
  storeProducts: () => 'management_store_products',
  managementOrders: (filter?: string) => filter ? `management_orders_${filter}` : 'management_orders',
  rawItems: (filter?: string) => filter ? `management_items_raw_${filter}` : 'management_items_raw',
  compositeItems: () => 'management_items_composite',
  productionData: () => 'management_production_data',
};

