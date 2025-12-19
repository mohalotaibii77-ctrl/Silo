'use client';

import { useState, useEffect } from 'react';
import { Car, Plus, Edit2, Trash2, Phone, Mail, CheckCircle, XCircle, X, CircleDot } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import api from '@/lib/api';
import { 
  getDrivers, 
  createDriver, 
  updateDriver, 
  deleteDriver,
  updateDriverStatus,
  type Driver,
  type CreateDriverData,
  type DriverStatus
} from '@/lib/drivers-api';

interface Branch {
  id: number;
  name: string;
  name_ar?: string;
  is_main?: boolean;
}

export default function DriversPage() {
  const { t, isRTL } = useLanguage();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DriverStatus>('all');
  
  // Branches state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vehicle types
  const vehicleTypes = [
    { id: 'motorcycle', name: t('Motorcycle', 'دراجة نارية') },
    { id: 'car', name: t('Car', 'سيارة') },
    { id: 'bicycle', name: t('Bicycle', 'دراجة هوائية') },
    { id: 'scooter', name: t('Scooter', 'سكوتر') },
    { id: 'van', name: t('Van', 'فان') },
  ];

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadDrivers();
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

  const loadDrivers = async () => {
    try {
      setIsLoading(true);
      const data = await getDrivers({ branch_id: currentBranch?.id });
      setDrivers(data);
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setName(driver.name);
      setNameAr(driver.name_ar || '');
      setPhone(driver.phone || '');
      setEmail(driver.email || '');
      setVehicleType(driver.vehicle_type || '');
      setVehicleNumber(driver.vehicle_number || '');
      setSelectedBranchId(driver.branch_id || null);
    } else {
      setEditingDriver(null);
      setName('');
      setNameAr('');
      setPhone('');
      setEmail('');
      setVehicleType('');
      setVehicleNumber('');
      setSelectedBranchId(currentBranch?.id || null);
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDriver(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('Driver name is required', 'اسم السائق مطلوب'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingDriver) {
        await updateDriver(editingDriver.id, {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          vehicle_type: vehicleType || undefined,
          vehicle_number: vehicleNumber.trim() || undefined,
          branch_id: selectedBranchId,
        });
      } else {
        const data: CreateDriverData = {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          vehicle_type: vehicleType || undefined,
          vehicle_number: vehicleNumber.trim() || undefined,
          branch_id: selectedBranchId,
        };
        await createDriver(data);
      }
      handleCloseModal();
      loadDrivers();
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save driver', 'فشل في حفظ السائق'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (driver: Driver) => {
    try {
      await updateDriver(driver.id, { is_active: !driver.is_active });
      loadDrivers();
    } catch (err) {
      console.error('Failed to toggle driver status:', err);
    }
  };

  const handleStatusChange = async (driver: Driver, status: DriverStatus) => {
    try {
      await updateDriverStatus(driver.id, status);
      loadDrivers();
    } catch (err) {
      console.error('Failed to update driver status:', err);
    }
  };

  const handleDelete = async (driver: Driver) => {
    if (!confirm(t('Are you sure you want to delete this driver?', 'هل أنت متأكد من حذف هذا السائق؟'))) {
      return;
    }
    try {
      await deleteDriver(driver.id);
      loadDrivers();
    } catch (err: any) {
      alert(err.response?.data?.error || t('Failed to delete driver', 'فشل في حذف السائق'));
    }
  };

  // Filter drivers
  const filteredDrivers = drivers.filter(d => {
    // Active/Inactive filter
    if (filter === 'active' && !d.is_active) return false;
    if (filter === 'inactive' && d.is_active) return false;
    
    // Status filter
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    
    return true;
  });

  const getStatusColor = (status: DriverStatus) => {
    switch (status) {
      case 'available':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30';
      case 'busy':
        return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'offline':
        return 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800';
      default:
        return 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800';
    }
  };

  const getStatusLabel = (status: DriverStatus) => {
    switch (status) {
      case 'available':
        return t('Available', 'متاح');
      case 'busy':
        return t('Busy', 'مشغول');
      case 'offline':
        return t('Offline', 'غير متصل');
      default:
        return status;
    }
  };

  return (
    <PageLayout searchPlaceholder={{ en: 'Search drivers...', ar: 'البحث في السائقين...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Drivers', 'السائقين')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Manage in-house delivery drivers', 'إدارة سائقي التوصيل الداخليين')}
            </p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Add Driver', 'إضافة سائق')}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: t('All', 'الكل'), count: drivers.length },
            { key: 'active', label: t('Active', 'نشط'), count: drivers.filter(d => d.is_active).length },
            { key: 'inactive', label: t('Inactive', 'غير نشط'), count: drivers.filter(d => !d.is_active).length },
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
          
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-2" />
          
          {/* Status filter */}
          {[
            { key: 'all', label: t('All Status', 'كل الحالات') },
            { key: 'available', label: t('Available', 'متاح') },
            { key: 'busy', label: t('Busy', 'مشغول') },
            { key: 'offline', label: t('Offline', 'غير متصل') },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <Car className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No drivers yet', 'لا يوجد سائقين بعد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {t('Add drivers for in-house deliveries', 'أضف سائقين للتوصيل الداخلي')}
            </p>
            <button 
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('Add Driver', 'إضافة سائق')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDrivers.map((driver) => (
              <motion.div
                key={driver.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${
                  !driver.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      driver.status === 'available'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : driver.status === 'busy'
                          ? 'bg-amber-100 dark:bg-amber-900/30'
                          : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      <Car className={`w-6 h-6 ${
                        driver.status === 'available'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : driver.status === 'busy'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-zinc-400'
                      }`} />
                    </div>
                    <div className={isRTL ? 'text-right' : ''}>
                      <h3 className="font-bold text-zinc-900 dark:text-white">
                        {isRTL && driver.name_ar ? driver.name_ar : driver.name}
                      </h3>
                      {driver.vehicle_type && (
                        <span className="text-sm text-zinc-500">
                          {vehicleTypes.find(v => v.id === driver.vehicle_type)?.name || driver.vehicle_type}
                          {driver.vehicle_number && ` • ${driver.vehicle_number}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(driver.status)}`}>
                    {getStatusLabel(driver.status)}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="mt-4 space-y-2">
                  {driver.phone && (
                    <div className={`flex items-center gap-2 text-sm text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Phone className="w-4 h-4" />
                      <span dir="ltr">{driver.phone}</span>
                    </div>
                  )}
                  {driver.email && (
                    <div className={`flex items-center gap-2 text-sm text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Mail className="w-4 h-4" />
                      <span>{driver.email}</span>
                    </div>
                  )}
                </div>

                {/* Branch assignment */}
                {driver.branch_id ? (
                  <div className={`mt-3 text-xs text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {t('Assigned to:', 'معين لـ:')} {branches.find(b => b.id === driver.branch_id)?.name || `Branch #${driver.branch_id}`}
                  </div>
                ) : (
                  <div className={`mt-3 text-xs text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {t('Available for all branches', 'متاح لجميع الفروع')}
                  </div>
                )}

                {/* Quick Status Change */}
                {driver.is_active && (
                  <div className={`flex items-center gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs text-zinc-400">{t('Status:', 'الحالة:')}</span>
                    {(['available', 'busy', 'offline'] as DriverStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(driver, status)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          driver.status === status
                            ? getStatusColor(status)
                            : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                        title={getStatusLabel(status)}
                      >
                        <CircleDot className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className={`flex items-center justify-end gap-1 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => handleToggleActive(driver)}
                    className={`p-2 rounded-lg transition-colors ${
                      driver.is_active
                        ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                    title={driver.is_active ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل')}
                  >
                    {driver.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleOpenModal(driver)}
                    className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(driver)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl max-h-[90vh] overflow-y-auto"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingDriver ? t('Edit Driver', 'تعديل السائق') : t('Add Driver', 'إضافة سائق')}
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

                {/* Name */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Name (English)', 'الاسم (إنجليزي)')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('Driver name', 'اسم السائق')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Name Arabic */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Name (Arabic)', 'الاسم (عربي)')}
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder={t('Arabic name', 'الاسم بالعربية')}
                    dir="rtl"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Phone Number', 'رقم الهاتف')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+965 XXXX XXXX"
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Email', 'البريد الإلكتروني')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="driver@example.com"
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Vehicle Type */}
                <SearchableSelect
                  label={t('Vehicle Type', 'نوع المركبة')}
                  value={vehicleType}
                  onChange={(val) => setVehicleType(val || '')}
                  options={vehicleTypes}
                  placeholder={t('Select vehicle type', 'اختر نوع المركبة')}
                  allowCustom
                />

                {/* Vehicle Number */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Vehicle Number', 'رقم المركبة')}
                  </label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder={t('License plate', 'لوحة الترخيص')}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>

                {/* Branch Assignment */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Assign to Branch', 'تعيين للفرع')}
                  </label>
                  <select
                    value={selectedBranchId ?? ''}
                    onChange={(e) => setSelectedBranchId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  >
                    <option value="">{t('All Branches (No Restriction)', 'جميع الفروع (بدون قيود)')}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {isRTL && branch.name_ar ? branch.name_ar : branch.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {t('Leave empty to make driver available for all branches', 'اتركه فارغاً لجعل السائق متاحاً لجميع الفروع')}
                  </p>
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
                    : editingDriver 
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

