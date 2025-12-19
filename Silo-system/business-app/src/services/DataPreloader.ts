import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetInfo } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from './CacheManager';

// Cache keys for backward compatibility
const CACHE_KEYS = {
  PRODUCTS: 'cache_products',
  CATEGORIES: 'cache_categories',
  BUSINESS_DETAILS: 'cache_business_details',
  BRANCHES: 'cache_branches',
  DASHBOARD_STATS: 'cache_dashboard_stats',
  LAST_PRELOAD: 'cache_last_preload',
  NAVIGATION_HISTORY: 'navigation_history',
  PRELOAD_PRIORITIES: 'preload_priorities',
};

// Cache expiry in milliseconds (5 minutes)
const CACHE_EXPIRY = 5 * 60 * 1000;

// Priority levels for prefetching
type Priority = 'critical' | 'high' | 'medium' | 'low';

interface PrefetchItem {
  key: string;
  fetcher: () => Promise<any>;
  priority: Priority;
  ttl: number;
}

// Navigation patterns for predictive prefetching
const SCREEN_PATTERNS: Record<string, string[]> = {
  'OwnerDashboard': ['Orders', 'Inventory', 'Products', 'Settings'],
  'StaffDashboard': ['Orders', 'Inventory', 'StaffManagement'],
  'PMDashboard': ['Orders', 'Inventory', 'StaffManagement', 'Settings'],
  'POSTerminal': ['Orders', 'Settings'],
  'Orders': ['POSTerminal', 'OwnerDashboard'],
  'Inventory': ['Items', 'Products', 'PODetail'],
  'Products': ['Items', 'Categories', 'Bundles'],
  'Items': ['Products', 'Inventory'],
};

// Data prefetch configuration per screen - using standardized cache keys
const SCREEN_DATA_NEEDS: Record<string, Array<{ key: string; endpoint: string; priority: Priority }>> = {
  'Orders': [
    { key: 'management_orders', endpoint: '/pos/orders?limit=50', priority: 'high' },
  ],
  'Inventory': [
    { key: 'inventory_stock', endpoint: '/inventory-stock/stock', priority: 'high' },
    { key: 'vendors', endpoint: '/inventory-stock/vendors', priority: 'medium' },
  ],
  'Products': [
    { key: 'management_store_products', endpoint: '/store-products?page=1&limit=20', priority: 'high' },
    { key: 'categories', endpoint: '/categories', priority: 'medium' },
  ],
  'Items': [
    { key: 'management_items_raw', endpoint: '/inventory/items?page=1&limit=30', priority: 'high' },
    { key: 'management_items_composite', endpoint: '/inventory/composite-items', priority: 'high' },
  ],
  'PODetail': [
    { key: 'purchase_orders', endpoint: '/inventory-stock/purchase-orders', priority: 'high' },
  ],
  'StaffManagement': [
    { key: 'management_staff_users', endpoint: '/business-users', priority: 'high' },
  ],
  'Categories': [
    { key: 'categories', endpoint: '/categories', priority: 'high' },
  ],
  'Bundles': [
    { key: 'management_bundles', endpoint: '/bundles', priority: 'high' },
    { key: 'management_store_products', endpoint: '/store-products?page=1&limit=20', priority: 'medium' },
  ],
  'DeliveryPartners': [
    { key: 'management_delivery_partners', endpoint: '/delivery/partners', priority: 'medium' },
  ],
  'Tables': [
    { key: 'management_tables', endpoint: '/tables', priority: 'medium' },
  ],
  'Drivers': [
    { key: 'management_drivers', endpoint: '/drivers', priority: 'medium' },
  ],
  'Discounts': [
    { key: 'management_discounts', endpoint: '/discounts', priority: 'medium' },
  ],
};

class DataPreloader {
  private isPreloading = false;
  private preloadPromise: Promise<void> | null = null;
  private prefetchQueue: PrefetchItem[] = [];
  private isPrefetching = false;
  private navigationHistory: string[] = [];
  private appStateSubscription: any = null;
  private networkState: 'wifi' | 'cellular' | 'none' = 'wifi';

  constructor() {
    // Initialize app state listener for background/foreground transitions
    this.setupAppStateListener();
    this.loadNavigationHistory();
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - check if we need to refresh
        this.checkAndRefreshStaleData();
      }
    });
  }

  private async loadNavigationHistory() {
    try {
      const history = await AsyncStorage.getItem(CACHE_KEYS.NAVIGATION_HISTORY);
      if (history) {
        this.navigationHistory = JSON.parse(history);
      }
    } catch (error) {
      console.warn('[Preloader] Failed to load navigation history:', error);
    }
  }

  private async saveNavigationHistory() {
    try {
      // Keep only last 50 navigations
      const recentHistory = this.navigationHistory.slice(-50);
      await AsyncStorage.setItem(CACHE_KEYS.NAVIGATION_HISTORY, JSON.stringify(recentHistory));
    } catch (error) {
      console.warn('[Preloader] Failed to save navigation history:', error);
    }
  }

  /**
   * Record a screen visit for predictive prefetching
   */
  recordScreenVisit(screenName: string) {
    this.navigationHistory.push(screenName);
    this.saveNavigationHistory();
    
    // Trigger predictive prefetch based on navigation patterns
    this.predictivePrefetch(screenName);
  }

  /**
   * Predictive prefetch based on navigation patterns
   */
  private async predictivePrefetch(currentScreen: string) {
    // Get likely next screens based on patterns
    const likelyNextScreens = SCREEN_PATTERNS[currentScreen] || [];
    
    // Also analyze user's personal navigation history
    const personalPatterns = this.analyzePersonalPatterns(currentScreen);
    const allLikelyScreens = [...new Set([...likelyNextScreens, ...personalPatterns])];

    // Queue prefetch for likely screens
    for (const screen of allLikelyScreens) {
      const dataNeeds = SCREEN_DATA_NEEDS[screen];
      if (dataNeeds) {
        for (const need of dataNeeds) {
          this.queuePrefetch({
            key: need.key,
            fetcher: () => api.get(need.endpoint).then(r => r.data),
            priority: need.priority,
            ttl: CACHE_TTL.MEDIUM,
          });
        }
      }
    }

    // Process queue
    this.processPrefetchQueue();
  }

  /**
   * Analyze personal navigation patterns
   */
  private analyzePersonalPatterns(currentScreen: string): string[] {
    const patterns: Record<string, number> = {};
    
    // Find screens that commonly follow the current screen
    for (let i = 0; i < this.navigationHistory.length - 1; i++) {
      if (this.navigationHistory[i] === currentScreen) {
        const nextScreen = this.navigationHistory[i + 1];
        patterns[nextScreen] = (patterns[nextScreen] || 0) + 1;
      }
    }

    // Sort by frequency and return top 3
    return Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([screen]) => screen);
  }

  /**
   * Queue a prefetch item
   */
  queuePrefetch(item: PrefetchItem) {
    // Don't add duplicates
    if (this.prefetchQueue.some(q => q.key === item.key)) {
      return;
    }

    this.prefetchQueue.push(item);
    
    // Sort by priority
    const priorityOrder: Record<Priority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    this.prefetchQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Process the prefetch queue
   */
  private async processPrefetchQueue() {
    if (this.isPrefetching || this.prefetchQueue.length === 0) {
      return;
    }

    // Check network state
    if (this.networkState === 'none') {
      console.log('[Preloader] No network, skipping prefetch');
      return;
    }

    // On cellular, only prefetch critical and high priority items
    const allowedPriorities: Priority[] = this.networkState === 'wifi' 
      ? ['critical', 'high', 'medium', 'low']
      : ['critical', 'high'];

    this.isPrefetching = true;

    try {
      while (this.prefetchQueue.length > 0) {
        const item = this.prefetchQueue[0];
        
        // Skip low priority on cellular
        if (!allowedPriorities.includes(item.priority)) {
          this.prefetchQueue.shift();
          continue;
        }

        try {
          // Check if already cached and fresh
          const cached = await cacheManager.get(item.key);
          if (cached !== null) {
            this.prefetchQueue.shift();
            continue;
          }

          // Fetch and cache
          const data = await item.fetcher();
          await cacheManager.set(item.key, data, item.ttl);
          console.log(`[Preloader] Prefetched: ${item.key}`);
        } catch (error) {
          console.warn(`[Preloader] Failed to prefetch ${item.key}:`, error);
        }

        this.prefetchQueue.shift();
        
        // Small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Prefetch specific screens data
   */
  async prefetch(screenNames: string[]): Promise<void> {
    for (const screen of screenNames) {
      const dataNeeds = SCREEN_DATA_NEEDS[screen];
      if (dataNeeds) {
        for (const need of dataNeeds) {
          this.queuePrefetch({
            key: need.key,
            fetcher: () => api.get(need.endpoint).then(r => r.data),
            priority: need.priority,
            ttl: CACHE_TTL.MEDIUM,
          });
        }
      }
    }
    
    await this.processPrefetchQueue();
  }

  /**
   * Check and refresh stale data when app comes to foreground
   */
  private async checkAndRefreshStaleData() {
    // Check if we have critical data that's stale
    const criticalKeys = ['products', 'categories', 'business_details'];
    
    for (const key of criticalKeys) {
      const cached = await cacheManager.get(key);
      // If cache miss, it will trigger a background refresh via stale-while-revalidate
    }
  }

  async preloadAll(): Promise<void> {
    // Prevent multiple simultaneous preloads
    if (this.isPreloading && this.preloadPromise) {
      return this.preloadPromise;
    }

    this.isPreloading = true;
    this.preloadPromise = this._doPreload();
    
    try {
      await this.preloadPromise;
    } finally {
      this.isPreloading = false;
      this.preloadPromise = null;
    }
  }

  private async _doPreload(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('[Preloader] No token, skipping preload');
        return;
      }

      // Check if we recently preloaded
      const lastPreload = await AsyncStorage.getItem(CACHE_KEYS.LAST_PRELOAD);
      if (lastPreload) {
        const elapsed = Date.now() - parseInt(lastPreload);
        if (elapsed < CACHE_EXPIRY) {
          console.log('[Preloader] Cache still fresh, skipping preload');
          return;
        }
      }

      console.log('[Preloader] Starting background preload...');

      // Preload all data in parallel with priority ordering
      // Critical data first
      await Promise.allSettled([
        this.preloadProducts(),
        this.preloadCategories(),
      ]);

      // Then high priority
      await Promise.allSettled([
        this.preloadBusinessDetails(),
        this.preloadBranches(),
      ]);

      // Finally lower priority
      await Promise.allSettled([
        this.preloadDashboardStats(),
      ]);

      // Mark preload time
      await AsyncStorage.setItem(CACHE_KEYS.LAST_PRELOAD, Date.now().toString());
      console.log('[Preloader] Background preload complete');
    } catch (error) {
      console.error('[Preloader] Error during preload:', error);
    }
  }

  private async preloadProducts(): Promise<void> {
    try {
      // Use store-products endpoint (same as POS screen)
      const response = await api.get('/store-products');
      if (response.data.success && response.data.data) {
        /**
         * Map products to POS component format
         * NOTE: This is UI DATA MAPPING only, not business logic
         * All prices (base_price, price_adjustment, extra_price) come from backend
         * Backend calculates costs and margins - see total_cost, margin_percent fields
         */
        const products = response.data.data.map((p: any) => ({
          id: String(p.id),
          name: p.name,
          name_ar: p.name_ar,
          base_price: p.price,
          category_id: p.category_id ? String(p.category_id) : undefined,
          category_name: p.category_name || p.category,
          available: p.is_active !== false,
          image_url: p.image_url,
          thumbnail_url: p.thumbnail_url,
          variant_groups: p.has_variants && p.variants ? [{
            id: 'size',
            name: 'Size',
            name_ar: 'الحجم',
            required: true,
            options: p.variants.map((v: any) => ({
              id: String(v.id),
              name: v.name,
              name_ar: v.name_ar,
              price_adjustment: v.price_adjustment || 0,
            }))
          }] : [],
          modifiers: [
            ...(p.ingredients || [])
              .filter((ing: any) => ing.removable)
              .map((ing: any) => ({
                id: `ing-${ing.id || ing.item_id}`,
                name: ing.item_name || ing.name,
                name_ar: ing.item_name_ar || ing.name_ar,
                removable: true,
                addable: false,
                extra_price: 0,
              })),
            ...(p.modifiers || []).map((mod: any) => ({
              id: `mod-${mod.id || mod.item_id}`,
              name: mod.name,
              name_ar: mod.name_ar,
              removable: false,
              addable: true,
              extra_price: mod.extra_price || 0,
            }))
          ]
        }));

        // Also fetch bundles
        try {
          const bundlesResponse = await api.get('/bundles');
          if (bundlesResponse.data.success && bundlesResponse.data.data) {
            const bundles = bundlesResponse.data.data
              .filter((b: any) => b.is_active)
              .map((b: any) => ({
                id: `bundle-${b.id}`,
                name: b.name,
                name_ar: b.name_ar,
                base_price: b.price,
                category_id: 'bundles',
                category_name: 'Bundles',
                available: true,
                image_url: b.image_url,
                thumbnail_url: b.thumbnail_url,
                variant_groups: [],
                modifiers: [],
                isBundle: true,
                bundleItems: b.items,
              }));
            products.push(...bundles);
          }
        } catch {}

        // Store in both old cache and new cache manager
        await AsyncStorage.setItem(
          CACHE_KEYS.PRODUCTS,
          JSON.stringify({
            data: products,
            timestamp: Date.now(),
          })
        );
        await cacheManager.set(CacheKeys.products(), products, CACHE_TTL.MEDIUM);
        console.log('[Preloader] Products cached:', products.length);
      }
    } catch (error) {
      console.log('[Preloader] Products preload skipped (endpoint may not exist)');
    }
  }

  private async preloadCategories(): Promise<void> {
    try {
      const response = await api.get('/categories');
      const data = response.data.success && response.data.data 
        ? response.data.data 
        : response.data.categories;
      
      if (data) {
        await AsyncStorage.setItem(
          CACHE_KEYS.CATEGORIES,
          JSON.stringify({
            data: data,
            timestamp: Date.now(),
          })
        );
        await cacheManager.set(CacheKeys.categories(), data, CACHE_TTL.LONG);
        console.log('[Preloader] Categories cached:', data.length);
      }
    } catch (error) {
      console.log('[Preloader] Categories preload skipped');
    }
  }

  private async preloadBusinessDetails(): Promise<void> {
    try {
      const businessStr = await AsyncStorage.getItem('business');
      if (!businessStr) return;

      const business = JSON.parse(businessStr);
      const response = await api.get(`/businesses/${business.id}`);
      
      if (response.data.business) {
        await AsyncStorage.setItem(
          CACHE_KEYS.BUSINESS_DETAILS,
          JSON.stringify({
            data: response.data.business,
            timestamp: Date.now(),
          })
        );
        await cacheManager.set(CacheKeys.business(business.id), response.data.business, CACHE_TTL.LONG);
        console.log('[Preloader] Business details cached');
      }
    } catch (error) {
      console.log('[Preloader] Business details preload skipped');
    }
  }

  private async preloadBranches(): Promise<void> {
    try {
      const businessStr = await AsyncStorage.getItem('business');
      if (!businessStr) return;

      const business = JSON.parse(businessStr);
      const response = await api.get(`/businesses/${business.id}/branches`);
      
      if (response.data.branches) {
        await AsyncStorage.setItem(
          CACHE_KEYS.BRANCHES,
          JSON.stringify({
            data: response.data.branches,
            timestamp: Date.now(),
          })
        );
        await cacheManager.set(CacheKeys.branches(business.id), response.data.branches, CACHE_TTL.LONG);
        console.log('[Preloader] Branches cached:', response.data.branches.length);
      }
    } catch (error) {
      console.log('[Preloader] Branches preload skipped');
    }
  }

  private async preloadDashboardStats(): Promise<void> {
    try {
      const response = await api.get('/analytics/dashboard', {
        params: { period: 'today' },
      });
      
      if (response.data.stats) {
        await AsyncStorage.setItem(
          CACHE_KEYS.DASHBOARD_STATS,
          JSON.stringify({
            data: response.data.stats,
            timestamp: Date.now(),
          })
        );
        await cacheManager.set(CacheKeys.dashboard('today'), response.data.stats, CACHE_TTL.SHORT);
        console.log('[Preloader] Dashboard stats cached');
      }
    } catch (error) {
      console.log('[Preloader] Dashboard stats preload skipped');
    }
  }

  // Get cached data with fallback to API
  async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T | null> {
    try {
      // First try the new cache manager
      const cachedFromManager = await cacheManager.getOrFetch(key, fetcher, {
        ttl: CACHE_TTL.MEDIUM,
        staleWhileRevalidate: true,
      });
      if (cachedFromManager !== null) {
        return cachedFromManager;
      }

      // Fall back to old AsyncStorage cache
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_EXPIRY;
        
        if (!isExpired) {
          return data as T;
        }
        
        // Return stale data but refresh in background
        fetcher().then(async (freshData) => {
          await AsyncStorage.setItem(
            key,
            JSON.stringify({ data: freshData, timestamp: Date.now() })
          );
        }).catch(() => {});
        
        return data as T;
      }
      
      // No cache, fetch fresh
      const freshData = await fetcher();
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ data: freshData, timestamp: Date.now() })
      );
      return freshData;
    } catch (error) {
      console.error('[Preloader] getCached error:', error);
      return null;
    }
  }

  // Clear all cache
  async clearCache(): Promise<void> {
    await Promise.all([
      ...Object.values(CACHE_KEYS).map((key) => AsyncStorage.removeItem(key)),
      cacheManager.clear(),
    ]);
    console.log('[Preloader] Cache cleared');
  }

  // Force refresh cache
  async refreshCache(): Promise<void> {
    await AsyncStorage.removeItem(CACHE_KEYS.LAST_PRELOAD);
    await this.preloadAll();
  }

  // Cleanup on app unmount
  cleanup() {
    // Use optional chaining for defensive null check
    // Handles cases where subscription setup failed or was never initialized
    this.appStateSubscription?.remove?.();
    this.appStateSubscription = null;
  }
}

export const dataPreloader = new DataPreloader();
export { CACHE_KEYS };
