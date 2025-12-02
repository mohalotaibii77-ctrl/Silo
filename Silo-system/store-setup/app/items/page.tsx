'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Package, LogOut, User, Command, Bell, Search, Plus, MoreVertical, Edit, Trash2, DollarSign } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { AddItemModal } from '@/components/items/add-item-modal';
import { EditPriceModal } from '@/components/items/edit-price-modal';
import { motion } from 'framer-motion';
import { Item, ITEM_CATEGORIES, ItemCategory, CATEGORY_TRANSLATIONS } from '@/types/items';
import { getItems, deleteItem } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';

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
  const { language, isRTL, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

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
    } catch {
      router.push('/login');
      return;
    }

    setLoading(false);
  }, [router]);

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const filters = filterCategory !== 'all' ? { category: filterCategory as ItemCategory } : undefined;
      const data = await getItems(filters);
      setItems(data);
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

  // Filter items by search query (show all items - both general and business-specific)
  const filteredItems = items.filter(item =>
    item.status === 'active' &&
    (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
            <div className="flex items-center gap-3">
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
              <button 
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('Add Item', 'إضافة مادة')}
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filterCategory === 'all'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {t('All Items', 'جميع المواد')}
              </button>
              {ITEM_CATEGORIES.slice(0, 8).map((category) => (
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
              {/* More dropdown for additional categories */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-none outline-none cursor-pointer"
              >
                <option value="all">{t('...More', '...المزيد')}</option>
                {ITEM_CATEGORIES.slice(8).map((category) => (
                  <option key={category} value={category}>{formatCategoryLabel(category)}</option>
                ))}
              </select>
            </div>

            {/* Items List */}
            {itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Command className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
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
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Table Header */}
                <div className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider`}>
                  <div className="col-span-4">{t('Item', 'المادة')}</div>
                  <div className="col-span-2">{t('Category', 'الفئة')}</div>
                  <div className="col-span-2">{t('Unit', 'الوحدة')}</div>
                  <div className="col-span-2">{t('Your Price', 'السعر')}</div>
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
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <Package className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
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
                      <div className={`col-span-2 relative ${isRTL ? 'text-left' : 'text-right'}`}>
                        <button
                          onClick={() => setActiveMenu(activeMenu === item.id ? null : item.id)}
                          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {activeMenu === item.id && (
                          <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-10 w-44 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-10`} dir={isRTL ? 'rtl' : 'ltr'}>
                            <button
                              onClick={() => handleEditPrice(item)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <DollarSign className="w-4 h-4" />
                              {t('Edit Price', 'تعديل السعر')}
                            </button>
                            {/* Only show edit/delete for business-owned items */}
                            {item.business_id && (
                              <>
                                <button
                                  onClick={() => {
                                    // TODO: Open full edit modal
                                    setActiveMenu(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                >
                                  <Edit className="w-4 h-4" />
                                  {t('Edit Item', 'تعديل المادة')}
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {t('Delete', 'حذف')}
                                </button>
                              </>
                            )}
                          </div>
                        )}
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
    </div>
  );
}
