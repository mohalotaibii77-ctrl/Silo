'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Loader2 } from 'lucide-react';
import { 
  CreateItemData, 
  ITEM_CATEGORIES, 
  ITEM_UNITS, 
  STORAGE_UNITS,
  ItemCategory, 
  ItemUnit, 
  StorageUnit,
  CATEGORY_TRANSLATIONS,
  getDefaultStorageUnit,
  getCompatibleStorageUnits,
  areUnitsCompatible
} from '@/types/items';
import { createItem } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  language?: string;
  currency?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', KWD: 'KD', EUR: '€', GBP: '£', AED: 'AED', SAR: 'SAR',
};

const UNIT_TRANSLATIONS: Record<ItemUnit, { en: string; ar: string }> = {
  grams: { en: 'Grams', ar: 'جرام' },
  mL: { en: 'Milliliters', ar: 'مل' },
  piece: { en: 'Piece', ar: 'قطعة' },
};

const STORAGE_UNIT_TRANSLATIONS: Record<StorageUnit, { en: string; ar: string }> = {
  Kg: { en: 'Kilogram', ar: 'كيلوجرام' },
  grams: { en: 'Grams', ar: 'جرام' },
  L: { en: 'Liter', ar: 'لتر' },
  mL: { en: 'Milliliters', ar: 'مل' },
  piece: { en: 'Piece', ar: 'قطعة' },
};

export function AddItemModal({ isOpen, onClose, onSuccess, currency = 'USD' }: AddItemModalProps) {
  const { isRTL, t } = useLanguage();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const [formData, setFormData] = useState<CreateItemData>({
    name: '',
    name_ar: '',
    category: 'vegetable',
    unit: 'grams',
    storage_unit: 'Kg',
    cost_per_unit: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value,
      };
      
      // When serving unit changes, auto-update storage unit to compatible default
      if (name === 'unit') {
        const newServingUnit = value as ItemUnit;
        const currentStorageUnit = prev.storage_unit as StorageUnit;
        
        // Check if current storage unit is still compatible
        if (!areUnitsCompatible(currentStorageUnit, newServingUnit)) {
          updated.storage_unit = getDefaultStorageUnit(newServingUnit);
        }
      }
      
      return updated;
    });
  };

  const formatStorageUnitLabel = (unit: StorageUnit) => {
    return isRTL ? STORAGE_UNIT_TRANSLATIONS[unit].ar : STORAGE_UNIT_TRANSLATIONS[unit].en;
  };

  // Get compatible storage units for current serving unit
  const compatibleStorageUnits = getCompatibleStorageUnits(formData.unit || 'grams');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError(t('Item name is required', 'اسم المادة مطلوب'));
      return;
    }

    setLoading(true);
    try {
      await createItem(formData);
      onSuccess();
      onClose();
      setFormData({
        name: '',
        name_ar: '',
        category: 'vegetable',
        unit: 'grams',
        storage_unit: 'Kg',
        cost_per_unit: 0,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to create item', 'فشل في إنشاء المادة'));
    } finally {
      setLoading(false);
    }
  };

  const formatCategoryLabel = (category: ItemCategory) => {
    if (CATEGORY_TRANSLATIONS[category]) {
      return isRTL ? CATEGORY_TRANSLATIONS[category].ar : CATEGORY_TRANSLATIONS[category].en;
    }
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const formatUnitLabel = (unit: ItemUnit) => {
    return isRTL ? UNIT_TRANSLATIONS[unit].ar : UNIT_TRANSLATIONS[unit].en;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Package className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {t('Add New Item', 'إضافة مادة جديدة')}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t('Create a new ingredient or raw material', 'إنشاء مكون جديد أو مادة خام')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)] overscroll-contain">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Name (English) */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Item Name (English) *', 'اسم المادة (إنجليزي) *')}
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t('e.g., Tomatoes, Olive Oil', 'مثال: Tomatoes, Olive Oil')}
                    dir="ltr"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                  />
                </div>

                {/* Name (Arabic) */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Item Name (Arabic)', 'اسم المادة (عربي)')}
                  </label>
                  <input
                    type="text"
                    name="name_ar"
                    value={formData.name_ar}
                    onChange={handleChange}
                    placeholder={t('e.g., طماطم، زيت زيتون', 'مثال: طماطم، زيت زيتون')}
                    dir="rtl"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Category *', 'الفئة *')}
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                  >
                    {ITEM_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{formatCategoryLabel(cat)}</option>
                    ))}
                  </select>
                </div>

                {/* Storage Unit and Serving Unit Row */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    {t('Unit Configuration', 'إعدادات الوحدات')}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                        {t('Storage Unit *', 'وحدة التخزين *')}
                      </label>
                      <select
                        name="storage_unit"
                        value={formData.storage_unit}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all text-sm"
                      >
                        {compatibleStorageUnits.map(unit => (
                          <option key={unit} value={unit}>{formatStorageUnitLabel(unit)}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {t('How this item is stored in inventory', 'كيف يتم تخزين هذه المادة في المخزون')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                        {t('Serving Unit *', 'وحدة التقديم *')}
                      </label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all text-sm"
                      >
                        {ITEM_UNITS.map(unit => (
                          <option key={unit} value={unit}>{formatUnitLabel(unit)}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {t('How this item is used in products', 'كيف يتم استخدام هذه المادة في المنتجات')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cost per Serving Unit */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Cost per Serving Unit', 'التكلفة لكل وحدة تقديم')}
                  </label>
                  <div className="relative">
                    <span className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-zinc-400`}>{currencySymbol}</span>
                    <input
                      type="number"
                      name="cost_per_unit"
                      value={formData.cost_per_unit}
                      onChange={handleChange}
                      step="0.001"
                      min="0"
                      dir="ltr"
                      className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all`}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1.5">
                    {t(`Cost per ${formatUnitLabel(formData.unit || 'grams')} (serving unit)`, `التكلفة لكل ${formatUnitLabel(formData.unit || 'grams')} (وحدة التقديم)`)}
                  </p>
                </div>
              </form>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Creating...', 'جاري الإنشاء...')}
                    </>
                  ) : (
                    t('Create Item', 'إنشاء المادة')
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
