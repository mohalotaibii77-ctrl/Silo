'use client';

import { useState, useEffect } from 'react';
import { FolderTree, Plus, Edit2, Trash2, Globe, Building2, GripVertical, X, Search } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { getCategories, createCategory, updateCategory, deleteCategory, type Category } from '@/lib/categories-api';

export default function CategoriesPage() {
  const { t, isRTL } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [filter, setFilter] = useState<'all' | 'system' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setNameAr(category.name_ar || '');
      setDescription(category.description || '');
    } else {
      setEditingCategory(null);
      setName('');
      setNameAr('');
      setDescription('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setName('');
    setNameAr('');
    setDescription('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('Category name is required', 'اسم الفئة مطلوب'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          description: description.trim() || undefined,
        });
      } else {
        await createCategory({
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          description: description.trim() || undefined,
        });
      }
      handleCloseModal();
      loadCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save category', 'فشل في حفظ الفئة'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (category.is_system) {
      alert(t('Cannot delete system categories', 'لا يمكن حذف الفئات الأساسية'));
      return;
    }

    if (!confirm(t('Are you sure you want to delete this category?', 'هل أنت متأكد من حذف هذه الفئة؟'))) {
      return;
    }

    try {
      await deleteCategory(category.id);
      loadCategories();
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to delete category', 'فشل في حذف الفئة'));
    }
  };

  // Filter categories
  const filteredCategories = categories.filter(cat => {
    // Filter by type
    if (filter === 'system' && !cat.is_system) return false;
    if (filter === 'custom' && cat.is_system) return false;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        cat.name.toLowerCase().includes(query) ||
        cat.name_ar?.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const systemCategories = filteredCategories.filter(c => c.is_system);
  const customCategories = filteredCategories.filter(c => !c.is_system);

  return (
    <PageLayout searchPlaceholder={{ en: 'Search categories...', ar: 'البحث في الفئات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : ''}>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Categories', 'الفئات')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Organize your menu structure', 'تنظيم هيكل القائمة')}
            </p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className={`inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('Add Category', 'إضافة فئة')}
          </button>
        </div>

        {/* Filter Tabs & Search */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {[
              { key: 'all', label: t('All', 'الكل'), count: categories.length },
              { key: 'system', label: t('General', 'عامة'), count: categories.filter(c => c.is_system).length },
              { key: 'custom', label: t('Custom', 'مخصصة'), count: categories.filter(c => !c.is_system).length },
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
          
          {/* Search */}
          <div className="relative">
            <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search categories...', 'البحث عن فئات...')}
              className={`${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 w-64 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <FolderTree className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No categories yet', 'لا توجد فئات بعد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {t('Get started by creating your first category', 'ابدأ بإنشاء أول فئة')}
            </p>
            <button 
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Add Category', 'إضافة فئة')}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* System (General) Categories */}
            {(filter === 'all' || filter === 'system') && systemCategories.length > 0 && (
              <div>
                <div className={`flex items-center gap-2 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Globe className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {t('General Categories', 'الفئات العامة')}
                  </h3>
                  <span className="text-xs text-zinc-400">({systemCategories.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {systemCategories.map((category) => (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow"
                    >
                      <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={isRTL ? 'text-right' : ''}>
                          <h4 className="font-medium text-zinc-900 dark:text-white">
                            {isRTL ? category.name_ar || category.name : category.name}
                          </h4>
                          {!isRTL && category.name_ar && (
                            <p className="text-xs text-zinc-500 mt-0.5" dir="rtl">{category.name_ar}</p>
                          )}
                          {isRTL && category.name !== category.name_ar && (
                            <p className="text-xs text-zinc-500 mt-0.5">{category.name}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {t('General', 'عامة')}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom (Business) Categories */}
            {(filter === 'all' || filter === 'custom') && customCategories.length > 0 && (
              <div>
                <div className={`flex items-center gap-2 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Building2 className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {t('Custom Categories', 'فئات مخصصة')}
                  </h3>
                  <span className="text-xs text-zinc-400">({customCategories.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {customCategories.map((category) => (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow group"
                    >
                      <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                          <h4 className="font-medium text-zinc-900 dark:text-white truncate">
                            {isRTL ? category.name_ar || category.name : category.name}
                          </h4>
                          {category.description && (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">{category.description}</p>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <button
                            onClick={() => handleOpenModal(category)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(category)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty custom categories message */}
            {(filter === 'all' || filter === 'custom') && customCategories.length === 0 && filter !== 'system' && (
              <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-dashed border-zinc-300 dark:border-zinc-700 text-center">
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                  {t('No custom categories yet. Create your own categories specific to your business.', 'لا توجد فئات مخصصة بعد. أنشئ فئاتك الخاصة بنشاطك التجاري.')}
                </p>
              </div>
            )}
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
              className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingCategory ? t('Edit Category', 'تعديل الفئة') : t('Add Category', 'إضافة فئة')}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Category Name', 'اسم الفئة')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('e.g., Signature Dishes', 'مثال: الأطباق المميزة')}
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
                    placeholder={t('Enter Arabic name', 'أدخل الاسم بالعربي')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    dir="rtl"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Description', 'الوصف')}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('Optional description...', 'وصف اختياري...')}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
                  />
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
                    : editingCategory 
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
