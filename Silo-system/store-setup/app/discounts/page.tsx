'use client';

import { useState, useEffect } from 'react';
import { Percent, Plus, Edit2, Trash2, Tag, Calendar, Hash, CheckCircle, XCircle, X } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { getDiscounts, createDiscount, updateDiscount, deleteDiscount, type DiscountCode, type CreateDiscountData } from '@/lib/discounts-api';

export default function DiscountsPage() {
  const { t, isRTL } = useLanguage();
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDiscounts();
  }, []);

  const loadDiscounts = async () => {
    try {
      setIsLoading(true);
      const data = await getDiscounts();
      setDiscounts(data);
    } catch (err) {
      console.error('Failed to load discounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (discount?: DiscountCode) => {
    if (discount) {
      setEditingDiscount(discount);
      setCode(discount.code);
      setName(discount.name || '');
      setNameAr(discount.name_ar || '');
      setDiscountType(discount.discount_type);
      setDiscountValue(discount.discount_value.toString());
      setMinOrderAmount(discount.min_order_amount?.toString() || '');
      setMaxDiscountAmount(discount.max_discount_amount?.toString() || '');
      setUsageLimit(discount.usage_limit?.toString() || '');
      setStartDate(discount.start_date ? discount.start_date.split('T')[0] : '');
      setEndDate(discount.end_date ? discount.end_date.split('T')[0] : '');
    } else {
      setEditingDiscount(null);
      setCode('');
      setName('');
      setNameAr('');
      setDiscountType('percentage');
      setDiscountValue('');
      setMinOrderAmount('');
      setMaxDiscountAmount('');
      setUsageLimit('');
      setStartDate('');
      setEndDate('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDiscount(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError(t('Discount code is required', 'رمز الخصم مطلوب'));
      return;
    }
    if (!discountValue || parseFloat(discountValue) <= 0) {
      setError(t('Valid discount value is required', 'قيمة خصم صحيحة مطلوبة'));
      return;
    }
    if (discountType === 'percentage' && parseFloat(discountValue) > 100) {
      setError(t('Percentage cannot exceed 100%', 'النسبة المئوية لا يمكن أن تتجاوز 100%'));
      return;
    }
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      setError(t('End date must be after start date', 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingDiscount) {
        // When editing, explicitly send null to clear fields
        await updateDiscount(editingDiscount.id, {
          code: code.toUpperCase().trim(),
          name: name.trim() || null,
          name_ar: nameAr.trim() || null,
          discount_type: discountType,
          discount_value: parseFloat(discountValue),
          min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
          max_discount_amount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
          usage_limit: usageLimit ? parseInt(usageLimit) : null,
          start_date: startDate || null,
          end_date: endDate || null,
        } as any);
      } else {
        // When creating, use undefined to skip optional fields
        const data: CreateDiscountData = {
          code: code.toUpperCase().trim(),
          name: name.trim() || undefined,
          name_ar: nameAr.trim() || undefined,
          discount_type: discountType,
          discount_value: parseFloat(discountValue),
          min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : undefined,
          max_discount_amount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : undefined,
          usage_limit: usageLimit ? parseInt(usageLimit) : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        };
        await createDiscount(data);
      }
      handleCloseModal();
      loadDiscounts();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save discount', 'فشل في حفظ الخصم'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (discount: DiscountCode) => {
    try {
      await updateDiscount(discount.id, { is_active: !discount.is_active });
      loadDiscounts();
    } catch (err) {
      console.error('Failed to toggle discount:', err);
    }
  };

  const handleDelete = async (discount: DiscountCode) => {
    if (!confirm(t('Are you sure you want to delete this discount code?', 'هل أنت متأكد من حذف رمز الخصم هذا؟'))) {
      return;
    }
    try {
      await deleteDiscount(discount.id);
      loadDiscounts();
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to delete discount', 'فشل في حذف الخصم'));
    }
  };

  // Filter discounts
  const filteredDiscounts = discounts.filter(d => {
    if (filter === 'active') return d.is_active;
    if (filter === 'inactive') return !d.is_active;
    return true;
  });

  // Check if discount is expired
  const isExpired = (discount: DiscountCode) => {
    if (!discount.end_date) return false;
    return new Date(discount.end_date) < new Date();
  };

  // Check if discount is not yet active
  const isNotYetActive = (discount: DiscountCode) => {
    if (!discount.start_date) return false;
    return new Date(discount.start_date) > new Date();
  };

  return (
    <PageLayout searchPlaceholder={{ en: 'Search discounts...', ar: 'البحث في الخصومات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : ''}>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Discounts', 'الخصومات')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Create and manage discount codes for your POS', 'إنشاء وإدارة رموز الخصم لنقطة البيع')}
            </p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className={`inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('Add Discount', 'إضافة خصم')}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {[
            { key: 'all', label: t('All', 'الكل'), count: discounts.length },
            { key: 'active', label: t('Active', 'نشط'), count: discounts.filter(d => d.is_active).length },
            { key: 'inactive', label: t('Inactive', 'غير نشط'), count: discounts.filter(d => !d.is_active).length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <Percent className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No discount codes yet', 'لا توجد رموز خصم بعد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {t('Create discount codes that customers can use at checkout', 'أنشئ رموز خصم يمكن للعملاء استخدامها عند الدفع')}
            </p>
            <button 
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Add Discount', 'إضافة خصم')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredDiscounts.map((discount) => (
              <motion.div
                key={discount.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${
                  !discount.is_active || isExpired(discount) ? 'opacity-60' : ''
                }`}
              >
                <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      discount.is_active && !isExpired(discount) 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      <Tag className={`w-6 h-6 ${
                        discount.is_active && !isExpired(discount)
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-400'
                      }`} />
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white font-mono">
                          {discount.code}
                        </h3>
                        {!discount.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {t('Inactive', 'غير نشط')}
                          </span>
                        )}
                        {isExpired(discount) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            {t('Expired', 'منتهي')}
                          </span>
                        )}
                        {isNotYetActive(discount) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            {t('Scheduled', 'مجدول')}
                          </span>
                        )}
                      </div>
                      {discount.name && (
                        <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {isRTL ? discount.name_ar || discount.name : discount.name}
                        </p>
                      )}
                      <div className={`flex items-center gap-4 mt-2 text-sm text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Percent className="w-4 h-4" />
                          {discount.discount_type === 'percentage' 
                            ? `${discount.discount_value}%`
                            : `${discount.discount_value.toFixed(3)}`
                          }
                        </span>
                        {discount.usage_limit && (
                          <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Hash className="w-4 h-4" />
                            {discount.used_count}/{discount.usage_limit}
                          </span>
                        )}
                        {(discount.start_date || discount.end_date) && (
                          <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <Calendar className="w-4 h-4" />
                            {discount.start_date && new Date(discount.start_date).toLocaleDateString()}
                            {discount.start_date && discount.end_date && ' - '}
                            {discount.end_date && new Date(discount.end_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <button
                      onClick={() => handleToggleActive(discount)}
                      className={`p-2 rounded-lg transition-colors ${
                        discount.is_active
                          ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                      title={discount.is_active ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل')}
                    >
                      {discount.is_active ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleOpenModal(discount)}
                      className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(discount)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && handleCloseModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingDiscount ? t('Edit Discount', 'تعديل الخصم') : t('Add Discount', 'إضافة خصم')}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                {/* Code */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Discount Code', 'رمز الخصم')} *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={t('e.g., SUMMER20', 'مثال: SUMMER20')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500 font-mono uppercase"
                  />
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Name', 'الاسم')}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('Summer Sale', 'تخفيضات الصيف')}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Arabic Name', 'الاسم بالعربي')}
                    </label>
                    <input
                      type="text"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="تخفيضات الصيف"
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      dir="rtl"
                    />
                  </div>
                </div>

                {/* Discount Type and Value */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Discount Type', 'نوع الخصم')} *
                    </label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    >
                      <option value="percentage">{t('Percentage (%)', 'نسبة مئوية (%)')}</option>
                      <option value="fixed">{t('Fixed Amount', 'مبلغ ثابت')}</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Discount Value', 'قيمة الخصم')} *
                    </label>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'percentage' ? '20' : '5.000'}
                      step={discountType === 'percentage' ? '1' : '0.001'}
                      min="0"
                      max={discountType === 'percentage' ? '100' : undefined}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                {/* Min Order & Max Discount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Min Order Amount', 'الحد الأدنى للطلب')}
                    </label>
                    <input
                      type="number"
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(e.target.value)}
                      placeholder="0.000"
                      step="0.001"
                      min="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Max Discount', 'الحد الأقصى للخصم')}
                    </label>
                    <input
                      type="number"
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(e.target.value)}
                      placeholder={t('No limit', 'بلا حد')}
                      step="0.001"
                      min="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                {/* Usage Limit */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Usage Limit', 'حد الاستخدام')}
                  </label>
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder={t('Unlimited', 'غير محدود')}
                    min="1"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {t('Leave empty for unlimited uses', 'اترك فارغاً للاستخدام غير المحدود')}
                  </p>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('Start Date', 'تاريخ البدء')}
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                      {t('End Date', 'تاريخ الانتهاء')}
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={`flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting 
                    ? t('Saving...', 'جاري الحفظ...') 
                    : editingDiscount 
                      ? t('Update', 'تحديث')
                      : t('Create', 'إنشاء')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
