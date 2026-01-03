'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Command, ArrowLeft, Save, Loader2, Clock, Hash, Bell, Timer, Monitor, ScanLine, ChefHat, DollarSign, Users, MapPin, Calendar, UserCog, Check, Trash2 } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language-context';
import dynamic from 'next/dynamic';

// Dynamically import MapPicker to avoid SSR issues
const MapPicker = dynamic(() => import('@/components/map-picker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
    </div>
  ),
});

interface Business {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
}

interface OperationalSettings {
  order_number_prefix: string;
  auto_accept_orders: boolean;
  order_preparation_time: number;
  enable_order_notifications: boolean;
  kitchen_display_auto_clear: number;
  kitchen_operation_mode: 'display' | 'receipt_scan';
  require_customer_phone: boolean;
  allow_order_notes: boolean;
  opening_time: string;
  closing_time: string;
  // POS Operation settings
  pos_opening_float_fixed: boolean;
  pos_opening_float_amount: number;
  pos_session_allowed_user_ids: number[];
  // Working days and GPS check-in settings
  working_days: string[];
  require_gps_checkin: boolean;
  geofence_radius_meters: number;
  checkin_buffer_minutes_before: number;
  checkin_buffer_minutes_after: number;
  gps_accuracy_threshold_meters: number;
  // Checkout restriction settings
  require_checkout_restrictions: boolean;
  min_shift_hours: number;
  checkout_buffer_minutes_before: number;
}

const defaultSettings: OperationalSettings = {
  order_number_prefix: 'ORD',
  auto_accept_orders: false,
  order_preparation_time: 15,
  enable_order_notifications: true,
  kitchen_display_auto_clear: 30,
  kitchen_operation_mode: 'display',
  require_customer_phone: false,
  allow_order_notes: true,
  opening_time: '09:00',
  closing_time: '22:00',
  // POS Operation settings
  pos_opening_float_fixed: false,
  pos_opening_float_amount: 0,
  pos_session_allowed_user_ids: [],
  // Working days and GPS check-in settings
  working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  require_gps_checkin: false,
  geofence_radius_meters: 100,
  checkin_buffer_minutes_before: 15,
  checkin_buffer_minutes_after: 30,
  gps_accuracy_threshold_meters: 50,
  // Checkout restriction settings
  require_checkout_restrictions: true,
  min_shift_hours: 4,
  checkout_buffer_minutes_before: 30,
};

interface POSUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface Branch {
  id: number;
  name: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
  geofence_enabled: boolean;
}

interface Employee {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface ScheduleOverride {
  id?: number;
  employee_id: number;
  working_days: string[] | null;
  opening_time: string | null;
  closing_time: string | null;
  checkin_buffer_minutes_before: number | null;
  checkin_buffer_minutes_after: number | null;
  is_active: boolean;
  notes: string | null;
}

export default function OperationalSettingsPage() {
  const router = useRouter();
  const { isRTL, t } = useLanguage();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [settings, setSettings] = useState<OperationalSettings>(defaultSettings);
  const [posUsers, setPosUsers] = useState<POSUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [savingBranch, setSavingBranch] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [currentBranchId, setCurrentBranchId] = useState<number | null>(null); // Auto-loaded from localStorage
  const [currentBranchName, setCurrentBranchName] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');

    if (!token || !storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== 'owner' && parsedUser.role !== 'manager') {
        router.push('/login');
        return;
      }

      // Load current branch from localStorage (set by sidebar/page-layout when user selects a branch)
      // IMPORTANT: Pass branchId synchronously to fetchData to avoid race condition
      let branchId: number | null = null;
      const storedBranch = localStorage.getItem('setup_branch');
      if (storedBranch) {
        try {
          const branch = JSON.parse(storedBranch);
          branchId = branch.id;
          setCurrentBranchId(branch.id);
          setCurrentBranchName(branch.name);
        } catch {}
      }

      fetchData(branchId);
    } catch {
      router.push('/login');
      return;
    }
  }, [router]);

  // Refetch settings when branch changes
  useEffect(() => {
    if (!loading && branches.length > 0) {
      fetchSettingsForBranch(currentBranchId);
    }
  }, [currentBranchId]);

  // Fetch only operational settings for a specific branch (without refetching everything)
  const fetchSettingsForBranch = async (branchId: number | null) => {
    try {
      const operationalUrl = branchId
        ? `/business-settings/operational?branch_id=${branchId}`
        : '/business-settings/operational';

      const res = await api.get(operationalUrl);
      if (res.data.data) {
        setSettings({ ...defaultSettings, ...res.data.data });
      }
    } catch (err) {
      console.error('Failed to fetch branch settings:', err);
    }
  };

  const fetchData = async (branchId: number | null = null) => {
    try {
      // Build operational settings URL with optional branch_id
      const operationalUrl = branchId
        ? `/business-settings/operational?branch_id=${branchId}`
        : '/business-settings/operational';

      // Add .catch() to ALL endpoints to identify which one is failing
      const [businessRes, settingsRes, posEmployeesRes, branchesRes, employeesRes, overridesRes] = await Promise.all([
        api.get('/business-settings').catch((err) => {
          console.error('Failed to fetch business settings:', err.response?.status, err.response?.data || err.message);
          return { data: { data: null } };
        }),
        api.get(operationalUrl).catch((err) => {
          console.error('Failed to fetch operational settings:', err.response?.status, err.response?.data || err.message);
          return { data: { data: null, is_branch_default: false } };
        }),
        api.get('/pos-sessions/employees').catch((err) => {
          console.warn('Failed to fetch POS employees:', err.response?.data?.error || err.message);
          return { data: { data: [] } };
        }),
        api.get('/business-settings/branches/geofence').catch((err) => {
          console.warn('Failed to fetch branches geofence:', err.response?.data?.error || err.message);
          return { data: { data: [] } };
        }),
        api.get('/business-users').catch((err) => {
          console.warn('Failed to fetch business users:', err.response?.data?.error || err.message);
          return { data: { data: [] } };
        }),
        api.get('/hr/schedule-overrides').catch((err) => {
          console.warn('Failed to fetch schedule overrides:', err.response?.data?.error || err.message);
          return { data: { data: [] } };
        }),
      ]);

      if (businessRes.data.data) {
        setBusiness(businessRes.data.data);
      }

      if (settingsRes.data.data) {
        setSettings({ ...defaultSettings, ...settingsRes.data.data });
      }

      if (posEmployeesRes.data.data) {
        setPosUsers(posEmployeesRes.data.data);
      }

      if (branchesRes.data.data) {
        setBranches(branchesRes.data.data);

        // Auto-select main branch if no branch is currently selected
        if (!currentBranchId && branchesRes.data.data.length > 0) {
          // Try to find main branch or use first one
          const branches = branchesRes.data.data;
          const mainBranch = branches.find((b: Branch) => b.name?.toLowerCase().includes('main')) || branches[0];
          if (mainBranch) {
            setCurrentBranchId(mainBranch.id);
            setCurrentBranchName(mainBranch.name);
            // Save to localStorage for consistency
            localStorage.setItem('setup_branch', JSON.stringify({ id: mainBranch.id, name: mainBranch.name }));
          }
        }
      }

      if (employeesRes.data.data) {
        // Filter to only show employees (not owners)
        setEmployees(employeesRes.data.data.filter((u: Employee) =>
          u.role !== 'owner' && u.role !== 'super_admin'
        ));
      }

      if (overridesRes.data.data) {
        setScheduleOverrides(overridesRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      // Fallback to localStorage for business
      const storedBusiness = localStorage.getItem('setup_business');
      if (storedBusiness) {
        setBusiness(JSON.parse(storedBusiness));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('setup_token');
    localStorage.removeItem('setup_user');
    localStorage.removeItem('setup_business');
    router.push('/login');
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // Include branch_id if in a specific branch context
      const dataToSave = currentBranchId
        ? { ...settings, branch_id: currentBranchId }
        : settings;

      await api.put('/business-settings/operational', dataToSave);

      const successMsg = currentBranchName
        ? t(`Settings saved for ${currentBranchName}!`, `تم حفظ إعدادات ${currentBranchName} بنجاح!`)
        : t('Business settings saved successfully!', 'تم حفظ إعدادات العمل بنجاح!');

      setMessage({ type: 'success', text: successMsg });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('Failed to save settings', 'فشل في حفظ الإعدادات') });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof OperationalSettings>(key: K, value: OperationalSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleUserForPOSSession = (userId: number) => {
    setSettings(prev => {
      const currentIds = prev.pos_session_allowed_user_ids || [];
      const isSelected = currentIds.includes(userId);

      return {
        ...prev,
        pos_session_allowed_user_ids: isSelected
          ? currentIds.filter(id => id !== userId)
          : [...currentIds, userId]
      };
    });
  };

  // Update branch geofence locally
  const updateBranch = (branchId: number, field: keyof Branch, value: any) => {
    setBranches(prev => prev.map(b =>
      b.id === branchId ? { ...b, [field]: value } : b
    ));
  };

  // Save branch geofence settings
  const saveBranchGeofence = async (branchId: number) => {
    setSavingBranch(true);
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;

    try {
      await api.put(`/business-settings/branches/${branchId}/geofence`, {
        latitude: branch.latitude,
        longitude: branch.longitude,
        geofence_radius_meters: branch.geofence_radius_meters,
        geofence_enabled: branch.geofence_enabled,
      });
      setEditingBranchId(null);
      setMessage({ type: 'success', text: t('Branch geofence saved!', 'تم حفظ السياج الجغرافي للفرع!') });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('Failed to save branch geofence', 'فشل في حفظ السياج الجغرافي') });
    } finally {
      setSavingBranch(false);
    }
  };

  // Get schedule override for an employee
  const getOverrideForEmployee = (employeeId: number): ScheduleOverride | undefined => {
    return scheduleOverrides.find(o => o.employee_id === employeeId);
  };

  // Update schedule override locally
  const updateOverride = (employeeId: number, field: keyof ScheduleOverride, value: any) => {
    setScheduleOverrides(prev => {
      const existing = prev.find(o => o.employee_id === employeeId);
      if (existing) {
        return prev.map(o => o.employee_id === employeeId ? { ...o, [field]: value } : o);
      } else {
        // Create new override
        return [...prev, {
          employee_id: employeeId,
          working_days: null,
          opening_time: null,
          closing_time: null,
          checkin_buffer_minutes_before: null,
          checkin_buffer_minutes_after: null,
          is_active: true,
          notes: null,
          [field]: value,
        }];
      }
    });
  };

  // Save employee schedule override
  const saveScheduleOverride = async (employeeId: number) => {
    setSavingOverride(true);
    const override = getOverrideForEmployee(employeeId);

    try {
      await api.put(`/hr/schedule-overrides/${employeeId}`, override || {
        working_days: null,
        opening_time: null,
        closing_time: null,
        checkin_buffer_minutes_before: null,
        checkin_buffer_minutes_after: null,
        is_active: true,
        notes: null,
      });
      setEditingEmployeeId(null);
      setMessage({ type: 'success', text: t('Employee schedule saved!', 'تم حفظ جدول الموظف!') });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('Failed to save schedule', 'فشل في حفظ الجدول') });
    } finally {
      setSavingOverride(false);
    }
  };

  // Delete employee schedule override
  const deleteScheduleOverride = async (employeeId: number) => {
    try {
      await api.delete(`/hr/schedule-overrides/${employeeId}`);
      setScheduleOverrides(prev => prev.filter(o => o.employee_id !== employeeId));
      setEditingEmployeeId(null);
      setMessage({ type: 'success', text: t('Override removed, using business defaults', 'تم إزالة التخصيص، يستخدم الإعدادات الافتراضية') });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('Failed to remove override', 'فشل في إزالة التخصيص') });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Command className="w-8 h-8 animate-spin text-zinc-900 dark:text-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <Suspense fallback={<div className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hidden md:block" />}>
        <Sidebar business={business} />
      </Suspense>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/settings')}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            >
              <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
            <h1 className="font-semibold text-zinc-900 dark:text-white">{t('Operational Settings', 'إعدادات التشغيل')}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <ModeToggle />
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <User size={16} className="text-zinc-600 dark:text-zinc-400" />
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-500 hover:text-red-600">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto space-y-6"
          >
            {message.text && (
              <div className={`p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                {message.text}
              </div>
            )}

            {/* Order Settings */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Hash className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{t('Order Settings', 'إعدادات الطلبات')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Configure order numbering and handling', 'إعداد ترقيم الطلبات والتعامل معها')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Order Number Prefix', 'بادئة رقم الطلب')}
                </label>
                <input
                  type="text"
                  value={settings.order_number_prefix}
                  onChange={(e) => updateSetting('order_number_prefix', e.target.value)}
                  placeholder="ORD"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('Example: ORD-001, ORD-002...', 'مثال: ORD-001, ORD-002...')}
                </p>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{t('Auto-accept Orders', 'قبول الطلبات تلقائياً')}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Automatically accept incoming orders', 'قبول الطلبات الواردة تلقائياً')}</p>
                </div>
                <button
                  onClick={() => updateSetting('auto_accept_orders', !settings.auto_accept_orders)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.auto_accept_orders ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.auto_accept_orders ? (isRTL ? 'right-6' : 'left-6') : (isRTL ? 'right-1' : 'left-1')
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{t('Require Customer Phone', 'طلب رقم هاتف العميل')}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Phone number is required for orders', 'رقم الهاتف مطلوب للطلبات')}</p>
                </div>
                <button
                  onClick={() => updateSetting('require_customer_phone', !settings.require_customer_phone)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.require_customer_phone ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.require_customer_phone ? (isRTL ? 'right-6' : 'left-6') : (isRTL ? 'right-1' : 'left-1')
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{t('Allow Order Notes', 'السماح بملاحظات الطلب')}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Customers can add notes to orders', 'يمكن للعملاء إضافة ملاحظات للطلبات')}</p>
                </div>
                <button
                  onClick={() => updateSetting('allow_order_notes', !settings.allow_order_notes)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.allow_order_notes ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.allow_order_notes ? (isRTL ? 'right-6' : 'left-6') : (isRTL ? 'right-1' : 'left-1')
                  }`} />
                </button>
              </div>
            </div>

            {/* Timing Settings */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{t('Timing Settings', 'إعدادات التوقيت')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Configure preparation times and auto-clear', 'إعداد أوقات التحضير والمسح التلقائي')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Default Preparation Time (minutes)', 'وقت التحضير الافتراضي (دقائق)')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={settings.order_preparation_time}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      updateSetting('order_preparation_time', val === '' ? 15 : parseInt(val));
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Kitchen Display Auto-clear (minutes)', 'مسح شاشة المطبخ تلقائياً (دقائق)')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={settings.kitchen_display_auto_clear}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      updateSetting('kitchen_display_auto_clear', val === '' ? 30 : parseInt(val));
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-2 focus:ring-zinc-500/20 outline-none"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('Completed orders will be cleared from kitchen display after this time', 'سيتم مسح الطلبات المكتملة من شاشة المطبخ بعد هذا الوقت')}
                </p>
              </div>
            </div>

            {/* Kitchen Operations */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <ChefHat className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{t('Kitchen Operations', 'عمليات المطبخ')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Choose how orders are marked as completed', 'اختر كيف يتم تحديد الطلبات كمكتملة')}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Kitchen Display Option */}
                <button
                  onClick={() => updateSetting('kitchen_operation_mode', 'display')}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    settings.kitchen_operation_mode === 'display'
                      ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      settings.kitchen_operation_mode === 'display'
                        ? 'bg-zinc-900 dark:bg-white'
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      <Monitor className={`w-6 h-6 ${
                        settings.kitchen_operation_mode === 'display'
                          ? 'text-white dark:text-zinc-900'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-zinc-900 dark:text-white">{t('Kitchen Display', 'شاشة المطبخ')}</p>
                        {settings.kitchen_operation_mode === 'display' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">{t('Active', 'نشط')}</span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {t('Dedicated screen in kitchen shows orders. Kitchen staff taps "Ready" to complete orders.', 'شاشة مخصصة في المطبخ تعرض الطلبات. طاقم المطبخ يضغط "جاهز" لإتمام الطلبات.')}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Receipt Scan Option */}
                <button
                  onClick={() => updateSetting('kitchen_operation_mode', 'receipt_scan')}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    settings.kitchen_operation_mode === 'receipt_scan'
                      ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      settings.kitchen_operation_mode === 'receipt_scan'
                        ? 'bg-zinc-900 dark:bg-white'
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      <ScanLine className={`w-6 h-6 ${
                        settings.kitchen_operation_mode === 'receipt_scan'
                          ? 'text-white dark:text-zinc-900'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-zinc-900 dark:text-white">{t('Receipt Scan', 'مسح الإيصال')}</p>
                        {settings.kitchen_operation_mode === 'receipt_scan' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">{t('Active', 'نشط')}</span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        {t('QR code printed on receipt. Employee scans QR code from Orders page when order is ready.', 'رمز QR مطبوع على الإيصال. الموظف يمسح رمز QR من صفحة الطلبات عند جاهزية الطلب.')}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* How it works info box - shown for selected mode */}
              <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <strong>{t('How it works:', 'كيف يعمل:')}</strong>{' '}
                  {settings.kitchen_operation_mode === 'display' 
                    ? t('Orders appear on a dedicated kitchen display screen. When an order is ready, kitchen staff taps the "Ready" button on the display to mark it complete.', 'تظهر الطلبات على شاشة عرض مخصصة في المطبخ. عندما يكون الطلب جاهزاً، يضغط طاقم المطبخ على زر "جاهز" على الشاشة لتحديده كمكتمل.')
                    : t('A QR code will be printed on each receipt. When the order is ready, any employee with "Orders" permission can scan the QR code from the Orders page in the Business App to mark it complete.', 'سيتم طباعة رمز QR على كل إيصال. عندما يكون الطلب جاهزاً، يمكن لأي موظف لديه صلاحية "الطلبات" مسح رمز QR من صفحة الطلبات في تطبيق العمل لتحديده كمكتمل.')
                  }
                </p>
              </div>
            </div>

            {/* POS Operation */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{t('POS Operation', 'تشغيل نقطة البيع')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Configure POS session opening and access control', 'إعداد فتح جلسة نقطة البيع والتحكم في الوصول')}</p>
                </div>
              </div>

              {/* Fixed Opening Float */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{t('Fixed Opening Float', 'رصيد افتتاحي ثابت')}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Use a fixed amount for session opening float', 'استخدام مبلغ ثابت لرصيد افتتاح الجلسة')}</p>
                </div>
                <button
                  onClick={() => updateSetting('pos_opening_float_fixed', !settings.pos_opening_float_fixed)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.pos_opening_float_fixed ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.pos_opening_float_fixed ? (isRTL ? 'right-6' : 'left-6') : (isRTL ? 'right-1' : 'left-1')
                  }`} />
                </button>
              </div>

              {/* Opening Float Amount - shown only when fixed is enabled */}
              {settings.pos_opening_float_fixed && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Opening Float Amount', 'مبلغ الرصيد الافتتاحي')}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={settings.pos_opening_float_amount || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        updateSetting('pos_opening_float_amount', val === '' ? 0 : parseFloat(val));
                      }
                    }}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t('This amount will be used automatically when opening a POS session', 'سيتم استخدام هذا المبلغ تلقائياً عند فتح جلسة نقطة البيع')}
                  </p>
                </div>
              )}

              {/* Session Access Control */}
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white mb-1">{t('Session Access Control', 'التحكم في الوصول للجلسة')}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Control who can open/close POS sessions', 'التحكم في من يمكنه فتح/إغلاق جلسات نقطة البيع')}</p>
                </div>

                {posUsers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-center">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {t('No users with POS permission found', 'لم يتم العثور على مستخدمين لديهم صلاحية نقطة البيع')}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mode Toggle */}
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">{t('Restrict Access', 'تقييد الوصول')}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {t('Only selected users can open/close sessions', 'المستخدمون المحددون فقط يمكنهم فتح/إغلاق الجلسات')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const newValue = settings.pos_session_allowed_user_ids.length === 0;
                          setSettings(prev => ({ 
                            ...prev, 
                            pos_session_allowed_user_ids: newValue ? posUsers.map(u => u.id) : [] 
                          }));
                        }}
                        className={`relative w-12 h-7 rounded-full transition-colors ${
                          settings.pos_session_allowed_user_ids.length > 0 ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                        }`}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          settings.pos_session_allowed_user_ids.length > 0 ? 'left-6' : 'left-1'
                        }`} />
                      </button>
                    </div>

                    {/* User list - only show when restricted mode is ON */}
                    {settings.pos_session_allowed_user_ids.length > 0 && (
                      <div className="space-y-2 pt-2">
                        {posUsers.map((user) => {
                          const isSelected = settings.pos_session_allowed_user_ids.includes(user.id);
                          
                          return (
                            <button
                              key={user.id}
                              onClick={() => toggleUserForPOSSession(user.id)}
                              className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                                isSelected
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-green-500 text-white'
                                    : 'bg-zinc-100 dark:bg-zinc-700'
                                }`}>
                                  <Users className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-zinc-900 dark:text-white">{user.name}</p>
                                  <p className="text-sm text-zinc-500 dark:text-zinc-400">@{user.username} • {user.role}</p>
                                </div>
                                {isSelected && (
                                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Info box */}
                    <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        {settings.pos_session_allowed_user_ids.length === 0 ? (
                          <>
                            <strong>{t('Current setting:', 'الإعداد الحالي:')}</strong>{' '}
                            {t('All users with POS permission can open/close sessions', 'جميع المستخدمين الذين لديهم صلاحية نقطة البيع يمكنهم فتح/إغلاق الجلسات')}
                          </>
                        ) : (
                          <>
                            <strong>{t('Current setting:', 'الإعداد الحالي:')}</strong>{' '}
                            {t(`Only ${settings.pos_session_allowed_user_ids.length} selected user(s) can open/close sessions`, `يمكن لـ ${settings.pos_session_allowed_user_ids.length} مستخدم محدد فقط فتح/إغلاق الجلسات`)}
                          </>
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Business Working Days/Hours */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{t('Business Working Days/Hours', 'أيام وساعات العمل')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Set your store operating schedule', 'تعيين جدول عمل المتجر')}</p>
                </div>
              </div>

              {/* Working Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Opening Time', 'وقت الفتح')}
                  </label>
                  <input
                    type="time"
                    value={settings.opening_time}
                    onChange={(e) => updateSetting('opening_time', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Closing Time', 'وقت الإغلاق')}
                  </label>
                  <input
                    type="time"
                    value={settings.closing_time}
                    onChange={(e) => updateSetting('closing_time', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                  />
                </div>
              </div>

              {/* Working Days */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  {t('Working Days', 'أيام العمل')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'sunday', en: 'Sun', ar: 'أحد' },
                    { key: 'monday', en: 'Mon', ar: 'إثنين' },
                    { key: 'tuesday', en: 'Tue', ar: 'ثلاثاء' },
                    { key: 'wednesday', en: 'Wed', ar: 'أربعاء' },
                    { key: 'thursday', en: 'Thu', ar: 'خميس' },
                    { key: 'friday', en: 'Fri', ar: 'جمعة' },
                    { key: 'saturday', en: 'Sat', ar: 'سبت' },
                  ].map((day) => {
                    const isSelected = settings.working_days?.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        onClick={() => {
                          const currentDays = settings.working_days || [];
                          const newDays = isSelected
                            ? currentDays.filter(d => d !== day.key)
                            : [...currentDays, day.key];
                          updateSetting('working_days', newDays);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {isRTL ? day.ar : day.en}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('Select which days your business operates. Employees cannot check in on non-working days.', 'حدد أيام عمل نشاطك التجاري. لا يمكن للموظفين تسجيل الحضور في أيام الراحة.')}
                </p>
              </div>
            </div>

            {/* GPS Check-in Settings */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{t('GPS Check-in Settings', 'إعدادات تسجيل الحضور GPS')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Configure location-based employee check-in', 'إعداد تسجيل حضور الموظفين بناءً على الموقع')}</p>
                </div>
              </div>

              {/* Require GPS Check-in Toggle */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{t('Require GPS for Check-in', 'طلب GPS لتسجيل الحضور')}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Employees must be at branch location to check in', 'يجب أن يكون الموظفون في موقع الفرع لتسجيل الحضور')}</p>
                </div>
                <button
                  onClick={() => updateSetting('require_gps_checkin', !settings.require_gps_checkin)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.require_gps_checkin ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.require_gps_checkin ? (isRTL ? 'right-6' : 'left-6') : (isRTL ? 'right-1' : 'left-1')
                  }`} />
                </button>
              </div>

              {/* GPS Settings - only shown when enabled */}
              {settings.require_gps_checkin && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('Geofence Radius (meters)', 'نطاق السياج الجغرافي (متر)')}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={settings.geofence_radius_meters}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            updateSetting('geofence_radius_meters', val === '' ? 100 : parseInt(val));
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('GPS Accuracy Threshold (meters)', 'دقة GPS المطلوبة (متر)')}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={settings.gps_accuracy_threshold_meters}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            updateSetting('gps_accuracy_threshold_meters', val === '' ? 50 : parseInt(val));
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('Buffer Before Opening (minutes)', 'المهلة قبل الافتتاح (دقائق)')}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={settings.checkin_buffer_minutes_before}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            updateSetting('checkin_buffer_minutes_before', val === '' ? 15 : parseInt(val));
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        {t('Buffer After Opening (minutes)', 'المهلة بعد الافتتاح (دقائق)')}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={settings.checkin_buffer_minutes_after}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            updateSetting('checkin_buffer_minutes_after', val === '' ? 30 : parseInt(val));
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      <strong>{t('How it works:', 'كيف يعمل:')}</strong>{' '}
                      {t('Employees can check in starting', 'يمكن للموظفين تسجيل الحضور بدءًا من')} {settings.checkin_buffer_minutes_before} {t('minutes before opening time. Check-ins after opening time will be marked as "Late" up to', 'دقيقة قبل وقت الافتتاح. سيتم تحديد تسجيلات الحضور بعد وقت الافتتاح على أنها "متأخر" حتى')} {settings.checkin_buffer_minutes_after} {t('minutes.', 'دقيقة.')}
                    </p>
                  </div>

                  {/* Branch Location - integrated into GPS settings */}
                  {branches.length > 0 && (
                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">{t('Branch Location', 'موقع الفرع')}</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Set the GPS location for employee check-in', 'تعيين موقع GPS لتسجيل حضور الموظفين')}</p>
                        </div>
                        {(() => {
                          const branch = currentBranchId
                            ? branches.find(b => b.id === currentBranchId)
                            : branches[0];
                          if (!branch) return null;
                          return (
                            <button
                              onClick={() => saveBranchGeofence(branch.id)}
                              disabled={savingBranch}
                              className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 flex items-center gap-2"
                            >
                              {savingBranch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              {t('Save Location', 'حفظ الموقع')}
                            </button>
                          );
                        })()}
                      </div>

                      {/* Show map for current branch */}
                      {(() => {
                        const branch = currentBranchId
                          ? branches.find(b => b.id === currentBranchId)
                          : branches[0];
                        if (!branch) return null;

                        return (
                          <div className="space-y-4">
                            {/* Status indicator */}
                            <div className={`p-3 rounded-lg flex items-center gap-3 ${
                              branch.latitude && branch.longitude
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                            }`}>
                              <MapPin className={`w-5 h-5 ${
                                branch.latitude && branch.longitude
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`} />
                              <div>
                                <p className={`text-sm font-medium ${
                                  branch.latitude && branch.longitude
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-amber-700 dark:text-amber-300'
                                }`}>
                                  {branch.latitude && branch.longitude
                                    ? t('Location set', 'تم تعيين الموقع')
                                    : t('Location not set', 'الموقع غير محدد')}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  {branch.latitude && branch.longitude
                                    ? `${branch.latitude.toFixed(6)}, ${branch.longitude.toFixed(6)}`
                                    : t('Click on the map or use your current location', 'انقر على الخريطة أو استخدم موقعك الحالي')}
                                </p>
                              </div>
                            </div>

                            {/* Map Picker */}
                            <MapPicker
                              latitude={branch.latitude}
                              longitude={branch.longitude}
                              radiusMeters={branch.geofence_radius_meters || settings.geofence_radius_meters}
                              onLocationSelect={(lat, lng) => {
                                updateBranch(branch.id, 'latitude', lat);
                                updateBranch(branch.id, 'longitude', lng);
                                // Auto-enable geofence when location is set
                                if (!branch.geofence_enabled) {
                                  updateBranch(branch.id, 'geofence_enabled', true);
                                }
                              }}
                              isRTL={isRTL}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* Checkout Restrictions - inside GPS Check-in Settings */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{t('Checkout Restrictions', 'قيود تسجيل الخروج')}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Employees must meet requirements to check out', 'يجب على الموظفين استيفاء المتطلبات لتسجيل الخروج')}</p>
                  </div>
                  <button
                    onClick={() => updateSetting('require_checkout_restrictions', !settings.require_checkout_restrictions)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      settings.require_checkout_restrictions ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.require_checkout_restrictions ? (isRTL ? 'right-6' : 'left-6') : (isRTL ? 'right-1' : 'left-1')
                    }`} />
                  </button>
                </div>

                {settings.require_checkout_restrictions && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          {t('Minimum Shift Hours', 'الحد الأدنى لساعات العمل')}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={settings.min_shift_hours}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateSetting('min_shift_hours', val === '' ? 4 : parseFloat(val));
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                        />
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {t('Must work at least this many hours', 'يجب العمل على الأقل هذا العدد من الساعات')}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          {t('Checkout Buffer (minutes)', 'مهلة الخروج (دقائق)')}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={settings.checkout_buffer_minutes_before}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              updateSetting('checkout_buffer_minutes_before', val === '' ? 30 : parseInt(val));
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                        />
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {t('Can checkout this many minutes before closing', 'يمكن الخروج قبل الإغلاق بهذا العدد من الدقائق')}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        <strong>{t('How it works:', 'كيف يعمل:')}</strong>{' '}
                        {t('Employees must work at least', 'يجب على الموظفين العمل على الأقل')} <strong>{settings.min_shift_hours}</strong> {t('hours AND can only check out starting', 'ساعات ويمكنهم تسجيل الخروج فقط بدءًا من')} <strong>{settings.checkout_buffer_minutes_before}</strong> {t('minutes before closing time.', 'دقيقة قبل وقت الإغلاق.')}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Employee Schedule Overrides - inside GPS Check-in Settings */}
              {employees.length > 0 && (
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-4">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{t('Employee Schedule Overrides', 'جداول الموظفين المخصصة')}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Set custom working hours/days for specific employees', 'تعيين ساعات/أيام عمل مخصصة لموظفين محددين')}</p>
                  </div>

                  <div className="space-y-3">
                  {employees.map((employee) => {
                    const override = getOverrideForEmployee(employee.id);
                    const isEditing = editingEmployeeId === employee.id;
                    const hasOverride = override && (override.working_days || override.opening_time || override.closing_time);

                    return (
                      <div
                        key={employee.id}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isEditing
                            ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-800'
                            : 'border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              hasOverride
                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                : 'bg-zinc-100 dark:bg-zinc-700'
                            }`}>
                              <User className={`w-5 h-5 ${
                                hasOverride
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-zinc-500'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-zinc-900 dark:text-white">{employee.name}</p>
                              <p className="text-xs text-zinc-500">
                                @{employee.username} • {employee.role}
                                {hasOverride && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                    {t('Custom', 'مخصص')}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isEditing ? (
                              <button
                                onClick={() => setEditingEmployeeId(employee.id)}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300"
                              >
                                {hasOverride ? t('Edit', 'تعديل') : t('Customize', 'تخصيص')}
                              </button>
                            ) : (
                              <>
                                {hasOverride && (
                                  <button
                                    onClick={() => deleteScheduleOverride(employee.id)}
                                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                                    title={t('Remove override', 'إزالة التخصيص')}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setEditingEmployeeId(null)}
                                  className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600"
                                >
                                  <X className="w-4 h-4 text-zinc-500" />
                                </button>
                                <button
                                  onClick={() => saveScheduleOverride(employee.id)}
                                  disabled={savingOverride}
                                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50"
                                >
                                  {savingOverride ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Save', 'حفظ')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="space-y-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                            {/* Custom Working Days */}
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                {t('Custom Working Days', 'أيام العمل المخصصة')} ({t('leave empty for default', 'اتركه فارغاً للافتراضي')})
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { key: 'sunday', en: 'Sun', ar: 'أحد' },
                                  { key: 'monday', en: 'Mon', ar: 'إثنين' },
                                  { key: 'tuesday', en: 'Tue', ar: 'ثلاثاء' },
                                  { key: 'wednesday', en: 'Wed', ar: 'أربعاء' },
                                  { key: 'thursday', en: 'Thu', ar: 'خميس' },
                                  { key: 'friday', en: 'Fri', ar: 'جمعة' },
                                  { key: 'saturday', en: 'Sat', ar: 'سبت' },
                                ].map((day) => {
                                  const isSelected = override?.working_days?.includes(day.key);
                                  return (
                                    <button
                                      key={day.key}
                                      onClick={() => {
                                        const currentDays = override?.working_days || [];
                                        const newDays = isSelected
                                          ? currentDays.filter(d => d !== day.key)
                                          : [...currentDays, day.key];
                                        updateOverride(employee.id, 'working_days', newDays.length > 0 ? newDays : null);
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        isSelected
                                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                                          : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                                      }`}
                                    >
                                      {isRTL ? day.ar : day.en}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Custom Working Hours */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                  {t('Custom Opening Time', 'وقت الفتح المخصص')}
                                </label>
                                <input
                                  type="time"
                                  value={override?.opening_time || ''}
                                  onChange={(e) => updateOverride(employee.id, 'opening_time', e.target.value || null)}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                  {t('Custom Closing Time', 'وقت الإغلاق المخصص')}
                                </label>
                                <input
                                  type="time"
                                  value={override?.closing_time || ''}
                                  onChange={(e) => updateOverride(employee.id, 'closing_time', e.target.value || null)}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                                />
                              </div>
                            </div>

                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {t('Empty fields will use business defaults. This employee will follow their custom schedule for check-in.', 'الحقول الفارغة ستستخدم الإعدادات الافتراضية. سيتبع هذا الموظف جدوله المخصص لتسجيل الحضور.')}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{t('Notifications', 'الإشعارات')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Configure order notifications', 'إعداد إشعارات الطلبات')}</p>
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{t('Order Notifications', 'إشعارات الطلبات')}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Sound alerts for new orders', 'تنبيهات صوتية للطلبات الجديدة')}</p>
                </div>
                <button
                  onClick={() => updateSetting('enable_order_notifications', !settings.enable_order_notifications)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.enable_order_notifications ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    settings.enable_order_notifications ? (isRTL ? 'right-6' : 'left-6') : (isRTL ? 'right-1' : 'left-1')
                  }`} />
                </button>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {t('Save Settings', 'حفظ الإعدادات')}
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

