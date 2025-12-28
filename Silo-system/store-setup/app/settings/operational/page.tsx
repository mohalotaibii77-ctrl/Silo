'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Command, ArrowLeft, Save, Loader2, Clock, Hash, Bell, Timer, Monitor, ScanLine, ChefHat, DollarSign, Users } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

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
};

interface POSUser {
  id: number;
  username: string;
  name: string;
  role: string;
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
      fetchData();
    } catch {
      router.push('/login');
      return;
    }
  }, [router]);

  const fetchData = async () => {
    try {
      const [businessRes, settingsRes, posEmployeesRes] = await Promise.all([
        api.get('/business-settings'),
        api.get('/business-settings/operational'),
        api.get('/pos-sessions/employees'),
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
      await api.put('/business-settings/operational', settings);
      setMessage({ type: 'success', text: t('Settings saved successfully!', 'تم حفظ الإعدادات بنجاح!') });
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

            {/* Business Hours */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-white">{t('Business Hours', 'ساعات العمل')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Set your store operating hours', 'تعيين ساعات عمل المتجر')}</p>
                </div>
              </div>

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

