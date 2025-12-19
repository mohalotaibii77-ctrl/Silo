/**
 * CONFIG CONTEXT
 * Provides system configuration data from the backend to all components.
 * Fetched once on app initialization, avoiding hardcoded configs.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types based on backend config API response
export interface ItemType {
  id: string;
  name: string;
  name_ar: string;
  sortOrder: number;
}

export interface ItemCategory {
  id: string;
  name: string;
  name_ar: string;
  sortOrder: number;
  item_type?: string;
}

export interface AccessoryOrderType {
  id: string;
  name: string;
  name_ar: string;
  description?: string;
}

export interface ServingUnit {
  id: string;
  name: string;
  name_ar: string;
  symbol: string;
  compatibleStorageUnits: string[];
  defaultStorageUnit: string;
}

export interface StorageUnit {
  id: string;
  name: string;
  name_ar: string;
  symbol: string;
  compatibleServingUnits: string[];
  conversionToBase: number;
  baseUnit: string;
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  name_ar: string;
  decimals: number;
}

export interface ProductionRateType {
  id: string;
  name: string;
  name_ar: string;
}

export interface DayOfWeek {
  id: number;
  name: string;
  name_ar: string;
}

export interface UserRole {
  id: string;
  name: string;
  name_ar: string;
  level: number;
}

export interface OrderStatus {
  id: string;
  name: string;
  name_ar: string;
  color: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  name_ar: string;
  icon: string;
}

export interface OrderType {
  id: string;
  name: string;
  name_ar: string;
  icon: string;
}

export interface DiscountType {
  id: string;
  name: string;
  name_ar: string;
  symbol: string;
}

export interface RestaurantType {
  id: string;
  name: string;
  name_ar: string;
}

export interface SystemConfig {
  itemTypes: ItemType[];
  itemCategories: ItemCategory[];
  accessoryOrderTypes: AccessoryOrderType[];
  servingUnits: ServingUnit[];
  storageUnits: StorageUnit[];
  currencies: Currency[];
  productionRateTypes: ProductionRateType[];
  daysOfWeek: DayOfWeek[];
  userRoles: UserRole[];
  orderStatuses: OrderStatus[];
  paymentMethods: PaymentMethod[];
  orderTypes: OrderType[];
  discountTypes: DiscountType[];
  restaurantTypes: RestaurantType[];
}

interface ConfigContextType {
  config: SystemConfig | null;
  loading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
  
  // Helper functions
  getItemType: (id: string) => ItemType | undefined;
  getItemTypeLabel: (id: string, lang: 'en' | 'ar') => string;
  getCategory: (id: string) => ItemCategory | undefined;
  getCategoryLabel: (id: string, lang: 'en' | 'ar') => string;
  getCategoriesByItemType: (itemType: string) => ItemCategory[];
  getServingUnit: (id: string) => ServingUnit | undefined;
  getStorageUnit: (id: string) => StorageUnit | undefined;
  getCompatibleStorageUnits: (servingUnitId: string) => StorageUnit[];
  getDefaultStorageUnit: (servingUnitId: string) => string;
  getCurrency: (code: string) => Currency | undefined;
  getCurrencySymbol: (code: string) => string;
  getOrderStatus: (id: string) => OrderStatus | undefined;
  getOrderStatusLabel: (id: string, lang: 'en' | 'ar') => string;
  getPaymentMethod: (id: string) => PaymentMethod | undefined;
  getOrderType: (id: string) => OrderType | undefined;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const CONFIG_CACHE_KEY = 'system_config_cache';
const CONFIG_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface CachedConfig {
  data: SystemConfig;
  timestamp: number;
}

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      const cachedStr = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
      if (cachedStr) {
        const cached: CachedConfig = JSON.parse(cachedStr);
        const isExpired = Date.now() - cached.timestamp > CONFIG_CACHE_EXPIRY;
        
        if (!isExpired) {
          setConfig(cached.data);
          setLoading(false);
          // Still refresh in background
          refreshFromServer(cached.data);
          return;
        }
      }

      // Fetch from server
      await refreshFromServer(null);
    } catch (err: any) {
      console.error('Failed to fetch config:', err);
      setError(err.message || 'Failed to load configuration');
      // Use fallback config
      setConfig(getFallbackConfig());
    } finally {
      setLoading(false);
    }
  };

  const refreshFromServer = async (currentConfig: SystemConfig | null) => {
    try {
      const response = await api.get('/config/system');
      if (response.data.success && response.data.data) {
        const newConfig = response.data.data;
        setConfig(newConfig);
        
        // Cache the config
        const cacheData: CachedConfig = {
          data: newConfig,
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(cacheData));
      }
    } catch (err) {
      console.warn('Failed to refresh config from server:', err);
      // Keep using current config if we have one
      if (!currentConfig) {
        setConfig(getFallbackConfig());
      }
    }
  };

  const refreshConfig = async () => {
    await refreshFromServer(config);
  };

  // Helper functions
  const getItemType = (id: string) => config?.itemTypes?.find(t => t.id === id);
  
  const getItemTypeLabel = (id: string, lang: 'en' | 'ar') => {
    const itemType = getItemType(id);
    return lang === 'ar' ? (itemType?.name_ar || id) : (itemType?.name || id);
  };
  
  const getCategory = (id: string) => config?.itemCategories.find(c => c.id === id);
  
  const getCategoryLabel = (id: string, lang: 'en' | 'ar') => {
    const category = getCategory(id);
    return lang === 'ar' ? (category?.name_ar || id) : (category?.name || id);
  };

  const getCategoriesByItemType = (itemType: string) => {
    if (!config) return [];
    return config.itemCategories.filter(c => c.item_type === itemType);
  };

  const getServingUnit = (id: string) => config?.servingUnits.find(u => u.id === id);
  
  const getStorageUnit = (id: string) => config?.storageUnits.find(u => u.id === id);

  const getCompatibleStorageUnits = (servingUnitId: string) => {
    const servingUnit = getServingUnit(servingUnitId);
    if (!servingUnit || !config) return [];
    return config.storageUnits.filter(su => 
      servingUnit.compatibleStorageUnits.includes(su.id)
    );
  };

  const getDefaultStorageUnit = (servingUnitId: string) => {
    const servingUnit = getServingUnit(servingUnitId);
    return servingUnit?.defaultStorageUnit || 'Kg';
  };

  const getCurrency = (code: string) => config?.currencies.find(c => c.code === code);

  const getCurrencySymbol = (code: string) => {
    const currency = getCurrency(code);
    return currency?.symbol || code;
  };

  const getOrderStatus = (id: string) => config?.orderStatuses.find(s => s.id === id);

  const getOrderStatusLabel = (id: string, lang: 'en' | 'ar') => {
    const status = getOrderStatus(id);
    return lang === 'ar' ? (status?.name_ar || id) : (status?.name || id);
  };

  const getPaymentMethod = (id: string) => config?.paymentMethods.find(p => p.id === id);

  const getOrderType = (id: string) => config?.orderTypes.find(t => t.id === id);

  useEffect(() => {
    fetchConfig();
  }, []);

  const value: ConfigContextType = {
    config,
    loading,
    error,
    refreshConfig,
    getItemType,
    getItemTypeLabel,
    getCategory,
    getCategoryLabel,
    getCategoriesByItemType,
    getServingUnit,
    getStorageUnit,
    getCompatibleStorageUnits,
    getDefaultStorageUnit,
    getCurrency,
    getCurrencySymbol,
    getOrderStatus,
    getOrderStatusLabel,
    getPaymentMethod,
    getOrderType,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

// Fallback config in case server is unreachable
// This ensures the app remains functional even offline
function getFallbackConfig(): SystemConfig {
  return {
    itemTypes: [
      { id: 'food', name: 'Food Ingredients', name_ar: 'مكونات غذائية', sortOrder: 1 },
      { id: 'non_food', name: 'Non-Food (Accessories)', name_ar: 'غير غذائي (ملحقات)', sortOrder: 2 },
    ],
    itemCategories: [
      // Food categories
      { id: 'vegetable', name: 'Vegetable', name_ar: 'خضروات', sortOrder: 1, item_type: 'food' },
      { id: 'fruit', name: 'Fruit', name_ar: 'فواكه', sortOrder: 2, item_type: 'food' },
      { id: 'meat', name: 'Meat', name_ar: 'لحوم', sortOrder: 3, item_type: 'food' },
      { id: 'poultry', name: 'Poultry', name_ar: 'دواجن', sortOrder: 4, item_type: 'food' },
      { id: 'seafood', name: 'Seafood', name_ar: 'مأكولات بحرية', sortOrder: 5, item_type: 'food' },
      { id: 'dairy', name: 'Dairy', name_ar: 'ألبان', sortOrder: 6, item_type: 'food' },
      { id: 'grain', name: 'Grain', name_ar: 'حبوب', sortOrder: 7, item_type: 'food' },
      { id: 'bread', name: 'Bread', name_ar: 'خبز', sortOrder: 8, item_type: 'food' },
      { id: 'sauce', name: 'Sauce', name_ar: 'صلصات', sortOrder: 9, item_type: 'food' },
      { id: 'condiment', name: 'Condiment', name_ar: 'توابل', sortOrder: 10, item_type: 'food' },
      { id: 'spice', name: 'Spice', name_ar: 'بهارات', sortOrder: 11, item_type: 'food' },
      { id: 'oil', name: 'Oil', name_ar: 'زيوت', sortOrder: 12, item_type: 'food' },
      { id: 'beverage', name: 'Beverage', name_ar: 'مشروبات', sortOrder: 13, item_type: 'food' },
      { id: 'sweetener', name: 'Sweetener', name_ar: 'محليات', sortOrder: 14, item_type: 'food' },
      // Non-food (accessories) - single category
      { id: 'non_food', name: 'Non-Food', name_ar: 'غير غذائي', sortOrder: 20, item_type: 'non_food' },
    ],
    accessoryOrderTypes: [
      { id: 'always', name: 'Always', name_ar: 'دائماً', description: 'Include for all order types' },
      { id: 'dine_in', name: 'Dine In Only', name_ar: 'داخل المطعم فقط', description: 'Include only for dine-in orders' },
      { id: 'takeaway', name: 'Takeaway Only', name_ar: 'سفري فقط', description: 'Include only for takeaway orders' },
      { id: 'delivery', name: 'Delivery Only', name_ar: 'توصيل فقط', description: 'Include only for delivery orders' },
    ],
    servingUnits: [
      { id: 'grams', name: 'Grams', name_ar: 'جرام', symbol: 'g', compatibleStorageUnits: ['Kg', 'grams'], defaultStorageUnit: 'Kg' },
      { id: 'mL', name: 'Milliliters', name_ar: 'مل', symbol: 'mL', compatibleStorageUnits: ['L', 'mL'], defaultStorageUnit: 'L' },
      { id: 'piece', name: 'Piece', name_ar: 'قطعة', symbol: 'pc', compatibleStorageUnits: ['piece'], defaultStorageUnit: 'piece' },
    ],
    storageUnits: [
      { id: 'Kg', name: 'Kilogram', name_ar: 'كيلوجرام', symbol: 'Kg', compatibleServingUnits: ['grams'], conversionToBase: 1000, baseUnit: 'grams' },
      { id: 'grams', name: 'Grams', name_ar: 'جرام', symbol: 'g', compatibleServingUnits: ['grams'], conversionToBase: 1, baseUnit: 'grams' },
      { id: 'L', name: 'Liter', name_ar: 'لتر', symbol: 'L', compatibleServingUnits: ['mL'], conversionToBase: 1000, baseUnit: 'mL' },
      { id: 'mL', name: 'Milliliters', name_ar: 'مل', symbol: 'mL', compatibleServingUnits: ['mL'], conversionToBase: 1, baseUnit: 'mL' },
      { id: 'piece', name: 'Piece', name_ar: 'قطعة', symbol: 'pc', compatibleServingUnits: ['piece'], conversionToBase: 1, baseUnit: 'piece' },
    ],
    currencies: [
      { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', name_ar: 'دينار كويتي', decimals: 3 },
      { code: 'USD', symbol: '$', name: 'US Dollar', name_ar: 'دولار أمريكي', decimals: 2 },
      { code: 'EUR', symbol: '€', name: 'Euro', name_ar: 'يورو', decimals: 2 },
      { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', name_ar: 'ريال سعودي', decimals: 2 },
      { code: 'AED', symbol: 'AED', name: 'UAE Dirham', name_ar: 'درهم إماراتي', decimals: 2 },
    ],
    productionRateTypes: [
      { id: 'daily', name: 'Daily', name_ar: 'يومي' },
      { id: 'weekly', name: 'Weekly', name_ar: 'أسبوعي' },
      { id: 'monthly', name: 'Monthly', name_ar: 'شهري' },
      { id: 'custom', name: 'Custom', name_ar: 'مخصص' },
    ],
    daysOfWeek: [
      { id: 0, name: 'Sunday', name_ar: 'الأحد' },
      { id: 1, name: 'Monday', name_ar: 'الإثنين' },
      { id: 2, name: 'Tuesday', name_ar: 'الثلاثاء' },
      { id: 3, name: 'Wednesday', name_ar: 'الأربعاء' },
      { id: 4, name: 'Thursday', name_ar: 'الخميس' },
      { id: 5, name: 'Friday', name_ar: 'الجمعة' },
      { id: 6, name: 'Saturday', name_ar: 'السبت' },
    ],
    userRoles: [
      { id: 'owner', name: 'Owner', name_ar: 'مالك', level: 100 },
      { id: 'manager', name: 'Manager', name_ar: 'مدير', level: 80 },
      { id: 'operations_manager', name: 'Operations Manager', name_ar: 'مدير العمليات', level: 70 },
      { id: 'employee', name: 'Employee', name_ar: 'موظف', level: 10 },
    ],
    orderStatuses: [
      { id: 'pending', name: 'Pending', name_ar: 'قيد الانتظار', color: '#f59e0b' },
      { id: 'confirmed', name: 'Confirmed', name_ar: 'مؤكد', color: '#3b82f6' },
      { id: 'preparing', name: 'Preparing', name_ar: 'قيد التحضير', color: '#8b5cf6' },
      { id: 'ready', name: 'Ready', name_ar: 'جاهز', color: '#10b981' },
      { id: 'completed', name: 'Completed', name_ar: 'مكتمل', color: '#22c55e' },
      { id: 'cancelled', name: 'Cancelled', name_ar: 'ملغي', color: '#ef4444' },
    ],
    paymentMethods: [
      { id: 'cash', name: 'Cash', name_ar: 'نقدي', icon: 'banknote' },
      { id: 'card', name: 'Card', name_ar: 'بطاقة', icon: 'credit-card' },
      { id: 'knet', name: 'K-Net', name_ar: 'كي نت', icon: 'credit-card' },
    ],
    orderTypes: [
      { id: 'dine_in', name: 'Dine In', name_ar: 'في المطعم', icon: 'utensils' },
      { id: 'takeaway', name: 'Takeaway', name_ar: 'سفري', icon: 'shopping-bag' },
      { id: 'delivery', name: 'Delivery', name_ar: 'توصيل', icon: 'truck' },
    ],
    discountTypes: [
      { id: 'percentage', name: 'Percentage', name_ar: 'نسبة مئوية', symbol: '%' },
      { id: 'fixed', name: 'Fixed Amount', name_ar: 'مبلغ ثابت', symbol: '' },
    ],
    restaurantTypes: [
      { id: 'quick_service', name: 'Quick Service', name_ar: 'خدمة سريعة' },
      { id: 'full_service', name: 'Full Service', name_ar: 'خدمة كاملة' },
      { id: 'cafe', name: 'Cafe', name_ar: 'مقهى' },
      { id: 'cloud_kitchen', name: 'Cloud Kitchen', name_ar: 'مطبخ سحابي' },
    ],
  };
}

export default ConfigContext;

