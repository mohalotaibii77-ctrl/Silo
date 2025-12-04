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
  cost_per_unit: number; // Default price (for composite: unit price = batch_price / batch_quantity)
  business_price?: number | null; // Business-specific price (if set)
  effective_price?: number; // The price to use (business_price or cost_per_unit)
  is_system_item: boolean;
  is_composite: boolean; // TRUE if this item is made from other items
  // Batch tracking for composite items
  batch_quantity?: number | null; // How much this recipe produces (e.g., 500)
  batch_unit?: ItemUnit | null; // Unit for batch quantity (e.g., 'grams')
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Component of a composite item
export interface CompositeItemComponent {
  id: number;
  composite_item_id: number;
  component_item_id: number;
  quantity: number;
  created_at: string;
  updated_at: string;
  component_item?: Item & { 
    effective_price?: number;
    component_cost?: number; // quantity * effective_price
  };
}

// Composite item with its components
export interface CompositeItem extends Item {
  components: CompositeItemComponent[];
  batch_price?: number; // Total cost to make one batch
  unit_price?: number; // Cost per unit (batch_price / batch_quantity)
}

export interface CreateItemData {
  name: string;
  name_ar?: string;
  category: ItemCategory;
  unit?: ItemUnit;
  cost_per_unit?: number;
}

export interface CreateCompositeItemData {
  name: string;
  name_ar?: string;
  category: ItemCategory;
  unit: ItemUnit;
  // Batch tracking: how much this recipe produces
  batch_quantity: number; // e.g., 500 (makes 500 grams)
  batch_unit: ItemUnit; // e.g., 'grams'
  components: { item_id: number; quantity: number }[];
}

export interface UpdateItemData extends Partial<CreateItemData> {
  status?: 'active' | 'inactive';
}

