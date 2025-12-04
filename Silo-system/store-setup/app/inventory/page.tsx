'use client';

import { useState, useEffect } from 'react';
import { Warehouse, Search, Filter, ArrowUpDown, TrendingDown, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { getItems, type Item } from '@/lib/items-api';

interface InventoryItem extends Item {
  current_stock?: number;
  min_stock?: number;
  max_stock?: number;
  stock_status?: 'low' | 'normal' | 'overstocked';
}

export default function InventoryPage() {
  const { t, isRTL } = useLanguage();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low' | 'normal' | 'overstocked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'category'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setIsLoading(true);
      const data = await getItems();
      // Add mock stock data for now - this would come from inventory tracking in production
      const inventoryData = data.map((item: Item) => ({
        ...item,
        current_stock: Math.floor(Math.random() * 100),
        min_stock: 10,
        max_stock: 100,
        stock_status: getStockStatus(Math.floor(Math.random() * 100), 10, 100),
      }));
      setItems(inventoryData);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStockStatus = (current: number, min: number, max: number): 'low' | 'normal' | 'overstocked' => {
    if (current <= min) return 'low';
    if (current >= max * 0.9) return 'overstocked';
    return 'normal';
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'low':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'overstocked':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    }
  };

  const getStockIcon = (status: string) => {
    switch (status) {
      case 'low':
        return <TrendingDown className="w-3.5 h-3.5" />;
      case 'overstocked':
        return <TrendingUp className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  // Filter and sort items
  const filteredItems = items
    .filter(item => {
      if (filter !== 'all' && item.stock_status !== filter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.name_ar?.toLowerCase().includes(query) ||
          item.category_name?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'stock':
          comparison = (a.current_stock || 0) - (b.current_stock || 0);
          break;
        case 'category':
          comparison = (a.category_name || '').localeCompare(b.category_name || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const stockStats = {
    total: items.length,
    low: items.filter(i => i.stock_status === 'low').length,
    normal: items.filter(i => i.stock_status === 'normal').length,
    overstocked: items.filter(i => i.stock_status === 'overstocked').length,
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <PageLayout searchPlaceholder={{ en: 'Search inventory...', ar: 'البحث في المخزون...' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <div className={isRTL ? 'text-right' : ''}>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Inventory', 'المخزون')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('Track and manage your stock levels', 'تتبع وإدارة مستويات المخزون')}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Package className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Total Items', 'إجمالي المواد')}</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stockStats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Low Stock', 'مخزون منخفض')}</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stockStats.low}</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Normal', 'طبيعي')}</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stockStats.normal}</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className={isRTL ? 'text-right' : ''}>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Overstocked', 'مخزون زائد')}</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stockStats.overstocked}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-between ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {[
              { key: 'all', label: t('All', 'الكل'), count: stockStats.total },
              { key: 'low', label: t('Low Stock', 'منخفض'), count: stockStats.low },
              { key: 'normal', label: t('Normal', 'طبيعي'), count: stockStats.normal },
              { key: 'overstocked', label: t('Overstocked', 'زائد'), count: stockStats.overstocked },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
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

        {/* Inventory Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
            <Warehouse className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              {t('No items found', 'لم يتم العثور على مواد')}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400">
              {searchQuery 
                ? t('Try a different search term', 'جرب مصطلح بحث مختلف')
                : t('Add items to track their inventory', 'أضف مواد لتتبع مخزونها')}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <button 
                        onClick={() => toggleSort('name')}
                        className={`flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-900 dark:hover:text-white ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        {t('Item', 'المادة')}
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <button 
                        onClick={() => toggleSort('category')}
                        className={`flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-900 dark:hover:text-white ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        {t('Category', 'الفئة')}
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('Unit', 'الوحدة')}
                      </span>
                    </th>
                    <th className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <button 
                        onClick={() => toggleSort('stock')}
                        className={`flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-900 dark:hover:text-white ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        {t('Current Stock', 'المخزون الحالي')}
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className={`px-6 py-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('Status', 'الحالة')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredItems.map((item) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                        <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <Package className="w-5 h-5 text-zinc-400" />
                          </div>
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">
                              {isRTL ? item.name_ar || item.name : item.name}
                            </p>
                            {item.sku && (
                              <p className="text-xs text-zinc-500">SKU: {item.sku}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {item.category_name || t('Uncategorized', 'غير مصنف')}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-zinc-600 dark:text-zinc-400 ${isRTL ? 'text-right' : ''}`}>
                        {item.unit}
                      </td>
                      <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {item.current_stock}
                          </span>
                          <span className="text-xs text-zinc-500">
                            / {item.max_stock} {item.unit}
                          </span>
                        </div>
                        {/* Stock bar */}
                        <div className="w-24 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              item.stock_status === 'low' 
                                ? 'bg-red-500' 
                                : item.stock_status === 'overstocked' 
                                  ? 'bg-amber-500' 
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, ((item.current_stock || 0) / (item.max_stock || 100)) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className={`px-6 py-4 ${isRTL ? 'text-right' : ''}`}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStockStatusColor(item.stock_status || 'normal')}`}>
                          {getStockIcon(item.stock_status || 'normal')}
                          {item.stock_status === 'low' 
                            ? t('Low', 'منخفض')
                            : item.stock_status === 'overstocked'
                              ? t('Overstocked', 'زائد')
                              : t('Normal', 'طبيعي')}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </PageLayout>
  );
}

