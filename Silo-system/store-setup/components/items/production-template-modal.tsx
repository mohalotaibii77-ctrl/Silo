'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Loader2 } from 'lucide-react';
import { Item, getItems, ProductionTemplate } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';
import { SearchableSelect } from '@/components/ui/searchable-select';

// Re-export for convenience
export type { ProductionTemplate } from '@/lib/items-api';

interface ProductionTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editTemplate?: ProductionTemplate | null;
}

export function ProductionTemplateModal({ isOpen, onClose, onSuccess, editTemplate }: ProductionTemplateModalProps) {
  const { isRTL, t } = useLanguage();
  
  const [compositeItems, setCompositeItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [defaultBatchCount, setDefaultBatchCount] = useState(1);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCompositeItems();
      
      if (editTemplate) {
        setSelectedItemId(editTemplate.composite_item_id);
        setName(editTemplate.name);
        setNameAr(editTemplate.name_ar || '');
        setDefaultBatchCount(editTemplate.default_batch_count);
      } else {
        setSelectedItemId(null);
        setName('');
        setNameAr('');
        setDefaultBatchCount(1);
      }
      setError('');
    }
  }, [isOpen, editTemplate]);

  const fetchCompositeItems = async () => {
    setLoading(true);
    try {
      const items = await getItems();
      const composite = items.filter(item => item.is_composite);
      setCompositeItems(composite);
    } catch (err) {
      console.error('Failed to fetch composite items:', err);
      setError(t('Failed to load composite items', 'فشل في تحميل المواد المركبة'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedItemId) {
      setError(t('Please select a composite item', 'يرجى اختيار مادة مركبة'));
      return;
    }

    if (!name.trim()) {
      setError(t('Please enter a template name', 'يرجى إدخال اسم القالب'));
      return;
    }

    // Ensure batch count is at least 1
    const batchCount = Math.max(1, defaultBatchCount || 1);

    setSubmitting(true);
    setError('');

    try {
      const storedBusiness = localStorage.getItem('setup_business');
      if (!storedBusiness) throw new Error('No business selected');
      const business = JSON.parse(storedBusiness);

      const { default: api } = await import('@/lib/api');
      
      if (editTemplate) {
        await api.put(`/inventory/production/templates/${editTemplate.id}`, {
          business_id: business.id,
          composite_item_id: selectedItemId,
          name: name.trim(),
          name_ar: nameAr.trim() || null,
          default_batch_count: batchCount,
        });
      } else {
        await api.post('/inventory/production/templates', {
          business_id: business.id,
          composite_item_id: selectedItemId,
          name: name.trim(),
          name_ar: nameAr.trim() || null,
          default_batch_count: batchCount,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to save template:', err);
      setError(err.response?.data?.error || err.message || t('Failed to save template', 'فشل في حفظ القالب'));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = compositeItems.find(i => i.id === selectedItemId);

  // Auto-fill name when item is selected (only for new templates)
  useEffect(() => {
    if (selectedItem && !editTemplate && !name) {
      const itemName = isRTL && selectedItem.name_ar ? selectedItem.name_ar : selectedItem.name;
      setName(itemName);
      if (selectedItem.name_ar) setNameAr(selectedItem.name_ar);
    }
  }, [selectedItem, editTemplate, isRTL]);

  if (!isOpen) return null;

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
          className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl mx-4"
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
                  {editTemplate ? t('Edit Template', 'تعديل القالب') : t('New Production Template', 'قالب إنتاج جديد')}
                </h2>
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
          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Select Composite Item */}
            <div>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : compositeItems.length === 0 ? (
                <>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Composite Item', 'المادة المركبة')} *
                  </label>
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-center">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {t('No composite items found. Create one first.', 'لم يتم العثور على مواد مركبة.')}
                    </p>
                  </div>
                </>
              ) : (
                <SearchableSelect
                  label={`${t('Composite Item', 'المادة المركبة')} *`}
                  value={selectedItemId}
                  onChange={(value) => setSelectedItemId(value)}
                  options={compositeItems.map(item => ({
                    id: item.id,
                    name: isRTL && item.name_ar ? item.name_ar : item.name,
                    secondaryText: item.sku || undefined,
                  }))}
                  placeholder={t('Select composite item...', 'اختر المادة المركبة...')}
                />
              )}
            </div>

            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t('Template Name', 'اسم القالب')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('e.g., Daily Sauce Production', 'مثال: إنتاج الصلصة اليومي')}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
              />
            </div>

            {/* Template Name Arabic */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t('Template Name (Arabic)', 'اسم القالب (عربي)')}
              </label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder={t('Optional', 'اختياري')}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                dir="rtl"
              />
            </div>

            {/* Default Batch Count */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t('Default Batch Count', 'عدد الدفعات الافتراضي')}
              </label>
              <input
                type="number"
                min="1"
                value={defaultBatchCount || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setDefaultBatchCount(0); // Allow empty temporarily
                  } else {
                    setDefaultBatchCount(parseInt(val) || 0);
                  }
                }}
                onBlur={(e) => {
                  // Enforce minimum on blur
                  if (!defaultBatchCount || defaultBatchCount < 1) {
                    setDefaultBatchCount(1);
                  }
                }}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
              />
              {selectedItem && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('Each batch produces:', 'كل دفعة تنتج:')} {selectedItem.batch_quantity || 1} {selectedItem.batch_unit || selectedItem.unit}
                </p>
              )}
            </div>
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
              onClick={handleSubmit}
              disabled={!selectedItemId || !name.trim() || submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {editTemplate ? t('Save Changes', 'حفظ التغييرات') : t('Create Template', 'إنشاء القالب')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

