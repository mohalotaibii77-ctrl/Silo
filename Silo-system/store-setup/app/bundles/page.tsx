'use client';

import { useState, useEffect } from 'react';
import { Boxes, Plus, Trash2, Edit2, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { bundlesApi, type Bundle } from '@/lib/bundles-api';
import { BundleModal } from '@/components/bundles/bundle-modal';

export default function BundlesPage() {
  const { t, isRTL, formatCurrency } = useLanguage();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [expandedBundle, setExpandedBundle] = useState<number | null>(null);

  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async () => {
    try {
      setIsLoading(true);
      const data = await bundlesApi.getAll();
      setBundles(data);
    } catch (err) {
      console.error('Failed to load bundles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (bundleId: number) => {
    if (!confirm(t('Are you sure you want to delete this bundle?', 'هل أنت متأكد من حذف هذه الباقة؟'))) {
      return;
    }
    try {
      await bundlesApi.delete(bundleId);
      loadBundles();
    } catch (err) {
      console.error('Failed to delete bundle:', err);
    }
  };

  const handleToggleStatus = async (bundle: Bundle) => {
    try {
      await bundlesApi.toggleStatus(bundle.id, !bundle.is_active);
      loadBundles();
    } catch (err) {
      console.error('Failed to toggle bundle status:', err);
    }
  };

  const handleEdit = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingBundle(null);
  };

  const handleSuccess = () => {
    loadBundles();
  };

  const calculateOriginalPrice = (bundle: Bundle): number => {
    if (!bundle.items) return 0;
    return bundle.items.reduce((sum, item) => {
      const productPrice = item.product?.price || 0;
      return sum + (productPrice * item.quantity);
    }, 0);
  };

  return (
    <PageLayout searchPlaceholder={{ en: 'Search bundles...', ar: 'البحث في الباقات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Bundles', 'الباقات')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Create product bundles - 2 or more products sold together', 'أنشئ باقات المنتجات - منتجان أو أكثر يباعان معاً')}
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Create Bundle', 'إنشاء باقة')}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : bundles.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <Boxes className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No bundles yet', 'لا توجد باقات بعد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {t('Create your first bundle by combining 2 or more products', 'أنشئ باقتك الأولى من خلال دمج منتجين أو أكثر')}
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Create Bundle', 'إنشاء باقة')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {bundles.map((bundle) => {
              const isExpanded = expandedBundle === bundle.id;
              const originalPrice = calculateOriginalPrice(bundle);
              const savings = originalPrice - bundle.price;
              
              return (
                <motion.div
                  key={bundle.id}
                  layout
                  className={`rounded-xl bg-white dark:bg-zinc-900 border ${
                    bundle.is_active 
                      ? 'border-zinc-200 dark:border-zinc-800' 
                      : 'border-zinc-200 dark:border-zinc-800 opacity-60'
                  } overflow-hidden`}
                >
                  {/* Bundle Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => setExpandedBundle(isExpanded ? null : bundle.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                          <Boxes className="w-6 h-6 text-white dark:text-zinc-900" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-zinc-900 dark:text-white">
                              {isRTL ? bundle.name_ar || bundle.name : bundle.name}
                            </h3>
                            {!bundle.is_active && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                                {t('Inactive', 'غير نشط')}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {bundle.items?.length || 0} {t('products', 'منتجات')}
                            </span>
                            {savings > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                {t('Save', 'وفر')} {formatCurrency(savings)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className={`${isRTL ? 'text-left' : 'text-right'}`}>
                          <div className="text-lg font-bold text-zinc-900 dark:text-white">
                            {formatCurrency(bundle.price)}
                          </div>
                          {originalPrice > bundle.price && (
                            <div className="text-xs text-zinc-400 line-through">
                              {formatCurrency(originalPrice)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(bundle); }}
                            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(bundle.id); }}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details - Products in Bundle */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30">
                          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            {t('Products in Bundle', 'المنتجات في الباقة')}
                          </h4>
                          
                          {bundle.items && bundle.items.length > 0 ? (
                            <div className="space-y-2">
                              {bundle.items.map((item) => (
                                <div 
                                  key={item.id}
                                  className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                                      {item.product?.image_url ? (
                                        <img 
                                          src={item.product.image_url} 
                                          alt={item.product.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <Package className="w-5 h-5 text-zinc-400" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium text-zinc-900 dark:text-white text-sm">
                                        {isRTL ? item.product?.name_ar || item.product?.name : item.product?.name}
                                      </p>
                                      <p className="text-xs text-zinc-500">
                                        {formatCurrency(item.product?.price || 0)} × {item.quantity}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    {formatCurrency((item.product?.price || 0) * item.quantity)}
                                  </div>
                                </div>
                              ))}
                              
                              {/* Summary */}
                              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                                <span className="text-sm text-zinc-500">{t('Original Total', 'المجموع الأصلي')}</span>
                                <span className="text-sm text-zinc-400 line-through">{formatCurrency(originalPrice)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('Bundle Price', 'سعر الباقة')}</span>
                                <span className="text-lg font-bold text-zinc-900 dark:text-white">{formatCurrency(bundle.price)}</span>
                              </div>
                              {savings > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-emerald-600 dark:text-emerald-400">{t('You Save', 'توفيرك')}</span>
                                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(savings)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-400 bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                              {t('No products in this bundle', 'لا توجد منتجات في هذه الباقة')}
                            </p>
                          )}

                          {/* Toggle Status Button */}
                          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                            <button
                              onClick={() => handleToggleStatus(bundle)}
                              className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                                bundle.is_active
                                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
                              }`}
                            >
                              {bundle.is_active 
                                ? t('Deactivate Bundle', 'إلغاء تفعيل الباقة')
                                : t('Activate Bundle', 'تفعيل الباقة')
                              }
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      <BundleModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        editBundle={editingBundle}
      />
    </PageLayout>
  );
}

