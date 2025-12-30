import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
  Modal,
  Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { 
  Command,
  LogOut,
  CheckCircle,
  Clock,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  RefreshCw,
  XCircle,
  AlertCircle,
  Edit3,
  Trash2,
  RotateCcw,
  Package
} from 'lucide-react-native';
import api from '../api/client';

const { width } = Dimensions.get('window');
const isLargeScreen = width > 768;

// Tab types - includes 'edited' for items removed during order editing
type TabType = 'all' | 'pending' | 'cancelled' | 'edited' | 'completed';

interface OrderItem {
  id: number;
  product_name: string;
  product_name_ar?: string;
  variant_name?: string;
  quantity: number;
  original_quantity?: number;
  special_instructions?: string;
  modifiers?: Array<{
    modifier_name: string;
    modifier_name_ar?: string;
    quantity: number;
  }>;
}

interface Order {
  id: number;
  order_number: string;
  display_number?: string;
  order_type: string;
  order_status: string;
  order_source: string;
  table_number?: string;
  customer_name?: string;
  is_edited?: boolean;
  remaining_amount?: number;
  created_at: string;
  items?: OrderItem[];
}

interface CancelledItem {
  id: number;
  order_id: number;
  item_id: number;
  product_name?: string;
  quantity: number;
  unit?: string;
  decision?: 'waste' | 'return' | null;
  cancellation_source?: 'order_cancelled' | 'order_edited';
  created_at?: string;
  orders?: {
    order_number: string;
    created_at: string;
  };
  items?: {
    name: string;
    name_ar?: string;
  };
}

// Helper function to calculate time remaining until auto-expire (24 hours)
const getTimeRemaining = (createdAt: string): { hours: number; minutes: number; isUrgent: boolean; isExpired: boolean } => {
  const created = new Date(createdAt);
  const expiresAt = new Date(created.getTime() + 24 * 60 * 60 * 1000); // 24 hours from creation
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, isUrgent: true, isExpired: true };
  }
  
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  const isUrgent = hours < 6; // Less than 6 hours remaining
  
  return { hours, minutes, isUrgent, isExpired: false };
};

// Skeleton component for kitchen display
const KitchenSkeleton = ({ colors }: { colors: any }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBox = ({ width: w, height, borderRadius = 8 }: { width: number | string; height: number; borderRadius?: number }) => (
    <Animated.View style={{ width: w, height, borderRadius, backgroundColor: colors.border, opacity }} />
  );

  const OrderCardSkeleton = () => (
    <View style={{
      width: isLargeScreen ? (width - 48) / 3 - 8 : width - 24,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      overflow: 'hidden',
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: colors.muted }}>
        <View>
          <SkeletonBox width={80} height={24} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <SkeletonBox width={70} height={20} />
            <SkeletonBox width={40} height={20} />
          </View>
        </View>
        <SkeletonBox width={60} height={28} borderRadius={6} />
      </View>
      <View style={{ padding: 12 }}>
        {[1, 2, 3].map((_, i) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: 10, gap: 10 }}>
            <SkeletonBox width={26} height={26} borderRadius={6} />
            <View style={{ flex: 1 }}>
              <SkeletonBox width="70%" height={14} />
              <SkeletonBox width="40%" height={10} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ padding: 10, backgroundColor: colors.muted }}>
        <SkeletonBox width="100%" height={44} borderRadius={8} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[1, 2, 3].map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </View>
    </View>
  );
};

export default function KitchenDisplayScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [cancelledItems, setCancelledItems] = useState<CancelledItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [processingWaste, setProcessingWaste] = useState(false);
  const [wasteDecisions, setWasteDecisions] = useState<Record<number, 'waste' | 'return'>>({});
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [selectedOrderForWaste, setSelectedOrderForWaste] = useState<Order | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
  };

  // Check authentication status
  const checkAuth = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.log('[Kitchen] No token found, redirecting to login');
      setAuthError('Please log in to access the Kitchen Display');
      return false;
    }
    return true;
  }, []);

  // Load all orders and cancelled items
  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      
      // Check auth first
      const isAuth = await checkAuth();
      if (!isAuth) {
        setIsLoading(false);
        return;
      }
      
      // Use local date, not UTC, to match order_date stored in local timezone
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Load orders
      console.log('[Kitchen] Fetching orders for date:', today);
      const ordersResponse = await api.get(`/pos/kitchen/orders?date=${today}`);
      console.log('[Kitchen] Orders response:', ordersResponse.data);
      if (ordersResponse.data.success) {
        setAllOrders(ordersResponse.data.data || []);
        setAuthError(null); // Clear any previous auth error
      } else {
        // Check for auth error
        if (ordersResponse.data.error?.includes('token') || ordersResponse.data.error?.includes('Unauthorized')) {
          setAuthError('Session expired. Please log in again.');
        } else {
          console.error('[Kitchen] Orders fetch failed:', ordersResponse.data);
        }
      }

      // Load cancelled items awaiting decision
      const cancelledResponse = await api.get('/pos/kitchen/cancelled-items');
      if (cancelledResponse.data.success) {
        setCancelledItems(cancelledResponse.data.data || []);
      }
    } catch (err: any) {
      console.error('[Kitchen] Failed to load data:', err?.response?.data || err?.message || err);
      // Handle 401 Unauthorized
      if (err?.response?.status === 401 || err?.response?.data?.error?.includes('token')) {
        setAuthError('Session expired. Please log in again.');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [checkAuth]);

  useEffect(() => {
    loadData(true);
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      loadData(false);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // Filter orders based on active tab
  const getFilteredOrders = (): Order[] => {
    switch (activeTab) {
      case 'all':
        return allOrders;
      case 'pending':
        return allOrders.filter(o => o.order_status === 'pending' || o.order_status === 'in_progress');
      case 'cancelled':
        // Show cancelled orders (those with cancelled_order_items where source is 'order_cancelled')
        return allOrders.filter(o => o.order_status === 'cancelled');
      case 'edited':
        // Show orders that have edited items pending decision
        // These are active orders that had items removed during editing
        const editedOrderIds = new Set(
          cancelledItems
            .filter(item => item.cancellation_source === 'order_edited' && !item.decision)
            .map(item => item.order_id)
        );
        return allOrders.filter(o => editedOrderIds.has(o.id));
      case 'completed':
        return allOrders.filter(o => o.order_status === 'completed');
      default:
        return allOrders;
    }
  };

  // Get cancelled items filtered by source
  const getCancelledItemsFiltered = (): CancelledItem[] => {
    if (activeTab === 'cancelled') {
      return cancelledItems.filter(item => 
        item.cancellation_source === 'order_cancelled' && !item.decision
      );
    }
    if (activeTab === 'edited') {
      return cancelledItems.filter(item => 
        item.cancellation_source === 'order_edited' && !item.decision
      );
    }
    return cancelledItems.filter(item => !item.decision);
  };

  // Get tab counts
  const getTabCounts = () => {
    const cancelledOrderIds = new Set(
      cancelledItems
        .filter(item => item.cancellation_source === 'order_cancelled' && !item.decision)
        .map(item => item.order_id)
    );
    const editedOrderIds = new Set(
      cancelledItems
        .filter(item => item.cancellation_source === 'order_edited' && !item.decision)
        .map(item => item.order_id)
    );
    
    return {
      all: allOrders.length,
      pending: allOrders.filter(o => o.order_status === 'pending' || o.order_status === 'in_progress').length,
      cancelled: cancelledOrderIds.size, // Count unique orders with cancelled items
      edited: editedOrderIds.size, // Count unique orders with edited items
      completed: allOrders.filter(o => o.order_status === 'completed').length,
    };
  };

  const markAsCompleted = async (orderId: number) => {
    try {
      setUpdatingOrderId(orderId);
      await api.post(`/pos/orders/${orderId}/complete`);
      loadData(false);
    } catch (err: any) {
      console.error('Failed to complete order:', err);
      if (Platform.OS === 'web') {
        window.alert('Failed to complete order');
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Get pending items for a cancelled/edited order
  // Filters by cancellation_source based on active tab
  const getPendingItemsForOrder = (orderId: number): CancelledItem[] => {
    return cancelledItems.filter(item => {
      if (item.order_id !== orderId || item.decision) return false;
      
      // Filter by source based on active tab
      if (activeTab === 'cancelled') {
        return item.cancellation_source === 'order_cancelled';
      }
      if (activeTab === 'edited') {
        return item.cancellation_source === 'order_edited';
      }
      // For 'all' tab or any other, show all pending items for this order
      return true;
    });
  };

  // Process waste decisions for an order
  const processWasteDecisions = async () => {
    if (Object.keys(wasteDecisions).length === 0) return;

    try {
      setProcessingWaste(true);
      
      const decisions = Object.entries(wasteDecisions).map(([id, decision]) => ({
        cancelled_item_id: parseInt(id),
        decision,
      }));

      await api.post('/pos/kitchen/process-waste', { decisions });
      
      setWasteDecisions({});
      setShowWasteModal(false);
      setSelectedOrderForWaste(null);
      loadData(false);
    } catch (err: any) {
      console.error('Failed to process waste decisions:', err);
      if (Platform.OS === 'web') {
        window.alert('Failed to process decisions');
      }
    } finally {
      setProcessingWaste(false);
    }
  };

  const getOrderTypeIcon = (type: string) => {
    const iconProps = { size: 14, color: colors.mutedForeground };
    switch (type) {
      case 'dine_in':
        return <UtensilsCrossed {...iconProps} />;
      case 'takeaway':
      case 'drive_thru':
        return <ShoppingBag {...iconProps} />;
      case 'delivery':
        return <Truck {...iconProps} />;
      default:
        return <UtensilsCrossed {...iconProps} />;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      dine_in: 'Dine In',
      takeaway: 'Takeaway',
      delivery: 'Delivery',
      drive_thru: 'Drive Thru',
    };
    return types[type] || type;
  };

  const getOrderAge = (createdAt: string) => {
    const now = new Date();
    const orderTime = new Date(createdAt);
    const diffMs = now.getTime() - orderTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h${mins}m`;
  };

  // Get status display - monochrome theme
  const getStatusInfo = (order: Order) => {
    const status = order.order_status;
    if (status === 'completed') {
      return { label: 'Completed', accent: colors.foreground, bgOpacity: '10' };
    }
    if (status === 'cancelled') {
      return { label: 'Cancelled', accent: colors.mutedForeground, bgOpacity: '05' };
    }
    // pending or in_progress
    return { label: 'Pending', accent: colors.foreground, bgOpacity: '00' };
  };

  const tabCounts = getTabCounts();
  const filteredOrders = getFilteredOrders();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 50 : 20,
      paddingBottom: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconButton: {
      width: 40,
      height: 40,
      backgroundColor: colors.secondary,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 10,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    tabActive: {
      backgroundColor: colors.foreground,
      borderColor: colors.foreground,
    },
    tabInactive: {
      backgroundColor: colors.secondary,
      borderColor: colors.border,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
    },
    tabTextActive: {
      color: colors.background,
    },
    tabTextInactive: {
      color: colors.mutedForeground,
    },
    tabBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    tabBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    ordersGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    orderCard: {
      width: isLargeScreen ? (width - 64) / 3 - 8 : width - 32,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    orderCardPending: {
      borderColor: colors.foreground,
    },
    orderCardCompleted: {
      borderColor: colors.border,
      opacity: 0.7,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      backgroundColor: colors.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    orderNumber: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    orderMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    orderType: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    orderTypeText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: '600',
    },
    tableBadge: {
      backgroundColor: colors.foreground,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    tableText: {
      fontSize: 11,
      color: colors.background,
      fontWeight: '700',
    },
    editedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editedText: {
      fontSize: 11,
      color: colors.foreground,
      fontWeight: '600',
    },
    orderTime: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    orderTimeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    statusBadgePending: {
      backgroundColor: colors.foreground,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
    },
    statusTextPending: {
      color: colors.background,
    },
    orderItems: {
      padding: 14,
      maxHeight: 220,
    },
    orderItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    itemQuantity: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.foreground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    itemQuantityText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.background,
    },
    itemDetails: {
      flex: 1,
    },
    itemName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    itemVariant: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    itemModifiers: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 6,
    },
    modifierBadge: {
      backgroundColor: colors.secondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modifierText: {
      fontSize: 10,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    itemNotes: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      color: colors.foreground,
      fontWeight: '500',
      marginTop: 6,
      backgroundColor: colors.secondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    itemNotesText: {
      fontSize: 12,
      color: colors.foreground,
      fontWeight: '500',
    },
    orderFooter: {
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.secondary,
    },
    completeButton: {
      backgroundColor: colors.foreground,
      borderRadius: 10,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    completeButtonDisabled: {
      opacity: 0.4,
    },
    completeButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.background,
    },
    wasteButton: {
      backgroundColor: colors.secondary,
      borderRadius: 10,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 2,
      borderColor: colors.border,
    },
    wasteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 100,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    pendingBadge: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.foreground,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.background,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '90%',
      maxWidth: 500,
      maxHeight: '80%',
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.foreground,
    },
    modalBody: {
      padding: 16,
    },
    wasteItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    wasteItemInfo: {
      flex: 1,
    },
    wasteItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    wasteItemQty: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    wasteToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    wasteToggleLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.foreground,
    },
    modalFooter: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    modalCancelButton: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalConfirmButton: {
      backgroundColor: colors.foreground,
    },
    modalButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });

  // Render order card
  const renderOrderCard = (order: Order) => {
    const statusInfo = getStatusInfo(order);
    const pendingItems = getPendingItemsForOrder(order.id);
    const hasPendingDecisions = pendingItems.length > 0;
    const isPending = order.order_status === 'pending' || order.order_status === 'in_progress';
    const isCompleted = order.order_status === 'completed';

    return (
      <View 
        key={order.id} 
        style={[
          styles.orderCard, 
          isPending && styles.orderCardPending,
          isCompleted && styles.orderCardCompleted,
        ]}
      >
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>
              #{order.order_number}
            </Text>
            <View style={styles.orderMeta}>
              <View style={styles.orderType}>
                {getOrderTypeIcon(order.order_type)}
                <Text style={styles.orderTypeText}>
                  {getOrderTypeLabel(order.order_type)}
                </Text>
              </View>
              {order.table_number && (
                <View style={styles.tableBadge}>
                  <Text style={styles.tableText}>{order.table_number}</Text>
                </View>
              )}
              {order.is_edited && (
                <View style={styles.editedBadge}>
                  <Edit3 size={10} color={colors.foreground} />
                  <Text style={styles.editedText}>Edited</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={styles.orderTime}>
              <Clock size={14} color={colors.mutedForeground} />
              <Text style={styles.orderTimeText}>
                {getOrderAge(order.created_at)}
              </Text>
            </View>
            {activeTab === 'all' && (
              <View style={[styles.statusBadge, isPending && styles.statusBadgePending]}>
                {isCompleted && <CheckCircle size={12} color={colors.mutedForeground} />}
                {order.order_status === 'cancelled' && <XCircle size={12} color={colors.mutedForeground} />}
                {isPending && <Clock size={12} color={colors.background} />}
                <Text style={[styles.statusText, isPending && styles.statusTextPending]}>
                  {statusInfo.label}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Order Items */}
        <ScrollView style={styles.orderItems} nestedScrollEnabled>
          {order.items?.map((item, idx) => (
            <View key={item.id || idx} style={styles.orderItem}>
              <View style={styles.itemQuantity}>
                <Text style={styles.itemQuantityText}>{item.quantity}</Text>
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                {item.variant_name && (
                  <Text style={styles.itemVariant}>{item.variant_name}</Text>
                )}
                {item.modifiers && item.modifiers.length > 0 && (
                  <View style={styles.itemModifiers}>
                    {item.modifiers.map((mod, midx) => (
                      <View key={midx} style={styles.modifierBadge}>
                        <Text style={styles.modifierText}>
                          {mod.modifier_name}
                          {mod.quantity > 1 && ` x${mod.quantity}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {item.special_instructions && (
                  <View style={styles.itemNotes}>
                    <AlertCircle size={12} color={colors.foreground} />
                    <Text style={styles.itemNotesText}>{item.special_instructions}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Footer Actions - Show complete button for pending orders, unless in edited tab with pending decisions */}
        {isPending && !(activeTab === 'edited' && hasPendingDecisions) && (
          <View style={styles.orderFooter}>
            <TouchableOpacity
              style={[
                styles.completeButton,
                updatingOrderId === order.id && styles.completeButtonDisabled
              ]}
              onPress={() => markAsCompleted(order.id)}
              disabled={updatingOrderId === order.id}
            >
              {updatingOrderId === order.id ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <CheckCircle size={18} color={colors.background} />
                  <Text style={styles.completeButtonText}>Mark Complete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Show waste/return decision UI for cancelled orders OR edited orders with pending decisions */}
        {(order.order_status === 'cancelled' || activeTab === 'edited') && hasPendingDecisions && (() => {
          // Get the oldest pending item to show time remaining
          const oldestItem = pendingItems.reduce((oldest, item) => {
            if (!oldest || (item.created_at && (!oldest.created_at || item.created_at < oldest.created_at))) {
              return item;
            }
            return oldest;
          }, pendingItems[0]);
          
          const timeInfo = oldestItem?.created_at ? getTimeRemaining(oldestItem.created_at) : null;
          const isEditedTab = activeTab === 'edited';
          
          return (
            <View style={[styles.orderFooter, { position: 'relative', flexDirection: 'column', gap: 8 }]}>
              {/* Time remaining warning */}
              {timeInfo && (
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: timeInfo.isUrgent ? '#ef444420' : colors.muted,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  marginBottom: 4,
                }}>
                  <Clock size={14} color={timeInfo.isUrgent ? '#ef4444' : colors.mutedForeground} />
                  <Text style={{ 
                    fontSize: 12, 
                    marginLeft: 6,
                    color: timeInfo.isUrgent ? '#ef4444' : colors.mutedForeground,
                    fontWeight: timeInfo.isUrgent ? '600' : '400',
                  }}>
                    {timeInfo.isExpired 
                      ? '⚠️ Expired - will auto-waste soon' 
                      : `Auto-waste in ${timeInfo.hours}h ${timeInfo.minutes}m`}
                  </Text>
                </View>
              )}
              
              {/* Process button */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingItems.length}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.wasteButton, { flex: 1 }]}
                  onPress={() => {
                    setSelectedOrderForWaste(order);
                    // Initialize decisions for this order's items
                    const initialDecisions: Record<number, 'waste' | 'return'> = {};
                    pendingItems.forEach(item => {
                      initialDecisions[item.id] = 'return'; // Default to return
                    });
                    setWasteDecisions(initialDecisions);
                    setShowWasteModal(true);
                  }}
                >
                  <AlertCircle size={18} color={colors.foreground} />
                  <Text style={styles.wasteButtonText}>
                    {isEditedTab ? 'Process Removed Items' : 'Process Waste/Return'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </View>
    );
  };

  // Get empty state message based on tab
  const getEmptyStateContent = () => {
    switch (activeTab) {
      case 'all':
        return { title: 'No orders today', subtitle: 'Orders will appear here when created', icon: <Package size={36} color={colors.mutedForeground} /> };
      case 'pending':
        return { title: 'All caught up!', subtitle: 'No orders in progress right now', icon: <CheckCircle size={36} color={colors.foreground} /> };
      case 'cancelled':
        return { title: 'No cancelled orders', subtitle: 'Cancelled orders will appear here', icon: <XCircle size={36} color={colors.mutedForeground} /> };
      case 'edited':
        return { title: 'No edited orders', subtitle: 'Items removed from orders will appear here', icon: <Edit3 size={36} color={colors.mutedForeground} /> };
      case 'completed':
        return { title: 'No completed orders', subtitle: 'Completed orders will appear here', icon: <CheckCircle size={36} color={colors.mutedForeground} /> };
      default:
        return { title: 'No orders', subtitle: '', icon: null };
    }
  };

  const emptyContent = getEmptyStateContent();

  // Show authentication error screen
  if (authError) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.destructive + '20', marginBottom: 16 }]}>
          <AlertCircle size={48} color={colors.destructive} />
        </View>
        <Text style={[styles.headerTitle, { textAlign: 'center', marginBottom: 8 }]}>
          Authentication Required
        </Text>
        <Text style={[styles.headerSubtitle, { textAlign: 'center', maxWidth: 300, marginBottom: 24 }]}>
          {authError}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 10,
          }}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
            Go to Login
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Command size={28} color={colors.foreground} />
          <View>
            <Text style={styles.headerTitle}>Kitchen Display</Text>
            <Text style={styles.headerSubtitle}>Real-time Order Management</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={onRefresh}>
            <RefreshCw size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
            <LogOut size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {[
          { key: 'all' as TabType, label: 'All Orders', count: tabCounts.all },
          { key: 'pending' as TabType, label: 'Pending', count: tabCounts.pending },
          { key: 'cancelled' as TabType, label: 'Cancelled', count: tabCounts.cancelled },
          { key: 'edited' as TabType, label: 'Edited', count: tabCounts.edited },
          { key: 'completed' as TabType, label: 'Completed', count: tabCounts.completed },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isActive ? styles.tabActive : styles.tabInactive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[
                styles.tabText,
                isActive ? styles.tabTextActive : styles.tabTextInactive,
              ]}>
                {tab.label}
              </Text>
              <View style={[
                styles.tabBadge,
                { backgroundColor: isActive ? colors.background + '40' : colors.secondary }
              ]}>
                <Text style={[
                  styles.tabBadgeText,
                  { color: isActive ? colors.background : colors.foreground }
                ]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <KitchenSkeleton colors={colors} />
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            {emptyContent.icon}
          </View>
          <Text style={styles.emptyTitle}>{emptyContent.title}</Text>
          <Text style={styles.emptySubtitle}>{emptyContent.subtitle}</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.ordersGrid}>
            {filteredOrders.map(renderOrderCard)}
          </View>
        </ScrollView>
      )}

      {/* Waste/Return Modal */}
      <Modal
        visible={showWasteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWasteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Process Items - Order #{selectedOrderForWaste?.order_number}
              </Text>
              <TouchableOpacity onPress={() => setShowWasteModal(false)}>
                <XCircle size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={{ color: colors.mutedForeground, marginBottom: 16 }}>
                Decide for each ingredient: Was it used (waste) or can it go back to inventory (return)?
              </Text>

              {selectedOrderForWaste && getPendingItemsForOrder(selectedOrderForWaste.id).map((item) => {
                const timeInfo = item.created_at ? getTimeRemaining(item.created_at) : null;
                
                return (
                  <View key={item.id} style={styles.wasteItemRow}>
                    <View style={styles.wasteItemInfo}>
                      <Text style={styles.wasteItemName}>
                        {item.items?.name || item.product_name || `Item ${item.item_id}`}
                      </Text>
                      <Text style={styles.wasteItemQty}>
                        {item.quantity} {item.unit || 'units'} • {item.product_name && `From: ${item.product_name}`}
                      </Text>
                      {timeInfo && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Clock size={12} color={timeInfo.isUrgent ? '#ef4444' : colors.mutedForeground} />
                          <Text style={{ 
                            fontSize: 11, 
                            marginLeft: 4,
                            color: timeInfo.isUrgent ? '#ef4444' : colors.mutedForeground,
                            fontWeight: timeInfo.isUrgent ? '600' : '400',
                          }}>
                            {timeInfo.isExpired 
                              ? 'Expired - will auto-waste' 
                              : `Auto-waste in ${timeInfo.hours}h ${timeInfo.minutes}m`}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.wasteToggleContainer}>
                      <View style={{ alignItems: 'center' }}>
                        <RotateCcw size={16} color={wasteDecisions[item.id] === 'return' ? '#22c55e' : colors.mutedForeground} />
                        <Text style={[styles.wasteToggleLabel, { color: wasteDecisions[item.id] === 'return' ? '#22c55e' : colors.mutedForeground }]}>
                          Return
                        </Text>
                      </View>
                      <Switch
                        value={wasteDecisions[item.id] === 'waste'}
                        onValueChange={(val) => {
                          setWasteDecisions(prev => ({
                            ...prev,
                            [item.id]: val ? 'waste' : 'return',
                          }));
                        }}
                        trackColor={{ false: '#22c55e', true: '#ef4444' }}
                        thumbColor="#ffffff"
                      />
                      <View style={{ alignItems: 'center' }}>
                        <Trash2 size={16} color={wasteDecisions[item.id] === 'waste' ? '#ef4444' : colors.mutedForeground} />
                        <Text style={[styles.wasteToggleLabel, { color: wasteDecisions[item.id] === 'waste' ? '#ef4444' : colors.mutedForeground }]}>
                          Waste
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowWasteModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={processWasteDecisions}
                disabled={processingWaste}
              >
                {processingWaste ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: colors.background }]}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
