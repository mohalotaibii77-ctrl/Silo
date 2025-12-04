'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Layers, Calculator, Info } from 'lucide-react';
import { Item, ItemUnit, CATEGORY_TRANSLATIONS, ItemCategory } from '@/types/items';
import { getCompositeItem } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';

interface ViewItemModalProps {
  isOpen: boolean;
  item: Item | null;
  compositeDetails?: CompositeItemDetails | null;
  onClose: () => void;
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

interface CompositeItemDetails extends Item {
  components?: {
    id: number;
    component_item_id: number;
    quantity: number;
    component_item?: {
      id: number;
      name: string;
      name_ar?: string;
      unit: ItemUnit;
      cost_per_unit: number;
      effective_price?: number;
      component_cost?: number;
    };
  }[];
}

export function ViewItemModal({ 
  isOpen, 
  item, 
  compositeDetails: preloadedDetails,
  onClose, 
  currency = 'USD' 
}: ViewItemModalProps) {
  const { isRTL, t } = useLanguage();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
  const [loading, setLoading] = useState(false);
  const [fetchedDetails, setFetchedDetails] = useState<CompositeItemDetails | null>(null);

  // Use pre-loaded details if available, otherwise use fetched details
  const compositeDetails = preloadedDetails || fetchedDetails;

  useEffect(() => {
    // Only fetch if no pre-loaded details and item is composite
    if (isOpen && item?.is_composite && !preloadedDetails) {
      fetchCompositeDetails();
    } else if (!isOpen) {
      setFetchedDetails(null);
    }
  }, [isOpen, item, preloadedDetails]);

  const fetchCompositeDetails = async () => {
    if (!item) return;
    setLoading(true);
    try {
      const details = await getCompositeItem(item.id);
      setFetchedDetails(details);
    } catch (err) {
      console.error('Failed to fetch composite item details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatUnitLabel = (unit: ItemUnit) => {
    return isRTL ? UNIT_TRANSLATIONS[unit]?.ar : UNIT_TRANSLATIONS[unit]?.en;
  };

  const formatCategoryLabel = (category: ItemCategory) => {
    if (CATEGORY_TRANSLATIONS[category]) {
      return isRTL ? CATEGORY_TRANSLATIONS[category].ar : CATEGORY_TRANSLATIONS[category].en;
    }
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const formatPrice = (price: number) => {
    return `${currencySymbol} ${price.toFixed(3)}`;
  };

  // Calculate total batch cost from components
  const calculateBatchCost = () => {
    if (!compositeDetails?.components) return 0;
    return compositeDetails.components.reduce((sum, comp) => {
      return sum + (comp.component_item?.component_cost || 0);
    }, 0);
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
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
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
                      {isRTL && item.name_ar ? item.name_ar : item.name}
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

              {/* Content */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Category', 'الفئة')}</p>
                    <p className="font-medium text-zinc-900 dark:text-white">{formatCategoryLabel(item.category)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Unit', 'الوحدة')}</p>
                    <p className="font-medium text-zinc-900 dark:text-white">{formatUnitLabel(item.unit)}</p>
                  </div>
                </div>

                {/* Price Info */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('Pricing', 'التسعير')}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {t('Cost per Unit', 'التكلفة لكل وحدة')}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {formatPrice((item as any).effective_price || item.cost_per_unit)} / {formatUnitLabel(item.unit)}
                      </span>
                    </div>
                    {(item as any).business_price && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {t('Custom Price', 'سعر مخصص')}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs">
                          {t('Yes', 'نعم')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Composite Item Details */}
                {item.is_composite && (
                  <>
                    {/* Batch Yield */}
                    {(item.batch_quantity && item.batch_unit) && (
                      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="w-4 h-4 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            {t('Batch Yield', 'كمية الدفعة')}
                          </span>
                        </div>
                        <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                          {item.batch_quantity} {formatUnitLabel(item.batch_unit as ItemUnit)}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {t('This recipe produces this amount per batch', 'هذه الوصفة تنتج هذه الكمية لكل دفعة')}
                        </p>
                      </div>
                    )}

                    {/* Components */}
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {t('Components', 'المكونات')}
                        </span>
                      </div>

                      {loading ? (
                        <div className="py-4 text-center text-zinc-500">
                          {t('Loading...', 'جاري التحميل...')}
                        </div>
                      ) : compositeDetails?.components && compositeDetails.components.length > 0 ? (
                        <div className="space-y-2">
                          {compositeDetails.components.map((comp) => (
                            <div 
                              key={comp.id} 
                              className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                            >
                              <div className="flex items-center gap-3">
                                <Package className="w-4 h-4 text-zinc-400" />
                                <div>
                                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {isRTL && comp.component_item?.name_ar 
                                      ? comp.component_item.name_ar 
                                      : comp.component_item?.name}
                                  </p>
                                  <p className="text-xs text-zinc-500">
                                    {comp.quantity} {comp.component_item?.unit}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                  {formatPrice(comp.component_item?.component_cost || 0)}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  @ {formatPrice(comp.component_item?.effective_price || 0)}/{comp.component_item?.unit}
                                </p>
                              </div>
                            </div>
                          ))}

                          {/* Total */}
                          <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-700">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                {t('Total Batch Cost', 'تكلفة الدفعة الإجمالية')}
                              </span>
                              <span className="font-bold text-zinc-900 dark:text-white">
                                {formatPrice(calculateBatchCost())}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500 text-center py-4">
                          {t('No components found', 'لم يتم العثور على مكونات')}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* SKU if available */}
                {item.sku && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">{t('SKU', 'رمز المنتج')}</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{item.sku}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end p-6 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  {t('Close', 'إغلاق')}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

