/**
 * UNIT TESTS: Unit Conversion Utilities
 *
 * Run with: npm run test:unit
 */

import { describe, it, expect } from 'vitest';
import {
  getUnitCategory,
  areUnitsCompatible,
  validateUnitPairing,
  getCompatibleServingUnits,
  getCompatibleStorageUnits,
  convertUnits,
  storageToServing,
  servingToStorage,
  calculateServings,
  getDefaultStorageUnit,
  formatQuantityWithUnit,
} from '../../src/utils/unit-conversion';

describe('Unit Conversion Utilities', () => {
  // ============================================
  // getUnitCategory
  // ============================================
  describe('getUnitCategory', () => {
    it('should return "weight" for Kg', () => {
      expect(getUnitCategory('Kg')).toBe('weight');
    });

    it('should return "weight" for grams', () => {
      expect(getUnitCategory('grams')).toBe('weight');
    });

    it('should return "volume" for L', () => {
      expect(getUnitCategory('L')).toBe('volume');
    });

    it('should return "volume" for mL', () => {
      expect(getUnitCategory('mL')).toBe('volume');
    });

    it('should return "count" for piece', () => {
      expect(getUnitCategory('piece')).toBe('count');
    });
  });

  // ============================================
  // areUnitsCompatible
  // ============================================
  describe('areUnitsCompatible', () => {
    it('should return true for Kg and grams (both weight)', () => {
      expect(areUnitsCompatible('Kg', 'grams')).toBe(true);
    });

    it('should return true for L and mL (both volume)', () => {
      expect(areUnitsCompatible('L', 'mL')).toBe(true);
    });

    it('should return true for piece and piece (both count)', () => {
      expect(areUnitsCompatible('piece', 'piece')).toBe(true);
    });

    it('should return false for Kg and mL (weight vs volume)', () => {
      expect(areUnitsCompatible('Kg', 'mL')).toBe(false);
    });

    it('should return false for L and grams (volume vs weight)', () => {
      expect(areUnitsCompatible('L', 'grams')).toBe(false);
    });

    it('should return false for piece and grams (count vs weight)', () => {
      expect(areUnitsCompatible('piece', 'grams')).toBe(false);
    });
  });

  // ============================================
  // validateUnitPairing
  // ============================================
  describe('validateUnitPairing', () => {
    it('should return null for valid Kg/grams pairing', () => {
      expect(validateUnitPairing('Kg', 'grams')).toBeNull();
    });

    it('should return null for valid L/mL pairing', () => {
      expect(validateUnitPairing('L', 'mL')).toBeNull();
    });

    it('should return error message for Kg/mL pairing', () => {
      const result = validateUnitPairing('Kg', 'mL');
      expect(result).not.toBeNull();
      expect(result).toContain('Storage unit');
      expect(result).toContain('same category');
    });

    it('should return error message for piece/grams pairing', () => {
      const result = validateUnitPairing('piece', 'grams');
      expect(result).not.toBeNull();
    });
  });

  // ============================================
  // convertUnits
  // ============================================
  describe('convertUnits', () => {
    it('should convert 1 Kg to 1000 grams', () => {
      expect(convertUnits(1, 'Kg', 'grams')).toBe(1000);
    });

    it('should convert 5 Kg to 5000 grams', () => {
      expect(convertUnits(5, 'Kg', 'grams')).toBe(5000);
    });

    it('should convert 500 grams to 0.5 Kg', () => {
      expect(convertUnits(500, 'grams', 'Kg')).toBe(0.5);
    });

    it('should convert 1 L to 1000 mL', () => {
      expect(convertUnits(1, 'L', 'mL')).toBe(1000);
    });

    it('should convert 250 mL to 0.25 L', () => {
      expect(convertUnits(250, 'mL', 'L')).toBe(0.25);
    });

    it('should return same value when converting same unit', () => {
      expect(convertUnits(100, 'grams', 'grams')).toBe(100);
      expect(convertUnits(5, 'Kg', 'Kg')).toBe(5);
    });

    it('should throw error for incompatible units', () => {
      expect(() => convertUnits(1, 'Kg', 'mL')).toThrow('incompatible unit types');
    });

    it('should throw error for piece to grams conversion', () => {
      expect(() => convertUnits(1, 'piece', 'grams')).toThrow('incompatible unit types');
    });
  });

  // ============================================
  // storageToServing
  // ============================================
  describe('storageToServing', () => {
    it('should convert 5 Kg to 5000 grams', () => {
      expect(storageToServing(5, 'Kg', 'grams')).toBe(5000);
    });

    it('should convert 2 L to 2000 mL', () => {
      expect(storageToServing(2, 'L', 'mL')).toBe(2000);
    });

    it('should handle decimal values', () => {
      expect(storageToServing(0.5, 'Kg', 'grams')).toBe(500);
    });
  });

  // ============================================
  // servingToStorage
  // ============================================
  describe('servingToStorage', () => {
    it('should convert 500 grams to 0.5 Kg', () => {
      expect(servingToStorage(500, 'grams', 'Kg')).toBe(0.5);
    });

    it('should convert 1500 mL to 1.5 L', () => {
      expect(servingToStorage(1500, 'mL', 'L')).toBe(1.5);
    });
  });

  // ============================================
  // calculateServings
  // ============================================
  describe('calculateServings', () => {
    it('should calculate 25 servings from 5 Kg at 200 grams per serving', () => {
      expect(calculateServings(5, 'Kg', 200, 'grams')).toBe(25);
    });

    it('should calculate 10 servings from 2 L at 200 mL per serving', () => {
      expect(calculateServings(2, 'L', 200, 'mL')).toBe(10);
    });

    it('should floor partial servings', () => {
      // 5 Kg = 5000 grams, 300 grams per serving = 16.67 → 16 servings
      expect(calculateServings(5, 'Kg', 300, 'grams')).toBe(16);
    });

    it('should return 0 if serving size is larger than storage', () => {
      // 100 grams storage, 200 grams per serving = 0 servings
      expect(calculateServings(100, 'grams', 200, 'grams')).toBe(0);
    });
  });

  // ============================================
  // getCompatibleServingUnits
  // ============================================
  describe('getCompatibleServingUnits', () => {
    it('should return ["grams"] for Kg storage', () => {
      expect(getCompatibleServingUnits('Kg')).toEqual(['grams']);
    });

    it('should return ["mL"] for L storage', () => {
      expect(getCompatibleServingUnits('L')).toEqual(['mL']);
    });

    it('should return ["piece"] for piece storage', () => {
      expect(getCompatibleServingUnits('piece')).toEqual(['piece']);
    });
  });

  // ============================================
  // getCompatibleStorageUnits
  // ============================================
  describe('getCompatibleStorageUnits', () => {
    it('should return ["Kg", "grams"] for grams serving', () => {
      expect(getCompatibleStorageUnits('grams')).toEqual(['Kg', 'grams']);
    });

    it('should return ["L", "mL"] for mL serving', () => {
      expect(getCompatibleStorageUnits('mL')).toEqual(['L', 'mL']);
    });

    it('should return ["piece"] for piece serving', () => {
      expect(getCompatibleStorageUnits('piece')).toEqual(['piece']);
    });
  });

  // ============================================
  // getDefaultStorageUnit
  // ============================================
  describe('getDefaultStorageUnit', () => {
    it('should return "Kg" for grams', () => {
      expect(getDefaultStorageUnit('grams')).toBe('Kg');
    });

    it('should return "L" for mL', () => {
      expect(getDefaultStorageUnit('mL')).toBe('L');
    });

    it('should return "piece" for piece', () => {
      expect(getDefaultStorageUnit('piece')).toBe('piece');
    });
  });

  // ============================================
  // formatQuantityWithUnit
  // ============================================
  describe('formatQuantityWithUnit', () => {
    it('should format with 2 decimal places by default', () => {
      expect(formatQuantityWithUnit(5, 'Kg')).toBe('5.00 Kg');
    });

    it('should format with custom decimal places', () => {
      expect(formatQuantityWithUnit(5.5, 'Kg', 1)).toBe('5.5 Kg');
    });

    it('should handle zero', () => {
      expect(formatQuantityWithUnit(0, 'grams')).toBe('0.00 grams');
    });

    it('should format volume units', () => {
      expect(formatQuantityWithUnit(1.5, 'L')).toBe('1.50 L');
    });
  });
});
