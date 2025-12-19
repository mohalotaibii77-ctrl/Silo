/**
 * ITEMS TYPES
 * 
 * TypeScript interfaces for items (raw materials/ingredients/packaging/supplies).
 * Configuration data (categories, units, translations) is now provided by the backend
 * via the /api/config endpoint and accessed through ConfigContext.
 */

// Item types: Food (ingredients for recipes) vs Non-Food (accessories for products)
export type ItemType = 'food' | 'non_food';

// Item categories
// - Food items have multiple categories for organization
// - Non-food items (accessories) use a single 'non_food' category
export type ItemCategory = 
  // Food categories
  | 'vegetable' | 'fruit' | 'meat' | 'poultry' | 'seafood' 
  | 'dairy' | 'grain' | 'bread' | 'sauce' | 'condiment' 
  | 'spice' | 'oil' | 'beverage' | 'sweetener'
  // Non-food (accessories) - single category
  | 'non_food';

// Accessory order types - when product accessories should be deducted
export type AccessoryOrderType = 'always' | 'dine_in' | 'takeaway' | 'delivery';

export type ItemUnit = 'grams' | 'mL' | 'piece';

export type StorageUnit = 'Kg' | 'grams' | 'L' | 'mL' | 'piece';

// Item (raw material/ingredient/packaging/supplies)
export interface Item {
  id: number;
  business_id: number | null;
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  item_type?: ItemType;              // Type: food or non_food (accessories)
  category: ItemCategory;
  unit: ItemUnit;                    // Serving unit (for products/recipes)
  storage_unit?: StorageUnit | null;  // Storage unit (for inventory)
  cost_per_unit: number; // Default price (for composite: unit price = batch_price / batch_quantity)
  business_price?: number | null; // Business-specific price (if set)
  effective_price?: number; // The price to use (business_price or cost_per_unit)
  is_system_item: boolean;
  is_composite: boolean; // TRUE if this item is made from other items
  // Batch tracking for composite items
  batch_quantity?: number | null; // How much this recipe produces (e.g., 500)
  batch_unit?: ItemUnit | null; // Unit for batch quantity (e.g., 'grams')
  // Calculated fields from backend (for composite items)
  batch_cost?: number; // Total cost to make one batch (sum of component costs)
  cost_per_serving_unit?: number; // Cost per serving unit (batch_cost / batch_quantity)
  // Production rate for composite items
  production_rate_type?: 'daily' | 'weekly' | 'monthly' | 'custom' | null;
  production_rate_weekly_day?: number | null; // 0=Sunday, 1=Monday, ..., 6=Saturday
  production_rate_monthly_day?: number | null; // 1-31
  production_rate_custom_dates?: string[] | null; // ISO date strings
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Product Accessory (non-food items linked to products)
export interface ProductAccessory {
  id: number;
  product_id: number;
  variant_id?: number | null;
  item_id: number;
  quantity: number;
  applicable_order_types: AccessoryOrderType[];
  is_required: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  item?: Item;
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
  batch_price?: number; // Total cost to make one batch (alias for batch_cost)
  unit_price?: number; // Cost per unit (alias for cost_per_serving_unit)
}

export interface CreateItemData {
  name: string;
  name_ar?: string;
  item_type?: ItemType;
  category: ItemCategory;
  unit?: ItemUnit;
  storage_unit?: StorageUnit;
  cost_per_unit?: number;
}

export interface CreateCompositeItemData {
  name: string;
  name_ar?: string;
  category: ItemCategory;
  unit: ItemUnit;
  storage_unit?: StorageUnit;
  // Batch tracking: how much this recipe produces
  batch_quantity: number; // e.g., 500 (makes 500 grams)
  batch_unit: ItemUnit; // e.g., 'grams'
  components: { item_id: number; quantity: number }[];
  // Production rate for composite items
  production_rate_type?: 'daily' | 'weekly' | 'monthly' | 'custom';
  production_rate_weekly_day?: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  production_rate_monthly_day?: number; // 1-31
  production_rate_custom_dates?: string[]; // ISO date strings
}

export interface UpdateItemData extends Partial<CreateItemData> {
  status?: 'active' | 'inactive';
  storage_unit?: StorageUnit;
}
