'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, ArrowRight, CheckCircle2, Circle, Package, ChefHat, ShoppingBag, FolderTree, Percent, Users, Sparkles, Rocket, Clock, TrendingUp } from 'lucide-react';
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
  const [greeting, setGreeting] = useState<{ en: string; ar: string }>({ en: 'Hello', ar: 'مرحباً' });

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

    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting({ en: 'Good morning', ar: 'صباح الخير' });
    } else if (hour < 18) {
      setGreeting({ en: 'Good afternoon', ar: 'مساء الخير' });
    } else {
      setGreeting({ en: 'Good evening', ar: 'مساء الخير' });
    }
  }, []);

  const features = [
    { title: t('Items', 'المواد'), desc: t('Add raw materials and ingredients', 'إضافة المواد الخام والمكونات'), Icon: Package, href: '/items', color: 'from-blue-500 to-cyan-500' },
    { title: t('Recipes', 'الوصفات'), desc: t('Create recipes with cost calculations', 'إنشاء وصفات مع حساب التكلفة'), Icon: ChefHat, href: '/recipes', color: 'from-orange-500 to-amber-500' },
    { title: t('Products', 'المنتجات'), desc: t('Define products for your menu', 'تحديد المنتجات لقائمتك'), Icon: ShoppingBag, href: '/products', color: 'from-emerald-500 to-teal-500' },
    { title: t('Categories', 'الفئات'), desc: t('Organize your menu structure', 'تنظيم هيكل القائمة'), Icon: FolderTree, href: '/categories', color: 'from-purple-500 to-violet-500' },
    { title: t('Discounts', 'الخصومات'), desc: t('Set up promotions and offers', 'إعداد العروض الترويجية'), Icon: Percent, href: '/discounts', color: 'from-pink-500 to-rose-500' },
    { title: t('Users & Roles', 'المستخدمين'), desc: t('Manage staff access levels', 'إدارة صلاحيات الموظفين'), Icon: Users, href: '/users-roles', color: 'from-indigo-500 to-blue-500' },
  ];

  const checklist = [
    { text: t('Configure your restaurant profile and branding', 'إعداد ملف المطعم والعلامة التجارية'), done: true },
    { text: t('Set up your menu categories and items', 'إعداد فئات القائمة والمواد'), done: false },
    { text: t('Add staff members and assign roles', 'إضافة الموظفين وتعيين الصلاحيات'), done: false },
    { text: t('Configure POS terminals and payment methods', 'إعداد نقاط البيع وطرق الدفع'), done: false },
    { text: t('Set up inventory and supplier connections', 'إعداد المخزون والموردين'), done: false },
  ];

  const stats = [
    { label: t('Items', 'المواد'), value: '0', Icon: Package },
    { label: t('Products', 'المنتجات'), value: '0', Icon: ShoppingBag },
    { label: t('Categories', 'الفئات'), value: '0', Icon: FolderTree },
  ];

  return (
    <PageLayout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto space-y-8"
      >
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-2"
            >
              <Clock size={14} />
              <span>{new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </motion.div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t(greeting.en, greeting.ar)}, <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">{userName}</span>! 👋
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-lg">
              {t("Let's set up your store and get you ready for success", "لنقم بإعداد متجرك ونجعلك جاهزاً للنجاح")}
            </p>
          </div>
        </div>

        {/* Quick Start Hero Card - Fixed for light/dark mode */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-200 dark:border-zinc-700"
        >
          {/* Background decorations */}
          <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute left-0 bottom-0 w-64 h-64 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
          
          <div className="relative z-10 p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center gap-8">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-4">
                  <Sparkles size={14} />
                  {t('Quick Start', 'البداية السريعة')}
                </div>
                
                <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                  {t('Get Started with Store Setup', 'ابدأ بإعداد المتجر')}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 max-w-lg mb-6 leading-relaxed">
                  {t('Configure your menu items, recipes, products, and more using the sidebar navigation. Start by adding your raw materials and ingredients.', 'قم بإعداد قائمة الطعام والوصفات والمنتجات والمزيد باستخدام الشريط الجانبي. ابدأ بإضافة المواد الخام والمكونات.')}
                </p>
                
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => router.push('/items')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-lg shadow-zinc-900/20 dark:shadow-black/20 hover:scale-105"
                  >
                    <Rocket size={18} />
                    {t('Start with Items', 'ابدأ بالمواد')}
                    <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                  </button>
                  <button 
                    onClick={() => router.push('/settings')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-white/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-all"
                  >
                    {t('View Settings', 'الإعدادات')}
                  </button>
                </div>
              </div>
              
              {/* Stats Preview */}
              <div className="flex md:flex-col gap-4">
                {stats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + (i * 0.1) }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center">
                      <stat.Icon size={18} className="text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-zinc-900 dark:text-white">{stat.value}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{stat.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-500" />
            {t('Quick Actions', 'الإجراءات السريعة')}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.08) }}
                onClick={() => router.push(feature.href)}
                className="group relative p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-600 transition-all cursor-pointer hover:-translate-y-1"
              >
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 dark:group-hover:opacity-10 transition-opacity`} />
                <div className="relative flex items-start gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} bg-opacity-10 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <feature.Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {feature.desc}
                    </p>
                  </div>
                  <ArrowRight className={`w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-all group-hover:translate-x-1 ${isRTL ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Setup Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-500" />
              {t('Setup Checklist', 'قائمة الإعداد')}
            </h3>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
              {checklist.filter(c => c.done).length}/{checklist.length} {t('completed', 'مكتمل')}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-5 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(checklist.filter(c => c.done).length / checklist.length) * 100}%` }}
              transition={{ delay: 1, duration: 0.8 }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            />
          </div>
          
          <div className="space-y-2">
            {checklist.map((item, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + (i * 0.1) }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  item.done 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20' 
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  item.done 
                    ? 'bg-emerald-500 text-white' 
                    : 'border-2 border-zinc-300 dark:border-zinc-600'
                }`}>
                  {item.done ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <span className={`text-sm ${
                  item.done 
                    ? 'text-emerald-700 dark:text-emerald-300 line-through opacity-70' 
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}>
                  {item.text}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </PageLayout>
  );
}
