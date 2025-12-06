'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Loader2, Plus, Trash2, Layers, Calculator, Search, ChevronDown, Calendar, Clock } from 'lucide-react';
import { 
  CreateCompositeItemData, 
  Item, 
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
import { createCompositeItem, getItems } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';

interface AddCompositeItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  language?: string;
  currency?: string;
}

interface ComponentEntry {
  id: string;
  item_id: number | null;
  item?: Item;
  quantity: number;
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

export function AddCompositeItemModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  language,
  currency = 'USD' 
}: AddCompositeItemModalProps) {
  const { isRTL, t } = useLanguage();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    category: 'sauce' as ItemCategory,
    unit: 'grams' as ItemUnit, // Serving unit
    storage_unit: 'Kg' as StorageUnit,
    // Batch tracking: how much this recipe produces (storage)
    batch_quantity: '' as string | number,
    batch_unit: 'grams' as StorageUnit, // Storage unit for batch
    // Production rate
    production_rate_type: '' as '' | 'daily' | 'weekly' | 'monthly' | 'custom',
    production_rate_weekly_day: '' as string | number,
    production_rate_monthly_day: '' as string | number,
    production_rate_custom_dates: [] as string[],
  });
  
  const [components, setComponents] = useState<ComponentEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const generateId = () => Math.random().toString(36).substring(7);

  // Fetch available items for selection
  const fetchAvailableItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const items = await getItems();
      // Filter out composite items - can only use raw items as components
      const rawItems = items.filter(item => !item.is_composite && item.status === 'active');
      setAvailableItems(rawItems);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, []);

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

  useEffect(() => {
    if (isOpen) {
      fetchAvailableItems();
      // Reset form when opening
      setFormData({
        name: '',
        name_ar: '',
        category: 'sauce',
        unit: 'grams' as ItemUnit, // Serving unit
        storage_unit: 'Kg' as StorageUnit,
        batch_quantity: '',
        batch_unit: 'grams' as StorageUnit, // Batch/storage unit
        production_rate_type: '',
        production_rate_weekly_day: '',
        production_rate_monthly_day: '',
        production_rate_custom_dates: [],
      });
      setComponents([]);
      setError('');
      setActiveDropdown(null);
      setSearchQuery('');
    }
  }, [isOpen, fetchAvailableItems]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // When batch_unit (storage) changes, update serving unit to match if incompatible
      if (name === 'batch_unit') {
        const newBatchUnit = value as StorageUnit;
        // Get compatible serving units for the new batch unit
        const compatible = getCompatibleServingUnitsForStorage(newBatchUnit);
        if (!compatible.includes(prev.unit)) {
          updated.unit = compatible[0]; // Default to first compatible
        }
      }
      return updated;
    });
  };

  // Get compatible serving units based on storage/batch unit
  const getCompatibleServingUnitsForStorage = (storageUnit: StorageUnit): ItemUnit[] => {
    switch (storageUnit) {
      case 'Kg':
      case 'grams':
        return ['grams'];
      case 'L':
      case 'mL':
        return ['mL'];
      case 'piece':
        return ['piece'];
      default:
        return ['grams'];
    }
  };

  const compatibleServingUnits = getCompatibleServingUnitsForStorage(formData.batch_unit as StorageUnit);

  // Add new component entry
  const addComponent = () => {
    setComponents([...components, { id: generateId(), item_id: null, quantity: 0 }]);
  };

  // Remove component
  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  // Update component
  const updateComponent = (id: string, updates: Partial<ComponentEntry>) => {
    setComponents(components.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  // Select item for component
  const selectItemForComponent = (componentId: string, item: Item) => {
    updateComponent(componentId, { item_id: item.id, item });
    setActiveDropdown(null);
    setSearchQuery('');
  };

  // Filter items for dropdown
  const filteredItems = availableItems.filter(item => {
    const query = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(query) || 
           (item.name_ar && item.name_ar.toLowerCase().includes(query));
  });

  // Calculate batch cost from all components (total cost to make one batch)
  const calculateBatchCost = () => {
    return components.reduce((sum, comp) => {
      if (comp.item && comp.quantity > 0) {
        const price = (comp.item as any).effective_price ?? comp.item.business_price ?? comp.item.cost_per_unit;
        return sum + (comp.quantity * price);
      }
      return sum;
    }, 0);
  };

  // Conversion factors to base unit (grams for weight, mL for volume, 1 for piece)
  const CONVERSION_TO_BASE: Record<StorageUnit, number> = {
    'Kg': 1000,    // 1 Kg = 1000 grams
    'grams': 1,
    'L': 1000,     // 1 L = 1000 mL
    'mL': 1,
    'piece': 1,
  };

  // Calculate unit price (cost per serving unit of the composite item)
  const calculateUnitPrice = () => {
    const batchCost = calculateBatchCost();
    const batchQty = typeof formData.batch_quantity === 'string' 
      ? parseFloat(formData.batch_quantity) 
      : formData.batch_quantity;
    
    if (!batchQty || batchQty <= 0) return 0;
    
    // Convert batch quantity to serving units
    // e.g., 10 Kg -> 10 * 1000 = 10,000 grams
    const conversionFactor = CONVERSION_TO_BASE[formData.batch_unit] || 1;
    const batchQtyInServingUnits = batchQty * conversionFactor;
    
    // Cost per serving unit = Batch Cost ÷ Batch Quantity (in serving units)
    return batchCost / batchQtyInServingUnits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate name
    if (!formData.name.trim()) {
      setError(t('Item name is required', 'اسم المادة مطلوب'));
      return;
    }

    // Validate batch quantity
    const batchQty = typeof formData.batch_quantity === 'string' 
      ? parseFloat(formData.batch_quantity) 
      : formData.batch_quantity;
    
    if (!batchQty || batchQty <= 0) {
      setError(t('Batch quantity is required and must be greater than 0', 'كمية الدفعة مطلوبة ويجب أن تكون أكبر من 0'));
      return;
    }

    // Validate production rate fields
    if (formData.production_rate_type === 'weekly') {
      if (formData.production_rate_weekly_day === '' || formData.production_rate_weekly_day === null || formData.production_rate_weekly_day === undefined) {
        setError(t('Please select a day of the week', 'يرجى اختيار يوم من الأسبوع'));
        return;
      }
    }
    if (formData.production_rate_type === 'monthly') {
      if (formData.production_rate_monthly_day === '' || formData.production_rate_monthly_day === null || formData.production_rate_monthly_day === undefined) {
        setError(t('Please select a day of the month', 'يرجى اختيار يوم من الشهر'));
        return;
      }
    }
    if (formData.production_rate_type === 'custom') {
      const validDates = formData.production_rate_custom_dates.filter(d => d.trim() !== '');
      if (validDates.length === 0) {
        setError(t('Please add at least one production date', 'يرجى إضافة تاريخ إنتاج واحد على الأقل'));
        return;
      }
      // Validate dates are in ISO format
      const invalidDates = validDates.filter(d => {
        const date = new Date(d);
        return isNaN(date.getTime());
      });
      if (invalidDates.length > 0) {
        setError(t('Please ensure all dates are valid', 'يرجى التأكد من أن جميع التواريخ صحيحة'));
        return;
      }
    }

    // Filter valid components
    const validComponents = components.filter(c => c.item_id && c.item_id > 0 && c.quantity > 0);
    
    if (validComponents.length === 0) {
      setError(t('At least one component with quantity is required', 'مطلوب مكون واحد على الأقل مع الكمية'));
      return;
    }

    setLoading(true);
    try {
      const data: CreateCompositeItemData = {
        name: formData.name,
        name_ar: formData.name_ar || undefined,
        category: formData.category,
        unit: formData.unit, // Serving unit
        storage_unit: formData.batch_unit, // Storage unit = batch unit
        batch_quantity: batchQty,
        batch_unit: formData.batch_unit as ItemUnit, // Cast for API compatibility
        components: validComponents.map(c => ({
          item_id: c.item_id!,
          quantity: c.quantity,
        })),
        production_rate_type: formData.production_rate_type || undefined,
        production_rate_weekly_day: formData.production_rate_type === 'weekly' && formData.production_rate_weekly_day !== '' 
          ? (typeof formData.production_rate_weekly_day === 'string' ? parseInt(formData.production_rate_weekly_day) : formData.production_rate_weekly_day)
          : undefined,
        production_rate_monthly_day: formData.production_rate_type === 'monthly' && formData.production_rate_monthly_day !== ''
          ? (typeof formData.production_rate_monthly_day === 'string' ? parseInt(formData.production_rate_monthly_day) : formData.production_rate_monthly_day)
          : undefined,
        production_rate_custom_dates: formData.production_rate_type === 'custom' && formData.production_rate_custom_dates.length > 0
          ? formData.production_rate_custom_dates.filter(d => d.trim() !== '').map(d => {
              // Ensure dates are in ISO format (YYYY-MM-DD)
              const date = new Date(d);
              return date.toISOString().split('T')[0];
            })
          : undefined,
      };

      await createCompositeItem(data);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to create composite item', 'فشل في إنشاء المادة المركبة'));
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

  const formatStorageUnitLabel = (unit: StorageUnit) => {
    return isRTL ? STORAGE_UNIT_TRANSLATIONS[unit].ar : STORAGE_UNIT_TRANSLATIONS[unit].en;
  };

  // Item Dropdown Component
  const ItemDropdown = ({ 
    componentId,
    selectedItem,
    onSelect 
  }: { 
    componentId: string;
    selectedItem?: Item;
    onSelect: (item: Item) => void;
  }) => {
    const isOpen = activeDropdown === componentId;

    return (
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => {
            setActiveDropdown(isOpen ? null : componentId);
            setSearchQuery('');
          }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
        >
          <span className={selectedItem ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}>
            {selectedItem 
              ? (isRTL ? selectedItem.name_ar || selectedItem.name : selectedItem.name)
              : t('Select item', 'اختر عنصر')}
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl"
            >
              <div className="sticky top-0 p-2 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <div className="relative">
                  <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('Search items...', 'البحث في العناصر...')}
                    className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    autoFocus
                  />
                </div>
              </div>

              <div className="py-1">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-zinc-500 text-center">
                    {t('No items found', 'لم يتم العثور على عناصر')}
                  </div>
                ) : (
                  filteredItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <Package className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-zinc-900 dark:text-white">
                          {isRTL ? item.name_ar || item.name : item.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {((item as any).effective_price || item.cost_per_unit || 0).toFixed(3)} / {item.unit}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
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
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {t('Create Composite Item', 'إنشاء مادة مركبة')}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t('Create an item made from other items', 'إنشاء مادة مكونة من مواد أخرى')}
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
              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)] overscroll-contain">
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
                    placeholder={t('e.g., Special Sauce, House Dressing', 'مثال: صلصة خاصة، تتبيلة المنزل')}
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
                    placeholder={t('e.g., صلصة خاصة', 'مثال: صلصة خاصة')}
                    dir="rtl"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                  />
                </div>

                {/* Category Row */}
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

                {/* Batch Yield Section */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {t('Batch Yield (How much does this recipe make?) *', 'كمية الدفعة (كم تنتج هذه الوصفة؟) *')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                    {t('Example: If this recipe makes 500 grams of sauce, enter 500 and select grams.', 
                       'مثال: إذا كانت هذه الوصفة تنتج 500 جرام من الصلصة، أدخل 500 واختر جرام.')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {t('Quantity', 'الكمية')}
                      </label>
                      <input
                        type="number"
                        name="batch_quantity"
                        value={formData.batch_quantity}
                        onChange={handleChange}
                        placeholder={t('e.g., 500', 'مثال: 500')}
                        step="0.001"
                        min="0.001"
                        dir="ltr"
                        className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {t('Storage Unit', 'وحدة التخزين')}
                      </label>
                      <select
                        name="batch_unit"
                        value={formData.batch_unit}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                      >
                        {STORAGE_UNITS.map(unit => (
                          <option key={unit} value={unit}>{formatStorageUnitLabel(unit)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Serving Unit Section */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {t('Serving Unit (How is this item used in products?) *', 'وحدة التقديم (كيف يُستخدم هذا العنصر في المنتجات؟) *')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                    {t('This determines the unit cost calculation. Must match the batch yield unit category.', 
                       'هذا يحدد حساب تكلفة الوحدة. يجب أن يتطابق مع فئة وحدة الدفعة.')}
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {t('Serving Unit', 'وحدة التقديم')}
                    </label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                    >
                      {compatibleServingUnits.map(unit => (
                        <option key={unit} value={unit}>{formatUnitLabel(unit)}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {t(`Unit cost will be calculated as: Batch Cost ÷ Batch Quantity (per ${formData.unit})`, 
                         `سيتم حساب تكلفة الوحدة كـ: تكلفة الدفعة ÷ كمية الدفعة (لكل ${formData.unit})`)}
                    </p>
                  </div>
                </div>

                {/* Production Rate Section */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {t('Production Rate', 'معدل الإنتاج')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                    {t('Set when this composite item should be produced', 'حدد متى يجب إنتاج هذه المادة المركبة')}
                  </p>

                  {/* Production Rate Type */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {t('Frequency', 'التكرار')}
                    </label>
                    <select
                      name="production_rate_type"
                      value={formData.production_rate_type}
                      onChange={(e) => {
                        const value = e.target.value as '' | 'daily' | 'weekly' | 'monthly' | 'custom';
                        setFormData(prev => ({
                          ...prev,
                          production_rate_type: value,
                          // Reset dependent fields when changing type
                          production_rate_weekly_day: value === 'weekly' ? prev.production_rate_weekly_day : '',
                          production_rate_monthly_day: value === 'monthly' ? prev.production_rate_monthly_day : '',
                          production_rate_custom_dates: value === 'custom' ? prev.production_rate_custom_dates : [],
                        }));
                      }}
                      className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                    >
                      <option value="">{t('None', 'لا شيء')}</option>
                      <option value="daily">{t('Daily', 'يومي')}</option>
                      <option value="weekly">{t('Weekly', 'أسبوعي')}</option>
                      <option value="monthly">{t('Monthly', 'شهري')}</option>
                      <option value="custom">{t('Custom', 'مخصص')}</option>
                    </select>
                  </div>

                  {/* Weekly Day Selection */}
                  {formData.production_rate_type === 'weekly' && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {t('Day of Week', 'يوم الأسبوع')} *
                      </label>
                      <select
                        name="production_rate_weekly_day"
                        value={formData.production_rate_weekly_day}
                        onChange={(e) => setFormData(prev => ({ ...prev, production_rate_weekly_day: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                      >
                        <option value="">{t('Select day', 'اختر اليوم')}</option>
                        <option value="0">{t('Sunday', 'الأحد')}</option>
                        <option value="1">{t('Monday', 'الإثنين')}</option>
                        <option value="2">{t('Tuesday', 'الثلاثاء')}</option>
                        <option value="3">{t('Wednesday', 'الأربعاء')}</option>
                        <option value="4">{t('Thursday', 'الخميس')}</option>
                        <option value="5">{t('Friday', 'الجمعة')}</option>
                        <option value="6">{t('Saturday', 'السبت')}</option>
                      </select>
                    </div>
                  )}

                  {/* Monthly Day Selection */}
                  {formData.production_rate_type === 'monthly' && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {t('Day of Month', 'يوم الشهر')} *
                      </label>
                      <select
                        name="production_rate_monthly_day"
                        value={formData.production_rate_monthly_day}
                        onChange={(e) => setFormData(prev => ({ ...prev, production_rate_monthly_day: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                      >
                        <option value="">{t('Select day', 'اختر اليوم')}</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {t('This will occur on this day every month', 'سيحدث هذا في هذا اليوم من كل شهر')}
                      </p>
                    </div>
                  )}

                  {/* Custom Dates Selection */}
                  {formData.production_rate_type === 'custom' && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {t('Production Dates', 'تواريخ الإنتاج')} *
                      </label>
                      <div className="space-y-2">
                        {formData.production_rate_custom_dates.map((date, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="date"
                              value={date}
                              onChange={(e) => {
                                const newDates = [...formData.production_rate_custom_dates];
                                newDates[index] = e.target.value;
                                setFormData(prev => ({ ...prev, production_rate_custom_dates: newDates }));
                              }}
                              className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newDates = formData.production_rate_custom_dates.filter((_, i) => i !== index);
                                setFormData(prev => ({ ...prev, production_rate_custom_dates: newDates }));
                              }}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              production_rate_custom_dates: [...prev.production_rate_custom_dates, '']
                            }));
                          }}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 transition-colors w-full justify-center"
                        >
                          <Plus className="w-4 h-4" />
                          {t('Add Date', 'إضافة تاريخ')}
                        </button>
                      </div>
                      {formData.production_rate_custom_dates.length === 0 && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {t('Add at least one production date', 'أضف تاريخ إنتاج واحد على الأقل')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Components Section */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-3 mb-4">
                    <Package className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {t('Components *', 'المكونات *')}
                    </span>
                  </div>

                  <div className="space-y-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700">
                    {components.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-4">
                        {t('No components added. At least one component is required.', 
                           'لم تتم إضافة مكونات. مطلوب مكون واحد على الأقل.')}
                      </p>
                    ) : (
                      components.map((comp) => (
                        <div key={comp.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                          <ItemDropdown
                            componentId={comp.id}
                            selectedItem={comp.item}
                            onSelect={(item) => selectItemForComponent(comp.id, item)}
                          />
                          <input
                            type="number"
                            value={comp.quantity || ''}
                            onChange={(e) => updateComponent(comp.id, { quantity: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            placeholder={t('Qty', 'الكمية')}
                            step="0.001"
                            min="0"
                            dir="ltr"
                            className="w-20 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
                          />
                          {comp.item && (
                            <span className="text-xs text-zinc-500 w-12">
                              {comp.item.unit}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeComponent(comp.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}

                    <button
                      type="button"
                      onClick={addComponent}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 transition-colors w-full justify-center"
                    >
                      <Plus className="w-4 h-4" />
                      {t('Add Component', 'إضافة مكون')}
                    </button>

                    {components.length > 0 && (
                      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                        {/* Batch Price */}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t('Batch Cost:', 'تكلفة الدفعة:')}
                          </span>
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {currencySymbol} {calculateBatchCost().toFixed(3)}
                          </span>
                        </div>
                        
                        {/* Cost per Serving Unit */}
                        {formData.batch_quantity && parseFloat(String(formData.batch_quantity)) > 0 && (
                          <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg">
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">
                              {t('Cost per Serving Unit:', 'تكلفة وحدة التقديم:')}
                            </span>
                            <span className="font-semibold text-zinc-900 dark:text-white">
                              {currencySymbol} {calculateUnitPrice().toFixed(6)} / {formatUnitLabel(formData.unit)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                    t('Create Composite Item', 'إنشاء المادة المركبة')
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
