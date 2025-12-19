import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { useLocalization } from '../localization/LocalizationContext';
import api from '../api/client';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react-native';

interface PurchaseOrderItem {
  id: number;
  item_id: number;
  quantity: number;
  received_quantity: number;
  counted_quantity?: number | null; // Set after counting step
  unit_cost: number | null;
  total_cost: number | null;
  variance_reason?: 'missing' | 'canceled' | 'rejected' | null;
  variance_note?: string | null;
  item?: {
    id: number;
    name: string;
    name_ar?: string;
    unit: string;
    storage_unit?: string;
    sku?: string;
  };
}

interface PurchaseOrder {
  id: number;
  order_number: string;
  status: string;
  order_date: string;
  expected_date?: string | null;
  received_date?: string | null;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  notes?: string | null;
  invoice_image_url?: string | null;
  vendor?: {
    id: number;
    name: string;
    name_ar?: string | null;
  };
  items?: PurchaseOrderItem[];
}

interface POActivity {
  id: number;
  action: string;
  old_status?: string;
  new_status?: string;
  notes?: string;
  changes?: any;
  created_at: string;
  user?: {
    username: string;
    first_name?: string;
  };
}

export default function PODetailScreen({ navigation, route }: any) {
  const { t, isRTL, language, formatCurrency } = useLocalization();
  const { orderId } = route.params;
  
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [activity, setActivity] = useState<POActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  useEffect(() => {
    loadPODetails();
  }, [orderId]);

  const loadPODetails = async () => {
    try {
      setLoading(true);
      const [orderRes, activityRes] = await Promise.all([
        api.get(`/inventory-stock/purchase-orders/${orderId}`),
        api.get(`/inventory-stock/purchase-orders/${orderId}/activity`),
      ]);
      
      setOrder(orderRes.data.data);
      setActivity(activityRes.data.data || []);
      
    } catch (error) {
      console.error('Failed to load PO details:', error);
      Alert.alert(
        t('Error', 'خطأ'),
        t('Failed to load purchase order details', 'فشل في تحميل تفاصيل أمر الشراء')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPODetails();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', color: '#D97706' };
      case 'counted':
        return { bg: '#DBEAFE', color: '#2563EB' };
      case 'received':
      case 'delivered':
        return { bg: '#D1FAE5', color: '#059669' };
      case 'cancelled':
        return { bg: '#FEE2E2', color: '#DC2626' };
      default:
        return { bg: '#F3F4F6', color: '#6B7280' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('Pending', 'معلق');
      case 'counted':
        return t('Counted', 'تم العد');
      case 'received':
        return t('Received', 'مستلم');
      case 'cancelled':
        return t('Cancelled', 'ملغي');
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCancelOrder = () => {
    Alert.alert(
      t('Cancel Order', 'إلغاء الطلب'),
      t('Are you sure you want to cancel this order? This cannot be undone.', 'هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا.'),
      [
        { text: t('No', 'لا'), style: 'cancel' },
        {
          text: t('Yes, Cancel', 'نعم، إلغاء'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.put(`/inventory-stock/purchase-orders/${orderId}/status`, {
                status: 'cancelled',
              });
              navigation.goBack();
            } catch (error) {
              Alert.alert(t('Error', 'خطأ'), t('Failed to cancel order', 'فشل في إلغاء الطلب'));
            }
          },
        },
      ]
    );
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return t('Order Created', 'تم إنشاء الطلب');
      case 'counted': return t('Items Counted', 'تم عد الأصناف');
      case 'received': return t('Order Received', 'تم استلام الطلب');
      case 'cancelled': return t('Order Cancelled', 'تم إلغاء الطلب');
      default: return action;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <FileText size={16} color={colors.foreground} />;
      case 'counted':
        return <Package size={16} color="#2563EB" />;
      case 'received':
        return <CheckCircle2 size={16} color="#059669" />;
      case 'cancelled':
        return <XCircle size={16} color="#DC2626" />;
      default:
        return <Clock size={16} color={colors.mutedForeground} />;
    }
  };

  // Filter timeline to only show key events
  const keyTimelineActions = ['created', 'counted', 'received', 'cancelled'];
  const filteredActivity = activity.filter(item => keyTimelineActions.includes(item.action));

  const statusColors = order ? getStatusColor(order.status) : { bg: '#F3F4F6', color: '#6B7280' };
  const canCount = order?.status === 'pending'; // Can start counting
  const canReceive = order?.status === 'counted'; // Can receive after counting
  const canCancel = order && !['received', 'delivered', 'cancelled'].includes(order.status);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            {isRTL ? <ArrowRight size={24} color={colors.foreground} /> : <ArrowLeft size={24} color={colors.foreground} />}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Purchase Order', 'أمر الشراء')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.foreground} />
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            {isRTL ? <ArrowRight size={24} color={colors.foreground} /> : <ArrowLeft size={24} color={colors.foreground} />}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Purchase Order', 'أمر الشراء')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <FileText size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>{t('Order not found', 'لم يتم العثور على الطلب')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.rtlRow]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          {isRTL ? <ArrowRight size={24} color={colors.foreground} /> : <ArrowLeft size={24} color={colors.foreground} />}
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{order.order_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.color }]}>
              {getStatusLabel(order.status)}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, isRTL && styles.rtlRow]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
            {t('Details', 'التفاصيل')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' && styles.activeTab]}
          onPress={() => setActiveTab('activity')}
        >
          <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>
            {t('Timeline', 'الجدول الزمني')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {activeTab === 'details' ? (
          <>
            {/* Order Info */}
            <View style={styles.card}>
              <View style={[styles.infoRow, isRTL && styles.rtlRow]}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, isRTL && styles.rtlText]}>{t('Vendor', 'المورد')}</Text>
                  <Text style={[styles.infoValue, isRTL && styles.rtlText]}>
                    {isRTL ? (order.vendor?.name_ar || order.vendor?.name) : order.vendor?.name}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, isRTL && styles.rtlText]}>{t('Order Date', 'تاريخ الطلب')}</Text>
                  <Text style={[styles.infoValue, isRTL && styles.rtlText]}>{formatDate(order.order_date)}</Text>
                </View>
              </View>
              <View style={[styles.infoRow, isRTL && styles.rtlRow]}>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, isRTL && styles.rtlText]}>{t('Expected', 'المتوقع')}</Text>
                  <Text style={[styles.infoValue, isRTL && styles.rtlText]}>
                    {order.expected_date ? formatDate(order.expected_date) : '-'}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={[styles.infoLabel, isRTL && styles.rtlText]}>{t('Total', 'الإجمالي')}</Text>
                  <Text style={[styles.infoValue, styles.totalAmount, isRTL && styles.rtlText]}>
                    {formatCurrency(order.total_amount || 0)}
                  </Text>
                </View>
              </View>
              {order.notes && (
                <View style={styles.notesSection}>
                  <Text style={[styles.infoLabel, isRTL && styles.rtlText]}>{t('Notes', 'ملاحظات')}</Text>
                  <Text style={[styles.notesText, isRTL && styles.rtlText]}>{order.notes}</Text>
                </View>
              )}
            </View>

            {/* Items */}
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {t('Items', 'الأصناف')} ({order.items?.length || 0})
            </Text>

            {/* View Mode - Items List */}
            {order.items?.map((item) => {
                // For counted orders, show counted_quantity; for received, show received_quantity
                const displayQty = order.status === 'counted' 
                  ? (item.counted_quantity ?? 0) 
                  : item.received_quantity;
                
                return (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={[styles.itemCardContent, isRTL && styles.rtlRow]}>
                      <View style={styles.itemIcon}>
                        <Package size={20} color={colors.foreground} />
                      </View>
                      <View style={[styles.itemDetails, isRTL && { alignItems: 'flex-end' }]}>
                        <Text style={[styles.itemName, isRTL && styles.rtlText]}>
                          {isRTL ? (item.item?.name_ar || item.item?.name) : item.item?.name}
                        </Text>
                        <Text style={[styles.itemMeta, isRTL && styles.rtlText]}>
                          {item.item?.sku || ''} • {item.item?.storage_unit || item.item?.unit}
                        </Text>
                        {item.variance_reason && (
                          <Text style={[styles.varianceText, isRTL && styles.rtlText]}>
                            {t('Variance', 'الفرق')}: {item.variance_reason}
                          </Text>
                        )}
                        {item.variance_note && (
                          <Text style={[styles.varianceNote, isRTL && styles.rtlText]}>
                            {item.variance_note}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.itemQuantities, isRTL && { alignItems: 'flex-start' }]}>
                        <Text style={styles.itemQty}>
                          {displayQty}/{item.quantity}
                        </Text>
                        {item.total_cost != null && item.total_cost > 0 && (
                          <Text style={styles.itemCost}>{formatCurrency(item.total_cost)}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
          </>
        ) : (
          // Activity/Timeline Tab - Only show key events
          <View style={styles.timeline}>
            {filteredActivity.length === 0 ? (
              <View style={styles.emptyState}>
                <Clock size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>{t('No activity yet', 'لا يوجد نشاط بعد')}</Text>
              </View>
            ) : (
              filteredActivity.map((item, index) => {
                // Extract variance info from counting event
                const countingVariances = item.action === 'counted' && item.changes?.items_counted
                  ? (item.changes.items_counted as any[]).filter(
                      (i: any) => i.variance_reason || i.variance_note
                    )
                  : [];
                
                return (
                  <View key={item.id} style={[styles.timelineItem, isRTL && styles.rtlRow]}>
                    <View style={[
                      styles.timelineDot,
                      item.action === 'counted' && { backgroundColor: '#DBEAFE' },
                      item.action === 'received' && { backgroundColor: '#D1FAE5' },
                      item.action === 'cancelled' && { backgroundColor: '#FEE2E2' },
                    ]}>
                      {getActionIcon(item.action)}
                    </View>
                    <View style={[styles.timelineContent, isRTL && { alignItems: 'flex-end' }]}>
                      <Text style={[styles.timelineAction, isRTL && styles.rtlText]}>
                        {getActionLabel(item.action)}
                      </Text>
                      
                      {/* Show variance notes for counting events */}
                      {countingVariances.length > 0 && (
                        <View style={styles.varianceSection}>
                          {countingVariances.map((v: any, idx: number) => (
                            <Text key={idx} style={[styles.varianceInfo, isRTL && styles.rtlText]}>
                              {v.variance_reason && `⚠️ ${v.variance_reason}`}
                              {v.variance_note && ` - ${v.variance_note}`}
                            </Text>
                          ))}
                        </View>
                      )}
                      
                      {item.notes && (
                        <Text style={[styles.timelineNotes, isRTL && styles.rtlText]}>{item.notes}</Text>
                      )}
                      <Text style={[styles.timelineDate, isRTL && styles.rtlText]}>
                        {item.user?.first_name || item.user?.username || ''} • {formatDateTime(item.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      {(canCount || canReceive) && (
        <View style={[styles.bottomActions, isRTL && styles.rtlRow]}>
          {canCancel && (
            <TouchableOpacity style={styles.cancelOrderButton} onPress={handleCancelOrder}>
              <Text style={styles.cancelOrderButtonText}>{t('Cancel Order', 'إلغاء الطلب')}</Text>
            </TouchableOpacity>
          )}
          
          {canCount && (
            <TouchableOpacity 
              style={styles.receiveButton} 
              onPress={() => navigation.navigate('POCounting', { orderId: order.id })}
            >
              <Package size={20} color="#fff" />
              <Text style={styles.receiveButtonText}>{t('Count Order', 'عد الطلب')}</Text>
            </TouchableOpacity>
          )}
          
          {canReceive && (
            <TouchableOpacity 
              style={styles.receiveButton} 
              onPress={() => navigation.navigate('POReceiving', { orderId: order.id })}
            >
              <Package size={20} color="#fff" />
              <Text style={styles.receiveButtonText}>{t('Receive Order', 'استلام الطلب')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.foreground,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  activeTabText: {
    color: colors.foreground,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  notesSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesText: {
    fontSize: 14,
    color: colors.foreground,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  varianceText: {
    fontSize: 11,
    color: '#D97706',
    marginTop: 4,
  },
  varianceNote: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  itemQuantities: {
    alignItems: 'flex-end',
  },
  itemQty: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  itemCost: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  // Receive mode styles
  uploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 12,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.muted,
    borderRadius: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  imagePreview: {
    position: 'relative',
    alignItems: 'center',
  },
  invoiceImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  receiveItemCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  varianceCard: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  receiveItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  receiveItemInfo: {
    flex: 1,
  },
  receiveItemBody: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputRow: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  varianceLabel: {
    color: '#D97706',
  },
  overLabel: {
    color: '#3B82F6',
  },
  input: {
    backgroundColor: colors.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  varianceInput: {
    backgroundColor: '#FEF3C7',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  reasonButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  reasonButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.muted,
    borderRadius: 6,
    alignItems: 'center',
  },
  reasonButtonActive: {
    backgroundColor: '#D97706',
  },
  reasonButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
  },
  reasonButtonTextActive: {
    color: '#fff',
  },
  previewCost: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  // Timeline styles
  timeline: {
    paddingLeft: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineAction: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  timelineStatus: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  timelineNotes: {
    fontSize: 12,
    color: colors.foreground,
    marginTop: 4,
    backgroundColor: colors.muted,
    padding: 8,
    borderRadius: 6,
  },
  timelineDate: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  varianceSection: {
    marginTop: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#FCD34D',
  },
  varianceInfo: {
    fontSize: 12,
    color: '#92400E',
    marginBottom: 2,
  },
  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  receiveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.foreground,
    paddingVertical: 14,
    borderRadius: 10,
  },
  receiveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  cancelOrderButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.muted,
  },
  cancelOrderButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: colors.muted,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

