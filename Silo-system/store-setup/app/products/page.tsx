'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Package, Layers, Trash2, Edit2 } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { getProducts, deleteProduct, getProduct, type Product } from '@/lib/products-api';
import { AddProductModal } from '@/components/products/add-product-modal';

export default function ProductsPage() {
  const { t, isRTL, formatCurrency } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [productDetails, setProductDetails] = useState<{ [key: number]: Product }>({});

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!confirm(t('Are you sure you want to delete this product?', 'هل أنت متأكد من حذف هذا المنتج؟'))) {
      return;
    }
    try {
      await deleteProduct(productId);
      loadProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  const handleExpand = async (productId: number) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    
    setExpandedProduct(productId);
    
    // Load product details if not already loaded
    if (!productDetails[productId]) {
      try {
        const details = await getProduct(productId);
        if (details) {
          setProductDetails(prev => ({ ...prev, [productId]: details }));
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
      }
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSuccess = () => {
    loadProducts();
    setProductDetails({});
    setExpandedProduct(null);
  };

  return (
    <PageLayout searchPlaceholder={{ en: 'Search products...', ar: 'البحث في المنتجات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
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
          <div className="grid gap-4">
            {products.map((product) => {
              const details = productDetails[product.id];
              const isExpanded = expandedProduct === product.id;
              
              return (
                <motion.div
                  key={product.id}
                  layout
                  className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                >
                  {/* Product Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => handleExpand(product.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <ShoppingBag className="w-6 h-6 text-zinc-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-900 dark:text-white">
                            {isRTL ? product.name_ar || product.name : product.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            {product.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                {product.category}
                              </span>
                            )}
                            {product.has_variants && (
                              <span className="flex items-center gap-1 text-xs text-zinc-500">
                                <Layers className="w-3 h-3" />
                                {t('Has Variants', 'له أصناف')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-zinc-900 dark:text-white">
                            {formatCurrency(parseFloat(product.price?.toString() || '0'))}
                          </div>
                          {product.cost && (
                            <div className="text-xs text-zinc-500">
                              {t('Cost:', 'التكلفة:')} {formatCurrency(parseFloat(product.cost.toString()))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
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
                          {details ? (
                            <div>
                              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                {t('Ingredients', 'المكونات')}
                              </h4>

                              {details.has_variants && details.variants ? (
                                <div className="space-y-4">
                                  {details.variants.map((variant: any) => (
                                    <div key={variant.id} className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-zinc-900 dark:text-white">
                                          {isRTL ? variant.name_ar || variant.name : variant.name}
                                        </span>
                                        <span className="text-sm text-zinc-500">
                                          {variant.price_adjustment > 0 ? '+' : ''}{variant.price_adjustment?.toFixed(3) || '0.000'}
                                        </span>
                                      </div>
                                      {variant.ingredients && variant.ingredients.length > 0 ? (
                                        <div className="space-y-1">
                                          {variant.ingredients.map((ing: any) => (
                                            <div key={ing.id} className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                                              <span>{isRTL ? ing.item_name_ar || ing.item_name : ing.item_name}</span>
                                              <span>{ing.quantity} {ing.unit}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-zinc-400">{t('No ingredients', 'لا توجد مكونات')}</p>
                                      )}
                                      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-right">
                                        <span className="text-sm text-zinc-500">
                                          {t('Cost:', 'التكلفة:')} <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(variant.total_cost || 0)}</span>
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : details.ingredients && details.ingredients.length > 0 ? (
                                <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                  <div className="space-y-1">
                                    {details.ingredients.map((ing: any) => (
                                      <div key={ing.id} className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                                        <span>{isRTL ? ing.item_name_ar || ing.item_name : ing.item_name}</span>
                                        <span>{ing.quantity} {ing.unit}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-right">
                                    <span className="text-sm text-zinc-500">
                                      {t('Total Cost:', 'التكلفة الإجمالية:')} <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(details.total_cost || 0)}</span>
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-zinc-400 bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-700">
                                  {t('No ingredients added yet', 'لم تتم إضافة مكونات بعد')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                            </div>
                          )}
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

      <AddProductModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        editProduct={editingProduct}
      />
    </PageLayout>
  );
}
