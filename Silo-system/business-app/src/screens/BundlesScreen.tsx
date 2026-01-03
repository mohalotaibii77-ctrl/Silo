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
  Alert,
  Image
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import { ListSkeleton } from '../components/SkeletonLoader';
import { BaseModal } from '../components/BaseModal';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Trash2,
  Boxes,
  Package
} from 'lucide-react-native';

// Types
interface BundleProduct {
  id: number;
  name: string;
  name_ar?: string;
  price: number;
  image_url?: string;
}

interface BundleItem {
  id: number;
  bundle_id: number;
  product_id: number;
  quantity: number;
  product?: BundleProduct;
}

interface Bundle {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: BundleItem[];
}

interface BundleStats {
  sold: number;
  total_cost: number;
}

export default function BundlesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, isRTL, formatCurrency } = useLocalization();
  
  // State
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleStats, setBundleStats] = useState<Record<number, BundleStats>>({});
  const [filteredBundles, setFilteredBundles] = useState<Bundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detail modal
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load bundles with cache-first pattern
  const loadBundles = useCallback(async (forceRefresh = false) => {
    const cacheKey = CacheKeys.bundles();
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<{ bundles: Bundle[], stats: Record<number, BundleStats> }>(cacheKey);
      // Ensure cached data has valid structure
      if (cached && cached.bundles && Array.isArray(cached.bundles)) {
        setBundles(cached.bundles);
        setBundleStats(cached.stats || {});
        setIsLoading(false);
        // Refresh in background
        Promise.all([
          api.get('/bundles'),
          api.get('/bundles/stats').catch(() => ({ data: { data: {} } }))
        ]).then(([bundlesResponse, statsResponse]) => {
          const newBundles = Array.isArray(bundlesResponse.data.data) ? bundlesResponse.data.data : [];
          const newStats = statsResponse.data.data || {};
          if (JSON.stringify(newBundles) !== JSON.stringify(cached.bundles)) {
            setBundles(newBundles);
            setBundleStats(newStats);
            cacheManager.set(cacheKey, { bundles: newBundles, stats: newStats }, CACHE_TTL.MEDIUM);
          }
        }).catch(() => {}).finally(() => setRefreshing(false));
        return;
      }
    }
    
    try {
      const [bundlesResponse, statsResponse] = await Promise.all([
        api.get('/bundles'),
        api.get('/bundles/stats').catch(() => ({ data: { data: {} } }))
      ]);
      const bundlesData = Array.isArray(bundlesResponse.data.data) ? bundlesResponse.data.data : [];
      const stats = statsResponse.data.data || {};
      setBundles(bundlesData);
      setBundleStats(stats);
      await cacheManager.set(cacheKey, { bundles: bundlesData, stats }, CACHE_TTL.MEDIUM);
    } catch (err) {
      console.error('Failed to load bundles:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBundles(false); // Use cache if available
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [loadBundles]);

  // Filter bundles
  useEffect(() => {
    let filtered = bundles || [];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.name.toLowerCase().includes(query) ||
        b.name_ar?.toLowerCase().includes(query)
      );
    }
    
    setFilteredBundles(filtered);
  }, [bundles, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBundles(true); // Force refresh on pull-to-refresh
  }, [loadBundles]);

  const handleDelete = (bundle: Bundle) => {
    Alert.alert(
      t('confirmDelete', 'Confirm Delete'),
      t('confirmDeleteBundle', 'Are you sure you want to delete this bundle?'),
      [
        { text: t('cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/bundles/${bundle.id}`);
              await cacheManager.invalidate(CacheKeys.bundles());
              loadBundles(true); // Force refresh after mutation
              if (selectedBundle?.id === bundle.id) {
                setSelectedBundle(null);
              }
            } catch (err: any) {
              Alert.alert(t('error', 'Error'), err.response?.data?.error || t('failedToDeleteBundle', 'Failed to delete bundle'));
            }
          }
        }
      ]
    );
  };

  // original_price, savings_amount, savings_percent now come from backend API
  // No local calculation needed

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Render bundle card
  const BundleCard = ({ bundle, index }: { bundle: Bundle; index: number }) => {
    // Use values from backend API - no frontend calculations
    const originalPrice = (bundle as any).original_price || 0;
    const savings = (bundle as any).savings_amount || 0;
    const stats = bundleStats[bundle.id];
    const totalCost = stats?.total_cost || 0;
    // margin_percent comes from backend bundleStats
    const margin = stats?.margin_percent ?? 0; // Backend provides margin, default to 0 if unavailable
    const sold = stats?.sold || 0;

    return (
      <TouchableOpacity 
        style={[styles.bundleCard, !bundle.is_active && styles.bundleCardInactive]}
        onPress={() => setSelectedBundle(bundle)}
      >
        {/* Bundle Image */}
        <View style={styles.bundleImageContainer}>
          {bundle.image_url ? (
            <Image source={{ uri: bundle.image_url }} style={styles.bundleImage} />
          ) : (
            <View style={styles.bundleImagePlaceholder}>
              <Boxes size={32} color={colors.border} />
            </View>
          )}
          
          {/* Savings badge */}
          {savings > 0 && (
            <View style={[styles.savingsBadge, isRTL ? { left: 8 } : { right: 8 }]}>
              <Text style={styles.savingsBadgeText}>
                {t('save', 'Save')} {formatCurrency(savings)}
              </Text>
            </View>
          )}
          
          {/* Inactive badge */}
          {!bundle.is_active && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>{t('inactive', 'Inactive')}</Text>
            </View>
          )}
        </View>

        {/* Bundle Info */}
        <View style={styles.bundleInfo}>
          <Text style={[styles.bundleName, isRTL && styles.textRTL]} numberOfLines={1}>
            {isRTL ? bundle.name_ar || bundle.name : bundle.name}
          </Text>
          <Text style={[styles.bundleItems, isRTL && styles.textRTL]}>
            {bundle.items?.length || 0} {t('products', 'products')}
          </Text>
          
          <View style={[styles.bundlePricing, isRTL && styles.bundlePricingRTL]}>
            <Text style={styles.bundlePrice}>{formatCurrency(bundle.price)}</Text>
            {originalPrice > bundle.price && (
              <Text style={styles.bundleOriginalPrice}>{formatCurrency(originalPrice)}</Text>
            )}
          </View>
          
          {/* Stats */}
          <View style={[styles.bundleStats, isRTL && styles.bundleStatsRTL]}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('sold', 'Sold')}:</Text>
              <Text style={styles.statValue}>{sold}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('margin', 'Margin')}:</Text>
              <Text style={[
                styles.statValue,
                margin >= 30 ? styles.marginGood : margin >= 15 ? styles.marginOk : styles.marginLow
              ]}>
                {margin.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerTop, isRTL && styles.headerTopRTL]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => safeGoBack(navigation)}
          >
            <BackIcon size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{t('bundles', 'Bundles')}</Text>
            <Text style={[styles.headerSubtitle, isRTL && styles.textRTL]}>{t('productBundlesSoldTogether', 'Product bundles sold together')}</Text>
          </View>
          <View style={styles.headerActions} />
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, isRTL && styles.searchContainerRTL]}>
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, isRTL && styles.textRTL]}
            placeholder={t('searchBundles', 'Search bundles...')}
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

      {/* Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <ListSkeleton count={4} type="bundle" />
          ) : (filteredBundles || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Boxes size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>{t('noBundlesYet', 'No bundles yet')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('createFirstBundle', 'Create your first bundle by combining 2 or more products')}
              </Text>
            </View>
          ) : (
            <View style={styles.bundleGrid}>
              {(filteredBundles || []).map((bundle, index) => (
                <BundleCard key={bundle.id} bundle={bundle} index={index} />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Bundle Detail Modal */}
      <BaseModal
        visible={!!selectedBundle}
        onClose={() => setSelectedBundle(null)}
        title={selectedBundle ? (isRTL ? selectedBundle.name_ar || selectedBundle.name : selectedBundle.name) : ''}
        subtitle={selectedBundle ? `${selectedBundle.items?.length || 0} ${t('products', 'products')}` : ''}
      >
        {selectedBundle && (
          <>
            {/* Bundle Image */}
            <View style={styles.modalImageContainer}>
              {selectedBundle.image_url ? (
                <Image source={{ uri: selectedBundle.image_url }} style={styles.modalImage} />
              ) : (
                <View style={styles.modalImagePlaceholder}>
                  <Boxes size={48} color={colors.border} />
                </View>
              )}
            </View>

            {/* Price Row */}
            <View style={[styles.priceRow, isRTL && styles.priceRowRTL]}>
              <Text style={styles.modalPrice}>{formatCurrency(selectedBundle.price)}</Text>
              {((selectedBundle as any).original_price || 0) > selectedBundle.price && (
                <Text style={styles.modalOriginalPrice}>
                  {formatCurrency((selectedBundle as any).original_price || 0)}
                </Text>
              )}
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statsItem}>
                <Text style={styles.statsValue}>{bundleStats[selectedBundle.id]?.sold || 0}</Text>
                <Text style={styles.statsLabel}>{t('sold', 'Sold')}</Text>
              </View>
              <View style={styles.statsItemDivider} />
              <View style={styles.statsItem}>
                {(() => {
                  const stats = bundleStats[selectedBundle.id];
                  const margin = stats?.margin_percent ?? 0;
                  return (
                    <>
                      <Text style={[
                        styles.statsValue,
                        margin >= 30 ? styles.marginGood : margin >= 15 ? styles.marginOk : styles.marginLow
                      ]}>
                        {margin.toFixed(1)}%
                      </Text>
                      <Text style={styles.statsLabel}>{t('margin', 'Margin')}</Text>
                    </>
                  );
                })()}
              </View>
              <View style={styles.statsItemDivider} />
              <View style={styles.statsItem}>
                <Text style={styles.statsValue}>
                  {formatCurrency(bundleStats[selectedBundle.id]?.total_cost || 0)}
                </Text>
                <Text style={styles.statsLabel}>{t('cost', 'Cost')}</Text>
              </View>
            </View>

            {/* Products in Bundle */}
            <View style={styles.productsSection}>
              <View style={[styles.productsSectionHeader, isRTL && styles.productsSectionHeaderRTL]}>
                <Package size={16} color={colors.mutedForeground} />
                <Text style={styles.productsSectionTitle}>{t('productsInBundle', 'Products in Bundle')}</Text>
              </View>

              {selectedBundle.items && selectedBundle.items.length > 0 ? (
                <View style={styles.productsList}>
                  {selectedBundle.items.map((item) => (
                    <View key={item.id} style={[styles.productItem, isRTL && styles.productItemRTL]}>
                      <View style={[styles.productItemLeft, isRTL && styles.productItemLeftRTL]}>
                        <View style={styles.productImage}>
                          {item.product?.image_url ? (
                            <Image source={{ uri: item.product.image_url }} style={styles.productImageImg} />
                          ) : (
                            <Package size={20} color={colors.border} />
                          )}
                        </View>
                        <View style={[styles.productItemInfo, isRTL && { alignItems: 'flex-end' }]}>
                          <Text style={[styles.productItemName, isRTL && styles.textRTL]}>
                            {isRTL ? item.product?.name_ar || item.product?.name : item.product?.name}
                          </Text>
                          <Text style={styles.productItemPrice}>
                            {formatCurrency(item.product?.price || 0)} x {item.quantity}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.productItemTotal}>
                        {formatCurrency((item.product?.price || 0) * item.quantity)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noProductsText}>
                  {t('noProductsInBundle', 'No products in this bundle')}
                </Text>
              )}
            </View>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, isRTL && styles.modalFooterRTL]}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(selectedBundle)}
              >
                <Trash2 size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </>
        )}
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
  headerActions: {
    width: 40,
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
  bundleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  bundleCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bundleCardInactive: {
    opacity: 0.6,
  },
  bundleImageContainer: {
    aspectRatio: 1,
    backgroundColor: colors.background,
    position: 'relative',
  },
  bundleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bundleImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingsBadge: {
    position: 'absolute',
    top: 8,
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.background,
  },
  inactiveBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: colors.mutedForeground + 'E0',
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.background,
  },
  bundleInfo: {
    padding: 12,
  },
  bundleName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  bundleItems: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  bundlePricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  bundlePricingRTL: {
    flexDirection: 'row-reverse',
  },
  bundlePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  bundleOriginalPrice: {
    fontSize: 12,
    color: colors.mutedForeground,
    textDecorationLine: 'line-through',
  },
  bundleStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  bundleStatsRTL: {
    flexDirection: 'row-reverse',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  statValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },
  marginGood: {
    color: colors.success,
  },
  marginOk: {
    color: colors.warning,
  },
  marginLow: {
    color: colors.destructive,
  },
  textRTL: {
    textAlign: 'right',
  },
  // Modal content styles
  modalImageContainer: {
    height: 160,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  priceRowRTL: {
    flexDirection: 'row-reverse',
  },
  modalPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  modalOriginalPrice: {
    fontSize: 12,
    color: colors.mutedForeground,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsItem: {
    alignItems: 'center',
  },
  statsItemDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  statsLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  productsSection: {
    marginTop: 8,
  },
  productsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  productsSectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  productsSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  productsList: {
    gap: 8,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productItemRTL: {
    flexDirection: 'row-reverse',
  },
  productItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  productItemLeftRTL: {
    flexDirection: 'row-reverse',
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImageImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productItemInfo: {
    flex: 1,
  },
  productItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  productItemPrice: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  productItemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  noProductsText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  modalFooterRTL: {
    flexDirection: 'row-reverse',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.destructive + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
});


