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
import { useTheme } from '../theme/ThemeContext';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import { ListSkeleton } from '../components/SkeletonLoader';
import { 
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Plus,
  Edit2,
  Trash2,
  Percent,
  Tag,
  Calendar,
  Hash,
  CheckCircle,
  XCircle,
  Coins
} from 'lucide-react-native';

// Types
interface DiscountCode {
  id: number;
  business_id: number;
  code: string;
  name?: string;
  name_ar?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  used_count: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'active' | 'inactive';

export default function DiscountsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, isRTL, formatCurrency } = useLocalization();
  
  // State
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [filteredDiscounts, setFilteredDiscounts] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load discounts with cache-first pattern
  const loadDiscounts = useCallback(async (forceRefresh = false) => {
    const cacheKey = CacheKeys.discounts();
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<DiscountCode[]>(cacheKey);
      // Ensure cached data is a valid array
      if (cached && Array.isArray(cached)) {
        setDiscounts(cached);
        setIsLoading(false);
        // Refresh in background
        api.get('/discounts')
          .then(response => {
            const fresh = response.data.data || [];
            if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
              setDiscounts(fresh);
              cacheManager.set(cacheKey, fresh, CACHE_TTL.MEDIUM);
            }
          })
          .catch(() => {})
          .finally(() => setRefreshing(false));
        return;
      }
    }
    
    try {
      const response = await api.get('/discounts');
      const data = response.data.data || [];
      setDiscounts(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.MEDIUM);
    } catch (err) {
      console.error('Failed to load discounts:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDiscounts(false); // Use cache if available
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [loadDiscounts]);

  // Filter discounts
  useEffect(() => {
    let filtered = discounts || [];
    
    if (filter === 'active') {
      filtered = filtered.filter(d => d.is_active);
    } else if (filter === 'inactive') {
      filtered = filtered.filter(d => !d.is_active);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.code.toLowerCase().includes(query) ||
        d.name?.toLowerCase().includes(query) ||
        d.name_ar?.toLowerCase().includes(query)
      );
    }
    
    setFilteredDiscounts(filtered);
  }, [discounts, filter, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDiscounts(true); // Force refresh on pull-to-refresh
  }, [loadDiscounts]);

  // Check if discount is expired
  const isExpired = (discount: DiscountCode) => {
    if (!discount.end_date) return false;
    return new Date(discount.end_date) < new Date();
  };

  // Check if discount is not yet active
  const isNotYetActive = (discount: DiscountCode) => {
    if (!discount.start_date) return false;
    return new Date(discount.start_date) > new Date();
  };

  // Modal handlers
  const handleOpenModal = (discount?: DiscountCode) => {
    if (discount) {
      setEditingDiscount(discount);
      setCode(discount.code);
      setName(discount.name || '');
      setNameAr(discount.name_ar || '');
      setDiscountType(discount.discount_type);
      setDiscountValue(discount.discount_value.toString());
      setMinOrderAmount(discount.min_order_amount?.toString() || '');
      setMaxDiscountAmount(discount.max_discount_amount?.toString() || '');
      setUsageLimit(discount.usage_limit?.toString() || '');
    } else {
      setEditingDiscount(null);
      setCode('');
      setName('');
      setNameAr('');
      setDiscountType('percentage');
      setDiscountValue('');
      setMinOrderAmount('');
      setMaxDiscountAmount('');
      setUsageLimit('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDiscount(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError(t('discountCodeRequired', 'Discount code is required'));
      return;
    }
    if (!discountValue || parseFloat(discountValue) <= 0) {
      setError(t('validDiscountValueRequired', 'Valid discount value is required'));
      return;
    }
    if (discountType === 'percentage' && parseFloat(discountValue) > 100) {
      setError(t('percentageCannotExceed100', 'Percentage cannot exceed 100%'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = {
        code: code.toUpperCase().trim(),
        name: name.trim() || undefined,
        name_ar: nameAr.trim() || undefined,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : undefined,
        max_discount_amount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : undefined,
        usage_limit: usageLimit ? parseInt(usageLimit) : undefined,
      };

      if (editingDiscount) {
        await api.put(`/discounts/${editingDiscount.id}`, data);
      } else {
        await api.post('/discounts', data);
      }
      handleCloseModal();
      await cacheManager.invalidate(CacheKeys.discounts());
      loadDiscounts(true); // Force refresh after mutation
    } catch (err: any) {
      setError(err.response?.data?.error || t('failedToSaveDiscount', 'Failed to save discount'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (discount: DiscountCode) => {
    try {
      await api.put(`/discounts/${discount.id}`, { is_active: !discount.is_active });
      await cacheManager.invalidate(CacheKeys.discounts());
      loadDiscounts(true); // Force refresh after mutation
    } catch (err) {
      console.error('Failed to toggle discount:', err);
    }
  };

  const handleDelete = (discount: DiscountCode) => {
    Alert.alert(
      t('confirmDelete', 'Confirm Delete'),
      t('confirmDeleteDiscount', 'Are you sure you want to delete this discount code?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/discounts/${discount.id}`);
              await cacheManager.invalidate(CacheKeys.discounts());
              loadDiscounts(true); // Force refresh after mutation
            } catch (err: any) {
              Alert.alert(t('error', 'Error'), err.response?.data?.error || t('failedToDeleteDiscount', 'Failed to delete discount'));
            }
          }
        }
      ]
    );
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Render discount card
  const DiscountCard = ({ discount }: { discount: DiscountCode }) => {
    const expired = isExpired(discount);
    const notYetActive = isNotYetActive(discount);
    
    return (
      <View style={[
        styles.discountCard, 
        (!discount.is_active || expired) && styles.discountCardInactive
      ]}>
        <View style={[styles.discountCardHeader, isRTL && styles.discountCardHeaderRTL]}>
          <View style={[
            styles.discountIcon,
            discount.is_active && !expired ? styles.discountIconActive : styles.discountIconInactive
          ]}>
            <Tag 
              size={24} 
              color={discount.is_active && !expired ? colors.success : colors.mutedForeground} 
            />
          </View>
          <View style={[styles.discountInfo, isRTL && { alignItems: 'flex-end' }]}>
            <View style={[styles.discountCodeRow, isRTL && styles.discountCodeRowRTL]}>
              <Text style={styles.discountCode}>{discount.code}</Text>
              {!discount.is_active && (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{t('inactive', 'Inactive')}</Text>
                </View>
              )}
              {expired && (
                <View style={[styles.statusBadge, styles.expiredBadge]}>
                  <Text style={[styles.statusBadgeText, styles.expiredBadgeText]}>{t('expired', 'Expired')}</Text>
                </View>
              )}
              {notYetActive && (
                <View style={[styles.statusBadge, styles.scheduledBadge]}>
                  <Text style={[styles.statusBadgeText, styles.scheduledBadgeText]}>{t('scheduled', 'Scheduled')}</Text>
                </View>
              )}
            </View>
            {discount.name && (
              <Text style={[styles.discountName, isRTL && styles.textRTL]}>
                {isRTL ? discount.name_ar || discount.name : discount.name}
              </Text>
            )}
            
            {/* Discount Details */}
            <View style={[styles.discountDetails, isRTL && styles.discountDetailsRTL]}>
              <View style={[styles.detailItem, isRTL && styles.detailItemRTL]}>
                <Percent size={14} color={colors.mutedForeground} />
                <Text style={styles.detailText}>
                  {discount.discount_type === 'percentage' 
                    ? `${discount.discount_value}%`
                    : formatCurrency(discount.discount_value)
                  }
                </Text>
              </View>
              
              {discount.usage_limit && (
                <View style={[styles.detailItem, isRTL && styles.detailItemRTL]}>
                  <Hash size={14} color={colors.mutedForeground} />
                  <Text style={styles.detailText}>{discount.used_count}/{discount.usage_limit}</Text>
                </View>
              )}
              
              {(discount.start_date || discount.end_date) && (
                <View style={[styles.detailItem, isRTL && styles.detailItemRTL]}>
                  <Calendar size={14} color={colors.mutedForeground} />
                  <Text style={styles.detailText}>
                    {discount.start_date && new Date(discount.start_date).toLocaleDateString()}
                    {discount.start_date && discount.end_date && ' - '}
                    {discount.end_date && new Date(discount.end_date).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.discountActions, isRTL && styles.discountActionsRTL]}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleToggleActive(discount)}
          >
            {discount.is_active ? (
              <CheckCircle size={18} color={colors.success} />
            ) : (
              <XCircle size={18} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleOpenModal(discount)}
          >
            <Edit2 size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDelete(discount)}
          >
            <Trash2 size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header - scrolls with content */}
          <View style={styles.header}>
            <View style={[styles.headerTop, isRTL && styles.headerTopRTL]}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => safeGoBack(navigation)}
              >
                <BackIcon size={24} color={colors.foreground} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{t('discounts', 'Discounts')}</Text>
                <Text style={[styles.headerSubtitle, isRTL && styles.textRTL]}>{t('manageDiscountCodes', 'Manage discount codes for POS')}</Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleOpenModal()}
              >
                <Plus size={20} color={colors.background} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchContainer, isRTL && styles.searchContainerRTL]}>
              <Search size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, isRTL && styles.textRTL]}
                placeholder={t('searchDiscounts', 'Search discounts...')}
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                textAlign={isRTL ? 'right' : 'left'}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={[styles.filterContainer, isRTL && styles.filterContainerRTL]}>
            {[
              { key: 'all' as FilterType, label: t('all', 'All'), count: (discounts || []).length },
              { key: 'active' as FilterType, label: t('active', 'Active'), count: (discounts || []).filter(d => d.is_active).length },
              { key: 'inactive' as FilterType, label: t('inactive', 'Inactive'), count: (discounts || []).filter(d => !d.is_active).length },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {isLoading ? (
            <ListSkeleton count={4} type="card" />
          ) : (filteredDiscounts || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Percent size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>{t('noDiscountsYet', 'No discount codes yet')}</Text>
              <Text style={styles.emptySubtitle}>{t('createDiscountCodes', 'Create discount codes that customers can use at checkout')}</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => handleOpenModal()}>
                <Plus size={18} color={colors.background} />
                <Text style={styles.emptyButtonText}>{t('addDiscount', 'Add Discount')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.discountList}>
              {(filteredDiscounts || []).map((discount) => (
                <DiscountCard key={discount.id} discount={discount} />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Add/Edit Modal */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isRTL && styles.modalContentRTL]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, isRTL && styles.modalHeaderRTL]}>
              <Text style={styles.modalTitle}>
                {editingDiscount ? t('editDiscount', 'Edit Discount') : t('addDiscount', 'Add Discount')}
              </Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseButton}>
                <X size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody}>
              {error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                  {t('discountCode', 'Discount Code')} *
                </Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMono]}
                  value={code}
                  onChangeText={(text) => setCode(text.toUpperCase())}
                  placeholder={t('egSUMMER20', 'e.g., SUMMER20')}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('name', 'Name')}
                  </Text>
                  <TextInput
                    style={[styles.formInput, isRTL && styles.textRTL]}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('summerSale', 'Summer Sale')}
                    placeholderTextColor={colors.mutedForeground}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('arabicName', 'Arabic Name')}
                  </Text>
                  <TextInput
                    style={[styles.formInput, { textAlign: 'right' }]}
                    value={nameAr}
                    onChangeText={setNameAr}
                    placeholder="تخفيضات الصيف"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                  {t('discountType', 'Discount Type')} *
                </Text>
                <View style={[styles.typeButtons, isRTL && styles.typeButtonsRTL]}>
                  <TouchableOpacity
                    style={[styles.typeButton, discountType === 'percentage' && styles.typeButtonActive]}
                    onPress={() => setDiscountType('percentage')}
                  >
                    <Percent size={16} color={discountType === 'percentage' ? colors.background : colors.mutedForeground} />
                    <Text style={[styles.typeButtonText, discountType === 'percentage' && styles.typeButtonTextActive]}>
                      {t('percentage', 'Percentage')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButton, discountType === 'fixed' && styles.typeButtonActive]}
                    onPress={() => setDiscountType('fixed')}
                  >
                    <Coins size={16} color={discountType === 'fixed' ? colors.background : colors.mutedForeground} />
                    <Text style={[styles.typeButtonText, discountType === 'fixed' && styles.typeButtonTextActive]}>
                      {t('fixedAmount', 'Fixed Amount')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('discountValue', 'Discount Value')} *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={discountValue}
                    onChangeText={setDiscountValue}
                    placeholder={discountType === 'percentage' ? '20' : '5.000'}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('minOrderAmount', 'Min Order Amount')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={minOrderAmount}
                    onChangeText={setMinOrderAmount}
                    placeholder="0.000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('maxDiscount', 'Max Discount')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={maxDiscountAmount}
                    onChangeText={setMaxDiscountAmount}
                    placeholder={t('noLimit', 'No limit')}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('usageLimit', 'Usage Limit')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={usageLimit}
                    onChangeText={setUsageLimit}
                    placeholder={t('unlimited', 'Unlimited')}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, isRTL && styles.modalFooterRTL]}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal}>
                <Text style={styles.cancelButtonText}>{t('cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting 
                    ? t('saving', 'Saving...') 
                    : editingDiscount 
                      ? t('update', 'Update')
                      : t('create', 'Create')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTopRTL: {
    flexDirection: 'row-reverse',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.foreground,
    justifyContent: 'center',
    alignItems: 'center',
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
  searchContainerRTL: {
    flexDirection: 'row-reverse',
  },
  searchInputWrapperRTL: {
    flexDirection: 'row-reverse',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterContainerRTL: {
    flexDirection: 'row-reverse',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  filterTabActive: {
    backgroundColor: colors.foreground,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterTabTextActive: {
    color: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.foreground,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  discountList: {
    gap: 12,
    paddingHorizontal: 16,
  },
  discountCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  discountCardInactive: {
    opacity: 0.6,
  },
  discountCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  discountCardHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  discountIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountIconActive: {
    backgroundColor: colors.success + '20',
  },
  discountIconInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  discountInfo: {
    flex: 1,
  },
  discountCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  discountCodeRowRTL: {
    flexDirection: 'row-reverse',
  },
  discountCode: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusBadge: {
    backgroundColor: colors.mutedForeground + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  expiredBadge: {
    backgroundColor: colors.destructive + '20',
  },
  expiredBadgeText: {
    color: colors.destructive,
  },
  scheduledBadge: {
    backgroundColor: colors.warning + '20',
  },
  scheduledBadgeText: {
    color: colors.warning,
  },
  discountName: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  discountDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 12,
  },
  discountDetailsRTL: {
    flexDirection: 'row-reverse',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailItemRTL: {
    flexDirection: 'row-reverse',
  },
  detailText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  discountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  discountActionsRTL: {
    flexDirection: 'row-reverse',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textRTL: {
    textAlign: 'right',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: 20,
    maxHeight: '85%',
  },
  modalContentRTL: {},
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  errorBanner: {
    backgroundColor: colors.destructive + '20',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.destructive + '40',
  },
  errorText: {
    fontSize: 13,
    color: colors.destructive,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formGroupHalf: {
    flex: 1,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formInputMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButtonsRTL: {
    flexDirection: 'row-reverse',
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  typeButtonText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: colors.background,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    gap: 12,
  },
  modalFooterRTL: {
    flexDirection: 'row-reverse',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  submitButton: {
    backgroundColor: colors.foreground,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
});


