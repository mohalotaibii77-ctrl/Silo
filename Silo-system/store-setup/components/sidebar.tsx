'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  ShoppingBag,
  Boxes,
  FolderTree,
  Warehouse,
  Percent,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  Command,
  Truck,
  FileText,
  ArrowLeftRight,
  ClipboardList,
  MessageSquareMore,
  PackageCheck,
  Armchair,
  Car,
  Receipt,
  Clock
} from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

interface SubNavItem {
  name: string;
  nameAr: string;
  href: string;
  icon: React.ElementType;
}

interface NavItem {
  name: string;
  nameAr: string;
  href: string;
  icon: React.ElementType;
  subItems?: SubNavItem[];
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
  { name: 'Orders', nameAr: 'الطلبات', href: '/orders', icon: Receipt },
  { 
    name: 'Items', 
    nameAr: 'المواد', 
    href: '/items', 
    icon: Package,
    subItems: [
      { name: 'Raw Items', nameAr: 'المواد الخام', href: '/items?tab=raw', icon: Package },
      { name: 'Composite Items', nameAr: 'المواد المركبة', href: '/items?tab=production', icon: Layers },
      { name: 'Production of Composite Items', nameAr: 'إنتاج المواد المركبة', href: '/items?tab=composite-production', icon: ClipboardList },
    ]
  },
  { name: 'Products', nameAr: 'المنتجات', href: '/products', icon: ShoppingBag },
  { name: 'Bundles', nameAr: 'الباقات', href: '/bundles', icon: Boxes },
  { name: 'Categories', nameAr: 'الفئات', href: '/categories', icon: FolderTree },
  { 
    name: 'Inventory', 
    nameAr: 'المخزون', 
    href: '/inventory', 
    icon: Warehouse,
    subItems: [
      { name: 'Inventory', nameAr: 'المخزون', href: '/inventory?tab=inventory', icon: PackageCheck },
      { name: 'Vendors', nameAr: 'الموردين', href: '/inventory?tab=vendors', icon: Truck },
      { name: 'Purchase Orders', nameAr: 'أوامر الشراء', href: '/inventory?tab=purchase-orders', icon: FileText },
      { name: 'Transfers', nameAr: 'التحويلات', href: '/inventory?tab=transfers', icon: ArrowLeftRight },
      { name: 'Inventory Counts', nameAr: 'جرد المخزون', href: '/inventory?tab=counts', icon: ClipboardList },
    ]
  },
  { name: 'Delivery', nameAr: 'التوصيل', href: '/delivery', icon: Truck },
  { name: 'Tables', nameAr: 'الطاولات', href: '/tables', icon: Armchair },
  { name: 'Drivers', nameAr: 'السائقين', href: '/drivers', icon: Car },
  { name: 'Discounts', nameAr: 'الخصومات', href: '/discounts', icon: Percent },
  { name: 'Users-Roles', nameAr: 'المستخدمين', href: '/users-roles', icon: UserCog },
  { name: 'Attendance', nameAr: 'الحضور', href: '/attendance', icon: Clock },
  { name: 'Requests', nameAr: 'طلبات الدعم', href: '/requests', icon: MessageSquareMore },
  { name: 'Settings', nameAr: 'الإعدادات', href: '/settings', icon: Settings },
];

export function Sidebar({ business }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { language, isRTL, t } = useLanguage();

  // Store-setup is exclusively for owners - no filtering needed
  // All nav items are accessible to logged-in users (who must be owners)
  const filteredNavItems = navItems;

  // Check if a href matches the current URL (including query params)
  const isLinkActive = (href: string) => {
    const [hrefPath, hrefQuery] = href.split('?');
    
    // Check if path matches
    if (pathname !== hrefPath) return false;
    
    // If href has query params, check if they match
    if (hrefQuery) {
      const params = new URLSearchParams(hrefQuery);
      for (const [key, value] of params.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }
    
    // If no query params in href, only active if current URL also has no relevant params
    return true;
  };

  return (
    <aside 
      dir="ltr"
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } ${isRTL ? 'border-l' : 'border-r'} border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hidden md:flex flex-col sticky top-0 h-screen z-40 transition-all duration-300`}
    >
      {/* Logo */}
      <div className={`p-6 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="h-10 w-10 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center shadow-zinc-500/20 shadow-lg flex-shrink-0">
          <Command className="w-5 h-5 text-white dark:text-zinc-900" />
        </div>
        {!collapsed && (
          <motion.span 
            initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-bold text-lg tracking-tight text-zinc-900 dark:text-white whitespace-nowrap"
          >
            Sylo System
          </motion.span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-6">
        <div className={`text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 ${collapsed ? 'text-center' : 'px-3'} ${isRTL ? 'text-right' : ''}`}>
          {collapsed ? '—' : t('Menu Setup', 'إعداد القائمة')}
        </div>
        
        {filteredNavItems.map((item) => {
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isSubActive = hasSubItems && item.subItems?.some(sub => isLinkActive(sub.href));
          const isExpanded = hoveredItem === item.name || isSubActive;
          const isActive = !isSubActive && (pathname === item.href || (pathname === '/' && item.href === '/items'));
          const Icon = item.icon;
          const displayName = isRTL ? item.nameAr : item.name;
          
          return (
            <div key={item.name}>
              {hasSubItems ? (
                <div 
                  className="flex flex-col"
                  onMouseEnter={() => !collapsed && setHoveredItem(item.name)}
                  onMouseLeave={() => !collapsed && setHoveredItem(null)}
                >
                  {/* Parent item row */}
                  <div className="flex items-center">
                    <div
                      className={`flex-1 flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative cursor-pointer ${
                        isActive || isSubActive
                          ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      } ${collapsed ? 'justify-center' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${
                        isActive || isSubActive
                          ? 'text-zinc-900 dark:text-white' 
                          : 'group-hover:text-zinc-900 dark:group-hover:text-white'
                      }`} />
                      
                      {!collapsed && (
                        <>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`whitespace-nowrap flex-1 ${isRTL ? 'text-right' : 'text-left'}`}
                          >
                            {displayName}
                          </motion.span>
                          
                          {/* Chevron indicator */}
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-zinc-400"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        </>
                      )}
                      
                      {/* Active indicator */}
                      {isSubActive && (
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
                    </div>
                  </div>
                  
                  {/* Sub-items */}
                  <AnimatePresence>
                    {!collapsed && isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className={`${isRTL ? 'pr-4 mr-3 border-r' : 'pl-4 ml-3 border-l'} border-zinc-200 dark:border-zinc-700 mt-1 space-y-1`}>
                          {item.subItems?.map((subItem) => {
                            const isSubItemActive = isLinkActive(subItem.href);
                            const SubIcon = subItem.icon;
                            const subDisplayName = isRTL ? subItem.nameAr : subItem.name;
                            
                            return (
                              <Link
                                key={subItem.name}
                                href={subItem.href}
                                prefetch={false}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${isRTL ? 'flex-row-reverse' : ''} ${
                                  isSubItemActive 
                                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                                }`}
                              >
                                <SubIcon className={`w-4 h-4 flex-shrink-0 ${
                                  isSubItemActive 
                                    ? 'text-zinc-900 dark:text-white' 
                                    : 'group-hover:text-zinc-900 dark:group-hover:text-white'
                                }`} />
                                <span className={`text-sm leading-tight ${isRTL ? 'text-right' : 'text-left'}`}>
                                  {subDisplayName}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                // Regular item without sub-items
                <Link
                  href={item.href}
                  prefetch={false}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${isRTL ? 'flex-row-reverse' : ''} ${
                    isActive 
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-medium' 
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  } ${collapsed ? 'justify-center' : ''}`}
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
                      className={`whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`}
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
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all ${collapsed ? 'justify-center' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
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
