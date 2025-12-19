'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, Command, LogOut, User } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { useLanguage } from '@/lib/language-context';

interface Business {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
  country?: string;
  currency?: string;
  timezone?: string;
  language?: string;
}

// Countries with their currencies
const COUNTRIES = [
  { name: 'Afghanistan', code: 'AF', currency: 'AFN', currencyName: 'Afghan Afghani' },
  { name: 'Algeria', code: 'DZ', currency: 'DZD', currencyName: 'Algerian Dinar' },
  { name: 'Bahrain', code: 'BH', currency: 'BHD', currencyName: 'Bahraini Dinar' },
  { name: 'Brazil', code: 'BR', currency: 'BRL', currencyName: 'Brazilian Real' },
  { name: 'Canada', code: 'CA', currency: 'CAD', currencyName: 'Canadian Dollar' },
  { name: 'China', code: 'CN', currency: 'CNY', currencyName: 'Chinese Yuan' },
  { name: 'Egypt', code: 'EG', currency: 'EGP', currencyName: 'Egyptian Pound' },
  { name: 'France', code: 'FR', currency: 'EUR', currencyName: 'Euro' },
  { name: 'Germany', code: 'DE', currency: 'EUR', currencyName: 'Euro' },
  { name: 'India', code: 'IN', currency: 'INR', currencyName: 'Indian Rupee' },
  { name: 'Iraq', code: 'IQ', currency: 'IQD', currencyName: 'Iraqi Dinar' },
  { name: 'Japan', code: 'JP', currency: 'JPY', currencyName: 'Japanese Yen' },
  { name: 'Jordan', code: 'JO', currency: 'JOD', currencyName: 'Jordanian Dinar' },
  { name: 'Kuwait', code: 'KW', currency: 'KWD', currencyName: 'Kuwaiti Dinar' },
  { name: 'Lebanon', code: 'LB', currency: 'LBP', currencyName: 'Lebanese Pound' },
  { name: 'Malaysia', code: 'MY', currency: 'MYR', currencyName: 'Malaysian Ringgit' },
  { name: 'Morocco', code: 'MA', currency: 'MAD', currencyName: 'Moroccan Dirham' },
  { name: 'Oman', code: 'OM', currency: 'OMR', currencyName: 'Omani Rial' },
  { name: 'Pakistan', code: 'PK', currency: 'PKR', currencyName: 'Pakistani Rupee' },
  { name: 'Qatar', code: 'QA', currency: 'QAR', currencyName: 'Qatari Riyal' },
  { name: 'Saudi Arabia', code: 'SA', currency: 'SAR', currencyName: 'Saudi Riyal' },
  { name: 'Singapore', code: 'SG', currency: 'SGD', currencyName: 'Singapore Dollar' },
  { name: 'South Korea', code: 'KR', currency: 'KRW', currencyName: 'South Korean Won' },
  { name: 'Spain', code: 'ES', currency: 'EUR', currencyName: 'Euro' },
  { name: 'Turkey', code: 'TR', currency: 'TRY', currencyName: 'Turkish Lira' },
  { name: 'United Arab Emirates', code: 'AE', currency: 'AED', currencyName: 'UAE Dirham' },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP', currencyName: 'British Pound' },
  { name: 'United States', code: 'US', currency: 'USD', currencyName: 'US Dollar' },
  { name: 'Yemen', code: 'YE', currency: 'YER', currencyName: 'Yemeni Rial' },
];

const CURRENCIES = Array.from(new Map(COUNTRIES.map(c => [c.currency, { code: c.currency, name: c.currencyName }])).values())
  .sort((a, b) => a.code.localeCompare(b.code));

const LANGUAGES = [
  { code: 'en', name: 'English', nameAr: 'الإنجليزية' },
  { code: 'ar', name: 'العربية (Arabic)', nameAr: 'العربية' },
];

export default function LocalizationPage() {
  const router = useRouter();
  const { isRTL, setLanguage: setGlobalLanguage, t } = useLanguage();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState(''); // Loaded from business settings
  const [language, setLanguageState] = useState('en');
  const [originalSettings, setOriginalSettings] = useState({ country: '', currency: '', language: 'en' });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');
    const storedBusiness = localStorage.getItem('setup_business');

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
      if (storedBusiness) {
        const biz = JSON.parse(storedBusiness);
        setBusiness(biz);
        setCountry(biz.country || '');
        setCurrency(biz.currency || '');
        setLanguageState(biz.language || 'en');
      }
    } catch {
      router.push('/login');
      return;
    }

    setLoading(false);
    fetchLocalization();
  }, [router]);

  const fetchLocalization = async () => {
    try {
      const response = await api.get('/business-settings/localization');
      if (response.data.data) {
        const data = response.data.data;
        setCountry(data.country || '');
        setCurrency(data.currency || '');
        setLanguageState(data.language || 'en');
        setOriginalSettings({
          country: data.country || '',
          currency: data.currency || '',
          language: data.language || 'en',
        });
      }
    } catch (err) {
      console.error('Failed to fetch localization:', err);
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
      const currencyChanged = currency !== originalSettings.currency;
      const languageChanged = language !== originalSettings.language;
      
      if (!currencyChanged && !languageChanged) {
        setMessage({ type: 'info', text: t('No changes detected', 'لم يتم اكتشاف تغييرات') });
        setSaving(false);
        return;
      }

      // Language is a USER preference (not business-wide setting)
      if (languageChanged) {
        // Apply language change to UI and save to user settings in database
        // setGlobalLanguage calls the /business-settings/user-settings endpoint
        setGlobalLanguage(language);
        
        // Update original settings
        setOriginalSettings(prev => ({ ...prev, language }));
      }

      // Only currency requires admin approval
      if (currencyChanged) {
        try {
          await api.post('/business-settings/change-requests', {
            request_type: 'localization',
            new_currency: currency,
          });
          setMessage({ 
            type: 'success', 
            text: languageChanged 
              ? t('Language saved. Currency change submitted for admin approval.', 'تم حفظ اللغة. تم إرسال طلب تغيير العملة للموافقة.')
              : t('Currency change submitted for admin approval.', 'تم إرسال طلب تغيير العملة للموافقة.')
          });
        } catch (err: any) {
          if (err.response?.data?.error?.includes('pending request')) {
            setMessage({ 
              type: 'warning', 
              text: languageChanged
                ? t('Language saved. You already have a pending currency change request.', 'تم حفظ اللغة. لديك بالفعل طلب تغيير عملة قيد الانتظار.')
                : t('You already have a pending currency change request.', 'لديك بالفعل طلب تغيير عملة قيد الانتظار.')
            });
          } else {
            throw err;
          }
        }
      } else if (languageChanged) {
        setMessage({ 
          type: 'success', 
          text: t('Language saved successfully!', 'تم حفظ اللغة بنجاح!')
        });
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error || t('Failed to save settings', 'فشل في حفظ الإعدادات') 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const countryData = COUNTRIES.find(c => c.name === newCountry);
    if (countryData) {
      setCurrency(countryData.currency);
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
            <h1 className="font-semibold text-zinc-900 dark:text-white">{t('Localization', 'التوطين')}</h1>
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
            className="max-w-2xl mx-auto space-y-6"
          >
            {/* Status Messages */}
            {message.text && (
              <div className={`p-4 rounded-xl flex items-start gap-3 ${
                message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' :
                message.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' :
                message.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' :
                'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              }`}>
                {message.text}
              </div>
            )}

            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-6">
              {/* Country */}
              <SearchableSelect
                label={t('Country', 'الدولة')}
                value={country}
                onChange={(val) => handleCountryChange(val ? String(val) : 'Saudi Arabia')}
                options={COUNTRIES.map((c) => ({
                  id: c.name,
                  name: c.name,
                }))}
                placeholder={t('Select country', 'اختر الدولة')}
              />

              {/* Currency */}
              <SearchableSelect
                label={t('Currency', 'العملة')}
                value={currency}
                onChange={(val) => setCurrency(val ? String(val) : '')}
                options={CURRENCIES.map((c) => ({
                  id: c.code,
                  name: `${c.code} - ${c.name}`,
                }))}
                placeholder={t('Select currency', 'اختر العملة')}
              />

              {/* Language */}
              <SearchableSelect
                label={t('Language', 'اللغة')}
                value={language}
                onChange={(val) => setLanguageState(val ? String(val) : 'en')}
                options={LANGUAGES.map((l) => ({
                  id: l.code,
                  name: l.name,
                }))}
                placeholder={t('Select language', 'اختر اللغة')}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : null}
              {saved ? t('Saved!', 'تم الحفظ!') : saving ? t('Saving...', 'جاري الحفظ...') : t('Save Changes', 'حفظ التغييرات')}
            </button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
