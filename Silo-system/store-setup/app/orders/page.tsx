'use client';

import { useState, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  MapPin,
  Phone,
  User,
  CreditCard,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  Car,
  X,
  Printer
} from 'lucide-react';
import { PageLayout } from '@/components/page-layout';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import api from '@/lib/api';
import { getDeliveryPartners, type DeliveryPartner } from '@/lib/delivery-api';
import { formatCurrency } from '@/lib/currency';

// Order Types
interface Order {
  id: number;
  order_number: string;
  display_number?: string;
  order_source: string;
  order_type: string;
  order_status: string;
  order_date: string;
  order_time: string;
  customer_name?: string;
  customer_phone?: string;
  table_number?: string;
  delivery_address?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  delivery_fee: number;
  total_amount: number;
  payment_method?: string;
  payment_status: string;
  created_at: string;
  items?: OrderItem[];
}

interface OrderItem {
  id: number;
  product_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

interface Branch {
  id: number;
  name: string;
  name_ar?: string;
  is_main?: boolean;
}

export default function OrdersPage() {
  const { t, isRTL } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data from database
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('today');
  
  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Timeline state
  const [categorizedTimeline, setCategorizedTimeline] = useState<{ order_status: any[]; payment_status: any[] }>({ order_status: [], payment_status: [] });
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [activeTimelineTab, setActiveTimelineTab] = useState<'order_status' | 'payment_status'>('order_status');

  // Order stats from backend - all calculations done server-side
  const [orderStats, setOrderStats] = useState<{
    total_orders: number;
    completed_orders: number;
    in_progress_orders: number;
    total_revenue: number;
    total_profit: number;
  }>({ total_orders: 0, completed_orders: 0, in_progress_orders: 0, total_revenue: 0, total_profit: 0 });

  // Order statuses (fixed values)
  const orderStatuses = [
    { id: 'pending', name: t('Pending', 'قيد الانتظار') },
    { id: 'in_progress', name: t('In Progress', 'قيد التنفيذ') },
    { id: 'completed', name: t('Completed', 'مكتمل') },
    { id: 'cancelled', name: t('Cancelled', 'ملغي') },
    { id: 'rejected', name: t('Rejected', 'مرفوض') },
  ];

  // Order types (fixed values)
  const orderTypes = [
    { id: 'dine_in', name: t('Dine In', 'داخل المطعم') },
    { id: 'takeaway', name: t('Takeaway', 'استلام') },
    { id: 'delivery', name: t('Delivery', 'توصيل') },
  ];

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (currentBranch) {
      loadDeliveryPartners();
      loadOrders();
    }
  }, [currentBranch, statusFilter, dateFilter]);

  const loadBranches = async () => {
    try {
      const storedBusiness = localStorage.getItem('setup_business');
      const storedBranch = localStorage.getItem('setup_branch');
      
      if (storedBusiness) {
        const business = JSON.parse(storedBusiness);
        if (business.id) {
          const response = await api.get(`/businesses/${business.id}/branches`);
          if (response.data.branches && response.data.branches.length > 0) {
            setBranches(response.data.branches);
            
            if (storedBranch) {
              setCurrentBranch(JSON.parse(storedBranch));
            } else {
              const mainBranch = response.data.branches.find((b: Branch) => b.is_main) || response.data.branches[0];
              setCurrentBranch(mainBranch);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const loadDeliveryPartners = async () => {
    try {
      const partners = await getDeliveryPartners({ branchId: currentBranch?.id });
      setDeliveryPartners(partners);
    } catch (err) {
      console.error('Failed to load delivery partners:', err);
    }
  };

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      // Branch isolation - only show orders for the current branch
      if (currentBranch?.id) {
        params.append('branch_id', String(currentBranch.id));
      }
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (dateFilter === 'today') {
        params.append('date', new Date().toISOString().split('T')[0]);
      }
      
      const url = `/pos/orders${params.toString() ? `?${params}` : ''}`;
      const response = await api.get(url);
      
      if (response.data.success) {
        setOrders(response.data.data || []);
        // Use backend-calculated stats
        if (response.data.stats) {
          setOrderStats(response.data.stats);
        }
      }
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      setError(err.response?.data?.error || t('Failed to load orders', 'فشل في تحميل الطلبات'));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'cancelled':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'rejected':
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5" />;
      case 'in_progress':
        return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5" />;
      case 'cancelled':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'rejected':
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const found = orderStatuses.find(s => s.id === status);
    return found?.name || status;
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'dine_in':
        return <UtensilsCrossed className="w-4 h-4" />;
      case 'takeaway':
      case 'drive_thru': // Drive-thru is part of takeaway
        return <ShoppingBag className="w-4 h-4" />;
      case 'delivery':
        return <Truck className="w-4 h-4" />;
      default:
        return <Receipt className="w-4 h-4" />;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    const found = orderTypes.find(t => t.id === type);
    return found?.name || type;
  };

  const getSourceLabel = (source: string) => {
    // Check if it's a delivery partner name from the database
    const partner = deliveryPartners.find(p => p.name.toLowerCase() === source.toLowerCase());
    if (partner) {
      return isRTL && partner.name_ar ? partner.name_ar : partner.name;
    }
    
    // Built-in sources
    const builtInSources: Record<string, { en: string; ar: string }> = {
      pos: { en: 'POS', ar: 'نقطة البيع' },
    };
    
    const label = builtInSources[source];
    if (label) {
      return isRTL ? label.ar : label.en;
    }
    
    return source;
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Unpaid', ar: 'غير مدفوع' },
      paid: { en: 'Paid', ar: 'مدفوع' },
      app_payment: { en: 'App Payment', ar: 'دفع التطبيق' },
      refunded: { en: 'Refunded', ar: 'مسترد' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
    };
    const label = labels[status] || { en: status, ar: status };
    return isRTL ? label.ar : label.en;
  };

  const formatDateTime = (date: string, time?: string) => {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString(isRTL ? 'ar-KW' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
    return time ? `${dateStr} ${time}` : dateStr;
  };

  // Timeline event color based on simplified display_type
  const getTimelineEventColor = (displayType: string) => {
    const eventColors: Record<string, string> = {
      created: '#3b82f6',           // Blue
      edited: '#f59e0b',            // Amber
      canceled: '#ef4444',          // Red
      completed: '#22c55e',         // Green
      picked_up: '#10b981',         // Teal
      paid: '#22c55e',              // Green
      additional_payment: '#3b82f6', // Blue
      partial_refund: '#f97316',    // Orange
      full_refund: '#ef4444',       // Red
    };
    return eventColors[displayType] || '#6b7280';
  };

  // Fetch order timeline (categorized for tabbed display)
  const fetchOrderTimeline = async (orderId: number) => {
    try {
      setLoadingTimeline(true);
      const response = await api.get(`/pos/orders/${orderId}/timeline/categorized`);
      if (response.data.success) {
        setCategorizedTimeline(response.data.data || { order_status: [], payment_status: [] });
        setActiveTimelineTab('order_status');
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Build source options from database + built-in
  const getSourceOptions = () => {
    const builtInSources = [
      { id: 'pos', name: t('POS', 'نقطة البيع') },
    ];
    
    // Add delivery partners from database
    const partnerOptions = deliveryPartners.map(p => ({
      id: p.name.toLowerCase(),
      name: isRTL && p.name_ar ? p.name_ar : p.name,
    }));
    
    return [...builtInSources, ...partnerOptions];
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (sourceFilter && order.order_source !== sourceFilter) return false;
    if (typeFilter && order.order_type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.order_number?.toLowerCase().includes(query) ||
        order.display_number?.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_phone?.includes(query)
      );
    }
    return true;
  });

  const dateFilters = [
    { id: 'today', label: t('Today', 'اليوم') },
    { id: 'all', label: t('All Time', 'كل الوقت') },
  ];

  return (
    <PageLayout searchPlaceholder={{ en: 'Search orders...', ar: 'البحث عن الطلبات...' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {t('Orders', 'الطلبات')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              {t('View and manage all orders', 'عرض وإدارة جميع الطلبات')}
            </p>
          </div>
          
          {/* Date filter */}
          <div className="flex items-center gap-2">
            {dateFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setDateFilter(filter.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  dateFilter === filter.id
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] max-w-md">
            <label className={`block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 ${isRTL ? 'text-right' : ''}`}>
              {t('Search', 'البحث')}
            </label>
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 ${isRTL ? 'right-4' : 'left-4'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('Order #, customer name, phone...', 'رقم الطلب، اسم العميل، الهاتف...')}
                className={`w-full py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-500/20 focus:border-zinc-500 text-sm ${isRTL ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4'}`}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-48">
            <SearchableSelect
              label={t('Status', 'الحالة')}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as string | null)}
              options={orderStatuses}
              placeholder={t('All Statuses', 'كل الحالات')}
            />
          </div>

          {/* Source Filter */}
          <div className="w-48">
            <SearchableSelect
              label={t('Source', 'المصدر')}
              value={sourceFilter}
              onChange={(val) => setSourceFilter(val as string | null)}
              options={getSourceOptions()}
              placeholder={t('All Sources', 'كل المصادر')}
            />
          </div>

          {/* Type Filter */}
          <div className="w-48">
            <SearchableSelect
              label={t('Type', 'النوع')}
              value={typeFilter}
              onChange={(val) => setTypeFilter(val as string | null)}
              options={orderTypes}
              placeholder={t('All Types', 'كل الأنواع')}
            />
          </div>
        </div>

        {/* Summary Stats - using backend-calculated values */}
        {!isLoading && filteredOrders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Total Orders', 'إجمالي الطلبات')}</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{orderStats.total_orders}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Completed', 'مكتمل')}</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {orderStats.completed_orders}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('In Progress', 'قيد التنفيذ')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {orderStats.in_progress_orders}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Total Sales', 'إجمالي المبيعات')}</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                {formatCurrency(orderStats.total_revenue)}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Profit', 'الربح')}</p>
              <p className={`text-2xl font-bold mt-1 ${orderStats.total_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(orderStats.total_profit)}
              </p>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
              <p className="text-red-500">{error}</p>
              <button
                onClick={loadOrders}
                className="mt-4 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100"
              >
                {t('Retry', 'إعادة المحاولة')}
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                {t('No orders found', 'لا توجد طلبات')}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400">
                {t('Orders will appear here once created', 'ستظهر الطلبات هنا بعد إنشائها')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Order', 'الطلب')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Customer', 'العميل')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Type', 'النوع')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Source', 'المصدر')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Status', 'الحالة')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Payment', 'الدفع')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Total', 'الإجمالي')}
                    </th>
                    <th className={`px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('Date', 'التاريخ')}
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-center">
                      {t('Actions', 'الإجراءات')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white">
                            #{order.order_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">
                            {order.customer_name || t('Walk-in', 'حضوري')}
                          </span>
                          {order.customer_phone && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {order.customer_phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                          {getOrderTypeIcon(order.order_type)}
                          <div className="flex flex-col">
                            <span className="text-sm">{getOrderTypeLabel(order.order_type)}</span>
                            {order.order_type === 'dine_in' && order.table_number && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                {t('Table', 'طاولة')} {order.table_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {getSourceLabel(order.order_source)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                          {getStatusIcon(order.order_status)}
                          {getStatusLabel(order.order_status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-sm font-medium ${
                          order.payment_status === 'paid' 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : order.payment_status === 'app_payment'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          {getPaymentStatusLabel(order.payment_status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                          {formatDateTime(order.order_date, order.order_time)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowDetailModal(true);
                            fetchOrderTimeline(order.id);
                          }}
                          className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          title={t('View Details', 'عرض التفاصيل')}
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
        </div>
      </motion.div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowDetailModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {t('Order', 'الطلب')} #{selectedOrder.order_number}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(selectedOrder.order_date, selectedOrder.order_time)}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{t('Status', 'الحالة')}</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(selectedOrder.order_status)}`}>
                    {getStatusIcon(selectedOrder.order_status)}
                    {getStatusLabel(selectedOrder.order_status)}
                  </span>
                </div>

                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">{t('Type', 'النوع')}</span>
                    <p className="flex items-center gap-2 mt-1 text-zinc-900 dark:text-white">
                      {getOrderTypeIcon(selectedOrder.order_type)}
                      {getOrderTypeLabel(selectedOrder.order_type)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">{t('Source', 'المصدر')}</span>
                    <p className="mt-1 text-zinc-900 dark:text-white">{getSourceLabel(selectedOrder.order_source)}</p>
                  </div>
                </div>

                {/* Customer */}
                {(selectedOrder.customer_name || selectedOrder.customer_phone) && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                    <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">{t('Customer', 'العميل')}</h4>
                    {selectedOrder.customer_name && (
                      <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <User className="w-4 h-4" />
                        {selectedOrder.customer_name}
                      </p>
                    )}
                    {selectedOrder.customer_phone && (
                      <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                        <Phone className="w-4 h-4" />
                        {selectedOrder.customer_phone}
                      </p>
                    )}
                    {selectedOrder.delivery_address && (
                      <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                        <MapPin className="w-4 h-4" />
                        {selectedOrder.delivery_address}
                      </p>
                    )}
                  </div>
                )}

                {/* Table Number (Dine-in) */}
                {selectedOrder.table_number && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                    <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">{t('Table', 'الطاولة')}</h4>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{selectedOrder.table_number}</p>
                  </div>
                )}

                {/* Payment Details */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">{t('Subtotal', 'المجموع الفرعي')}</span>
                    <span className="text-zinc-900 dark:text-white">{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">{t('Discount', 'الخصم')}</span>
                      <span className="text-red-500">-{formatCurrency(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  {selectedOrder.tax_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">{t('Tax', 'الضريبة')}</span>
                      <span className="text-zinc-900 dark:text-white">{formatCurrency(selectedOrder.tax_amount)}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">{t('Delivery Fee', 'رسوم التوصيل')}</span>
                      <span className="text-zinc-900 dark:text-white">{formatCurrency(selectedOrder.delivery_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <span className="text-zinc-900 dark:text-white">{t('Total', 'الإجمالي')}</span>
                    <span className="text-zinc-900 dark:text-white">{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-zinc-400" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {selectedOrder.payment_method || t('Not specified', 'غير محدد')}
                    </span>
                  </div>
                  <span className={`font-medium ${
                    selectedOrder.payment_status === 'paid'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : selectedOrder.payment_status === 'app_payment'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {getPaymentStatusLabel(selectedOrder.payment_status)}
                  </span>
                </div>

                {/* Order Timeline Section */}
                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {t('Order Timeline', 'الجدول الزمني للطلب')}
                    </h4>
                  </div>

                  {/* Timeline Tabs */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setActiveTimelineTab('order_status')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTimelineTab === 'order_status'
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {t('Order Status', 'حالة الطلب')}
                    </button>
                    <button
                      onClick={() => setActiveTimelineTab('payment_status')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTimelineTab === 'payment_status'
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {t('Payment Status', 'حالة الدفع')}
                    </button>
                  </div>

                  {/* Timeline Content */}
                  {loadingTimeline ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const timelineEvents = activeTimelineTab === 'order_status'
                          ? categorizedTimeline.order_status
                          : categorizedTimeline.payment_status;

                        if (timelineEvents.length === 0) {
                          return (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">
                              {t('No events', 'لا توجد أحداث')}
                            </p>
                          );
                        }

                        return timelineEvents.map((event: any, index: number) => {
                          const isLast = index === timelineEvents.length - 1;
                          return (
                            <div key={event.id || index} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: getTimelineEventColor(event.display_type) }}
                                />
                                {!isLast && (
                                  <div className="w-0.5 flex-1 bg-zinc-200 dark:bg-zinc-700 mt-1" />
                                )}
                              </div>
                              <div className="flex-1 pb-3">
                                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                  {event.description}
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {new Date(event.created_at).toLocaleString(isRTL ? 'ar-KW' : 'en-US')}
                                </p>
                                {event.done_by && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {t('done by', 'بواسطة')}: {event.done_by}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex gap-3 p-6 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => {
                    // TODO: Integrate with actual printer
                    window.print();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  {t('Print Receipt', 'طباعة الفاتورة')}
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {t('Close', 'إغلاق')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
