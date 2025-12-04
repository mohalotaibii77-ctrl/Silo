'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Loader2, Plus, Trash2, Layers, Calculator, Search, ChevronDown, Save } from 'lucide-react';
import { 
  Item, 
  ItemCategory, 
  ItemUnit, 
  ITEM_CATEGORIES, 
  ITEM_UNITS, 
  CATEGORY_TRANSLATIONS,
  CompositeItem
} from '@/types/items';
import { updateItem, getItems, getCompositeItem, updateCompositeItemComponents, setItemPrice } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';

interface CompositeItemWithComponents extends Item {
  components?: {
    id: number;
    component_item_id: number;
    quantity: number;
    component_item?: Item;
  }[];
}

interface EditItemModalProps {
  isOpen: boolean;
  item: Item | null;
  compositeDetails?: CompositeItemWithComponents | null;
  onClose: () => void;
  onSuccess: () => void;
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

export function EditItemModal({ 
  isOpen, 
  item,
  compositeDetails: preloadedDetails,
  onClose, 
  onSuccess, 
  currency = 'USD' 
}: EditItemModalProps) {
  const { isRTL, t } = useLanguage();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    category: 'other' as ItemCategory,
    unit: 'grams' as ItemUnit,
    cost_per_unit: '' as string | number,
    batch_quantity: '' as string | number,
    batch_unit: 'grams' as ItemUnit,
  });
  
  const [components, setComponents] = useState<ComponentEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const generateId = () => Math.random().toString(36).substring(7);

  // Fetch available items for composite item components
  const fetchAvailableItems = useCallback(async () => {
    if (!item?.is_composite) return;
    setLoadingItems(true);
    try {
      const items = await getItems();
      const rawItems = items.filter(i => !i.is_composite && i.status === 'active' && i.id !== item.id);
      setAvailableItems(rawItems);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, [item]);

  // Load item data when modal opens
  useEffect(() => {
    if (isOpen && item) {
      setFormData({
        name: item.name,
        name_ar: item.name_ar || '',
        category: item.category,
        unit: item.unit,
        cost_per_unit: item.cost_per_unit || '',
        batch_quantity: item.batch_quantity || '',
        batch_unit: (item.batch_unit as ItemUnit) || 'grams',
      });
      setError('');
      setActiveDropdown(null);
      setSearchQuery('');

      if (item.is_composite) {
        fetchAvailableItems();
        // Use preloaded details if available, otherwise fetch
        if (preloadedDetails?.components) {
          setComponents(preloadedDetails.components.map(comp => ({
            id: generateId(),
            item_id: comp.component_item_id,
            item: comp.component_item as Item,
            quantity: comp.quantity,
          })));
        } else {
          loadCompositeComponents();
        }
      } else {
        setComponents([]);
      }
    }
  }, [isOpen, item, fetchAvailableItems, preloadedDetails]);

  const loadCompositeComponents = async () => {
    if (!item) return;
    try {
      const compositeItem = await getCompositeItem(item.id);
      if (compositeItem.components) {
        setComponents(compositeItem.components.map(comp => ({
          id: generateId(),
          item_id: comp.component_item_id,
          item: comp.component_item as Item,
          quantity: comp.quantity,
        })));
      }
    } catch (err) {
      console.error('Failed to load components:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'batch_unit') {
        updated.unit = value as ItemUnit;
      }
      return updated;
    });
  };

  // Component management for composite items
  const addComponent = () => {
    setComponents([...components, { id: generateId(), item_id: null, quantity: 0 }]);
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  const updateComponent = (id: string, updates: Partial<ComponentEntry>) => {
    setComponents(components.map(c => 
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const selectItemForComponent = (componentId: string, selectedItem: Item) => {
    updateComponent(componentId, { item_id: selectedItem.id, item: selectedItem });
    setActiveDropdown(null);
    setSearchQuery('');
  };

  const filteredItems = availableItems.filter(i => {
    const query = searchQuery.toLowerCase();
    const isAlreadySelected = components.some(c => c.item_id === i.id);
    return !isAlreadySelected && (
      i.name.toLowerCase().includes(query) || 
      (i.name_ar && i.name_ar.toLowerCase().includes(query))
    );
  });

  // Calculate batch cost from components
  const calculateBatchCost = () => {
    return components.reduce((sum, comp) => {
      if (comp.item && comp.quantity > 0) {
        const price = (comp.item as any).effective_price ?? comp.item.cost_per_unit;
        return sum + (comp.quantity * price);
      }
      return sum;
    }, 0);
  };

  const calculateUnitPrice = () => {
    const batchCost = calculateBatchCost();
    const batchQty = typeof formData.batch_quantity === 'string' 
      ? parseFloat(formData.batch_quantity) 
      : formData.batch_quantity;
    if (!batchQty || batchQty <= 0) return 0;
    return batchCost / batchQty;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setError('');

    if (!formData.name.trim()) {
      setError(t('Item name is required', 'اسم المادة مطلوب'));
      return;
    }

    setLoading(true);
    try {
      if (item.is_composite) {
        // Validate batch quantity
        const batchQty = typeof formData.batch_quantity === 'string' 
          ? parseFloat(formData.batch_quantity) 
          : formData.batch_quantity;
        
        if (!batchQty || batchQty <= 0) {
          setError(t('Batch quantity is required', 'كمية الدفعة مطلوبة'));
          setLoading(false);
          return;
        }

        // Validate components
        const validComponents = components.filter(c => c.item_id && c.quantity > 0);
        if (validComponents.length === 0) {
          setError(t('At least one component is required', 'مطلوب مكون واحد على الأقل'));
          setLoading(false);
          return;
        }

        // Update the item basic info
        await updateItem(item.id, {
          name: formData.name,
          name_ar: formData.name_ar || undefined,
          category: formData.category,
        });

        // Update components
        await updateCompositeItemComponents(item.id, validComponents.map(c => ({
          item_id: c.item_id!,
          quantity: c.quantity,
        })));

      } else {
        // Update raw item
        const costValue = typeof formData.cost_per_unit === 'string' 
          ? parseFloat(formData.cost_per_unit) 
          : formData.cost_per_unit;

        await updateItem(item.id, {
          name: formData.name,
          name_ar: formData.name_ar || undefined,
          category: formData.category,
          unit: formData.unit,
          cost_per_unit: costValue || undefined,
        });

        // If cost changed, also update the business price
        if (costValue && costValue > 0) {
          await setItemPrice(item.id, costValue);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to update item', 'فشل في تحديث المادة'));
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

  // Item Dropdown Component for composite items
  const ItemDropdown = ({ 
    componentId,
    selectedItem,
    onSelect 
  }: { 
    componentId: string;
    selectedItem?: Item;
    onSelect: (item: Item) => void;
  }) => {
    const isDropdownOpen = activeDropdown === componentId;

    return (
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => {
            setActiveDropdown(isDropdownOpen ? null : componentId);
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
          {isDropdownOpen && (
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
                  filteredItems.map(i => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onSelect(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <Package className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-zinc-900 dark:text-white">
                          {isRTL ? i.name_ar || i.name : i.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {((i as any).effective_price || i.cost_per_unit || 0).toFixed(3)} / {i.unit}
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

  if (!item) return null;

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
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.is_composite 
                      ? 'bg-zinc-200 dark:bg-zinc-700' 
                      : 'bg-zinc-100 dark:bg-zinc-800'
                  }`}>
                    {item.is_composite ? (
                      <Layers className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                    ) : (
                      <Package className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {t('Edit Item', 'تعديل المادة')}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {item.is_composite ? t('Composite Item', 'مادة مركبة') : t('Raw Item', 'مادة خام')}
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
              <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
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

                {/* Raw Item Fields */}
                {!item.is_composite && (
                  <>
                    {/* Unit */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('Unit *', 'الوحدة *')}
                      </label>
                      <select
                        name="unit"
                        value={formData.unit}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                      >
                        {ITEM_UNITS.map(unit => (
                          <option key={unit} value={unit}>{formatUnitLabel(unit)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cost per Unit */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('Cost per Unit', 'التكلفة لكل وحدة')} ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        name="cost_per_unit"
                        value={formData.cost_per_unit}
                        onChange={handleChange}
                        step="0.001"
                        min="0"
                        dir="ltr"
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                      />
                    </div>
                  </>
                )}

                {/* Composite Item Fields */}
                {item.is_composite && (
                  <>
                    {/* Batch Yield Section */}
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {t('Batch Yield *', 'كمية الدفعة *')}
                        </span>
                      </div>
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
                            step="0.001"
                            min="0.001"
                            dir="ltr"
                            className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                            {t('Unit', 'الوحدة')}
                          </label>
                          <select
                            name="batch_unit"
                            value={formData.batch_unit}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all"
                          >
                            {ITEM_UNITS.map(unit => (
                              <option key={unit} value={unit}>{formatUnitLabel(unit)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
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
                            {t('No components added.', 'لم تتم إضافة مكونات.')}
                          </p>
                        ) : (
                          components.map((comp) => (
                            <div key={comp.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                              <ItemDropdown
                                componentId={comp.id}
                                selectedItem={comp.item}
                                onSelect={(selectedItem) => selectItemForComponent(comp.id, selectedItem)}
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
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                {t('Batch Cost:', 'تكلفة الدفعة:')}
                              </span>
                              <span className="font-semibold text-zinc-900 dark:text-white">
                                {currencySymbol} {calculateBatchCost().toFixed(3)}
                              </span>
                            </div>
                            
                            {formData.batch_quantity && parseFloat(String(formData.batch_quantity)) > 0 && (
                              <div className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg">
                                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                  {t('Unit Price:', 'سعر الوحدة:')}
                                </span>
                                <span className="font-semibold text-zinc-900 dark:text-white">
                                  {currencySymbol} {calculateUnitPrice().toFixed(6)} / {formatUnitLabel(formData.batch_unit)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </form>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
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
                      {t('Saving...', 'جاري الحفظ...')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {t('Save Changes', 'حفظ التغييرات')}
                    </>
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

