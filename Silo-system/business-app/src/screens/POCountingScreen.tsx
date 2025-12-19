import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { colors } from '../theme/colors';
import { useLocalization } from '../localization/LocalizationContext';
import api from '../api/client';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  ScanBarcode,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
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

interface CountItemState {
  item_id: number;
  counted_quantity: number;
  variance_reason?: 'missing' | 'canceled' | 'rejected';
  variance_note?: string;
  barcode_scanned: boolean;
}

export default function POCountingScreen({ navigation, route }: any) {
  const { t, isRTL, language } = useLocalization();
  const { orderId } = route.params;
  
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [countItems, setCountItems] = useState<CountItemState[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Barcode scanner state
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanningForItemId, setScanningForItemId] = useState<number | null>(null);
  const [scanned, setScanned] = useState(false);
  const isProcessingRef = useRef(false); // Ref for immediate synchronous blocking
  
  // Unknown barcode modal
  const [unknownBarcodeModal, setUnknownBarcodeModal] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [associatingBarcode, setAssociatingBarcode] = useState(false);

  useEffect(() => {
    loadPODetails();
  }, [orderId]);

  const loadPODetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/inventory-stock/purchase-orders/${orderId}`);
      const po = response.data.data;
      setOrder(po);
      
      // Initialize count items
      if (po.items) {
        setCountItems(po.items.map((item: PurchaseOrderItem) => ({
          item_id: item.item_id,
          counted_quantity: item.counted_quantity ?? item.quantity, // Default to ordered quantity
          variance_reason: item.variance_reason || undefined,
          variance_note: item.variance_note || undefined,
          barcode_scanned: item.barcode_scanned || false,
        })));
        
        // Expand first item by default
        if (po.items.length > 0) {
          setExpandedItemId(po.items[0].item_id);
        }
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

  const updateCountItem = (itemId: number, field: string, value: any) => {
    setCountItems(prev => prev.map(item => {
      if (item.item_id !== itemId) return item;
      const updated = { ...item, [field]: value };
      
      // Get ordered quantity for this item
      const orderItem = order?.items?.find(i => i.item_id === itemId);
      if (!orderItem) return updated;
      
      // Auto-clear variance fields when quantity matches
      if (field === 'counted_quantity') {
        if (value >= orderItem.quantity) {
          updated.variance_reason = undefined;
        }
        if (value <= orderItem.quantity) {
          updated.variance_note = undefined;
        }
      }
      
      return updated;
    }));
  };

  const openScanner = async (itemId: number) => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          t('Permission Required', 'الإذن مطلوب'),
          t('Camera permission is required to scan barcodes', 'إذن الكاميرا مطلوب لمسح الباركود')
        );
        return;
      }
    }
    setScanningForItemId(itemId);
    setScanned(false);
    isProcessingRef.current = false; // Reset the ref
    setScannerVisible(true);
  };

  const handleBarCodeScanned = async ({ type, data }: BarcodeScanningResult) => {
    // Use ref for immediate synchronous check to prevent multiple calls
    if (isProcessingRef.current || scanned) return;
    isProcessingRef.current = true;
    setScanned(true);
    
    // Close scanner immediately to prevent further scans
    setScannerVisible(false);
    
    try {
      // Lookup barcode
      const response = await api.get(`/inventory-stock/items/barcode/${encodeURIComponent(data)}`);
      const result = response.data.data;
      
      if (!result) {
        // Unknown barcode - show association modal
        setUnknownBarcode(data);
        setUnknownBarcodeModal(true);
        return;
      }
      
      // Check if this barcode matches the expected item
      if (result.item_id === scanningForItemId) {
        // Correct item - mark as scanned
        updateCountItem(scanningForItemId, 'barcode_scanned', true);
        Alert.alert(
          t('Success', 'نجاح'),
          t('Barcode verified successfully', 'تم التحقق من الباركود بنجاح')
        );
      } else {
        // Wrong item - show alert (scanner already closed)
        const scannedItemName = result.item?.name || `Item ${result.item_id}`;
        Alert.alert(
          t('Wrong Item', 'صنف خاطئ'),
          t(`This barcode belongs to "${scannedItemName}". Please scan the correct item.`,
            `هذا الباركود ينتمي إلى "${scannedItemName}". يرجى مسح الصنف الصحيح.`)
        );
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      // Treat API error as unknown barcode
      setUnknownBarcode(data);
      setUnknownBarcodeModal(true);
    }
  };

  const associateBarcodeWithItem = async () => {
    if (!scanningForItemId || !unknownBarcode) return;
    
    setAssociatingBarcode(true);
    try {
      await api.post(`/inventory-stock/items/${scanningForItemId}/barcode`, {
        barcode: unknownBarcode,
      });
      
      // Mark item as scanned
      updateCountItem(scanningForItemId, 'barcode_scanned', true);
      setUnknownBarcodeModal(false);
      setUnknownBarcode('');
      
      Alert.alert(
        t('Success', 'نجاح'),
        t('Barcode associated and verified successfully', 'تم ربط الباركود والتحقق منه بنجاح')
      );
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to associate barcode';
      Alert.alert(t('Error', 'خطأ'), errorMsg);
    } finally {
      setAssociatingBarcode(false);
    }
  };

  const validateForm = (): boolean => {
    for (const item of countItems) {
      const orderItem = order?.items?.find(i => i.item_id === item.item_id);
      if (!orderItem) continue;

      // Check barcode was scanned
      if (!item.barcode_scanned) {
        Alert.alert(
          t('Barcode Required', 'الباركود مطلوب'),
          t(`Please scan at least one barcode for ${orderItem.item?.name || 'item'}`,
            `يرجى مسح باركود واحد على الأقل لـ ${orderItem.item?.name_ar || orderItem.item?.name || 'الصنف'}`)
        );
        return false;
      }

      // Check variance reason if under-counted
      if (item.counted_quantity < orderItem.quantity && !item.variance_reason) {
        Alert.alert(
          t('Missing Reason', 'السبب مفقود'),
          t(`Please select a reason for shortage on ${orderItem.item?.name || 'item'}`,
            `يرجى اختيار سبب النقص في ${orderItem.item?.name_ar || orderItem.item?.name || 'الصنف'}`)
        );
        return false;
      }

      // Check variance note if over-counted
      if (item.counted_quantity > orderItem.quantity && (!item.variance_note || item.variance_note.trim() === '')) {
        Alert.alert(
          t('Missing Justification', 'المبرر مفقود'),
          t(`Please provide justification for counting more than ordered on ${orderItem.item?.name || 'item'}`,
            `يرجى تقديم مبرر للعد أكثر من المطلوب في ${orderItem.item?.name_ar || orderItem.item?.name || 'الصنف'}`)
        );
        return false;
      }
    }
    return true;
  };

  const handleSubmitCount = async (proceedToReceive: boolean) => {
    if (!validateForm()) return;

    const actionText = proceedToReceive 
      ? t('save count and proceed to receiving', 'حفظ العد والمتابعة للاستلام')
      : t('save count', 'حفظ العد');

    Alert.alert(
      t('Confirm Count', 'تأكيد العد'),
      t(`Are you sure you want to ${actionText}?`, `هل أنت متأكد من ${actionText}؟`),
      [
        { text: t('Cancel', 'إلغاء'), style: 'cancel' },
        {
          text: t('Confirm', 'تأكيد'),
          onPress: () => submitCount(proceedToReceive),
        },
      ]
    );
  };

  const submitCount = async (proceedToReceive: boolean) => {
    setIsSubmitting(true);
    try {
      await api.post(`/inventory-stock/purchase-orders/${orderId}/count`, {
        items: countItems.map(item => ({
          item_id: item.item_id,
          counted_quantity: item.counted_quantity,
          barcode_scanned: item.barcode_scanned,
          variance_reason: item.variance_reason,
          variance_note: item.variance_note,
        })),
      });

      if (proceedToReceive) {
        // Navigate to receiving screen
        navigation.replace('POReceiving', { orderId });
      } else {
        // Go back to PO detail screen
        Alert.alert(
          t('Success', 'نجاح'),
          t('Count saved successfully. You can proceed to receiving later.', 
            'تم حفظ العد بنجاح. يمكنك المتابعة للاستلام لاحقاً.'),
          [{ text: t('OK', 'حسناً'), onPress: () => navigation.replace('PODetail', { orderId }) }]
        );
      }
    } catch (error: any) {
      console.error('Failed to submit count:', error);
      Alert.alert(
        t('Error', 'خطأ'),
        error.response?.data?.error || t('Failed to save count', 'فشل في حفظ العد')
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
          <Text style={styles.headerTitle}>{t('Count Order', 'عد الطلب')}</Text>
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
          <Text style={styles.headerTitle}>{t('Count Order', 'عد الطلب')}</Text>
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
          <Text style={styles.headerSubtitle}>{t('Counting', 'العد')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <AlertTriangle size={20} color="#D97706" />
        <Text style={[styles.instructionsText, isRTL && styles.rtlText]}>
          {t('Count each item and scan at least one barcode per item type.',
            'قم بعد كل صنف ومسح باركود واحد على الأقل لكل نوع صنف.')}
        </Text>
      </View>

      {/* Items List */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
          {t('Items', 'الأصناف')} ({order.items?.length || 0})
        </Text>

        {order.items?.map((orderItem) => {
          const countItem = countItems.find(c => c.item_id === orderItem.item_id);
          if (!countItem) return null;

          const isShort = countItem.counted_quantity < orderItem.quantity;
          const isOver = countItem.counted_quantity > orderItem.quantity;
          const isExpanded = expandedItemId === orderItem.item_id;
          const hasVariance = isShort || isOver;

          return (
            <TouchableOpacity
              key={orderItem.item_id}
              style={[
                styles.itemCard,
                hasVariance && styles.varianceCard,
                countItem.barcode_scanned && styles.scannedCard,
              ]}
              onPress={() => setExpandedItemId(isExpanded ? null : orderItem.item_id)}
              activeOpacity={0.8}
            >
              {/* Item Header */}
              <View style={[styles.itemHeader, isRTL && styles.rtlRow]}>
                <View style={styles.itemInfo}>
                  <View style={[styles.itemTitleRow, isRTL && styles.rtlRow]}>
                    <Text style={[styles.itemName, isRTL && styles.rtlText]}>
                      {isRTL ? (orderItem.item?.name_ar || orderItem.item?.name) : orderItem.item?.name}
                    </Text>
                    {countItem.barcode_scanned && (
                      <View style={styles.scannedBadge}>
                        <Check size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.itemMeta, isRTL && styles.rtlText]}>
                    {orderItem.item?.sku || ''} • {t('Ordered', 'المطلوب')}: {orderItem.quantity} {orderItem.item?.storage_unit || orderItem.item?.unit}
                  </Text>
                </View>
                <ChevronDown
                  size={20}
                  color={colors.mutedForeground}
                  style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                />
              </View>

              {/* Expanded Content */}
              {isExpanded && (
                <View style={styles.itemBody}>
                  {/* Counted Quantity */}
                  <View style={styles.inputRow}>
                    <Text style={[styles.inputLabel, isRTL && styles.rtlText]}>
                      {t('Counted Quantity', 'الكمية المعدودة')}
                    </Text>
                    <View style={[styles.quantityRow, isRTL && styles.rtlRow]}>
                      <TextInput
                        style={[styles.input, styles.quantityInput, hasVariance && styles.varianceInput]}
                        value={String(countItem.counted_quantity)}
                        onChangeText={(text) => updateCountItem(orderItem.item_id, 'counted_quantity', parseFloat(text) || 0)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                      />
                      <TouchableOpacity
                        style={[styles.scanButton, countItem.barcode_scanned && styles.scanButtonSuccess]}
                        onPress={() => openScanner(orderItem.item_id)}
                      >
                        <ScanBarcode size={20} color={countItem.barcode_scanned ? '#fff' : colors.foreground} />
                        <Text style={[styles.scanButtonText, countItem.barcode_scanned && styles.scanButtonTextSuccess]}>
                          {countItem.barcode_scanned ? t('Scanned', 'تم المسح') : t('Scan', 'مسح')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Variance Reason (if short) */}
                  {isShort && (
                    <View style={styles.inputRow}>
                      <Text style={[styles.inputLabel, styles.shortageLabel, isRTL && styles.rtlText]}>
                        {t('Reason for shortage', 'سبب النقص')} *
                      </Text>
                      <View style={[styles.reasonButtons, isRTL && styles.rtlRow]}>
                        {(['missing', 'canceled', 'rejected'] as const).map((reason) => (
                          <TouchableOpacity
                            key={reason}
                            style={[
                              styles.reasonButton,
                              countItem.variance_reason === reason && styles.reasonButtonActive,
                            ]}
                            onPress={() => updateCountItem(orderItem.item_id, 'variance_reason', reason)}
                          >
                            <Text style={[
                              styles.reasonButtonText,
                              countItem.variance_reason === reason && styles.reasonButtonTextActive,
                            ]}>
                              {reason === 'missing' ? t('Missing', 'مفقود') :
                               reason === 'canceled' ? t('Canceled', 'ملغي') :
                               t('Rejected', 'مرفوض')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Variance Note (if over) */}
                  {isOver && (
                    <View style={styles.inputRow}>
                      <Text style={[styles.inputLabel, styles.overLabel, isRTL && styles.rtlText]}>
                        {t('Justification (required)', 'المبرر (مطلوب)')} *
                      </Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={countItem.variance_note || ''}
                        onChangeText={(text) => updateCountItem(orderItem.item_id, 'variance_note', text)}
                        placeholder={t('Why more than ordered?', 'لماذا أكثر من المطلوب؟')}
                        multiline
                        numberOfLines={2}
                      />
                    </View>
                  )}

                  {/* Barcode status */}
                  {!countItem.barcode_scanned && (
                    <Text style={styles.barcodeWarning}>
                      ⚠️ {t('Barcode scan required', 'يجب مسح الباركود')}
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, isRTL && styles.rtlRow]}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => handleSubmitCount(false)}
          disabled={isSubmitting}
        >
          <Text style={styles.secondaryButtonText}>{t('Save & Receive Later', 'حفظ واستلام لاحقاً')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
          onPress={() => handleSubmitCount(true)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>{t('Proceed to Receive', 'المتابعة للاستلام')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Barcode Scanner Modal */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setScannerVisible(false)} style={styles.closeButton}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>{t('Scan Barcode', 'مسح الباركود')}</Text>
            <View style={{ width: 40 }} />
          </View>
          
          {!permission?.granted ? (
            <View style={styles.noCameraPermission}>
              <Text style={styles.noCameraText}>
                {t('Camera permission denied', 'تم رفض إذن الكاميرا')}
              </Text>
            </View>
          ) : (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'qr'],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
          )}
          
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerHint}>
              {t('Position barcode within frame', 'ضع الباركود داخل الإطار')}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Unknown Barcode Modal */}
      <Modal visible={unknownBarcodeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('Unknown Barcode', 'باركود غير معروف')}</Text>
            <Text style={styles.modalText}>
              {t('This barcode is not associated with any item. Would you like to associate it with the current item?',
                'هذا الباركود غير مرتبط بأي صنف. هل تريد ربطه بالصنف الحالي؟')}
            </Text>
            <Text style={styles.barcodeDisplay}>{unknownBarcode}</Text>
            
            <View style={[styles.modalButtons, isRTL && styles.rtlRow]}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setUnknownBarcodeModal(false);
                  setUnknownBarcode('');
                }}
              >
                <Text style={styles.modalCancelText}>{t('Cancel', 'إلغاء')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, associatingBarcode && styles.buttonDisabled]}
                onPress={associateBarcodeWithItem}
                disabled={associatingBarcode}
              >
                {associatingBarcode ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('Associate', 'ربط')}</Text>
                )}
              </TouchableOpacity>
            </View>
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
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 0,
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
  varianceCard: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  scannedCard: {
    borderColor: '#059669',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
  },
  scannedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  itemBody: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputRow: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  shortageLabel: {
    color: '#D97706',
  },
  overLabel: {
    color: '#3B82F6',
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: colors.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
  },
  quantityInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  varianceInput: {
    backgroundColor: '#FEF3C7',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.muted,
    borderRadius: 8,
  },
  scanButtonSuccess: {
    backgroundColor: '#059669',
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  scanButtonTextSuccess: {
    color: '#fff',
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
    paddingVertical: 10,
    paddingHorizontal: 8,
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
  barcodeWarning: {
    marginTop: 12,
    fontSize: 12,
    color: '#D97706',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.muted,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.foreground,
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    padding: 8,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  noCameraPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noCameraText: {
    color: '#fff',
    fontSize: 16,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scannerHint: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  barcodeDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
    backgroundColor: colors.muted,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.muted,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

