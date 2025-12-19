'use client';

import { useState, useEffect } from 'react';
import { Armchair, Plus, Edit2, Trash2, Users, Hash, MapPin, CheckCircle, XCircle, X } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import api from '@/lib/api';
import { 
  getTables, 
  createTable, 
  updateTable, 
  deleteTable, 
  type RestaurantTable,
  type CreateTableData
} from '@/lib/tables-api';

interface Branch {
  id: number;
  name: string;
  name_ar?: string;
  is_main?: boolean;
}

export default function TablesPage() {
  const { t, isRTL } = useLanguage();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Branches state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);

  // Form state
  const [tableNumber, setTableNumber] = useState('');
  const [tableCode, setTableCode] = useState('');
  const [seats, setSeats] = useState('2');
  const [zone, setZone] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common zones
  const commonZones = [
    { id: 'indoor', name: t('Indoor', 'داخلي') },
    { id: 'outdoor', name: t('Outdoor', 'خارجي') },
    { id: 'patio', name: t('Patio', 'فناء') },
    { id: 'vip', name: t('VIP', 'VIP') },
    { id: 'private', name: t('Private', 'خاص') },
    { id: 'terrace', name: t('Terrace', 'شرفة') },
  ];

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (currentBranch) {
      loadTables();
    }
  }, [currentBranch]);

  const loadBranches = async () => {
    try {
      const storedBusiness = localStorage.getItem('setup_business');
      const storedBranch = localStorage.getItem('setup_branch');
      
      if (storedBusiness) {
        const business = JSON.parse(storedBusiness);
        if (business.id) {
          const response = await api.get(`/businesses/${business.id}/branches`);
          if (response.data.branches && response.data.branches.length > 0) {
            setBranches(response.data.branches);
            
            if (storedBranch) {
              setCurrentBranch(JSON.parse(storedBranch));
            } else {
              const mainBranch = response.data.branches.find((b: Branch) => b.is_main) || response.data.branches[0];
              setCurrentBranch(mainBranch);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const loadTables = async () => {
    if (!currentBranch) return;
    
    try {
      setIsLoading(true);
      const data = await getTables({ branch_id: currentBranch.id });
      setTables(data);
    } catch (err) {
      console.error('Failed to load tables:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (table?: RestaurantTable) => {
    if (table) {
      setEditingTable(table);
      setTableNumber(table.table_number);
      setTableCode(table.table_code || '');
      setSeats(table.seats.toString());
      setZone(table.zone || '');
      setDescription(table.description || '');
    } else {
      setEditingTable(null);
      setTableNumber('');
      setTableCode('');
      setSeats('2');
      setZone('');
      setDescription('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTable(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!tableNumber.trim()) {
      setError(t('Table number is required', 'رقم الطاولة مطلوب'));
      return;
    }
    if (!seats || parseInt(seats) < 1) {
      setError(t('Number of seats must be at least 1', 'عدد المقاعد يجب أن يكون 1 على الأقل'));
      return;
    }
    if (!currentBranch) {
      setError(t('Branch is required', 'الفرع مطلوب'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingTable) {
        await updateTable(editingTable.id, {
          table_number: tableNumber.trim(),
          table_code: tableCode.trim() || undefined,
          seats: parseInt(seats),
          zone: zone || undefined,
          description: description.trim() || undefined,
        });
      } else {
        const data: CreateTableData = {
          table_number: tableNumber.trim(),
          table_code: tableCode.trim() || undefined,
          seats: parseInt(seats),
          zone: zone || undefined,
          description: description.trim() || undefined,
          branch_id: currentBranch.id,
        };
        await createTable(data);
      }
      handleCloseModal();
      loadTables();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save table', 'فشل في حفظ الطاولة'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (table: RestaurantTable) => {
    try {
      await updateTable(table.id, { is_active: !table.is_active });
      loadTables();
    } catch (err) {
      console.error('Failed to toggle table status:', err);
    }
  };

  const handleDelete = async (table: RestaurantTable) => {
    if (!confirm(t('Are you sure you want to delete this table?', 'هل أنت متأكد من حذف هذه الطاولة؟'))) {
      return;
    }
    try {
      await deleteTable(table.id);
      loadTables();
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to delete table', 'فشل في حذف الطاولة'));
    }
  };

  // Filter tables
  const filteredTables = tables.filter(t => {
    if (filter === 'active') return t.is_active;
    if (filter === 'inactive') return !t.is_active;
    return true;
  });

  // Group tables by zone
  const tablesByZone = filteredTables.reduce((acc, table) => {
    const zoneKey = table.zone || t('No Zone', 'بدون منطقة');
    if (!acc[zoneKey]) acc[zoneKey] = [];
    acc[zoneKey].push(table);
    return acc;
  }, {} as Record<string, RestaurantTable[]>);

  return (
    <PageLayout searchPlaceholder={{ en: 'Search tables...', ar: 'البحث في الطاولات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Tables', 'الطاولات')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Manage dine-in tables for your restaurant', 'إدارة طاولات الطعام في مطعمك')}
            </p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Add Table', 'إضافة طاولة')}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: t('All', 'الكل'), count: tables.length },
            { key: 'active', label: t('Active', 'نشط'), count: tables.filter(t => t.is_active).length },
            { key: 'inactive', label: t('Inactive', 'غير نشط'), count: tables.filter(t => !t.is_active).length },
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
        ) : filteredTables.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <Armchair className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No tables yet', 'لا توجد طاولات بعد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {t('Add tables for dine-in seating', 'أضف طاولات للجلوس في المطعم')}
            </p>
            <button 
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Add Table', 'إضافة طاولة')}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(tablesByZone).map(([zoneName, zoneTables]) => (
              <div key={zoneName}>
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {zoneName}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {zoneTables.map((table) => (
                    <motion.div
                      key={table.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${
                        !table.is_active ? 'opacity-60' : ''
                      } ${table.is_occupied ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}
                    >
                      <div className={`flex items-start justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            table.is_occupied 
                              ? 'bg-amber-100 dark:bg-amber-900/30' 
                              : table.is_active
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : 'bg-zinc-100 dark:bg-zinc-800'
                          }`}>
                            <Armchair className={`w-6 h-6 ${
                              table.is_occupied
                                ? 'text-amber-600 dark:text-amber-400'
                                : table.is_active
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-zinc-400'
                            }`} />
                          </div>
                          <div className={isRTL ? 'text-right' : ''}>
                            <h3 className="font-bold text-zinc-900 dark:text-white text-lg">
                              {table.table_number}
                            </h3>
                            <div className={`flex items-center gap-1 text-sm text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <Users className="w-3.5 h-3.5" />
                              <span>{table.seats} {t('seats', 'مقاعد')}</span>
                            </div>
                          </div>
                        </div>
                        {table.is_occupied && (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            {t('Occupied', 'مشغول')}
                          </span>
                        )}
                      </div>

                      {table.table_code && (
                        <div className={`mt-2 text-xs text-zinc-400 flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Hash className="w-3 h-3" />
                          {table.table_code}
                        </div>
                      )}

                      {table.description && (
                        <p className={`mt-2 text-xs text-zinc-500 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                          {table.description}
                        </p>
                      )}

                      {/* Actions */}
                      <div className={`flex items-center justify-end gap-1 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <button
                          onClick={() => handleToggleActive(table)}
                          className={`p-2 rounded-lg transition-colors ${
                            table.is_active
                              ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          }`}
                          title={table.is_active ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل')}
                        >
                          {table.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleOpenModal(table)}
                          className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(table)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
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
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingTable ? t('Edit Table', 'تعديل الطاولة') : t('Add Table', 'إضافة طاولة')}
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

                {/* Table Number */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Table Number/Code', 'رقم/كود الطاولة')} *
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder={t('e.g., T1, A5, VIP-1', 'مثال: T1، A5، VIP-1')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Seats */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Number of Seats', 'عدد المقاعد')} *
                  </label>
                  <input
                    type="number"
                    value={seats}
                    onChange={(e) => {
                      // Only allow whole numbers
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setSeats(value);
                    }}
                    onKeyDown={(e) => {
                      // Prevent decimal point and minus sign
                      if (e.key === '.' || e.key === '-' || e.key === 'e') {
                        e.preventDefault();
                      }
                    }}
                    min="1"
                    max="50"
                    step="1"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Zone */}
                <SearchableSelect
                  label={t('Zone/Area', 'المنطقة')}
                  value={zone}
                  onChange={(val) => setZone(val || '')}
                  options={commonZones}
                  placeholder={t('Select or type zone', 'اختر أو اكتب المنطقة')}
                  allowCustom
                />

                {/* QR Code (optional) */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('QR/Barcode', 'كود QR/الباركود')}
                  </label>
                  <input
                    type="text"
                    value={tableCode}
                    onChange={(e) => setTableCode(e.target.value)}
                    placeholder={t('Optional unique identifier', 'معرّف فريد اختياري')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Description', 'الوصف')}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('e.g., Near window, corner table', 'مثال: بجانب النافذة، طاولة زاوية')}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-2xl">
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
                    : editingTable 
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

