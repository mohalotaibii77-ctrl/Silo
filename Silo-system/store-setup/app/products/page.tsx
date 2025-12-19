'use client';

import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Plus, Package, Layers, Trash2, Edit2, Search, X, ImageIcon, Truck, Store } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { getProducts, deleteProduct, getProduct, getProductStats, type Product, type ProductStats } from '@/lib/products-api';
import { AddProductModal } from '@/components/products/add-product-modal';

// Helper to get margin color - display logic only, no calculation
function getMarginColor(margin: number): string {
  if (margin >= 30) return 'text-emerald-600 dark:text-emerald-400';
  if (margin >= 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export default function ProductsPage() {
  const { t, isRTL, formatCurrency } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetails, setProductDetails] = useState<{ [key: number]: Product | 'loading' | 'no-data' }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [productStats, setProductStats] = useState<Record<number, ProductStats>>({});
  const hasInitialLoad = useRef(false); // Track if initial load is complete to skip animations

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async (isRefresh = false) => {
    try {
      // Only show loading spinner on initial load, not on refresh
      if (!isRefresh) {
        setIsLoading(true);
      }
      const [data, stats] = await Promise.all([
        getProducts(),
        getProductStats()
      ]);
      setProducts(data);
      setProductStats(stats);
      hasInitialLoad.current = true;
      // Background load all product details
      data.forEach(product => loadProductDetails(product.id));
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProductDetails = async (productId: number) => {
    // Skip if already loaded or loading
    if (productDetails[productId]) return;
    
    setProductDetails(prev => ({ ...prev, [productId]: 'loading' }));
    
    try {
      const details = await getProduct(productId);
      if (details) {
        setProductDetails(prev => ({ ...prev, [productId]: details }));
      } else {
        // Product exists but has no ingredients configured
        setProductDetails(prev => ({ ...prev, [productId]: 'no-data' }));
      }
    } catch (err) {
      // Mark as no-data on error so we don't show infinite loading
      setProductDetails(prev => ({ ...prev, [productId]: 'no-data' }));
    }
  };

  const handleDelete = async (productId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(t('Are you sure you want to delete this product?', 'هل أنت متأكد من حذف هذا المنتج؟'))) {
      return;
    }
    try {
      await deleteProduct(productId);
      loadProducts(true); // Refresh without showing loading spinner
      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
      }
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    // Trigger load if not already loaded
    if (!productDetails[product.id]) {
      loadProductDetails(product.id);
    }
  };

  const handleEdit = (product: Product, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSuccess = () => {
    loadProducts(true); // Refresh without showing loading spinner
    setProductDetails({});
    setSelectedProduct(null);
  };

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.name_ar?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query)
    );
  });

  return (
    <PageLayout searchPlaceholder={{ en: 'Search products...', ar: 'البحث في المنتجات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Products', 'المنتجات')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Define products with ingredients for your menu', 'حدد المنتجات مع المكونات لقائمتك')}
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Add Product', 'إضافة منتج')}
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
              placeholder={t('Search products...', 'البحث عن منتجات...')}
              className={`${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 w-64 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No products yet', 'لا توجد منتجات بعد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {t('Get started by adding your first product with ingredients', 'ابدأ بإضافة أول منتج مع المكونات')}
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Add Product', 'إضافة منتج')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={hasInitialLoad.current ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: hasInitialLoad.current ? 0 : index * 0.05 }}
                onClick={() => handleViewDetails(product)}
                className="group relative rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg transition-all duration-200"
              >
                {/* Product Image */}
                <div className="aspect-square relative bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={isRTL ? product.name_ar || product.name : product.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
                    </div>
                  )}
                  
                  {/* Action buttons overlay */}
                  <div className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                    <button
                      onClick={(e) => handleEdit(product, e)}
                      className="p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 transition-colors shadow-sm"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(product.id, e)}
                      className="p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Variants badge */}
                  {product.has_variants && (
                    <div className={`absolute top-2 ${isRTL ? 'right-2' : 'left-2'}`}>
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-500/90 backdrop-blur-sm text-white rounded-lg">
                        <Layers className="w-3 h-3" />
                        {t('Variants', 'أصناف')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-zinc-900 dark:text-white text-sm line-clamp-1">
                    {isRTL ? product.name_ar || product.name : product.name}
                  </h3>
                  {product.category && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                      {product.category}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-base font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(parseFloat(product.price?.toString() || '0'))}
                    </span>
                    {product.cost && (
                      <span className="text-xs text-zinc-400">
                        {t('Cost:', 'التكلفة:')} {formatCurrency(parseFloat(product.cost.toString()))}
                      </span>
                    )}
                  </div>
                  
                  {/* Product Stats - Uses margin_percent from main product list (getProducts API) */}
                  {(() => {
                    const sold = productStats[product.id]?.sold || 0;
                    
                    // Products with variants - use product.variants from main list (has margin_percent)
                    if (product.has_variants && product.variants && product.variants.length > 0) {
                      return (
                        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                          {product.variants.map((variant) => {
                            // Use margin_percent from main product list
                            const variantMargin = variant.margin_percent || 0;
                            
                            return (
                              <div key={variant.id} className="space-y-1.5 pb-1.5 border-b border-zinc-50 dark:border-zinc-800 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[80px]">
                                    {isRTL ? variant.name_ar || variant.name : variant.name}
                                  </span>
                                  <span className="text-zinc-400 text-[10px]">
                                    {sold} {t('sold', 'مباع')}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1 text-[10px]">
                                  {/* Dine-in margin from backend */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-zinc-500 flex items-center gap-1">
                                      <Store className="w-2.5 h-2.5" />
                                      {t('Dine-in', 'محلي')}
                                    </span>
                                    <span className={`font-semibold ${getMarginColor(variantMargin)}`}>
                                      {variantMargin.toFixed(2)}%
                                    </span>
                                  </div>
                                  {/* Delivery partner margins from backend */}
                                  {variant.delivery_margins?.map((dm) => (
                                    <div key={dm.partner_id} className="flex items-center justify-between">
                                      <span className="text-zinc-500 flex items-center gap-1">
                                        <Truck className="w-2.5 h-2.5" />
                                        <span className="truncate max-w-[60px]">
                                          {isRTL ? dm.partner_name_ar || dm.partner_name : dm.partner_name}
                                        </span>
                                      </span>
                                      <span className={`font-semibold ${getMarginColor(dm.margin_percent)}`}>
                                        {dm.margin_percent.toFixed(2)}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    // Non-variant product - use margin_percent from main product list
                    const margin = product.margin_percent || 0;
                    
                    return (
                      <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
                        {/* Sold count */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t('Sold:', 'المُباع:')}
                          </span>
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {sold}
                          </span>
                        </div>
                        
                        {/* Dine-in Margin from backend */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            {t('Dine-in:', 'محلي:')}
                          </span>
                          <span className={`text-xs font-semibold ${getMarginColor(margin)}`}>
                            {margin.toFixed(2)}%
                          </span>
                        </div>
                        
                        {/* Delivery partner margins from backend */}
                        {product.delivery_margins?.map((dm) => (
                          <div key={dm.partner_id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              <span className="truncate max-w-[80px]">
                                {isRTL ? dm.partner_name_ar || dm.partner_name : dm.partner_name}
                              </span>
                            </span>
                            <span className={`text-xs font-semibold ${getMarginColor(dm.margin_percent)}`}>
                              {dm.margin_percent.toFixed(2)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
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
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={isRTL ? selectedProduct.name_ar || selectedProduct.name : selectedProduct.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="w-20 h-20 text-zinc-300 dark:text-zinc-600" />
                  </div>
                )}
                <button
                  onClick={() => setSelectedProduct(null)}
                  className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} p-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-14rem)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      {isRTL ? selectedProduct.name_ar || selectedProduct.name : selectedProduct.name}
                    </h2>
                    {selectedProduct.category && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {selectedProduct.category}
                      </span>
                    )}
                  </div>
                  <div className={isRTL ? 'text-left' : 'text-right'}>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(parseFloat(selectedProduct.price?.toString() || '0'))}
                    </div>
                    {selectedProduct.cost && (
                      <div className="text-xs text-zinc-500">
                        {t('Cost:', 'التكلفة:')} {formatCurrency(parseFloat(selectedProduct.cost.toString()))}
                      </div>
                    )}
                  </div>
                </div>

                {selectedProduct.description && (
                  <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {isRTL ? selectedProduct.description_ar || selectedProduct.description : selectedProduct.description}
                  </p>
                )}

                {/* Ingredients Section */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t('Ingredients', 'المكونات')}
                  </h4>

                  {(() => {
                    const details = productDetails[selectedProduct.id];
                    
                    // Loading state
                    if (!details || details === 'loading') {
                      return (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                        </div>
                      );
                    }
                    
                    // No data state (404 or empty)
                    if (details === 'no-data') {
                      return (
                        <p className="text-sm text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                          {t('No ingredients added yet', 'لم تتم إضافة مكونات بعد')}
                        </p>
                      );
                    }
                    
                    // Has variants with ingredients
                    if (details.has_variants && details.variants) {
                      const basePrice = parseFloat(selectedProduct.price?.toString() || '0');
                      // Get margin data from main product list (selectedProduct.variants has margin_percent from getProducts API)
                      const mainVariants = selectedProduct.variants || [];
                      
                      return (
                        <div className="space-y-3">
                          {details.variants.map((variant: any) => {
                            // Use values from backend - no frontend calculations
                            const variantPrice = variant.variant_price || (basePrice + (variant.price_adjustment || 0));
                            const variantCost = variant.total_cost || 0; // Cost comes from backend
                            // Get margin from main product list (which has margin_percent from getProducts API)
                            const mainVariant = mainVariants.find((v: any) => v.id === variant.id);
                            const variantMargin = mainVariant?.margin_percent ?? variant.margin_percent ?? 0;
                            
                            return (
                              <div key={variant.id} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-zinc-900 dark:text-white">
                                    {isRTL ? variant.name_ar || variant.name : variant.name}
                                  </span>
                                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    {formatCurrency(variantPrice)}
                                  </span>
                                </div>
                                {variant.ingredients && variant.ingredients.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {variant.ingredients.map((ing: any) => (
                                      <div key={ing.id} className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                                        <span>{isRTL ? ing.item_name_ar || ing.item_name : ing.item_name}</span>
                                        <span className="text-zinc-400">{ing.quantity} {ing.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-zinc-400">{t('No ingredients', 'لا توجد مكونات')}</p>
                                )}
                                <div className={`mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between`}>
                                  <span className="text-sm text-zinc-500">
                                    {t('Cost:', 'التكلفة:')} <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(variantCost)}</span>
                                  </span>
                                  <span className="text-sm text-zinc-500">
                                    {t('Margin:', 'الهامش:')} <span className={`font-semibold ${
                                      variantMargin >= 30 
                                        ? 'text-emerald-600 dark:text-emerald-400' 
                                        : variantMargin >= 15 
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-red-600 dark:text-red-400'
                                    }`}>{variantMargin.toFixed(2)}%</span>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    
                    // Has ingredients (no variants)
                    if (details.ingredients && details.ingredients.length > 0) {
                      // Get margin from main product list (selectedProduct has margin_percent from getProducts API)
                      const productMargin = selectedProduct.margin_percent ?? 0;
                      
                      return (
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                          <div className="space-y-1.5">
                            {details.ingredients.map((ing: any) => (
                              <div key={ing.id} className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                                <span>{isRTL ? ing.item_name_ar || ing.item_name : ing.item_name}</span>
                                <span className="text-zinc-400">{ing.quantity} {ing.unit}</span>
                              </div>
                            ))}
                          </div>
                          <div className={`mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between`}>
                            <span className="text-sm text-zinc-500">
                              {t('Cost:', 'التكلفة:')} <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(details.total_cost || 0)}</span>
                            </span>
                            <span className="text-sm text-zinc-500">
                              {t('Margin:', 'الهامش:')} <span className={`font-semibold ${
                                productMargin >= 30 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : productMargin >= 15 
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-red-600 dark:text-red-400'
                              }`}>{productMargin.toFixed(2)}%</span>
                            </span>
                          </div>
                        </div>
                      );
                    }
                    
                    // No ingredients
                    return (
                      <p className="text-sm text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                        {t('No ingredients added yet', 'لم تتم إضافة مكونات بعد')}
                      </p>
                    );
                  })()}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedProduct(null);
                      handleEdit(selectedProduct);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-xl font-medium transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    {t('Edit Product', 'تعديل المنتج')}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedProduct.id)}
                    className="px-4 py-2.5 rounded-xl font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddProductModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        editProduct={editingProduct}
      />
    </PageLayout>
  );
}
