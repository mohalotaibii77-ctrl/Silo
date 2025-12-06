/**
 * UNIT CONVERSION & VALIDATION UTILITIES
 * Handles storage unit ↔ serving unit conversions and validation
 */

export type StorageUnit = 'Kg' | 'grams' | 'L' | 'mL' | 'piece';
export type ServingUnit = 'grams' | 'mL' | 'piece';
export type UnitCategory = 'weight' | 'volume' | 'count';

// Map units to their category
const UNIT_CATEGORIES: Record<StorageUnit | ServingUnit, UnitCategory> = {
  'Kg': 'weight',
  'grams': 'weight',
  'L': 'volume',
  'mL': 'volume',
  'piece': 'count',
};

// Conversion factors to base units (grams for weight, mL for volume, piece for count)
const TO_BASE_UNIT: Record<StorageUnit | ServingUnit, number> = {
  'Kg': 1000,      // 1 Kg = 1000 grams
  'grams': 1,      // base unit for weight
  'L': 1000,       // 1 L = 1000 mL
  'mL': 1,         // base unit for volume
  'piece': 1,      // base unit for count
};

/**
 * Get the category of a unit (weight, volume, or count)
 */
export function getUnitCategory(unit: StorageUnit | ServingUnit): UnitCategory {
  return UNIT_CATEGORIES[unit];
}

/**
 * Check if two units are compatible (same category)
 */
export function areUnitsCompatible(
  storageUnit: StorageUnit,
  servingUnit: ServingUnit
): boolean {
  return UNIT_CATEGORIES[storageUnit] === UNIT_CATEGORIES[servingUnit];
}

/**
 * Validate that storage and serving units match
 * Returns an error message if invalid, null if valid
 */
export function validateUnitPairing(
  storageUnit: StorageUnit,
  servingUnit: ServingUnit
): string | null {
  const storageCategory = UNIT_CATEGORIES[storageUnit];
  const servingCategory = UNIT_CATEGORIES[servingUnit];

  if (storageCategory !== servingCategory) {
    const categoryLabels: Record<UnitCategory, string> = {
      weight: 'weight (Kg/grams)',
      volume: 'volume (L/mL)',
      count: 'count (piece)',
    };
    return `Storage unit (${storageUnit}) and serving unit (${servingUnit}) must be in the same category. Storage is ${categoryLabels[storageCategory]}, but serving is ${categoryLabels[servingCategory]}.`;
  }

  return null;
}

/**
 * Get compatible serving units for a storage unit
 */
export function getCompatibleServingUnits(storageUnit: StorageUnit): ServingUnit[] {
  const category = UNIT_CATEGORIES[storageUnit];
  
  switch (category) {
    case 'weight':
      return ['grams'];  // Serving is always in smaller unit
    case 'volume':
      return ['mL'];
    case 'count':
      return ['piece'];
    default:
      return ['grams'];
  }
}

/**
 * Get compatible storage units for a serving unit
 */
export function getCompatibleStorageUnits(servingUnit: ServingUnit): StorageUnit[] {
  const category = UNIT_CATEGORIES[servingUnit];
  
  switch (category) {
    case 'weight':
      return ['Kg', 'grams'];
    case 'volume':
      return ['L', 'mL'];
    case 'count':
      return ['piece'];
    default:
      return ['Kg', 'grams'];
  }
}

/**
 * Convert quantity from one unit to another
 * Returns the converted quantity, or throws if units are incompatible
 */
export function convertUnits(
  quantity: number,
  fromUnit: StorageUnit | ServingUnit,
  toUnit: StorageUnit | ServingUnit
): number {
  // Check compatibility
  if (UNIT_CATEGORIES[fromUnit] !== UNIT_CATEGORIES[toUnit]) {
    throw new Error(`Cannot convert between ${fromUnit} and ${toUnit} - incompatible unit types`);
  }

  // Same unit, no conversion needed
  if (fromUnit === toUnit) {
    return quantity;
  }

  // Convert to base unit first, then to target unit
  const baseQuantity = quantity * TO_BASE_UNIT[fromUnit];
  return baseQuantity / TO_BASE_UNIT[toUnit];
}

/**
 * Convert from storage unit to serving unit
 * Example: 5 Kg → 5000 grams
 */
export function storageToServing(
  quantity: number,
  storageUnit: StorageUnit,
  servingUnit: ServingUnit
): number {
  return convertUnits(quantity, storageUnit, servingUnit);
}

/**
 * Convert from serving unit to storage unit
 * Example: 500 grams → 0.5 Kg
 */
export function servingToStorage(
  quantity: number,
  servingUnit: ServingUnit,
  storageUnit: StorageUnit
): number {
  return convertUnits(quantity, servingUnit, storageUnit);
}

/**
 * Calculate how many servings can be made from a storage quantity
 * Example: 5 Kg stored, 200 grams per serving → 25 servings
 */
export function calculateServings(
  storageQuantity: number,
  storageUnit: StorageUnit,
  servingQuantity: number,
  servingUnit: ServingUnit
): number {
  const storageInServingUnits = storageToServing(storageQuantity, storageUnit, servingUnit);
  return Math.floor(storageInServingUnits / servingQuantity);
}

/**
 * Get the default storage unit for a serving unit
 */
export function getDefaultStorageUnit(servingUnit: ServingUnit): StorageUnit {
  switch (servingUnit) {
    case 'grams':
      return 'Kg';
    case 'mL':
      return 'L';
    case 'piece':
      return 'piece';
    default:
      return 'Kg';
  }
}

/**
 * Format a quantity with its unit for display
 */
export function formatQuantityWithUnit(
  quantity: number,
  unit: StorageUnit | ServingUnit,
  decimals: number = 2
): string {
  return `${quantity.toFixed(decimals)} ${unit}`;
}

