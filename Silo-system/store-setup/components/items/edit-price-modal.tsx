'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Loader2, RotateCcw } from 'lucide-react';
import { Item } from '@/types/items';
import { setItemPrice, resetItemPrice } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';
import { useConfig } from '@/lib/config-context';

interface EditPriceModalProps {
  isOpen: boolean;
  item: Item | null;
  onClose: () => void;
  onSuccess: () => void;
  currency?: string;
}

export function EditPriceModal({ isOpen, item, onClose, onSuccess, currency }: EditPriceModalProps) {
  const { isRTL, t, currency: contextCurrency } = useLanguage();
  const { getCurrencySymbol } = useConfig();
  // Use passed currency or fall back to context currency (from business settings)
  const activeCurrency = currency || contextCurrency;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [price, setPrice] = useState('');

  // Get symbol from backend config (centralized source of truth)
  const currencySymbol = getCurrencySymbol(activeCurrency);

  // Format price - handles small values like 0.0003
  const formatCost = (cost: number) => {
    if (cost > 0 && cost < 0.001) {
      const significantDecimals = Math.max(4, -Math.floor(Math.log10(cost)) + 2);
      return cost.toFixed(Math.min(significantDecimals, 6));
    }
    return cost.toFixed(3);
  };

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
    if (item) {
      const currentPrice = item.business_price ?? item.cost_per_unit;
      setPrice(currentPrice.toString());
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!item) return;

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      setError(t('Please enter a valid price', 'يرجى إدخال سعر صالح'));
      return;
    }

    setLoading(true);
    try {
      await setItemPrice(item.id, priceValue);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to update price', 'فشل في تحديث السعر'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!item) return;
    
    if (item.business_price === null || item.business_price === undefined) {
      return;
    }

    setLoading(true);
    try {
      await resetItemPrice(item.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to reset price', 'فشل في إعادة تعيين السعر'));
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  const hasCustomPrice = item.business_price !== null && item.business_price !== undefined;
  const isGeneralItem = item.business_id === null;

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
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {t('Edit Price', 'تعديل السعر')}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {isRTL && item.name_ar ? item.name_ar : item.name}
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
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Info for general items */}
                {isGeneralItem && (
                  <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 text-sm">
                    {t(
                      'This is a general item. Setting a price here will create a custom price for your business only.',
                      'هذه مادة عامة. سيؤدي تعيين السعر هنا إلى إنشاء سعر مخصص لعملك فقط.'
                    )}
                  </div>
                )}

                {/* Current default price info */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t('Default price:', 'السعر الافتراضي:')}
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-white" dir="ltr">
                    {currencySymbol} {formatCost(item.cost_per_unit)} / {item.unit}
                  </span>
                </div>

                {/* Price Input */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t(`Your Price (per ${item.unit})`, `سعرك (لكل ${item.unit})`)}
                  </label>
                  <div className="relative">
                    <span className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-zinc-400`}>{currencySymbol}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setPrice(val);
                        }
                      }}
                      placeholder="0.000"
                      dir="ltr"
                      className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all text-lg font-medium`}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Reset to default button */}
                {hasCustomPrice && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t(`Reset to default price (${currencySymbol} ${formatCost(item.cost_per_unit)})`, `إعادة تعيين السعر الافتراضي (${currencySymbol} ${formatCost(item.cost_per_unit)})`)}
                  </button>
                )}
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
                      {t('Saving...', 'جاري الحفظ...')}
                    </>
                  ) : (
                    t('Save Price', 'حفظ السعر')
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
