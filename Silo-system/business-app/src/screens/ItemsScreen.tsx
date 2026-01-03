import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  RefreshControl,
  Animated,
  Dimensions
} from 'react-native';
import { BaseModal } from '../components/BaseModal';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { useConfig } from '../context/ConfigContext';
import { safeGoBack } from '../utils/navigationHelpers';
import {
  Package,
  Layers,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  Check,
  Play,
  Calendar,
  Eye,
  DollarSign,
  Info,
  Barcode,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Types
interface Item {
  id: number;
  business_id: number | null;
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  item_type?: string;
  category: string;
  unit: string;
  storage_unit?: string | null;
  cost_per_unit: number;
  business_price?: number | null;
  effective_price?: number;
  is_system_item: boolean;
  is_composite: boolean;
  batch_quantity?: number | null;
  batch_unit?: string | null;
  status: 'active' | 'inactive';
}

interface ProductionTemplate {
  id: number;
  name: string;
  name_ar?: string;
  composite_item_id: number;
  composite_item?: Item;
  default_batch_count: number;
}

interface Production {
  id: number;
  composite_item_id: number;
  composite_item?: Item;
  batch_count: number;
  total_yield: number;
  yield_unit: string;
  production_date: string;
  status: string;
}

type TabType = 'raw' | 'composite' | 'production';

// Skeleton component
const Skeleton = ({ width: w, height, borderRadius = 8, style, colors }: { width: number | string; height: number; borderRadius?: number; style?: any; colors: ThemeColors }) => {
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

const ItemSkeleton = ({ styles, colors }: { styles: any; colors: ThemeColors }) => (
  <View style={styles.itemCard}>
    <View style={styles.itemCardContent}>
      <Skeleton width={44} height={44} borderRadius={12} colors={colors} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} colors={colors} />
        <Skeleton width="40%" height={12} colors={colors} />
      </View>
      <Skeleton width={60} height={20} borderRadius={6} colors={colors} />
    </View>
  </View>
);

export default function ItemsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const modalStyles = createModalStyles(colors);
  const { t, isRTL, language, formatCurrency, currency } = useLocalization();
  const { config, getCategoryLabel, getCompatibleStorageUnits, getDefaultStorageUnit } = useConfig();
  
  // Get categories and units from config (with fallbacks)
  const itemCategories = config?.itemCategories || [];
  const servingUnits = config?.servingUnits || [];
  const storageUnits = config?.storageUnits || [];
  
  const [activeTab, setActiveTab] = useState<TabType>('raw');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterItemType, setFilterItemType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Items state
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  
  // Composite items state
  const [compositeItems, setCompositeItems] = useState<Item[]>([]);
  const [compositeLoading, setCompositeLoading] = useState(true);
  
  // Production state
  const [templates, setTemplates] = useState<ProductionTemplate[]>([]);
  const [productions, setProductions] = useState<Production[]>([]);
  const [productionLoading, setProductionLoading] = useState(true);
  const [productionStats, setProductionStats] = useState({ today: 0, week: 0 });
  const [producingTemplateId, setProducingTemplateId] = useState<number | null>(null);
  
  // Modal states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddCompositeModal, setShowAddCompositeModal] = useState(false);
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ProductionTemplate | null>(null);
  const [viewingItem, setViewingItem] = useState<Item | null>(null);
  const [showViewItemModal, setShowViewItemModal] = useState(false);
  const [barcodeItem, setBarcodeItem] = useState<Item | null>(null);

  useEffect(() => {
    // Use cache-first approach - show cached data instantly, refresh in background
    loadData(false);
  }, []);

  // Refetch items when item type filter changes
  useEffect(() => {
    fetchItems(false); // Use cache if available for this filter
    setFilterCategory('all'); // Reset category when type changes
  }, [filterItemType]);

  const loadData = async (forceRefresh = false) => {
    await Promise.all([
      fetchItems(forceRefresh),
      fetchCompositeItems(forceRefresh),
      fetchProductionData(forceRefresh),
    ]);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true).finally(() => setRefreshing(false)); // Force refresh on pull-to-refresh
  }, []);

  const fetchItems = async (forceRefresh = false) => {
    const cacheKey = CacheKeys.rawItems(filterItemType);
    
    // Check cache first to avoid skeleton flash
    if (!forceRefresh) {
      const cached = await cacheManager.get<Item[]>(cacheKey);
      // Ensure cached data is a valid array
      if (cached && Array.isArray(cached)) {
        setItems(cached);
        setItemsLoading(false);
        // Refresh in background - fetch all items (no pagination limit)
        const bgParams = new URLSearchParams();
        bgParams.append('limit', '1000');
        if (filterItemType !== 'all') bgParams.append('item_type', filterItemType);
        api.get(`/inventory/items?${bgParams.toString()}`)
          .then(response => {
            const allItems = response.data.data || [];
            const filtered = (Array.isArray(allItems) ? allItems : []).filter((item: Item) => !item.is_composite && item.status === 'active');
            if (JSON.stringify(filtered) !== JSON.stringify(cached)) {
              setItems(filtered);
              cacheManager.set(cacheKey, filtered, CACHE_TTL.MEDIUM);
            }
          }).catch(() => {});
        return;
      }
    }
    
    setItemsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '1000'); // Fetch all items (no pagination limit)
      if (filterItemType !== 'all') params.append('item_type', filterItemType);
      const response = await api.get(`/inventory/items?${params.toString()}`);
      const allItems = response.data.data || [];
      const filtered = (Array.isArray(allItems) ? allItems : []).filter((item: Item) => !item.is_composite && item.status === 'active');
      setItems(filtered);
      await cacheManager.set(cacheKey, filtered, CACHE_TTL.MEDIUM);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchCompositeItems = async (forceRefresh = false) => {
    const cacheKey = CacheKeys.compositeItems();
    
    // Check cache first
    if (!forceRefresh) {
      const cached = await cacheManager.get<Item[]>(cacheKey);
      // Ensure cached data is a valid array
      if (cached && Array.isArray(cached)) {
        setCompositeItems(cached);
        setCompositeLoading(false);
        // Refresh in background using dedicated composite items endpoint
        api.get('/inventory/composite-items')
          .then(response => {
            const compositeItems = response.data.data || [];
            if (JSON.stringify(compositeItems) !== JSON.stringify(cached)) {
              setCompositeItems(Array.isArray(compositeItems) ? compositeItems : []);
              cacheManager.set(cacheKey, compositeItems, CACHE_TTL.MEDIUM);
            }
          }).catch(() => {});
        return;
      }
    }
    
    setCompositeLoading(true);
    try {
      // Use dedicated composite items endpoint
      const response = await api.get('/inventory/composite-items');
      const compositeItems = response.data.data || [];
      setCompositeItems(Array.isArray(compositeItems) ? compositeItems : []);
      await cacheManager.set(cacheKey, compositeItems, CACHE_TTL.MEDIUM);
    } catch (error) {
      console.error('🔴 [COMPOSITE] Error fetching composite items:', error);
    } finally {
      setCompositeLoading(false);
    }
  };

  const fetchProductionData = async (forceRefresh = false) => {
    const cacheKey = CacheKeys.productionData();
    
    // Check cache first
    if (!forceRefresh) {
      const cached = await cacheManager.get<{templates: ProductionTemplate[], productions: Production[], stats: {today: number, week: number}}>(cacheKey);
      // Ensure cached data has valid structure
      if (cached && cached.templates && cached.productions && cached.stats) {
        setTemplates(Array.isArray(cached.templates) ? cached.templates : []);
        setProductions(Array.isArray(cached.productions) ? cached.productions : []);
        setProductionStats(cached.stats || { today: 0, week: 0 });
        setProductionLoading(false);
        // Refresh in background
        Promise.all([
          api.get('/inventory/production/templates').catch(() => ({ data: { templates: [] } })),
          api.get('/inventory/production?limit=10').catch(() => ({ data: { productions: [] } })),
          api.get('/inventory/production/stats').catch(() => ({ data: { today_count: 0, week_count: 0 } })),
        ]).then(([templatesRes, productionsRes, statsRes]) => {
          const newData = {
            templates: templatesRes.data.templates || [],
            productions: productionsRes.data.productions || [],
            stats: {
              today: statsRes.data.today_count || 0,
              week: statsRes.data.week_count || 0,
            }
          };
          if (JSON.stringify(newData) !== JSON.stringify(cached)) {
            setTemplates(Array.isArray(newData.templates) ? newData.templates : []);
            setProductions(Array.isArray(newData.productions) ? newData.productions : []);
            setProductionStats(newData.stats);
            cacheManager.set(cacheKey, newData, CACHE_TTL.SHORT);
          }
        }).catch(() => {});
        return;
      }
    }
    
    setProductionLoading(true);
    try {
      const [templatesRes, productionsRes, statsRes] = await Promise.all([
        api.get('/inventory/production/templates').catch(() => ({ data: { templates: [] } })),
        api.get('/inventory/production?limit=10').catch(() => ({ data: { productions: [] } })),
        api.get('/inventory/production/stats').catch(() => ({ data: { today_count: 0, week_count: 0 } })),
      ]);
      const newData = {
        templates: templatesRes.data.templates || [],
        productions: productionsRes.data.productions || [],
        stats: {
          today: statsRes.data.today_count || 0,
          week: statsRes.data.week_count || 0,
        }
      };
      setTemplates(newData.templates);
      setProductions(newData.productions);
      setProductionStats(newData.stats);
      await cacheManager.set(cacheKey, newData, CACHE_TTL.SHORT);
    } catch (error) {
      console.error('Error fetching production data:', error);
    } finally {
      setProductionLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    Alert.alert(
      t('deleteItem'),
      t('confirmDelete'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('deleteItem'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.put(`/inventory/items/${itemId}`, { status: 'inactive' });
              fetchItems();
              fetchCompositeItems();
              Alert.alert(t('success'), t('itemDeleted'));
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert(t('error'), 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  // Get category label from config context
  const getCategoryLabelLocal = (category: string) => {
    return getCategoryLabel(category, language as 'en' | 'ar');
  };

  // Filter items based on search and category
  const filteredItems = (items || []).filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.name_ar && item.name_ar.includes(searchQuery));
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredCompositeItems = (compositeItems || []).filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.name_ar && item.name_ar.includes(searchQuery));
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter templates based on search
  const filteredTemplates = (templates || []).filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.name_ar && template.name_ar.includes(searchQuery)) ||
    (template.composite_item?.name && template.composite_item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle produce button press - works directly with composite items
  const handleProduce = async (compositeItem: Item) => {
    setProducingTemplateId(compositeItem.id);
    const defaultBatchCount = 1; // Default to 1 batch
    
    try {
      // First check availability
      const availabilityResponse = await api.get('/inventory/production/check-availability', {
        params: {
          composite_item_id: compositeItem.id,
          batch_count: defaultBatchCount,
        }
      });
      
      const availability = availabilityResponse.data;
      
      if (!availability.canProduce) {
        // Not enough inventory - show detailed message
        const insufficientItems = availability.availability?.filter((a: any) => !a.is_sufficient) || [];
        const missingList = insufficientItems.map((ing: any) => 
          `• ${language === 'ar' && ing.item_name_ar ? ing.item_name_ar : ing.item_name}: ${t('need')} ${ing.required_quantity.toFixed(1)}, ${t('have')} ${ing.available_quantity.toFixed(1)} ${ing.unit}`
        ).join('\n');
        
        Alert.alert(
          t('insufficientInventory'),
          `${t('cannotProduceNotEnoughIngredients')}\n\n${missingList || t('checkInventoryLevels')}`,
          [{ text: t('ok'), style: 'default' }]
        );
        return;
      }
      
      const itemName = language === 'ar' && compositeItem.name_ar 
        ? compositeItem.name_ar 
        : compositeItem.name;
      const batchYield = `${compositeItem.batch_quantity || 1} ${compositeItem.batch_unit || compositeItem.unit}`;
      
      // Confirm production
      Alert.alert(
        t('confirmProduction'),
        `${t('produceConfirmMessage', { 
          count: defaultBatchCount, 
          name: itemName 
        })}\n\n${t('yield')}: ${batchYield}`,
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('produce'),
            style: 'default',
            onPress: async () => {
              try {
                await api.post('/inventory/production', {
                  composite_item_id: compositeItem.id,
                  batch_count: defaultBatchCount,
                });
                
                Alert.alert(t('success'), t('productionCompleted'));
                fetchProductionData(); // Refresh data
                fetchCompositeItems(); // Refresh composite items too
              } catch (error: any) {
                console.error('Production error:', error);
                Alert.alert(
                  t('error'),
                  error.response?.data?.error || t('failedToProduceItem')
                );
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Check availability error:', error);
      Alert.alert(
        t('error'),
        error.response?.data?.error || t('failedToCheckAvailability')
      );
    } finally {
      setProducingTemplateId(null);
    }
  };

  const renderTabs = () => (
    <View style={[styles.tabContainer, isRTL && styles.rtlRow]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'raw' && styles.tabActive]}
        onPress={() => setActiveTab('raw')}
      >
        <Package size={16} color={activeTab === 'raw' ? colors.background : colors.mutedForeground} />
        <Text style={[styles.tabText, activeTab === 'raw' && styles.tabTextActive]}>
          {t('rawItems')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'composite' && styles.tabActive]}
        onPress={() => setActiveTab('composite')}
      >
        <Layers size={16} color={activeTab === 'composite' ? colors.background : colors.mutedForeground} />
        <Text style={[styles.tabText, activeTab === 'composite' && styles.tabTextActive]}>
          {t('compositeItems')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'production' && styles.tabActive]}
        onPress={() => setActiveTab('production')}
      >
        <ClipboardList size={16} color={activeTab === 'production' ? colors.background : colors.mutedForeground} />
        <Text style={[styles.tabText, activeTab === 'production' && styles.tabTextActive]}>
          {t('production')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderItemCard = (item: Item, isComposite: boolean = false) => {
    return (
      <TouchableOpacity 
        key={item.id} 
        style={styles.itemCard}
        onPress={() => {
          setViewingItem(item);
          setShowViewItemModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.itemCardContent, isRTL && styles.rtlRow]}>
          {/* Left: Icon (only for composite) + Info */}
          <View style={[styles.itemLeft, isRTL && styles.rtlRow]}>
            {isComposite && (
              <View style={[styles.itemIcon, { backgroundColor: '#8b5cf615' }]}>
                <Layers size={18} color="#8b5cf6" />
              </View>
            )}
            <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }, !isComposite && { marginLeft: 0 }]}>
              <View style={[styles.itemNameRow, isRTL && styles.rtlRow]}>
                <Text style={[styles.itemName, isRTL && styles.rtlText]} numberOfLines={1}>
                  {language === 'ar' && item.name_ar ? item.name_ar : item.name}
                </Text>
                <View style={styles.priceBadge}>
                  <Text style={styles.priceBadgeText}>
                    {formatCurrency(item.effective_price || item.cost_per_unit)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.itemCategory, isRTL && styles.rtlText]} numberOfLines={1}>
                {getCategoryLabel(item.category, language)}
              </Text>
            </View>
          </View>

          {/* Right: Actions only */}
          <View style={[styles.itemActions, isRTL && styles.rtlRow]}>
            <TouchableOpacity
              style={styles.actionButtonSmall}
              onPress={(e) => {
                e.stopPropagation();
                setBarcodeItem(item);
                setShowBarcodeModal(true);
              }}
            >
              <Barcode size={14} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButtonSmall}
              onPress={(e) => {
                e.stopPropagation();
                setEditingItem(item);
                if (isComposite) {
                  setShowAddCompositeModal(true);
                } else {
                  setShowAddItemModal(true);
                }
              }}
            >
              <Edit2 size={14} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButtonSmall, styles.deleteButton]}
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteItem(item.id);
              }}
            >
              <Trash2 size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProductionContent = () => (
    <View style={styles.productionContainer}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <ClipboardList size={18} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{productionStats.today}</Text>
            <Text style={styles.statLabel} numberOfLines={2}>{t('todayBatches')}</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Calendar size={18} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{productionStats.week}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{t('thisWeek')}</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Layers size={18} color={colors.primary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text style={styles.statValue}>{compositeItems.length}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{t('compositeItems')}</Text>
          </View>
        </View>
      </View>

      {/* Composite Items for Production */}
      <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('compositeItemProduction')}</Text>
      
      {compositeLoading || productionLoading ? (
        <>
          <ItemSkeleton styles={styles} colors={colors} />
          <ItemSkeleton styles={styles} colors={colors} />
        </>
      ) : filteredCompositeItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Layers size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>
            {searchQuery ? t('noMatchingCompositeItems') : t('noCompositeItems')}
          </Text>
          <Text style={styles.emptySubtext}>{t('createCompositeItemFirst')}</Text>
        </View>
      ) : (
        filteredCompositeItems.map((item) => (
          <View key={item.id} style={styles.templateCard}>
            <View style={[styles.templateContent, isRTL && styles.rtlRow]}>
              <View style={styles.templateIcon}>
                <Layers size={24} color={colors.primary} />
              </View>
              <View style={[styles.templateInfo, isRTL && { alignItems: 'flex-end', marginRight: isRTL ? 12 : 0, marginLeft: isRTL ? 0 : 12 }]}>
                <Text style={[styles.templateName, isRTL && styles.rtlText]} numberOfLines={1}>
                  {language === 'ar' && item.name_ar ? item.name_ar : item.name}
                </Text>
                {((isRTL && item.name) || (!isRTL && item.name_ar)) && (
                  <Text style={[styles.templateItem, isRTL && styles.rtlText]} numberOfLines={1}>
                    {isRTL ? item.name : item.name_ar}
                  </Text>
                )}
                <Text style={styles.templateBatch}>
                  {t('batch')}: {item.batch_quantity || 1} {item.batch_unit || item.unit}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.produceButton, producingTemplateId === item.id && styles.produceButtonDisabled]}
                onPress={() => handleProduce(item)}
                disabled={producingTemplateId === item.id}
              >
                <Play size={16} color={colors.primaryForeground} />
                <Text style={styles.produceButtonText}>{t('produce')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Recent Productions */}
      {productions.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText, { marginTop: 24 }]}>
            {t('recentProduction')}
          </Text>
          {productions.map((prod) => (
            <View key={prod.id} style={styles.productionItem}>
              <View style={[styles.productionItemContent, isRTL && styles.rtlRow]}>
                <View style={styles.productionItemIcon}>
                  <Layers size={18} color={colors.mutedForeground} />
                </View>
                <View style={[styles.productionItemInfo, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.productionItemName, isRTL && styles.rtlText]}>
                    {language === 'ar' && prod.composite_item?.name_ar 
                      ? prod.composite_item.name_ar 
                      : prod.composite_item?.name || `Item #${prod.composite_item_id}`}
                  </Text>
                  <Text style={styles.productionItemDetail}>
                    {prod.batch_count} {t('batches')} • {prod.total_yield} {prod.yield_unit}
                  </Text>
                </View>
                <View style={isRTL ? { alignItems: 'flex-start' } : { alignItems: 'flex-end' }}>
                  <Text style={styles.productionItemDate}>
                    {new Date(prod.production_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                  <View style={[styles.statusBadge, prod.status === 'completed' && styles.statusCompleted]}>
                    <Text style={styles.statusText}>
                      {prod.status === 'completed' ? t('completed') : prod.status}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'raw':
        return (
          <View style={styles.tabContent}>
            {itemsLoading ? (
              <>
                <ItemSkeleton styles={styles} colors={colors} />
                <ItemSkeleton styles={styles} colors={colors} />
                <ItemSkeleton styles={styles} colors={colors} />
              </>
            ) : filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>{t('noRawItems')}</Text>
              </View>
            ) : (
              filteredItems.map(item => renderItemCard(item, false))
            )}
          </View>
        );
      case 'composite':
        return (
          <View style={styles.tabContent}>
            {compositeLoading ? (
              <>
                <ItemSkeleton styles={styles} colors={colors} />
                <ItemSkeleton styles={styles} colors={colors} />
                <ItemSkeleton styles={styles} colors={colors} />
              </>
            ) : filteredCompositeItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Layers size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>{t('noCompositeItems')}</Text>
              </View>
            ) : (
              filteredCompositeItems.map(item => renderItemCard(item, true))
            )}
          </View>
        );
      case 'production':
        return renderProductionContent();
    }
  };

  const getAddButtonText = () => {
    switch (activeTab) {
      case 'raw': return t('addItem');
      case 'composite': return t('addCompositeItem');
      case 'production': return null; // No add button for production tab
    }
  };

  const handleAddPress = () => {
    setEditingItem(null);
    setEditingTemplate(null);
    switch (activeTab) {
      case 'raw':
        setShowAddItemModal(true);
        break;
      case 'composite':
        setShowAddCompositeModal(true);
        break;
      case 'production':
        // No action - production tab doesn't have an add button
        break;
    }
  };
  
  // Check if we should show the add button
  const showAddButton = activeTab !== 'production';

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header - scrolls with content */}
        <View style={styles.header}>
          <View style={[styles.headerTop, isRTL && styles.rtlRow]}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => safeGoBack(navigation)}
            >
              {isRTL ? (
                <ArrowRight size={24} color={colors.foreground} />
              ) : (
                <ArrowLeft size={24} color={colors.foreground} />
              )}
            </TouchableOpacity>
            <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
              {t('items')}
            </Text>
            {showAddButton && (
              <TouchableOpacity 
                style={styles.headerAddButton} 
                onPress={handleAddPress}
              >
                <Plus size={20} color={colors.background} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Search */}
          <View style={[styles.searchContainer, isRTL && styles.rtlRow]}>
            <Search size={20} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, isRTL && styles.rtlText]}
              placeholder={t('searchItems')}
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

        {/* Tabs */}
        {renderTabs()}

        {/* Item Type Filter - only for raw and composite tabs */}
        {(activeTab === 'raw' || activeTab === 'composite') && (
          <View style={styles.categoryFilterContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.categoryFilterContent, isRTL && { flexDirection: 'row-reverse' }]}
            >
              <TouchableOpacity
                style={[styles.categoryChip, filterItemType === 'all' && styles.categoryChipActive]}
                onPress={() => { setFilterItemType('all'); setFilterCategory('all'); }}
              >
                <Text style={[styles.categoryChipText, filterItemType === 'all' && styles.categoryChipTextActive]}>
                  {isRTL ? 'كل الأنواع' : 'All Types'}
                </Text>
              </TouchableOpacity>
              {(config?.itemTypes || []).map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.categoryChip, filterItemType === type.id && styles.categoryChipActive]}
                  onPress={() => { setFilterItemType(type.id); setFilterCategory('all'); }}
                >
                  <Text style={[styles.categoryChipText, filterItemType === type.id && styles.categoryChipTextActive]}>
                    {isRTL ? type.name_ar : type.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Category Filter - only for raw and composite tabs */}
        {(activeTab === 'raw' || activeTab === 'composite') && (
          <View style={styles.categoryFilterContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.categoryFilterContent, isRTL && { flexDirection: 'row-reverse' }]}
            >
              <TouchableOpacity
                style={[styles.categoryChip, filterCategory === 'all' && styles.categoryChipActive]}
                onPress={() => setFilterCategory('all')}
              >
                <Text style={[styles.categoryChipText, filterCategory === 'all' && styles.categoryChipTextActive]}>
                  {isRTL ? 'كل الفئات' : 'All Categories'}
                </Text>
              </TouchableOpacity>
              {(filterItemType === 'all' 
                ? itemCategories
                : itemCategories.filter((cat: any) => cat.item_type === filterItemType)
              ).map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, filterCategory === cat.id && styles.categoryChipActive]}
                  onPress={() => setFilterCategory(cat.id)}
                >
                  <Text style={[styles.categoryChipText, filterCategory === cat.id && styles.categoryChipTextActive]}>
                    {getCategoryLabelLocal(cat.id)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {renderContent()}
        </View>
      </ScrollView>

      {/* Add Item Modal */}
      <AddItemModal
        visible={showAddItemModal}
        onClose={() => {
          setShowAddItemModal(false);
          setEditingItem(null);
        }}
        onSave={() => {
          setShowAddItemModal(false);
          setEditingItem(null);
          fetchItems();
        }}
        editingItem={editingItem}
        isRTL={isRTL}
        language={language}
        t={t as (key: string) => string}
        currency={currency}
        config={config}
      />

      {/* Add Composite Item Modal */}
      <AddCompositeModal
        visible={showAddCompositeModal}
        onClose={() => {
          setShowAddCompositeModal(false);
          setEditingItem(null);
        }}
        onSave={() => {
          setShowAddCompositeModal(false);
          setEditingItem(null);
          fetchCompositeItems();
        }}
        editingItem={editingItem}
        allItems={items}
        isRTL={isRTL}
        language={language}
        t={t as (key: string) => string}
        config={config}
      />

      {/* View Item Modal */}
      <ViewItemModal
        visible={showViewItemModal}
        item={viewingItem}
        onClose={() => {
          setShowViewItemModal(false);
          setViewingItem(null);
        }}
        onEdit={() => {
          setShowViewItemModal(false);
          setEditingItem(viewingItem);
          if (viewingItem?.is_composite) {
            setShowAddCompositeModal(true);
          } else {
            setShowAddItemModal(true);
          }
        }}
        isRTL={isRTL}
        language={language}
        t={t as (key: string, params?: Record<string, string | number>) => string}
        formatCurrency={formatCurrency}
        getCategoryLabel={(cat: string) => getCategoryLabel(cat, language)}
      />

      {/* Barcode Modal */}
      <BarcodeModal
        visible={showBarcodeModal}
        item={barcodeItem}
        onClose={() => {
          setShowBarcodeModal(false);
          setBarcodeItem(null);
        }}
        isRTL={isRTL}
        language={language}
        t={t as (key: string) => string}
      />

      {/* Add Template Modal */}
      <AddTemplateModal
        visible={showAddTemplateModal}
        onClose={() => {
          setShowAddTemplateModal(false);
          setEditingTemplate(null);
        }}
        onSave={() => {
          setShowAddTemplateModal(false);
          setEditingTemplate(null);
          fetchProductionData(true);
        }}
        editingTemplate={editingTemplate}
        compositeItems={compositeItems}
        isRTL={isRTL}
        language={language}
        t={t as (key: string) => string}
      />
    </View>
  );
}

// Add Item Modal Component
function AddItemModal({ visible, onClose, onSave, editingItem, isRTL, language, t, currency, config }: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editingItem: Item | null;
  isRTL: boolean;
  language: string;
  t: (key: string) => string;
  currency: string;
  config: any;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const modalStyles = createModalStyles(colors);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [unit, setUnit] = useState<string>('grams');
  const [storageUnit, setStorageUnit] = useState<string>('Kg');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showStorageUnitPicker, setShowStorageUnitPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Get config values with fallbacks
  const itemCategories = config?.itemCategories || [];
  const servingUnits = config?.servingUnits || [];
  const storageUnitsConfig = config?.storageUnits || [];

  // Get compatible storage units for a serving unit - using config
  const getCompatibleStorageUnitsLocal = (servingUnitId: string): string[] => {
    const servingUnit = servingUnits.find((u: any) => u.id === servingUnitId);
    return servingUnit?.compatibleStorageUnits || ['Kg', 'grams'];
  };

  // Get default storage unit for a serving unit - using config
  const getDefaultStorageUnitLocal = (servingUnitId: string): string => {
    const servingUnit = servingUnits.find((u: any) => u.id === servingUnitId);
    return servingUnit?.defaultStorageUnit || 'Kg';
  };

  // Get compatible storage units based on current serving unit
  const compatibleStorageUnits = getCompatibleStorageUnitsLocal(unit);

  // Handle serving unit change - auto-update storage unit if incompatible
  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    // Check if current storage unit is still compatible
    const compatible = getCompatibleStorageUnitsLocal(newUnit);
    if (!compatible.includes(storageUnit)) {
      setStorageUnit(getDefaultStorageUnitLocal(newUnit));
    }
  };

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setNameAr(editingItem.name_ar || '');
      setCategory(editingItem.category);
      setUnit(editingItem.unit);
      setStorageUnit(editingItem.storage_unit || getDefaultStorageUnitLocal(editingItem.unit));
      setCostPerUnit(editingItem.cost_per_unit.toString());
    } else {
      setName('');
      setNameAr('');
      setCategory('other');
      setUnit('grams');
      setStorageUnit('Kg');
      setCostPerUnit('');
    }
  }, [editingItem, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), 'Please enter item name');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        category,
        unit,
        storage_unit: storageUnit,
        cost_per_unit: parseFloat(costPerUnit) || 0,
      };

      if (editingItem) {
        await api.put(`/inventory/items/${editingItem.id}`, data);
      } else {
        await api.post('/inventory/items', data);
      }

      Alert.alert(t('success'), t('itemSaved'));
      onSave();
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert(t('error'), 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryLabelLocal = (cat: string) => {
    const catData = itemCategories.find((c: any) => c.id === cat);
    if (catData) {
      return language === 'ar' ? catData.name_ar : catData.name;
    }
    return cat;
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={editingItem ? t('editItem') : t('addItem')}
      scrollable={false}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={modalStyles.field}>
          <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('itemName')}</Text>
          <TextInput
            style={[modalStyles.input, isRTL && styles.rtlText]}
            value={name}
            onChangeText={setName}
            placeholder="Enter name"
            placeholderTextColor={colors.mutedForeground}
            textAlign={isRTL ? 'right' : 'left'}
          />
            </View>

            {/* Name Arabic */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('itemNameAr')}</Text>
              <TextInput
                style={[modalStyles.input, { textAlign: 'right' }]}
                value={nameAr}
                onChangeText={setNameAr}
                placeholder="أدخل الاسم بالعربية"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Category */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('category')}</Text>
              <TouchableOpacity 
                style={[modalStyles.picker, isRTL && styles.rtlRow]}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={[modalStyles.pickerText, isRTL && styles.rtlText]}>
                  {getCategoryLabelLocal(category)}
                </Text>
                <ChevronDown size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={modalStyles.pickerOptions}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {itemCategories.map((cat: any) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[modalStyles.pickerOption, category === cat.id && modalStyles.pickerOptionActive]}
                        onPress={() => {
                          setCategory(cat.id);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={[
                          modalStyles.pickerOptionText,
                          category === cat.id && modalStyles.pickerOptionTextActive
                        ]}>
                          {getCategoryLabelLocal(cat.id)}
                        </Text>
                        {category === cat.id && <Check size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Serving Unit */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('servingUnit')}</Text>
              <Text style={[modalStyles.hint, isRTL && styles.rtlText]}>{t('servingUnitHint')}</Text>
              <TouchableOpacity 
                style={[modalStyles.picker, isRTL && styles.rtlRow]}
                onPress={() => setShowUnitPicker(!showUnitPicker)}
              >
                <Text style={[modalStyles.pickerText, isRTL && styles.rtlText]}>{unit}</Text>
                <ChevronDown size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showUnitPicker && (
                <View style={modalStyles.pickerOptions}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {servingUnits.map((u: any) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[modalStyles.pickerOption, unit === u.id && modalStyles.pickerOptionActive]}
                        onPress={() => {
                          handleUnitChange(u.id);
                          setShowUnitPicker(false);
                        }}
                      >
                        <Text style={[
                          modalStyles.pickerOptionText,
                          unit === u.id && modalStyles.pickerOptionTextActive
                        ]}>
                          {language === 'ar' ? u.name_ar : u.name}
                        </Text>
                        {unit === u.id && <Check size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Storage Unit */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('storageUnit')}</Text>
              <Text style={[modalStyles.hint, isRTL && styles.rtlText]}>{t('storageUnitHint')}</Text>
              <TouchableOpacity 
                style={[modalStyles.picker, isRTL && styles.rtlRow]}
                onPress={() => setShowStorageUnitPicker(!showStorageUnitPicker)}
              >
                <Text style={[modalStyles.pickerText, isRTL && styles.rtlText]}>{storageUnit}</Text>
                <ChevronDown size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showStorageUnitPicker && (
                <View style={modalStyles.pickerOptions}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {compatibleStorageUnits.map(u => (
                      <TouchableOpacity
                        key={u}
                        style={[modalStyles.pickerOption, storageUnit === u && modalStyles.pickerOptionActive]}
                        onPress={() => {
                          setStorageUnit(u);
                          setShowStorageUnitPicker(false);
                        }}
                      >
                        <Text style={[
                          modalStyles.pickerOptionText,
                          storageUnit === u && modalStyles.pickerOptionTextActive
                        ]}>
                          {u}
                        </Text>
                        {storageUnit === u && <Check size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Cost */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('costPerUnit')} ({currency})</Text>
            <View style={[modalStyles.inputWithPrefix, isRTL && styles.rtlRow]}>
              <Text style={modalStyles.inputPrefix}>{currency}</Text>
              <TextInput
                style={[modalStyles.inputNoBorder, isRTL && styles.rtlText, { flex: 1 }]}
                value={costPerUnit}
                onChangeText={setCostPerUnit}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>
        </ScrollView>

        <View style={modalStyles.footer}>
          <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
            <Text style={modalStyles.cancelButtonText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.saveButton, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={modalStyles.saveButtonText}>{saving ? t('loading') : t('save')}</Text>
          </TouchableOpacity>
        </View>
      </BaseModal>
  );
}

// Add Composite Item Modal Component
function AddCompositeModal({ visible, onClose, onSave, editingItem, allItems, isRTL, language, t, config }: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editingItem: Item | null;
  allItems: Item[];
  isRTL: boolean;
  language: string;
  t: (key: string) => string;
  config: any;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const modalStyles = createModalStyles(colors);
  // Get config values with fallbacks
  const itemCategories = config?.itemCategories || [];
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [batchQuantity, setBatchQuantity] = useState('');
  const [batchUnit, setBatchUnit] = useState<string>('grams');
  // Store component with name info from backend to avoid lookup issues
  const [components, setComponents] = useState<{ item_id: number; quantity: number; name?: string; name_ar?: string }[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);

  // Load composite item with components when editing
  useEffect(() => {
    const loadCompositeItem = async () => {
      if (editingItem && visible) {
        setName(editingItem.name);
        setNameAr(editingItem.name_ar || '');
        setCategory(editingItem.category);
        setBatchQuantity(editingItem.batch_quantity?.toString() || '');
        setBatchUnit(editingItem.batch_unit || 'grams');
        
        // Fetch components from API - include name from backend response
        setLoadingComponents(true);
        try {
          const response = await api.get(`/inventory/composite-items/${editingItem.id}`);
          const itemWithComponents = response.data.data;
          if (itemWithComponents?.components) {
            setComponents(itemWithComponents.components.map((c: any) => ({
              item_id: c.component_item_id,
              quantity: c.quantity,
              // Use name from component_item returned by backend
              name: c.component_item?.name,
              name_ar: c.component_item?.name_ar,
            })));
          } else {
            setComponents([]);
          }
        } catch (error) {
          console.error('Error loading composite item components:', error);
          setComponents([]);
        } finally {
          setLoadingComponents(false);
        }
      } else if (!editingItem) {
        setName('');
        setNameAr('');
        setCategory('other');
        setBatchQuantity('');
        setBatchUnit('grams');
        setComponents([]);
      }
    };
    
    loadCompositeItem();
  }, [editingItem, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), 'Please enter item name');
      return;
    }
    if (!batchQuantity || parseFloat(batchQuantity) <= 0) {
      Alert.alert(t('error'), 'Please enter batch quantity');
      return;
    }
    if (components.length === 0) {
      Alert.alert(t('error'), 'Please add at least one component');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        category,
        unit: batchUnit,
        batch_quantity: parseFloat(batchQuantity),
        batch_unit: batchUnit,
        components,
      };

      if (editingItem) {
        await api.put(`/inventory/composite-items/${editingItem.id}/components`, { components });
      } else {
        await api.post('/inventory/composite-items', data);
      }

      Alert.alert(t('success'), t('itemSaved'));
      onSave();
    } catch (error) {
      console.error('Error saving composite item:', error);
      Alert.alert(t('error'), 'Failed to save composite item');
    } finally {
      setSaving(false);
    }
  };

  const addComponent = (item: Item) => {
    if (components.some(c => c.item_id === item.id)) return;
    // Store name with component so it displays correctly
    setComponents([...components, { item_id: item.id, quantity: 1, name: item.name, name_ar: item.name_ar ?? undefined }]);
    setShowItemPicker(false);
  };

  const updateComponentQuantity = (itemId: number, quantity: number) => {
    setComponents(components.map(c => 
      c.item_id === itemId ? { ...c, quantity } : c
    ));
  };

  const removeComponent = (itemId: number) => {
    setComponents(components.filter(c => c.item_id !== itemId));
  };

  const getItemName = (itemId: number) => {
    // First check if the component has stored name info
    const component = components.find(c => c.item_id === itemId);
    if (component?.name) {
      return language === 'ar' && component.name_ar ? component.name_ar : component.name;
    }
    // Fallback to allItems lookup
    const item = allItems.find(i => i.id === itemId);
    if (!item) return `Item #${itemId}`;
    return language === 'ar' && item.name_ar ? item.name_ar : item.name;
  };

  const getCategoryLabelLocal = (cat: string) => {
    const catData = itemCategories.find((c: any) => c.id === cat);
    if (catData) {
      return language === 'ar' ? catData.name_ar : catData.name;
    }
    return cat;
  };

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={editingItem ? t('editCompositeItem') : t('addCompositeItem')}
      scrollable={false}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={modalStyles.field}>
          <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('itemName')}</Text>
          <TextInput
            style={[modalStyles.input, isRTL && styles.rtlText]}
            value={name}
            onChangeText={setName}
            placeholder="Enter name"
            placeholderTextColor={colors.mutedForeground}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Name Arabic */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('itemNameAr')}</Text>
              <TextInput
                style={[modalStyles.input, { textAlign: 'right' }]}
                value={nameAr}
                onChangeText={setNameAr}
                placeholder="أدخل الاسم بالعربية"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Category */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('category')}</Text>
              <TouchableOpacity 
                style={[modalStyles.picker, isRTL && styles.rtlRow]}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={[modalStyles.pickerText, isRTL && styles.rtlText]}>
                  {getCategoryLabelLocal(category)}
                </Text>
                <ChevronDown size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={modalStyles.pickerOptions}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {itemCategories.map((cat: any) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[modalStyles.pickerOption, category === cat.id && modalStyles.pickerOptionActive]}
                        onPress={() => {
                          setCategory(cat.id);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={[
                          modalStyles.pickerOptionText,
                          category === cat.id && modalStyles.pickerOptionTextActive
                        ]}>
                          {getCategoryLabelLocal(cat.id)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Batch Quantity */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('batchQuantity')}</Text>
              <View style={[modalStyles.row, isRTL && styles.rtlRow]}>
                <TextInput
                  style={[modalStyles.input, { flex: 1, marginRight: 8 }]}
                  value={batchQuantity}
                  onChangeText={setBatchQuantity}
                  placeholder="500"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={[modalStyles.unitPicker]}>
                  <Text style={modalStyles.pickerText}>{batchUnit}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Components */}
            <View style={modalStyles.field}>
              <View style={[modalStyles.componentHeader, isRTL && styles.rtlRow]}>
                <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('components')}</Text>
                <TouchableOpacity 
                  style={modalStyles.addComponentButton}
                  onPress={() => setShowItemPicker(true)}
                >
                  <Plus size={16} color={colors.primary} />
                  <Text style={modalStyles.addComponentText}>{t('addItem')}</Text>
                </TouchableOpacity>
              </View>

              {components.length === 0 ? (
                <Text style={modalStyles.noComponentsText}>No components added yet</Text>
              ) : (
                components.map(comp => (
                  <View key={comp.item_id} style={[modalStyles.componentRow, isRTL && styles.rtlRow]}>
                    <Text style={[modalStyles.componentName, isRTL && styles.rtlText]} numberOfLines={1}>
                      {getItemName(comp.item_id)}
                    </Text>
                    <TextInput
                      style={modalStyles.componentQty}
                      value={comp.quantity.toString()}
                      onChangeText={(val) => updateComponentQuantity(comp.item_id, parseFloat(val) || 0)}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity onPress={() => removeComponent(comp.item_id)}>
                      <X size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Item Picker Modal */}
            {showItemPicker && (
              <View style={modalStyles.itemPickerOverlay}>
                <View style={modalStyles.itemPickerContent}>
                  <View style={modalStyles.itemPickerHeader}>
                    <Text style={modalStyles.itemPickerTitle}>Select Item</Text>
                    <TouchableOpacity onPress={() => setShowItemPicker(false)}>
                      <X size={20} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={{ maxHeight: 300 }}>
                    {allItems.filter(item => !components.some(c => c.item_id === item.id)).map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={modalStyles.itemPickerOption}
                        onPress={() => addComponent(item)}
                      >
                        <Text style={modalStyles.itemPickerOptionText}>
                          {language === 'ar' && item.name_ar ? item.name_ar : item.name}
                        </Text>
                        <Text style={modalStyles.itemPickerOptionUnit}>{item.unit}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={modalStyles.footer}>
          <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
            <Text style={modalStyles.cancelButtonText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.saveButton, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={modalStyles.saveButtonText}>{saving ? t('loading') : t('save')}</Text>
          </TouchableOpacity>
        </View>
      </BaseModal>
  );
}

// View Item Modal Component
function ViewItemModal({ 
  visible, 
  item, 
  onClose, 
  onEdit,
  isRTL, 
  language, 
  t, 
  formatCurrency,
  getCategoryLabel 
}: {
  visible: boolean;
  item: Item | null;
  onClose: () => void;
  onEdit: () => void;
  isRTL: boolean;
  language: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatCurrency: (value: number) => string;
  getCategoryLabel: (cat: string) => string;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const viewModalStyles = createViewModalStyles(colors);

  if (!item) return null;

  const hasCustomPrice = item.business_price !== null && item.business_price !== undefined;
  const isSystemItem = !item.business_id;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={language === 'ar' && item.name_ar ? item.name_ar : item.name}
      subtitle={item.is_composite ? t('compositeItem') : t('rawItem')}
      scrollable={false}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
            {/* Badges Row */}
            <View style={[viewModalStyles.badgesRow, isRTL && styles.rtlRow]}>
              {isSystemItem && (
                <View style={viewModalStyles.badgeGeneral}>
                  <Text style={viewModalStyles.badgeGeneralText}>{t('general')}</Text>
                </View>
              )}
              {hasCustomPrice && (
                <View style={viewModalStyles.badgeCustom}>
                  <Text style={viewModalStyles.badgeCustomText}>{t('customPrice')}</Text>
                </View>
              )}
            </View>

            {/* Info Grid */}
            <View style={viewModalStyles.infoGrid}>
              <View style={viewModalStyles.infoCard}>
                <Text style={viewModalStyles.infoLabel}>{t('category')}</Text>
                <Text style={[viewModalStyles.infoValue, isRTL && styles.rtlText]}>
                  {getCategoryLabel(item.category)}
                </Text>
              </View>
              <View style={viewModalStyles.infoCard}>
                <Text style={viewModalStyles.infoLabel}>{t('servingUnit')}</Text>
                <Text style={viewModalStyles.infoValue}>{item.unit}</Text>
              </View>
            </View>

            {/* Storage Unit */}
            {item.storage_unit && (
              <View style={viewModalStyles.infoRow}>
                <Info size={16} color={colors.mutedForeground} />
                <Text style={viewModalStyles.infoRowLabel}>{t('storageUnit')}:</Text>
                <Text style={viewModalStyles.infoRowValue}>{item.storage_unit}</Text>
              </View>
            )}

            {/* Cost Section */}
            <View style={viewModalStyles.costSection}>
              <View style={[viewModalStyles.costHeader, isRTL && styles.rtlRow]}>
                <DollarSign size={18} color={colors.primary} />
                <Text style={viewModalStyles.costTitle}>{t('pricing')}</Text>
              </View>
              <View style={viewModalStyles.costContent}>
                <View style={[viewModalStyles.costRow, isRTL && styles.rtlRow]}>
                  <Text style={viewModalStyles.costLabel}>{t('costPerUnit', { unit: item.unit })}</Text>
                  <Text style={viewModalStyles.costValue}>
                    {formatCurrency(item.effective_price || item.cost_per_unit)} / {item.unit}
                  </Text>
                </View>
                {hasCustomPrice && (
                  <View style={[viewModalStyles.costRow, isRTL && styles.rtlRow]}>
                    <Text style={viewModalStyles.costLabel}>{t('originalCost')}</Text>
                    <Text style={[viewModalStyles.costValue, { color: colors.mutedForeground, textDecorationLine: 'line-through' }]}>
                      {formatCurrency(item.cost_per_unit)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Batch Info for Composite Items */}
            {item.is_composite && item.batch_quantity && item.batch_unit && (
              <View style={viewModalStyles.batchSection}>
                <View style={[viewModalStyles.batchHeader, isRTL && styles.rtlRow]}>
                  <Layers size={18} color={colors.primary} />
                  <Text style={viewModalStyles.batchTitle}>{t('batchYield')}</Text>
                </View>
                <Text style={viewModalStyles.batchValue}>
                  {item.batch_quantity} {item.batch_unit}
                </Text>
                <Text style={viewModalStyles.batchHint}>
                  {t('batchYieldHint')}
                </Text>
              </View>
            )}

        {/* SKU */}
        {item.sku && (
          <View style={[viewModalStyles.skuRow, isRTL && styles.rtlRow]}>
            <Text style={viewModalStyles.skuLabel}>{t('sku')}</Text>
            <Text style={viewModalStyles.skuValue}>{item.sku}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={viewModalStyles.footer}>
        <TouchableOpacity style={viewModalStyles.closeBtn} onPress={onClose}>
          <Text style={viewModalStyles.closeBtnText}>{t('close')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={viewModalStyles.editBtn} onPress={onEdit}>
          <Edit2 size={18} color={colors.primaryForeground} />
          <Text style={viewModalStyles.editBtnText}>{t('edit')}</Text>
        </TouchableOpacity>
      </View>
    </BaseModal>
  );
}

// Barcode Modal Component
interface ItemBarcode {
  id: number;
  item_id: number;
  business_id: number;
  barcode: string;
  created_at: string;
  created_by?: number | null;
  created_by_user?: {
    first_name: string | null;
    last_name: string | null;
    username: string;
  } | null;
}

function BarcodeModal({ visible, item, onClose, isRTL, language, t }: {
  visible: boolean;
  item: Item | null;
  onClose: () => void;
  isRTL: boolean;
  language: string;
  t: (key: string) => string;
}) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [barcode, setBarcode] = useState<ItemBarcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && item) {
      fetchBarcode();
    } else {
      setBarcode(null);
      setError(null);
    }
  }, [visible, item]);

  const fetchBarcode = async () => {
    if (!item) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/inventory-stock/items/${item.id}/barcode`);
      setBarcode(response.data.data);
    } catch (err: any) {
      console.error('Failed to fetch barcode:', err);
      setError(err.response?.data?.error || 'Failed to fetch barcode information');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item || !barcode) return;

    Alert.alert(
      language === 'ar' ? 'حذف الباركود' : 'Delete Barcode',
      language === 'ar' ? 'هل أنت متأكد من حذف الباركود؟' : 'Are you sure you want to delete this barcode?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);

            try {
              await api.delete(`/inventory-stock/items/${item.id}/barcode`);
              setBarcode(null);
              Alert.alert(
                t('success'),
                language === 'ar' ? 'تم حذف الباركود بنجاح' : 'Barcode deleted successfully'
              );
            } catch (err: any) {
              console.error('Failed to delete barcode:', err);
              setError(err.response?.data?.error || 'Failed to delete barcode');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  if (!item) return null;

  const itemName = language === 'ar' && item.name_ar ? item.name_ar : item.name;

  const modalStyles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    container: {
      backgroundColor: colors.card,
      borderRadius: 20,
      width: '100%',
      maxWidth: 400,
      overflow: 'hidden',
    },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 12,
      marginLeft: isRTL ? 12 : 0,
    },
    headerTextContainer: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
      textAlign: isRTL ? 'right' : 'left',
    },
    subtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    closeButton: {
      padding: 8,
    },
    content: {
      padding: 20,
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 12,
    },
    errorContainer: {
      backgroundColor: `${colors.destructive}15`,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    errorText: {
      fontSize: 14,
      color: colors.destructive,
      textAlign: 'center',
    },
    retryText: {
      fontSize: 14,
      color: colors.destructive,
      marginTop: 12,
      textDecorationLine: 'underline',
    },
    barcodeExistsContainer: {
      backgroundColor: '#22c55e15',
      borderRadius: 12,
      padding: 16,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    barcodeExistsIcon: {
      marginRight: isRTL ? 0 : 12,
      marginLeft: isRTL ? 12 : 0,
      marginTop: 2,
    },
    barcodeExistsTextContainer: {
      flex: 1,
    },
    barcodeExistsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#166534',
    },
    barcodeExistsSubtitle: {
      fontSize: 12,
      color: '#15803d',
      marginTop: 4,
    },
    barcodeValueContainer: {
      backgroundColor: colors.secondary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    barcodeLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    barcodeValue: {
      fontSize: 18,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: colors.foreground,
      textAlign: isRTL ? 'right' : 'left',
    },
    barcodeMeta: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 4,
    },
    barcodeDate: {
      fontSize: 12,
      color: colors.mutedForeground,
      textAlign: isRTL ? 'right' : 'left',
    },
    deleteButton: {
      backgroundColor: `${colors.destructive}15`,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    deleteButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.destructive,
    },
    noBarcodeContainer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    noBarcodeIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    noBarcodeTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 8,
    },
    noBarcodeSubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    closeFooterButton: {
      backgroundColor: colors.secondary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    closeFooterButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={language === 'ar' ? 'الباركود' : 'Barcode'}
      subtitle={itemName}
      height="auto"
      scrollable={false}
    >
      <View style={modalStyles.content}>
            {loading ? (
              <View style={modalStyles.loadingContainer}>
                <Loader2 size={32} color={colors.mutedForeground} />
                <Text style={modalStyles.loadingText}>
                  {language === 'ar' ? 'جاري التحقق من الباركود...' : 'Checking barcode...'}
                </Text>
              </View>
            ) : error ? (
              <View style={modalStyles.errorContainer}>
                <Text style={modalStyles.errorText}>{error}</Text>
                <TouchableOpacity onPress={fetchBarcode}>
                  <Text style={modalStyles.retryText}>
                    {language === 'ar' ? 'حاول مرة أخرى' : 'Try again'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : barcode ? (
              <>
                {/* Barcode exists */}
                <View style={modalStyles.barcodeExistsContainer}>
                  <CheckCircle2 size={20} color="#16a34a" style={modalStyles.barcodeExistsIcon} />
                  <View style={modalStyles.barcodeExistsTextContainer}>
                    <Text style={modalStyles.barcodeExistsTitle}>
                      {language === 'ar' ? 'تم حفظ الباركود' : 'Barcode saved'}
                    </Text>
                    <Text style={modalStyles.barcodeExistsSubtitle}>
                      {language === 'ar'
                        ? 'هذه المادة لديها باركود مرتبط بها.'
                        : 'This item has a barcode associated with it.'}
                    </Text>
                  </View>
                </View>

                {/* Barcode value */}
                <View style={modalStyles.barcodeValueContainer}>
                  <Text style={modalStyles.barcodeLabel}>
                    {language === 'ar' ? 'قيمة الباركود' : 'Barcode Value'}
                  </Text>
                  <Text style={modalStyles.barcodeValue}>{barcode.barcode}</Text>
                  <View style={modalStyles.barcodeMeta}>
                    <Text style={modalStyles.barcodeDate}>
                      {language === 'ar' ? 'تم الحفظ في' : 'Saved on'}: {new Date(barcode.created_at).toLocaleDateString(language === 'ar' ? 'ar' : 'en')}
                    </Text>
                    {barcode.created_by_user && (
                      <Text style={modalStyles.barcodeDate}>
                        {language === 'ar' ? 'تم الحفظ بواسطة' : 'Saved by'}: {barcode.created_by_user.first_name || barcode.created_by_user.last_name
                          ? `${barcode.created_by_user.first_name || ''} ${barcode.created_by_user.last_name || ''}`.trim()
                          : barcode.created_by_user.username}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Delete button */}
                <TouchableOpacity
                  style={modalStyles.deleteButton}
                  onPress={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 size={18} color={colors.destructive} />
                  ) : (
                    <Trash2 size={18} color={colors.destructive} />
                  )}
                  <Text style={modalStyles.deleteButtonText}>
                    {deleting
                      ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...')
                      : (language === 'ar' ? 'حذف الباركود' : 'Delete Barcode')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={modalStyles.noBarcodeContainer}>
                <View style={modalStyles.noBarcodeIconContainer}>
                  <XCircle size={32} color={colors.mutedForeground} />
                </View>
                <Text style={modalStyles.noBarcodeTitle}>
                  {language === 'ar' ? 'لا يوجد باركود محفوظ' : 'No barcode saved'}
                </Text>
                <Text style={modalStyles.noBarcodeSubtitle}>
                  {language === 'ar'
                    ? 'هذه المادة ليس لديها باركود مرتبط بها. يمكنك مسح باركود أثناء جرد طلب الشراء لربط باركود.'
                    : 'This item does not have a barcode associated with it. You can scan a barcode during PO counting to associate one.'}
                </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={modalStyles.footer}>
          <TouchableOpacity style={modalStyles.closeFooterButton} onPress={onClose}>
            <Text style={modalStyles.closeFooterButtonText}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Text>
          </TouchableOpacity>
        </View>
      </BaseModal>
  );
}

// Add Production Template Modal Component
function AddTemplateModal({ 
  visible, 
  onClose, 
  onSave, 
  editingTemplate, 
  compositeItems,
  isRTL, 
  language, 
  t 
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editingTemplate: ProductionTemplate | null;
  compositeItems: Item[];
  isRTL: boolean;
  language: string;
  t: (key: string) => string;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const templateModalStyles = createTemplateModalStyles(colors);

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [defaultBatchCount, setDefaultBatchCount] = useState('1');
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      if (editingTemplate) {
        setSelectedItemId(editingTemplate.composite_item_id);
        setName(editingTemplate.name);
        setNameAr(editingTemplate.name_ar || '');
        setDefaultBatchCount(editingTemplate.default_batch_count.toString());
      } else {
        setSelectedItemId(null);
        setName('');
        setNameAr('');
        setDefaultBatchCount('1');
      }
      setError('');
    }
  }, [visible, editingTemplate]);

  const selectedItem = compositeItems.find(i => i.id === selectedItemId);

  // Auto-fill name when item is selected (only for new templates)
  useEffect(() => {
    if (selectedItem && !editingTemplate && !name) {
      const itemName = language === 'ar' && selectedItem.name_ar ? selectedItem.name_ar : selectedItem.name;
      setName(itemName);
      if (selectedItem.name_ar) setNameAr(selectedItem.name_ar);
    }
  }, [selectedItem, editingTemplate, language]);

  const handleSave = async () => {
    if (!selectedItemId) {
      setError(language === 'ar' ? 'يرجى اختيار مادة مركبة' : 'Please select a composite item');
      return;
    }

    if (!name.trim()) {
      setError(language === 'ar' ? 'يرجى إدخال اسم القالب' : 'Please enter a template name');
      return;
    }

    // Ensure batch count is at least 1
    const batchCount = Math.max(1, parseInt(defaultBatchCount) || 1);

    setSaving(true);
    setError('');

    try {
      if (editingTemplate) {
        await api.put(`/inventory/production/templates/${editingTemplate.id}`, {
          composite_item_id: selectedItemId,
          name: name.trim(),
          name_ar: nameAr.trim() || null,
          default_batch_count: batchCount,
        });
      } else {
        await api.post('/inventory/production/templates', {
          composite_item_id: selectedItemId,
          name: name.trim(),
          name_ar: nameAr.trim() || null,
          default_batch_count: batchCount,
        });
      }

      Alert.alert(t('success'), editingTemplate ? t('templateUpdated') : t('templateCreated'));
      onSave();
    } catch (err: any) {
      console.error('Failed to save template:', err);
      setError(err.response?.data?.error || err.message || (language === 'ar' ? 'فشل في حفظ القالب' : 'Failed to save template'));
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={templateModalStyles.overlay}>
        <View style={templateModalStyles.container}>
          {/* Header */}
          <View style={[templateModalStyles.header, isRTL && styles.rtlRow]}>
            <View style={[templateModalStyles.headerLeft, isRTL && styles.rtlRow]}>
              <View style={templateModalStyles.headerIcon}>
                <Layers size={20} color={colors.primary} />
              </View>
              <Text style={[templateModalStyles.title, isRTL && styles.rtlText]}>
                {editingTemplate ? t('editTemplate') : t('newTemplate')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={templateModalStyles.closeButton}>
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={templateModalStyles.content} showsVerticalScrollIndicator={false}>
            {error ? (
              <View style={templateModalStyles.errorContainer}>
                <Text style={templateModalStyles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Select Composite Item */}
            <View style={templateModalStyles.field}>
              <Text style={[templateModalStyles.label, isRTL && styles.rtlText]}>
                {t('compositeItem')} *
              </Text>
              {compositeItems.length === 0 ? (
                <View style={templateModalStyles.emptyItemsContainer}>
                  <Layers size={24} color={colors.mutedForeground} />
                  <Text style={templateModalStyles.emptyItemsText}>
                    {language === 'ar' ? 'لم يتم العثور على مواد مركبة' : 'No composite items found'}
                  </Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[templateModalStyles.picker, isRTL && styles.rtlRow]}
                    onPress={() => setShowItemPicker(true)}
                  >
                    <Text style={[
                      templateModalStyles.pickerText, 
                      !selectedItem && templateModalStyles.pickerPlaceholder,
                      isRTL && styles.rtlText
                    ]}>
                      {selectedItem 
                        ? (language === 'ar' && selectedItem.name_ar ? selectedItem.name_ar : selectedItem.name)
                        : (language === 'ar' ? 'اختر المادة المركبة...' : 'Select composite item...')
                      }
                    </Text>
                    <ChevronDown size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>

                  {/* Item Picker Modal */}
                  {showItemPicker && (
                    <Modal visible={showItemPicker} transparent animationType="fade">
                      <View style={templateModalStyles.itemPickerOverlay}>
                        <View style={templateModalStyles.itemPickerContainer}>
                          <View style={[templateModalStyles.itemPickerHeader, isRTL && styles.rtlRow]}>
                            <Text style={[templateModalStyles.itemPickerTitle, isRTL && styles.rtlText]}>
                              {t('selectCompositeItem')}
                            </Text>
                            <TouchableOpacity onPress={() => setShowItemPicker(false)}>
                              <X size={20} color={colors.foreground} />
                            </TouchableOpacity>
                          </View>
                          <ScrollView style={{ maxHeight: 350 }}>
                            {compositeItems.map(item => (
                              <TouchableOpacity
                                key={item.id}
                                style={[
                                  templateModalStyles.itemPickerOption,
                                  selectedItemId === item.id && templateModalStyles.itemPickerOptionActive,
                                  isRTL && styles.rtlRow
                                ]}
                                onPress={() => {
                                  setSelectedItemId(item.id);
                                  setShowItemPicker(false);
                                }}
                              >
                                <View style={[templateModalStyles.itemPickerOptionInfo, isRTL && { alignItems: 'flex-end' }]}>
                                  <Text style={[
                                    templateModalStyles.itemPickerOptionName,
                                    selectedItemId === item.id && templateModalStyles.itemPickerOptionNameActive,
                                    isRTL && styles.rtlText
                                  ]}>
                                    {language === 'ar' && item.name_ar ? item.name_ar : item.name}
                                  </Text>
                                  {item.batch_quantity && item.batch_unit && (
                                    <Text style={templateModalStyles.itemPickerOptionBatch}>
                                      {item.batch_quantity} {item.batch_unit} / {t('batch')}
                                    </Text>
                                  )}
                                </View>
                                {selectedItemId === item.id && <Check size={18} color={colors.primary} />}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </View>
                    </Modal>
                  )}
                </>
              )}
            </View>

            {/* Template Name */}
            <View style={templateModalStyles.field}>
              <Text style={[templateModalStyles.label, isRTL && styles.rtlText]}>
                {t('templateName')} *
              </Text>
              <TextInput
                style={[templateModalStyles.input, isRTL && styles.rtlText]}
                value={name}
                onChangeText={setName}
                placeholder={language === 'ar' ? 'مثال: إنتاج الصلصة اليومي' : 'e.g., Daily Sauce Production'}
                placeholderTextColor={colors.mutedForeground}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Template Name Arabic */}
            <View style={templateModalStyles.field}>
              <Text style={[templateModalStyles.label, isRTL && styles.rtlText]}>
                {t('templateNameAr')}
              </Text>
              <TextInput
                style={[templateModalStyles.input, { textAlign: 'right' }]}
                value={nameAr}
                onChangeText={setNameAr}
                placeholder="اختياري"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Default Batch Count */}
            <View style={templateModalStyles.field}>
              <Text style={[templateModalStyles.label, isRTL && styles.rtlText]}>
                {t('defaultBatches')}
              </Text>
              <TextInput
                style={[templateModalStyles.input, isRTL && styles.rtlText]}
                value={defaultBatchCount}
                onChangeText={setDefaultBatchCount}
                placeholder="1"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
              {selectedItem && selectedItem.batch_quantity && selectedItem.batch_unit && (
                <Text style={templateModalStyles.batchHint}>
                  {language === 'ar' ? 'كل دفعة تنتج:' : 'Each batch produces:'} {selectedItem.batch_quantity} {selectedItem.batch_unit}
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={templateModalStyles.footer}>
            <TouchableOpacity style={templateModalStyles.cancelButton} onPress={onClose}>
              <Text style={templateModalStyles.cancelButtonText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[templateModalStyles.saveButton, (saving || !selectedItemId || !name.trim()) && templateModalStyles.saveButtonDisabled]} 
              onPress={handleSave}
              disabled={saving || !selectedItemId || !name.trim()}
            >
              <Text style={templateModalStyles.saveButtonText}>
                {saving ? t('loading') : (editingTemplate ? t('save') : t('createTemplate'))}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createTemplateModalStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#ef444415',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: {
    fontSize: 15,
    color: colors.foreground,
    flex: 1,
  },
  pickerPlaceholder: {
    color: colors.mutedForeground,
  },
  emptyItemsContainer: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyItemsText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  batchHint: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 8,
  },
  itemPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  itemPickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 20,
    maxHeight: '80%',
  },
  itemPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  itemPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemPickerOptionActive: {
    backgroundColor: `${colors.primary}10`,
  },
  itemPickerOptionInfo: {
    flex: 1,
  },
  itemPickerOptionName: {
    fontSize: 15,
    color: colors.foreground,
    fontWeight: '500',
  },
  itemPickerOptionNameActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  itemPickerOptionBatch: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});

const createViewModalStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.secondary,
  },
  content: {
    padding: 20,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  badgeGeneral: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.secondary,
  },
  badgeGeneralText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  badgeCustom: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#3b82f615',
  },
  badgeCustomText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3b82f6',
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.secondary,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    marginBottom: 16,
  },
  infoRowLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  infoRowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  costSection: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    marginBottom: 16,
  },
  costHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  costTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  costContent: {
    gap: 8,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  costValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  batchSection: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    marginBottom: 16,
  },
  batchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  batchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  batchValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  batchHint: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  skuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  skuLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  skuValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});

const createStyles = (colors: any) => StyleSheet.create({
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    gap: 4,
    minHeight: 44,
  },
  tabActive: {
    backgroundColor: colors.foreground,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    textAlign: 'center',
    flexShrink: 1,
  },
  tabTextActive: {
    color: colors.background,
  },
  categoryFilterContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.secondary,
  },
  categoryChipActive: {
    backgroundColor: colors.foreground,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  categoryChipTextActive: {
    color: colors.background,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 100,
  },
  productionContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 70,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 12,
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  templateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateItem: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  templateBatch: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  produceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 90,
    justifyContent: 'center',
  },
  produceButtonDisabled: {
    opacity: 0.6,
  },
  produceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  productionItem: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  productionItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productionItemInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  productionItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  productionItemDetail: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  productionItemDate: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.secondary,
    marginTop: 4,
  },
  statusCompleted: {
    backgroundColor: '#22c55e15',
  },
  statusText: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    flexShrink: 1,
  },
  priceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#10b98115',
    flexShrink: 0,
  },
  priceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  itemCategory: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  // Keep these for ViewItemModal
  systemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.secondary,
  },
  systemBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  customPriceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#3b82f615',
  },
  customPriceBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#3b82f6',
    textTransform: 'uppercase',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: `${colors.destructive}15`,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  headerAddButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

// Must be a factory: screens are imported before the component runs, so module-scope styles
// cannot reference in-component `colors` from useTheme().
const createModalStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 24,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  content: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 14,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginRight: 8,
  },
  inputNoBorder: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 12,
    paddingRight: 14,
    fontSize: 15,
    color: colors.foreground,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: {
    fontSize: 15,
    color: colors.foreground,
  },
  pickerOptions: {
    marginTop: 8,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionActive: {
    backgroundColor: `${colors.primary}15`,
  },
  pickerOptionText: {
    fontSize: 14,
    color: colors.foreground,
  },
  pickerOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitPicker: {
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  componentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addComponentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addComponentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  noComponentsText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 20,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 10,
  },
  componentName: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
  },
  componentQty: {
    width: 60,
    backgroundColor: colors.muted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.foreground,
    textAlign: 'center',
  },
  itemPickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  itemPickerContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    width: '100%',
    maxHeight: 400,
  },
  itemPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  itemPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemPickerOptionText: {
    fontSize: 14,
    color: colors.foreground,
  },
  itemPickerOptionUnit: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
});


