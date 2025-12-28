'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Loader2, ShoppingBag } from 'lucide-react';
import { CreateItemData, ItemCategory, ItemUnit, StorageUnit, ItemType } from '@/types/items';
import { createItem } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';
import { useConfig } from '@/lib/config-context';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  language?: string;
  currency?: string;
  itemType?: ItemType; // Optional: pre-set item type (food or non_food)
}

export function AddItemModal({ isOpen, onClose, onSuccess, currency, itemType }: AddItemModalProps) {
  const { isRTL, t, currency: contextCurrency } = useLanguage();
  const { config, getCategoryLabel, getCurrencySymbol, getServingUnit, getStorageUnit, getCompatibleStorageUnits, getDefaultStorageUnit } = useConfig();
  // Use passed currency or fall back to context currency (from business settings)
  const activeCurrency = currency || contextCurrency;
  const currencySymbol = getCurrencySymbol(activeCurrency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Determine if this is a non-food (accessory) item
  const isNonFood = itemType === 'non_food';

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
    item_type: itemType || 'food',
    category: isNonFood ? 'non_food' : 'vegetable',
    unit: isNonFood ? 'piece' : 'grams', // Non-food items typically use pieces
    storage_unit: isNonFood ? 'piece' : 'Kg',
    cost_per_unit: 0,
  });

  // Reset form when itemType changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        name_ar: '',
        item_type: itemType || 'food',
        category: isNonFood ? 'non_food' : 'vegetable',
        unit: isNonFood ? 'piece' : 'grams',
        storage_unit: isNonFood ? 'piece' : 'Kg',
        cost_per_unit: 0,
      });
    }
  }, [isOpen, itemType, isNonFood]);

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
        
        // Check if current storage unit is still compatible using config
        const compatibleUnits = getCompatibleStorageUnits(newServingUnit);
        const isCompatible = compatibleUnits.some(u => u.id === currentStorageUnit);
        if (!isCompatible) {
          updated.storage_unit = getDefaultStorageUnit(newServingUnit) as StorageUnit;
        }
      }
      
      return updated;
    });
  };

  const formatStorageUnitLabel = (unit: StorageUnit) => {
    const storageUnit = getStorageUnit(unit);
    return isRTL ? storageUnit?.name_ar || unit : storageUnit?.name || unit;
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
        item_type: itemType || 'food',
        category: isNonFood ? 'non_food' : 'vegetable',
        unit: isNonFood ? 'piece' : 'grams',
        storage_unit: isNonFood ? 'piece' : 'Kg',
        cost_per_unit: 0,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to create item', 'فشل في إنشاء المادة'));
    } finally {
      setLoading(false);
    }
  };

  const formatCategoryLabel = (category: string) => {
    return getCategoryLabel(category, isRTL ? 'ar' : 'en');
  };

  const formatUnitLabel = (unit: ItemUnit) => {
    const servingUnit = getServingUnit(unit);
    return isRTL ? servingUnit?.name_ar || unit : servingUnit?.name || unit;
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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isNonFood 
                      ? 'bg-amber-100 dark:bg-amber-900/30' 
                      : 'bg-zinc-100 dark:bg-zinc-800'
                  }`}>
                    {isNonFood ? (
                      <ShoppingBag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Package className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {isNonFood 
                        ? t('Add Non-Food Item', 'إضافة مادة غير غذائية')
                        : t('Add New Item', 'إضافة مادة جديدة')
                      }
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {isNonFood
                        ? t('Create a new accessory item (packaging, supplies, etc.)', 'إنشاء ملحق جديد (تعبئة، مستلزمات، إلخ)')
                        : t('Create a new ingredient or raw material', 'إنشاء مكون جديد أو مادة خام')
                      }
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

                {/* Category - Only show for food items */}
                {!isNonFood && (
                  <SearchableSelect
                    label={t('Category *', 'الفئة *')}
                    value={formData.category}
                    onChange={(val) => handleChange({ target: { name: 'category', value: val || 'vegetable' } } as any)}
                    options={(config?.itemCategories || [])
                      .filter(cat => cat.item_type === 'food')
                      .map(cat => ({
                        id: cat.id,
                        name: formatCategoryLabel(cat.id),
                      }))}
                    placeholder={t('Select category', 'اختر الفئة')}
                  />
                )}

                {/* Storage Unit and Serving Unit Row */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    {t('Unit Configuration', 'إعدادات الوحدات')}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <SearchableSelect
                        label={t('Storage Unit *', 'وحدة التخزين *')}
                        value={formData.storage_unit}
                        onChange={(val) => handleChange({ target: { name: 'storage_unit', value: val || 'kg' } } as any)}
                        options={compatibleStorageUnits.map(unit => ({
                          id: unit.id,
                          name: formatStorageUnitLabel(unit.id as StorageUnit),
                        }))}
                        placeholder={t('Select unit', 'اختر الوحدة')}
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {t('How this item is stored in inventory', 'كيف يتم تخزين هذه المادة في المخزون')}
                      </p>
                    </div>
                    <div>
                      <SearchableSelect
                        label={t('Serving Unit *', 'وحدة التقديم *')}
                        value={formData.unit}
                        onChange={(val) => handleChange({ target: { name: 'unit', value: val || 'g' } } as any)}
                        options={(config?.servingUnits || []).map(unit => ({
                          id: unit.id,
                          name: formatUnitLabel(unit.id as ItemUnit),
                        }))}
                        placeholder={t('Select unit', 'اختر الوحدة')}
                      />
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
                      type="text"
                      inputMode="decimal"
                      name="cost_per_unit"
                      value={formData.cost_per_unit || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          handleChange({ target: { name: 'cost_per_unit', value: val, type: 'number' } } as any);
                        }
                      }}
                      placeholder="0.000"
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
