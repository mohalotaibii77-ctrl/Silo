'use client';

import { useState, useEffect } from 'react';
import { X, Barcode, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Item } from '@/types/items';
import { getItemBarcode, deleteItemBarcode, ItemBarcode } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';

interface BarcodeModalProps {
  isOpen: boolean;
  item: Item | null;
  onClose: () => void;
}

export function BarcodeModal({ isOpen, item, onClose }: BarcodeModalProps) {
  const { isRTL, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [barcode, setBarcode] = useState<ItemBarcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && item) {
      fetchBarcode();
    } else {
      // Reset state when modal closes
      setBarcode(null);
      setError(null);
    }
  }, [isOpen, item]);

  const fetchBarcode = async () => {
    if (!item) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getItemBarcode(item.id);
      setBarcode(result);
    } catch (err: any) {
      console.error('Failed to fetch barcode:', err);
      setError(err.response?.data?.error || 'Failed to fetch barcode information');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !barcode) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteItemBarcode(item.id);
      setBarcode(null);
    } catch (err: any) {
      console.error('Failed to delete barcode:', err);
      setError(err.response?.data?.error || 'Failed to delete barcode');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !item) return null;

  const itemName = isRTL && item.name_ar ? item.name_ar : item.name;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Barcode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {t('Barcode', 'الباركود')}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {itemName}
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
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('Checking barcode...', 'جاري التحقق من الباركود...')}
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={fetchBarcode}
                  className="mt-3 text-sm text-red-600 dark:text-red-400 underline"
                >
                  {t('Try again', 'حاول مرة أخرى')}
                </button>
              </div>
            ) : barcode ? (
              <div className="space-y-4">
                {/* Barcode exists */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      {t('Barcode saved', 'تم حفظ الباركود')}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      {t(
                        'This item has a barcode associated with it.',
                        'هذه المادة لديها باركود مرتبط بها.'
                      )}
                    </p>
                  </div>
                </div>

                {/* Barcode value display */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                    {t('Barcode Value', 'قيمة الباركود')}
                  </p>
                  <p className="font-mono text-lg text-zinc-900 dark:text-white break-all">
                    {barcode.barcode}
                  </p>
                  <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('Saved on', 'تم الحفظ في')}: {new Date(barcode.created_at).toLocaleDateString(isRTL ? 'ar' : 'en')}
                    </p>
                    {barcode.created_by_user && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t('Saved by', 'تم الحفظ بواسطة')}: {barcode.created_by_user.first_name || barcode.created_by_user.last_name
                          ? `${barcode.created_by_user.first_name || ''} ${barcode.created_by_user.last_name || ''}`.trim()
                          : barcode.created_by_user.username}
                      </p>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Deleting...', 'جاري الحذف...')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {t('Delete Barcode', 'حذف الباركود')}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                {/* No barcode */}
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-zinc-400" />
                </div>
                <p className="text-zinc-900 dark:text-white font-medium mb-2">
                  {t('No barcode saved', 'لا يوجد باركود محفوظ')}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t(
                    'This item does not have a barcode associated with it. You can scan a barcode during PO counting to associate one.',
                    'هذه المادة ليس لديها باركود مرتبط بها. يمكنك مسح باركود أثناء جرد طلب الشراء لربط باركود.'
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium"
            >
              {t('Close', 'إغلاق')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
