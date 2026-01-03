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
import { SectionSkeleton } from '../components/SkeletonLoader';
import { 
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Plus,
  Edit2,
  Trash2,
  Armchair,
  Users,
  Hash,
  MapPin,
  CheckCircle,
  XCircle
} from 'lucide-react-native';

// Types
interface RestaurantTable {
  id: number;
  business_id: number;
  branch_id: number;
  table_number: string;
  table_code?: string | null;
  seats: number;
  zone?: string | null;
  description?: string | null;
  is_active: boolean;
  is_occupied: boolean;
  current_order_id?: number | null;
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'active' | 'inactive';

export default function TablesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, isRTL } = useLocalization();
  
  // State
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [filteredTables, setFilteredTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [tableCode, setTableCode] = useState('');
  const [seats, setSeats] = useState('2');
  const [zone, setZone] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Common zones
  const commonZones = [
    { id: 'indoor', name: t('indoor', 'Indoor') },
    { id: 'outdoor', name: t('outdoor', 'Outdoor') },
    { id: 'patio', name: t('patio', 'Patio') },
    { id: 'vip', name: t('vip', 'VIP') },
    { id: 'private', name: t('private', 'Private') },
    { id: 'terrace', name: t('terrace', 'Terrace') },
  ];

  // Load tables with cache-first pattern
  const loadTables = useCallback(async (forceRefresh = false) => {
    const cacheKey = CacheKeys.tables();
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<RestaurantTable[]>(cacheKey);
      // Ensure cached data is a valid array
      if (cached && Array.isArray(cached)) {
        setTables(cached);
        setIsLoading(false);
        // Refresh in background
        api.get('/tables')
          .then(response => {
            const fresh = response.data.data || [];
            if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
              setTables(fresh);
              cacheManager.set(cacheKey, fresh, CACHE_TTL.MEDIUM);
            }
          })
          .catch(() => {})
          .finally(() => setRefreshing(false));
        return;
      }
    }
    
    try {
      const response = await api.get('/tables');
      const data = response.data.data || [];
      setTables(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.MEDIUM);
    } catch (err) {
      console.error('Failed to load tables:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTables(false); // Use cache if available
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [loadTables]);

  // Filter tables
  useEffect(() => {
    let filtered = tables || [];
    
    if (filter === 'active') {
      filtered = filtered.filter(t => t.is_active);
    } else if (filter === 'inactive') {
      filtered = filtered.filter(t => !t.is_active);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.table_number.toLowerCase().includes(query) ||
        t.zone?.toLowerCase().includes(query)
      );
    }
    
    setFilteredTables(filtered);
  }, [tables, filter, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTables(true); // Force refresh on pull-to-refresh
  }, [loadTables]);

  // Modal handlers
  const handleOpenModal = (table?: RestaurantTable) => {
    if (table) {
      setEditingTable(table);
      setTableNumber(table.table_number);
      setTableCode(table.table_code || '');
      setSeats(table.seats.toString());
      setZone(table.zone || '');
      setDescription(table.description || '');
    } else {
      setEditingTable(null);
      setTableNumber('');
      setTableCode('');
      setSeats('2');
      setZone('');
      setDescription('');
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTable(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!tableNumber.trim()) {
      setError(t('tableNumberRequired', 'Table number is required'));
      return;
    }
    if (!seats || parseInt(seats) < 1) {
      setError(t('seatsAtLeast1', 'Number of seats must be at least 1'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingTable) {
        await api.put(`/tables/${editingTable.id}`, {
          table_number: tableNumber.trim(),
          table_code: tableCode.trim() || undefined,
          seats: parseInt(seats),
          zone: zone || undefined,
          description: description.trim() || undefined,
        });
      } else {
        await api.post('/tables', {
          table_number: tableNumber.trim(),
          table_code: tableCode.trim() || undefined,
          seats: parseInt(seats),
          zone: zone || undefined,
          description: description.trim() || undefined,
        });
      }
      handleCloseModal();
      await cacheManager.invalidate(CacheKeys.tables());
      loadTables(true); // Force refresh after mutation
    } catch (err: any) {
      setError(err.response?.data?.error || t('failedToSaveTable', 'Failed to save table'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (table: RestaurantTable) => {
    try {
      await api.put(`/tables/${table.id}`, { is_active: !table.is_active });
      await cacheManager.invalidate(CacheKeys.tables());
      loadTables(true); // Force refresh after mutation
    } catch (err) {
      console.error('Failed to toggle table status:', err);
    }
  };

  const handleDelete = (table: RestaurantTable) => {
    Alert.alert(
      t('confirmDelete', 'Confirm Delete'),
      t('confirmDeleteTable', 'Are you sure you want to delete this table?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/tables/${table.id}`);
              await cacheManager.invalidate(CacheKeys.tables());
              loadTables(true); // Force refresh after mutation
            } catch (err: any) {
              Alert.alert(t('error', 'Error'), err.response?.data?.error || t('failedToDeleteTable', 'Failed to delete table'));
            }
          }
        }
      ]
    );
  };

  // Group tables by zone
  const tablesByZone = (filteredTables || []).reduce((acc, table) => {
    const zoneKey = table.zone || t('noZone', 'No Zone');
    if (!acc[zoneKey]) acc[zoneKey] = [];
    acc[zoneKey].push(table);
    return acc;
  }, {} as Record<string, RestaurantTable[]>);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Render filter tabs
  const FilterTabs = () => (
    <View style={[styles.filterContainer, isRTL && styles.filterContainerRTL]}>
      {[
        { key: 'all' as FilterType, label: t('all', 'All'), count: (tables || []).length },
        { key: 'active' as FilterType, label: t('active', 'Active'), count: (tables || []).filter(t => t.is_active).length },
        { key: 'inactive' as FilterType, label: t('inactive', 'Inactive'), count: (tables || []).filter(t => !t.is_active).length },
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
  );

  // Render table card
  const TableCard = ({ table }: { table: RestaurantTable }) => (
    <View style={[
      styles.tableCard,
      !table.is_active && styles.tableCardInactive,
      table.is_occupied && styles.tableCardOccupied
    ]}>
      <View style={[styles.tableCardHeader, isRTL && styles.tableCardHeaderRTL]}>
        <View style={[styles.tableIcon, 
          table.is_occupied ? styles.tableIconOccupied : 
          table.is_active ? styles.tableIconActive : styles.tableIconInactive
        ]}>
          <Armchair 
            size={24} 
            color={
              table.is_occupied ? colors.warning :
              table.is_active ? colors.success : colors.mutedForeground
            } 
          />
        </View>
        <View style={[styles.tableInfo, isRTL && { alignItems: 'flex-end' }]}>
          <Text style={[styles.tableNumber, isRTL && styles.textRTL]}>{table.table_number}</Text>
          <View style={[styles.tableSeats, isRTL && styles.tableSeatsRTL]}>
            <Users size={14} color={colors.mutedForeground} />
            <Text style={styles.tableSeatsText}>{table.seats} {t('seats', 'seats')}</Text>
          </View>
        </View>
        {table.is_occupied && (
          <View style={styles.occupiedBadge}>
            <Text style={styles.occupiedBadgeText}>{t('occupied', 'Occupied')}</Text>
          </View>
        )}
      </View>

      {table.table_code && (
        <View style={[styles.tableCode, isRTL && styles.tableCodeRTL]}>
          <Hash size={12} color={colors.mutedForeground} />
          <Text style={styles.tableCodeText}>{table.table_code}</Text>
        </View>
      )}

      {table.description && (
        <Text style={[styles.tableDescription, isRTL && styles.textRTL]} numberOfLines={1}>
          {table.description}
        </Text>
      )}

      <View style={[styles.tableActions, isRTL && styles.tableActionsRTL]}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleToggleActive(table)}
        >
          {table.is_active ? (
            <XCircle size={16} color={colors.warning} />
          ) : (
            <CheckCircle size={16} color={colors.success} />
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleOpenModal(table)}
        >
          <Edit2 size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(table)}
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
                <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{t('tables', 'Tables')}</Text>
                <Text style={[styles.headerSubtitle, isRTL && styles.textRTL]}>{t('manageDineInTables', 'Manage dine-in tables')}</Text>
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
                placeholder={t('searchTables', 'Search tables...')}
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
          <FilterTabs />
          {isLoading ? (
            <>
              <SectionSkeleton showHeader={true} itemCount={4} type="grid" />
              <SectionSkeleton showHeader={true} itemCount={2} type="grid" />
            </>
          ) : (filteredTables || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Armchair size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>{t('noTablesYet', 'No tables yet')}</Text>
              <Text style={styles.emptySubtitle}>{t('addTablesForDineIn', 'Add tables for dine-in seating')}</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => handleOpenModal()}>
                <Plus size={18} color={colors.background} />
                <Text style={styles.emptyButtonText}>{t('addTable', 'Add Table')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {Object.entries(tablesByZone).map(([zoneName, zoneTables]) => (
                <View key={zoneName} style={styles.section}>
                  <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
                    <MapPin size={16} color={colors.mutedForeground} />
                    <Text style={styles.sectionTitle}>{zoneName}</Text>
                  </View>
                  <View style={styles.tableGrid}>
                    {zoneTables.map((table) => (
                      <TableCard key={table.id} table={table} />
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Add/Edit Modal */}
      <BaseModal
        visible={isModalOpen}
        onClose={handleCloseModal}
        title={editingTable ? t('editTable', 'Edit Table') : t('addTable', 'Add Table')}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('tableNumberCode', 'Table Number/Code')} *
          </Text>
          <TextInput
            style={[styles.formInput, isRTL && styles.textRTL]}
            value={tableNumber}
            onChangeText={setTableNumber}
            placeholder={t('egT1A5VIP1', 'e.g., T1, A5, VIP-1')}
            placeholderTextColor={colors.mutedForeground}
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('numberOfSeats', 'Number of Seats')} *
          </Text>
          <TextInput
            style={[styles.formInput, isRTL && styles.textRTL]}
            value={seats}
            onChangeText={(text) => setSeats(text.replace(/[^0-9]/g, ''))}
            placeholder="2"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('zoneArea', 'Zone/Area')}
          </Text>
          <View style={[styles.zoneButtons, isRTL && styles.zoneButtonsRTL]}>
            {commonZones.map((z) => (
              <TouchableOpacity
                key={z.id}
                style={[styles.zoneButton, zone === z.id && styles.zoneButtonActive]}
                onPress={() => setZone(zone === z.id ? '' : z.id)}
              >
                <Text style={[styles.zoneButtonText, zone === z.id && styles.zoneButtonTextActive]}>
                  {z.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('qrBarcode', 'QR/Barcode')}
          </Text>
          <TextInput
            style={[styles.formInput, isRTL && styles.textRTL]}
            value={tableCode}
            onChangeText={setTableCode}
            placeholder={t('optionalUniqueIdentifier', 'Optional unique identifier')}
            placeholderTextColor={colors.mutedForeground}
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, isRTL && styles.textRTL]}>
            {t('description', 'Description')}
          </Text>
          <TextInput
            style={[styles.formInput, styles.formTextarea, isRTL && styles.textRTL]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('egNearWindowCornerTable', 'e.g., Near window, corner table')}
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={2}
            textAlign={isRTL ? 'right' : 'left'}
            textAlignVertical="top"
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
                : editingTable
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
  section: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tableCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableCardInactive: {
    opacity: 0.6,
  },
  tableCardOccupied: {
    borderColor: colors.warning,
    borderWidth: 2,
  },
  tableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tableCardHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  tableIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableIconActive: {
    backgroundColor: colors.success + '20',
  },
  tableIconInactive: {
    backgroundColor: colors.surface,
  },
  tableIconOccupied: {
    backgroundColor: colors.warning + '20',
  },
  tableInfo: {
    flex: 1,
  },
  tableNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  tableSeats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tableSeatsRTL: {
    flexDirection: 'row-reverse',
  },
  tableSeatsText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  occupiedBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  occupiedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.warning,
  },
  tableCode: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  tableCodeRTL: {
    flexDirection: 'row-reverse',
  },
  tableCodeText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  tableDescription: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  tableActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  tableActionsRTL: {
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
  formTextarea: {
    height: 60,
    textAlignVertical: 'top',
  },
  zoneButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneButtonsRTL: {
    flexDirection: 'row-reverse',
  },
  zoneButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoneButtonActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  zoneButtonText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  zoneButtonTextActive: {
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


