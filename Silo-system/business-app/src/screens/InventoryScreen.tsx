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
  Alert
} from 'react-native';
import { colors } from '../theme/colors';
import api from '../api/client';
import { cacheManager, CACHE_TTL } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import { 
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Package,
  Truck,
  FileText,
  ArrowLeftRight,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Minus,
  Edit2,
  Building2,
  Phone,
  Mail,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar
} from 'lucide-react-native';

// Types
interface InventoryStock {
  id: number;
  business_id: number;
  branch_id?: number | null;
  item_id: number;
  quantity: number;
  reserved_quantity: number;
  min_quantity: number;
  max_quantity?: number | null;
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    unit: string;
    storage_unit?: string;
    category: string;
    sku?: string;
  };
}

interface Vendor {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  status: 'active' | 'inactive';
}

interface PurchaseOrder {
  id: number;
  order_number: string;
  status: string;
  order_date: string;
  expected_date?: string | null;
  total_amount: number;
  vendor?: Vendor;
  items_count?: number;
}

interface InventoryTransfer {
  id: number;
  transfer_number: string;
  status: string;
  transfer_date: string;
  from_branch?: { id: number; name: string; name_ar?: string };
  to_branch?: { id: number; name: string; name_ar?: string };
  items_count?: number;
}

// Timeline types
type TransactionType = 
  | 'manual_addition'
  | 'manual_deduction'
  | 'transfer_in'
  | 'transfer_out'
  | 'order_sale'
  | 'po_receive'
  | 'production_consume'
  | 'production_yield'
  | 'inventory_count_adjustment'
  | 'order_void_return';

type DeductionReason = 'expired' | 'damaged' | 'spoiled' | 'others';

interface InventoryTransaction {
  id: number;
  business_id: number;
  branch_id: number | null;
  item_id: number;
  transaction_type: TransactionType;
  quantity: number;
  unit: string;
  deduction_reason: DeductionReason | null;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  performed_by: number | null;
  created_at: string;
  quantity_before: number | null;
  quantity_after: number | null;
  item?: {
    id: number;
    name: string;
    name_ar: string | null;
    sku: string | null;
    unit: string;
    storage_unit: string;
  };
  branch?: {
    id: number;
    name: string;
    name_ar: string | null;
  };
  user?: {
    id: number;
    username: string;
    full_name: string | null;
  };
}

interface TimelineStats {
  today_transactions: number;
  today_additions: number;
  today_deductions: number;
  week_transactions: number;
}

type TabType = 'inventory' | 'vendors' | 'purchase-orders' | 'transfers' | 'timeline';

// Skeleton component
const Skeleton = ({ width: w, height, borderRadius = 8, style }: { width: number | string; height: number; borderRadius?: number; style?: any }) => {
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

const ItemSkeleton = ({ styles }: { styles: any }) => (
  <View style={styles.listCard}>
    <View style={styles.listCardContent}>
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={50} height={24} borderRadius={6} />
    </View>
  </View>
);

export default function InventoryScreen({ navigation }: any) {
  const { t, isRTL, language, formatCurrency } = useLocalization();
  
  const [activeTab, setActiveTab] = useState<TabType>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [stockItems, setStockItems] = useState<InventoryStock[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [poStatusFilter, setPOStatusFilter] = useState<'all' | 'pending' | 'counted' | 'received' | 'cancelled'>('all');
  
  // Timeline state
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [timelineStats, setTimelineStats] = useState<TimelineStats | null>(null);
  const [timelineItemFilter, setTimelineItemFilter] = useState<{ id: number; name: string } | null>(null);
  
  // Adjustment modal state
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentStock, setAdjustmentStock] = useState<InventoryStock | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'deduct'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState<DeductionReason | null>(null);
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  
  // Stock stats from backend - all calculations done server-side
  const [stockStats, setStockStats] = useState<{
    total_items: number;
    low_stock_count: number;
    out_of_stock_count: number;
    healthy_stock_count: number;
  }>({ total_items: 0, low_stock_count: 0, out_of_stock_count: 0, healthy_stock_count: 0 });

  const tabs: { key: TabType; label: string; labelAr: string; icon: any }[] = [
    { key: 'inventory', label: 'Stock', labelAr: 'المخزون', icon: Package },
    { key: 'vendors', label: 'Vendors', labelAr: 'الموردين', icon: Truck },
    { key: 'purchase-orders', label: 'POs', labelAr: 'الطلبات', icon: FileText },
    { key: 'transfers', label: 'Transfers', labelAr: 'التحويلات', icon: ArrowLeftRight },
    { key: 'timeline', label: 'Timeline', labelAr: 'السجل', icon: History },
  ];

  useEffect(() => {
    loadData(false);
  }, [activeTab, filterLowStock]);

  const loadData = async (forceRefresh = false) => {
    try {
      switch (activeTab) {
        case 'inventory':
          await loadStockLevels(forceRefresh);
          break;
        case 'vendors':
          await loadVendors(forceRefresh);
          break;
        case 'purchase-orders':
          await loadPurchaseOrders(forceRefresh);
          break;
        case 'transfers':
          await loadTransfers(forceRefresh);
          break;
        case 'timeline':
          await loadTimeline(forceRefresh);
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadStockLevels = async (forceRefresh = false) => {
    const cacheKey = `inventory_stock_${filterLowStock ? 'low' : 'all'}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cached = await cacheManager.get<{items: InventoryStock[], stats: any}>(cacheKey);
      if (cached) {
        setStockItems(cached.items);
        if (cached.stats) setStockStats(cached.stats);
        setLoading(false);
        // Refresh in background
        Promise.all([
          api.get(`/inventory-stock/stock${filterLowStock ? '?low_stock=true' : ''}`),
          api.get('/inventory-stock/stock/stats'),
        ]).then(([stockResponse, statsResponse]) => {
          const newData = {
            items: stockResponse.data.data || [],
            stats: statsResponse.data.stats,
          };
          if (JSON.stringify(newData) !== JSON.stringify(cached)) {
            setStockItems(newData.items);
            if (newData.stats) setStockStats(newData.stats);
            cacheManager.set(cacheKey, newData, CACHE_TTL.SHORT);
          }
        }).catch(() => {});
        return;
      }
    }
    
    setLoading(true);
    try {
      const params = filterLowStock ? '?low_stock=true' : '';
      const [stockResponse, statsResponse] = await Promise.all([
        api.get(`/inventory-stock/stock${params}`),
        api.get('/inventory-stock/stock/stats'),
      ]);
      const newData = {
        items: stockResponse.data.data || [],
        stats: statsResponse.data.stats,
      };
      setStockItems(newData.items);
      if (newData.stats) setStockStats(newData.stats);
      await cacheManager.set(cacheKey, newData, CACHE_TTL.SHORT);
    } catch (error) {
      console.error('Failed to load stock levels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async (forceRefresh = false) => {
    const cacheKey = 'inventory_vendors';
    
    if (!forceRefresh) {
      const cached = await cacheManager.get<Vendor[]>(cacheKey);
      if (cached) {
        setVendors(cached);
        setLoading(false);
        api.get('/inventory-stock/vendors').then(response => {
          const newData = response.data.data || [];
          if (JSON.stringify(newData) !== JSON.stringify(cached)) {
            setVendors(newData);
            cacheManager.set(cacheKey, newData, CACHE_TTL.MEDIUM);
          }
        }).catch(() => {});
        return;
      }
    }
    
    setLoading(true);
    try {
      const response = await api.get('/inventory-stock/vendors');
      const data = response.data.data || [];
      setVendors(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.MEDIUM);
    } catch (error) {
      console.error('Failed to load vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseOrders = async (forceRefresh = false) => {
    const cacheKey = 'inventory_purchase_orders';
    
    if (!forceRefresh) {
      const cached = await cacheManager.get<PurchaseOrder[]>(cacheKey);
      if (cached) {
        setPurchaseOrders(cached);
        setLoading(false);
        api.get('/inventory-stock/purchase-orders').then(response => {
          const newData = response.data.data || [];
          if (JSON.stringify(newData) !== JSON.stringify(cached)) {
            setPurchaseOrders(newData);
            cacheManager.set(cacheKey, newData, CACHE_TTL.SHORT);
          }
        }).catch(() => {});
        return;
      }
    }
    
    setLoading(true);
    try {
      const response = await api.get('/inventory-stock/purchase-orders');
      const data = response.data.data || [];
      setPurchaseOrders(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.SHORT);
    } catch (error) {
      console.error('Failed to load purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransfers = async (forceRefresh = false) => {
    const cacheKey = 'inventory_transfers';
    
    if (!forceRefresh) {
      const cached = await cacheManager.get<InventoryTransfer[]>(cacheKey);
      if (cached) {
        setTransfers(cached);
        setLoading(false);
        api.get('/inventory-stock/transfers').then(response => {
          const newData = response.data.data || [];
          if (JSON.stringify(newData) !== JSON.stringify(cached)) {
            setTransfers(newData);
            cacheManager.set(cacheKey, newData, CACHE_TTL.MEDIUM);
          }
        }).catch(() => {});
        return;
      }
    }
    
    setLoading(true);
    try {
      const response = await api.get('/inventory-stock/transfers');
      const data = response.data.data || [];
      setTransfers(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.MEDIUM);
    } catch (error) {
      console.error('Failed to load transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async (forceRefresh = false, itemId?: number, branchId?: number) => {
    const filterItemId = itemId ?? timelineItemFilter?.id;
    const cacheKey = filterItemId ? `inventory_timeline_item_${filterItemId}` : 'inventory_timeline';
    
    // Build query params - include branch_id if available for branch-level filtering
    const params = new URLSearchParams();
    if (filterItemId) params.append('item_id', filterItemId.toString());
    if (branchId) params.append('branch_id', branchId.toString());
    params.append('limit', '100');
    const timelineUrl = `/inventory/timeline?${params.toString()}`;
    
    if (!forceRefresh) {
      const cached = await cacheManager.get<{transactions: InventoryTransaction[], stats: TimelineStats}>(cacheKey);
      if (cached) {
        setTransactions(cached.transactions);
        setTimelineStats(cached.stats);
        setLoading(false);
        // Background refresh
        Promise.all([
          api.get(timelineUrl),
          api.get('/inventory/timeline/stats'),
        ]).then(([timelineRes, statsRes]) => {
          const newData = {
            transactions: timelineRes.data.transactions || [],
            stats: statsRes.data.data,
          };
          if (JSON.stringify(newData) !== JSON.stringify(cached)) {
            setTransactions(newData.transactions);
            setTimelineStats(newData.stats);
            cacheManager.set(cacheKey, newData, CACHE_TTL.SHORT);
          }
        }).catch(() => {});
        return;
      }
    }
    
    setLoading(true);
    try {
      const [timelineRes, statsRes] = await Promise.all([
        api.get(timelineUrl),
        api.get('/inventory/timeline/stats'),
      ]);
      const newData = {
        transactions: timelineRes.data.transactions || [],
        stats: statsRes.data.data,
      };
      setTransactions(newData.transactions);
      setTimelineStats(newData.stats);
      await cacheManager.set(cacheKey, newData, CACHE_TTL.SHORT);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter timeline by item
  const handleFilterByItem = (itemId: number, itemName: string) => {
    if (timelineItemFilter?.id === itemId) {
      // Clear filter
      setTimelineItemFilter(null);
      loadTimeline(true, undefined);
    } else {
      setTimelineItemFilter({ id: itemId, name: itemName });
      loadTimeline(true, itemId);
    }
  };

  const clearTimelineFilter = () => {
    setTimelineItemFilter(null);
    loadTimeline(true, undefined);
  };

  // Adjustment functions
  const handleOpenAdjustment = (stock: InventoryStock) => {
    setAdjustmentStock(stock);
    setAdjustmentType('add');
    setAdjustmentQuantity('');
    setAdjustmentReason(null);
    setAdjustmentNotes('');
    setShowAdjustmentModal(true);
  };

  const handleSubmitAdjustment = async () => {
    if (!adjustmentStock) return;

    const qty = parseFloat(adjustmentQuantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'الرجاء إدخال كمية صحيحة' : 'Please enter a valid quantity'
      );
      return;
    }

    if (adjustmentType === 'add' && !adjustmentNotes.trim()) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'الملاحظات مطلوبة للإضافات' : 'Notes are required for additions'
      );
      return;
    }

    if (adjustmentType === 'deduct') {
      if (!adjustmentReason) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? 'الرجاء اختيار سبب الخصم' : 'Please select a deduction reason'
        );
        return;
      }
      if (adjustmentReason === 'others' && !adjustmentNotes.trim()) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? 'الملاحظات مطلوبة عند اختيار "أخرى"' : 'Notes are required when reason is "Others"'
        );
        return;
      }
      if (qty > adjustmentStock.quantity) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? `المخزون غير كافٍ. المتاح: ${adjustmentStock.quantity}` : `Insufficient stock. Available: ${adjustmentStock.quantity}`
        );
        return;
      }
    }

    setAdjustmentLoading(true);

    try {
      if (adjustmentType === 'add') {
        await api.post('/inventory/adjustments/add', {
          item_id: adjustmentStock.item_id,
          quantity: qty,
          notes: adjustmentNotes.trim(),
        });
      } else {
        await api.post('/inventory/adjustments/deduct', {
          item_id: adjustmentStock.item_id,
          quantity: qty,
          reason: adjustmentReason,
          notes: adjustmentReason === 'others' ? adjustmentNotes.trim() : (adjustmentNotes.trim() || null),
        });
      }

      setShowAdjustmentModal(false);
      loadData(true); // Refresh data
      
      Alert.alert(
        language === 'ar' ? 'تم' : 'Success',
        adjustmentType === 'add'
          ? (language === 'ar' ? 'تمت إضافة المخزون بنجاح' : 'Stock added successfully')
          : (language === 'ar' ? 'تم خصم المخزون بنجاح' : 'Stock deducted successfully')
      );
    } catch (error: any) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        error.response?.data?.error || (language === 'ar' ? 'فشل في تعديل المخزون' : 'Failed to adjust stock')
      );
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true); // Force refresh on pull-to-refresh
  }, [activeTab, filterLowStock]);

  const getStockStatus = (stock: InventoryStock) => {
    if (stock.quantity === 0) return { status: 'out', label: language === 'ar' ? 'نفذ' : 'Out', color: '#dc2626', bg: '#fee2e2' };
    if (stock.quantity <= stock.min_quantity) return { status: 'low', label: language === 'ar' ? 'منخفض' : 'Low', color: '#d97706', bg: '#fef3c7' };
    return { status: 'healthy', label: language === 'ar' ? 'متوفر' : 'In Stock', color: '#059669', bg: '#d1fae5' };
  };

  const getPOStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return { color: '#71717a', bg: '#f4f4f5' };
      case 'pending': return { color: '#d97706', bg: '#fef3c7' };
      case 'counted': return { color: '#2563eb', bg: '#dbeafe' };
      case 'approved': return { color: '#2563eb', bg: '#dbeafe' };
      case 'ordered': return { color: '#7c3aed', bg: '#ede9fe' };
      case 'partial': return { color: '#0891b2', bg: '#cffafe' };
      case 'received': return { color: '#059669', bg: '#d1fae5' };
      case 'delivered': return { color: '#059669', bg: '#d1fae5' };
      case 'cancelled': return { color: '#dc2626', bg: '#fee2e2' };
      default: return { color: '#71717a', bg: '#f4f4f5' };
    }
  };

  const getTransferStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { color: '#d97706', bg: '#fef3c7' };
      case 'received': return { color: '#059669', bg: '#d1fae5' };
      case 'cancelled': return { color: '#dc2626', bg: '#fee2e2' };
      default: return { color: '#71717a', bg: '#f4f4f5' };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-KW' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter items based on search
  const filteredStockItems = stockItems.filter(stock => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      stock.item?.name?.toLowerCase().includes(query) ||
      stock.item?.name_ar?.toLowerCase().includes(query) ||
      stock.item?.sku?.toLowerCase().includes(query)
    );
  });

  const filteredVendors = vendors.filter(vendor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      vendor.name?.toLowerCase().includes(query) ||
      vendor.name_ar?.toLowerCase().includes(query) ||
      vendor.contact_person?.toLowerCase().includes(query)
    );
  });

  const filteredPOs = purchaseOrders.filter(po => {
    // Filter by status first
    if (poStatusFilter !== 'all') {
      // Map 'pending' filter to include both 'pending' and 'draft' statuses
      if (poStatusFilter === 'pending' && !['pending', 'draft'].includes(po.status)) {
        return false;
      }
      // Map 'received' filter to include both 'received' and 'delivered' statuses
      if (poStatusFilter === 'received' && !['received', 'delivered'].includes(po.status)) {
        return false;
      }
      // For other filters (counted, cancelled), match exactly
      if (!['pending', 'received'].includes(poStatusFilter) && po.status !== poStatusFilter) {
        return false;
      }
    }
    
    // Then filter by search query
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      po.order_number?.toLowerCase().includes(query) ||
      po.vendor?.name?.toLowerCase().includes(query)
    );
  });

  // Calculate PO counts by status for filter badges
  // Note: 'delivered' is grouped with 'received'
  const poStatusCounts = {
    all: purchaseOrders.length,
    pending: purchaseOrders.filter(po => ['pending', 'draft'].includes(po.status)).length,
    counted: purchaseOrders.filter(po => po.status === 'counted').length,
    received: purchaseOrders.filter(po => ['received', 'delivered'].includes(po.status)).length,
    cancelled: purchaseOrders.filter(po => po.status === 'cancelled').length,
  };

  const filteredTransfers = transfers.filter(transfer => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      transfer.transfer_number?.toLowerCase().includes(query) ||
      transfer.from_branch?.name?.toLowerCase().includes(query) ||
      transfer.to_branch?.name?.toLowerCase().includes(query)
    );
  });

  // Stats from backend - all calculations done server-side
  const totalItems = stockStats.total_items;
  const lowStockItems = stockStats.low_stock_count;
  const outOfStockItems = stockStats.out_of_stock_count;

  const renderStockCard = (stock: InventoryStock) => {
    const statusInfo = getStockStatus(stock);
    
    return (
      <TouchableOpacity 
        key={stock.id} 
        style={styles.listCard}
        onPress={() => handleOpenAdjustment(stock)}
        activeOpacity={0.7}
      >
        <View style={[styles.listCardContent, isRTL && styles.rtlRow]}>
          <View style={[styles.itemIcon, { backgroundColor: statusInfo.bg }]}>
            <Package size={22} color={statusInfo.color} />
          </View>
          <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
            <Text style={[styles.itemName, isRTL && styles.rtlText]} numberOfLines={1}>
              {language === 'ar' && stock.item?.name_ar ? stock.item.name_ar : stock.item?.name}
            </Text>
            <Text style={[styles.itemMeta, isRTL && styles.rtlText]}>
              {stock.item?.category} • {stock.item?.sku || 'N/A'}
            </Text>
          </View>
          <View style={[styles.stockInfo, isRTL && { alignItems: 'flex-start' }]}>
            <Text style={styles.stockQuantity}>{stock.quantity}</Text>
            <Text style={styles.stockUnit}>{stock.item?.storage_unit || stock.item?.unit}</Text>
            <View style={[styles.stockBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.stockBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVendorCard = (vendor: Vendor) => (
    <View key={vendor.id} style={styles.listCard}>
      <View style={[styles.listCardContent, isRTL && styles.rtlRow]}>
        <View style={[styles.itemIcon, { backgroundColor: '#dbeafe' }]}>
          <Building2 size={22} color="#2563eb" />
        </View>
        <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
          <Text style={[styles.itemName, isRTL && styles.rtlText]} numberOfLines={1}>
            {language === 'ar' && vendor.name_ar ? vendor.name_ar : vendor.name}
          </Text>
          <Text style={[styles.itemMeta, isRTL && styles.rtlText]}>
            {vendor.contact_person || (language === 'ar' ? 'لا يوجد جهة اتصال' : 'No contact')}
          </Text>
          {vendor.phone && (
            <View style={[styles.vendorContact, isRTL && styles.rtlRow]}>
              <Phone size={12} color={colors.mutedForeground} />
              <Text style={styles.vendorContactText}>{vendor.phone}</Text>
            </View>
          )}
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: vendor.status === 'active' ? '#d1fae5' : '#f4f4f5' }
        ]}>
          <Text style={[
            styles.statusBadgeText,
            { color: vendor.status === 'active' ? '#059669' : '#71717a' }
          ]}>
            {vendor.status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
          </Text>
        </View>
      </View>
    </View>
  );

  const getPOStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return language === 'ar' ? 'مسودة' : 'Draft';
      case 'pending': return language === 'ar' ? 'جديد' : 'New';
      case 'counted': return language === 'ar' ? 'تم العد' : 'Counted';
      case 'received': return language === 'ar' ? 'مستلم' : 'Received';
      case 'delivered': return language === 'ar' ? 'مستلم' : 'Delivered';
      case 'cancelled': return language === 'ar' ? 'ملغي' : 'Cancelled';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const renderPOCard = (po: PurchaseOrder) => {
    const statusColors = getPOStatusColor(po.status);
    
    return (
      <TouchableOpacity 
        key={po.id} 
        style={styles.listCard}
        onPress={() => navigation.navigate('PODetail', { orderId: po.id })}
        activeOpacity={0.7}
      >
        <View style={[styles.listCardContent, isRTL && styles.rtlRow]}>
          <View style={[styles.itemIcon, { backgroundColor: statusColors.bg }]}>
            <FileText size={22} color={statusColors.color} />
          </View>
          <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
            <Text style={[styles.itemName, isRTL && styles.rtlText]} numberOfLines={1}>
              {po.order_number}
            </Text>
            <Text style={[styles.itemMeta, isRTL && styles.rtlText]}>
              {po.vendor?.name || (language === 'ar' ? 'غير محدد' : 'Unknown Vendor')}
            </Text>
            <Text style={[styles.itemDate, isRTL && styles.rtlText]}>
              {formatDate(po.order_date)}
            </Text>
          </View>
          <View style={[styles.poInfo, isRTL && { alignItems: 'flex-start' }]}>
            <Text style={styles.poAmount}>
              {formatCurrency(po.total_amount || 0)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusColors.color }]}>
                {getPOStatusLabel(po.status)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTransferCard = (transfer: InventoryTransfer) => {
    const statusColors = getTransferStatusColor(transfer.status);
    
    return (
      <View key={transfer.id} style={styles.listCard}>
        <View style={[styles.listCardContent, isRTL && styles.rtlRow]}>
          <View style={[styles.itemIcon, { backgroundColor: statusColors.bg }]}>
            <ArrowLeftRight size={22} color={statusColors.color} />
          </View>
          <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
            <Text style={[styles.itemName, isRTL && styles.rtlText]} numberOfLines={1}>
              {transfer.transfer_number}
            </Text>
            <Text style={[styles.itemMeta, isRTL && styles.rtlText]}>
              {transfer.from_branch?.name || '?'} → {transfer.to_branch?.name || '?'}
            </Text>
            <Text style={[styles.itemDate, isRTL && styles.rtlText]}>
              {formatDate(transfer.transfer_date)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusColors.color }]}>
              {transfer.status}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <>
          <ItemSkeleton styles={styles} />
          <ItemSkeleton styles={styles} />
          <ItemSkeleton styles={styles} />
        </>
      );
    }

    switch (activeTab) {
      case 'inventory':
        return filteredStockItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>
              {language === 'ar' ? 'لا توجد عناصر في المخزون' : 'No stock items found'}
            </Text>
          </View>
        ) : (
          filteredStockItems.map(stock => renderStockCard(stock))
        );
      case 'vendors':
        return filteredVendors.length === 0 ? (
          <View style={styles.emptyState}>
            <Truck size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>
              {language === 'ar' ? 'لا يوجد موردين' : 'No vendors found'}
            </Text>
          </View>
        ) : (
          filteredVendors.map(vendor => renderVendorCard(vendor))
        );
      case 'purchase-orders':
        return filteredPOs.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>
              {language === 'ar' ? 'لا توجد أوامر شراء' : 'No purchase orders found'}
            </Text>
          </View>
        ) : (
          filteredPOs.map(po => renderPOCard(po))
        );
      case 'transfers':
        return filteredTransfers.length === 0 ? (
          <View style={styles.emptyState}>
            <ArrowLeftRight size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>
              {language === 'ar' ? 'لا توجد تحويلات' : 'No transfers found'}
            </Text>
          </View>
        ) : (
          filteredTransfers.map(transfer => renderTransferCard(transfer))
        );
      case 'timeline':
        return renderTimelineContent();
    }
  };

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'manual_addition': return <ArrowUpCircle size={16} color="#10b981" />;
      case 'manual_deduction': return <ArrowDownCircle size={16} color="#ef4444" />;
      case 'po_receive': return <Package size={16} color="#3b82f6" />;
      case 'order_sale': return <Minus size={16} color="#f97316" />;
      case 'transfer_in': return <ArrowRight size={16} color="#10b981" />;
      case 'transfer_out': return <ArrowLeftRight size={16} color="#f59e0b" />;
      case 'production_consume': return <Minus size={16} color="#8b5cf6" />;
      case 'production_yield': return <Plus size={16} color="#8b5cf6" />;
      default: return <Clock size={16} color="#a1a1aa" />;
    }
  };

  const getTransactionLabel = (type: TransactionType) => {
    const labels: Record<TransactionType, { en: string; ar: string }> = {
      'manual_addition': { en: 'Added', ar: 'إضافة' },
      'manual_deduction': { en: 'Deducted', ar: 'خصم' },
      'po_receive': { en: 'PO Received', ar: 'استلام PO' },
      'order_sale': { en: 'Sold', ar: 'بيع' },
      'transfer_in': { en: 'Transfer In', ar: 'تحويل وارد' },
      'transfer_out': { en: 'Transfer Out', ar: 'تحويل صادر' },
      'production_consume': { en: 'Production', ar: 'إنتاج' },
      'production_yield': { en: 'Produced', ar: 'منتج' },
      'inventory_count_adjustment': { en: 'Count', ar: 'جرد' },
      'order_void_return': { en: 'Return', ar: 'إرجاع' },
    };
    return language === 'ar' ? labels[type]?.ar : labels[type]?.en;
  };

  const getReasonLabel = (reason: DeductionReason) => {
    const labels: Record<DeductionReason, { en: string; ar: string }> = {
      'expired': { en: 'Expired', ar: 'منتهي' },
      'damaged': { en: 'Damaged', ar: 'تالف' },
      'spoiled': { en: 'Spoiled', ar: 'فاسد' },
      'others': { en: 'Others', ar: 'أخرى' },
    };
    return language === 'ar' ? labels[reason]?.ar : labels[reason]?.en;
  };

  const isAdditionType = (type: TransactionType) => {
    return ['manual_addition', 'po_receive', 'transfer_in', 'production_yield', 'order_void_return'].includes(type);
  };

  const renderTimelineContent = () => {
    if (transactions.length === 0 && !timelineItemFilter) {
      return (
        <View style={styles.emptyState}>
          <History size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>
            {language === 'ar' ? 'لا توجد معاملات' : 'No transactions yet'}
          </Text>
        </View>
      );
    }

    return (
      <>
        {/* Item Filter Banner */}
        {timelineItemFilter && (
          <TouchableOpacity style={styles.filterBanner} onPress={clearTimelineFilter}>
            <View style={[styles.filterBannerContent, isRTL && styles.rtlRow]}>
              <Package size={16} color="#3b82f6" />
              <Text style={styles.filterBannerText}>
                {language === 'ar' ? 'تصفية حسب: ' : 'Filtered by: '}{timelineItemFilter.name}
              </Text>
              <X size={16} color="#3b82f6" />
            </View>
          </TouchableOpacity>
        )}

        {/* Empty state for filtered view */}
        {transactions.length === 0 && timelineItemFilter && (
          <View style={styles.emptyState}>
            <History size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>
              {language === 'ar' ? 'لا توجد معاملات لهذا العنصر' : 'No transactions for this item'}
            </Text>
          </View>
        )}

        {/* Timeline Stats */}
        {timelineStats && !timelineItemFilter && (
          <View style={styles.timelineStats}>
            <View style={styles.timelineStatItem}>
              <Text style={styles.timelineStatValue}>{timelineStats.today_transactions}</Text>
              <Text style={styles.timelineStatLabel}>{language === 'ar' ? 'اليوم' : 'Today'}</Text>
            </View>
            <View style={[styles.timelineStatItem, { backgroundColor: '#d1fae5' }]}>
              <Text style={[styles.timelineStatValue, { color: '#059669' }]}>+{timelineStats.today_additions}</Text>
              <Text style={styles.timelineStatLabel}>{language === 'ar' ? 'إضافات' : 'In'}</Text>
            </View>
            <View style={[styles.timelineStatItem, { backgroundColor: '#fee2e2' }]}>
              <Text style={[styles.timelineStatValue, { color: '#dc2626' }]}>-{timelineStats.today_deductions}</Text>
              <Text style={styles.timelineStatLabel}>{language === 'ar' ? 'خصومات' : 'Out'}</Text>
            </View>
            <View style={styles.timelineStatItem}>
              <Text style={styles.timelineStatValue}>{timelineStats.week_transactions}</Text>
              <Text style={styles.timelineStatLabel}>{language === 'ar' ? 'الأسبوع' : 'Week'}</Text>
            </View>
          </View>
        )}

        {/* Timeline entries */}
        {transactions.map((tx) => (
          <View key={tx.id} style={styles.timelineCard}>
            <View style={[styles.timelineRow, isRTL && styles.rtlRow]}>
              <View style={[
                styles.timelineDot,
                { backgroundColor: isAdditionType(tx.transaction_type) ? '#d1fae5' : '#fee2e2' }
              ]}>
                {getTransactionIcon(tx.transaction_type)}
              </View>
              <View style={[styles.timelineContent, isRTL && { alignItems: 'flex-end' }]}>
                <View style={[styles.timelineHeader, isRTL && styles.rtlRow]}>
                  <View style={[
                    styles.timelineQtyBadge,
                    { backgroundColor: isAdditionType(tx.transaction_type) ? '#d1fae5' : '#fee2e2' }
                  ]}>
                    <Text style={[
                      styles.timelineQtyText,
                      { color: isAdditionType(tx.transaction_type) ? '#059669' : '#dc2626' }
                    ]}>
                      {isAdditionType(tx.transaction_type) ? '+' : '-'}{tx.quantity} {tx.unit}
                    </Text>
                  </View>
                  <Text style={styles.timelineType}>
                    {getTransactionLabel(tx.transaction_type)}
                  </Text>
                  {tx.deduction_reason && (
                    <Text style={styles.timelineReason}>
                      ({getReasonLabel(tx.deduction_reason)})
                    </Text>
                  )}
                </View>
                <TouchableOpacity 
                  onPress={() => tx.item && handleFilterByItem(tx.item.id, language === 'ar' && tx.item.name_ar ? tx.item.name_ar : tx.item.name)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.timelineItemName, isRTL && styles.rtlText, styles.timelineItemNameLink]} numberOfLines={1}>
                    {language === 'ar' && tx.item?.name_ar ? tx.item.name_ar : tx.item?.name}
                  </Text>
                </TouchableOpacity>
                {tx.notes && (
                  <Text style={[styles.timelineNotes, isRTL && styles.rtlText]} numberOfLines={2}>
                    "{tx.notes}"
                  </Text>
                )}
                <View style={[styles.timelineMeta, isRTL && styles.rtlRow]}>
                  <Text style={styles.timelineTime}>
                    {new Date(tx.created_at).toLocaleString(language === 'ar' ? 'ar-KW' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  {tx.user && <Text style={styles.timelineUser}>• {tx.user.username}</Text>}
                </View>
              </View>
            </View>
          </View>
        ))}
      </>
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
            {t('inventory')}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        
        {/* Search */}
        <View style={[styles.searchContainer, isRTL && styles.rtlRow]}>
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, isRTL && styles.rtlText]}
            placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
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

      {/* Tabs - Horizontally scrollable for better fit */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabScrollContainer}
        contentContainerStyle={[styles.tabContainer, isRTL && { flexDirection: 'row-reverse' }]}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon size={18} color={isActive ? '#fff' : colors.mutedForeground} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {language === 'ar' ? tab.labelAr : tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stock Stats (only for inventory tab) */}
      {activeTab === 'inventory' && !loading && (
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={[styles.statItem, !filterLowStock && styles.statItemActive]}
            onPress={() => setFilterLowStock(false)}
          >
            <Text style={[styles.statValue, !filterLowStock && styles.statValueActive]}>{totalItems}</Text>
            <Text style={styles.statLabel}>{language === 'ar' ? 'الكل' : 'All'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.statItem, filterLowStock && styles.statItemActive]}
            onPress={() => setFilterLowStock(true)}
          >
            <Text style={[styles.statValue, { color: '#d97706' }]}>{lowStockItems}</Text>
            <Text style={styles.statLabel}>{language === 'ar' ? 'منخفض' : 'Low'}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#dc2626' }]}>{outOfStockItems}</Text>
            <Text style={styles.statLabel}>{language === 'ar' ? 'نفذ' : 'Out'}</Text>
          </View>
        </View>
      )}

      {/* PO Status Filters (only for purchase-orders tab) */}
      {activeTab === 'purchase-orders' && !loading && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.poFiltersContainer}
          contentContainerStyle={[styles.poFiltersContent, isRTL && { flexDirection: 'row-reverse' }]}
        >
          <TouchableOpacity 
            style={[styles.poFilterTab, poStatusFilter === 'all' && styles.poFilterTabActive]}
            onPress={() => setPOStatusFilter('all')}
          >
            <Text style={[styles.poFilterText, poStatusFilter === 'all' && styles.poFilterTextActive]}>
              {language === 'ar' ? 'الكل' : 'All'}
            </Text>
            <View style={[styles.poFilterBadge, poStatusFilter === 'all' && styles.poFilterBadgeActive]}>
              <Text style={[styles.poFilterBadgeText, poStatusFilter === 'all' && styles.poFilterBadgeTextActive]}>
                {poStatusCounts.all}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.poFilterTab, poStatusFilter === 'pending' && styles.poFilterTabActive]}
            onPress={() => setPOStatusFilter('pending')}
          >
            <Text style={[styles.poFilterText, poStatusFilter === 'pending' && styles.poFilterTextActive]}>
              {language === 'ar' ? 'جديد' : 'New'}
            </Text>
            {poStatusCounts.pending > 0 && (
              <View style={[styles.poFilterBadge, { backgroundColor: '#FEF3C7' }, poStatusFilter === 'pending' && styles.poFilterBadgeActive]}>
                <Text style={[styles.poFilterBadgeText, { color: '#D97706' }, poStatusFilter === 'pending' && styles.poFilterBadgeTextActive]}>
                  {poStatusCounts.pending}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.poFilterTab, poStatusFilter === 'counted' && styles.poFilterTabActive]}
            onPress={() => setPOStatusFilter('counted')}
          >
            <Text style={[styles.poFilterText, poStatusFilter === 'counted' && styles.poFilterTextActive]}>
              {language === 'ar' ? 'تم العد' : 'Counted'}
            </Text>
            {poStatusCounts.counted > 0 && (
              <View style={[styles.poFilterBadge, { backgroundColor: '#DBEAFE' }, poStatusFilter === 'counted' && styles.poFilterBadgeActive]}>
                <Text style={[styles.poFilterBadgeText, { color: '#2563EB' }, poStatusFilter === 'counted' && styles.poFilterBadgeTextActive]}>
                  {poStatusCounts.counted}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.poFilterTab, poStatusFilter === 'received' && styles.poFilterTabActive]}
            onPress={() => setPOStatusFilter('received')}
          >
            <Text style={[styles.poFilterText, poStatusFilter === 'received' && styles.poFilterTextActive]}>
              {language === 'ar' ? 'مستلم' : 'Received'}
            </Text>
            {poStatusCounts.received > 0 && (
              <View style={[styles.poFilterBadge, { backgroundColor: '#D1FAE5' }, poStatusFilter === 'received' && styles.poFilterBadgeActive]}>
                <Text style={[styles.poFilterBadgeText, { color: '#059669' }, poStatusFilter === 'received' && styles.poFilterBadgeTextActive]}>
                  {poStatusCounts.received}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.poFilterTab, poStatusFilter === 'cancelled' && styles.poFilterTabActive]}
            onPress={() => setPOStatusFilter('cancelled')}
          >
            <Text style={[styles.poFilterText, poStatusFilter === 'cancelled' && styles.poFilterTextActive]}>
              {language === 'ar' ? 'ملغي' : 'Cancelled'}
            </Text>
            {poStatusCounts.cancelled > 0 && (
              <View style={[styles.poFilterBadge, { backgroundColor: '#FEE2E2' }, poStatusFilter === 'cancelled' && styles.poFilterBadgeActive]}>
                <Text style={[styles.poFilterBadgeText, { color: '#DC2626' }, poStatusFilter === 'cancelled' && styles.poFilterBadgeTextActive]}>
                  {poStatusCounts.cancelled}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.listContainer}>
          {renderContent()}
        </View>
      </ScrollView>

      {/* Adjustment Modal */}
      <Modal
        visible={showAdjustmentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdjustmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, isRTL && styles.rtlRow]}>
              <View>
                <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'تعديل المخزون' : 'Adjust Stock'}
                </Text>
                <Text style={[styles.modalSubtitle, isRTL && styles.rtlText]} numberOfLines={1}>
                  {language === 'ar' && adjustmentStock?.item?.name_ar 
                    ? adjustmentStock.item.name_ar 
                    : adjustmentStock?.item?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAdjustmentModal(false)}>
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Current Stock */}
            <View style={styles.currentStockBox}>
              <Text style={styles.currentStockLabel}>
                {language === 'ar' ? 'المخزون الحالي' : 'Current Stock'}
              </Text>
              <Text style={styles.currentStockValue}>
                {adjustmentStock?.quantity || 0} {adjustmentStock?.item?.storage_unit || adjustmentStock?.item?.unit}
              </Text>
            </View>

            {/* Type Tabs */}
            <View style={styles.adjustmentTypeTabs}>
              <TouchableOpacity
                style={[
                  styles.adjustmentTypeTab,
                  adjustmentType === 'add' && styles.adjustmentTypeTabAdd
                ]}
                onPress={() => { setAdjustmentType('add'); setAdjustmentReason(null); }}
              >
                <Plus size={18} color={adjustmentType === 'add' ? '#fff' : colors.mutedForeground} />
                <Text style={[
                  styles.adjustmentTypeText,
                  adjustmentType === 'add' && styles.adjustmentTypeTextActive
                ]}>
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.adjustmentTypeTab,
                  adjustmentType === 'deduct' && styles.adjustmentTypeTabDeduct
                ]}
                onPress={() => setAdjustmentType('deduct')}
              >
                <Minus size={18} color={adjustmentType === 'deduct' ? '#fff' : colors.mutedForeground} />
                <Text style={[
                  styles.adjustmentTypeText,
                  adjustmentType === 'deduct' && styles.adjustmentTypeTextActive
                ]}>
                  {language === 'ar' ? 'خصم' : 'Deduct'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quantity Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                {language === 'ar' ? 'الكمية' : 'Quantity'} ({adjustmentStock?.item?.storage_unit || adjustmentStock?.item?.unit})
              </Text>
              <TextInput
                style={[styles.textInput, isRTL && styles.rtlText]}
                value={adjustmentQuantity}
                onChangeText={setAdjustmentQuantity}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Deduction Reasons */}
            {adjustmentType === 'deduct' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'السبب' : 'Reason'}
                </Text>
                <View style={styles.reasonButtons}>
                  {(['expired', 'damaged', 'spoiled', 'others'] as DeductionReason[]).map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonButton,
                        adjustmentReason === reason && styles.reasonButtonActive
                      ]}
                      onPress={() => setAdjustmentReason(reason)}
                    >
                      <Text style={styles.reasonIcon}>
                        {reason === 'expired' ? 'EXP' : reason === 'damaged' ? 'DMG' : reason === 'spoiled' ? 'SPL' : 'OTH'}
                      </Text>
                      <Text style={[
                        styles.reasonText,
                        adjustmentReason === reason && styles.reasonTextActive
                      ]}>
                        {getReasonLabel(reason)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                {adjustmentType === 'add' || adjustmentReason === 'others'
                  ? (language === 'ar' ? 'الملاحظات (مطلوب)' : 'Notes (Required)')
                  : (language === 'ar' ? 'الملاحظات (اختياري)' : 'Notes (Optional)')}
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea, isRTL && styles.rtlText]}
                value={adjustmentNotes}
                onChangeText={setAdjustmentNotes}
                placeholder={language === 'ar' ? 'أدخل ملاحظات...' : 'Enter notes...'}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: adjustmentType === 'add' ? '#10b981' : '#ef4444' },
                adjustmentLoading && styles.submitButtonDisabled
              ]}
              onPress={handleSubmitAdjustment}
              disabled={adjustmentLoading}
            >
              {adjustmentLoading ? (
                <Text style={styles.submitButtonText}>
                  {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
                </Text>
              ) : (
                <>
                  {adjustmentType === 'add' ? (
                    <Plus size={20} color="#fff" />
                  ) : (
                    <Minus size={20} color="#fff" />
                  )}
                  <Text style={styles.submitButtonText}>
                    {adjustmentType === 'add'
                      ? (language === 'ar' ? 'إضافة المخزون' : 'Add Stock')
                      : (language === 'ar' ? 'خصم المخزون' : 'Deduct Stock')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  tabScrollContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 56,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.foreground,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.background,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statItemActive: {
    backgroundColor: colors.secondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  statValueActive: {
    color: colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  itemDate: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  stockInfo: {
    alignItems: 'flex-end',
  },
  stockQuantity: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  stockUnit: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  vendorContact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  vendorContactText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  poInfo: {
    alignItems: 'flex-end',
  },
  poAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
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
  // PO Status Filter Styles
  poFiltersContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 52,
  },
  poFiltersContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    alignItems: 'center',
  },
  poFilterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    gap: 5,
  },
  poFilterTabActive: {
    backgroundColor: colors.foreground,
  },
  poFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  poFilterTextActive: {
    color: colors.background,
  },
  poFilterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    backgroundColor: colors.muted,
  },
  poFilterBadgeActive: {
    backgroundColor: colors.background,
  },
  poFilterBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  poFilterBadgeTextActive: {
    color: colors.foreground,
  },
  // Timeline styles
  timelineStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  timelineStatItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  timelineStatLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  timelineCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  timelineQtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timelineQtyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineType: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  timelineReason: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  timelineItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 2,
  },
  timelineItemNameLink: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  filterBanner: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  filterBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  filterBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1e40af',
  },
  timelineNotes: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontStyle: 'italic',
    marginTop: 2,
  },
  timelineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  timelineTime: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  timelineUser: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  // Adjustment Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  currentStockBox: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  currentStockLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  currentStockValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
  },
  adjustmentTypeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  adjustmentTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  adjustmentTypeTabAdd: {
    backgroundColor: '#10b981',
  },
  adjustmentTypeTabDeduct: {
    backgroundColor: '#ef4444',
  },
  adjustmentTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  adjustmentTypeTextActive: {
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reasonButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonButtonActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  reasonIcon: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.mutedForeground,
    backgroundColor: colors.secondary,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  reasonTextActive: {
    color: '#dc2626',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


