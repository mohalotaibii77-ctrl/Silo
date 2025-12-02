// Item Categories (raw materials/ingredients)
export const ITEM_CATEGORIES = [
  'vegetable',
  'fruit', 
  'meat',
  'poultry',
  'seafood',
  'dairy',
  'grain',
  'bread',
  'sauce',
  'condiment',
  'spice',
  'oil',
  'beverage',
  'sweetener',
  'other'
] as const;

export type ItemCategory = typeof ITEM_CATEGORIES[number];

// Category translations (English -> Arabic)
export const CATEGORY_TRANSLATIONS: Record<ItemCategory, { en: string; ar: string }> = {
  vegetable: { en: 'Vegetable', ar: 'خضروات' },
  fruit: { en: 'Fruit', ar: 'فواكه' },
  meat: { en: 'Meat', ar: 'لحوم' },
  poultry: { en: 'Poultry', ar: 'دواجن' },
  seafood: { en: 'Seafood', ar: 'مأكولات بحرية' },
  dairy: { en: 'Dairy', ar: 'ألبان' },
  grain: { en: 'Grain', ar: 'حبوب' },
  bread: { en: 'Bread', ar: 'خبز' },
  sauce: { en: 'Sauce', ar: 'صلصات' },
  condiment: { en: 'Condiment', ar: 'توابل' },
  spice: { en: 'Spice', ar: 'بهارات' },
  oil: { en: 'Oil', ar: 'زيوت' },
  beverage: { en: 'Beverage', ar: 'مشروبات' },
  sweetener: { en: 'Sweetener', ar: 'محليات' },
  other: { en: 'Other', ar: 'أخرى' },
};

// Item Units (simplified)
export const ITEM_UNITS = ['grams', 'mL', 'piece'] as const;
export type ItemUnit = typeof ITEM_UNITS[number];

// Item (raw material/ingredient)
export interface Item {
  id: number;
  business_id: number | null;
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  category: ItemCategory;
  unit: ItemUnit;
  cost_per_unit: number; // Default price
  business_price?: number | null; // Business-specific price (if set)
  effective_price?: number; // The price to use (business_price or cost_per_unit)
  is_system_item: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateItemData {
  name: string;
  name_ar?: string;
  category: ItemCategory;
  unit?: ItemUnit;
  cost_per_unit?: number;
}

export interface UpdateItemData extends Partial<CreateItemData> {
  status?: 'active' | 'inactive';
}

