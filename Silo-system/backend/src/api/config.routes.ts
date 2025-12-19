import { Router, Request, Response } from 'express';

const router = Router();

/**
 * System Configuration API
 * 
 * This module provides all system configuration data that frontends need.
 * Frontends should fetch this on initialization and use it for dropdowns,
 * validation hints, and display formatting.
 * 
 * The backend remains the source of truth - all validation happens server-side.
 */

// ==================== ITEM TYPES ====================
// Two types: Food (ingredients for recipes) and Non-Food (accessories for products)
const ITEM_TYPES = [
  { id: 'food', name: 'Food Ingredients', name_ar: 'مكونات غذائية', sortOrder: 1 },
  { id: 'non_food', name: 'Non-Food (Accessories)', name_ar: 'غير غذائي (ملحقات)', sortOrder: 2 },
];

// ==================== ITEM CATEGORIES ====================
// Food items have multiple categories, Non-food has just one
const ITEM_CATEGORIES = [
  // === Food Categories ===
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
  // === Non-Food (Accessories) - Single category ===
  { id: 'non_food', name: 'Non-Food', name_ar: 'غير غذائي', sortOrder: 20, item_type: 'non_food' },
];

// ==================== ACCESSORY ORDER TYPES ====================
// Defines when product accessories should be included/deducted
const ACCESSORY_ORDER_TYPES = [
  { id: 'always', name: 'Always', name_ar: 'دائماً', description: 'Include for all order types' },
  { id: 'dine_in', name: 'Dine In Only', name_ar: 'داخل المطعم فقط', description: 'Include only for dine-in orders' },
  { id: 'takeaway', name: 'Takeaway Only', name_ar: 'سفري فقط', description: 'Include only for takeaway orders' },
  { id: 'delivery', name: 'Delivery Only', name_ar: 'توصيل فقط', description: 'Include only for delivery orders' },
];

// ==================== UNITS ====================
// Serving units - how items are used in products/recipes
const SERVING_UNITS = [
  { 
    id: 'grams', 
    name: 'Grams', 
    name_ar: 'جرام', 
    symbol: 'g',
    compatibleStorageUnits: ['Kg', 'grams'],
    defaultStorageUnit: 'Kg',
  },
  { 
    id: 'mL', 
    name: 'Milliliters', 
    name_ar: 'مل', 
    symbol: 'mL',
    compatibleStorageUnits: ['L', 'mL'],
    defaultStorageUnit: 'L',
  },
  { 
    id: 'piece', 
    name: 'Piece', 
    name_ar: 'قطعة', 
    symbol: 'pc',
    compatibleStorageUnits: ['piece'],
    defaultStorageUnit: 'piece',
  },
];

// Storage units - how items are stored in inventory
const STORAGE_UNITS = [
  { 
    id: 'Kg', 
    name: 'Kilogram', 
    name_ar: 'كيلوجرام', 
    symbol: 'Kg',
    compatibleServingUnits: ['grams'],
    conversionToBase: 1000, // 1 Kg = 1000 grams
    baseUnit: 'grams',
  },
  { 
    id: 'grams', 
    name: 'Grams', 
    name_ar: 'جرام', 
    symbol: 'g',
    compatibleServingUnits: ['grams'],
    conversionToBase: 1,
    baseUnit: 'grams',
  },
  { 
    id: 'L', 
    name: 'Liter', 
    name_ar: 'لتر', 
    symbol: 'L',
    compatibleServingUnits: ['mL'],
    conversionToBase: 1000, // 1 L = 1000 mL
    baseUnit: 'mL',
  },
  { 
    id: 'mL', 
    name: 'Milliliters', 
    name_ar: 'مل', 
    symbol: 'mL',
    compatibleServingUnits: ['mL'],
    conversionToBase: 1,
    baseUnit: 'mL',
  },
  { 
    id: 'piece', 
    name: 'Piece', 
    name_ar: 'قطعة', 
    symbol: 'pc',
    compatibleServingUnits: ['piece'],
    conversionToBase: 1,
    baseUnit: 'piece',
  },
];

// ==================== CURRENCIES ====================
const CURRENCIES = [
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', name_ar: 'دينار كويتي', decimals: 3 },
  { code: 'USD', symbol: '$', name: 'US Dollar', name_ar: 'دولار أمريكي', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', name_ar: 'يورو', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', name_ar: 'جنيه إسترليني', decimals: 2 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', name_ar: 'درهم إماراتي', decimals: 2 },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', name_ar: 'ريال سعودي', decimals: 2 },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal', name_ar: 'ريال قطري', decimals: 2 },
  { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar', name_ar: 'دينار بحريني', decimals: 3 },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', name_ar: 'ريال عماني', decimals: 3 },
  { code: 'EGP', symbol: 'EGP', name: 'Egyptian Pound', name_ar: 'جنيه مصري', decimals: 2 },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', name_ar: 'دينار أردني', decimals: 3 },
  { code: 'LBP', symbol: 'LBP', name: 'Lebanese Pound', name_ar: 'ليرة لبنانية', decimals: 0 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', name_ar: 'روبية هندية', decimals: 2 },
  { code: 'PKR', symbol: 'PKR', name: 'Pakistani Rupee', name_ar: 'روبية باكستانية', decimals: 2 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', name_ar: 'يوان صيني', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', name_ar: 'ين ياباني', decimals: 0 },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', name_ar: 'وون كوري', decimals: 0 },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', name_ar: 'بات تايلندي', decimals: 2 },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', name_ar: 'رينغيت ماليزي', decimals: 2 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', name_ar: 'دولار سنغافوري', decimals: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', name_ar: 'دولار أسترالي', decimals: 2 },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', name_ar: 'دولار كندي', decimals: 2 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', name_ar: 'فرنك سويسري', decimals: 2 },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', name_ar: 'ليرة تركية', decimals: 2 },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', name_ar: 'روبل روسي', decimals: 2 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', name_ar: 'ريال برازيلي', decimals: 2 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', name_ar: 'بيزو مكسيكي', decimals: 2 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', name_ar: 'راند جنوب أفريقي', decimals: 2 },
];

// ==================== PRODUCTION RATE TYPES ====================
const PRODUCTION_RATE_TYPES = [
  { id: 'daily', name: 'Daily', name_ar: 'يومي' },
  { id: 'weekly', name: 'Weekly', name_ar: 'أسبوعي' },
  { id: 'monthly', name: 'Monthly', name_ar: 'شهري' },
  { id: 'custom', name: 'Custom', name_ar: 'مخصص' },
];

// ==================== DAYS OF WEEK ====================
const DAYS_OF_WEEK = [
  { id: 0, name: 'Sunday', name_ar: 'الأحد' },
  { id: 1, name: 'Monday', name_ar: 'الإثنين' },
  { id: 2, name: 'Tuesday', name_ar: 'الثلاثاء' },
  { id: 3, name: 'Wednesday', name_ar: 'الأربعاء' },
  { id: 4, name: 'Thursday', name_ar: 'الخميس' },
  { id: 5, name: 'Friday', name_ar: 'الجمعة' },
  { id: 6, name: 'Saturday', name_ar: 'السبت' },
];

// ==================== USER ROLES ====================
const USER_ROLES = [
  { id: 'owner', name: 'Owner', name_ar: 'مالك', level: 100 },
  { id: 'manager', name: 'Manager', name_ar: 'مدير', level: 80 },
  { id: 'operations_manager', name: 'Operations Manager', name_ar: 'مدير العمليات', level: 70 },
  { id: 'supervisor', name: 'Supervisor', name_ar: 'مشرف', level: 60 },
  { id: 'cashier', name: 'Cashier', name_ar: 'كاشير', level: 40 },
  { id: 'pos', name: 'POS Operator', name_ar: 'مشغل نقطة البيع', level: 30 },
  { id: 'kitchen_display', name: 'Kitchen Display', name_ar: 'شاشة المطبخ', level: 20 },
  { id: 'employee', name: 'Employee', name_ar: 'موظف', level: 10 },
];

// ==================== ORDER STATUSES ====================
const ORDER_STATUSES = [
  { id: 'pending', name: 'Pending', name_ar: 'قيد الانتظار', color: '#f59e0b' },
  { id: 'confirmed', name: 'Confirmed', name_ar: 'مؤكد', color: '#3b82f6' },
  { id: 'preparing', name: 'Preparing', name_ar: 'قيد التحضير', color: '#8b5cf6' },
  { id: 'ready', name: 'Ready', name_ar: 'جاهز', color: '#10b981' },
  { id: 'out_for_delivery', name: 'Out for Delivery', name_ar: 'في الطريق للتوصيل', color: '#06b6d4' },
  { id: 'delivered', name: 'Delivered', name_ar: 'تم التوصيل', color: '#22c55e' },
  { id: 'completed', name: 'Completed', name_ar: 'مكتمل', color: '#22c55e' },
  { id: 'cancelled', name: 'Cancelled', name_ar: 'ملغي', color: '#ef4444' },
  { id: 'refunded', name: 'Refunded', name_ar: 'مسترد', color: '#6b7280' },
];

// ==================== PAYMENT METHODS ====================
// Simplified to actual payment methods used
const PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash', name_ar: 'نقدي', icon: 'banknote' },
  { id: 'card', name: 'Card', name_ar: 'بطاقة', icon: 'credit-card' },
];

// ==================== PAYMENT STATUSES ====================
const PAYMENT_STATUSES = [
  { id: 'pending', name: 'Pending', name_ar: 'قيد الانتظار', color: '#f59e0b' },
  { id: 'paid', name: 'Paid', name_ar: 'مدفوع', color: '#22c55e' },
  { id: 'app_payment', name: 'App Payment', name_ar: 'دفع التطبيق', color: '#3b82f6' },
  { id: 'refunded', name: 'Refunded', name_ar: 'مسترد', color: '#6b7280' },
  { id: 'cancelled', name: 'Cancelled', name_ar: 'ملغي', color: '#ef4444' },
];

// ==================== ORDER TYPES ====================
const ORDER_TYPES = [
  { id: 'dine_in', name: 'Dine In', name_ar: 'في المطعم', icon: 'utensils' },
  { id: 'takeaway', name: 'Takeaway', name_ar: 'سفري', icon: 'shopping-bag' },
  { id: 'delivery', name: 'Delivery', name_ar: 'توصيل', icon: 'truck' },
];

// ==================== DISCOUNT TYPES ====================
const DISCOUNT_TYPES = [
  { id: 'percentage', name: 'Percentage', name_ar: 'نسبة مئوية', symbol: '%' },
  { id: 'fixed', name: 'Fixed Amount', name_ar: 'مبلغ ثابت', symbol: '' },
];

// ==================== RESTAURANT TYPES ====================
const RESTAURANT_TYPES = [
  { id: 'quick_service', name: 'Quick Service', name_ar: 'خدمة سريعة' },
  { id: 'full_service', name: 'Full Service', name_ar: 'خدمة كاملة' },
  { id: 'cafe', name: 'Cafe', name_ar: 'مقهى' },
  { id: 'bar', name: 'Bar', name_ar: 'بار' },
  { id: 'food_truck', name: 'Food Truck', name_ar: 'عربة طعام' },
  { id: 'cloud_kitchen', name: 'Cloud Kitchen', name_ar: 'مطبخ سحابي' },
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if a storage unit is compatible with a serving unit
 */
export function areUnitsCompatible(storageUnit: string, servingUnit: string): boolean {
  const storage = STORAGE_UNITS.find(u => u.id === storageUnit);
  return storage?.compatibleServingUnits.includes(servingUnit) ?? false;
}

/**
 * Get compatible storage units for a serving unit
 */
export function getCompatibleStorageUnits(servingUnit: string): string[] {
  const serving = SERVING_UNITS.find(u => u.id === servingUnit);
  return serving?.compatibleStorageUnits ?? [];
}

/**
 * Get default storage unit for a serving unit
 */
export function getDefaultStorageUnit(servingUnit: string): string {
  const serving = SERVING_UNITS.find(u => u.id === servingUnit);
  return serving?.defaultStorageUnit ?? 'Kg';
}

/**
 * Get conversion factor from storage unit to base unit
 */
export function getConversionToBase(storageUnit: string): number {
  const storage = STORAGE_UNITS.find(u => u.id === storageUnit);
  return storage?.conversionToBase ?? 1;
}

/**
 * Get currency info by code
 */
export function getCurrencyInfo(code: string) {
  return CURRENCIES.find(c => c.code === code);
}

/**
 * Get categories filtered by item type
 */
export function getCategoriesByItemType(itemType: string) {
  return ITEM_CATEGORIES.filter(c => c.item_type === itemType);
}

/**
 * Get item type info by id
 */
export function getItemTypeInfo(id: string) {
  return ITEM_TYPES.find(t => t.id === id);
}

// ==================== ROUTES ====================

/**
 * GET /api/config/system
 * Returns all system configuration data in one call
 * This is the main endpoint frontends should call on initialization
 */
router.get('/system', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      itemTypes: ITEM_TYPES,
      itemCategories: ITEM_CATEGORIES,
      accessoryOrderTypes: ACCESSORY_ORDER_TYPES,
      servingUnits: SERVING_UNITS,
      storageUnits: STORAGE_UNITS,
      currencies: CURRENCIES,
      productionRateTypes: PRODUCTION_RATE_TYPES,
      daysOfWeek: DAYS_OF_WEEK,
      userRoles: USER_ROLES,
      orderStatuses: ORDER_STATUSES,
      paymentMethods: PAYMENT_METHODS,
      orderTypes: ORDER_TYPES,
      discountTypes: DISCOUNT_TYPES,
      restaurantTypes: RESTAURANT_TYPES,
    }
  });
});

/**
 * GET /api/config/item-types
 * Returns item types (food, packaging, supplies, etc.)
 */
router.get('/item-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: ITEM_TYPES
  });
});

/**
 * GET /api/config/item-categories
 * Returns item categories with translations
 * Query params: item_type (optional) - filter by item type
 */
router.get('/item-categories', (req: Request, res: Response) => {
  const itemType = req.query.item_type as string;
  
  let categories = ITEM_CATEGORIES;
  if (itemType) {
    categories = ITEM_CATEGORIES.filter(c => c.item_type === itemType);
  }
  
  res.json({
    success: true,
    data: categories
  });
});

/**
 * GET /api/config/accessory-order-types
 * Returns accessory order types (always, dine_in, takeaway, delivery)
 */
router.get('/accessory-order-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: ACCESSORY_ORDER_TYPES
  });
});

/**
 * GET /api/config/units
 * Returns serving and storage units with compatibility rules
 */
router.get('/units', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      servingUnits: SERVING_UNITS,
      storageUnits: STORAGE_UNITS,
    }
  });
});

/**
 * GET /api/config/units/compatible
 * Returns compatible storage units for a given serving unit
 * Query params: serving_unit
 */
router.get('/units/compatible', (req: Request, res: Response) => {
  const servingUnit = req.query.serving_unit as string;
  
  if (!servingUnit) {
    return res.status(400).json({
      success: false,
      error: 'serving_unit query parameter is required'
    });
  }

  const serving = SERVING_UNITS.find(u => u.id === servingUnit);
  
  if (!serving) {
    return res.status(400).json({
      success: false,
      error: `Invalid serving unit: ${servingUnit}`
    });
  }

  const compatibleStorageUnits = STORAGE_UNITS.filter(
    su => serving.compatibleStorageUnits.includes(su.id)
  );

  res.json({
    success: true,
    data: {
      servingUnit: serving,
      compatibleStorageUnits,
      defaultStorageUnit: serving.defaultStorageUnit,
    }
  });
});

/**
 * GET /api/config/currencies
 * Returns currency list with symbols
 */
router.get('/currencies', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: CURRENCIES
  });
});

/**
 * GET /api/config/currencies/:code
 * Returns info for a specific currency
 */
router.get('/currencies/:code', (req: Request, res: Response) => {
  const currency = CURRENCIES.find(c => c.code === req.params.code.toUpperCase());
  
  if (!currency) {
    return res.status(404).json({
      success: false,
      error: `Currency not found: ${req.params.code}`
    });
  }

  res.json({
    success: true,
    data: currency
  });
});

/**
 * GET /api/config/roles
 * Returns user roles
 */
router.get('/roles', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: USER_ROLES
  });
});

/**
 * GET /api/config/order-statuses
 * Returns order status options
 */
router.get('/order-statuses', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: ORDER_STATUSES
  });
});

/**
 * GET /api/config/payment-methods
 * Returns payment method options
 */
router.get('/payment-methods', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: PAYMENT_METHODS
  });
});

/**
 * GET /api/config/order-types
 * Returns order type options
 */
router.get('/order-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: ORDER_TYPES
  });
});

/**
 * GET /api/config/discount-types
 * Returns discount type options
 */
router.get('/discount-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: DISCOUNT_TYPES
  });
});

/**
 * GET /api/config/production-rates
 * Returns production rate type options
 */
router.get('/production-rates', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      types: PRODUCTION_RATE_TYPES,
      daysOfWeek: DAYS_OF_WEEK,
    }
  });
});

/**
 * GET /api/config/restaurant-types
 * Returns restaurant type options
 */
router.get('/restaurant-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: RESTAURANT_TYPES
  });
});

export default router;

