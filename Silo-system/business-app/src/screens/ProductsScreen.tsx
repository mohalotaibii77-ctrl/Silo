import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  Platform, 
  Modal, 
  Alert, 
  TextInput,
  Animated,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { colors as staticColors } from '../theme/colors';
import api from '../api/client';
import { cacheManager, CACHE_TTL, CacheKeys } from '../services/CacheManager';
import { useLocalization } from '../localization/LocalizationContext';
import { safeGoBack } from '../utils/navigationHelpers';
import ProgressiveImage from '../components/ProgressiveImage';
import { usePaginatedProducts } from '../hooks';
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
  Check,
  ImageIcon,
  Layers
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Types
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
}

interface Category {
  id: number;
  name: string;
  name_ar?: string;
}

// Skeleton component
const Skeleton = ({ width: w, height, borderRadius = 8, style }: { width: number | string; height: number; borderRadius?: number; style?: any }) => {
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
      style={[{ width: w, height, borderRadius, backgroundColor: staticColors.border, opacity: pulseAnim }, style]}
    />
  );
};

const ProductSkeleton = ({ styles }: { styles: any }) => (
  <View style={styles.productCard}>
    <Skeleton width="100%" height={120} borderRadius={12} />
    <View style={{ padding: 12 }}>
      <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
      <Skeleton width="40%" height={12} style={{ marginBottom: 8 }} />
      <Skeleton width="50%" height={18} />
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
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchCategories(false);
  }, []);

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
              <Layers size={10} color="#fff" />
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
          <View style={[styles.productPriceRow, isRTL && styles.rtlRow]}>
            <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
            {product.cost && (
              <View style={[styles.marginBadge, { backgroundColor: `${getMarginColor(margin)}15` }]}>
                <Text style={[styles.marginText, { color: getMarginColor(margin) }]}>
                  {margin.toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [language, isRTL, formatCurrency, t, setSelectedProduct, setEditingProduct, setShowAddModal, handleDeleteProduct]);

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
          <View style={styles.productsGrid}>
            <ProductSkeleton styles={styles} />
            <ProductSkeleton styles={styles} />
            <ProductSkeleton styles={styles} />
            <ProductSkeleton styles={styles} />
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
          onRefresh={refresh}
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
          fetchProducts();
        }}
        editingProduct={editingProduct}
        categories={categories}
        isRTL={isRTL}
        language={language}
        t={t}
        colors={colors}
        styles={styles}
        modalStyles={modalStyles}
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
        t={t}
        formatCurrency={formatCurrency}
        colors={colors}
        styles={styles}
        modalStyles={modalStyles}
      />
    </View>
  );
}

// Add/Edit Product Modal
function AddProductModal({ visible, onClose, onSave, editingProduct, categories, isRTL, language, t, colors, styles, modalStyles }: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editingProduct: Product | null;
  categories: Category[];
  isRTL: boolean;
  language: string;
  t: (key: string) => string;
  colors: any;
  styles: any;
  modalStyles: any;
}) {
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setNameAr(editingProduct.name_ar || '');
      setDescription(editingProduct.description || '');
      setPrice(editingProduct.price.toString());
      setCategoryId(editingProduct.category_id || null);
    } else {
      setName('');
      setNameAr('');
      setDescription('');
      setPrice('');
      setCategoryId(null);
    }
  }, [editingProduct, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), 'Please enter product name');
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      Alert.alert(t('error'), 'Please enter a valid price');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        name_ar: nameAr.trim() || undefined,
        description: description.trim() || undefined,
        price: parseFloat(price),
        category_id: categoryId || undefined,
        has_variants: false,
      };

      if (editingProduct) {
        await api.put(`/store-products/${editingProduct.id}`, data);
      } else {
        await api.post('/store-products', data);
      }

      Alert.alert(t('success'), t('productSaved'));
      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert(t('error'), 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryName = (id: number | null) => {
    if (!id) return t('selectCategory');
    const cat = categories.find(c => c.id === id);
    if (!cat) return 'Unknown';
    return language === 'ar' && cat.name_ar ? cat.name_ar : cat.name;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={[modalStyles.header, isRTL && styles.rtlRow]}>
            <Text style={[modalStyles.title, isRTL && styles.rtlText]}>
              {editingProduct ? t('editProduct') : t('addProduct')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
            {/* Name */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('productName')}</Text>
              <TextInput
                style={[modalStyles.input, isRTL && styles.rtlText]}
                value={name}
                onChangeText={setName}
                placeholder={t('enterProductName')}
                placeholderTextColor={colors.mutedForeground}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Name Arabic */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('productNameAr')}</Text>
              <TextInput
                style={[modalStyles.input, { textAlign: 'right' }]}
                value={nameAr}
                onChangeText={setNameAr}
                placeholder="أدخل اسم المنتج"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Description */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('description')}</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.textArea, isRTL && styles.rtlText]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('enterDescription')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Price */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('price')} ({currency})</Text>
              <View style={[modalStyles.inputWithCurrency, isRTL && styles.rtlRow]}>
                <Text style={modalStyles.currencyPrefix}>{currency}</Text>
                <TextInput
                  style={[modalStyles.inputNoBorder, isRTL && styles.rtlText]}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  textAlign={isRTL ? 'right' : 'left'}
                />
              </View>
            </View>

            {/* Category */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('category')}</Text>
              <TouchableOpacity 
                style={[modalStyles.picker, isRTL && styles.rtlRow]}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={[modalStyles.pickerText, isRTL && styles.rtlText]}>
                  {getCategoryName(categoryId)}
                </Text>
                <ChevronDown size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={modalStyles.pickerOptions}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 200 }}>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[modalStyles.pickerOption, categoryId === cat.id && modalStyles.pickerOptionActive]}
                        onPress={() => {
                          setCategoryId(cat.id);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={[
                          modalStyles.pickerOptionText,
                          categoryId === cat.id && modalStyles.pickerOptionTextActive
                        ]}>
                          {language === 'ar' && cat.name_ar ? cat.name_ar : cat.name}
                        </Text>
                        {categoryId === cat.id && <Check size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
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
        </View>
      </View>
    </Modal>
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
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity 
        style={modalStyles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={modalStyles.detailsContainer} onStartShouldSetResponder={() => true}>
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
            <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
              <X size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={modalStyles.detailsContent}>
            <Text style={[modalStyles.detailsName, isRTL && styles.rtlText]}>
              {language === 'ar' && product.name_ar ? product.name_ar : product.name}
            </Text>
            
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
                <Edit2 size={18} color="#fff" />
                <Text style={modalStyles.editButtonText}>{t('editProduct')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={modalStyles.deleteButton} onPress={onDelete}>
                <Trash2 size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
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
    justifyContent: 'flex-start',
    paddingHorizontal: 6,
  },
  flatListContent: {
    padding: 12,
    paddingBottom: 100,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  productCard: {
    width: (width - 36) / 2,
    backgroundColor: colors.card,
    borderRadius: 16,
    margin: 6,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
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
    color: '#fff',
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
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

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
    color: '#fff',
  },
  // Details modal styles
  detailsContainer: {
    backgroundColor: colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  detailsImageContainer: {
    height: 200,
    backgroundColor: colors.secondary,
    position: 'relative',
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
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContent: {
    padding: 20,
  },
  detailsName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
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
    color: '#fff',
  },
  deleteButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.destructive}15`,
    borderRadius: 12,
  },
});


