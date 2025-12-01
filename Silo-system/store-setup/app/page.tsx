'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ArrowRight, CheckCircle2, Package, ChefHat, ShoppingBag, FolderTree, Percent, Users } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';

interface Business {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
}

export default function Home() {
  const router = useRouter();
  const { isRTL, t } = useLanguage();
  const [userName, setUserName] = useState<string>('');
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('setup_user');
    const storedBusiness = localStorage.getItem('setup_business');
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserName(user.first_name || user.username);
      } catch {}
    }
    if (storedBusiness) {
      try {
        setBusiness(JSON.parse(storedBusiness));
      } catch {}
    }
  }, []);

  const features = [
    { title: t('Items', 'المواد'), desc: t('Add raw materials and ingredients', 'إضافة المواد الخام والمكونات'), Icon: Package, href: '/items' },
    { title: t('Recipes', 'الوصفات'), desc: t('Create recipes with cost calculations', 'إنشاء وصفات مع حساب التكلفة'), Icon: ChefHat, href: '/recipes' },
    { title: t('Products', 'المنتجات'), desc: t('Define products for your menu', 'تحديد المنتجات لقائمتك'), Icon: ShoppingBag, href: '/products' },
    { title: t('Categories', 'الفئات'), desc: t('Organize your menu structure', 'تنظيم هيكل القائمة'), Icon: FolderTree, href: '/categories' },
    { title: t('Discounts', 'الخصومات'), desc: t('Set up promotions and offers', 'إعداد العروض الترويجية'), Icon: Percent, href: '/discounts' },
    { title: t('Users & Roles', 'المستخدمين'), desc: t('Manage staff access levels', 'إدارة صلاحيات الموظفين'), Icon: Users, href: '/users-roles' },
  ];

  const checklist = [
    t('Configure your restaurant profile and branding', 'إعداد ملف المطعم والعلامة التجارية'),
    t('Set up your menu categories and items', 'إعداد فئات القائمة والمواد'),
    t('Add staff members and assign roles', 'إضافة الموظفين وتعيين الصلاحيات'),
    t('Configure POS terminals and payment methods', 'إعداد نقاط البيع وطرق الدفع'),
    t('Set up inventory and supplier connections', 'إعداد المخزون والموردين'),
  ];

  return (
    <PageLayout searchPlaceholder={{ en: 'Search items, products...', ar: 'البحث في المواد والمنتجات...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t(`Welcome, ${userName}!`, `مرحباً، ${userName}!`)}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {business?.name} • {t('Configure your store settings below', 'قم بإعداد متجرك من خلال الخيارات أدناه')}
            </p>
          </div>
        </div>

        {/* Quick Start Card */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="p-8 rounded-2xl bg-zinc-800 text-white relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-white/10 backdrop-blur-sm">
              <Store className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('Get Started with Store Setup', 'ابدأ بإعداد المتجر')}</h2>
            <p className="text-zinc-400 max-w-md mb-6">
              {t('Configure your menu items, recipes, products, and more using the sidebar navigation.', 'قم بإعداد قائمة الطعام والوصفات والمنتجات والمزيد باستخدام الشريط الجانبي.')}
            </p>
            <button 
              onClick={() => router.push('/items')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-white text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              {t('Start with Items', 'ابدأ بالمواد')}
              <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + (i * 0.1) }}
              onClick={() => router.push(feature.href)}
              className="flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <feature.Icon className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Setup Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
            {t('Setup Checklist', 'قائمة الإعداد')}
          </h3>
          <div className="space-y-3">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-zinc-400" />
                </div>
                <span className="text-sm text-zinc-600 dark:text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </PageLayout>
  );
}
