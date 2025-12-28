'use client';

import { UtensilsCrossed, Plus } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';

export default function DineInPage() {
  const { t } = useLanguage();

  return (
    <PageLayout searchPlaceholder={{ en: 'Search dine-in settings...', ar: 'البحث في إعدادات تناول الطعام...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Dine-in', 'تناول الطعام')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Manage dine-in settings and table configurations', 'إدارة إعدادات تناول الطعام وتكوينات الطاولات')}
            </p>
          </div>
          <button 
            className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Add Table', 'إضافة طاولة')}
          </button>
        </div>

        {/* Empty State */}
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <UtensilsCrossed className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No dine-in settings configured', 'لم يتم تكوين إعدادات تناول الطعام بعد')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            {t('Set up your tables, sections, and dine-in preferences', 'قم بإعداد الطاولات والأقسام وتفضيلات تناول الطعام')}
          </p>
          <button 
            className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Get Started', 'ابدأ الآن')}
          </button>
        </div>
      </motion.div>
    </PageLayout>
  );
}




