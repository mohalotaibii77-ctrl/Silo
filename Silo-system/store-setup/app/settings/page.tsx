'use client';

import { useRouter } from 'next/navigation';
import { Store, Globe, CreditCard, Printer, Percent } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';

export default function SettingsPage() {
  const router = useRouter();
  const { isRTL, t } = useLanguage();

  const settingsSections = [
    { title: t('Store Profile', 'ملف المتجر'), desc: t('Business name, logo, and contact info', 'اسم المتجر والشعار ومعلومات الاتصال'), icon: Store, href: '/settings/store-profile' },
    { title: t('Localization', 'التوطين'), desc: t('Language, currency, and timezone', 'اللغة والعملة والمنطقة الزمنية'), icon: Globe, href: '/settings/localization' },
    { title: t('Tax / VAT', 'الضريبة / ض.ق.م'), desc: t('Configure VAT rate and tax settings', 'إعداد نسبة ضريبة القيمة المضافة'), icon: Percent, href: '/settings/tax' },
    { title: t('Payment Methods', 'طرق الدفع'), desc: t('Configure accepted payment types', 'إعداد أنواع الدفع المقبولة'), icon: CreditCard, href: null, disabled: true },
    { title: t('Printers & Devices', 'الطابعات والأجهزة'), desc: t('Set up receipt and kitchen printers', 'إعداد طابعات الإيصالات والمطبخ'), icon: Printer, href: '/settings/printers-devices' },
  ];

  return (
    <PageLayout searchPlaceholder={{ en: 'Search settings...', ar: 'البحث في الإعدادات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
            {t('Settings', 'الإعدادات')}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {t('Configure your store preferences', 'إعداد تفضيلات المتجر')}
          </p>
        </div>

        <div className="grid gap-4">
          {settingsSections.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + (i * 0.1) }}
                onClick={() => section.href && router.push(section.href)}
                className={`flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-all group ${
                  section.disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer'
                }`}
              >
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center transition-colors ${
                  !section.disabled && 'group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700'
                }`}>
                  <Icon className={`w-6 h-6 text-zinc-600 dark:text-zinc-400 transition-colors ${
                    !section.disabled && 'group-hover:text-zinc-900 dark:group-hover:text-white'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold text-zinc-900 dark:text-white transition-colors ${
                      !section.disabled && 'group-hover:text-zinc-700 dark:group-hover:text-zinc-200'
                    }`}>
                      {section.title}
                    </h3>
                    {section.disabled && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {t('Coming Soon', 'قريباً')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {section.desc}
                  </p>
                </div>
                <div className={`text-zinc-400 transition-colors ${
                  !section.disabled && 'group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                }`}>
                  <svg className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </PageLayout>
  );
}
