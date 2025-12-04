'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, Command, LogOut, User } from 'lucide-react';
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

  const [country, setCountry] = useState('Kuwait');
  const [currency, setCurrency] = useState('KWD');
  const [language, setLanguageState] = useState('en');

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
        setCountry(biz.country || 'Kuwait');
        setCurrency(biz.currency || 'KWD');
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
        setCountry(response.data.data.country || 'Kuwait');
        setCurrency(response.data.data.currency || 'KWD');
        setLanguageState(response.data.data.language || 'en');
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
    try {
      await api.put('/business-settings/localization', {
        country,
        currency,
        language,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      
      if (business) {
        const updatedBusiness = { ...business, country, currency, language };
        localStorage.setItem('setup_business', JSON.stringify(updatedBusiness));
        setBusiness(updatedBusiness);
      }
      
      setGlobalLanguage(language);
    } catch (err) {
      console.error('Failed to save localization:', err);
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
      <Sidebar business={business} />

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
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-6">
              {/* Country */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Country', 'الدولة')}
                </label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Currency', 'العملة')}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('Language', 'اللغة')}
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguageState(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
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
