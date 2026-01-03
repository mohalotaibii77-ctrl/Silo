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
  Truck,
  User,
  Phone,
  Mail,
  Percent,
  Coins,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react-native';

// Types
interface DeliveryPartner {
  id: number;
  business_id: number;
  branch_id: number;
  name: string;
  name_ar?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  minimum_order?: number;
  delivery_fee?: number;
  estimated_time?: number;
  service_areas?: string;
  notes?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'active' | 'inactive';

export default function DeliveryPartnersScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, isRTL, formatCurrency } = useLocalization();
  
  // State
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<DeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [commissionValue, setCommissionValue] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load partners with cache-first pattern
  const loadPartners = useCallback(async (forceRefresh = false) => {
    const cacheKey = CacheKeys.deliveryPartners();
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<DeliveryPartner[]>(cacheKey);
      // Ensure cached data is a valid array
      if (cached && Array.isArray(cached)) {
        setPartners(cached);
        setIsLoading(false);
        // Refresh in background
        api.get('/delivery/partners')
          .then(response => {
            const fresh = Array.isArray(response.data.data) ? response.data.data : [];
            if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
              setPartners(fresh);
              cacheManager.set(cacheKey, fresh, CACHE_TTL.MEDIUM);
            }
          })
          .catch(() => {})
          .finally(() => setRefreshing(false));
        return;
      }
    }
    
    try {
      const response = await api.get('/delivery/partners');
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      setPartners(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.MEDIUM);
    } catch (err) {
      console.error('Failed to load delivery partners:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPartners(false); // Use cache if available
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [loadPartners]);

  // Filter partners
  useEffect(() => {
    let filtered = partners || [];
    
    if (filter === 'active') {
      filtered = filtered.filter(p => p.status === 'active');
    } else if (filter === 'inactive') {
      filtered = filtered.filter(p => p.status === 'inactive');
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.name_ar?.toLowerCase().includes(query) ||
        p.contact_person?.toLowerCase().includes(query) ||
        p.phone?.includes(query)
      );
    }
    
    setFilteredPartners(filtered);
  }, [partners, filter, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPartners(true); // Force refresh on pull-to-refresh
  }, [loadPartners]);

  // Modal handlers
  const handleOpenModal = (partner?: DeliveryPartner) => {
    if (partner) {
      setEditingPartner(partner);
      setName(partner.name);
      setNameAr(partner.name_ar || '');
      setContactPerson(partner.contact_person || '');
      setEmail(partner.email || '');
      setPhone(partner.phone || '');
      setCommissionType(partner.commission_type);
      setCommissionValue(partner.commission_value.toString());
      setDeliveryFee(partner.delivery_fee?.toString() || '');
      setEstimatedTime(partner.estimated_time?.toString() || '');
    } else {
      setEditingPartner(null);
      setName('');
      setNameAr('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      setCommissionType('percentage');
      setCommissionValue('');
      setDeliveryFee('');
      setEstimatedTime('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPartner(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('partnerNameRequired', 'Partner name is required'));
      return;
    }
    if (!commissionValue || parseFloat(commissionValue) < 0) {
      setError(t('validCommissionRequired', 'Valid commission value is required'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        contact_person: contactPerson.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        commission_type: commissionType,
        commission_value: parseFloat(commissionValue),
        delivery_fee: deliveryFee ? parseFloat(deliveryFee) : undefined,
        estimated_time: estimatedTime ? parseInt(estimatedTime) : undefined,
      };

      if (editingPartner) {
        await api.put(`/delivery/partners/${editingPartner.id}`, data);
      } else {
        await api.post('/delivery/partners', data);
      }
      handleCloseModal();
      await cacheManager.invalidate(CacheKeys.deliveryPartners());
      loadPartners(true); // Force refresh after mutation
    } catch (err: any) {
      setError(err.response?.data?.error || t('failedToSavePartner', 'Failed to save delivery partner'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (partner: DeliveryPartner) => {
    try {
      await api.put(`/delivery/partners/${partner.id}`, { 
        status: partner.status === 'active' ? 'inactive' : 'active' 
      });
      await cacheManager.invalidate(CacheKeys.deliveryPartners());
      loadPartners(true); // Force refresh after mutation
    } catch (err) {
      console.error('Failed to toggle partner status:', err);
    }
  };

  const handleDelete = (partner: DeliveryPartner) => {
    Alert.alert(
      t('confirmDelete', 'Confirm Delete'),
      t('confirmDeletePartner', 'Are you sure you want to delete this delivery partner?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/delivery/partners/${partner.id}`);
              await cacheManager.invalidate(CacheKeys.deliveryPartners());
              loadPartners(true); // Force refresh after mutation
            } catch (err: any) {
              Alert.alert(t('error', 'Error'), err.response?.data?.error || t('failedToDeletePartner', 'Failed to delete delivery partner'));
            }
          }
        }
      ]
    );
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Render partner card
  const PartnerCard = ({ partner }: { partner: DeliveryPartner }) => (
    <View style={[styles.partnerCard, partner.status === 'inactive' && styles.partnerCardInactive]}>
      <View style={[styles.partnerCardHeader, isRTL && styles.partnerCardHeaderRTL]}>
        <View style={[
          styles.partnerIcon,
          partner.status === 'active' ? styles.partnerIconActive : styles.partnerIconInactive
        ]}>
          <Truck 
            size={24} 
            color={partner.status === 'active' ? colors.success : colors.mutedForeground} 
          />
        </View>
        <View style={[styles.partnerInfo, isRTL && { alignItems: 'flex-end' }]}>
          <View style={[styles.partnerNameRow, isRTL && styles.partnerNameRowRTL]}>
            <Text style={[styles.partnerName, isRTL && styles.textRTL]}>
              {isRTL ? partner.name_ar || partner.name : partner.name}
            </Text>
            {partner.status === 'inactive' && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>{t('inactive', 'Inactive')}</Text>
              </View>
            )}
          </View>
          {partner.contact_person && (
            <View style={[styles.contactRow, isRTL && styles.contactRowRTL]}>
              <User size={12} color={colors.mutedForeground} />
              <Text style={styles.contactText}>{partner.contact_person}</Text>
            </View>
          )}
          {partner.phone && (
            <View style={[styles.contactRow, isRTL && styles.contactRowRTL]}>
              <Phone size={12} color={colors.mutedForeground} />
              <Text style={styles.contactText}>{partner.phone}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Commission & Details */}
      <View style={[styles.detailsRow, isRTL && styles.detailsRowRTL]}>
        <View style={[styles.detailItem, isRTL && styles.detailItemRTL]}>
          {partner.commission_type === 'percentage' ? (
            <Percent size={14} color={colors.mutedForeground} />
          ) : (
            <Coins size={14} color={colors.mutedForeground} />
          )}
          <Text style={styles.detailText}>
            {partner.commission_type === 'percentage' 
              ? `${partner.commission_value}%`
              : formatCurrency(partner.commission_value)
            }
          </Text>
        </View>
        
        {partner.estimated_time && (
          <View style={[styles.detailItem, isRTL && styles.detailItemRTL]}>
            <Clock size={14} color={colors.mutedForeground} />
            <Text style={styles.detailText}>{partner.estimated_time} {t('min', 'min')}</Text>
          </View>
        )}
        
        {partner.delivery_fee !== null && partner.delivery_fee !== undefined && (
          <View style={[styles.detailItem, isRTL && styles.detailItemRTL]}>
            <Coins size={14} color={colors.mutedForeground} />
            <Text style={styles.detailText}>{formatCurrency(partner.delivery_fee)}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={[styles.partnerActions, isRTL && styles.partnerActionsRTL]}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleToggleActive(partner)}
        >
          {partner.status === 'active' ? (
            <XCircle size={16} color={colors.warning} />
          ) : (
            <CheckCircle size={16} color={colors.success} />
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleOpenModal(partner)}
        >
          <Edit2 size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(partner)}
        >
          <Trash2 size={16} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );

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
                <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{t('deliveryPartners', 'Delivery Partners')}</Text>
                <Text style={[styles.headerSubtitle, isRTL && styles.textRTL]}>{t('manageDeliveryProviders', 'Manage delivery service providers')}</Text>
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
                placeholder={t('searchPartners', 'Search partners...')}
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
              { key: 'all' as FilterType, label: t('all', 'All'), count: (partners || []).length },
              { key: 'active' as FilterType, label: t('active', 'Active'), count: (partners || []).filter(p => p.status === 'active').length },
              { key: 'inactive' as FilterType, label: t('inactive', 'Inactive'), count: (partners || []).filter(p => p.status === 'inactive').length },
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
          ) : (filteredPartners || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Truck size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>{t('noPartnersYet', 'No delivery partners yet')}</Text>
              <Text style={styles.emptySubtitle}>{t('addDeliveryPartners', 'Add delivery service providers you work with')}</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => handleOpenModal()}>
                <Plus size={18} color={colors.background} />
                <Text style={styles.emptyButtonText}>{t('addPartner', 'Add Partner')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.partnerGrid}>
              {(filteredPartners || []).map((partner) => (
                <PartnerCard key={partner.id} partner={partner} />
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
                {editingPartner ? t('editPartner', 'Edit Partner') : t('addPartner', 'Add Partner')}
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

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('partnerName', 'Partner Name')} *
                  </Text>
                  <TextInput
                    style={[styles.formInput, isRTL && styles.textRTL]}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('egTalabat', 'e.g., Talabat, Deliveroo')}
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
                    placeholder="طلبات"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('contactPerson', 'Contact Person')}
                  </Text>
                  <TextInput
                    style={[styles.formInput, isRTL && styles.textRTL]}
                    value={contactPerson}
                    onChangeText={setContactPerson}
                    placeholder={t('contactName', 'Contact name')}
                    placeholderTextColor={colors.mutedForeground}
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('phone', 'Phone')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+965 XXXX XXXX"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                  {t('email', 'Email')}
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="partner@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                  {t('commissionType', 'Commission Type')} *
                </Text>
                <View style={[styles.commissionButtons, isRTL && styles.commissionButtonsRTL]}>
                  <TouchableOpacity
                    style={[styles.commissionButton, commissionType === 'percentage' && styles.commissionButtonActive]}
                    onPress={() => setCommissionType('percentage')}
                  >
                    <Percent size={16} color={commissionType === 'percentage' ? colors.background : colors.mutedForeground} />
                    <Text style={[styles.commissionButtonText, commissionType === 'percentage' && styles.commissionButtonTextActive]}>
                      {t('percentage', 'Percentage')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.commissionButton, commissionType === 'fixed' && styles.commissionButtonActive]}
                    onPress={() => setCommissionType('fixed')}
                  >
                    <Coins size={16} color={commissionType === 'fixed' ? colors.background : colors.mutedForeground} />
                    <Text style={[styles.commissionButtonText, commissionType === 'fixed' && styles.commissionButtonTextActive]}>
                      {t('fixedAmount', 'Fixed Amount')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('commissionValue', 'Commission Value')} *
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={commissionValue}
                    onChangeText={setCommissionValue}
                    placeholder={commissionType === 'percentage' ? '15' : '2.000'}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formGroupHalf}>
                  <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                    {t('deliveryFee', 'Delivery Fee')}
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={deliveryFee}
                    onChangeText={setDeliveryFee}
                    placeholder="1.000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
                  {t('estimatedTimeMin', 'Estimated Time (min)')}
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={estimatedTime}
                  onChangeText={setEstimatedTime}
                  placeholder="30"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
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
                    : editingPartner 
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
  partnerGrid: {
    gap: 12,
    paddingHorizontal: 16,
  },
  partnerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  partnerCardInactive: {
    opacity: 0.6,
  },
  partnerCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  partnerCardHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  partnerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerIconActive: {
    backgroundColor: colors.success + '20',
  },
  partnerIconInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerNameRowRTL: {
    flexDirection: 'row-reverse',
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  inactiveBadge: {
    backgroundColor: colors.mutedForeground + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  contactRowRTL: {
    flexDirection: 'row-reverse',
  },
  contactText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
  },
  detailsRowRTL: {
    flexDirection: 'row-reverse',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  detailItemRTL: {
    flexDirection: 'row-reverse',
  },
  detailText: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  partnerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  partnerActionsRTL: {
    flexDirection: 'row-reverse',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
  commissionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  commissionButtonsRTL: {
    flexDirection: 'row-reverse',
  },
  commissionButton: {
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
  commissionButtonActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  commissionButtonText: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  commissionButtonTextActive: {
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


