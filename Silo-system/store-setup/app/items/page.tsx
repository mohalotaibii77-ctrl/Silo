'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, LogOut, User, Command, Bell, Search, Plus, Edit, Trash2, DollarSign, ChevronDown, Building2, Check, Factory, Eye } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { AddItemModal } from '@/components/items/add-item-modal';
import { AddCompositeItemModal } from '@/components/items/add-composite-item-modal';
import { EditPriceModal } from '@/components/items/edit-price-modal';
import { ViewItemModal } from '@/components/items/view-item-modal';
import { EditItemModal } from '@/components/items/edit-item-modal';
import { motion, AnimatePresence } from 'framer-motion';
import { Item, ITEM_CATEGORIES, ItemCategory, CATEGORY_TRANSLATIONS, CompositeItem } from '@/types/items';
import { getItems, deleteItem, getCompositeItem } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';
import api from '@/lib/api';

type ItemTab = 'raw' | 'production';

interface User {
  id: number;
  username: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

interface Business {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
  currency?: string;
  language?: string;
}

interface WorkspaceBusiness extends Business {
  role?: string;
}

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  KWD: 'KD',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
  QAR: 'QAR',
  BHD: 'BHD',
  OMR: 'OMR',
  EGP: 'EGP',
  JOD: 'JD',
  LBP: 'LBP',
  INR: '₹',
  PKR: 'PKR',
  CNY: '¥',
  JPY: '¥',
  KRW: '₩',
  THB: '฿',
  MYR: 'RM',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  TRY: '₺',
  RUB: '₽',
  BRL: 'R$',
  MXN: 'MX$',
  ZAR: 'R',
};

// Category colors for badges
const categoryColors: Record<ItemCategory, string> = {
  vegetable: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  fruit: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300',
  meat: 'bg-zinc-300 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-200',
  poultry: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  seafood: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300',
  dairy: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  grain: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300',
  bread: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  sauce: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300',
  condiment: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  spice: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300',
  oil: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  beverage: 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300',
  sweetener: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  other: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400',
};

export default function ItemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, isRTL, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [compositeDetails, setCompositeDetails] = useState<Map<number, CompositeItem>>(new Map());
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompositeModal, setShowCompositeModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceBusiness[]>([]);
  
  // Read initial tab from URL params
  const tabParam = searchParams.get('tab');
  const initialTab: ItemTab = tabParam === 'production' ? 'production' : 'raw';
  const [activeTab, setActiveTab] = useState<ItemTab>(initialTab);
  
  // Update tab when URL params change
  useEffect(() => {
    const newTab: ItemTab = tabParam === 'production' ? 'production' : 'raw';
    setActiveTab(newTab);
  }, [tabParam]);

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
        handleLogout();
        return;
      }
      setUser(parsedUser);
      if (storedBusiness) {
        setBusiness(JSON.parse(storedBusiness));
      }

      // Fetch workspaces if user is an owner
      if (parsedUser.role === 'owner' && parsedUser.username) {
        fetchWorkspaces(parsedUser.username);
      }
    } catch {
      router.push('/login');
      return;
    }

    setLoading(false);
  }, [router]);

  const fetchWorkspaces = async (username: string) => {
    try {
      const response = await api.get(`/owners/businesses-by-username?username=${encodeURIComponent(username)}`);
      if (response.data.businesses && response.data.businesses.length > 0) {
        setWorkspaces(response.data.businesses);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    }
  };

  const switchWorkspace = (newBusiness: WorkspaceBusiness) => {
    localStorage.setItem('setup_business', JSON.stringify(newBusiness));
    setBusiness(newBusiness);
    setShowWorkspaceDropdown(false);

    const lang = newBusiness.language || 'en';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    window.location.reload();
  };

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const filters = filterCategory !== 'all' ? { category: filterCategory as ItemCategory } : undefined;
      const data = await getItems(filters);
      setItems(data);

      // Pre-fetch composite item details in the background
      const compositeItems = data.filter(item => item.is_composite);
      if (compositeItems.length > 0) {
        const detailsMap = new Map<number, CompositeItem>();
        
        // Fetch all composite details in parallel
        const detailsPromises = compositeItems.map(async (item) => {
          try {
            const details = await getCompositeItem(item.id);
            detailsMap.set(item.id, details);
          } catch (err) {
            console.error(`Failed to fetch composite details for item ${item.id}:`, err);
          }
        });
        
        await Promise.all(detailsPromises);
        setCompositeDetails(detailsMap);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    if (!loading) {
      fetchItems();
    }
  }, [loading, fetchItems]);

  const handleLogout = () => {
    localStorage.removeItem('setup_token');
    localStorage.removeItem('setup_user');
    localStorage.removeItem('setup_business');
    router.push('/login');
  };

  const handleDeleteItem = async (itemId: number) => {
    const confirmMsg = isRTL ? 'هل أنت متأكد من حذف هذه المادة؟' : 'Are you sure you want to delete this item?';
    if (!confirm(confirmMsg)) return;
    try {
      await deleteItem(itemId);
      fetchItems();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
    setActiveMenu(null);
  };

  const handleEditPrice = (item: Item) => {
    setSelectedItem(item);
    setShowPriceModal(true);
    setActiveMenu(null);
  };

  // Filter items by search query and tab (raw vs composite)
  const filteredItems = items.filter(item => {
    const matchesSearch = item.status === 'active' &&
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter by tab - raw items vs composite (production) items
    const matchesTab = activeTab === 'raw' ? !item.is_composite : item.is_composite;
    
    return matchesSearch && matchesTab;
  });

  const formatCategoryLabel = (category: string) => {
    const cat = category as ItemCategory;
    if (CATEGORY_TRANSLATIONS[cat]) {
      return isRTL ? CATEGORY_TRANSLATIONS[cat].ar : CATEGORY_TRANSLATIONS[cat].en;
    }
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Get the display price for an item (business price if set, otherwise default)
  const getDisplayPrice = (item: Item) => {
    return item.effective_price ?? item.business_price ?? item.cost_per_unit;
  };

  // Check if item has a custom business price
  const hasCustomPrice = (item: Item) => {
    return item.business_price !== null && item.business_price !== undefined;
  };

  // Format price with business currency
  const formatPrice = (price: number) => {
    const currency = business?.currency || 'USD';
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol} ${price.toFixed(3)}`;
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
            <div className="relative hidden sm:block">
              <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
              <input 
                type="text" 
                placeholder={t('Search items...', 'البحث في المواد...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 w-64 rounded-full bg-zinc-100 dark:bg-zinc-800 border-none text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 relative">
              <Bell className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
            <ModeToggle />
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
            {/* Workspace Switcher & User Profile */}
            <div 
              className="relative"
              onMouseEnter={() => workspaces.length > 1 && setShowWorkspaceDropdown(true)}
              onMouseLeave={() => setShowWorkspaceDropdown(false)}
            >
              <button className={`flex items-center gap-3 ${workspaces.length > 1 ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 -mx-2 px-2 py-1.5 rounded-lg transition-colors' : ''}`}>
                <div className={`hidden sm:block ${isRTL ? 'text-left' : 'text-right'}`}>
                  <p className="font-semibold text-sm text-zinc-900 dark:text-white">
                    {user?.first_name || user?.username}
                  </p>
                  <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                    {user?.role}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <User size={16} className="text-zinc-600 dark:text-zinc-400" />
                </div>
                {workspaces.length > 1 && (
                  <ChevronDown size={14} className={`text-zinc-400 transition-transform ${showWorkspaceDropdown ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* Workspace Dropdown */}
              <AnimatePresence>
                {showWorkspaceDropdown && workspaces.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-72 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 overflow-hidden`}
                  >
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('Switch Workspace', 'تبديل مساحة العمل')}
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-2">
                      {workspaces.map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => switchWorkspace(ws)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                            business?.id === ws.id ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                            {ws.logo_url ? (
                              <img src={ws.logo_url} alt={ws.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Building2 size={18} className="text-zinc-500 dark:text-zinc-400" />
                            )}
                          </div>
                          <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <p className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                              {ws.name}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              @{ws.slug}
                            </p>
                          </div>
                          {business?.id === ws.id && (
                            <Check size={16} className="text-emerald-500 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              title={t('Logout', 'تسجيل الخروج')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8" dir={isRTL ? 'rtl' : 'ltr'}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                  {t('Items', 'المواد الخام')}
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  {t('Manage raw materials and ingredients', 'إدارة المواد الخام والمكونات')}
                </p>
              </div>
              {/* Add button - context-aware based on active tab */}
              <button 
                onClick={() => activeTab === 'raw' ? setShowAddModal(true) : setShowCompositeModal(true)}
                className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                {activeTab === 'raw' ? t('Add Item', 'إضافة مادة') : t('Add Composite', 'إضافة مادة مركبة')}
              </button>
            </div>

            {/* Tab Navigation with Search */}
            <div className={`flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
              <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl w-fit">
                <button
                  onClick={() => router.push('/items?tab=raw')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'raw'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  {t('Raw Items', 'المواد الخام')}
                </button>
                <button
                  onClick={() => router.push('/items?tab=production')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'production'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Factory className="w-4 h-4" />
                  {t('Composite Items', 'المواد المركبة')}
                </button>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('Search items...', 'البحث عن مواد...')}
                  className={`${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 w-64 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
                />
              </div>
            </div>

            {/* Category Filter Tabs - Two lines, wrap naturally */}
            <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filterCategory === 'all'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {t('All', 'الكل')}
              </button>
              {ITEM_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setFilterCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filterCategory === category
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {formatCategoryLabel(category)}
                </button>
              ))}
            </div>

            {/* Items List */}
            {itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Command className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
                {activeTab === 'raw' ? (
                  <>
                    <Package className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                      {t('No items yet', 'لا توجد مواد بعد')}
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                      {t('Get started by adding your first ingredient or raw material', 'ابدأ بإضافة المكون أو المادة الخام الأولى')}
                    </p>
                    <button 
                      onClick={() => setShowAddModal(true)}
                      className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {t('Add Item', 'إضافة مادة')}
                    </button>
                  </>
                ) : (
                  <>
                    <Factory className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                      {t('No composite items yet', 'لا توجد مواد مركبة بعد')}
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4">
                      {t('Create composite items by combining raw materials (e.g., sauces, marinades, premixes)', 'أنشئ مواد مركبة عن طريق دمج المواد الخام (مثل الصلصات والتتبيلات والخلطات)')}
                    </p>
                    <button 
                      onClick={() => setShowCompositeModal(true)}
                      className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {t('Add Composite Item', 'إضافة مادة مركبة')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Table Header */}
                <div className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider`}>
                  <div className="col-span-4">{activeTab === 'raw' ? t('Item', 'المادة') : t('Composite Item', 'المادة المركبة')}</div>
                  <div className="col-span-2">{t('Category', 'الفئة')}</div>
                  <div className="col-span-2">{activeTab === 'raw' ? t('Unit', 'الوحدة') : t('Yield Unit', 'وحدة الإنتاج')}</div>
                  <div className="col-span-2">{activeTab === 'raw' ? t('Your Price', 'السعر') : t('Cost', 'التكلفة')}</div>
                  <div className={`col-span-2 ${isRTL ? 'text-left' : 'text-right'}`}>{t('Actions', 'إجراءات')}</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="col-span-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            activeTab === 'production' 
                              ? 'bg-zinc-200 dark:bg-zinc-700' 
                              : 'bg-zinc-100 dark:bg-zinc-800'
                          }`}>
                            {activeTab === 'production' ? (
                              <Factory className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                            ) : (
                              <Package className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-zinc-900 dark:text-white">
                                {business?.language === 'ar' && item.name_ar ? item.name_ar : item.name}
                              </p>
                              {!item.business_id && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                                  {t('General', 'عام')}
                                </span>
                              )}
                            </div>
                            {/* Show secondary name only if different from primary */}
                            {business?.language === 'ar' && item.name && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.name}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${categoryColors[item.category]}`}>
                          {formatCategoryLabel(item.category)}
                        </span>
                      </div>
                      <div className="col-span-2 text-zinc-600 dark:text-zinc-400">
                        {item.unit}
                      </div>
                      <div className="col-span-2">
                        <button
                          onClick={() => handleEditPrice(item)}
                          className="group flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 rounded-lg -mx-2 transition-colors"
                        >
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {formatPrice(getDisplayPrice(item))}
                          </span>
                          {hasCustomPrice(item) && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 uppercase">
                              {t('Custom', 'مخصص')}
                            </span>
                          )}
                          <Edit className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                      <div className={`col-span-2 flex items-center gap-2 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowViewModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          {t('View', 'عرض')}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowEditModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          {t('Edit', 'تعديل')}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchItems}
        language={business?.language}
        currency={business?.currency}
      />

      {/* Edit Price Modal */}
      <EditPriceModal
        isOpen={showPriceModal}
        item={selectedItem}
        onClose={() => {
          setShowPriceModal(false);
          setSelectedItem(null);
        }}
        onSuccess={fetchItems}
        currency={business?.currency}
      />

      {/* Add Composite Item Modal */}
      <AddCompositeItemModal
        isOpen={showCompositeModal}
        onClose={() => setShowCompositeModal(false)}
        onSuccess={fetchItems}
        language={business?.language}
        currency={business?.currency}
      />

      {/* View Item Modal */}
      <ViewItemModal
        isOpen={showViewModal}
        item={selectedItem}
        compositeDetails={selectedItem?.is_composite ? compositeDetails.get(selectedItem.id) : undefined}
        onClose={() => {
          setShowViewModal(false);
          setSelectedItem(null);
        }}
        currency={business?.currency}
      />

      {/* Edit Item Modal */}
      <EditItemModal
        isOpen={showEditModal}
        item={selectedItem}
        compositeDetails={selectedItem?.is_composite ? compositeDetails.get(selectedItem.id) : undefined}
        onClose={() => {
          setShowEditModal(false);
          setSelectedItem(null);
        }}
        onSuccess={fetchItems}
        currency={business?.currency}
      />

    </div>
  );
}
