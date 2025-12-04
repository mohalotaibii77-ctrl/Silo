'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Percent, Save, FileText } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import api from '@/lib/api';

interface TaxSettings {
  vat_enabled: boolean;
  tax_rate: number;
  tax_number: string;
}

export default function TaxSettingsPage() {
  const router = useRouter();
  const { isRTL, t, formatCurrency } = useLanguage();
  
  const [settings, setSettings] = useState<TaxSettings>({
    vat_enabled: false,
    tax_rate: 0,
    tax_number: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/business-settings');
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setSettings({
          vat_enabled: data.vat_enabled || false,
          tax_rate: data.tax_rate || 0,
          tax_number: data.tax_number || '',
        });
      }
    } catch (err) {
      console.error('Failed to load tax settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      await api.put('/business-settings', {
        vat_enabled: settings.vat_enabled,
        tax_rate: settings.vat_enabled ? settings.tax_rate : 0,
        tax_number: settings.tax_number,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('Failed to save settings', 'فشل في حفظ الإعدادات'));
    } finally {
      setIsSaving(false);
    }
  };

  // Common VAT rates by country
  const commonRates = [
    { label: t('Kuwait (0%)', 'الكويت (0%)'), value: 0 },
    { label: t('Saudi Arabia (15%)', 'السعودية (15%)'), value: 15 },
    { label: t('UAE (5%)', 'الإمارات (5%)'), value: 5 },
    { label: t('Bahrain (10%)', 'البحرين (10%)'), value: 10 },
    { label: t('Oman (5%)', 'عمان (5%)'), value: 5 },
    { label: t('Qatar (0%)', 'قطر (0%)'), value: 0 },
  ];

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100 rounded-full" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className={`w-5 h-5 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Tax Settings', 'إعدادات الضريبة')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Configure VAT/Tax for your business', 'إعداد ضريبة القيمة المضافة لنشاطك التجاري')}
            </p>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
            {t('Settings saved successfully!', 'تم حفظ الإعدادات بنجاح!')}
          </div>
        )}

        {/* Settings Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
          
          {/* VAT Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Percent className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">
                  {t('Enable VAT', 'تفعيل ضريبة القيمة المضافة')}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('Apply tax to all sales', 'تطبيق الضريبة على جميع المبيعات')}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.vat_enabled}
                onChange={(e) => setSettings({ ...settings, vat_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-zinc-200 dark:bg-zinc-700 rounded-full peer peer-checked:bg-emerald-500 transition-colors">
                <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${settings.vat_enabled ? 'translate-x-7' : ''}`} />
              </div>
            </label>
          </div>

          {/* VAT Rate - Only show if VAT is enabled */}
          {settings.vat_enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800"
            >
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('VAT Rate (%)', 'نسبة ضريبة القيمة المضافة (%)')}
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={settings.tax_rate}
                      onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max="100"
                      step="0.1"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-12"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">%</span>
                  </div>
                </div>
              </div>

              {/* Quick Select Common Rates */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Quick Select', 'اختيار سريع')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {commonRates.map((rate, index) => (
                    <button
                      key={`${rate.label}-${index}`}
                      type="button"
                      onClick={() => setSettings({ ...settings, tax_rate: rate.value })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        settings.tax_rate === rate.value
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {rate.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tax Registration Number */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {t('Tax Registration Number (Optional)', 'رقم التسجيل الضريبي (اختياري)')}
                  </div>
                </label>
                <input
                  type="text"
                  value={settings.tax_number}
                  onChange={(e) => setSettings({ ...settings, tax_number: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={t('Enter your VAT registration number', 'أدخل رقم التسجيل الضريبي')}
                />
                <p className="text-xs text-zinc-500 mt-1">
                  {t('This will appear on receipts and invoices', 'سيظهر هذا على الإيصالات والفواتير')}
                </p>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  {t('Example Calculation', 'مثال على الحساب')}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{t('Item Price', 'سعر المنتج')}</span>
                    <span className="text-zinc-900 dark:text-white">{formatCurrency(10)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{t('VAT', 'ض.ق.م')} ({settings.tax_rate}%)</span>
                    <span className="text-zinc-900 dark:text-white">{formatCurrency(10 * settings.tax_rate / 100)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700 font-semibold">
                    <span className="text-zinc-700 dark:text-zinc-300">{t('Total', 'الإجمالي')}</span>
                    <span className="text-zinc-900 dark:text-white">{formatCurrency(10 * (1 + settings.tax_rate / 100))}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            <Save className="w-5 h-5" />
            {isSaving ? t('Saving...', 'جاري الحفظ...') : t('Save Changes', 'حفظ التغييرات')}
          </button>
        </div>
      </motion.div>
    </PageLayout>
  );
}

