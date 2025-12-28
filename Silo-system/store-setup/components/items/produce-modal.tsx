'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, AlertCircle, CheckCircle, Loader2, Layers } from 'lucide-react';
import { checkProductionAvailability, createProduction, InventoryAvailability } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';
import { CompositeItem } from '@/types/items';

interface ProduceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  compositeItem: CompositeItem | null;
  currency?: string;
}

export function ProduceModal({ isOpen, onClose, onSuccess, compositeItem, currency }: ProduceModalProps) {
  const { isRTL, t } = useLanguage();
  
  const [batchCount, setBatchCount] = useState(1);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState<InventoryAvailability[] | null>(null);
  const [canProduce, setCanProduce] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen && compositeItem) {
      setBatchCount(1);
      setError('');
      setAvailability(null);
      setCanProduce(null);
      // Check availability immediately
      checkAvailabilityFn(1);
    }
  }, [isOpen, compositeItem]);

  // Re-check when batch count changes
  useEffect(() => {
    if (isOpen && compositeItem && batchCount > 0) {
      const timeout = setTimeout(() => {
        checkAvailabilityFn(batchCount);
      }, 300); // Debounce
      return () => clearTimeout(timeout);
    }
  }, [batchCount]);

  const checkAvailabilityFn = async (count: number) => {
    if (!compositeItem) return;
    
    setChecking(true);
    try {
      // Get current branch from localStorage
      const storedBranch = localStorage.getItem('setup_branch');
      const branch = storedBranch ? JSON.parse(storedBranch) : null;
      
      const result = await checkProductionAvailability(compositeItem.id, count, branch?.id);
      setAvailability(result.availability);
      setCanProduce(result.canProduce);
      setError('');
    } catch (err: any) {
      console.error('Failed to check availability:', err);
      setError(err.message || t('Failed to check inventory', 'فشل في التحقق من المخزون'));
      setCanProduce(false);
    } finally {
      setChecking(false);
    }
  };

  const handleProduce = async () => {
    if (!compositeItem || !canProduce) return;

    setSubmitting(true);
    setError('');

    try {
      // Get current branch from localStorage
      const storedBranch = localStorage.getItem('setup_branch');
      const branch = storedBranch ? JSON.parse(storedBranch) : null;
      
      await createProduction({
        composite_item_id: compositeItem.id,
        batch_count: batchCount,
        branch_id: branch?.id,  // Pass the current branch ID
        notes: `Produced: ${compositeItem.name}`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to produce:', err);
      setError(err.response?.data?.error || err.message || t('Failed to produce', 'فشل في الإنتاج'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !compositeItem) return null;

  const totalYield = (batchCount || 0) * (compositeItem.batch_quantity || 1);
  const yieldUnit = compositeItem.batch_unit || compositeItem.unit || 'unit';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl mx-4"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Layers className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {t('Produce', 'إنتاج')}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {isRTL && compositeItem.name_ar ? compositeItem.name_ar : compositeItem.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Batch Count */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('How many batches?', 'كم دفعة تريد إنتاجها؟')}
              </label>
              
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setBatchCount(Math.max(0.1, Math.round(((batchCount || 0.1) - 0.1) * 10) / 10))}
                  disabled={(batchCount || 0.1) <= 0.1}
                  className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                </button>
                
                <div className="w-24">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={batchCount || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setBatchCount(val === '' ? 0 : parseFloat(val) || 0);
                      }
                    }}
                    onBlur={() => {
                      // Enforce minimum on blur
                      if (!batchCount || batchCount < 0.1) {
                        setBatchCount(0.1);
                      }
                    }}
                    placeholder="0.0"
                    className="w-full h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-center text-xl font-bold focus:ring-2 focus:ring-zinc-500/20 outline-none"
                  />
                </div>
                
                <button
                  onClick={() => setBatchCount(Math.round(((batchCount || 0) + 0.1) * 10) / 10)}
                  className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Plus className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                </button>
              </div>
              
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                {t('Total yield:', 'الناتج الإجمالي:')} <span className="font-semibold text-zinc-900 dark:text-white">{totalYield.toFixed(1)} {yieldUnit}</span>
              </p>
            </div>

            {/* Availability Status */}
            {checking ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                <span className="text-sm text-zinc-500">{t('Checking inventory...', 'جاري التحقق...')}</span>
              </div>
            ) : availability && availability.length > 0 ? (
              <div className={`rounded-xl overflow-hidden ${
                canProduce 
                  ? 'bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700' 
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                <div className={`flex items-center gap-2 px-4 py-2.5 ${
                  canProduce 
                    ? 'bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700' 
                    : 'bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800'
                }`}>
                  {canProduce ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {t('Ready to produce', 'جاهز للإنتاج')}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        {t('Insufficient inventory', 'المخزون غير كافٍ')}
                      </span>
                    </>
                  )}
                </div>
                
                <div className="divide-y divide-zinc-200 dark:divide-zinc-700/50 max-h-40 overflow-y-auto">
                  {availability.map((item) => (
                    <div 
                      key={item.item_id} 
                      className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                        item.is_sufficient 
                          ? 'text-zinc-600 dark:text-zinc-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      <span className={`truncate ${!item.is_sufficient ? 'font-medium' : ''}`}>
                        {isRTL && item.item_name_ar ? item.item_name_ar : item.item_name}
                      </span>
                      <span className={`flex-shrink-0 tabular-nums ${isRTL ? 'mr-4' : 'ml-4'}`}>
                        {item.available_quantity.toFixed(1)} / {item.required_quantity.toFixed(1)} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('Cancel', 'إلغاء')}
            </button>
            <button
              onClick={handleProduce}
              disabled={!canProduce || submitting || checking || !batchCount || batchCount < 0.1}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('Producing...', 'جاري الإنتاج...')}
                </>
              ) : (
                t('Produce', 'إنتاج')
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

