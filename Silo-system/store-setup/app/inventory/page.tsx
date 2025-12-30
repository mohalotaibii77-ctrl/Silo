'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Warehouse, Search, Package, Plus, Minus,
  Truck, FileText, ArrowLeftRight, ClipboardList,
  Building2, Phone, Mail, MapPin, MoreHorizontal,
  Calendar, Hash, CheckCircle2, Clock, XCircle,
  ArrowRight, Edit2, Trash2, Eye, X, Loader2,
  AlertCircle, ChevronRight, ChevronDown, RefreshCw,
  PackageCheck, AlertTriangle, TrendingUp, TrendingDown,
  Camera, Upload, History, ArrowUpCircle, ArrowDownCircle, RotateCcw
} from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import {
  getVendors, createVendor, updateVendor, deleteVendor,
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder, updatePurchaseOrderStatus, receivePurchaseOrder,
  getTransfers, getTransfer, getTransferDestinations, createTransfer, receiveTransfer, cancelTransfer,
  getInventoryCounts, createInventoryCount, completeInventoryCount,
  getPOTemplates, createPOTemplate, updatePOTemplate, deletePOTemplate,
  getPOActivity,
  getStockLevels, setStockLimits, getStockStats,
  getInventoryTimeline, getItemTimeline, getTimelineStats,
  type Vendor, type PurchaseOrder, type PurchaseOrderItem, type InventoryTransfer, type InventoryCount, type POTemplate, type POActivity, type TransferDestination, type InventoryStock, type StockStats,
  type InventoryTransaction, type TimelineResponse, type TimelineStats, type TransactionType, type DeductionReason
} from '@/lib/inventory-api';
import { AdjustmentModal } from '@/components/inventory/adjustment-modal';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { getItems, type Item } from '@/lib/items-api';
import api from '@/lib/api';

// Countries list for dropdown
const COUNTRIES = [
  { name: 'Afghanistan', code: 'AF' },
  { name: 'Algeria', code: 'DZ' },
  { name: 'Bahrain', code: 'BH' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Canada', code: 'CA' },
  { name: 'China', code: 'CN' },
  { name: 'Egypt', code: 'EG' },
  { name: 'France', code: 'FR' },
  { name: 'Germany', code: 'DE' },
  { name: 'India', code: 'IN' },
  { name: 'Iraq', code: 'IQ' },
  { name: 'Japan', code: 'JP' },
  { name: 'Jordan', code: 'JO' },
  { name: 'Kuwait', code: 'KW' },
  { name: 'Lebanon', code: 'LB' },
  { name: 'Malaysia', code: 'MY' },
  { name: 'Morocco', code: 'MA' },
  { name: 'Oman', code: 'OM' },
  { name: 'Pakistan', code: 'PK' },
  { name: 'Qatar', code: 'QA' },
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'Singapore', code: 'SG' },
  { name: 'South Korea', code: 'KR' },
  { name: 'Spain', code: 'ES' },
  { name: 'Turkey', code: 'TR' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'United States', code: 'US' },
  { name: 'Yemen', code: 'YE' },
];

// Get default country from business localization settings
function getDefaultCountry(): string {
  if (typeof window !== 'undefined') {
    try {
      const storedBusiness = localStorage.getItem('setup_business');
      if (storedBusiness) {
        const business = JSON.parse(storedBusiness);
        // Return business country or empty string - never hardcode a fallback country
        return business.country || '';
      }
    } catch {
      // ignore
    }
  }
  return ''; // No fallback - user must select
}

// Import shared currency utility
import { formatCurrency, getBusinessCurrency, getCurrencySymbol } from '@/lib/currency';

type TabType = 'inventory' | 'vendors' | 'purchase-orders' | 'transfers' | 'counts' | 'timeline';

const tabs: { key: TabType; label: string; labelAr: string; icon: React.ElementType }[] = [
  { key: 'inventory', label: 'Inventory', labelAr: 'المخزون', icon: PackageCheck },
  { key: 'vendors', label: 'Vendors', labelAr: 'الموردين', icon: Truck },
  { key: 'purchase-orders', label: 'Purchase Orders', labelAr: 'أوامر الشراء', icon: FileText },
  { key: 'transfers', label: 'Transfers', labelAr: 'التحويلات', icon: ArrowLeftRight },
  { key: 'counts', label: 'Inventory Counts', labelAr: 'جرد المخزون', icon: ClipboardList },
  { key: 'timeline', label: 'Timeline', labelAr: 'السجل الزمني', icon: History },
];

export default function InventoryPage() {
  const { t, isRTL } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('inventory');

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && tabs.some(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/inventory?tab=${tab}`);
  };

  return (
    <PageLayout searchPlaceholder={{ en: 'Search inventory...', ar: 'البحث في المخزون...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Inventory', 'المخزون')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Manage vendors, orders, transfers, and stock counts', 'إدارة الموردين والطلبات والتحويلات وجرد المخزون')}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {isRTL ? tab.labelAr : tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'inventory' && <InventoryStockTab />}
            {activeTab === 'vendors' && <VendorsTab />}
            {activeTab === 'purchase-orders' && <PurchaseOrdersTab />}
            {activeTab === 'transfers' && <TransfersTab />}
            {activeTab === 'counts' && <InventoryCountsTab />}
            {activeTab === 'timeline' && <TimelineTab />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </PageLayout>
  );
}

// ==================== INVENTORY STOCK TAB ====================
function InventoryStockTab() {
  const { t, isRTL } = useLanguage();
  const [stockItems, setStockItems] = useState<InventoryStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [currentBranchName, setCurrentBranchName] = useState<string>('');
  
  // Stock stats from backend - all calculations done server-side
  const [stockStats, setStockStats] = useState<StockStats>({
    total_items: 0,
    low_stock_count: 0,
    out_of_stock_count: 0,
    healthy_stock_count: 0,
    overstocked_count: 0,
  });
  
  // Edit stock limits modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState<InventoryStock | null>(null);
  const [editMin, setEditMin] = useState<number>(0);
  const [editMax, setEditMax] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Adjustment modal state
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentStock, setAdjustmentStock] = useState<InventoryStock | null>(null);

  // Initialize current branch name from localStorage
  useEffect(() => {
    const storedBranch = localStorage.getItem('setup_branch');
    if (storedBranch) {
      try {
        const branch = JSON.parse(storedBranch);
        if (branch) {
          setCurrentBranchName(isRTL ? branch.name_ar || branch.name : branch.name);
        }
      } catch {}
    }
  }, [isRTL]);

  const loadStockItems = useCallback(async () => {
    try {
      setIsLoading(true);
      // The API uses X-Branch-Id header from api.ts interceptor to filter by branch
      const [data, stats] = await Promise.all([
        getStockLevels({
          low_stock: filterLowStock || undefined,
        }),
        getStockStats(), // Fetch stats from backend
      ]);
      setStockItems(data);
      setStockStats(stats); // Use backend-calculated stats
    } catch (err) {
      console.error('Failed to load stock levels:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterLowStock]);

  useEffect(() => {
    loadStockItems();
  }, [loadStockItems]);

  // Filter by search query
  const filteredStock = stockItems.filter(stock => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      stock.item?.name?.toLowerCase().includes(query) ||
      stock.item?.name_ar?.toLowerCase().includes(query) ||
      stock.item?.sku?.toLowerCase().includes(query) ||
      stock.item?.category?.toLowerCase().includes(query)
    );
  });

  // Stats from backend - all calculations done server-side
  const totalItems = stockStats.total_items;
  const lowStockItems = stockStats.low_stock_count;
  const outOfStockItems = stockStats.out_of_stock_count;
  const healthyStockItems = stockStats.healthy_stock_count;

  const getStockStatus = (stock: InventoryStock) => {
    if (stock.quantity === 0) return { status: 'out', label: t('Out of Stock', 'نفذ'), color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (stock.quantity <= stock.min_quantity) return { status: 'low', label: t('Low Stock', 'مخزون منخفض'), color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    if (stock.max_quantity && stock.quantity >= stock.max_quantity) return { status: 'over', label: t('Overstocked', 'زيادة مخزون'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    return { status: 'healthy', label: t('In Stock', 'متوفر'), color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  };

  // Open edit modal
  const handleEditLimits = (stock: InventoryStock) => {
    setSelectedStock(stock);
    setEditMin(stock.min_quantity || 0);
    setEditMax(stock.max_quantity ?? null);
    setShowEditModal(true);
  };

  // Save stock limits
  const handleSaveLimits = async () => {
    if (!selectedStock) return;
    
    setIsSaving(true);
    try {
      await setStockLimits(selectedStock.item_id, {
        min_quantity: editMin,
        max_quantity: editMax ?? undefined,
        branch_id: selectedStock.branch_id ?? undefined,
      });
      
      // Refresh stock items
      await loadStockItems();
      setShowEditModal(false);
      setSelectedStock(null);
    } catch (err) {
      console.error('Failed to update stock limits:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <PackageCheck className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalItems}</p>
              <p className="text-xs text-zinc-500">{t('Total Items', 'إجمالي المواد')}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{healthyStockItems}</p>
              <p className="text-xs text-zinc-500">{t('In Stock', 'متوفر')}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{lowStockItems}</p>
              <p className="text-xs text-zinc-500">{t('Low Stock', 'مخزون منخفض')}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className={isRTL ? 'text-right' : ''}>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{outOfStockItems}</p>
              <p className="text-xs text-zinc-500">{t('Out of Stock', 'نفذ')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className={`flex items-center gap-4 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="relative flex-1 min-w-64">
          <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search items by name, SKU, or category...', 'البحث عن المواد بالاسم أو SKU أو الفئة...')}
            className={`w-full ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
          />
        </div>


        <button
          onClick={() => setFilterLowStock(!filterLowStock)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            filterLowStock 
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' 
              : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          } ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <AlertTriangle className="w-4 h-4" />
          {t('Low Stock Only', 'المخزون المنخفض فقط')}
        </button>

        <button
          onClick={() => loadStockItems()}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-sm font-medium transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('Refresh', 'تحديث')}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredStock.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <Warehouse className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {searchQuery || filterLowStock 
              ? t('No items found', 'لم يتم العثور على مواد')
              : t('No inventory yet', 'لا يوجد مخزون حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {searchQuery || filterLowStock
              ? t('Try adjusting your filters', 'جرب تعديل الفلاتر')
              : t('Items will appear here once they are received through Purchase Orders.', 'ستظهر المواد هنا بمجرد استلامها من خلال أوامر الشراء.')}
          </p>
        </div>
      )}

      {/* Inventory Table */}
      {!isLoading && filteredStock.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('Item', 'المادة')}
                  </th>
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('SKU', 'رمز المنتج')}
                  </th>
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('Category', 'الفئة')}
                  </th>
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center`}>
                    {t('Quantity', 'الكمية')}
                  </th>
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center`}>
                    {t('Unit', 'الوحدة')}
                  </th>
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center`}>
                    {t('Min', 'الحد الأدنى')}
                  </th>
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center`}>
                    {t('Max', 'الحد الأقصى')}
                  </th>
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('Status', 'الحالة')}
                  </th>
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center`}>
                    {t('Actions', 'إجراءات')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredStock.map((stock) => {
                  const stockStatus = getStockStatus(stock);
                  return (
                    <tr 
                      key={stock.id} 
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-zinc-500" />
                          </div>
                          <div className={isRTL ? 'text-right' : ''}>
                            <p className="font-medium text-zinc-900 dark:text-white">
                              {isRTL ? stock.item?.name_ar || stock.item?.name : stock.item?.name}
                            </p>
                            {stock.item?.name_ar && !isRTL && (
                              <p className="text-xs text-zinc-500">{stock.item.name_ar}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                          {stock.item?.sku || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {stock.item?.category || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-semibold ${
                          stockStatus.status === 'out' ? 'text-red-600 dark:text-red-400' :
                          stockStatus.status === 'low' ? 'text-amber-600 dark:text-amber-400' :
                          'text-zinc-900 dark:text-white'
                        }`}>
                          {stock.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {stock.item?.storage_unit || stock.item?.unit || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-zinc-500">
                          {stock.min_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-zinc-500">
                          {stock.max_quantity ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setAdjustmentStock(stock);
                              setShowAdjustmentModal(true);
                            }}
                            className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                            title={t('Adjust Stock', 'تعديل المخزون')}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditLimits(stock)}
                            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            title={t('Edit Min/Max Limits', 'تعديل الحدود الدنيا والقصوى')}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Stock Limits Modal */}
      <AnimatePresence>
        {showEditModal && selectedStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className={`flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Package className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div className={isRTL ? 'text-right' : ''}>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                      {t('Edit Stock Limits', 'تعديل حدود المخزون')}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {isRTL ? selectedStock.item?.name_ar || selectedStock.item?.name : selectedStock.item?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStock(null);
                  }}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5">
                {/* Current Stock Info */}
                <div className={`p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 ${isRTL ? 'text-right' : ''}`}>
                  <p className="text-xs text-zinc-500 mb-1">{t('Current Stock', 'المخزون الحالي')}</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {selectedStock.quantity} <span className="text-sm font-normal text-zinc-500">{selectedStock.item?.storage_unit || selectedStock.item?.unit}</span>
                  </p>
                </div>

                {/* Min Quantity */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
                    {t('Minimum Stock Level', 'الحد الأدنى للمخزون')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editMin || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) {
                        setEditMin(val === '' ? 0 : parseInt(val));
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all ${isRTL ? 'text-right' : ''}`}
                    placeholder="0"
                  />
                  <p className={`text-xs text-zinc-500 mt-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Alert when stock falls to or below this level', 'تنبيه عندما ينخفض المخزون إلى أو أقل من هذا المستوى')}
                  </p>
                </div>

                {/* Max Quantity */}
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
                    {t('Maximum Stock Level', 'الحد الأقصى للمخزون')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editMax ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) {
                        setEditMax(val === '' ? null : parseInt(val));
                      }
                    }}
                    className={`w-full px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all ${isRTL ? 'text-right' : ''}`}
                    placeholder={t('No limit', 'بدون حد')}
                  />
                  <p className={`text-xs text-zinc-500 mt-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Alert when stock exceeds this level (leave empty for no limit)', 'تنبيه عندما يتجاوز المخزون هذا المستوى (اتركه فارغًا بدون حد)')}
                  </p>
                </div>

                {/* Validation warning */}
                {editMax !== null && editMax > 0 && editMin >= editMax && (
                  <div className={`p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 ${isRTL ? 'text-right' : ''}`}>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {t('Maximum should be greater than minimum', 'يجب أن يكون الحد الأقصى أكبر من الحد الأدنى')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`flex gap-3 p-5 border-t border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStock(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSaveLimits}
                  disabled={isSaving || (editMax !== null && editMax > 0 && editMin >= editMax)}
                  className={`flex-1 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium transition-colors flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''} ${
                    isSaving || (editMax !== null && editMax > 0 && editMin >= editMax)
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-zinc-800 dark:hover:bg-zinc-100'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('Saving...', 'جاري الحفظ...')}
                    </>
                  ) : (
                    t('Save Changes', 'حفظ التغييرات')
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Adjustment Modal */}
      <AdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => {
          setShowAdjustmentModal(false);
          setAdjustmentStock(null);
        }}
        onSuccess={loadStockItems}
        item={adjustmentStock}
        branchId={adjustmentStock?.branch_id}
      />
    </div>
  );
}

// ==================== TIMELINE TAB ====================
function TimelineTab() {
  const { t, isRTL } = useLanguage();
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [filterReason, setFilterReason] = useState<DeductionReason | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadTransactions = useCallback(async (resetPage = false) => {
    try {
      setIsLoading(true);
      const currentPage = resetPage ? 1 : page;
      
      const [data, statsData] = await Promise.all([
        getInventoryTimeline({
          transaction_type: filterType || undefined,
          deduction_reason: filterReason || undefined,
          page: currentPage,
          limit: 50,
        }),
        getTimelineStats(),
      ]);
      
      setTransactions(data.transactions);
      setHasMore(data.has_more);
      setTotal(data.total);
      setStats(statsData);
      if (resetPage) setPage(1);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, filterType, filterReason]);

  useEffect(() => {
    loadTransactions(true);
  }, [filterType, filterReason]);

  // Filter transactions locally by search
  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.item?.name?.toLowerCase().includes(query) ||
      tx.item?.name_ar?.toLowerCase().includes(query) ||
      tx.item?.sku?.toLowerCase().includes(query) ||
      tx.notes?.toLowerCase().includes(query) ||
      tx.user?.username?.toLowerCase().includes(query)
    );
  });

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'manual_addition': return <ArrowUpCircle className="w-4 h-4 text-emerald-500" />;
      case 'manual_deduction': return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
      case 'po_receive': return <Package className="w-4 h-4 text-blue-500" />;
      case 'order_sale': return <Minus className="w-4 h-4 text-orange-500" />;
      case 'order_cancel_waste': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'order_cancel_return': return <RotateCcw className="w-4 h-4 text-emerald-500" />;
      case 'transfer_in': return <ArrowRight className="w-4 h-4 text-emerald-500" />;
      case 'transfer_out': return <ArrowLeftRight className="w-4 h-4 text-amber-500" />;
      case 'production_consume': return <Minus className="w-4 h-4 text-purple-500" />;
      case 'production_yield': return <Plus className="w-4 h-4 text-purple-500" />;
      case 'inventory_count_adjustment': return <ClipboardList className="w-4 h-4 text-zinc-500" />;
      default: return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getTransactionLabel = (type: TransactionType) => {
    const labels: Record<TransactionType, { en: string; ar: string }> = {
      'manual_addition': { en: 'Manual Addition', ar: 'إضافة يدوية' },
      'manual_deduction': { en: 'Manual Deduction', ar: 'خصم يدوي' },
      'po_receive': { en: 'PO Received', ar: 'استلام أمر شراء' },
      'order_sale': { en: 'Order Sale', ar: 'بيع طلب' },
      'order_cancel_waste': { en: 'Waste', ar: 'هدر' },
      'order_cancel_return': { en: 'Returned', ar: 'مرتجع' },
      'transfer_in': { en: 'Transfer In', ar: 'تحويل وارد' },
      'transfer_out': { en: 'Transfer Out', ar: 'تحويل صادر' },
      'production_consume': { en: 'Production Used', ar: 'استهلاك إنتاج' },
      'production_yield': { en: 'Production Yield', ar: 'ناتج إنتاج' },
      'inventory_count_adjustment': { en: 'Count Adjustment', ar: 'تعديل جرد' },
    };
    return isRTL ? labels[type]?.ar : labels[type]?.en;
  };

  const getReasonLabel = (reason: DeductionReason) => {
    const labels: Record<DeductionReason, { en: string; ar: string }> = {
      'expired': { en: 'Expired', ar: 'منتهي الصلاحية' },
      'damaged': { en: 'Damaged', ar: 'تالف' },
      'spoiled': { en: 'Spoiled', ar: 'فاسد' },
      'others': { en: 'Others', ar: 'أخرى' },
    };
    return isRTL ? labels[reason]?.ar : labels[reason]?.en;
  };

  const isAddition = (type: TransactionType) => {
    // order_cancel_return means items returned to inventory (positive)
    return ['manual_addition', 'po_receive', 'transfer_in', 'production_yield', 'order_cancel_return'].includes(type);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <History className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.today_transactions}</p>
                <p className="text-xs text-zinc-500">{t('Today', 'اليوم')}</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ArrowUpCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.today_additions}</p>
                <p className="text-xs text-zinc-500">{t('Additions Today', 'إضافات اليوم')}</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <ArrowDownCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.today_deductions}</p>
                <p className="text-xs text-zinc-500">{t('Deductions Today', 'خصومات اليوم')}</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.week_transactions}</p>
                <p className="text-xs text-zinc-500">{t('This Week', 'هذا الأسبوع')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`flex items-center gap-4 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="relative flex-1 min-w-64">
          <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search by item, user, or notes...', 'البحث بالمادة أو المستخدم أو الملاحظات...')}
            className={`w-full ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TransactionType | '')}
          className={`px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none ${isRTL ? 'text-right' : ''}`}
        >
          <option value="">{t('All Types', 'كل الأنواع')}</option>
          <option value="manual_addition">{t('Manual Addition', 'إضافة يدوية')}</option>
          <option value="manual_deduction">{t('Manual Deduction', 'خصم يدوي')}</option>
          <option value="po_receive">{t('PO Received', 'استلام أمر شراء')}</option>
          <option value="order_sale">{t('Order Sale', 'بيع طلب')}</option>
          <option value="order_cancel_waste">{t('Waste', 'هدر')}</option>
          <option value="order_cancel_return">{t('Returned', 'مرتجع')}</option>
          <option value="transfer_in">{t('Transfer In', 'تحويل وارد')}</option>
          <option value="transfer_out">{t('Transfer Out', 'تحويل صادر')}</option>
          <option value="production_consume">{t('Production Used', 'استهلاك إنتاج')}</option>
          <option value="production_yield">{t('Production Yield', 'ناتج إنتاج')}</option>
        </select>

        {filterType === 'manual_deduction' && (
          <select
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value as DeductionReason | '')}
            className={`px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-zinc-500/20 outline-none ${isRTL ? 'text-right' : ''}`}
          >
            <option value="">{t('All Reasons', 'كل الأسباب')}</option>
            <option value="expired">{t('Expired', 'منتهي الصلاحية')}</option>
            <option value="damaged">{t('Damaged', 'تالف')}</option>
            <option value="spoiled">{t('Spoiled', 'فاسد')}</option>
            <option value="others">{t('Others', 'أخرى')}</option>
          </select>
        )}

        <button
          onClick={() => loadTransactions(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-sm font-medium transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('Refresh', 'تحديث')}
        </button>
      </div>

      {/* Timeline List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
          <History className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No transactions yet', 'لا توجد معاملات بعد')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400">
            {t('Inventory movements will appear here', 'ستظهر حركات المخزون هنا')}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="relative">
            {/* Timeline line */}
            <div className={`absolute ${isRTL ? 'right-8' : 'left-8'} top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700`} />
            
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className={`relative flex gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {/* Timeline dot */}
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isAddition(tx.transaction_type) 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                      : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {getTransactionIcon(tx.transaction_type)}
                  </div>
                  
                  {/* Content */}
                  <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                    <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                        isAddition(tx.transaction_type)
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {isAddition(tx.transaction_type) ? '+' : '-'}{tx.quantity} {tx.unit}
                      </span>
                      <span className="text-sm text-zinc-500">
                        {getTransactionLabel(tx.transaction_type)}
                      </span>
                      {tx.deduction_reason && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {getReasonLabel(tx.deduction_reason)}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm font-medium text-zinc-900 dark:text-white mt-1">
                      {isRTL ? tx.item?.name_ar || tx.item?.name : tx.item?.name}
                      {tx.item?.sku && <span className="text-zinc-400 font-normal ml-2">({tx.item.sku})</span>}
                    </p>
                    
                    {tx.notes && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 italic">
                        "{tx.notes}"
                      </p>
                    )}
                    
                    <div className={`flex items-center gap-3 mt-2 text-xs text-zinc-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span>{new Date(tx.created_at).toLocaleString()}</span>
                      {tx.user && <span>• {tx.user.username}</span>}
                      {tx.branch && <span>• {isRTL ? tx.branch.name_ar || tx.branch.name : tx.branch.name}</span>}
                      {tx.quantity_before !== null && tx.quantity_after !== null && (
                        <span className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          • {tx.quantity_before} → {tx.quantity_after}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Pagination */}
          {hasMore && (
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
              <button
                onClick={() => {
                  setPage(p => p + 1);
                  loadTransactions(false);
                }}
                disabled={isLoading}
                className="px-6 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {t('Load More', 'تحميل المزيد')} ({total - transactions.length} {t('remaining', 'متبقي')})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== VENDORS TAB ====================
function VendorsTab() {
  const { t, isRTL } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadVendors = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getVendors({ search: searchQuery || undefined });
      setVendors(data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleSaveVendor = async (data: any) => {
    try {
      setIsSaving(true);
      if (editingVendor) {
        await updateVendor(editingVendor.id, data);
      } else {
        await createVendor(data);
      }
      setShowModal(false);
      setEditingVendor(null);
      loadVendors();
    } catch (err) {
      console.error('Failed to save vendor:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVendor = async (id: number) => {
    if (!confirm(t('Are you sure you want to delete this vendor?', 'هل أنت متأكد من حذف هذا المورد؟'))) return;
    try {
      await deleteVendor(id);
      loadVendors();
    } catch (err) {
      console.error('Failed to delete vendor:', err);
    }
  };

  const filteredVendors = vendors.filter(v => 
    !searchQuery || 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className={`w-4 h-4 absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search vendors...', 'البحث عن موردين...')}
            className={`${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 w-64 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none transition-all placeholder:text-zinc-500 text-zinc-900 dark:text-white`}
          />
        </div>
        <button 
          onClick={() => { setEditingVendor(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          {t('Add Vendor', 'إضافة مورد')}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredVendors.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <Truck className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {searchQuery ? t('No vendors found', 'لم يتم العثور على موردين') : t('No vendors yet', 'لا يوجد موردين حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {searchQuery 
              ? t('Try a different search term', 'جرب مصطلح بحث مختلف')
              : t('Add your suppliers and vendors to track purchases and manage relationships.', 'أضف الموردين لتتبع المشتريات وإدارة العلاقات.')}
          </p>
          {!searchQuery && (
            <button 
              onClick={() => { setEditingVendor(null); setShowModal(true); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Plus className="w-4 h-4" />
              {t('Add Your First Vendor', 'أضف أول مورد')}
            </button>
          )}
        </div>
      )}

      {/* Vendors List */}
      {!isLoading && filteredVendors.length > 0 && (
        <div className="grid gap-4">
          {filteredVendors.map((vendor) => (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-zinc-500" />
                  </div>
                  <div className={isRTL ? 'text-right' : ''}>
                    <div className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <h3 className="font-semibold text-zinc-900 dark:text-white">
                        {isRTL ? vendor.name_ar || vendor.name : vendor.name}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {vendor.code}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        vendor.status === 'active' 
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' 
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                      }`}>
                        {vendor.status === 'active' ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                        {vendor.branch_id 
                          ? (isRTL ? vendor.branch?.name_ar || vendor.branch?.name : vendor.branch?.name) || t('Specific Branch', 'فرع محدد')
                          : t('All Branches', 'جميع الفروع')}
                      </span>
                    </div>
                    <div className={`flex flex-wrap gap-4 mt-2 text-sm text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {vendor.contact_person && (
                        <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <span>{vendor.contact_person}</span>
                        </span>
                      )}
                      {vendor.phone && (
                        <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Phone className="w-3.5 h-3.5" />
                          <span dir="ltr">{vendor.phone}</span>
                        </span>
                      )}
                      {vendor.email && (
                        <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Mail className="w-3.5 h-3.5" />
                          <span>{vendor.email}</span>
                        </span>
                      )}
                      {vendor.city && (
                        <span className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{vendor.city}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => { setEditingVendor(vendor); setShowModal(true); }}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteVendor(vendor.id)}
                    className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Vendor Modal */}
      <VendorModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingVendor(null); }}
        onSave={handleSaveVendor}
        vendor={editingVendor}
        isSaving={isSaving}
      />
    </div>
  );
}

// Vendor Modal Component
function VendorModal({ isOpen, onClose, onSave, vendor, isSaving }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  vendor: Vendor | null;
  isSaving: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const defaultCountry = getDefaultCountry();
  const [branches, setBranches] = useState<{ id: number; name: string; name_ar?: string }[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    branch_id: 'all' as string | number, // 'all' = available to all branches
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: defaultCountry,
    tax_number: '',
    payment_terms: 30,
    notes: '',
  });

  useEffect(() => {
    // Load branches for the selector
    const loadBranches = async () => {
      try {
        const storedBusiness = localStorage.getItem('setup_business');
        if (storedBusiness) {
          const business = JSON.parse(storedBusiness);
          if (business.id) {
            // Fetch branches from API
            const response = await api.get(`/businesses/${business.id}/branches`);
            if (response.data.branches && response.data.branches.length > 0) {
              setBranches(response.data.branches);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    };
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen]);

  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || '',
        name_ar: vendor.name_ar || '',
        branch_id: vendor.branch_id || 'all',
        contact_person: vendor.contact_person || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: vendor.address || '',
        city: vendor.city || '',
        country: vendor.country || defaultCountry,
        tax_number: vendor.tax_number || '',
        payment_terms: vendor.payment_terms || 30,
        notes: vendor.notes || '',
      });
    } else {
      setFormData({
        name: '',
        name_ar: '',
        branch_id: 'all',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: defaultCountry,
        tax_number: '',
        payment_terms: 30,
        notes: '',
      });
    }
  }, [vendor, isOpen, defaultCountry]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {vendor ? t('Edit Vendor', 'تعديل المورد') : t('Add Vendor', 'إضافة مورد')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Name (English)', 'الاسم (إنجليزي)')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Name (Arabic)', 'الاسم (عربي)')}
              </label>
              <input
                type="text"
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white text-right"
                dir="rtl"
              />
            </div>
          </div>

          {/* Branch Selection */}
          <div>
            <SearchableSelect
              label={t('Available for', 'متاح لـ')}
              value={formData.branch_id === 'all' ? 'all' : formData.branch_id}
              onChange={(id) => setFormData({ ...formData, branch_id: id === 'all' ? 'all' : (id ? Number(id) : 'all') })}
              options={[
                { id: 'all', name: t('All Branches', 'جميع الفروع') },
                ...branches.map(branch => ({
                  id: branch.id,
                  name: isRTL ? (branch.name_ar || branch.name) : branch.name,
                }))
              ]}
              placeholder={t('Select branch', 'اختر الفرع')}
            />
            <p className="mt-1 text-xs text-zinc-500">
              {formData.branch_id === 'all' 
                ? t('This vendor will be available to all branches', 'سيكون هذا المورد متاحًا لجميع الفروع')
                : t('This vendor will only be available to the selected branch', 'سيكون هذا المورد متاحًا للفرع المحدد فقط')}
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
              {t('Contact Person', 'الشخص المسؤول')}
            </label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Email', 'البريد الإلكتروني')}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Phone', 'الهاتف')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
              {t('Address', 'العنوان')}
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('City', 'المدينة')}
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <SearchableSelect
                label={t('Country', 'الدولة')}
                value={formData.country}
                onChange={(val) => val && setFormData({ ...formData, country: String(val) })}
                options={COUNTRIES.map((c) => ({
                  id: c.name,
                  name: c.name,
                }))}
                placeholder={t('Select country', 'اختر الدولة')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('VAT Number', 'الرقم الضريبي')}
              </label>
              <input
                type="text"
                value={formData.tax_number}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                {t('Payment Terms (days)', 'شروط الدفع (أيام)')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.payment_terms || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) {
                    setFormData({ ...formData, payment_terms: val === '' ? 30 : parseInt(val) });
                  }
                }}
                placeholder="30"
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
              {t('Notes', 'ملاحظات')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !formData.name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {vendor ? t('Save Changes', 'حفظ التغييرات') : t('Add Vendor', 'إضافة المورد')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== PURCHASE ORDERS TAB ====================
interface POLineItem {
  item_id: number;
  item_name: string;
  item_name_ar?: string;
  storage_unit: string;
  quantity: number;
  // Prices are entered at receive time, not at PO creation
}

function PurchaseOrdersTab() {
  const { t, isRTL } = useLanguage();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [templates, setTemplates] = useState<POTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<POTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filters = [
    { key: 'all', label: t('All', 'الكل') },
    { key: 'templates', label: t('Templates', 'القوالب') },
    { key: 'pending', label: t('Pending', 'قيد الانتظار') },
    { key: 'delivered', label: t('Delivered', 'تم التوصيل') },
    { key: 'cancelled', label: t('Cancelled', 'ملغي') },
  ];

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      if (filter === 'templates') {
        const data = await getPOTemplates({ is_active: true });
        setTemplates(data);
        setOrders([]);
      } else {
        const data = await getPurchaseOrders({ status: filter !== 'all' ? filter : undefined });
        setOrders(data);
        setTemplates([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleCreatePO = async (vendorId: number, items: POLineItem[], notes?: string) => {
    try {
      setIsSaving(true);
      await createPurchaseOrder({
        vendor_id: vendorId,
        items: items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          // No prices at PO creation - entered by employee at receive time
        })),
        notes,
      });
      setShowModal(false);
      loadOrders();
    } catch (err) {
      console.error('Failed to create PO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTemplate = (template: POTemplate) => {
    setEditingTemplate(template);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm(t('Are you sure you want to delete this template?', 'هل أنت متأكد من حذف هذا القالب؟'))) return;
    try {
      await deletePOTemplate(templateId);
      loadOrders();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const handleSaveTemplate = async (data: {
    name: string;
    name_ar?: string;
    vendor_id: number;
    notes?: string;
    items: { item_id: number; quantity: number }[];
  }) => {
    try {
      setIsSaving(true);
      if (editingTemplate) {
        await updatePOTemplate(editingTemplate.id, {
          name: data.name,
          name_ar: data.name_ar,
          notes: data.notes,
          items: data.items,
        });
      } else {
        await createPOTemplate(data);
      }
      setShowTemplateModal(false);
      setEditingTemplate(null);
      loadOrders();
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400';
      case 'pending': return 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300';
      case 'approved': return 'bg-zinc-300 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-200';
      case 'ordered': return 'bg-zinc-800 dark:bg-zinc-300 text-white dark:text-zinc-900';
      case 'partial': return 'bg-zinc-400 dark:bg-zinc-500 text-zinc-900 dark:text-zinc-100';
      case 'received': return 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900';
      case 'delivered': return 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900';
      case 'cancelled': return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 line-through';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return t('Draft', 'مسودة');
      case 'pending': return t('Pending', 'قيد الانتظار');
      case 'approved': return t('Approved', 'موافق عليه');
      case 'ordered': return t('Ordered', 'تم الطلب');
      case 'partial': return t('Partial', 'جزئي');
      case 'received': return t('Received', 'تم الاستلام');
      case 'delivered': return t('Delivered', 'تم التوصيل');
      case 'cancelled': return t('Cancelled', 'ملغي');
      default: return status;
    }
  };

  const handleOpenPODetail = async (order: PurchaseOrder) => {
    try {
      // Fetch full PO details including items
      const fullOrder = await getPurchaseOrder(order.id);
      setSelectedPO(fullOrder);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to load PO details:', err);
    }
  };

  const handlePOUpdated = () => {
    loadOrders();
    setShowDetailModal(false);
    setSelectedPO(null);
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className={`flex flex-col sm:flex-row gap-4 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter === 'templates' ? (
          <button 
            onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('New Template', 'قالب جديد')}
          </button>
        ) : (
          <button 
            onClick={() => setShowModal(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('New Purchase Order', 'طلب شراء جديد')}
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State for Templates */}
      {!isLoading && filter === 'templates' && templates.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No templates yet', 'لا توجد قوالب حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {t('Save frequent purchase orders as templates for quick reuse.', 'احفظ طلبات الشراء المتكررة كقوالب للاستخدام السريع.')}
          </p>
          <button 
            onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('Create First Template', 'أنشئ أول قالب')}
          </button>
        </div>
      )}

      {/* Empty State for Orders */}
      {!isLoading && filter !== 'templates' && orders.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No purchase orders yet', 'لا توجد أوامر شراء حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {t('Create purchase orders to restock your inventory from vendors.', 'أنشئ أوامر شراء لإعادة تخزين المخزون من الموردين.')}
          </p>
          <button 
            onClick={() => setShowModal(true)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('Create First Purchase Order', 'أنشئ أول طلب شراء')}
          </button>
        </div>
      )}

      {/* Templates List */}
      {!isLoading && filter === 'templates' && templates.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Template Name', 'اسم القالب')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Vendor', 'المورد')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Items', 'الأصناف')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Created', 'تاريخ الإنشاء')}
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? (template.name_ar || template.name) : template.name}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? (template.vendor?.name_ar || template.vendor?.name) : template.vendor?.name || '-'}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {template.items?.length || 0} {t('items', 'صنف')}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {new Date(template.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button 
                        onClick={() => handleEditTemplate(template)}
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        title={t('Edit', 'تعديل')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        title={t('Delete', 'حذف')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Orders List */}
      {!isLoading && filter !== 'templates' && orders.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Order #', 'رقم الطلب')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Vendor', 'المورد')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Date', 'التاريخ')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Total', 'الإجمالي')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Status', 'الحالة')}
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {orders.map((order) => (
                <tr 
                  key={order.id} 
                  onClick={() => handleOpenPODetail(order)}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {order.order_number}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {isRTL ? (order.vendor?.name_ar || order.vendor?.name) : order.vendor?.name || '-'}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {new Date(order.order_date).toLocaleDateString()}
                  </td>
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {formatCurrency(order.total_amount)}
                  </td>
                  <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                      <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PO Modal */}
      <PurchaseOrderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleCreatePO}
        isSaving={isSaving}
      />

      {/* Template Modal */}
      <TemplateEditModal
        isOpen={showTemplateModal}
        onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
        onSave={handleSaveTemplate}
        template={editingTemplate}
        isSaving={isSaving}
      />

      {/* PO Detail Modal */}
      <PODetailModal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedPO(null); }}
        order={selectedPO}
        onUpdate={handlePOUpdated}
        getStatusColor={getStatusColor}
        getStatusLabel={getStatusLabel}
      />
    </div>
  );
}

// Purchase Order Modal Component
function PurchaseOrderModal({ isOpen, onClose, onSave, isSaving }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vendorId: number, items: POLineItem[], notes?: string) => void;
  isSaving: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [templates, setTemplates] = useState<POTemplate[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Template states
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateNameAr, setTemplateNameAr] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Load vendors, items, and templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      // Reset form when modal closes
      setSelectedVendorId(null);
      setLineItems([]);
      setNotes('');
      setSearchQuery('');
      setSaveAsTemplate(false);
      setTemplateName('');
      setTemplateNameAr('');
      setSelectedTemplateId(null);
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [vendorsData, itemsData, templatesData] = await Promise.all([
        getVendors(),
        getItems(),
        getPOTemplates({ is_active: true })
      ]);
      setVendors(vendorsData);
      setItems(itemsData);
      setTemplates(templatesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Load template items when a template is selected
  const loadFromTemplate = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setSelectedVendorId(template.vendor_id);
    setSelectedTemplateId(templateId);
    setNotes(template.notes || '');

    // Convert template items to line items
    const newLineItems: POLineItem[] = (template.items || []).map(ti => {
      const itemData = ti.item;
      const unit = (itemData?.storage_unit && itemData.storage_unit.trim()) 
        ? itemData.storage_unit 
        : (itemData?.unit || 'unit');
      
      return {
        item_id: ti.item_id,
        item_name: itemData?.name || '',
        item_name_ar: itemData?.name_ar,
        storage_unit: unit,
        quantity: ti.quantity,
        total_price: 0, // User will enter prices
      };
    });
    
    setLineItems(newLineItems);
  };

  const addItem = (item: Item) => {
    // Check if item already added
    if (lineItems.some(li => li.item_id === item.id)) return;
    
    // Use storage unit if available, otherwise fall back to serving unit
    const unit = (item.storage_unit && item.storage_unit.trim()) ? item.storage_unit : (item.unit || 'unit');
    
    setLineItems([...lineItems, {
      item_id: item.id,
      item_name: item.name,
      item_name_ar: item.name_ar ?? undefined,
      storage_unit: unit,
      quantity: 1,
      // No price at creation - prices entered at receive time
    }]);
    setSearchQuery('');
  };

  const updateLineItem = (index: number, field: 'quantity', value: number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const filteredItems = searchQuery.trim() 
    ? items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.name_ar && item.name_ar.includes(searchQuery)) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const handleSubmit = async () => {
    if (!selectedVendorId || lineItems.length === 0) return;

    // Save as template if checkbox is checked
    if (saveAsTemplate && templateName.trim()) {
      setIsSavingTemplate(true);
      try {
        await createPOTemplate({
          vendor_id: selectedVendorId,
          name: templateName.trim(),
          name_ar: templateNameAr.trim() || undefined,
          notes: notes || undefined,
          items: lineItems.map(li => ({
            item_id: li.item_id,
            quantity: li.quantity,
          })),
        });
        console.log('Template saved successfully');
      } catch (err) {
        console.error('Failed to save template:', err);
      } finally {
        setIsSavingTemplate(false);
      }
    }

    onSave(selectedVendorId, lineItems, notes || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {t('New Purchase Order', 'طلب شراء جديد')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
          ) : (
            <>
              {/* Load from Template */}
              {templates.length > 0 && (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                  <SearchableSelect
                    label={t('Load from Saved Template', 'تحميل من قالب محفوظ')}
                    value={selectedTemplateId}
                    onChange={(id) => {
                      if (id) loadFromTemplate(id);
                      else {
                        setSelectedTemplateId(null);
                        setSelectedVendorId(null);
                        setLineItems([]);
                        setNotes('');
                      }
                    }}
                    options={templates.map(t => ({
                      id: t.id,
                      name: isRTL ? (t.name_ar || t.name) : t.name,
                      secondaryText: t.vendor ? (isRTL ? (t.vendor.name_ar || t.vendor.name) : t.vendor.name) : undefined
                    }))}
                    placeholder={t('Search templates...', 'ابحث عن القوالب...')}
                    className="w-full"
                  />
                </div>
              )}

              {/* Vendor Selection */}
              <div>
                {vendors.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <p className={`text-sm text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                      {t('No vendors found. Please add a vendor first in the Vendors tab.', 'لم يتم العثور على موردين. يرجى إضافة مورد أولاً في تبويب الموردين.')}
                    </p>
                  </div>
                ) : (
                  <SearchableSelect
                    label={`${t('Select Vendor', 'اختر المورد')} *`}
                    value={selectedVendorId}
                    onChange={(id) => setSelectedVendorId(id ? Number(id) : null)}
                    options={vendors.map(v => ({
                      id: v.id,
                      name: isRTL ? (v.name_ar || v.name) : v.name,
                      secondaryText: v.contact_person || undefined
                    }))}
                    placeholder={t('Search vendors...', 'ابحث عن الموردين...')}
                  />
                )}
              </div>

              {/* Add Items */}
              <div>
                <SearchableSelect
                  label={`${t('Add Items', 'إضافة أصناف')} *`}
                  value={null}
                  onChange={(id) => {
                    const item = items.find(i => i.id === id);
                    if (item) addItem(item);
                  }}
                  options={items.map(item => ({
                    id: item.id,
                    name: isRTL ? (item.name_ar || item.name) : item.name,
                    secondaryText: `${item.sku ? `${item.sku} • ` : ''}${item.storage_unit || item.unit || 'unit'}`
                  }))}
                  placeholder={t('Search items by name or SKU...', 'ابحث عن الأصناف بالاسم أو الرمز...')}
                />
              </div>

              {/* Line Items Table */}
              {lineItems.length > 0 && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('Item', 'الصنف')}
                        </th>
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center`}>
                          {t('Quantity', 'الكمية')}
                        </th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {lineItems.map((item, index) => (
                        <tr key={item.item_id}>
                          <td className={`px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              {isRTL ? (item.item_name_ar || item.item_name) : item.item_name}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.storage_unit || 'unit'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.quantity || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    updateLineItem(index, 'quantity', val === '' ? 0.01 : Math.max(0.01, parseFloat(val) || 0.01));
                                  }
                                }}
                                placeholder="0.00"
                                className="w-20 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-center focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                              />
                              <span className="text-xs text-zinc-500">{item.storage_unit || 'unit'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => removeLineItem(index)}
                              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Info message about pricing */}
                  <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-t border-zinc-200 dark:border-zinc-700">
                    <p className={`text-xs text-blue-600 dark:text-blue-400 ${isRTL ? 'text-right' : ''}`}>
                      {t('Prices will be entered by the employee when receiving items with the invoice.', 'سيتم إدخال الأسعار من قبل الموظف عند استلام الأصناف مع الفاتورة.')}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
                  {t('Notes (Optional)', 'ملاحظات (اختياري)')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t('Any special instructions or notes...', 'أي تعليمات أو ملاحظات خاصة...')}
                  className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none ${isRTL ? 'text-right' : ''}`}
                />
              </div>

              {/* Save as Template */}
              {lineItems.length > 0 && (
                <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <label className={`flex items-center gap-3 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <input
                      type="checkbox"
                      checked={saveAsTemplate}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                    />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('Save as frequent PO template for later use', 'حفظ كقالب طلب شراء متكرر للاستخدام لاحقاً')}
                    </span>
                  </label>

                  {saveAsTemplate && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 ${isRTL ? 'text-right' : ''}`}>
                          {t('Template Name (English)', 'اسم القالب (إنجليزي)')} *
                        </label>
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder={t('e.g., Weekly Vegetables', 'مثال: خضروات أسبوعية')}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-700 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none text-zinc-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1 ${isRTL ? 'text-right' : ''}`}>
                          {t('Template Name (Arabic)', 'اسم القالب (عربي)')}
                        </label>
                        <input
                          type="text"
                          value={templateNameAr}
                          onChange={(e) => setTemplateNameAr(e.target.value)}
                          placeholder={t('Optional', 'اختياري')}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-700 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none text-zinc-900 dark:text-white text-right"
                          dir="rtl"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || isSavingTemplate || !selectedVendorId || lineItems.length === 0 || (saveAsTemplate && !templateName.trim())}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(isSaving || isSavingTemplate) && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveAsTemplate 
              ? t('Create PO & Save Template', 'إنشاء الطلب وحفظ القالب')
              : t('Create Purchase Order', 'إنشاء طلب الشراء')
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== TEMPLATE EDIT MODAL ====================
interface TemplateLineItem {
  item_id: number;
  item_name: string;
  item_name_ar?: string;
  storage_unit: string;
  quantity: number;
}

function TemplateEditModal({ isOpen, onClose, onSave, template, isSaving }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    name_ar?: string;
    vendor_id: number;
    notes?: string;
    items: { item_id: number; quantity: number }[];
  }) => void;
  template: POTemplate | null;
  isSaving: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<TemplateLineItem[]>([]);

  // Load vendors and items
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Load template data when editing
  useEffect(() => {
    if (template && isOpen) {
      setName(template.name);
      setNameAr(template.name_ar || '');
      setSelectedVendorId(template.vendor_id);
      setNotes(template.notes || '');
      
      const templateLineItems: TemplateLineItem[] = (template.items || []).map(ti => {
        const itemData = ti.item;
        const unit = (itemData?.storage_unit && itemData.storage_unit.trim()) 
          ? itemData.storage_unit 
          : (itemData?.unit || 'unit');
        
        return {
          item_id: ti.item_id,
          item_name: itemData?.name || '',
          item_name_ar: itemData?.name_ar,
          storage_unit: unit,
          quantity: ti.quantity,
        };
      });
      setLineItems(templateLineItems);
    } else if (isOpen && !template) {
      // Reset form for new template
      setName('');
      setNameAr('');
      setSelectedVendorId(null);
      setNotes('');
      setLineItems([]);
    }
  }, [template, isOpen]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [vendorsData, itemsData] = await Promise.all([
        getVendors(),
        getItems(),
      ]);
      setVendors(vendorsData);
      setItems(itemsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const addItem = (item: Item) => {
    if (lineItems.some(li => li.item_id === item.id)) return;
    
    const unit = (item.storage_unit && item.storage_unit.trim()) ? item.storage_unit : (item.unit || 'unit');
    
    setLineItems([...lineItems, {
      item_id: item.id,
      item_name: item.name,
      item_name_ar: item.name_ar ?? undefined,
      storage_unit: unit,
      quantity: 1,
    }]);
  };

  const updateLineItem = (index: number, quantity: number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], quantity };
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!name.trim() || !selectedVendorId || lineItems.length === 0) return;
    
    onSave({
      name: name.trim(),
      name_ar: nameAr.trim() || undefined,
      vendor_id: selectedVendorId,
      notes: notes.trim() || undefined,
      items: lineItems.map(li => ({
        item_id: li.item_id,
        quantity: li.quantity,
      })),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {template ? t('Edit Template', 'تعديل القالب') : t('New Template', 'قالب جديد')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            </div>
          ) : (
            <>
              {/* Template Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Template Name (English)', 'اسم القالب (إنجليزي)')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('e.g., Weekly Vegetables', 'مثال: خضروات أسبوعية')}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 ${isRTL ? 'text-right' : ''}`}>
                    {t('Template Name (Arabic)', 'اسم القالب (عربي)')}
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder={t('Optional', 'اختياري')}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white text-right"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Vendor Selection */}
              <div>
                <SearchableSelect
                  label={`${t('Select Vendor', 'اختر المورد')} *`}
                  value={selectedVendorId}
                  onChange={(id) => setSelectedVendorId(id ? Number(id) : null)}
                  options={vendors.map(v => ({
                    id: v.id,
                    name: isRTL ? (v.name_ar || v.name) : v.name,
                    secondaryText: v.contact_person || undefined
                  }))}
                  placeholder={t('Search vendors...', 'ابحث عن الموردين...')}
                />
              </div>

              {/* Add Items */}
              <div>
                <SearchableSelect
                  label={`${t('Add Items', 'إضافة أصناف')} *`}
                  value={null}
                  onChange={(id) => {
                    const item = items.find(i => i.id === id);
                    if (item) addItem(item);
                  }}
                  options={items.map(item => ({
                    id: item.id,
                    name: isRTL ? (item.name_ar || item.name) : item.name,
                    secondaryText: `${item.sku ? `${item.sku} • ` : ''}${item.storage_unit || item.unit || 'unit'}`
                  }))}
                  placeholder={t('Search items by name or SKU...', 'ابحث عن الأصناف بالاسم أو الرمز...')}
                />
              </div>

              {/* Line Items Table */}
              {lineItems.length > 0 && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('Item', 'الصنف')}
                        </th>
                        <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center`}>
                          {t('Qty', 'الكمية')}
                        </th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {lineItems.map((item, index) => (
                        <tr key={item.item_id}>
                          <td className={`px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              {isRTL ? (item.item_name_ar || item.item_name) : item.item_name}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.storage_unit || 'unit'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.quantity || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                    updateLineItem(index, val === '' ? 0.01 : Math.max(0.01, parseFloat(val) || 0.01));
                                  }
                                }}
                                placeholder="0.00"
                                className="w-20 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-center focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                              />
                              <span className="text-xs text-zinc-500">{item.storage_unit || 'unit'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => removeLineItem(index)}
                              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
                  {t('Notes (Optional)', 'ملاحظات (اختياري)')}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t('Any notes about this template...', 'أي ملاحظات حول هذا القالب...')}
                  className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none ${isRTL ? 'text-right' : ''}`}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !name.trim() || !selectedVendorId || lineItems.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {template ? t('Save Changes', 'حفظ التغييرات') : t('Create Template', 'إنشاء القالب')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== PO DETAIL MODAL ====================
function PODetailModal({ isOpen, onClose, order, onUpdate, getStatusColor, getStatusLabel }: {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onUpdate: () => void;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
}) {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activity, setActivity] = useState<POActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  
  // Edit state (quantities only - no prices at edit)
  const [editNotes, setEditNotes] = useState('');
  const [editExpectedDate, setEditExpectedDate] = useState('');
  const [editItems, setEditItems] = useState<{ item_id: number; quantity: number; item?: any }[]>([]);
  
  // Receive modal state
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      setEditNotes(order.notes || '');
      setEditExpectedDate(order.expected_date || '');
      setEditItems(order.items?.map(i => ({
        item_id: i.item_id,
        quantity: i.quantity,
        item: i.item
      })) || []);
      setIsEditing(false);
      setActiveTab('details');
      loadActivity();
      loadItems();
    }
  }, [order, isOpen]);

  const loadItems = async () => {
    try {
      const items = await getItems();
      setAvailableItems(items);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  };

  const loadActivity = async () => {
    if (!order) return;
    setIsLoadingActivity(true);
    try {
      const data = await getPOActivity(order.id);
      setActivity(data);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const handleSave = async () => {
    if (!order) return;
    setIsSaving(true);
    try {
      await updatePurchaseOrder(order.id, {
        notes: editNotes,
        expected_date: editExpectedDate || undefined,
        items: editItems.map(i => ({
          item_id: i.item_id,
          quantity: i.quantity,
          // No prices - prices entered at receive time
        }))
      });
      setIsEditing(false);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Failed to update PO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateEditItem = (index: number, field: 'quantity', value: number) => {
    setEditItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeEditItem = (index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const addEditItem = (itemId: number) => {
    const item = availableItems.find(i => i.id === itemId);
    if (!item || editItems.some(e => e.item_id === itemId)) return;
    setEditItems(prev => [...prev, {
      item_id: itemId,
      quantity: 1,
      item: {
        id: item.id,
        name: item.name,
        name_ar: item.name_ar,
        sku: item.sku,
        unit: item.unit,
        storage_unit: item.storage_unit
      }
    }]);
  };

  // Calculate edit total - since prices aren't set during editing, return 0
  // Prices are entered at receive time
  const getEditTotal = () => {
    return 0; // No prices available during edit phase
  };

  const handleCancel = async () => {
    if (!order) return;
    setIsSaving(true);
    try {
      await updatePurchaseOrderStatus(order.id, 'cancelled', cancelNote || undefined);
      setShowCancelConfirm(false);
      setCancelNote('');
      onUpdate();
    } catch (err) {
      console.error('Failed to cancel PO:', err);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Check if PO can be received (counting + pricing)
   */
  const canReceive = order && order.status === 'pending';

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return t('PO Created', 'تم إنشاء أمر الشراء');
      case 'status_changed': return t('Status Updated', 'تم تحديث الحالة');
      case 'items_updated': return t('PO Updated', 'تم تحديث أمر الشراء');
      case 'notes_updated': return t('Notes Updated', 'تم تحديث الملاحظات');
      case 'cancelled': return t('PO Cancelled', 'تم إلغاء أمر الشراء');
      case 'received': return t('PO Delivered', 'تم تسليم أمر الشراء');
      default: return action;
    }
  };

  const canEdit = order && ['pending', 'draft'].includes(order.status);
  const canCancel = order && !['delivered', 'received', 'cancelled'].includes(order.status);

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <FileText className="w-6 h-6 text-zinc-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {order.order_number}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {isRTL ? (order.vendor?.name_ar || order.vendor?.name) : order.vendor?.name}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex gap-2 px-6 pt-4 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'details'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {t('Details', 'التفاصيل')}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'activity'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {t('Activity History', 'سجل النشاط')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {/* PO Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('PO Date', 'تاريخ أمر الشراء')}</p>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    {new Date(order.order_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Expected Date', 'التاريخ المتوقع')}</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editExpectedDate}
                      onChange={(e) => setEditExpectedDate(e.target.value)}
                      className="w-full px-2 py-1 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 text-sm"
                    />
                  ) : (
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {order.expected_date ? new Date(order.expected_date).toLocaleDateString() : '-'}
                    </p>
                  )}
                </div>
                {order.tax_amount > 0 && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Subtotal', 'المجموع الفرعي')}</p>
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {formatCurrency(order.subtotal)}
                    </p>
                  </div>
                )}
                {order.tax_amount > 0 && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('VAT', 'الضريبة')}</p>
                    <p className="font-medium text-zinc-900 dark:text-white">
                      {formatCurrency(order.tax_amount)}
                    </p>
                  </div>
                )}
                <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{t('Total', 'الإجمالي')}</p>
                  <p className="font-bold text-zinc-900 dark:text-white text-lg">
                    {formatCurrency(isEditing ? getEditTotal() : order.total_amount)}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <h3 className={`text-sm font-semibold text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {t('Order Items', 'أصناف الطلب')} ({isEditing ? editItems.length : order.items?.length || 0})
                  </h3>
                  {isEditing && (
                    <div className="w-48">
                      <SearchableSelect
                        value={null}
                        onChange={(id) => id && addEditItem(Number(id))}
                        options={availableItems
                          .filter(item => !editItems.some(e => e.item_id === item.id))
                          .map(item => ({
                            id: item.id,
                            name: isRTL ? (item.name_ar || item.name) : item.name,
                          }))}
                        placeholder={t('+ Add Item', '+ إضافة صنف')}
                      />
                    </div>
                  )}
                </div>
                
                {(isEditing ? editItems.length > 0 : order.items && order.items.length > 0) && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                          <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('Item', 'الصنف')}
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                            {t('Qty', 'الكمية')}
                          </th>
                          {!isEditing && (
                            <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                              {t('Received', 'المستلم')}
                            </th>
                          )}
                          {!isEditing && (
                            <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                              {t('Unit Cost', 'سعر الوحدة')}
                            </th>
                          )}
                          <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                            {t('Total', 'الإجمالي')}
                          </th>
                          {isEditing && <th className="px-4 py-3 w-10"></th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {isEditing ? (
                          editItems.map((item, index) => (
                            <tr key={item.item_id}>
                              <td className={`px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                  {isRTL ? (item.item?.name_ar || item.item?.name) : item.item?.name}
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {item.item?.sku} • {item.item?.storage_unit || item.item?.unit}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.quantity || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                      updateEditItem(index, 'quantity', val === '' ? 0 : parseFloat(val) || 0);
                                    }
                                  }}
                                  placeholder="0"
                                  className="w-20 px-2 py-1 text-sm text-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                />
                              </td>
                              <td className="px-4 py-3 text-center text-zinc-400 text-sm">
                                {/* Price entered at receive */}
                                -
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => removeEditItem(index)}
                                  className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          order.items?.map((item) => (
                            <tr key={item.id}>
                              <td className={`px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                  {isRTL ? (item.item?.name_ar || item.item?.name) : item.item?.name}
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {item.item?.sku} • {item.item?.storage_unit || item.item?.unit}
                                </p>
                                {/* Show variance info if any */}
                                {item.variance_reason && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    {t('Variance', 'الفرق')}: {item.variance_reason}
                                  </p>
                                )}
                                {item.variance_note && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    {item.variance_note}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-sm ${
                                  item.received_quantity >= item.quantity 
                                    ? 'text-zinc-900 dark:text-white font-semibold' 
                                    : item.received_quantity > 0 
                                      ? 'text-zinc-700 dark:text-zinc-300' 
                                      : 'text-zinc-600 dark:text-zinc-400'
                                }`}>
                                  {item.received_quantity}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                                {item.unit_cost != null ? item.unit_cost.toFixed(2) : '-'}
                              </td>
                              <td className="px-4 py-3 text-center text-sm font-medium text-zinc-900 dark:text-white">
                                {item.total_cost != null ? item.total_cost.toFixed(2) : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {isEditing && editItems.length > 0 && (
                        <tfoot>
                          <tr className="bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
                            <td colSpan={2} className={`px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-white ${isRTL ? 'text-left' : 'text-right'}`}>
                              {t('Total', 'الإجمالي')}:
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-zinc-900 dark:text-white">
                              {formatCurrency(getEditTotal())}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <h3 className={`text-sm font-semibold text-zinc-900 dark:text-white mb-2 ${isRTL ? 'text-right' : ''}`}>
                  {t('Notes', 'ملاحظات')}
                </h3>
                {isEditing ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none ${isRTL ? 'text-right' : ''}`}
                  />
                ) : (
                  <p className={`text-sm text-zinc-600 dark:text-zinc-400 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 ${isRTL ? 'text-right' : ''}`}>
                    {order.notes || t('No notes', 'لا توجد ملاحظات')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            // Activity Tab
            <div className="space-y-4">
              {isLoadingActivity ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                </div>
              ) : activity.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {t('No activity recorded yet', 'لم يتم تسجيل أي نشاط بعد')}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-700`} />
                  
                  {activity.map((item, index) => (
                    <div key={item.id} className={`relative flex gap-4 pb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.action === 'created' ? 'bg-zinc-900 dark:bg-white' :
                        item.action === 'cancelled' ? 'bg-zinc-300 dark:bg-zinc-600' :
                        item.action === 'received' ? 'bg-zinc-700 dark:bg-zinc-300' :
                        'bg-zinc-100 dark:bg-zinc-800'
                      }`}>
                        {item.action === 'created' ? (
                          <Plus className="w-4 h-4 text-white dark:text-zinc-900" />
                        ) : item.action === 'cancelled' ? (
                          <XCircle className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        ) : item.action === 'received' ? (
                          <CheckCircle2 className="w-4 h-4 text-white dark:text-zinc-900" />
                        ) : (
                          <Clock className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className={`flex-1 pb-4 ${isRTL ? 'text-right' : ''}`}>
                        <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <p className="text-sm font-medium text-zinc-900 dark:text-white">
                            {getActionLabel(item.action)}
                          </p>
                          {item.old_status && item.new_status && (
                            <span className={`flex items-center gap-1 text-xs text-zinc-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
                              <span className={`px-1.5 py-0.5 rounded ${getStatusColor(item.old_status)}`}>
                                {getStatusLabel(item.old_status)}
                              </span>
                              <ArrowRight className="w-3 h-3" />
                              <span className={`px-1.5 py-0.5 rounded ${getStatusColor(item.new_status)}`}>
                                {getStatusLabel(item.new_status)}
                              </span>
                            </span>
                          )}
                        </div>
                        
                        {item.notes && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {item.notes}
                          </p>
                        )}
                        
                        {item.changes && (
                          <div className="mt-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                            {item.changes.items_count !== undefined && (
                              <p>{t('Items', 'الأصناف')}: {item.changes.items_count}</p>
                            )}
                            {item.changes.total_amount !== undefined && (
                              <p>{t('Total', 'الإجمالي')}: {formatCurrency(item.changes.total_amount)}</p>
                            )}
                          </div>
                        )}
                        
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                          {item.user ? `${item.user.first_name || item.user.username} • ` : ''}
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2">
            {canCancel && !isEditing && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {t('Cancel Order', 'إلغاء الطلب')}
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('Save Changes', 'حفظ التغييرات')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t('Close', 'إغلاق')}
                </button>
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <Edit2 className="w-4 h-4" />
                    {t('Edit', 'تعديل')}
                  </button>
                )}
                {canReceive && (
                  <button
                    onClick={() => setShowReceiveModal(true)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    <Package className="w-4 h-4" />
                    {t('Receive Order', 'استلام الطلب')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Cancel Confirmation Modal */}
        <AnimatePresence>
          {showCancelConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6"
              >
                <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {t('Cancel Purchase Order?', 'إلغاء أمر الشراء؟')}
                  </h3>
                </div>
                
                <p className={`text-sm text-zinc-600 dark:text-zinc-400 mb-4 ${isRTL ? 'text-right' : ''}`}>
                  {t('This action cannot be undone. The order will be marked as cancelled.', 'لا يمكن التراجع عن هذا الإجراء. سيتم تحديد الطلب كملغي.')}
                </p>
                
                <div className="mb-4">
                  <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
                    {t('Reason (optional)', 'السبب (اختياري)')}
                  </label>
                  <textarea
                    value={cancelNote}
                    onChange={(e) => setCancelNote(e.target.value)}
                    rows={2}
                    placeholder={t('Enter cancellation reason...', 'أدخل سبب الإلغاء...')}
                    className={`w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white resize-none ${isRTL ? 'text-right' : ''}`}
                  />
                </div>
                
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <button
                    onClick={() => { setShowCancelConfirm(false); setCancelNote(''); }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {t('Keep Order', 'الإبقاء على الطلب')}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-colors disabled:opacity-50 ${isRTL ? 'flex-row-reverse' : ''}`}
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('Cancel Order', 'إلغاء الطلب')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Receive Modal */}
        {showReceiveModal && order && (
          <ReceivePOModal
            isOpen={showReceiveModal}
            onClose={() => setShowReceiveModal(false)}
            order={order}
            onReceived={() => {
              setShowReceiveModal(false);
              onUpdate();
              onClose();
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

// ==================== RECEIVE PO MODAL ====================
function ReceivePOModal({ isOpen, onClose, order, onReceived }: {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  onReceived: () => void;
}) {
  const { t, isRTL } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [invoiceImageUrl, setInvoiceImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [receiveItems, setReceiveItems] = useState<{
    item_id: number;
    item_name: string;
    item_name_ar?: string;
    storage_unit: string;
    ordered_quantity: number;
    received_quantity: number;
    total_cost: number;
    variance_reason?: 'missing' | 'canceled' | 'rejected';
    variance_note?: string;
  }[]>([]);

  useEffect(() => {
    if (order && isOpen) {
      setReceiveItems(order.items?.map(i => ({
        item_id: i.item_id,
        item_name: i.item?.name || `Item ${i.item_id}`,
        item_name_ar: i.item?.name_ar,
        storage_unit: i.item?.storage_unit || i.item?.unit || 'unit',
        ordered_quantity: i.quantity,
        received_quantity: i.quantity, // Default to full quantity
        total_cost: 0,
        variance_reason: undefined,
        variance_note: undefined,
      })) || []);
      setInvoiceImageUrl('');
    }
  }, [order, isOpen]);

  const updateReceiveItem = (index: number, field: string, value: any) => {
    setReceiveItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      
      // Auto-clear variance fields when quantity matches
      if (field === 'received_quantity') {
        if (value >= item.ordered_quantity) {
          updated.variance_reason = undefined;
        }
        if (value <= item.ordered_quantity) {
          updated.variance_note = undefined;
        }
      }
      
      return updated;
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // For now, create a placeholder URL - in production this would upload to storage
      // You can integrate with your file upload service here
      const reader = new FileReader();
      reader.onloadend = () => {
        // In production, upload to Supabase Storage or similar
        // For now, we'll use a data URL (not ideal for production)
        setInvoiceImageUrl(reader.result as string);
        setIsUploading(false);
      };
      reader.onerror = () => {
        console.error('Failed to read file');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to upload file:', err);
      setIsUploading(false);
    }
  };

  const validateForm = () => {
    if (!invoiceImageUrl) {
      alert(t('Please attach the invoice image', 'يرجى إرفاق صورة الفاتورة'));
      return false;
    }

    for (const item of receiveItems) {
      if (item.total_cost <= 0) {
        alert(t(`Please enter the total cost for ${item.item_name}`, `يرجى إدخال التكلفة الإجمالية لـ ${item.item_name_ar || item.item_name}`));
        return false;
      }

      // Check variance validations
      if (item.received_quantity < item.ordered_quantity && !item.variance_reason) {
        alert(t(
          `Please select a reason for shortage on ${item.item_name}`,
          `يرجى اختيار سبب النقص في ${item.item_name_ar || item.item_name}`
        ));
        return false;
      }

      if (item.received_quantity > item.ordered_quantity && (!item.variance_note || item.variance_note.trim() === '')) {
        alert(t(
          `Please provide justification for receiving more than ordered on ${item.item_name}`,
          `يرجى تقديم مبرر لاستلام أكثر من المطلوب في ${item.item_name_ar || item.item_name}`
        ));
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await receivePurchaseOrder(order.id, {
        invoice_image_url: invoiceImageUrl,
        items: receiveItems.map(item => ({
          item_id: item.item_id,
          received_quantity: item.received_quantity,
          total_cost: item.total_cost,
          variance_reason: item.received_quantity < item.ordered_quantity ? item.variance_reason : undefined,
          variance_note: item.received_quantity > item.ordered_quantity ? item.variance_note : undefined,
        })),
      });
      onReceived();
    } catch (err: any) {
      console.error('Failed to receive PO:', err);
      alert(err.response?.data?.error || t('Failed to receive order', 'فشل في استلام الطلب'));
    } finally {
      setIsSaving(false);
    }
  };

  // UI preview only - backend calculates actual totals
  const previewTotal = receiveItems.reduce((sum, item) => sum + (item.total_cost || 0), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Package className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {t('Receive Order', 'استلام الطلب')} - {order.order_number}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {t('Count items and enter costs from invoice', 'عد الأصناف وأدخل التكاليف من الفاتورة')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Invoice Upload */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border-2 border-dashed border-zinc-300 dark:border-zinc-700">
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {invoiceImageUrl ? (
                <div className="relative">
                  <img 
                    src={invoiceImageUrl} 
                    alt="Invoice" 
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setInvoiceImageUrl('')}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-zinc-400" />
                </div>
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium text-zinc-900 dark:text-white mb-1 ${isRTL ? 'text-right' : ''}`}>
                  {t('Invoice Image', 'صورة الفاتورة')} *
                </p>
                <p className={`text-xs text-zinc-500 dark:text-zinc-400 mb-3 ${isRTL ? 'text-right' : ''}`}>
                  {t('Attach a photo of the vendor invoice', 'أرفق صورة فاتورة المورد')}
                </p>
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {invoiceImageUrl ? t('Change Image', 'تغيير الصورة') : t('Upload Image', 'رفع الصورة')}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                  <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('Item', 'الصنف')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                    {t('Ordered', 'المطلوب')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                    {t('Received', 'المستلم')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                    {t('Total Cost', 'التكلفة الإجمالية')} *
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase text-center">
                    {t('Variance', 'الفرق')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {receiveItems.map((item, index) => {
                  const isShort = item.received_quantity < item.ordered_quantity;
                  const isOver = item.received_quantity > item.ordered_quantity;
                  // UI preview only - backend calculates actual unit cost
                  const previewUnitCost = item.received_quantity > 0 ? item.total_cost / item.received_quantity : 0;
                  
                  return (
                    <tr key={item.item_id} className={isShort || isOver ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                      <td className={`px-4 py-3 ${isRTL ? 'text-right' : ''}`}>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {isRTL ? (item.item_name_ar || item.item_name) : item.item_name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.storage_unit}</p>
                        {item.total_cost > 0 && item.received_quantity > 0 && (
                          <p className="text-xs text-zinc-400 mt-1">
                            {/* UI preview only - backend calculates actual value on save */}
                            {t('Preview', 'معاينة')}: {previewUnitCost.toFixed(3)}/{item.storage_unit}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
                        {item.ordered_quantity} {item.storage_unit}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.received_quantity || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateReceiveItem(index, 'received_quantity', val === '' ? 0 : parseFloat(val) || 0);
                            }
                          }}
                          placeholder="0.00"
                          className={`w-24 px-2 py-1.5 rounded-lg border text-sm text-center focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white ${
                            isShort || isOver 
                              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700' 
                              : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.total_cost || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              updateReceiveItem(index, 'total_cost', val === '' ? 0 : parseFloat(val) || 0);
                            }
                          }}
                          placeholder={t('From invoice', 'من الفاتورة')}
                          className="w-32 px-2 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-center focus:ring-2 focus:ring-zinc-500/20 outline-none text-zinc-900 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {isShort && (
                          <select
                            value={item.variance_reason || ''}
                            onChange={(e) => updateReceiveItem(index, 'variance_reason', e.target.value || undefined)}
                            className="w-28 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none text-zinc-900 dark:text-white"
                          >
                            <option value="">{t('Select...', 'اختر...')}</option>
                            <option value="missing">{t('Missing', 'مفقود')}</option>
                            <option value="canceled">{t('Canceled', 'ملغي')}</option>
                            <option value="rejected">{t('Rejected', 'مرفوض')}</option>
                          </select>
                        )}
                        {isOver && (
                          <input
                            type="text"
                            value={item.variance_note || ''}
                            onChange={(e) => updateReceiveItem(index, 'variance_note', e.target.value)}
                            placeholder={t('Justification...', 'المبرر...')}
                            className="w-32 px-2 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-zinc-900 dark:text-white"
                          />
                        )}
                        {!isShort && !isOver && (
                          <span className="text-xs text-zinc-400 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-zinc-400" />
                            {t('OK', 'موافق')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700">
                  <td colSpan={3} className={`px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-white ${isRTL ? 'text-left' : 'text-right'}`}>
                    {/* UI preview only - backend calculates actual value on save */}
                    {t('Preview Total', 'معاينة الإجمالي')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(previewTotal)}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !invoiceImageUrl}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            <CheckCircle2 className="w-4 h-4" />
            {t('Confirm Receipt', 'تأكيد الاستلام')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ==================== TRANSFERS TAB ====================
function TransfersTab() {
  const { t, isRTL } = useLanguage();
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<InventoryTransfer | null>(null);
  const [destinations, setDestinations] = useState<TransferDestination[]>([]);
  const [branchStock, setBranchStock] = useState<InventoryStock[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [currentBranchId, setCurrentBranchId] = useState<number | null>(null);

  // Get current branch from localStorage
  useEffect(() => {
    const storedBranch = localStorage.getItem('setup_branch');
    if (storedBranch) {
      try {
        const branch = JSON.parse(storedBranch);
        if (branch?.id) {
          setCurrentBranchId(branch.id);
        }
      } catch {}
    }
  }, []);

  // New transfer form state
  const [formData, setFormData] = useState({
    from_business_id: 0,
    from_branch_id: 0,
    to_business_id: 0,
    to_branch_id: 0,
    notes: '',
    items: [] as { item_id: number; quantity: number; name?: string; available?: number }[],
  });

  // Check if user is owner (can do cross-business transfers)
  const isOwner = userRole === 'owner';
  // Check if user has multiple businesses
  const hasMultipleBusinesses = isOwner && destinations.length > 1;
  
  // Helper to determine if current branch is the sender or receiver of a transfer
  const isSendingBranch = (transfer: InventoryTransfer) => transfer.from_branch_id === currentBranchId;
  const isReceivingBranch = (transfer: InventoryTransfer) => transfer.to_branch_id === currentBranchId;

  // Status filters - simplified to Pending and Received
  const filters = [
    { key: 'all', label: t('All', 'الكل') },
    { key: 'pending', label: t('Pending', 'قيد الانتظار') },
    { key: 'received', label: t('Received', 'تم الاستلام') },
  ];

  const loadTransfers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getTransfers({ status: filter !== 'all' ? filter : undefined });
      setTransfers(data);
    } catch (err) {
      console.error('Failed to load transfers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  const loadDestinations = async () => {
    try {
      const response = await getTransferDestinations();
      setDestinations(response.destinations);
      setUserRole(response.role);
      return response.destinations;
    } catch (err) {
      console.error('Failed to load destinations:', err);
      return [];
    }
  };

  // Load stock for a specific branch (items available in that branch's inventory)
  const loadBranchStock = async (branchId: number) => {
    if (!branchId) {
      setBranchStock([]);
      return;
    }
    try {
      setIsLoadingStock(true);
      const data = await getStockLevels({ branch_id: branchId });
      // Only include items with positive quantity (available to transfer)
      const availableStock = data.filter(stock => stock.quantity > 0);
      setBranchStock(availableStock);
    } catch (err) {
      console.error('Failed to load branch stock:', err);
      setBranchStock([]);
    } finally {
      setIsLoadingStock(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const openNewModal = async () => {
    const dests = await loadDestinations();
    // Set default source to first business/branch
    const defaultBizId = dests && dests.length > 0 ? dests[0].business_id : 0;
    const defaultBranchId = dests && dests.length > 0 && dests[0].branches.length > 0 ? dests[0].branches[0].id : 0;
    setFormData({
      from_business_id: defaultBizId,
      from_branch_id: defaultBranchId,
      to_business_id: defaultBizId,
      to_branch_id: 0,
      notes: '',
      items: [],
    });
    // Load stock for the default source branch
    if (defaultBranchId) {
      loadBranchStock(defaultBranchId);
    }
    setShowNewModal(true);
  };

  const handleCreateTransfer = async () => {
    if (!formData.from_branch_id || !formData.to_branch_id || formData.items.length === 0) {
      alert(t('Please select source, destination and add items', 'يرجى اختيار المصدر والوجهة وإضافة العناصر'));
      return;
    }

    // Validate that source and destination branches are different
    if (isSameBranchSelected()) {
      alert(t('Cannot transfer to the same branch. Please select a different destination branch.', 'لا يمكن التحويل إلى نفس الفرع. يرجى اختيار فرع وجهة مختلف.'));
      return;
    }

    // Validate that quantities don't exceed available stock
    const overLimitItems = formData.items.filter(item => item.available && item.quantity > item.available);
    if (overLimitItems.length > 0) {
      alert(t('Some items exceed available quantity. Please adjust the quantities.', 'بعض العناصر تتجاوز الكمية المتوفرة. يرجى تعديل الكميات.'));
      return;
    }

    try {
      setIsSubmitting(true);
      await createTransfer({
        from_business_id: formData.from_business_id || undefined,
        from_branch_id: formData.from_branch_id,
        to_business_id: formData.to_business_id || undefined,
        to_branch_id: formData.to_branch_id,
        notes: formData.notes || undefined,
        items: formData.items.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
      });
      setShowNewModal(false);
      loadTransfers();
    } catch (err: any) {
      alert(err.message || t('Failed to create transfer', 'فشل إنشاء التحويل'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiveTransfer = async (transfer: InventoryTransfer) => {
    if (!transfer.items || transfer.items.length === 0) return;
    
    try {
      setIsSubmitting(true);
      await receiveTransfer(transfer.id, transfer.items.map(i => ({
        item_id: i.item_id,
        received_quantity: i.quantity,
      })));
      loadTransfers();
      setShowViewModal(false);
    } catch (err: any) {
      alert(err.message || t('Failed to receive transfer', 'فشل استلام التحويل'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTransfer = async (transferId: number) => {
    if (!confirm(t('Are you sure you want to cancel this transfer?', 'هل أنت متأكد من إلغاء هذا التحويل؟'))) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      await cancelTransfer(transferId);
      loadTransfers();
      setShowViewModal(false);
    } catch (err: any) {
      alert(err.message || t('Failed to cancel transfer', 'فشل إلغاء التحويل'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const viewTransfer = async (transfer: InventoryTransfer) => {
    try {
      const fullTransfer = await getTransfer(transfer.id);
      setSelectedTransfer(fullTransfer);
      setShowViewModal(true);
    } catch (err) {
      console.error('Failed to load transfer:', err);
    }
  };

  const addItem = (itemId: number) => {
    const stock = branchStock.find(s => s.item_id === itemId);
    if (!stock || !stock.item) return;
    
    if (formData.items.some(i => i.item_id === itemId)) {
      alert(t('Item already added', 'العنصر مضاف بالفعل'));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { 
        item_id: itemId, 
        quantity: 1, 
        name: stock.item?.name,
        available: stock.quantity // Track available quantity for validation
      }],
    }));
  };

  const updateItemQuantity = (itemId: number, quantity: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => i.item_id === itemId ? { ...i, quantity } : i),
    }));
  };

  const removeItem = (itemId: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.item_id !== itemId),
    }));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
      received: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
      cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    };
    const labels: Record<string, string> = {
      pending: t('Pending', 'قيد الانتظار'),
      received: t('Received', 'تم الاستلام'),
      cancelled: t('Cancelled', 'ملغي'),
    };
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Get branches for selected business
  const getSourceBranches = () => {
    const dest = destinations.find(d => d.business_id === formData.from_business_id);
    return dest?.branches || [];
  };

  const getDestBranches = () => {
    const dest = destinations.find(d => d.business_id === formData.to_business_id);
    return dest?.branches || [];
  };

  // Check if same branch is selected for both source and destination
  const isSameBranchSelected = () => {
    // If different businesses, allow same branch IDs (they're different branches)
    if (hasMultipleBusinesses && formData.from_business_id !== formData.to_business_id) {
      return false;
    }
    // Same business (or single business): check if same branch
    return formData.from_branch_id > 0 && formData.from_branch_id === formData.to_branch_id;
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className={`flex flex-col sm:flex-row gap-4 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={openNewModal}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <Plus className="w-4 h-4" />
          {t('New Transfer', 'تحويل جديد')}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && transfers.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <ArrowLeftRight className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No transfers yet', 'لا توجد تحويلات حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {t('Transfer inventory between branches or businesses.', 'حوّل المخزون بين الفروع أو المتاجر.')}
          </p>
          <button
            onClick={openNewModal}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Plus className="w-4 h-4" />
            {t('Create First Transfer', 'أنشئ أول تحويل')}
          </button>
        </div>
      )}

      {/* Transfers List */}
      {!isLoading && transfers.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Transfer #', 'رقم التحويل')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('From', 'من')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('To', 'إلى')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Date', 'التاريخ')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Status', 'الحالة')}
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {transfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {transfer.transfer_number}
                  </td>
                  <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                    <div className="text-zinc-900 dark:text-white">{transfer.from_branch?.name || '-'}</div>
                    {transfer.from_business && (
                      <div className="text-xs text-zinc-500">{transfer.from_business.name}</div>
                    )}
                  </td>
                  <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                    <div className="text-zinc-900 dark:text-white">{transfer.to_branch?.name || '-'}</div>
                    {transfer.to_business && (
                      <div className="text-xs text-zinc-500">{transfer.to_business.name}</div>
                    )}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {new Date(transfer.transfer_date).toLocaleDateString()}
                  </td>
                  <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                    {getStatusBadge(transfer.status)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => viewTransfer(transfer)}
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Transfer Modal */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {t('New Inventory Transfer', 'تحويل مخزون جديد')}
                </h2>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Source/Destination - Different layouts for Owner vs PM */}
                {hasMultipleBusinesses ? (
                  <>
                    {/* Owner with multiple businesses: Full business + branch selection */}
                    <div className="grid grid-cols-2 gap-4">
                      <SearchableSelect
                        label={t('From Business', 'من المتجر')}
                        value={formData.from_business_id || null}
                        onChange={(id) => {
                          const bizId = id ? Number(id) : 0;
                          const branches = destinations.find(d => d.business_id === bizId)?.branches || [];
                          const newBranchId = branches[0]?.id || 0;
                          setFormData(prev => ({
                            ...prev,
                            from_business_id: bizId,
                            from_branch_id: newBranchId,
                            items: [], // Clear items when source changes
                          }));
                          loadBranchStock(newBranchId);
                        }}
                        options={destinations.map(d => ({
                          id: d.business_id,
                          name: d.business_name,
                        }))}
                        placeholder={t('Select business', 'اختر المتجر')}
                      />
                      <SearchableSelect
                        label={t('From Branch', 'من الفرع')}
                        value={formData.from_branch_id || null}
                        onChange={(id) => {
                          const branchId = id ? Number(id) : 0;
                          setFormData(prev => ({ ...prev, from_branch_id: branchId, items: [] }));
                          loadBranchStock(branchId);
                        }}
                        options={getSourceBranches().map(b => ({
                          id: b.id,
                          name: isRTL && b.name_ar ? b.name_ar : b.name,
                        }))}
                        placeholder={t('Select branch', 'اختر الفرع')}
                      />
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <ArrowRight className="w-5 h-5 text-zinc-500" />
                      </div>
                    </div>

                    {/* Destination */}
                    <div className="grid grid-cols-2 gap-4">
                      <SearchableSelect
                        label={t('To Business', 'إلى المتجر')}
                        value={formData.to_business_id || null}
                        onChange={(id) => {
                          const bizId = id ? Number(id) : 0;
                          const branches = destinations.find(d => d.business_id === bizId)?.branches || [];
                          setFormData(prev => ({
                            ...prev,
                            to_business_id: bizId,
                            to_branch_id: branches[0]?.id || 0,
                          }));
                        }}
                        options={destinations.map(d => ({
                          id: d.business_id,
                          name: d.business_name,
                        }))}
                        placeholder={t('Select business', 'اختر المتجر')}
                      />
                      <SearchableSelect
                        label={t('To Branch', 'إلى الفرع')}
                        value={formData.to_branch_id || null}
                        onChange={(id) => setFormData(prev => ({ ...prev, to_branch_id: id ? Number(id) : 0 }))}
                        options={getDestBranches().map(b => ({
                          id: b.id,
                          name: isRTL && b.name_ar ? b.name_ar : b.name,
                        }))}
                        placeholder={t('Select branch', 'اختر الفرع')}
                      />
                    </div>

                    {/* Same branch validation error */}
                    {isSameBranchSelected() && (
                      <div className={`flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm text-red-600 dark:text-red-400">
                          {t('Cannot transfer to the same branch', 'لا يمكن التحويل إلى نفس الفرع')}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* PM or single business owner: Branch to Branch only */}
                    <div className="grid grid-cols-2 gap-4">
                      <SearchableSelect
                        label={t('From Branch', 'من الفرع')}
                        value={formData.from_branch_id || null}
                        onChange={(id) => {
                          const branchId = id ? Number(id) : 0;
                          setFormData(prev => ({ ...prev, from_branch_id: branchId, items: [] }));
                          loadBranchStock(branchId);
                        }}
                        options={getSourceBranches().map(b => ({
                          id: b.id,
                          name: isRTL && b.name_ar ? b.name_ar : b.name,
                        }))}
                        placeholder={t('Select branch', 'اختر الفرع')}
                      />
                      <SearchableSelect
                        label={t('To Branch', 'إلى الفرع')}
                        value={formData.to_branch_id || null}
                        onChange={(id) => setFormData(prev => ({ ...prev, to_branch_id: id ? Number(id) : 0 }))}
                        options={getDestBranches().map(b => ({
                          id: b.id,
                          name: isRTL && b.name_ar ? b.name_ar : b.name,
                        }))}
                        placeholder={t('Select branch', 'اختر الفرع')}
                      />
                    </div>

                    {/* Same branch validation error */}
                    {isSameBranchSelected() && (
                      <div className={`flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm text-red-600 dark:text-red-400">
                          {t('Cannot transfer to the same branch', 'لا يمكن التحويل إلى نفس الفرع')}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Items */}
                <div>
                  <SearchableSelect
                    label={t('Items to Transfer', 'العناصر المراد تحويلها')}
                    value={null}
                    onChange={(id) => id && addItem(Number(id))}
                    options={branchStock.map(stock => ({
                      id: stock.item_id,
                      name: isRTL && stock.item?.name_ar ? stock.item.name_ar : stock.item?.name || '',
                      secondaryText: `${t('Available:', 'المتوفر:')} ${stock.quantity} ${stock.item?.unit || ''}`,
                    }))}
                    placeholder={isLoadingStock 
                      ? t('Loading inventory...', 'جارٍ تحميل المخزون...') 
                      : branchStock.length === 0 
                        ? t('No items in stock', 'لا توجد عناصر في المخزون')
                        : t('Search and add item...', 'ابحث وأضف عنصر...')
                    }
                  />

                  {/* Items List */}
                  {formData.items.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto mt-3">
                      {formData.items.map((item) => {
                        const stockData = branchStock.find(s => s.item_id === item.item_id);
                        const isOverLimit = item.available && item.quantity > item.available;
                        return (
                          <div
                            key={item.item_id}
                            className={`flex items-center gap-4 p-3 rounded-xl ${isOverLimit ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-zinc-50 dark:bg-zinc-800'} ${isRTL ? 'flex-row-reverse' : ''}`}
                          >
                            <div className="flex-1">
                              <span className="font-medium text-zinc-900 dark:text-white">
                                {isRTL && stockData?.item?.name_ar ? stockData.item.name_ar : stockData?.item?.name || item.name}
                              </span>
                              <div className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-zinc-500'}`}>
                                {t('Available:', 'المتوفر:')} {item.available || stockData?.quantity || 0}
                              </div>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d+$/.test(val)) {
                                  updateItemQuantity(item.item_id, val === '' ? 1 : parseInt(val) || 1);
                                }
                              }}
                              placeholder="1"
                              className={`w-24 px-3 py-1.5 rounded-lg border ${isOverLimit ? 'border-red-300 dark:border-red-700' : 'border-zinc-200 dark:border-zinc-700'} bg-white dark:bg-zinc-900 text-center`}
                            />
                            <button
                              onClick={() => removeItem(item.item_id)}
                              className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Notes', 'ملاحظات')}
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 resize-none"
                    placeholder={t('Optional notes...', 'ملاحظات اختيارية...')}
                  />
                </div>
              </div>

              <div className={`flex gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={handleCreateTransfer}
                  disabled={isSubmitting || formData.items.length === 0 || isSameBranchSelected()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    t('Create Transfer', 'إنشاء التحويل')
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Transfer Modal */}
      <AnimatePresence>
        {showViewModal && selectedTransfer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowViewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {selectedTransfer.transfer_number}
                  </h2>
                  <div className="mt-1">{getStatusBadge(selectedTransfer.status)}</div>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* From/To Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">{t('From', 'من')}</div>
                    <div className="font-medium text-zinc-900 dark:text-white">
                      {selectedTransfer.from_branch?.name}
                    </div>
                    {selectedTransfer.from_business && (
                      <div className="text-sm text-zinc-500">{selectedTransfer.from_business.name}</div>
                    )}
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">{t('To', 'إلى')}</div>
                    <div className="font-medium text-zinc-900 dark:text-white">
                      {selectedTransfer.to_branch?.name}
                    </div>
                    {selectedTransfer.to_business && (
                      <div className="text-sm text-zinc-500">{selectedTransfer.to_business.name}</div>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <Calendar className="w-4 h-4" />
                  {new Date(selectedTransfer.transfer_date).toLocaleDateString()}
                </div>

                {/* Items */}
                <div>
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {t('Items', 'العناصر')}
                  </div>
                  <div className="space-y-2">
                    {selectedTransfer.items?.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {isRTL && item.item?.name_ar ? item.item.name_ar : item.item?.name}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {item.quantity} {item.item?.unit || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selectedTransfer.notes && (
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">{t('Notes', 'ملاحظات')}</div>
                    <div className="text-zinc-700 dark:text-zinc-300">{selectedTransfer.notes}</div>
                  </div>
                )}
              </div>

              {/* Actions - Show different buttons based on whether current branch is sender or receiver */}
              {selectedTransfer.status === 'pending' && (
                <div className={`flex gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {/* Sending branch can only Cancel */}
                  {isSendingBranch(selectedTransfer) && (
                    <button
                      onClick={() => handleCancelTransfer(selectedTransfer.id)}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        t('Cancel Transfer', 'إلغاء التحويل')
                      )}
                    </button>
                  )}
                  
                  {/* Receiving branch can only Receive */}
                  {isReceivingBranch(selectedTransfer) && (
                    <button
                      onClick={() => handleReceiveTransfer(selectedTransfer)}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      ) : (
                        t('Receive Transfer', 'استلام التحويل')
                      )}
                    </button>
                  )}
                  
                  {/* If neither sender nor receiver (e.g. owner viewing), show info message */}
                  {!isSendingBranch(selectedTransfer) && !isReceivingBranch(selectedTransfer) && (
                    <div className="flex-1 text-center text-zinc-500 dark:text-zinc-400 py-2">
                      {t('Switch to the sending or receiving branch to take action', 'انتقل إلى الفرع المرسل أو المستلم لاتخاذ إجراء')}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==================== INVENTORY COUNTS TAB ====================
function InventoryCountsTab() {
  const { t, isRTL } = useLanguage();
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const filters = [
    { key: 'all', label: t('All', 'الكل') },
    { key: 'draft', label: t('Draft', 'مسودة') },
    { key: 'in_progress', label: t('In Progress', 'قيد التنفيذ') },
    { key: 'completed', label: t('Completed', 'مكتمل') },
    { key: 'cancelled', label: t('Cancelled', 'ملغي') },
  ];

  const loadCounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getInventoryCounts({ status: filter !== 'all' ? filter : undefined });
      setCounts(data);
    } catch (err) {
      console.error('Failed to load counts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className={`flex flex-col sm:flex-row gap-4 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
        <div className={`flex gap-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Plus className="w-4 h-4" />
          {t('Start Count', 'بدء الجرد')}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && counts.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
            {t('No inventory counts yet', 'لا توجد عمليات جرد حتى الآن')}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
            {t('Perform regular inventory counts to ensure accurate stock levels.', 'قم بإجراء جرد دوري للمخزون لضمان دقة مستويات المخزون.')}
          </p>
          <button className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Plus className="w-4 h-4" />
            {t('Start First Count', 'ابدأ أول جرد')}
          </button>
        </div>
      )}

      {/* Counts List */}
      {!isLoading && counts.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Count #', 'رقم الجرد')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Type', 'النوع')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Branch', 'الفرع')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Date', 'التاريخ')}
                </th>
                <th className={`px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('Status', 'الحالة')}
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {counts.map((count) => (
                <tr key={count.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className={`px-6 py-4 font-medium text-zinc-900 dark:text-white ${isRTL ? 'text-right' : ''}`}>
                    {count.count_number}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {count.count_type}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {count.branch?.name || t('All', 'الكل')}
                  </td>
                  <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                    {new Date(count.count_date).toLocaleDateString()}
                  </td>
                  <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400`}>
                      {count.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
