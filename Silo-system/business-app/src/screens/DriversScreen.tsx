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
  TextInput,
  Alert
} from 'react-native';
import { BaseModal } from '../components/BaseModal';
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
  Car,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  CircleDot
} from 'lucide-react-native';

// Types
type DriverStatus = 'available' | 'busy' | 'offline';

interface Driver {
  id: number;
  business_id: number;
  branch_id?: number | null;
  name: string;
  name_ar?: string | null;
  phone?: string | null;
  email?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  status: DriverStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'active' | 'inactive';
type StatusFilterType = 'all' | DriverStatus;

export default function DriversScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, isRTL } = useLocalization();
  
  // State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Vehicle types
  const vehicleTypes = [
    { id: 'motorcycle', name: t('motorcycle', 'Motorcycle') },
    { id: 'car', name: t('car', 'Car') },
    { id: 'bicycle', name: t('bicycle', 'Bicycle') },
    { id: 'scooter', name: t('scooter', 'Scooter') },
    { id: 'van', name: t('van', 'Van') },
  ];

  // Load drivers with cache-first pattern
  const loadDrivers = useCallback(async (forceRefresh = false) => {
    const cacheKey = CacheKeys.drivers();
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<Driver[]>(cacheKey);
      // Ensure cached data is a valid array
      if (cached && Array.isArray(cached)) {
        setDrivers(cached);
        setIsLoading(false);
        // Refresh in background
        api.get('/drivers')
          .then(response => {
            const fresh = response.data.data || [];
            if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
              setDrivers(fresh);
              cacheManager.set(cacheKey, fresh, CACHE_TTL.MEDIUM);
            }
          })
          .catch(() => {})
          .finally(() => setRefreshing(false));
        return;
      }
    }
    
    try {
      const response = await api.get('/drivers');
      const data = response.data.data || [];
      setDrivers(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.MEDIUM);
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers(false); // Use cache if available
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [loadDrivers]);

  // Filter drivers
  useEffect(() => {
    let filtered = drivers || [];
    
    if (filter === 'active') {
      filtered = filtered.filter(d => d.is_active);
    } else if (filter === 'inactive') {
      filtered = filtered.filter(d => !d.is_active);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(query) ||
        d.name_ar?.toLowerCase().includes(query) ||
        d.phone?.includes(query)
      );
    }
    
    setFilteredDrivers(filtered);
  }, [drivers, filter, statusFilter, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDrivers(true); // Force refresh on pull-to-refresh
  }, [loadDrivers]);

  // Modal handlers
  const handleOpenModal = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setName(driver.name);
      setNameAr(driver.name_ar || '');
      setPhone(driver.phone || '');
      setEmail(driver.email || '');
      setVehicleType(driver.vehicle_type || '');
      setVehicleNumber(driver.vehicle_number || '');
    } else {
      setEditingDriver(null);
      setName('');
      setNameAr('');
      setPhone('');
      setEmail('');
      setVehicleType('');
      setVehicleNumber('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDriver(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('driverNameRequired', 'Driver name is required'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingDriver) {
        await api.put(`/drivers/${editingDriver.id}`, {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          vehicle_type: vehicleType || undefined,
          vehicle_number: vehicleNumber.trim() || undefined,
        });
      } else {
        await api.post('/drivers', {
          name: name.trim(),
          name_ar: nameAr.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          vehicle_type: vehicleType || undefined,
          vehicle_number: vehicleNumber.trim() || undefined,
        });
      }
      handleCloseModal();
      await cacheManager.invalidate(CacheKeys.drivers());
      loadDrivers(true); // Force refresh after mutation
    } catch (err: any) {
      setError(err.response?.data?.error || t('failedToSaveDriver', 'Failed to save driver'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (driver: Driver) => {
    try {
      await api.put(`/drivers/${driver.id}`, { is_active: !driver.is_active });
      await cacheManager.invalidate(CacheKeys.drivers());
      loadDrivers(true); // Force refresh after mutation
    } catch (err) {
      console.error('Failed to toggle driver status:', err);
    }
  };

  const handleStatusChange = async (driver: Driver, status: DriverStatus) => {
    try {
      await api.put(`/drivers/${driver.id}/status`, { status });
      await cacheManager.invalidate(CacheKeys.drivers());
      loadDrivers(true); // Force refresh after mutation
    } catch (err) {
      console.error('Failed to update driver status:', err);
    }
  };

  const handleDelete = (driver: Driver) => {
    Alert.alert(
      t('confirmDelete', 'Confirm Delete'),
      t('confirmDeleteDriver', 'Are you sure you want to delete this driver?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/drivers/${driver.id}`);
              await cacheManager.invalidate(CacheKeys.drivers());
              loadDrivers(true); // Force refresh after mutation
            } catch (err: any) {
              Alert.alert(t('error', 'Error'), err.response?.data?.error || t('failedToDeleteDriver', 'Failed to delete driver'));
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: DriverStatus) => {
    switch (status) {
      case 'available': return colors.success;
      case 'busy': return colors.warning;
      case 'offline': return colors.mutedForeground;
      default: return colors.mutedForeground;
    }
  };

  const getStatusLabel = (status: DriverStatus) => {
    switch (status) {
      case 'available': return t('available', 'Available');
      case 'busy': return t('busy', 'Busy');
      case 'offline': return t('offline', 'Offline');
      default: return status;
    }
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Render driver card
  const DriverCard = ({ driver }: { driver: Driver }) => (
    <View style={[styles.driverCard, !driver.is_active && styles.driverCardInactive]}>
      <View style={[styles.driverCardHeader, isRTL && styles.driverCardHeaderRTL]}>
        <View style={[styles.driverIcon, { backgroundColor: getStatusColor(driver.status) + '20' }]}>
          <Car size={24} color={getStatusColor(driver.status)} />
        </View>
        <View style={[styles.driverInfo, isRTL && { alignItems: 'flex-end' }]}>
          <Text style={[styles.driverName, isRTL && styles.textRTL]}>
            {isRTL && driver.name_ar ? driver.name_ar : driver.name}
          </Text>
          {driver.vehicle_type && (
            <Text style={styles.driverVehicle}>
              {vehicleTypes.find(v => v.id === driver.vehicle_type)?.name || driver.vehicle_type}
              {driver.vehicle_number && ` • ${driver.vehicle_number}`}
            </Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(driver.status) + '20' }]}>
          <Text style={[styles.statusBadgeText, { color: getStatusColor(driver.status) }]}>
            {getStatusLabel(driver.status)}
          </Text>
        </View>
      </View>

      {/* Contact Info */}
      <View style={styles.contactInfo}>
        {driver.phone && (
          <View style={[styles.contactItem, isRTL && styles.contactItemRTL]}>
            <Phone size={14} color={colors.mutedForeground} />
            <Text style={styles.contactText}>{driver.phone}</Text>
          </View>
        )}
        {driver.email && (
          <View style={[styles.contactItem, isRTL && styles.contactItemRTL]}>
            <Mail size={14} color={colors.mutedForeground} />
            <Text style={styles.contactText} numberOfLines={1}>{driver.email}</Text>
          </View>
        )}
      </View>

      {/* Quick Status Change */}
      {driver.is_active && (
        <View style={[styles.quickStatus, isRTL && styles.quickStatusRTL]}>
          <Text style={styles.quickStatusLabel}>{t('status', 'Status')}:</Text>
          {(['available', 'busy', 'offline'] as DriverStatus[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.quickStatusButton,
                driver.status === status && { backgroundColor: getStatusColor(status) + '20' }
              ]}
              onPress={() => handleStatusChange(driver, status)}
            >
              <CircleDot 
                size={16} 
                color={driver.status === status ? getStatusColor(status) : colors.mutedForeground} 
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={[styles.driverActions, isRTL && styles.driverActionsRTL]}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleToggleActive(driver)}
        >
          {driver.is_active ? (
            <XCircle size={16} color={colors.warning} />
          ) : (
            <CheckCircle size={16} color={colors.success} />
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleOpenModal(driver)}
        >
          <Edit2 size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(driver)}
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
                <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{t('drivers', 'Drivers')}</Text>
                <Text style={[styles.headerSubtitle, isRTL && styles.textRTL]}>{t('manageInHouseDrivers', 'Manage in-house delivery drivers')}</Text>
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
                placeholder={t('searchDrivers', 'Search drivers...')}
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            <View style={[styles.filterContainer, isRTL && styles.filterContainerRTL]}>
              {[
                { key: 'all' as FilterType, label: t('all', 'All'), count: (drivers || []).length },
                { key: 'active' as FilterType, label: t('active', 'Active'), count: (drivers || []).filter(d => d.is_active).length },
                { key: 'inactive' as FilterType, label: t('inactive', 'Inactive'), count: (drivers || []).filter(d => !d.is_active).length },
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
              
              <View style={styles.filterDivider} />
              
              {[
                { key: 'all' as StatusFilterType, label: t('allStatus', 'All Status') },
                { key: 'available' as StatusFilterType, label: t('available', 'Available') },
                { key: 'busy' as StatusFilterType, label: t('busy', 'Busy') },
                { key: 'offline' as StatusFilterType, label: t('offline', 'Offline') },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterTab, statusFilter === tab.key && styles.filterTabActive]}
                  onPress={() => setStatusFilter(tab.key)}
                >
                  <Text style={[styles.filterTabText, statusFilter === tab.key && styles.filterTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {isLoading ? (
            <ListSkeleton count={4} type="card" />
          ) : (filteredDrivers || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Car size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>{t('noDriversYet', 'No drivers yet')}</Text>
              <Text style={styles.emptySubtitle}>{t('addDriversForDeliveries', 'Add drivers for in-house deliveries')}</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => handleOpenModal()}>
                <Plus size={18} color={colors.background} />
                <Text style={styles.emptyButtonText}>{t('addDriver', 'Add Driver')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.driverGrid}>
              {(filteredDrivers || []).map((driver) => (
                <DriverCard key={driver.id} driver={driver} />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Add/Edit Modal */}
      <BaseModal
        visible={isModalOpen}
        onClose={handleCloseModal}
        title={editingDriver ? t('editDriver', 'Edit Driver') : t('addDriver', 'Add Driver')}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('nameEnglish', 'Name (English)')} *
          </Text>
          <TextInput
            style={[styles.formInput, isRTL && styles.textRTL]}
            value={name}
            onChangeText={setName}
            placeholder={t('driverName', 'Driver name')}
            placeholderTextColor={colors.mutedForeground}
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('nameArabic', 'Name (Arabic)')}
          </Text>
          <TextInput
            style={[styles.formInput, { textAlign: 'right' }]}
            value={nameAr}
            onChangeText={setNameAr}
            placeholder={t('arabicName', 'Arabic name')}
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('phoneNumber', 'Phone Number')}
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

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('email', 'Email')}
          </Text>
          <TextInput
            style={styles.formInput}
            value={email}
            onChangeText={setEmail}
            placeholder="driver@example.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('vehicleType', 'Vehicle Type')}
          </Text>
          <View style={[styles.vehicleButtons, isRTL && styles.vehicleButtonsRTL]}>
            {vehicleTypes.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.vehicleButton, vehicleType === v.id && styles.vehicleButtonActive]}
                onPress={() => setVehicleType(vehicleType === v.id ? '' : v.id)}
              >
                <Text style={[styles.vehicleButtonText, vehicleType === v.id && styles.vehicleButtonTextActive]}>
                  {v.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('vehicleNumber', 'Vehicle Number')}
          </Text>
          <TextInput
            style={[styles.formInput, isRTL && styles.textRTL]}
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            placeholder={t('licensePlate', 'License plate')}
            placeholderTextColor={colors.mutedForeground}
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

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
                : editingDriver
                  ? t('update', 'Update')
                  : t('create', 'Create')}
            </Text>
          </TouchableOpacity>
        </View>
      </BaseModal>
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
  filterScrollView: {
    maxHeight: 50,
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
  filterDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: 8,
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
  driverGrid: {
    gap: 12,
    paddingHorizontal: 16,
  },
  driverCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverCardInactive: {
    opacity: 0.6,
  },
  driverCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverCardHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  driverIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  driverVehicle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contactInfo: {
    marginTop: 12,
    gap: 6,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactItemRTL: {
    flexDirection: 'row-reverse',
  },
  contactText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  quickStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  quickStatusRTL: {
    flexDirection: 'row-reverse',
  },
  quickStatusLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  quickStatusButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  driverActionsRTL: {
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
  // Form styles (used in BaseModal content)
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
  formGroup: {
    marginBottom: 16,
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
  vehicleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleButtonsRTL: {
    flexDirection: 'row-reverse',
  },
  vehicleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleButtonActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  vehicleButtonText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  vehicleButtonTextActive: {
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


