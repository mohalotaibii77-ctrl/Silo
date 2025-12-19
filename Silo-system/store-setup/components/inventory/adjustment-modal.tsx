'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Package, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { addStock, deductStock, DeductionReason, InventoryStock } from '@/lib/inventory-api';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: InventoryStock | null;
  branchId?: number | null;
}

type AdjustmentType = 'add' | 'deduct';

const DEDUCTION_REASONS: { value: DeductionReason; label: string; labelAr: string; icon: string }[] = [
  { value: 'expired', label: 'Expired', labelAr: 'منتهي الصلاحية', icon: 'EXP' },
  { value: 'damaged', label: 'Damaged', labelAr: 'تالف', icon: 'DMG' },
  { value: 'spoiled', label: 'Spoiled', labelAr: 'فاسد', icon: 'SPL' },
  { value: 'others', label: 'Others', labelAr: 'أخرى', icon: 'OTH' },
];

export function AdjustmentModal({ isOpen, onClose, onSuccess, item, branchId }: AdjustmentModalProps) {
  const { t, isRTL } = useLanguage();
  const [type, setType] = useState<AdjustmentType>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<DeductionReason | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes or item changes
  useEffect(() => {
    if (isOpen) {
      setType('add');
      setQuantity('');
      setReason(null);
      setNotes('');
      setError('');
    }
  }, [isOpen, item]);

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

  const handleSubmit = async () => {
    if (!item) return;

    setError('');

    // Validate quantity
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError(t('Please enter a valid quantity greater than 0', 'الرجاء إدخال كمية صحيحة أكبر من 0'));
      return;
    }

    // Validate based on type
    if (type === 'add') {
      if (!notes.trim()) {
        setError(t('Justification notes are required for additions', 'ملاحظات التبرير مطلوبة للإضافات'));
        return;
      }
    } else {
      if (!reason) {
        setError(t('Please select a reason for deduction', 'الرجاء اختيار سبب الخصم'));
        return;
      }
      if (reason === 'others' && !notes.trim()) {
        setError(t('Notes are required when reason is "Others"', 'الملاحظات مطلوبة عندما يكون السبب "أخرى"'));
        return;
      }
      // Check if there's enough stock
      if (qty > item.quantity) {
        setError(t(
          `Insufficient stock. Available: ${item.quantity} ${item.item?.storage_unit || item.item?.unit}`,
          `المخزون غير كافٍ. المتاح: ${item.quantity} ${item.item?.storage_unit || item.item?.unit}`
        ));
        return;
      }
    }

    setLoading(true);

    try {
      if (type === 'add') {
        await addStock({
          item_id: item.item_id,
          branch_id: branchId,
          quantity: qty,
          notes: notes.trim(),
        });
      } else {
        await deductStock({
          item_id: item.item_id,
          branch_id: branchId,
          quantity: qty,
          reason: reason!,
          notes: reason === 'others' ? notes.trim() : (notes.trim() || null),
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('Failed to adjust stock', 'فشل في تعديل المخزون'));
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  const itemName = isRTL && item.item?.name_ar ? item.item.name_ar : item.item?.name;
  const storageUnit = item.item?.storage_unit || item.item?.unit || 'unit';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div 
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Package className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {t('Adjust Stock', 'تعديل المخزون')}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {itemName}
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

              {/* Current Stock Info */}
              <div className="px-5 pt-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t('Current Stock', 'المخزون الحالي')}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {item.quantity} {storageUnit}
                  </span>
                </div>
              </div>

              {/* Type Tabs */}
              <div className="px-5 pt-4">
                <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <button
                    onClick={() => { setType('add'); setReason(null); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      type === 'add'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    {t('Add Stock', 'إضافة مخزون')}
                  </button>
                  <button
                    onClick={() => { setType('deduct'); setError(''); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      type === 'deduct'
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                    {t('Deduct Stock', 'خصم مخزون')}
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Quantity Input */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Quantity', 'الكمية')} ({storageUnit})
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all text-lg font-medium"
                    autoFocus
                  />
                </div>

                {/* Deduction Reason (only for deduct) */}
                {type === 'deduct' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      {t('Reason', 'السبب')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {DEDUCTION_REASONS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setReason(r.value)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            reason === r.value
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-2 ring-red-500/30'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          <span className="text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded">{r.icon}</span>
                          {isRTL ? r.labelAr : r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    <FileText className="w-4 h-4 inline-block mr-1" />
                    {type === 'add' 
                      ? t('Justification Notes (Required)', 'ملاحظات التبرير (مطلوب)')
                      : reason === 'others'
                        ? t('Notes (Required)', 'ملاحظات (مطلوب)')
                        : t('Notes (Optional)', 'ملاحظات (اختياري)')
                    }
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      type === 'add'
                        ? t('e.g., Found extra stock during count, Supplier correction...', 'مثال: تم العثور على مخزون إضافي أثناء الجرد، تصحيح المورد...')
                        : t('e.g., Reason for deduction...', 'مثال: سبب الخصم...')
                    }
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-400 outline-none transition-all resize-none"
                  />
                </div>

                {/* Preview */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t('New Stock', 'المخزون الجديد')}
                  </span>
                  <span className={`font-semibold ${type === 'add' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {/* UI preview only - backend calculates actual value on save */}
                    {(() => {
                      const qty = parseFloat(quantity) || 0;
                      const newQty = type === 'add' ? item.quantity + qty : item.quantity - qty;
                      return `${Math.max(0, newQty).toFixed(2)} ${storageUnit}`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-colors disabled:opacity-50 ${
                    type === 'add'
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Processing...', 'جاري المعالجة...')}
                    </>
                  ) : (
                    <>
                      {type === 'add' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      {type === 'add' ? t('Add Stock', 'إضافة') : t('Deduct Stock', 'خصم')}
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

