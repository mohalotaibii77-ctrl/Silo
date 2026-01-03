import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  Alert,
  TextInput,
  Animated,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Image,
  Switch,
} from 'react-native';
import { BaseModal } from '../components/BaseModal';
import { useTheme, ThemeColors } from '../theme/ThemeContext';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import ProgressiveImage from '../components/ProgressiveImage';
import { usePaginatedProducts } from '../hooks';
import * as ImagePicker from 'expo-image-picker';
import {
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  ImageIcon,
  Layers,
  Store,
  Truck,
  Camera,
  ImagePlus,
  Package,
  Loader2
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Types
interface DeliveryMargin {
  partner_id: number;
  partner_name: string;
  partner_name_ar?: string;
  margin_percent: number;
}

interface ProductVariant {
  id: number;
  name: string;
  name_ar?: string;
  price_adjustment: number;
  margin_percent?: number;
  delivery_margins?: DeliveryMargin[];
}

interface Product {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string;
  description?: string;
  price: number;
  cost?: number;
  category?: string;
  category_id?: number;
  is_active: boolean;
  has_variants: boolean;
  image_url?: string;
  thumbnail_url?: string;
  margin_percent?: number;
  delivery_margins?: DeliveryMargin[];
  variants?: ProductVariant[];
}

interface ProductStats {
  sold: number;
  profit_margin: number;
}

interface Category {
  id: number;
  name: string;
  name_ar?: string;
}

interface Item {
  id: number;
  name: string;
  name_ar?: string;
  category?: string;
  unit?: string;
  cost_per_unit?: number;
  current_stock?: number;
}

interface ProductIngredient {
  id?: number;
  item_id: number;
  item_name?: string;
  item_name_ar?: string;
  quantity: number;
  unit?: string;
  cost_per_unit?: number;
  removable?: boolean;
}

interface ProductModifier {
  id?: number;
  item_id?: number;
  name: string;
  name_ar?: string;
  quantity?: number;
  extra_price: number;
}

interface ProductAccessory {
  id?: number;
  item_id: number;
  quantity: number;
  applicable_order_types: AccessoryOrderType[];
  item?: Item;
}

type AccessoryOrderType = 'always' | 'dine_in' | 'takeaway' | 'delivery';

interface IngredientEntry {
  id: string;
  item_id: number | null;
  item?: Item;
  quantity: number;
  removable: boolean;
}

interface VariantEntry {
  id: string;
  name: string;
  name_ar: string;
  price_adjustment: number;
  ingredients: IngredientEntry[];
  isExpanded: boolean;
}

interface ModifierEntry {
  id: string;
  item_id: number | null;
  item?: Item;
  quantity: number;
  extra_price: number;
}

interface AccessoryEntry {
  id: string;
  item_id: number | null;
  item?: Item;
  quantity: number;
  applicable_order_types: AccessoryOrderType[];
}

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

const ProductSkeleton = ({ styles, colors }: { styles: any; colors: ThemeColors }) => (
  <View style={styles.productCard}>
    <Skeleton width="100%" height={120} borderRadius={12} colors={colors} />
    <View style={{ padding: 12 }}>
      <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} colors={colors} />
      <Skeleton width="40%" height={12} style={{ marginBottom: 8 }} colors={colors} />
      <Skeleton width="50%" height={18} colors={colors} />
    </View>
  </View>
);

export default function ProductsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const modalStyles = createModalStyles(colors);
  const { t, isRTL, language, formatCurrency, currency } = useLocalization();
  
  // Use paginated products hook for efficient data loading
  const {
    data: products,
    isLoading: loading,
    isLoadingMore,
    isRefreshing: refreshing,
    hasMore,
    loadMore,
    refresh,
    refetch,
  } = usePaginatedProducts({
    pageSize: 20,
    refetchOnFocus: true,
  });
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [productStats, setProductStats] = useState<Record<number, ProductStats>>({});

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchCategories(false);
    fetchProductStats();
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await api.get('/inventory/items');
      if (response.data?.data) {
        setItems(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchProductStats = async () => {
    try {
      const response = await api.get('/inventory/products/stats');
      if (response.data?.data) {
        setProductStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching product stats:', error);
    }
  };

  const fetchCategories = async (forceRefresh = false) => {
    const cacheKey = CacheKeys.categories();
    
    // Check cache first
    if (!forceRefresh) {
      const cached = await cacheManager.get<Category[]>(cacheKey);
      // Ensure cached data is a valid array
      if (cached && Array.isArray(cached)) {
        setCategories(cached);
        // Refresh in background
        api.get('/categories')
          .then(response => {
            const fresh = response.data.data || [];
            if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
              setCategories(fresh);
              cacheManager.set(cacheKey, fresh, CACHE_TTL.LONG);
            }
          })
          .catch(() => {});
        return;
      }
    }
    
    try {
      const response = await api.get('/categories');
      const data = response.data.data || [];
      setCategories(data);
      await cacheManager.set(cacheKey, data, CACHE_TTL.LONG);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    Alert.alert(
      t('deleteProduct'),
      t('confirmDeleteProduct'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/store-products/${productId}`);
              refresh(); // Refresh the paginated list
              fetchProductStats(); // Refresh stats
              Alert.alert(t('success'), t('productDeleted'));
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert(t('error'), 'Failed to delete product');
            }
          }
        }
      ]
    );
  };

  // Filter products (client-side filtering for search)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    
    const query = searchQuery.toLowerCase();
    return products.filter(product => 
      product.name.toLowerCase().includes(query) ||
      (product.name_ar && product.name_ar.includes(searchQuery)) ||
      (product.category && product.category.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  // Display helper - no business calculation
  const getMarginColor = (margin: number) => {
    if (margin >= 30) return '#22c55e';
    if (margin >= 15) return '#f59e0b';
    return '#ef4444';
  };

  // margin_percent now comes from backend API
  // No local calculation needed

  // Render product card - memoized for FlatList
  const renderProductCard = useCallback(({ item: product }: { item: Product }) => {
    // Use margin_percent from backend API
    const margin = product.margin_percent || 0;
    const stats = productStats[product.id];
    const sold = stats?.sold || 0;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => setSelectedProduct(product)}
        activeOpacity={0.7}
      >
        {/* Product Image with Progressive Loading */}
        <View style={styles.productImageContainer}>
          {product.image_url ? (
            <ProgressiveImage
              source={{ uri: product.image_url }}
              thumbnailSource={product.thumbnail_url ? { uri: product.thumbnail_url } : undefined}
              style={styles.productImage}
              resizeMode="cover"
              transitionDuration={300}
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <ImageIcon size={32} color={colors.border} />
            </View>
          )}

          {/* Action buttons */}
          <View style={[styles.productActions, isRTL && { left: 8, right: undefined }]}>
            <TouchableOpacity
              style={styles.productActionButton}
              onPress={(e) => {
                e.stopPropagation();
                setEditingProduct(product);
                setShowAddModal(true);
              }}
            >
              <Edit2 size={14} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.productActionButton, styles.deleteActionButton]}
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteProduct(product.id);
              }}
            >
              <Trash2 size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>

          {/* Variants badge */}
          {product.has_variants && (
            <View style={[styles.variantBadge, isRTL && { right: 8, left: undefined }]}>
              <Layers size={10} color={colors.primaryForeground} />
              <Text style={styles.variantBadgeText}>{t('variants')}</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={[styles.productName, isRTL && styles.rtlText]} numberOfLines={1}>
            {language === 'ar' && product.name_ar ? product.name_ar : product.name}
          </Text>
          {product.category && (
            <Text style={[styles.productCategory, isRTL && styles.rtlText]} numberOfLines={1}>
              {product.category}
            </Text>
          )}
          <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>

          {/* Stats Section - Sold count and Margins */}
          <View style={styles.statsSection}>
            {/* Sold count */}
            <View style={[styles.statRow, isRTL && styles.rtlRow]}>
              <Text style={styles.statLabel}>{t('sold')}:</Text>
              <Text style={styles.statValue}>{sold}</Text>
            </View>

            {/* Dine-in Margin */}
            <View style={[styles.statRow, isRTL && styles.rtlRow]}>
              <View style={[styles.statLabelWithIcon, isRTL && styles.rtlRow]}>
                <Store size={10} color={colors.mutedForeground} />
                <Text style={styles.statLabel}>{t('dineIn')}:</Text>
              </View>
              <Text style={[styles.statValue, { color: getMarginColor(margin) }]}>
                {margin.toFixed(2)}%
              </Text>
            </View>

            {/* Delivery partner margins */}
            {product.delivery_margins?.map((dm) => (
              <View key={dm.partner_id} style={[styles.statRow, isRTL && styles.rtlRow]}>
                <View style={[styles.statLabelWithIcon, isRTL && styles.rtlRow]}>
                  <Truck size={10} color={colors.mutedForeground} />
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {language === 'ar' && dm.partner_name_ar ? dm.partner_name_ar : dm.partner_name}:
                  </Text>
                </View>
                <Text style={[styles.statValue, { color: getMarginColor(dm.margin_percent) }]}>
                  {dm.margin_percent.toFixed(2)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [language, isRTL, formatCurrency, t, setSelectedProduct, setEditingProduct, setShowAddModal, handleDeleteProduct, productStats]);

  // Render footer with loading indicator for infinite scroll
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isLoadingMore]);

  // Handle end reached for infinite scroll
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && !searchQuery.trim()) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore, searchQuery]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: Product) => item.id.toString(), []);

  // Header component for FlatList
  const renderHeader = useCallback(() => (
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
          {t('products')}
        </Text>
        <TouchableOpacity 
          style={styles.headerAddButton} 
          onPress={() => {
            setEditingProduct(null);
            setShowAddModal(true);
          }}
        >
          <Plus size={20} color={colors.background} />
        </TouchableOpacity>
      </View>
      
      {/* Search */}
      <View style={[styles.searchContainer, isRTL && styles.rtlRow]}>
        <Search size={20} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, isRTL && styles.rtlText]}
          placeholder={t('searchProducts')}
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
  ), [isRTL, navigation, t, searchQuery]);

  return (
    <View style={styles.container}>
      {/* Content - FlatList with pagination */}
      {loading ? (
        <View style={styles.loadingContainer}>
          {renderHeader()}
          <View style={styles.skeletonGrid}>
            <View style={styles.productRow}>
              <ProductSkeleton styles={styles} colors={colors} />
              <ProductSkeleton styles={styles} colors={colors} />
            </View>
            <View style={styles.productRow}>
              <ProductSkeleton styles={styles} colors={colors} />
              <ProductSkeleton styles={styles} colors={colors} />
            </View>
            <View style={styles.productRow}>
              <ProductSkeleton styles={styles} colors={colors} />
              <ProductSkeleton styles={styles} colors={colors} />
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductCard}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => {
            refresh();
            fetchProductStats();
          }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ShoppingBag size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>{t('noProducts')}</Text>
              <Text style={styles.emptySubtext}>{t('addFirstProduct')}</Text>
            </View>
          }
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      )}

      {/* Add/Edit Product Modal */}
      <AddProductModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingProduct(null);
        }}
        onSave={() => {
          setShowAddModal(false);
          setEditingProduct(null);
          refetch();
          fetchProductStats();
        }}
        editingProduct={editingProduct}
        categories={categories}
        items={items}
        isRTL={isRTL}
        language={language}
        t={t as (key: string) => string}
        colors={colors}
        styles={styles}
        modalStyles={modalStyles}
        currency={currency}
      />

      {/* Product Details Modal */}
      <ProductDetailsModal
        visible={!!selectedProduct}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onEdit={() => {
          if (selectedProduct) {
            setEditingProduct(selectedProduct);
            setSelectedProduct(null);
            setShowAddModal(true);
          }
        }}
        onDelete={() => {
          if (selectedProduct) {
            handleDeleteProduct(selectedProduct.id);
            setSelectedProduct(null);
          }
        }}
        isRTL={isRTL}
        language={language}
        t={t as (key: string) => string}
        formatCurrency={formatCurrency}
        colors={colors}
        styles={styles}
        modalStyles={modalStyles}
      />
    </View>
  );
}

// Add/Edit Product Modal - Enhanced with ingredients, variants, modifiers, accessories
function AddProductModal({ visible, onClose, onSave, editingProduct, categories, items, isRTL, language, t, colors, styles, modalStyles, currency }: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editingProduct: Product | null;
  categories: Category[];
  items: Item[];
  isRTL: boolean;
  language: string;
  t: (key: string) => string;
  colors: any;
  styles: any;
  modalStyles: any;
  currency: string;
}) {
  // Basic product info state
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Ingredients, variants, modifiers, accessories state
  const [hasVariants, setHasVariants] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientEntry[]>([]);
  const [variants, setVariants] = useState<VariantEntry[]>([]);
  const [modifiers, setModifiers] = useState<ModifierEntry[]>([]);
  const [accessories, setAccessories] = useState<AccessoryEntry[]>([]);

  // UI state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter items by type
  const foodItems = useMemo(() => items.filter(item => !item.category || item.category !== 'non_food'), [items]);
  const nonFoodItems = useMemo(() => items.filter(item => item.category === 'non_food'), [items]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      if (editingProduct) {
        // Use existing product data directly - no need for API call
        populateFormFromProduct(editingProduct);
      } else {
        resetForm();
      }
    }
  }, [visible, editingProduct]);

  const resetForm = () => {
    setName('');
    setNameAr('');
    setDescription('');
    setPrice('');
    setCategoryId(null);
    setImageUrl(null);
    setImagePreview(null);
    setHasVariants(false);
    setIngredients([]);
    setVariants([]);
    setModifiers([]);
    setAccessories([]);
    setError(null);
  };

  // Populate form from existing product data (no API call needed)
  const populateFormFromProduct = (productData: any) => {
    setName(productData.name || '');
    setNameAr(productData.name_ar || '');
    setDescription(productData.description || '');
    setPrice(productData.price?.toString() || '');
    setCategoryId(productData.category_id || null);
    setImageUrl(productData.image_url || null);
    setImagePreview(productData.image_url || null);
    setHasVariants(productData.has_variants || false);

    // Load ingredients from existing data
    if (productData.ingredients && productData.ingredients.length > 0) {
      const mappedIngredients: IngredientEntry[] = productData.ingredients.map((ing: any) => {
        const foundItem = items.find(i => i.id === ing.item_id);
        return {
          id: generateId(),
          item_id: ing.item_id,
          item: foundItem || {
            id: ing.item_id,
            name: ing.item_name || '',
            name_ar: ing.item_name_ar,
            unit: ing.unit || '',
            cost_per_unit: ing.cost_per_unit || 0,
          },
          quantity: ing.quantity,
          removable: ing.removable || false,
        };
      });
      setIngredients(mappedIngredients);
    } else {
      setIngredients([]);
    }

    // Load variants with ingredients
    if (productData.has_variants && productData.variants && productData.variants.length > 0) {
      const mappedVariants: VariantEntry[] = productData.variants.map((v: any) => ({
        id: generateId(),
        name: v.name || '',
        name_ar: v.name_ar || '',
        price_adjustment: v.price_adjustment || 0,
        isExpanded: false,
        ingredients: (v.ingredients || []).map((ing: any) => {
          const foundItem = items.find(i => i.id === ing.item_id);
          return {
            id: generateId(),
            item_id: ing.item_id,
            item: foundItem || {
              id: ing.item_id,
              name: ing.item_name || '',
              name_ar: ing.item_name_ar,
              unit: ing.unit || '',
              cost_per_unit: ing.cost_per_unit || 0,
            },
            quantity: ing.quantity,
            removable: ing.removable || false,
          };
        }),
      }));
      setVariants(mappedVariants);
      setIngredients([]);
    } else {
      setVariants([]);
    }

    // Load modifiers
    if (productData.modifiers && productData.modifiers.length > 0) {
      const mappedModifiers: ModifierEntry[] = productData.modifiers.map((m: any) => {
        const foundItem = m.item_id ? items.find(i => i.id === m.item_id) : undefined;
        return {
          id: generateId(),
          item_id: m.item_id || null,
          item: foundItem || (m.item_id ? {
            id: m.item_id,
            name: m.name || '',
            name_ar: m.name_ar,
            unit: 'piece',
            cost_per_unit: 0,
          } : undefined),
          quantity: m.quantity || 1,
          extra_price: m.extra_price || 0,
        };
      });
      setModifiers(mappedModifiers);
    } else {
      setModifiers([]);
    }

    // Accessories are not included in list data, so keep empty for now
    // They would need to be fetched separately if needed
    setAccessories([]);
  };

  // Ingredient helpers
  const addIngredient = () => {
    setIngredients([...ingredients, { id: generateId(), item_id: null, quantity: 0, removable: false }]);
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter(i => i.id !== id));
  };

  const updateIngredient = (id: string, updates: Partial<IngredientEntry>) => {
    setIngredients(ingredients.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const selectItemForIngredient = (ingredientId: string, item: Item) => {
    setIngredients(ingredients.map(i =>
      i.id === ingredientId ? { ...i, item_id: item.id, item } : i
    ));
    setActiveDropdown(null);
  };

  // Variant helpers
  const addVariant = () => {
    setVariants([...variants, { id: generateId(), name: '', name_ar: '', price_adjustment: 0, ingredients: [], isExpanded: true }]);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id: string, updates: Partial<VariantEntry>) => {
    setVariants(variants.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const addVariantIngredient = (variantId: string) => {
    setVariants(variants.map(v =>
      v.id === variantId
        ? { ...v, ingredients: [...v.ingredients, { id: generateId(), item_id: null, quantity: 0, removable: false }] }
        : v
    ));
  };

  const removeVariantIngredient = (variantId: string, ingredientId: string) => {
    setVariants(variants.map(v =>
      v.id === variantId
        ? { ...v, ingredients: v.ingredients.filter(i => i.id !== ingredientId) }
        : v
    ));
  };

  const updateVariantIngredient = (variantId: string, ingredientId: string, updates: Partial<IngredientEntry>) => {
    setVariants(variants.map(v =>
      v.id === variantId
        ? { ...v, ingredients: v.ingredients.map(i => i.id === ingredientId ? { ...i, ...updates } : i) }
        : v
    ));
  };

  const selectItemForVariantIngredient = (variantId: string, ingredientId: string, item: Item) => {
    setVariants(variants.map(v =>
      v.id === variantId
        ? { ...v, ingredients: v.ingredients.map(i => i.id === ingredientId ? { ...i, item_id: item.id, item } : i) }
        : v
    ));
    setActiveDropdown(null);
  };

  // Modifier helpers
  const addModifier = () => {
    setModifiers([...modifiers, { id: generateId(), item_id: null, quantity: 1, extra_price: 0 }]);
  };

  const removeModifier = (id: string) => {
    setModifiers(modifiers.filter(m => m.id !== id));
  };

  const updateModifier = (id: string, updates: Partial<ModifierEntry>) => {
    setModifiers(modifiers.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const selectItemForModifier = (modifierId: string, item: Item) => {
    setModifiers(modifiers.map(m =>
      m.id === modifierId ? { ...m, item_id: item.id, item } : m
    ));
    setActiveDropdown(null);
  };

  // Accessory helpers
  const addAccessory = () => {
    setAccessories([...accessories, { id: generateId(), item_id: null, quantity: 1, applicable_order_types: ['always'] }]);
  };

  const removeAccessory = (id: string) => {
    setAccessories(accessories.filter(a => a.id !== id));
  };

  const updateAccessory = (id: string, updates: Partial<AccessoryEntry>) => {
    setAccessories(accessories.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const selectItemForAccessory = (accessoryId: string, item: Item) => {
    setAccessories(accessories.map(a =>
      a.id === accessoryId ? { ...a, item_id: item.id, item } : a
    ));
    setActiveDropdown(null);
  };

  const toggleOrderType = (accessoryId: string, orderType: AccessoryOrderType) => {
    const accessory = accessories.find(a => a.id === accessoryId);
    if (!accessory) return;

    let newTypes = [...accessory.applicable_order_types];
    if (orderType === 'always') {
      newTypes = newTypes.includes('always') ? [] : ['always'];
    } else {
      newTypes = newTypes.filter(t => t !== 'always');
      if (newTypes.includes(orderType)) {
        newTypes = newTypes.filter(t => t !== orderType);
      } else {
        newTypes.push(orderType);
      }
    }
    updateAccessory(accessoryId, { applicable_order_types: newTypes });
  };

  // Image picker
  const pickImage = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t('error'), language === 'ar' ? 'يجب منح إذن الوصول' : 'Permission required');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: true,
        });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64 && asset.base64.length > 5 * 1024 * 1024) {
        Alert.alert(t('error'), language === 'ar' ? 'الصورة كبيرة جداً' : 'Image too large (max 5MB)');
        return;
      }
      setImagePreview(asset.uri);
      if (asset.base64) {
        setImageUrl(`data:image/jpeg;base64,${asset.base64}`);
      }
    }
  };

  const removeImage = () => {
    setImageUrl(null);
    setImagePreview(null);
  };

  const calculateCost = (ings: IngredientEntry[]) => {
    return ings.reduce((total, ing) => {
      if (ing.item && ing.item.cost_per_unit) {
        return total + (ing.quantity * ing.item.cost_per_unit);
      }
      return total;
    }, 0);
  };

  const getCategoryName = (id: number | null) => {
    if (!id) return t('selectCategory');
    const cat = categories.find(c => c.id === id);
    if (!cat) return 'Unknown';
    return language === 'ar' && cat.name_ar ? cat.name_ar : cat.name;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), language === 'ar' ? 'يرجى إدخال اسم المنتج' : 'Please enter product name');
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      Alert.alert(t('error'), language === 'ar' ? 'يرجى إدخال سعر صحيح' : 'Please enter a valid price');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const productData: any = {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        description: description.trim() || undefined,
        price: parseFloat(price),
        category_id: categoryId || undefined,
        has_variants: hasVariants,
        image_url: imageUrl || undefined,
      };

      // Add ingredients/variants data
      if (hasVariants && variants.length > 0) {
        productData.variants = variants.map(v => ({
          name: v.name,
          name_ar: v.name_ar || undefined,
          price_adjustment: v.price_adjustment,
          ingredients: v.ingredients.filter(i => i.item_id).map(i => ({
            item_id: i.item_id,
            quantity: i.quantity,
            removable: i.removable,
          })),
        }));
      } else if (ingredients.length > 0) {
        productData.ingredients = ingredients.filter(i => i.item_id).map(i => ({
          item_id: i.item_id,
          quantity: i.quantity,
          removable: i.removable,
        }));
      }

      // Add modifiers
      if (modifiers.length > 0) {
        productData.modifiers = modifiers.filter(m => m.item_id).map(m => ({
          item_id: m.item_id,
          quantity: m.quantity,
          extra_price: m.extra_price,
        }));
      }

      let productId: number;
      if (editingProduct) {
        await api.put(`/store-products/${editingProduct.id}`, productData);
        productId = editingProduct.id;
      } else {
        const response = await api.post('/store-products', productData);
        productId = response.data.data.id;
      }

      // Save accessories
      if (accessories.length > 0) {
        const accessoriesData = accessories.filter(a => a.item_id).map(a => ({
          item_id: a.item_id,
          quantity: a.quantity,
          applicable_order_types: a.applicable_order_types,
        }));
        await api.put(`/inventory/products/${productId}/accessories`, { accessories: accessoriesData });
      }

      Alert.alert(t('success'), t('productSaved'));
      onSave();
    } catch (err) {
      console.error('Error saving product:', err);
      setError(language === 'ar' ? 'فشل في حفظ المنتج' : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  // Item dropdown component
  const ItemDropdown = ({ dropdownKey, selectedItem, onSelect, itemsList, placeholder }: {
    dropdownKey: string;
    selectedItem?: Item;
    onSelect: (item: Item) => void;
    itemsList: Item[];
    placeholder?: string;
  }) => {
    const isOpen = activeDropdown === dropdownKey;
    const filteredItems = itemsList.filter(item => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || (item.name_ar && item.name_ar.includes(q));
    });

    return (
      <View style={{ flex: 1, position: 'relative', zIndex: isOpen ? 1000 : 1 }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: isOpen ? colors.primary : colors.border,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
            minHeight: 38,
          }}
          onPress={() => {
            setActiveDropdown(isOpen ? null : dropdownKey);
            setSearchQuery('');
          }}
        >
          <Text style={{ fontSize: 12, color: selectedItem ? colors.foreground : colors.mutedForeground, flex: 1 }} numberOfLines={1}>
            {selectedItem ? (language === 'ar' && selectedItem.name_ar ? selectedItem.name_ar : selectedItem.name) : (placeholder || (language === 'ar' ? 'اختر مادة' : 'Select item'))}
          </Text>
          <ChevronDown size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
        {isOpen && (
          <View style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            marginTop: 4,
            maxHeight: 200,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <View style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TextInput
                style={{ backgroundColor: colors.secondary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, color: colors.foreground }}
                placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 150 }}>
              {filteredItems.length === 0 ? (
                <Text style={{ padding: 12, textAlign: 'center', color: colors.mutedForeground, fontSize: 12 }}>
                  {language === 'ar' ? 'لا توجد نتائج' : 'No results'}
                </Text>
              ) : (
                filteredItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => onSelect(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: '500' }}>
                        {language === 'ar' && item.name_ar ? item.name_ar : item.name}
                      </Text>
                      {item.unit && <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{item.unit}</Text>}
                    </View>
                    {selectedItem?.id === item.id && <Check size={14} color={colors.primary} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={editingProduct ? t('editProduct') : t('addProduct')}
      height="90%"
      scrollable={false}
    >
      {/* Error Banner */}
      {error && (
        <View style={{ backgroundColor: `${colors.destructive}15`, padding: 12, marginBottom: 12, borderRadius: 10 }}>
          <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {/* Image Picker */}
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 100, height: 100, borderRadius: 16, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 12, overflow: 'hidden', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border }}>
                    {imagePreview ? (
                      <View style={{ width: '100%', height: '100%' }}>
                        <Image source={{ uri: imagePreview }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        <TouchableOpacity style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.destructive, justifyContent: 'center', alignItems: 'center' }} onPress={removeImage}>
                          <X size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Camera size={32} color={colors.mutedForeground} />
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.secondary }} onPress={() => pickImage(false)}>
                      <ImagePlus size={16} color={colors.foreground} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.foreground }}>{language === 'ar' ? 'معرض' : 'Gallery'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.secondary }} onPress={() => pickImage(true)}>
                      <Camera size={16} color={colors.foreground} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.foreground }}>{language === 'ar' ? 'كاميرا' : 'Camera'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Basic Info */}
                <View style={modalStyles.field}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('productName')}</Text>
                  <TextInput style={[modalStyles.input, isRTL && styles.rtlText]} value={name} onChangeText={setName} placeholder={t('enterProductName')} placeholderTextColor={colors.mutedForeground} textAlign={isRTL ? 'right' : 'left'} />
                </View>

                <View style={modalStyles.field}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('productNameAr')}</Text>
                  <TextInput style={[modalStyles.input, { textAlign: 'right' }]} value={nameAr} onChangeText={setNameAr} placeholder="أدخل اسم المنتج" placeholderTextColor={colors.mutedForeground} />
                </View>

                <View style={modalStyles.field}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('description')}</Text>
                  <TextInput style={[modalStyles.input, modalStyles.textArea, isRTL && styles.rtlText]} value={description} onChangeText={setDescription} placeholder={t('enterDescription')} placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlign={isRTL ? 'right' : 'left'} />
                </View>

                <View style={modalStyles.field}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('price')} ({currency})</Text>
                  <View style={[modalStyles.inputWithCurrency, isRTL && styles.rtlRow]}>
                    <Text style={modalStyles.currencyPrefix}>{currency}</Text>
                    <TextInput style={[modalStyles.inputNoBorder, isRTL && styles.rtlText]} value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" textAlign={isRTL ? 'right' : 'left'} />
                  </View>
                </View>

                {/* Category */}
                <View style={modalStyles.field}>
                  <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('category')}</Text>
                  <TouchableOpacity style={[modalStyles.picker, isRTL && styles.rtlRow]} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                    <Text style={[modalStyles.pickerText, isRTL && styles.rtlText]}>{getCategoryName(categoryId)}</Text>
                    <ChevronDown size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {showCategoryPicker && (
                    <View style={modalStyles.pickerOptions}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 200 }}>
                        {categories.map(cat => (
                          <TouchableOpacity key={cat.id} style={[modalStyles.pickerOption, categoryId === cat.id && modalStyles.pickerOptionActive]} onPress={() => { setCategoryId(cat.id); setShowCategoryPicker(false); }}>
                            <Text style={[modalStyles.pickerOptionText, categoryId === cat.id && modalStyles.pickerOptionTextActive]}>{language === 'ar' && cat.name_ar ? cat.name_ar : cat.name}</Text>
                            {categoryId === cat.id && <Check size={16} color={colors.primary} />}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Variants Toggle */}
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }}>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                    <Layers size={20} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{language === 'ar' ? 'تفعيل الأحجام' : 'Enable Variants'}</Text>
                  </View>
                  <Switch value={hasVariants} onValueChange={(val) => { setHasVariants(val); if (val && variants.length === 0) addVariant(); }} trackColor={{ false: colors.secondary, true: colors.primary }} thumbColor={hasVariants ? colors.primaryForeground : colors.foreground} />
                </View>

                {/* Variants Section */}
                {hasVariants && (
                  <View style={{ marginBottom: 20, padding: 12, backgroundColor: colors.secondary, borderRadius: 12 }}>
                    {variants.map((variant, vIndex) => (
                      <View key={variant.id} style={{ backgroundColor: colors.card, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: colors.muted, borderTopLeftRadius: 10, borderTopRightRadius: 10 }} onPress={() => updateVariant(variant.id, { isExpanded: !variant.isExpanded })}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{language === 'ar' ? 'صنف' : 'Variant'} {vIndex + 1}: {variant.name || (language === 'ar' ? 'بدون اسم' : 'Unnamed')}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity onPress={() => removeVariant(variant.id)}><Trash2 size={16} color={colors.destructive} /></TouchableOpacity>
                            {variant.isExpanded ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
                          </View>
                        </TouchableOpacity>
                        {variant.isExpanded && (
                          <View style={{ padding: 12 }}>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                              <TextInput style={[modalStyles.input, { flex: 1, paddingVertical: 8 }]} value={variant.name} onChangeText={(val) => updateVariant(variant.id, { name: val })} placeholder={language === 'ar' ? 'الاسم' : 'Name'} placeholderTextColor={colors.mutedForeground} />
                              <TextInput style={[modalStyles.input, { width: 70, paddingVertical: 8, textAlign: 'center' }]} value={variant.price_adjustment ? variant.price_adjustment.toString() : ''} onChangeText={(val) => { if (val === '' || /^-?\d*\.?\d*$/.test(val)) updateVariant(variant.id, { price_adjustment: val === '' ? 0 : parseFloat(val) || 0 }); }} placeholder="+/- 0" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 8 }}>{language === 'ar' ? 'المكونات' : 'INGREDIENTS'}</Text>
                            {variant.ingredients.map((ing) => (
                              <View key={ing.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, backgroundColor: colors.background, padding: 6, borderRadius: 8 }}>
                                <View style={{ flex: 1 }}>
                                  <ItemDropdown dropdownKey={`${variant.id}-${ing.id}`} selectedItem={ing.item} onSelect={(item) => selectItemForVariantIngredient(variant.id, ing.id, item)} itemsList={foodItems} />
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                  <TextInput style={[modalStyles.input, { width: 45, paddingVertical: 5, textAlign: 'center', fontSize: 11 }]} value={ing.quantity ? ing.quantity.toString() : ''} onChangeText={(val) => { if (val === '' || /^\d*\.?\d*$/.test(val)) updateVariantIngredient(variant.id, ing.id, { quantity: val === '' ? 0 : parseFloat(val) }); }} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
                                  {ing.item?.unit && <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{ing.item.unit}</Text>}
                                </View>
                                <TouchableOpacity style={{ padding: 3 }} onPress={() => updateVariantIngredient(variant.id, ing.id, { removable: !ing.removable })}>
                                  <View style={{ width: 16, height: 16, borderRadius: 3, borderWidth: 2, borderColor: ing.removable ? colors.primary : colors.border, backgroundColor: ing.removable ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                                    {ing.removable && <Check size={10} color={colors.primaryForeground} />}
                                  </View>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => removeVariantIngredient(variant.id, ing.id)}><Trash2 size={14} color={colors.destructive} /></TouchableOpacity>
                              </View>
                            ))}
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 8, marginTop: 8 }} onPress={() => addVariantIngredient(variant.id)}>
                              <Plus size={14} color={colors.primary} />
                              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{language === 'ar' ? 'إضافة مكون' : 'Add Ingredient'}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 10, marginTop: 4 }} onPress={addVariant}>
                      <Plus size={16} color={colors.primary} />
                      <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>{language === 'ar' ? 'إضافة صنف' : 'Add Variant'}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Ingredients Section (when no variants) */}
                {!hasVariants && (
                  <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Package size={18} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{language === 'ar' ? 'المكونات (الوصفة)' : 'Ingredients (Recipe)'}</Text>
                    </View>
                    <View style={{ padding: 12, backgroundColor: colors.secondary, borderRadius: 12 }}>
                      {ingredients.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: colors.mutedForeground, paddingVertical: 20, fontSize: 13 }}>{language === 'ar' ? 'لم تتم إضافة مكونات بعد' : 'No ingredients added yet'}</Text>
                      ) : (
                        ingredients.map((ing) => (
                          <View key={ing.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: colors.background, padding: 8, borderRadius: 8 }}>
                            <View style={{ flex: 1 }}>
                              <ItemDropdown dropdownKey={ing.id} selectedItem={ing.item} onSelect={(item) => selectItemForIngredient(ing.id, item)} itemsList={foodItems} />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <TextInput style={[modalStyles.input, { width: 50, paddingVertical: 6, textAlign: 'center' }]} value={ing.quantity ? ing.quantity.toString() : ''} onChangeText={(val) => { if (val === '' || /^\d*\.?\d*$/.test(val)) updateIngredient(ing.id, { quantity: val === '' ? 0 : parseFloat(val) }); }} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
                              {ing.item?.unit && <Text style={{ fontSize: 11, color: colors.mutedForeground, minWidth: 20 }}>{ing.item.unit}</Text>}
                            </View>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }} onPress={() => updateIngredient(ing.id, { removable: !ing.removable })}>
                              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: ing.removable ? colors.primary : colors.border, backgroundColor: ing.removable ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                                {ing.removable && <Check size={12} color={colors.primaryForeground} />}
                              </View>
                              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{language === 'ar' ? 'قابل للإزالة' : 'Removable'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeIngredient(ing.id)}><Trash2 size={18} color={colors.destructive} /></TouchableOpacity>
                          </View>
                        ))
                      )}
                      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 10, marginTop: 8 }} onPress={addIngredient}>
                        <Plus size={16} color={colors.primary} />
                        <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>{language === 'ar' ? 'إضافة مكون' : 'Add Ingredient'}</Text>
                      </TouchableOpacity>
                      {ingredients.length > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{language === 'ar' ? 'التكلفة:' : 'Cost:'} <Text style={{ fontWeight: '600', color: colors.foreground }}>{currency} {calculateCost(ingredients).toFixed(3)}</Text></Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Modifiers Section */}
                <View style={{ marginBottom: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Plus size={18} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{language === 'ar' ? 'الإضافات' : 'Add-ons (Extras)'}</Text>
                  </View>
                  <View style={{ padding: 12, backgroundColor: colors.secondary, borderRadius: 12 }}>
                    {modifiers.length === 0 ? (
                      <Text style={{ textAlign: 'center', color: colors.mutedForeground, paddingVertical: 16, fontSize: 13 }}>{language === 'ar' ? 'لم تتم إضافة إضافات بعد' : 'No add-ons configured'}</Text>
                    ) : (
                      modifiers.map((mod) => (
                        <View key={mod.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: colors.background, padding: 8, borderRadius: 8 }}>
                          <View style={{ flex: 1 }}>
                            <ItemDropdown dropdownKey={`mod-${mod.id}`} selectedItem={mod.item} onSelect={(item) => selectItemForModifier(mod.id, item)} itemsList={foodItems} />
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingLeft: 6 }}>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: '500' }}>+{currency}</Text>
                            <TextInput style={[modalStyles.input, { width: 50, paddingVertical: 6, paddingHorizontal: 4, textAlign: 'center', borderWidth: 0, backgroundColor: 'transparent' }]} value={mod.extra_price ? mod.extra_price.toString() : ''} onChangeText={(val) => { if (val === '' || /^\d*\.?\d*$/.test(val)) updateModifier(mod.id, { extra_price: val === '' ? 0 : parseFloat(val) }); }} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
                          </View>
                          <TouchableOpacity onPress={() => removeModifier(mod.id)}><Trash2 size={18} color={colors.destructive} /></TouchableOpacity>
                        </View>
                      ))
                    )}
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 10, marginTop: 8 }} onPress={addModifier}>
                      <Plus size={16} color={colors.primary} />
                      <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>{language === 'ar' ? 'إضافة عنصر إضافي' : 'Add Extra Item'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Accessories Section */}
                <View style={{ marginBottom: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <ShoppingBag size={18} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{language === 'ar' ? 'مستلزمات التعبئة' : 'Accessories (Packaging)'}</Text>
                  </View>
                  <View style={{ padding: 12, backgroundColor: `${colors.primary}10`, borderRadius: 12 }}>
                    {nonFoodItems.length === 0 ? (
                      <Text style={{ textAlign: 'center', color: colors.mutedForeground, paddingVertical: 16, fontSize: 13 }}>{language === 'ar' ? 'لا توجد مواد غير غذائية متاحة' : 'No non-food items available'}</Text>
                    ) : accessories.length === 0 ? (
                      <Text style={{ textAlign: 'center', color: colors.mutedForeground, paddingVertical: 16, fontSize: 13 }}>{language === 'ar' ? 'لم تتم إضافة مستلزمات بعد' : 'No accessories configured'}</Text>
                    ) : (
                      accessories.map((acc) => (
                        <View key={acc.id} style={{ backgroundColor: colors.card, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <ItemDropdown dropdownKey={`acc-${acc.id}`} selectedItem={acc.item} onSelect={(item) => selectItemForAccessory(acc.id, item)} itemsList={nonFoodItems} placeholder={language === 'ar' ? 'اختر مادة تعبئة' : 'Select packaging item'} />
                            <TextInput style={[modalStyles.input, { width: 50, paddingVertical: 6, textAlign: 'center' }]} value={acc.quantity ? acc.quantity.toString() : ''} onChangeText={(val) => { if (val === '' || /^\d+$/.test(val)) updateAccessory(acc.id, { quantity: val === '' ? 1 : parseInt(val) }); }} placeholder="1" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" />
                            <TouchableOpacity onPress={() => removeAccessory(acc.id)}><Trash2 size={18} color={colors.destructive} /></TouchableOpacity>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, alignSelf: 'center' }}>{language === 'ar' ? 'خصم عند:' : 'Deduct for:'}</Text>
                            {(['always', 'dine_in', 'takeaway', 'delivery'] as AccessoryOrderType[]).map((orderType) => (
                              <TouchableOpacity key={orderType} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: acc.applicable_order_types.includes(orderType) ? colors.primary : colors.secondary }} onPress={() => toggleOrderType(acc.id, orderType)}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: acc.applicable_order_types.includes(orderType) ? colors.primaryForeground : colors.mutedForeground }}>
                                  {orderType === 'always' && (language === 'ar' ? 'دائماً' : 'Always')}
                                  {orderType === 'dine_in' && (language === 'ar' ? 'محلي' : 'Dine-in')}
                                  {orderType === 'takeaway' && (language === 'ar' ? 'سفري' : 'Takeaway')}
                                  {orderType === 'delivery' && (language === 'ar' ? 'توصيل' : 'Delivery')}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))
                    )}
                    {nonFoodItems.length > 0 && (
                      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 10, marginTop: 4 }} onPress={addAccessory}>
                        <Plus size={16} color={colors.primary} />
                        <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>{language === 'ar' ? 'إضافة مستلزم' : 'Add Accessory'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
      </ScrollView>

      {/* Footer */}
      <View style={modalStyles.footer}>
        <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
          <Text style={modalStyles.cancelButtonText}>{t('cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[modalStyles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          <Text style={modalStyles.saveButtonText}>{saving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t('save')}</Text>
        </TouchableOpacity>
      </View>
    </BaseModal>
  );
}

// Product Details Modal
function ProductDetailsModal({ visible, product, onClose, onEdit, onDelete, isRTL, language, t, formatCurrency, colors, styles, modalStyles }: {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isRTL: boolean;
  language: string;
  t: (key: string) => string;
  formatCurrency: (amount: number) => string;
  colors: any;
  styles: any;
  modalStyles: any;
}) {
  if (!visible || !product) return null;

  // margin_percent comes from backend API - no frontend calculations
  const margin = (product as any).margin_percent ?? 0; // Backend provides margin, default to 0 if unavailable

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={language === 'ar' && product.name_ar ? product.name_ar : product.name}
      height="75%"
    >
      {/* Image */}
      <View style={modalStyles.detailsImageContainer}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={modalStyles.detailsImage}
            resizeMode="cover"
          />
        ) : (
          <View style={modalStyles.detailsImagePlaceholder}>
            <ImageIcon size={48} color={colors.border} />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={modalStyles.detailsContent}>
        {product.category && (
          <View style={modalStyles.categoryBadge}>
            <Text style={modalStyles.categoryBadgeText}>{product.category}</Text>
          </View>
        )}

        {product.description && (
          <Text style={[modalStyles.detailsDescription, isRTL && styles.rtlText]}>
            {product.description}
          </Text>
        )}

        <View style={[modalStyles.priceRow, isRTL && styles.rtlRow]}>
          <View>
            <Text style={modalStyles.priceLabel}>{t('price')}</Text>
            <Text style={modalStyles.priceValue}>{formatCurrency(product.price)}</Text>
          </View>
          {product.cost && (
            <View style={isRTL ? { alignItems: 'flex-start' } : { alignItems: 'flex-end' }}>
              <Text style={modalStyles.priceLabel}>{t('margin')}</Text>
              <Text style={[modalStyles.marginValue, {
                color: margin >= 30 ? '#22c55e' : margin >= 15 ? '#f59e0b' : '#ef4444'
              }]}>
                {margin.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={modalStyles.actionsRow}>
          <TouchableOpacity style={modalStyles.editButton} onPress={onEdit}>
            <Edit2 size={18} color={colors.primaryForeground} />
            <Text style={modalStyles.editButtonText}>{t('editProduct')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={modalStyles.deleteButton} onPress={onDelete}>
            <Trash2 size={18} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    </BaseModal>
  );
}

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
  content: {
    flex: 1,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingBottom: 100,
  },
  productRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  flatListContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  productCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 16,
    margin: 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productImageContainer: {
    height: 120,
    backgroundColor: colors.secondary,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  productActionButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionButton: {
    backgroundColor: colors.surface,
  },
  variantBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  variantBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 8,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  marginBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  marginText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  statValue: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    width: '100%',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.foreground,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  headerAddButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
  },
  skeletonGrid: {
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

const createModalStyles = (colors: any) => StyleSheet.create({
  // Note: overlay, container, header, title, content removed - now handled by BaseModal
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
  inputWithCurrency: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingLeft: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginRight: 8,
  },
  inputNoBorder: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
    fontSize: 15,
    color: colors.foreground,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
    overflow: 'hidden',
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
  // Details modal styles - detailsContainer removed, now handled by BaseModal
  detailsImageContainer: {
    height: 180,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  detailsImage: {
    width: '100%',
    height: '100%',
  },
  detailsImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // closeButton removed - now handled by BaseModal
  detailsContent: {
    // padding removed - BaseModal handles padding
  },
  // detailsName removed - BaseModal title handles this
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  categoryBadgeText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  detailsDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 12,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
  },
  marginValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  deleteButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.destructive}15`,
    borderRadius: 12,
  },
});


