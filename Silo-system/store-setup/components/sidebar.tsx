'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Package, 
  ShoppingBag, 
  FolderTree, 
  Percent, 
  UserCog,
  Settings,
  Store,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

interface NavItem {
  name: string;
  nameAr: string;
  href: string;
  icon: React.ElementType;
}

interface Business {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
}

interface SidebarProps {
  business?: Business | null;
}

const navItems: NavItem[] = [
  { name: 'Items', nameAr: 'المواد', href: '/items', icon: Package },
  { name: 'Products', nameAr: 'المنتجات', href: '/products', icon: ShoppingBag },
  { name: 'Categories', nameAr: 'الفئات', href: '/categories', icon: FolderTree },
  { name: 'Discounts', nameAr: 'الخصومات', href: '/discounts', icon: Percent },
  { name: 'Users-Roles', nameAr: 'المستخدمين', href: '/users-roles', icon: UserCog },
  { name: 'Settings', nameAr: 'الإعدادات', href: '/settings', icon: Settings },
];

export function Sidebar({ business }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { language, isRTL, t } = useLanguage();

  return (
    <aside 
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } ${isRTL ? 'border-l' : 'border-r'} border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hidden md:flex flex-col sticky top-0 h-screen z-40 transition-all duration-300`}
    >
      {/* Logo */}
      <div className={`p-6 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {business?.logo_url ? (
          <img 
            src={business.logo_url} 
            alt={business.name}
            className="h-10 w-10 rounded-xl object-cover flex-shrink-0 shadow-lg"
          />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center shadow-lg flex-shrink-0">
            <Store className="w-5 h-5 text-white dark:text-zinc-900" />
          </div>
        )}
        {!collapsed && (
          <motion.span 
            initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white whitespace-nowrap"
          >
            {business?.name || t('Store Setup', 'إعداد المتجر')}
          </motion.span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-6">
        <div className={`text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 ${collapsed ? 'text-center' : 'px-3'} ${isRTL ? 'text-right' : ''}`}>
          {collapsed ? '—' : t('Menu Setup', 'إعداد القائمة')}
        </div>
        
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname === '/' && item.href === '/items');
          const Icon = item.icon;
          const displayName = isRTL ? item.nameAr : item.name;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive 
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              } ${collapsed ? 'justify-center' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${
                isActive 
                  ? 'text-zinc-900 dark:text-white' 
                  : 'group-hover:text-zinc-900 dark:group-hover:text-white'
              }`} />
              
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="whitespace-nowrap"
                >
                  {displayName}
                </motion.span>
              )}
              
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className={`absolute ${isRTL ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'} top-1/2 -translate-y-1/2 w-1 h-8 bg-zinc-900 dark:bg-white`}
                />
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className={`absolute ${isRTL ? 'right-full mr-3' : 'left-full ml-3'} px-3 py-2 bg-zinc-900 dark:bg-zinc-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl`}>
                  {displayName}
                  <div className={`absolute ${isRTL ? 'right-0 translate-x-1' : 'left-0 -translate-x-1'} top-1/2 -translate-y-1/2 w-2 h-2 bg-zinc-900 dark:bg-zinc-800 rotate-45`} />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all ${
            collapsed ? 'justify-center' : ''
          } ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          {collapsed ? (
            isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              <span className="text-sm font-medium">{t('Collapse', 'طي')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
