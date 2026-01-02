'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Trash2, Package, Layers, ShoppingBag, Warehouse, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Item } from '@/types/items';
import { getItemUsage, deleteItem, ItemUsage } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';

interface DeleteItemModalProps {
  isOpen: boolean;
  item: Item | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteItemModal({ isOpen, item, onClose, onSuccess }: DeleteItemModalProps) {
  const { isRTL, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [usage, setUsage] = useState<ItemUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDefaultItem, setIsDefaultItem] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      fetchUsage();
    } else {
      // Reset state when modal closes
      setUsage(null);
      setError(null);
      setIsDefaultItem(false);
    }
  }, [isOpen, item]);

  const fetchUsage = async () => {
    if (!item) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await getItemUsage(item.id);
      setUsage(response.usage);
      setIsDefaultItem(response.item.is_default);
    } catch (err: any) {
      console.error('Failed to fetch item usage:', err);
      setError(err.response?.data?.message || 'Failed to check item usage');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    
    setDeleting(true);
    setError(null);
    
    try {
      // Always cascade since user confirmed
      await deleteItem(item.id, true);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      setError(err.response?.data?.message || 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !item) return null;

  const hasUsage = usage && usage.totalUsageCount > 0;
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
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {t('Delete Item', 'حذف المادة')}
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
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('Checking item usage...', 'جاري التحقق من استخدام المادة...')}
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={fetchUsage}
                  className="mt-3 text-sm text-red-600 dark:text-red-400 underline"
                >
                  {t('Try again', 'حاول مرة أخرى')}
                </button>
              </div>
            ) : (
              <>
                {/* Default item notice */}
                {isDefaultItem && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {t('This is a general (default) item', 'هذه مادة عامة (افتراضية)')}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        {t(
                          'Deleting it will only hide it from your business. Other businesses will still see it.',
                          'حذفها سيخفيها فقط من منشأتك. المنشآت الأخرى ستظل تراها.'
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Usage warning */}
                {hasUsage ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          {t('This item is being used', 'هذه المادة مستخدمة')}
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          {t(
                            'Deleting this item will also delete all related entities listed below.',
                            'حذف هذه المادة سيؤدي أيضاً إلى حذف جميع العناصر المرتبطة المذكورة أدناه.'
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Usage list */}
                    <div className="space-y-3">
                      {/* Products */}
                      {usage!.products.length > 0 && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="w-4 h-4 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {t('Products', 'المنتجات')} ({usage!.products.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {usage!.products.slice(0, 5).map((product) => (
                              <span
                                key={product.id}
                                className="px-2 py-1 text-xs rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                              >
                                {isRTL && product.name_ar ? product.name_ar : product.name}
                              </span>
                            ))}
                            {usage!.products.length > 5 && (
                              <span className="px-2 py-1 text-xs text-zinc-500">
                                +{usage!.products.length - 5} {t('more', 'آخرين')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Composite Items */}
                      {usage!.compositeItems.length > 0 && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Layers className="w-4 h-4 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {t('Composite Items', 'المواد المركبة')} ({usage!.compositeItems.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {usage!.compositeItems.slice(0, 5).map((comp) => (
                              <span
                                key={comp.id}
                                className="px-2 py-1 text-xs rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                              >
                                {isRTL && comp.name_ar ? comp.name_ar : comp.name}
                              </span>
                            ))}
                            {usage!.compositeItems.length > 5 && (
                              <span className="px-2 py-1 text-xs text-zinc-500">
                                +{usage!.compositeItems.length - 5} {t('more', 'آخرين')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bundles */}
                      {usage!.bundles.length > 0 && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <ShoppingBag className="w-4 h-4 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {t('Bundles', 'الباقات')} ({usage!.bundles.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {usage!.bundles.slice(0, 5).map((bundle) => (
                              <span
                                key={bundle.id}
                                className="px-2 py-1 text-xs rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                              >
                                {isRTL && bundle.name_ar ? bundle.name_ar : bundle.name}
                              </span>
                            ))}
                            {usage!.bundles.length > 5 && (
                              <span className="px-2 py-1 text-xs text-zinc-500">
                                +{usage!.bundles.length - 5} {t('more', 'آخرين')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Inventory */}
                      {usage!.inventoryBranches.length > 0 && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Warehouse className="w-4 h-4 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-white">
                              {t('Inventory Stock', 'المخزون')} ({usage!.inventoryBranches.length} {t('branches', 'فروع')})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {usage!.inventoryBranches.map((branch) => (
                              <span
                                key={branch.id}
                                className="px-2 py-1 text-xs rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                              >
                                {branch.name}: {branch.quantity}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-zinc-600 dark:text-zinc-400">
                      {t(
                        'This item is not being used anywhere. It can be safely deleted.',
                        'هذه المادة غير مستخدمة في أي مكان. يمكن حذفها بأمان.'
                      )}
                    </p>
                  </div>
                )}

                {/* Confirmation text */}
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200 text-center font-medium">
                    {t(
                      'Are you sure you want to delete this item? This action cannot be undone.',
                      'هل أنت متأكد من حذف هذه المادة؟ لا يمكن التراجع عن هذا الإجراء.'
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={onClose}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium disabled:opacity-50"
              >
                {t('Cancel', 'إلغاء')}
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors font-medium disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('Deleting...', 'جاري الحذف...')}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t('Delete', 'حذف')}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}






