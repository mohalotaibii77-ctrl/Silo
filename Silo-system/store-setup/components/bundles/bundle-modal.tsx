'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Minus, Package, Search, Boxes } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { bundlesApi, type Bundle, type CreateBundleInput, type UpdateBundleInput } from '@/lib/bundles-api';
import { getProducts, type Product } from '@/lib/products-api';

interface BundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editBundle?: Bundle | null;
}

interface SelectedProduct {
  product_id: number;
  quantity: number;
  product?: Product;
}

export function BundleModal({ isOpen, onClose, onSuccess, editBundle }: BundleModalProps) {
  const { t, isRTL, formatCurrency } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [error, setError] = useState('');

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

  // Load products on mount
  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (editBundle) {
      setName(editBundle.name);
      setNameAr(editBundle.name_ar || '');
      setDescription(editBundle.description || '');
      setPrice(editBundle.price.toString());
      setSelectedProducts(
        (editBundle.items || []).map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          product: item.product as unknown as Product
        }))
      );
    } else {
      resetForm();
    }
  }, [editBundle, isOpen]);

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const resetForm = () => {
    setName('');
    setNameAr('');
    setDescription('');
    setPrice('');
    setSelectedProducts([]);
    setError('');
    setSearchQuery('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddProduct = (product: Product) => {
    // Check if already added
    if (selectedProducts.some(p => p.product_id === product.id)) {
      // Increase quantity
      setSelectedProducts(prev => 
        prev.map(p => 
          p.product_id === product.id 
            ? { ...p, quantity: p.quantity + 1 }
            : p
        )
      );
    } else {
      setSelectedProducts(prev => [
        ...prev,
        { product_id: product.id, quantity: 1, product }
      ]);
    }
    setSearchQuery('');
  };

  const handleRemoveProduct = (productId: number) => {
    setSelectedProducts(prev => prev.filter(p => p.product_id !== productId));
  };

  const handleQuantityChange = (productId: number, delta: number) => {
    setSelectedProducts(prev => 
      prev.map(p => {
        if (p.product_id === productId) {
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty };
        }
        return p;
      })
    );
  };

  const calculateOriginalPrice = (): number => {
    return selectedProducts.reduce((sum, item) => {
      const productPrice = parseFloat(item.product?.price?.toString() || '0');
      return sum + (productPrice * item.quantity);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError(t('Bundle name is required', 'اسم الباقة مطلوب'));
      return;
    }

    if (selectedProducts.length < 2) {
      setError(t('A bundle must contain at least 2 products', 'يجب أن تحتوي الباقة على منتجين على الأقل'));
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      setError(t('Please set a valid price', 'يرجى تحديد سعر صالح'));
      return;
    }

    setIsLoading(true);

    try {
      const bundleData = {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        description: description.trim() || undefined,
        price: parseFloat(price),
        compare_at_price: calculateOriginalPrice(),
        items: selectedProducts.map(p => ({
          product_id: p.product_id,
          quantity: p.quantity
        }))
      };

      if (editBundle) {
        await bundlesApi.update(editBundle.id, bundleData as UpdateBundleInput);
      } else {
        await bundlesApi.create(bundleData as CreateBundleInput);
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save bundle', 'فشل في حفظ الباقة'));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.name_ar && p.name_ar.toLowerCase().includes(query))
    );
  });

  const originalPrice = calculateOriginalPrice();
  const bundlePrice = parseFloat(price) || 0;
  const savings = originalPrice - bundlePrice;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                <Boxes className="w-5 h-5 text-white dark:text-zinc-900" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {editBundle ? t('Edit Bundle', 'تعديل الباقة') : t('Create Bundle', 'إنشاء باقة')}
                </h2>
                <p className="text-sm text-zinc-500">
                  {t('Combine products into a discounted bundle', 'ادمج المنتجات في باقة مخفضة')}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)] overscroll-contain">
            <div className="p-6 space-y-6">
              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Bundle Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Bundle Name', 'اسم الباقة')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('e.g., Family Meal Deal', 'مثال: عرض وجبة العائلة')}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/30 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Name (Arabic)', 'الاسم (عربي)')}
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder={t('Arabic name', 'الاسم بالعربية')}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/30 outline-none"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Description', 'الوصف')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('Optional bundle description', 'وصف اختياري للباقة')}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/30 outline-none resize-none"
                />
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Select Products', 'اختر المنتجات')} *
                  <span className="text-zinc-400 font-normal ml-2">
                    ({t('minimum 2', 'الحد الأدنى 2')})
                  </span>
                </label>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('Search products to add...', 'ابحث عن منتجات لإضافتها...')}
                    className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-none text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/30 outline-none`}
                  />
                </div>

                {/* Product List (when searching) */}
                {searchQuery && (
                  <div className="mb-3 max-h-40 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-200 dark:divide-zinc-700">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-center text-sm text-zinc-400">
                        {t('No products found', 'لم يتم العثور على منتجات')}
                      </div>
                    ) : (
                      filteredProducts.slice(0, 5).map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleAddProduct(product)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                            <Package className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                              {isRTL ? product.name_ar || product.name : product.name}
                            </p>
                          </div>
                          <span className="text-sm text-zinc-500">
                            {formatCurrency(parseFloat(product.price?.toString() || '0'))}
                          </span>
                          <Plus className="w-4 h-4 text-zinc-500" />
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Selected Products */}
                <div className="space-y-2">
                  {selectedProducts.length === 0 ? (
                    <div className="p-4 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-center">
                      <Package className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                      <p className="text-sm text-zinc-400">
                        {t('Search and add products above', 'ابحث وأضف المنتجات أعلاه')}
                      </p>
                    </div>
                  ) : (
                    selectedProducts.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
                      >
                        <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                          <Package className="w-5 h-5 text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-white text-sm truncate">
                            {isRTL ? item.product?.name_ar || item.product?.name : item.product?.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatCurrency(parseFloat(item.product?.price?.toString() || '0'))} × {item.quantity}
                          </p>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.product_id, -1)}
                            className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.product_id, 1)}
                            className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(item.product_id)}
                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{t('Products Total', 'مجموع المنتجات')}</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatCurrency(originalPrice)}</span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Bundle Price', 'سعر الباقة')} *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500/30 focus:border-zinc-500 outline-none"
                    />
                  </div>
                </div>

                {savings > 0 && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <span className="text-emerald-600 dark:text-emerald-400">{t('Customer Saves', 'توفير العميل')}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(savings)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-colors"
              >
                {t('Cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {editBundle ? t('Update Bundle', 'تحديث الباقة') : t('Create Bundle', 'إنشاء باقة')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

