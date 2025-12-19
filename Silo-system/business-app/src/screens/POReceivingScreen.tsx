import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useLocalization } from '../localization/LocalizationContext';
import api from '../api/client';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Camera,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';

interface PurchaseOrderItem {
  id: number;
  item_id: number;
  quantity: number;
  received_quantity: number;
  counted_quantity?: number | null;
  barcode_scanned?: boolean;
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
  items?: PurchaseOrderItem[];
  vendor?: {
    id: number;
    name: string;
    name_ar?: string | null;
  };
}

interface ReceiveItemState {
  item_id: number;
  total_cost: number;
}

export default function POReceivingScreen({ navigation, route }: any) {
  const { t, isRTL, language, formatCurrency, currency } = useLocalization();
  const { orderId } = route.params;
  
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiveItems, setReceiveItems] = useState<ReceiveItemState[]>([]);
  const [invoiceImageUrl, setInvoiceImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadPODetails();
  }, [orderId]);

  const loadPODetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/inventory-stock/purchase-orders/${orderId}`);
      const po = response.data.data;
      setOrder(po);
      
      // Initialize receive items with total costs
      if (po.items) {
        setReceiveItems(po.items.map((item: PurchaseOrderItem) => ({
          item_id: item.item_id,
          total_cost: 0,
        })));
      }
    } catch (error) {
      console.error('Failed to load PO:', error);
      Alert.alert(
        t('Error', 'خطأ'),
        t('Failed to load purchase order', 'فشل في تحميل أمر الشراء')
      );
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateReceiveItem = (itemId: number, totalCost: number) => {
    setReceiveItems(prev => prev.map(item => 
      item.item_id === itemId ? { ...item, total_cost: totalCost } : item
    ));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('Permission Required', 'الإذن مطلوب'),
        t('Please allow access to photos to upload invoice image', 'يرجى السماح بالوصول إلى الصور لتحميل صورة الفاتورة')
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // No cropping for invoice images
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const base64 = result.assets[0].base64;
      const mimeType = result.assets[0].mimeType || 'image/jpeg';
      setInvoiceImageUrl(`data:${mimeType};base64,${base64}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('Permission Required', 'الإذن مطلوب'),
        t('Please allow camera access to take a photo', 'يرجى السماح بالوصول إلى الكاميرا لالتقاط صورة')
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, // No cropping for invoice images - capture full document
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const base64 = result.assets[0].base64;
      const mimeType = result.assets[0].mimeType || 'image/jpeg';
      setInvoiceImageUrl(`data:${mimeType};base64,${base64}`);
    }
  };

  const calculateTotal = (): number => {
    // UI preview only - backend calculates actual value on save
    return receiveItems.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  };

  const validateForm = (): boolean => {
    // Check invoice image
    if (!invoiceImageUrl) {
      Alert.alert(
        t('Missing Invoice', 'الفاتورة مفقودة'),
        t('Please attach the invoice image', 'يرجى إرفاق صورة الفاتورة')
      );
      return false;
    }

    // Check all items have total costs
    for (const item of receiveItems) {
      const orderItem = order?.items?.find(i => i.item_id === item.item_id);
      if (!orderItem) continue;

      if (item.total_cost <= 0) {
        Alert.alert(
          t('Missing Cost', 'التكلفة مفقودة'),
          t(`Please enter the total cost for ${orderItem.item?.name || 'item'}`,
            `يرجى إدخال التكلفة الإجمالية لـ ${orderItem.item?.name_ar || orderItem.item?.name || 'الصنف'}`)
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmitReceive = async () => {
    if (!validateForm()) return;

    Alert.alert(
      t('Confirm Receipt', 'تأكيد الاستلام'),
      t('Are you sure you want to confirm receipt of this order?', 'هل أنت متأكد من تأكيد استلام هذا الطلب؟'),
      [
        { text: t('Cancel', 'إلغاء'), style: 'cancel' },
        {
          text: t('Confirm', 'تأكيد'),
          onPress: submitReceive,
        },
      ]
    );
  };

  const submitReceive = async () => {
    setIsSubmitting(true);
    try {
      // Build items with received_quantity from counted_quantity (must be counted first)
      const itemsToSubmit = receiveItems.map(item => {
        const orderItem = order?.items?.find(i => i.item_id === item.item_id);
        // Use ONLY counted_quantity - order must be counted before receiving
        return {
          item_id: item.item_id,
          received_quantity: orderItem?.counted_quantity ?? 0,
          total_cost: item.total_cost,
          // Include variance info from counting step
          variance_reason: orderItem?.variance_reason,
          variance_note: orderItem?.variance_note,
        };
      });

      await api.post(`/inventory-stock/purchase-orders/${orderId}/receive`, {
        invoice_image_url: invoiceImageUrl,
        items: itemsToSubmit,
      });

      Alert.alert(
        t('Success', 'نجاح'),
        t('Order received successfully', 'تم استلام الطلب بنجاح'),
        [{ text: t('OK', 'حسناً'), onPress: () => navigation.popToTop() }]
      );
    } catch (error: any) {
      console.error('Failed to receive order:', error);
      Alert.alert(
        t('Error', 'خطأ'),
        error.response?.data?.error || t('Failed to receive order', 'فشل في استلام الطلب')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            {isRTL ? <ArrowRight size={24} color={colors.foreground} /> : <ArrowLeft size={24} color={colors.foreground} />}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('Receive Order', 'استلام الطلب')}</Text>
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
          <Text style={styles.headerTitle}>{t('Receive Order', 'استلام الطلب')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Package size={48} color={colors.mutedForeground} />
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
          <Text style={styles.headerSubtitle}>{t('Receiving', 'الاستلام')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Invoice Upload Section */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, isRTL && styles.rtlText]}>
            {t('Invoice Image', 'صورة الفاتورة')} *
          </Text>
          <Text style={[styles.cardHint, isRTL && styles.rtlText]}>
            {t('Attach a photo of the vendor invoice', 'أرفق صورة فاتورة المورد')}
          </Text>
          
          {invoiceImageUrl ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: invoiceImageUrl }} style={styles.invoiceImage} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setInvoiceImageUrl('')}>
                <XCircle size={24} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.uploadButtons, isRTL && styles.rtlRow]}>
              <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
                <Camera size={20} color={colors.foreground} />
                <Text style={styles.uploadButtonText}>{t('Camera', 'الكاميرا')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                <FileText size={20} color={colors.foreground} />
                <Text style={styles.uploadButtonText}>{t('Gallery', 'المعرض')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Items Cost Entry */}
        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
          {t('Enter Item Costs', 'أدخل تكاليف الأصناف')}
        </Text>

        {order.items?.map((orderItem) => {
          const receiveItem = receiveItems.find(r => r.item_id === orderItem.item_id);
          if (!receiveItem) return null;

          // Get the counted quantity (from counting step)
          const countedQty = orderItem.counted_quantity ?? orderItem.quantity;
          const hasVariance = orderItem.variance_reason || orderItem.variance_note;

          // UI preview only - backend calculates actual value on save
          const unitCostPreview = receiveItem.total_cost > 0 && countedQty > 0
            ? receiveItem.total_cost / countedQty
            : 0;

          return (
            <View key={orderItem.item_id} style={styles.itemCard}>
              <View style={[styles.itemHeader, isRTL && styles.rtlRow]}>
                <View style={styles.itemIcon}>
                  <Package size={18} color={colors.foreground} />
                </View>
                <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.itemName, isRTL && styles.rtlText]}>
                    {isRTL ? (orderItem.item?.name_ar || orderItem.item?.name) : orderItem.item?.name}
                  </Text>
                  <Text style={[styles.itemMeta, isRTL && styles.rtlText]}>
                    {orderItem.item?.sku || ''} • {orderItem.item?.storage_unit || orderItem.item?.unit}
                  </Text>
                </View>
                <View style={[styles.itemQuantity, isRTL && { alignItems: 'flex-start' }]}>
                  <Text style={styles.quantityLabel}>{t('Counted', 'المعدود')}</Text>
                  <Text style={styles.quantityValue}>{countedQty}</Text>
                </View>
              </View>

              {/* Variance Info */}
              {hasVariance && (
                <View style={styles.varianceInfo}>
                  {orderItem.variance_reason && (
                    <Text style={styles.varianceText}>
                      {t('Shortage', 'نقص')}: {orderItem.variance_reason}
                    </Text>
                  )}
                  {orderItem.variance_note && (
                    <Text style={styles.varianceNote}>
                      {t('Note', 'ملاحظة')}: {orderItem.variance_note}
                    </Text>
                  )}
                </View>
              )}

              {/* Total Cost Input */}
              <View style={styles.costInputRow}>
                <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                  {t('Total Cost (from invoice)', 'التكلفة الإجمالية (من الفاتورة)')} *
                </Text>
                <View style={[styles.costInputContainer, isRTL && styles.rtlRow]}>
                  <TextInput
                    style={[styles.costInput, isRTL && { textAlign: 'right' }]}
                    value={receiveItem.total_cost > 0 ? String(receiveItem.total_cost) : ''}
                    onChangeText={(text) => updateReceiveItem(orderItem.item_id, parseFloat(text) || 0)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                  <Text style={styles.currencyLabel}>{currency}</Text>
                </View>
                
                {/* Unit cost preview - UI preview only */}
                {unitCostPreview > 0 && (
                  <Text style={[styles.unitCostPreview, isRTL && styles.rtlText]}>
                    {/* UI preview only - backend calculates actual value on save */}
                    {t('Unit cost', 'تكلفة الوحدة')}: {formatCurrency(unitCostPreview)}/{orderItem.item?.storage_unit || orderItem.item?.unit}
                  </Text>
                )}
              </View>
            </View>
          );
        })}

        {/* Total Summary */}
        <View style={styles.summaryCard}>
          <View style={[styles.summaryRow, isRTL && styles.rtlRow]}>
            <Text style={styles.summaryLabel}>{t('Total Invoice', 'إجمالي الفاتورة')}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(calculateTotal())}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.receiveButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmitReceive}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <CheckCircle2 size={20} color="#fff" />
              <Text style={styles.receiveButtonText}>{t('Receive Order', 'استلام الطلب')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  cardHint: {
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
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
  itemQuantity: {
    alignItems: 'flex-end',
  },
  quantityLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  varianceInfo: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 0,
  },
  varianceText: {
    fontSize: 12,
    color: '#D97706',
  },
  varianceNote: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  costInputRow: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: 8,
    marginTop: 12,
  },
  costInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  costInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    paddingVertical: 12,
  },
  currencyLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginLeft: 8,
  },
  unitCostPreview: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontStyle: 'italic',
    marginTop: 6,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  bottomActions: {
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  receiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
  },
  receiveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

