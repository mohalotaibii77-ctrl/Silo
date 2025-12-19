'use client';

import { useState, useEffect, useRef } from 'react';
import { Boxes, Plus, Trash2, Edit2, Package, X, ImageIcon, Search, Store, Truck } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { bundlesApi, type Bundle, type BundleStats } from '@/lib/bundles-api';
import { BundleModal } from '@/components/bundles/bundle-modal';

export default function BundlesPage() {
  const { t, isRTL, formatCurrency } = useLanguage();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleStats, setBundleStats] = useState<Record<number, BundleStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const hasInitialLoad = useRef(false); // Track if initial load is complete to skip animations

  useEffect(() => {
    loadBundles();
  }, []);

  const loadBundles = async (isRefresh = false) => {
    try {
      // Only show loading spinner on initial load, not on refresh
      if (!isRefresh) {
        setIsLoading(true);
      }
      const [bundlesData, statsData] = await Promise.all([
        bundlesApi.getAll(),
        bundlesApi.getStats()
      ]);
      setBundles(bundlesData);
      setBundleStats(statsData);
      hasInitialLoad.current = true;
    } catch (err) {
      console.error('Failed to load bundles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (bundleId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(t('Are you sure you want to delete this bundle?', 'هل أنت متأكد من حذف هذه الباقة؟'))) {
      return;
    }
    try {
      await bundlesApi.delete(bundleId);
      loadBundles(true); // Refresh without showing loading spinner
      if (selectedBundle?.id === bundleId) {
        setSelectedBundle(null);
      }
    } catch (err) {
      console.error('Failed to delete bundle:', err);
    }
  };

  const handleEdit = (bundle: Bundle, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingBundle(bundle);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingBundle(null);
  };

  const handleSuccess = () => {
    loadBundles(true); // Refresh without showing loading spinner
    setSelectedBundle(null);
  };

  // original_price, savings_amount, savings_percent now come from backend API
  // No local calculation needed

  const filteredBundles = bundles.filter(bundle => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bundle.name.toLowerCase().includes(query) ||
      bundle.name_ar?.toLowerCase().includes(query)
    );
  });

  return (
    <PageLayout searchPlaceholder={{ en: 'Search bundles...', ar: 'البحث في الباقات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
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

        {/* Search */}
        <div className="flex justify-end">
          <div className="relative">
            <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search bundles...', 'البحث عن باقات...')}
              className={`${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 w-64 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredBundles.length === 0 ? (
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredBundles.map((bundle, index) => {
              // Use values from backend API - no frontend calculations
              const originalPrice = (bundle as any).original_price || 0;
              const savings = (bundle as any).savings_amount || 0;
              const stats = bundleStats[bundle.id];
              // margin_percent comes from backend bundleStats
              const totalCost = stats?.total_cost || 0;
              const margin = stats?.margin_percent ?? 0; // Backend provides margin, default to 0 if unavailable
              const sold = stats?.sold || 0;
              
              return (
                <motion.div
                  key={bundle.id}
                  initial={hasInitialLoad.current ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: hasInitialLoad.current ? 0 : index * 0.05 }}
                  onClick={() => setSelectedBundle(bundle)}
                  className={`group relative rounded-2xl bg-white dark:bg-zinc-900 border ${
                    bundle.is_active 
                      ? 'border-zinc-200 dark:border-zinc-800' 
                      : 'border-zinc-200 dark:border-zinc-800 opacity-60'
                  } overflow-hidden cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg transition-all duration-200`}
                >
                  {/* Bundle Image */}
                  <div className="aspect-square relative bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden">
                    {bundle.image_url ? (
                      <img
                        src={bundle.image_url}
                        alt={isRTL ? bundle.name_ar || bundle.name : bundle.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Boxes className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
                      </div>
                    )}
                    
                    {/* Action buttons overlay */}
                    <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                      <button
                        onClick={(e) => handleEdit(bundle, e)}
                        className="p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-colors shadow-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(bundle.id, e)}
                        className="p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Savings badge */}
                    {savings > 0 && (
                      <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'}`}>
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-500/90 backdrop-blur-sm text-white rounded-lg">
                          {t('Save', 'وفر')} {formatCurrency(savings)}
                        </span>
                      </div>
                    )}

                    {/* Inactive badge */}
                    {!bundle.is_active && (
                      <div className="absolute bottom-2 left-2 right-2">
                        <span className="block text-center px-2 py-1 text-xs font-medium bg-zinc-500/90 backdrop-blur-sm text-white rounded-lg">
                          {t('Inactive', 'غير نشط')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bundle Info */}
                  <div className="p-3">
                    <h3 className="font-semibold text-zinc-900 dark:text-white text-sm line-clamp-1">
                      {isRTL ? bundle.name_ar || bundle.name : bundle.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {bundle.items?.length || 0} {t('products', 'منتجات')}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-base font-bold text-zinc-900 dark:text-white">
                        {formatCurrency(bundle.price)}
                      </span>
                      {originalPrice > bundle.price && (
                        <span className="text-xs text-zinc-400 line-through">
                          {formatCurrency(originalPrice)}
                        </span>
                      )}
                    </div>
                    
                    {/* Bundle Stats */}
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t('Sold:', 'المُباع:')}
                        </span>
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          {sold}
                        </span>
                      </div>
                      {/* Dine-in margin */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          <Store className="w-3 h-3" />
                          {t('Dine-in:', 'محلي:')}
                        </span>
                        <span className={`text-xs font-semibold ${
                          margin >= 30 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : margin >= 15 
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}>
                          {margin.toFixed(1)}%
                        </span>
                      </div>
                      {/* Delivery partner margins */}
                      {stats?.delivery_margins?.map((dm) => (
                        <div key={dm.partner_id} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            <span className="truncate max-w-[80px]">
                              {isRTL ? dm.partner_name_ar || dm.partner_name : dm.partner_name}
                            </span>
                          </span>
                          <span className={`text-xs font-semibold ${
                            dm.margin_percent >= 30 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : dm.margin_percent >= 15 
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}>
                            {dm.margin_percent.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Bundle Details Modal */}
      <AnimatePresence>
        {selectedBundle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedBundle(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
              dir={isRTL ? 'rtl' : 'ltr'}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header with Image */}
              <div className="relative h-56 bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900">
                {selectedBundle.image_url ? (
                  <img
                    src={selectedBundle.image_url}
                    alt={isRTL ? selectedBundle.name_ar || selectedBundle.name : selectedBundle.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Boxes className="w-20 h-20 text-zinc-300 dark:text-zinc-600" />
                  </div>
                )}
                <button
                  onClick={() => setSelectedBundle(null)}
                  className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-14rem)]">
                {(() => {
                  // Use values from backend API - no frontend calculations
                  const originalPrice = (selectedBundle as any).original_price || 0;
                  const savings = (selectedBundle as any).savings_amount || 0;
                  const stats = bundleStats[selectedBundle.id];
                  const totalCost = stats?.total_cost || 0;
                  // margin_percent comes from backend bundleStats
                  const margin = stats?.margin_percent ?? 0; // Backend provides margin, default to 0 if unavailable
                  
                  return (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                            {isRTL ? selectedBundle.name_ar || selectedBundle.name : selectedBundle.name}
                          </h2>
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {selectedBundle.items?.length || 0} {t('products', 'منتجات')}
                          </span>
                        </div>
                        <div className={isRTL ? 'text-left' : 'text-right'}>
                          <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {formatCurrency(selectedBundle.price)}
                          </div>
                          {originalPrice > selectedBundle.price && (
                            <div className="text-xs text-zinc-400 line-through">
                              {formatCurrency(originalPrice)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="mt-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 flex items-center justify-around">
                        <div className="text-center">
                          <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats?.sold || 0}</div>
                          <div className="text-xs text-zinc-500">{t('Sold', 'المُباع')}</div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
                        <div className="text-center">
                          <div className={`text-lg font-bold ${
                            margin >= 30 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : margin >= 15 
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}>{margin.toFixed(1)}%</div>
                          <div className="text-xs text-zinc-500">{t('Margin', 'الهامش')}</div>
                        </div>
                        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
                        <div className="text-center">
                          <div className="text-lg font-bold text-zinc-900 dark:text-white">{formatCurrency(totalCost)}</div>
                          <div className="text-xs text-zinc-500">{t('Cost', 'التكلفة')}</div>
                        </div>
                      </div>

                      {/* Delivery Partner Margins */}
                      {stats?.delivery_margins && stats.delivery_margins.length > 0 && (
                        <div className="mt-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {t('Delivery Margins', 'هوامش التوصيل')}
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {stats.delivery_margins.map((dm) => (
                              <div key={dm.partner_id} className="flex items-center gap-2">
                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                  {isRTL ? dm.partner_name_ar || dm.partner_name : dm.partner_name}:
                                </span>
                                <span className={`text-xs font-semibold ${
                                  dm.margin_percent >= 30 
                                    ? 'text-emerald-600 dark:text-emerald-400' 
                                    : dm.margin_percent >= 15 
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {dm.margin_percent.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedBundle.description && (
                        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                          {isRTL ? selectedBundle.description_ar || selectedBundle.description : selectedBundle.description}
                        </p>
                      )}

                      {/* Products in Bundle */}
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          {t('Products in Bundle', 'المنتجات في الباقة')}
                        </h4>

                        {selectedBundle.items && selectedBundle.items.length > 0 ? (
                          <div className="space-y-2">
                            {selectedBundle.items.map((item) => (
                              <div 
                                key={item.id}
                                className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700"
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
                            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-zinc-500">{t('Original Total', 'المجموع الأصلي')}</span>
                                <span className="text-sm text-zinc-400 line-through">{formatCurrency(originalPrice)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('Bundle Price', 'سعر الباقة')}</span>
                                <span className="text-lg font-bold text-zinc-900 dark:text-white">{formatCurrency(selectedBundle.price)}</span>
                              </div>
                              {savings > 0 && (
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-sm text-emerald-600 dark:text-emerald-400">{t('Customer Saves', 'يوفر العميل')}</span>
                                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(savings)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                            {t('No products in this bundle', 'لا توجد منتجات في هذه الباقة')}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-6 flex gap-3">
                        <button
                          onClick={() => {
                            setSelectedBundle(null);
                            handleEdit(selectedBundle);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl font-medium transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          {t('Edit Bundle', 'تعديل الباقة')}
                        </button>
                        <button
                          onClick={() => handleDelete(selectedBundle.id)}
                          className="px-4 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BundleModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        editBundle={editingBundle}
      />
    </PageLayout>
  );
}
