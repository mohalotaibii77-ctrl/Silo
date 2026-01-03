import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  RefreshControl,
  Animated,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import { 
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  Receipt,
  User,
  Phone,
  MapPin,
  CreditCard,
  ScanBarcode
} from 'lucide-react-native';

// Types
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
  is_edited?: boolean;
  is_pay_later?: boolean;
  remaining_amount?: number;
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

// Skeleton component
const Skeleton = ({ width: w, height, borderRadius = 8, style, colors }: { width: number | string; height: number; borderRadius?: number; style?: any; colors: ThemeColors }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[{ width: w, height, borderRadius, backgroundColor: colors.border, opacity: pulseAnim }, style]}
    />
  );
};

const OrderSkeleton = ({ styles, colors }: { styles: any; colors: ThemeColors }) => (
  <View style={styles.orderCard}>
    <View style={styles.orderCardHeader}>
      <Skeleton width={80} height={20} borderRadius={6} colors={colors} />
      <Skeleton width={70} height={24} borderRadius={12} colors={colors} />
    </View>
    <View style={styles.orderCardBody}>
      <Skeleton width="50%" height={16} style={{ marginBottom: 6 }} colors={colors} />
      <Skeleton width="30%" height={14} colors={colors} />
    </View>
    <View style={styles.orderCardFooter}>
      <Skeleton width={80} height={16} colors={colors} />
      <Skeleton width={32} height={32} borderRadius={8} colors={colors} />
    </View>
  </View>
);

export default function OrdersScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const modalStyles = createModalStyles(colors);
  const paymentModalStyles = createPaymentModalStyles(colors);
  const { t, isRTL, language, formatCurrency } = useLocalization();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  
  // Order stats from backend - all calculations done server-side
  const [orderStats, setOrderStats] = useState<{
    total_orders: number;
    completed_orders: number;
    in_progress_orders: number;
    total_revenue: number;
  }>({ total_orders: 0, completed_orders: 0, in_progress_orders: 0, total_revenue: 0 });
  
  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Scanner state
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [customerPaidAmount, setCustomerPaidAmount] = useState('');
  const [transactionNumber, setTransactionNumber] = useState('');

  // Timeline state
  const [categorizedTimeline, setCategorizedTimeline] = useState<{ order_status: any[]; payment_status: any[] }>({ order_status: [], payment_status: [] });
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [activeTimelineTab, setActiveTimelineTab] = useState<'order_status' | 'payment_status'>('order_status');

  const orderStatuses = [
    { id: 'pending', label: t('pending'), labelAr: 'قيد الانتظار' },
    { id: 'in_progress', label: t('inProgress'), labelAr: 'قيد التنفيذ' },
    { id: 'completed', label: t('completed'), labelAr: 'مكتمل' },
    { id: 'cancelled', label: t('cancelled'), labelAr: 'ملغي' },
  ];

  useEffect(() => {
    loadOrders(false); // Use cache if available
  }, [statusFilter, dateFilter]);

  const loadOrders = async (forceRefresh = false) => {
    const cacheKey = CacheKeys.managementOrders(`${statusFilter || 'all'}_${dateFilter}`);
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<{ orders: Order[], stats: typeof orderStats }>(cacheKey);
      // Ensure cached data has valid structure
      if (cached && cached.orders && Array.isArray(cached.orders)) {
        setOrders(cached.orders);
        setOrderStats(cached.stats || {});
        setLoading(false);
        // Refresh in background
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (dateFilter === 'today') params.append('date', new Date().toISOString().split('T')[0]);
        
        api.get(`/pos/orders${params.toString() ? `?${params}` : ''}`)
          .then(response => {
            if (response.data.success) {
              const newOrders = response.data.data || [];
              const newStats = response.data.stats || orderStats;
              if (JSON.stringify(newOrders) !== JSON.stringify(cached.orders)) {
                setOrders(newOrders);
                setOrderStats(newStats);
                cacheManager.set(cacheKey, { orders: newOrders, stats: newStats }, CACHE_TTL.SHORT);
              }
            }
          })
          .catch(() => {})
          .finally(() => setRefreshing(false));
        return;
      }
    }
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (dateFilter === 'today') params.append('date', new Date().toISOString().split('T')[0]);
      
      const response = await api.get(`/pos/orders${params.toString() ? `?${params}` : ''}`);
      if (response.data.success) {
        const orders = response.data.data || [];
        const stats = response.data.stats || orderStats;
        setOrders(orders);
        // Use backend-calculated stats
        if (response.data.stats) {
          setOrderStats(stats);
        }
        await cacheManager.set(cacheKey, { orders, stats }, CACHE_TTL.SHORT);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders(true); // Force refresh on pull-to-refresh
  }, [statusFilter, dateFilter]);

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          language === 'ar' ? 'إذن مطلوب' : 'Permission Required',
          language === 'ar' ? 'إذن الكاميرا مطلوب لمسح الطلبات' : 'Camera permission is required to scan orders'
        );
        return;
      }
    }
    setScanned(false);
    setScannerVisible(true);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    
    try {
      const response = await api.post('/pos/orders/scan-complete', {
        order_number: data
      });
      
      if (response.data.success) {
        Alert.alert(
          language === 'ar' ? 'نجاح' : 'Success',
          language === 'ar' ? 'تم وضع علامة على الطلب كمكتمل' : 'Order marked as completed'
        );
        setScannerVisible(false);
        loadOrders(true); // Refresh orders list
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || (language === 'ar' ? 'فشل في إكمال الطلب' : 'Failed to complete order');
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        errorMsg
      );
      setScanned(false);
    } finally {
      setProcessing(false);
    }
  };

  // Process payment for unpaid orders (dine-in pay later, COD delivery)
  const processPayment = async (method: 'cash' | 'card') => {
    if (!selectedOrder || isProcessingPayment) return;

    // Validate cash payment
    if (method === 'cash') {
      const paidAmount = parseFloat(customerPaidAmount);
      if (isNaN(paidAmount) || paidAmount < selectedOrder.total_amount) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? 'المبلغ المدفوع غير كافي' : 'Paid amount is insufficient'
        );
        return;
      }
    }

    // Validate card payment
    if (method === 'card' && !transactionNumber.trim()) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'رقم المعاملة مطلوب' : 'Transaction number is required'
      );
      return;
    }

    setIsProcessingPayment(true);

    try {
      const paidAmount = parseFloat(customerPaidAmount) || selectedOrder.total_amount;
      const changeGiven = method === 'cash' ? Math.max(0, paidAmount - selectedOrder.total_amount) : 0;

      const response = await api.post(`/pos/orders/${selectedOrder.id}/payment`, {
        payment_method: method,
        amount: selectedOrder.total_amount,
        reference: method === 'card' ? transactionNumber : undefined,
        amount_received: method === 'cash' ? paidAmount : undefined,
        change_given: method === 'cash' ? changeGiven : undefined,
      });

      if (response.data.success) {
        Alert.alert(
          language === 'ar' ? 'نجاح' : 'Success',
          language === 'ar' ? 'تم معالجة الدفع بنجاح' : 'Payment processed successfully'
        );
        setShowPaymentModal(false);
        setShowDetailModal(false);
        setCustomerPaidAmount('');
        setTransactionNumber('');
        loadOrders(true); // Refresh orders list
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || (language === 'ar' ? 'فشل في معالجة الدفع' : 'Failed to process payment');
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        errorMsg
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Check if order needs payment (pay later orders that haven't been edited)
  const orderNeedsPayment = (order: Order): boolean => {
    return order.payment_status === 'pending' && !order.is_edited;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { bg: '#fef3c7', text: '#d97706' };
      case 'in_progress': return { bg: '#dbeafe', text: '#2563eb' };
      case 'completed': return { bg: '#d1fae5', text: '#059669' };
      case 'cancelled': return { bg: '#fee2e2', text: '#dc2626' };
      case 'rejected': return { bg: '#f4f4f5', text: '#71717a' };
      default: return { bg: '#f4f4f5', text: '#71717a' };
    }
  };

  const getStatusIcon = (status: string) => {
    const iconProps = { size: 14, color: getStatusColor(status).text };
    switch (status) {
      case 'pending': return <Clock {...iconProps} />;
      case 'in_progress': return <Clock {...iconProps} />;
      case 'completed': return <CheckCircle {...iconProps} />;
      case 'cancelled': return <XCircle {...iconProps} />;
      case 'rejected': return <AlertCircle {...iconProps} />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const found = orderStatuses.find(s => s.id === status);
    if (found) return language === 'ar' ? found.labelAr : found.label;
    return status;
  };

  const getOrderTypeIcon = (type: string) => {
    const iconProps = { size: 16, color: colors.mutedForeground };
    switch (type) {
      case 'dine_in': return <UtensilsCrossed {...iconProps} />;
      case 'takeaway': return <ShoppingBag {...iconProps} />;
      case 'delivery': return <Truck {...iconProps} />;
      default: return <Receipt {...iconProps} />;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      dine_in: { en: 'Dine In', ar: 'داخل المطعم' },
      takeaway: { en: 'Takeaway', ar: 'استلام' },
      delivery: { en: 'Delivery', ar: 'توصيل' },
    };
    const label = labels[type];
    return label ? (language === 'ar' ? label.ar : label.en) : type;
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      pos: { en: 'POS', ar: 'نقطة البيع' },
    };
    const label = labels[source];
    return label ? (language === 'ar' ? label.ar : label.en) : source;
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Unpaid', ar: 'غير مدفوع' },
      paid: { en: 'Paid', ar: 'مدفوع' },
      app_payment: { en: 'App Payment', ar: 'دفع التطبيق' },
      refunded: { en: 'Refunded', ar: 'مسترد' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
    };
    const label = labels[status];
    return label ? (language === 'ar' ? label.ar : label.en) : status;
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

  const formatDateTime = (date: string, time?: string) => {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString(language === 'ar' ? 'ar-KW' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
    return time ? `${dateStr} ${time}` : dateStr;
  };

  // Filter orders based on search
  const filteredOrders = (orders || []).filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(query) ||
      order.display_number?.toLowerCase().includes(query) ||
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_phone?.includes(query)
    );
  });

  // Stats from backend - all calculations done server-side
  // Use filtered count for display purposes, but revenue comes from backend
  const totalOrders = (filteredOrders || []).length;
  const completedOrders = orderStats.completed_orders;
  const inProgressOrders = orderStats.in_progress_orders;
  const totalRevenue = orderStats.total_revenue;

  const renderOrderCard = (order: Order) => {
    const statusColors = getStatusColor(order.order_status);
    
    return (
      <TouchableOpacity
        key={order.id}
        style={styles.orderCard}
        onPress={() => {
          setSelectedOrder(order);
          setShowDetailModal(true);
          fetchOrderTimeline(order.id);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.orderCardHeader, isRTL && styles.rtlRow]}>
          <Text style={[styles.orderNumber, isRTL && styles.rtlText]}>
            #{order.order_number}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            {getStatusIcon(order.order_status)}
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {getStatusLabel(order.order_status)}
            </Text>
          </View>
        </View>
        
        <View style={[styles.orderCardBody, isRTL && styles.rtlRow]}>
          <View style={[styles.orderTypeContainer, isRTL && styles.rtlRow]}>
            {getOrderTypeIcon(order.order_type)}
            <Text style={[styles.orderTypeText, isRTL && { marginRight: 6, marginLeft: 0 }]}>
              {getOrderTypeLabel(order.order_type)}
            </Text>
            {/* Show table number for dine-in */}
            {order.order_type === 'dine_in' && order.table_number && (
              <View style={{ 
                backgroundColor: '#dbeafe', 
                paddingHorizontal: 8, 
                paddingVertical: 2, 
                borderRadius: 6,
                marginLeft: 6,
              }}>
                <Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>
                  {language === 'ar' ? `ط${order.table_number}` : `T${order.table_number}`}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.orderCustomer}>
            {order.customer_name || (language === 'ar' ? 'حضوري' : 'Walk-in')}
          </Text>
        </View>

        <View style={[styles.orderCardFooter, isRTL && styles.rtlRow]}>
          <View>
            <Text style={[styles.orderTotal, isRTL && styles.rtlText]}>
              {formatCurrency(order.total_amount)}
            </Text>
            <Text style={[styles.orderTime, isRTL && styles.rtlText]}>
              {formatDateTime(order.order_date, order.order_time)}
            </Text>
          </View>
          <View style={[
            styles.paymentStatus,
            { backgroundColor: order.payment_status === 'paid' ? '#d1fae5' 
              : order.payment_status === 'app_payment' ? '#dbeafe' 
              : '#fef3c7' }
          ]}>
            <Text style={[
              styles.paymentStatusText,
              { color: order.payment_status === 'paid' ? '#059669' 
                : order.payment_status === 'app_payment' ? '#2563eb' 
                : '#d97706' }
            ]}>
              {getPaymentStatusLabel(order.payment_status)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerTop, isRTL && styles.rtlRow]}>
          <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack(navigation)}>
            {isRTL ? (
              <ArrowRight size={24} color={colors.foreground} />
            ) : (
              <ArrowLeft size={24} color={colors.foreground} />
            )}
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {t('orders')}
          </Text>
          <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
            <ScanBarcode size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        
        {/* Search */}
        <View style={[styles.searchContainer, isRTL && styles.rtlRow]}>
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, isRTL && styles.rtlText]}
            placeholder={language === 'ar' ? 'بحث عن الطلبات...' : 'Search orders...'}
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign={isRTL ? 'right' : 'left'}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Date Filter */}
      <View style={[styles.dateFilterContainer, isRTL && styles.rtlRow]}>
        <TouchableOpacity
          style={[styles.dateFilterButton, dateFilter === 'today' && styles.dateFilterButtonActive]}
          onPress={() => setDateFilter('today')}
        >
          <Text style={[styles.dateFilterText, dateFilter === 'today' && styles.dateFilterTextActive]}>
            {t('today')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateFilterButton, dateFilter === 'all' && styles.dateFilterButtonActive]}
          onPress={() => setDateFilter('all')}
        >
          <Text style={[styles.dateFilterText, dateFilter === 'all' && styles.dateFilterTextActive]}>
            {t('allTime')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filterScroll}
        contentContainerStyle={[styles.filterContainer, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <TouchableOpacity
          style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
          onPress={() => setStatusFilter(null)}
        >
          <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>
            {language === 'ar' ? 'الكل' : 'All'}
          </Text>
        </TouchableOpacity>
        {orderStatuses.map((status) => (
          <TouchableOpacity
            key={status.id}
            style={[styles.filterChip, statusFilter === status.id && styles.filterChipActive]}
            onPress={() => setStatusFilter(status.id)}
          >
            <Text style={[styles.filterChipText, statusFilter === status.id && styles.filterChipTextActive]}>
              {language === 'ar' ? status.labelAr : status.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats */}
      {!loading && (filteredOrders || []).length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalOrders}</Text>
            <Text style={styles.statLabel}>{language === 'ar' ? 'الإجمالي' : 'Total'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#059669' }]}>{completedOrders}</Text>
            <Text style={styles.statLabel}>{t('completed')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2563eb' }]}>{inProgressOrders}</Text>
            <Text style={styles.statLabel}>{language === 'ar' ? 'نشط' : 'Active'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatCurrency(totalRevenue)}</Text>
            <Text style={styles.statLabel}>{t('revenue')}</Text>
          </View>
        </View>
      )}

      {/* Orders List */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.ordersList}>
          {loading ? (
            <>
              <OrderSkeleton styles={styles} colors={colors} />
              <OrderSkeleton styles={styles} colors={colors} />
              <OrderSkeleton styles={styles} colors={colors} />
            </>
          ) : (filteredOrders || []).length === 0 ? (
            <View style={styles.emptyState}>
              <Receipt size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
                {language === 'ar' ? 'لا توجد طلبات' : 'No orders found'}
              </Text>
            </View>
          ) : (
            (filteredOrders || []).map(order => renderOrderCard(order))
          )}
        </View>
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <View style={[modalStyles.header, isRTL && styles.rtlRow]}>
              <View style={isRTL ? { alignItems: 'flex-end' } : {}}>
                <Text style={[modalStyles.title, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'الطلب' : 'Order'} #{selectedOrder?.order_number}
                </Text>
                <Text style={[modalStyles.subtitle, isRTL && styles.rtlText]}>
                  {selectedOrder && formatDateTime(selectedOrder.order_date, selectedOrder.order_time)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
                {/* Status */}
                <View style={[modalStyles.row, isRTL && styles.rtlRow]}>
                  <Text style={modalStyles.label}>{language === 'ar' ? 'الحالة' : 'Status'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.order_status).bg }]}>
                    {getStatusIcon(selectedOrder.order_status)}
                    <Text style={[styles.statusText, { color: getStatusColor(selectedOrder.order_status).text }]}>
                      {getStatusLabel(selectedOrder.order_status)}
                    </Text>
                  </View>
                </View>

                {/* Order Info */}
                <View style={modalStyles.section}>
                  <View style={[modalStyles.infoRow, isRTL && styles.rtlRow]}>
                    {getOrderTypeIcon(selectedOrder.order_type)}
                    <Text style={[modalStyles.infoText, isRTL && { marginRight: 8, marginLeft: 0 }]}>
                      {getOrderTypeLabel(selectedOrder.order_type)}
                    </Text>
                    {/* Show table number for dine-in */}
                    {selectedOrder.order_type === 'dine_in' && selectedOrder.table_number && (
                      <View style={{ 
                        backgroundColor: '#dbeafe', 
                        paddingHorizontal: 10, 
                        paddingVertical: 4, 
                        borderRadius: 8,
                        marginLeft: 8,
                      }}>
                        <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '600' }}>
                          {language === 'ar' ? `طاولة ${selectedOrder.table_number}` : `Table ${selectedOrder.table_number}`}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[modalStyles.infoRow, isRTL && styles.rtlRow]}>
                    <Receipt size={16} color={colors.mutedForeground} />
                    <Text style={[modalStyles.infoText, isRTL && { marginRight: 8, marginLeft: 0 }]}>
                      {getSourceLabel(selectedOrder.order_source)}
                    </Text>
                  </View>
                </View>

                {/* Customer */}
                {(selectedOrder.customer_name || selectedOrder.customer_phone) && (
                  <View style={modalStyles.section}>
                    <Text style={[modalStyles.sectionTitle, isRTL && styles.rtlText]}>
                      {language === 'ar' ? 'العميل' : 'Customer'}
                    </Text>
                    {selectedOrder.customer_name && (
                      <View style={[modalStyles.infoRow, isRTL && styles.rtlRow]}>
                        <User size={16} color={colors.mutedForeground} />
                        <Text style={[modalStyles.infoText, isRTL && { marginRight: 8, marginLeft: 0 }]}>
                          {selectedOrder.customer_name}
                        </Text>
                      </View>
                    )}
                    {selectedOrder.customer_phone && (
                      <View style={[modalStyles.infoRow, isRTL && styles.rtlRow]}>
                        <Phone size={16} color={colors.mutedForeground} />
                        <Text style={[modalStyles.infoText, isRTL && { marginRight: 8, marginLeft: 0 }]}>
                          {selectedOrder.customer_phone}
                        </Text>
                      </View>
                    )}
                    {selectedOrder.delivery_address && (
                      <View style={[modalStyles.infoRow, isRTL && styles.rtlRow]}>
                        <MapPin size={16} color={colors.mutedForeground} />
                        <Text style={[modalStyles.infoText, isRTL && { marginRight: 8, marginLeft: 0 }]}>
                          {selectedOrder.delivery_address}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Table (Dine-in) */}
                {selectedOrder.table_number && (
                  <View style={modalStyles.section}>
                    <Text style={[modalStyles.sectionTitle, isRTL && styles.rtlText]}>
                      {language === 'ar' ? 'الطاولة' : 'Table'}
                    </Text>
                    <Text style={[modalStyles.tableNumber, isRTL && styles.rtlText]}>
                      {selectedOrder.table_number}
                    </Text>
                  </View>
                )}

                {/* Payment Details */}
                <View style={modalStyles.section}>
                  <Text style={[modalStyles.sectionTitle, isRTL && styles.rtlText]}>
                    {language === 'ar' ? 'تفاصيل الدفع' : 'Payment Details'}
                  </Text>
                  <View style={[modalStyles.paymentRow, isRTL && styles.rtlRow]}>
                    <Text style={modalStyles.paymentLabel}>{language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}</Text>
                    <Text style={modalStyles.paymentValue}>{formatCurrency(selectedOrder.subtotal)}</Text>
                  </View>
                  {selectedOrder.discount_amount > 0 && (
                    <View style={[modalStyles.paymentRow, isRTL && styles.rtlRow]}>
                      <Text style={modalStyles.paymentLabel}>{language === 'ar' ? 'الخصم' : 'Discount'}</Text>
                      <Text style={[modalStyles.paymentValue, { color: '#dc2626' }]}>
                        -{formatCurrency(selectedOrder.discount_amount)}
                      </Text>
                    </View>
                  )}
                  {selectedOrder.tax_amount > 0 && (
                    <View style={[modalStyles.paymentRow, isRTL && styles.rtlRow]}>
                      <Text style={modalStyles.paymentLabel}>{language === 'ar' ? 'الضريبة' : 'Tax'}</Text>
                      <Text style={modalStyles.paymentValue}>{formatCurrency(selectedOrder.tax_amount)}</Text>
                    </View>
                  )}
                  {selectedOrder.delivery_fee > 0 && (
                    <View style={[modalStyles.paymentRow, isRTL && styles.rtlRow]}>
                      <Text style={modalStyles.paymentLabel}>{language === 'ar' ? 'رسوم التوصيل' : 'Delivery Fee'}</Text>
                      <Text style={modalStyles.paymentValue}>{formatCurrency(selectedOrder.delivery_fee)}</Text>
                    </View>
                  )}
                  <View style={[modalStyles.paymentRow, modalStyles.paymentTotal, isRTL && styles.rtlRow]}>
                    <Text style={modalStyles.paymentTotalLabel}>{language === 'ar' ? 'الإجمالي' : 'Total'}</Text>
                    <Text style={modalStyles.paymentTotalValue}>{formatCurrency(selectedOrder.total_amount)}</Text>
                  </View>
                </View>

                {/* Payment Status */}
                <View style={[modalStyles.paymentStatusRow, isRTL && styles.rtlRow]}>
                  <View style={[modalStyles.infoRow, isRTL && styles.rtlRow]}>
                    <CreditCard size={18} color={colors.mutedForeground} />
                    <Text style={[modalStyles.infoText, isRTL && { marginRight: 8, marginLeft: 0 }]}>
                      {selectedOrder.payment_method || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                    </Text>
                  </View>
                  <Text style={[
                    modalStyles.paymentStatusText,
                    { color: selectedOrder.payment_status === 'paid' ? '#059669'
                      : selectedOrder.payment_status === 'app_payment' ? '#2563eb'
                      : '#d97706' }
                  ]}>
                    {getPaymentStatusLabel(selectedOrder.payment_status)}
                  </Text>
                </View>

                {/* Order Timeline Section */}
                <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Clock size={18} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                      {language === 'ar' ? 'الجدول الزمني للطلب' : 'Order Timeline'}
                    </Text>
                  </View>

                  {/* Timeline Tabs */}
                  <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                        backgroundColor: activeTimelineTab === 'order_status' ? colors.primary : colors.muted,
                      }}
                      onPress={() => setActiveTimelineTab('order_status')}
                    >
                      <Text style={{
                        color: activeTimelineTab === 'order_status' ? '#fff' : colors.foreground,
                        fontWeight: '600',
                        fontSize: 13,
                      }}>
                        {language === 'ar' ? 'حالة الطلب' : 'Order Status'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                        backgroundColor: activeTimelineTab === 'payment_status' ? colors.primary : colors.muted,
                      }}
                      onPress={() => setActiveTimelineTab('payment_status')}
                    >
                      <Text style={{
                        color: activeTimelineTab === 'payment_status' ? '#fff' : colors.foreground,
                        fontWeight: '600',
                        fontSize: 13,
                      }}>
                        {language === 'ar' ? 'حالة الدفع' : 'Payment Status'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Timeline Content */}
                  {loadingTimeline ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
                  ) : (
                    <View>
                      {(() => {
                        const timelineEvents = activeTimelineTab === 'order_status'
                          ? categorizedTimeline.order_status
                          : categorizedTimeline.payment_status;

                        if (timelineEvents.length === 0) {
                          return (
                            <Text style={{ color: colors.mutedForeground, textAlign: 'center', padding: 16 }}>
                              {language === 'ar' ? 'لا توجد أحداث' : 'No events'}
                            </Text>
                          );
                        }

                        return timelineEvents.map((event: any, index: number) => {
                          const eventColor = getTimelineEventColor(event.display_type);
                          const isLast = index === timelineEvents.length - 1;

                          return (
                            <View key={event.id || index} style={{ flexDirection: 'row', marginBottom: isLast ? 0 : 12 }}>
                              {/* Timeline line and dot */}
                              <View style={{ alignItems: 'center', marginRight: 12 }}>
                                <View style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 5,
                                  backgroundColor: eventColor,
                                }} />
                                {!isLast && (
                                  <View style={{
                                    width: 2,
                                    flex: 1,
                                    backgroundColor: colors.border,
                                    marginTop: 4,
                                  }} />
                                )}
                              </View>

                              {/* Event content */}
                              <View style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
                                <Text style={{
                                  color: colors.foreground,
                                  fontWeight: '600',
                                  fontSize: 13,
                                  marginBottom: 2,
                                }}>
                                  {event.description}
                                </Text>
                                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                                  {new Date(event.created_at).toLocaleString(language === 'ar' ? 'ar-KW' : 'en-US')}
                                </Text>
                                {event.done_by && (
                                  <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 1 }}>
                                    {language === 'ar' ? 'بواسطة' : 'done by'}: {event.done_by}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        });
                      })()}
                    </View>
                  )}
                </View>

                {/* Make Payment Button - for unpaid orders that haven't been edited */}
                {orderNeedsPayment(selectedOrder) && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: colors.primary,
                      paddingVertical: 14,
                      borderRadius: 10,
                      alignItems: 'center',
                      marginTop: 16,
                    }}
                    onPress={() => setShowPaymentModal(true)}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                      {language === 'ar' ? 'إجراء الدفع' : 'Make Payment'}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Scanner Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => setScannerVisible(false)}
      >
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>
              {language === 'ar' ? 'مسح رمز QR للطلب' : 'Scan Order QR Code'}
            </Text>
            <TouchableOpacity onPress={() => setScannerVisible(false)}>
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          
          {permission?.granted ? (
            <>
              <CameraView
                style={styles.camera}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'ean13', 'ean8', 'code128'],
                }}
              />
              {processing && (
                <View style={styles.scannerProcessing}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.scannerProcessingText}>
                    {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.permissionContainer}>
              <AlertCircle size={48} color={colors.mutedForeground} />
              <Text style={styles.permissionText}>
                {language === 'ar' ? 'إذن الكاميرا مطلوب' : 'Camera permission required'}
              </Text>
              <TouchableOpacity 
                style={styles.grantButton}
                onPress={requestPermission}
              >
                <Text style={styles.grantButtonText}>
                  {language === 'ar' ? 'منح الإذن' : 'Grant Permission'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.scannerFooter}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerInstructions}>
              {language === 'ar'
                ? 'ضع رمز QR داخل الإطار'
                : 'Position the QR code within the frame'}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={paymentModalStyles.overlay}>
          <View style={paymentModalStyles.container}>
            <View style={paymentModalStyles.header}>
              <Text style={paymentModalStyles.title}>
                {language === 'ar' ? 'إجراء الدفع' : 'Make Payment'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowPaymentModal(false);
                setCustomerPaidAmount('');
                setTransactionNumber('');
              }}>
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={paymentModalStyles.content}>
                {/* Order Total */}
                <View style={paymentModalStyles.totalSection}>
                  <Text style={paymentModalStyles.totalLabel}>
                    {language === 'ar' ? 'الإجمالي المستحق' : 'Total Due'}
                  </Text>
                  <Text style={paymentModalStyles.totalAmount}>
                    {formatCurrency(selectedOrder.total_amount)}
                  </Text>
                </View>

                {/* Cash Payment Section */}
                <View style={paymentModalStyles.paymentSection}>
                  <Text style={paymentModalStyles.sectionTitle}>
                    {language === 'ar' ? 'الدفع نقداً' : 'Cash Payment'}
                  </Text>
                  <TextInput
                    style={paymentModalStyles.input}
                    placeholder={language === 'ar' ? 'المبلغ المدفوع' : 'Amount Received'}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    value={customerPaidAmount}
                    onChangeText={setCustomerPaidAmount}
                  />
                  {customerPaidAmount && parseFloat(customerPaidAmount) >= selectedOrder.total_amount && (
                    <Text style={paymentModalStyles.changeText}>
                      {language === 'ar' ? 'الباقي: ' : 'Change: '}
                      {formatCurrency(parseFloat(customerPaidAmount) - selectedOrder.total_amount)}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[
                      paymentModalStyles.payButton,
                      { backgroundColor: '#059669' },
                      isProcessingPayment && { opacity: 0.5 }
                    ]}
                    onPress={() => processPayment('cash')}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={paymentModalStyles.payButtonText}>
                        {language === 'ar' ? 'دفع نقداً' : 'Pay with Cash'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Card Payment Section */}
                <View style={paymentModalStyles.paymentSection}>
                  <Text style={paymentModalStyles.sectionTitle}>
                    {language === 'ar' ? 'الدفع بالبطاقة' : 'Card Payment'}
                  </Text>
                  <TextInput
                    style={paymentModalStyles.input}
                    placeholder={language === 'ar' ? 'رقم المعاملة' : 'Transaction Number'}
                    placeholderTextColor={colors.mutedForeground}
                    value={transactionNumber}
                    onChangeText={setTransactionNumber}
                  />
                  <TouchableOpacity
                    style={[
                      paymentModalStyles.payButton,
                      { backgroundColor: '#2563eb' },
                      isProcessingPayment && { opacity: 0.5 }
                    ]}
                    onPress={() => processPayment('card')}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={paymentModalStyles.payButtonText}>
                        {language === 'ar' ? 'دفع بالبطاقة' : 'Pay with Card'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  dateFilterButtonActive: {
    backgroundColor: colors.foreground,
  },
  dateFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  dateFilterTextActive: {
    color: colors.background,
  },
  filterScroll: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 52,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  filterChipActive: {
    backgroundColor: colors.foreground,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterChipTextActive: {
    color: colors.background,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  ordersList: {
    padding: 16,
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  orderTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
  },
  orderTypeText: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginLeft: 6,
  },
  orderCustomer: {
    fontSize: 13,
    color: colors.foreground,
    fontWeight: '500',
    flexShrink: 0,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  orderTime: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  paymentStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
  scanButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  camera: {
    flex: 1,
  },
  scannerProcessing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerProcessingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    color: colors.foreground,
    marginTop: 16,
    textAlign: 'center',
  },
  grantButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  grantButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  scannerFooter: {
    padding: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  scannerFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    marginBottom: 16,
  },
  scannerInstructions: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

const createModalStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 24,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  content: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  section: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.foreground,
    marginLeft: 8,
  },
  tableNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  paymentValue: {
    fontSize: 13,
    color: colors.foreground,
  },
  paymentTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  paymentTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  paymentTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  paymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 14,
  },
  paymentStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

const createPaymentModalStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  content: {
    padding: 20,
  },
  totalSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: colors.secondary,
    borderRadius: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
  },
  paymentSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    marginBottom: 12,
  },
  changeText: {
    fontSize: 14,
    color: '#059669',
    marginBottom: 12,
    fontWeight: '600',
  },
  payButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

