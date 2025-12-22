'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, LogOut, User, Command, Bell, Search, Plus, Edit, Trash2, DollarSign, ChevronDown, Building2, Check, Eye, ClipboardList, Calendar, Layers, Play, MapPin, Store } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Sidebar } from '@/components/sidebar';
import { AddItemModal } from '@/components/items/add-item-modal';
import { AddCompositeItemModal } from '@/components/items/add-composite-item-modal';
import { EditPriceModal } from '@/components/items/edit-price-modal';
import { ViewItemModal } from '@/components/items/view-item-modal';
import { EditItemModal } from '@/components/items/edit-item-modal';
import { DeleteItemModal } from '@/components/items/delete-item-modal';
import { ProduceModal } from '@/components/items/produce-modal';
import { motion, AnimatePresence } from 'framer-motion';
import { Item, ItemCategory, ItemType, CompositeItem } from '@/types/items';
import { getItems, getCompositeItems, getCompositeItem, getProductions, getProductionStats, Production, ProductionStats } from '@/lib/items-api';
import { useLanguage } from '@/lib/language-context';
import { useConfig } from '@/lib/config-context';
import api from '@/lib/api';

type ItemTab = 'raw' | 'production' | 'composite-production';

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

interface Branch {
  id: number;
  business_id: number;
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_main: boolean;
  is_active: boolean;
}

// Currency symbols now provided by config context

// Category colors for badges
const categoryColors: Record<ItemCategory, string> = {
  // Food categories
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
  // Non-food (accessories)
  non_food: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

export default function ItemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, isRTL, t } = useLanguage();
  const { config, getCategoryLabel: getConfigCategoryLabel, getCurrencySymbol } = useConfig();
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [compositeItemsList, setCompositeItemsList] = useState<Item[]>([]);
  const [compositeDetails, setCompositeDetails] = useState<Map<number, CompositeItem>>(new Map());
  const [itemsLoading, setItemsLoading] = useState(false);
  const [compositeItemsLoading, setCompositeItemsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompositeModal, setShowCompositeModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterItemType, setFilterItemType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceBusiness[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  
  // Production state
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [producingItem, setProducingItem] = useState<CompositeItem | null>(null);
  const [productions, setProductions] = useState<Production[]>([]);
  const [productionStats, setProductionStats] = useState<ProductionStats | null>(null);
  const [productionsLoading, setProductionsLoading] = useState(false);
  
  // Read initial tab from URL params
  const tabParam = searchParams.get('tab');
  const initialTab: ItemTab = tabParam === 'production' ? 'production' : tabParam === 'composite-production' ? 'composite-production' : 'raw';
  const [activeTab, setActiveTab] = useState<ItemTab>(initialTab);
  
  // Update tab when URL params change
  useEffect(() => {
    const newTab: ItemTab = tabParam === 'production' ? 'production' : tabParam === 'composite-production' ? 'composite-production' : 'raw';
    setActiveTab(newTab);
  }, [tabParam]);

  useEffect(() => {
    const token = localStorage.getItem('setup_token');
    const storedUser = localStorage.getItem('setup_user');
    const storedBusiness = localStorage.getItem('setup_business');
    const storedBranch = localStorage.getItem('setup_branch');

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
      
      let parsedBusiness: Business | null = null;
      if (storedBusiness) {
        parsedBusiness = JSON.parse(storedBusiness);
        setBusiness(parsedBusiness);
      }

      // Restore selected branch from localStorage
      if (storedBranch) {
        try {
          setCurrentBranch(JSON.parse(storedBranch));
        } catch {}
      }

      // Fetch workspaces if user is an owner
      if (parsedUser.role === 'owner' && parsedUser.username) {
        fetchWorkspaces(parsedUser.username);
      }

      // Fetch branches for the current business
      if (parsedBusiness?.id) {
        fetchBranches(parsedBusiness.id);
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

  const fetchBranches = async (businessId: number) => {
    try {
      const response = await api.get(`/businesses/${businessId}/branches`);
      if (response.data.branches && response.data.branches.length > 0) {
        setBranches(response.data.branches);
        
        // If no branch is selected, select the main branch or first one
        const storedBranch = localStorage.getItem('setup_branch');
        if (!storedBranch) {
          const mainBranch = response.data.branches.find((b: Branch) => b.is_main) || response.data.branches[0];
          setCurrentBranch(mainBranch);
          localStorage.setItem('setup_branch', JSON.stringify(mainBranch));
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    }
  };

  const switchBranch = (branch: Branch) => {
    localStorage.setItem('setup_branch', JSON.stringify(branch));
    setCurrentBranch(branch);
    setShowBranchDropdown(false);
    
    // Reload to refresh data for the new branch context
    window.location.reload();
  };

  const switchWorkspace = (newBusiness: WorkspaceBusiness) => {
    localStorage.setItem('setup_business', JSON.stringify(newBusiness));
    setBusiness(newBusiness);
    setShowWorkspaceDropdown(false);

    // Clear branch selection when switching business
    localStorage.removeItem('setup_branch');
    setCurrentBranch(null);
    setBranches([]);

    const lang = newBusiness.language || 'en';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    window.location.reload();
  };

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const filters: { category?: ItemCategory; item_type?: ItemType } = {};
      if (filterCategory !== 'all') filters.category = filterCategory as ItemCategory;
      if (filterItemType !== 'all') filters.item_type = filterItemType as ItemType;
      const data = await getItems(Object.keys(filters).length > 0 ? filters : undefined);
      // Filter out composite items - they're fetched separately
      const rawItems = data.filter(item => !item.is_composite);
      setItems(rawItems);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [filterCategory, filterItemType]);

  // Fetch composite items from dedicated endpoint
  const fetchCompositeItemsList = useCallback(async () => {
    setCompositeItemsLoading(true);
    try {
      const data = await getCompositeItems();
      setCompositeItemsList(data);
      
      // Also fetch details for each composite item
      if (data.length > 0) {
        const detailsMap = new Map<number, CompositeItem>();
        const detailsPromises = data.map(async (item) => {
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
      console.error('Failed to fetch composite items:', err);
    } finally {
      setCompositeItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchItems();
      fetchCompositeItemsList();
    }
  }, [loading, fetchItems, fetchCompositeItemsList]);

  // Fetch productions for the production tab
  const fetchProductionData = useCallback(async () => {
    setProductionsLoading(true);
    try {
      const [productionsData, statsData] = await Promise.all([
        getProductions({ limit: 10 }),
        getProductionStats(),
      ]);
      setProductions(productionsData);
      setProductionStats(statsData);
    } catch (err) {
      console.error('Failed to fetch production data:', err);
    } finally {
      setProductionsLoading(false);
    }
  }, []);

  // Fetch production data when tab changes to composite-production
  useEffect(() => {
    if (!loading && activeTab === 'composite-production') {
      fetchProductionData();
      fetchCompositeItemsList();
    }
  }, [loading, activeTab, fetchProductionData, fetchCompositeItemsList]);

  const handleLogout = () => {
    localStorage.removeItem('setup_token');
    localStorage.removeItem('setup_user');
    localStorage.removeItem('setup_business');
    router.push('/login');
  };

  const handleDeleteItem = (item: Item) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
    setActiveMenu(null);
  };

  const handleEditPrice = (item: Item) => {
    setSelectedItem(item);
    setShowPriceModal(true);
    setActiveMenu(null);
  };

  // Filter items by search query
  // For raw tab: use items list (raw items only)
  // For production tab: use compositeItemsList (from /inventory/composite-items)
  const sourceItems = activeTab === 'raw' ? items : compositeItemsList;
  const filteredItems = sourceItems.filter(item => {
    const matchesSearch = item.status === 'active' &&
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesSearch;
  });

  const formatCategoryLabel = (category: string) => {
    // Use config context for category labels
    return getConfigCategoryLabel(category, isRTL ? 'ar' : 'en');
  };

  // Get the display price for an item (business price if set, otherwise default)
  const getDisplayPrice = (item: Item) => {
    return item.effective_price ?? item.business_price ?? item.cost_per_unit;
  };

  // Check if item has a custom business price
  const hasCustomPrice = (item: Item) => {
    return item.business_price !== null && item.business_price !== undefined;
  };

  // Format price with business currency - handles small values like 0.0003
  const formatPrice = (price: number) => {
    const currencyCode = business?.currency || '';
    const symbol = getCurrencySymbol(currencyCode);
    // For very small amounts (< 0.001), show more decimal places to avoid rounding to 0
    if (price > 0 && price < 0.001) {
      const significantDecimals = Math.max(4, -Math.floor(Math.log10(price)) + 2);
      return `${symbol} ${price.toFixed(Math.min(significantDecimals, 6))}`;
    }
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
      <Suspense fallback={<div className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hidden md:block" />}>
        <Sidebar business={business} />
      </Suspense>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between">
          {/* Business & Branch Switcher */}
          <div className="flex items-center gap-4">
            <div 
              className="relative"
              onMouseEnter={() => branches.length > 1 && setShowBranchDropdown(true)}
              onMouseLeave={() => setShowBranchDropdown(false)}
            >
              <button 
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                {/* Business Logo */}
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center flex-shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  {business?.logo_url ? (
                    <img src={business.logo_url} alt={business.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Store size={16} className="text-zinc-500 dark:text-zinc-400" />
                  )}
                </div>
                
                {/* Business & Branch Names */}
                <div className={`flex flex-col ${isRTL ? 'items-end' : 'items-start'}`}>
                  <span className="font-semibold text-sm text-zinc-900 dark:text-white leading-tight">
                    {business?.name || t('Select Business', 'اختر المنشأة')}
                  </span>
                  {currentBranch && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <MapPin size={10} />
                      {currentBranch.name}
                      {currentBranch.is_main && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">
                          {t('Main', 'رئيسي')}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                
                {branches.length > 1 && (
                  <ChevronDown size={16} className={`text-zinc-400 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
                )}
              </button>

              {/* Branch Dropdown */}
              <AnimatePresence>
                {showBranchDropdown && branches.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-full mt-2 ${isRTL ? 'right-0' : 'left-0'} w-72 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 overflow-hidden`}
                  >
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('Switch Branch', 'تبديل الفرع')}
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-2">
                      {branches.filter(b => b.is_active).map((branch) => (
                        <button
                          key={branch.id}
                          onClick={() => switchBranch(branch)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                            currentBranch?.id === branch.id ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''
                          } ${isRTL ? 'flex-row-reverse' : ''}`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
                            <MapPin size={18} className="text-zinc-500 dark:text-zinc-400" />
                          </div>
                          <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <p className="font-medium text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                              {branch.name}
                              {branch.is_main && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">
                                  {t('Main', 'رئيسي')}
                                </span>
                              )}
                            </p>
                            {branch.address && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                {branch.address}
                              </p>
                            )}
                          </div>
                          {currentBranch?.id === branch.id && (
                            <Check size={16} className="text-emerald-500 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
              {activeTab !== 'composite-production' && (
                <button 
                  onClick={() => activeTab === 'raw' ? setShowAddModal(true) : setShowCompositeModal(true)}
                  className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {activeTab === 'raw' ? t('Add Item', 'إضافة مادة') : t('Add Composite', 'إضافة مادة مركبة')}
                </button>
              )}
            </div>

            {/* Tab Navigation with Search */}
            <div className={`flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
              <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl w-fit flex-wrap">
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
                  <Layers className="w-4 h-4" />
                  {t('Composite Items', 'المواد المركبة')}
                </button>
                <button
                  onClick={() => router.push('/items?tab=composite-production')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'composite-production'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  {t('Production', 'الإنتاج')}
                </button>
              </div>
              
              {/* Search - only show for raw/production tabs */}
              {activeTab !== 'composite-production' && (
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
              )}
            </div>

            {/* Item Type Filter - Only for raw/production tabs */}
            {activeTab !== 'composite-production' && (
              <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => { setFilterItemType('all'); setFilterCategory('all'); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filterItemType === 'all'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {t('All Types', 'كل الأنواع')}
                </button>
                {(config?.itemTypes || []).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => { setFilterItemType(type.id); setFilterCategory('all'); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      filterItemType === type.id
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {isRTL ? type.name_ar : type.name}
                  </button>
                ))}
              </div>
            )}

            {/* Category Filter Tabs - Only for raw/production tabs */}
            {activeTab !== 'composite-production' && (
              <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    filterCategory === 'all'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {t('All Categories', 'كل الفئات')}
                </button>
                {(filterItemType === 'all' 
                  ? (config?.itemCategories || [])
                  : (config?.itemCategories || []).filter(cat => cat.item_type === filterItemType)
                ).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      filterCategory === cat.id
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {formatCategoryLabel(cat.id)}
                  </button>
                ))}
              </div>
            )}

            {/* Production of Composite Items Tab Content */}
            {activeTab === 'composite-production' && (
              <div className="space-y-6">
                {/* Header with Stats */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {t('Composite Item Production', 'إنتاج المواد المركبة')}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      {t('Produce composite items from their recipes', 'إنتاج المواد المركبة من وصفاتها')}
                    </p>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {productionStats?.today_count || 0}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Today\'s Batches', 'دفعات اليوم')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {productionStats?.week_count || 0}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('This Week', 'هذا الأسبوع')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                          <Layers className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {compositeItemsList.length}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Composite Items', 'المواد المركبة')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Composite Items List */}
                {compositeItemsLoading || productionsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Command className="w-6 h-6 animate-spin text-zinc-400" />
                  </div>
                ) : compositeItemsList.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                      <Layers className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                      {t('No composite items yet', 'لا توجد مواد مركبة بعد')}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                      {t(
                        'Create composite items in the "Composite Items" tab first, then you can produce them here',
                        'أنشئ مواد مركبة في تبويب "المواد المركبة" أولاً، ثم يمكنك إنتاجها هنا'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {compositeItemsList.map((item) => {
                      const details = compositeDetails.get(item.id);
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col"
                        >
                          <div className="p-5 flex-1">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                <Layers className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-zinc-900 dark:text-white truncate">
                                  {isRTL && item.name_ar ? item.name_ar : item.name}
                                </h3>
                                {/* Show secondary name - always reserve space for consistent height */}
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 truncate min-h-[20px]">
                                  {((isRTL && item.name) || (!isRTL && item.name_ar)) 
                                    ? (isRTL ? item.name : item.name_ar)
                                    : '\u00A0' /* non-breaking space to maintain height */
                                  }
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                    {t('Batch:', 'الدفعة:')} {item.batch_quantity || 1} {item.batch_unit || item.unit}
                                  </span>
                                  {details?.components && (
                                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                      • {details.components.length} {t('ingredients', 'مكون')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Button - always at bottom */}
                          <div className="flex border-t border-zinc-200 dark:border-zinc-800 mt-auto">
                            <button
                              onClick={() => {
                                // Use the details if available, otherwise use basic item info
                                const compositeItem = details || { ...item, components: [] } as CompositeItem;
                                setProducingItem(compositeItem);
                                setShowProduceModal(true);
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                              <Play className="w-4 h-4" />
                              {t('Produce', 'إنتاج')}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Recent Production History */}
                {productions.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                      <h3 className="font-semibold text-zinc-900 dark:text-white">
                        {t('Recent Production', 'الإنتاج الأخير')}
                      </h3>
                    </div>
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {productions.map((production) => (
                        <div
                          key={production.id}
                          className="px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                <Layers className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                              </div>
                              <div>
                                <p className="font-medium text-zinc-900 dark:text-white">
                                  {isRTL && production.composite_item?.name_ar 
                                    ? production.composite_item.name_ar 
                                    : production.composite_item?.name || `Item #${production.composite_item_id}`}
                                </p>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                  {production.batch_count} {t('batch(es)', 'دفعة')} • {production.total_yield} {production.yield_unit}
                                </p>
                              </div>
                            </div>
                            <div className={`text-${isRTL ? 'left' : 'right'}`}>
                              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                {new Date(production.production_date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </p>
                              <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                {production.status === 'completed' ? t('Completed', 'مكتمل') : production.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Items List - Only for raw/production tabs */}
            {activeTab !== 'composite-production' && ((activeTab === 'raw' ? itemsLoading : compositeItemsLoading) ? (
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
                    <Layers className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
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
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Table Header */}
                <div className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider`}>
                  <div className="col-span-3">{activeTab === 'raw' ? t('Item', 'المادة') : t('Composite Item', 'المادة المركبة')}</div>
                  <div className="col-span-2">{t('Category', 'الفئة')}</div>
                  <div className="col-span-1">{activeTab === 'raw' ? t('Unit', 'الوحدة') : t('Yield Unit', 'وحدة الإنتاج')}</div>
                  <div className="col-span-2">{activeTab === 'raw' ? t('Your Price', 'السعر') : t('Cost', 'التكلفة')}</div>
                  <div className={`col-span-4 ${isRTL ? 'text-left' : 'text-right'}`}>{t('Actions', 'إجراءات')}</div>
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
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            activeTab === 'production' 
                              ? 'bg-zinc-200 dark:bg-zinc-700' 
                              : 'bg-zinc-100 dark:bg-zinc-800'
                          }`}>
                            {activeTab === 'production' ? (
                              <Layers className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                            ) : (
                              <Package className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-zinc-900 dark:text-white truncate">
                                {isRTL && item.name_ar ? item.name_ar : item.name}
                              </p>
                              {/* Show General badge for default items, Custom badge for business items with custom price */}
                              {!item.business_id ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex-shrink-0">
                                  {t('General', 'عام')}
                                </span>
                              ) : hasCustomPrice(item) && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 uppercase tracking-wide flex-shrink-0">
                                  {t('Custom', 'مخصص')}
                                </span>
                              )}
                            </div>
                            {/* Show secondary name only if different from primary */}
                            {isRTL && item.name && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{item.name}</p>
                            )}
                            {!isRTL && item.name_ar && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{item.name_ar}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${categoryColors[item.category]}`}>
                          {formatCategoryLabel(item.category)}
                        </span>
                      </div>
                      <div className="col-span-1 text-zinc-600 dark:text-zinc-400 text-sm">
                        {item.unit}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {formatPrice(getDisplayPrice(item))}
                        </span>
                      </div>
                      <div className={`col-span-4 flex items-center gap-1.5 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                        <button
                          onClick={() => handleEditPrice(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title={t('Set Price', 'تحديد السعر')}
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowViewModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title={t('View', 'عرض')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowEditModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title={t('Edit', 'تعديل')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title={t('Delete', 'حذف')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
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
        itemType={filterItemType !== 'all' ? filterItemType as ItemType : undefined}
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

      {/* Delete Item Modal */}
      <DeleteItemModal
        isOpen={showDeleteModal}
        item={selectedItem}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedItem(null);
        }}
        onSuccess={fetchItems}
      />

      {/* Produce Modal */}
      <ProduceModal
        isOpen={showProduceModal}
        onClose={() => {
          setShowProduceModal(false);
          setProducingItem(null);
        }}
        onSuccess={() => {
          fetchProductionData();
          fetchCompositeItemsList();
        }}
        compositeItem={producingItem}
        currency={business?.currency}
      />

    </div>
  );
}
