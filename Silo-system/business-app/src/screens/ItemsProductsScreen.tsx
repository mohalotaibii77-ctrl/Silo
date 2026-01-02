import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  Modal, 
  Alert, 
  TextInput,
  RefreshControl,
  Animated,
  Dimensions
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { colors as staticColors } from '../theme/colors';
import api from '../api/client';
import { useLocalization } from '../localization/LocalizationContext';
import { useConfig } from '../context/ConfigContext';
import { safeGoBack } from '../utils/navigationHelpers';
import {
  Package,
  Layers,
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
  DollarSign,
  Box,
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

interface CompositeItemComponent {
  id: number;
  composite_item_id: number;
  component_item_id: number;
  quantity: number;
  component_item?: Item;
}

interface CompositeItem extends Item {
  components: CompositeItemComponent[];
  batch_price?: number;
  unit_price?: number;
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
}

interface Category {
  id: number;
  name: string;
  name_ar?: string;
}

type TabType = 'items' | 'composite' | 'products';

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

const ItemSkeleton = ({ styles }: { styles: any }) => (
  <View style={styles.itemCard}>
    <View style={styles.itemCardContent}>
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={60} height={20} borderRadius={6} />
    </View>
  </View>
);

export default function ItemsProductsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t, isRTL, language, formatCurrency, currency } = useLocalization();
  const { config, getCategoryLabel } = useConfig();
  
  // Get categories and units from config (with fallbacks)
  const itemCategories = config?.itemCategories || [];
  const servingUnits = config?.servingUnits || [];
  
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Items state
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  
  // Composite items state
  const [compositeItems, setCompositeItems] = useState<Item[]>([]);
  const [compositeLoading, setCompositeLoading] = useState(true);
  
  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Modal states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddCompositeModal, setShowAddCompositeModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodeItem, setBarcodeItem] = useState<Item | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      fetchItems(),
      fetchCompositeItems(),
      fetchProducts(),
      fetchCategories(),
    ]);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  }, []);

  const fetchItems = async () => {
    setItemsLoading(true);
    try {
      // Fetch all items with limit=1000 to ensure all items are loaded
      const response = await api.get('/inventory/items?limit=1000');
      const allItems = response.data.data || [];
      // Filter out composite items
      setItems(allItems.filter((item: Item) => !item.is_composite && item.status === 'active'));
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchCompositeItems = async () => {
    setCompositeLoading(true);
    try {
      // Use dedicated composite items endpoint
      const response = await api.get('/inventory/composite-items');
      setCompositeItems(response.data.data || []);
    } catch (error) {
      console.error('Error fetching composite items:', error);
    } finally {
      setCompositeLoading(false);
    }
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const response = await api.get('/store-products');
      setProducts(response.data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
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

  const handleDeleteProduct = async (productId: number) => {
    Alert.alert(
      t('editProduct'),
      t('confirmDelete'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('deleteItem'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/store-products/${productId}`);
              fetchProducts();
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

  // Get category label using config context
  const getCategoryLabelLocal = (category: string) => {
    return getCategoryLabel(category, language as 'en' | 'ar');
  };

  // Filter items based on search
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.name_ar && item.name_ar.includes(searchQuery))
  );

  const filteredCompositeItems = compositeItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.name_ar && item.name_ar.includes(searchQuery))
  );

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.name_ar && product.name_ar.includes(searchQuery))
  );

  const renderTabs = () => (
    <View style={[styles.tabContainer, isRTL && styles.rtlRow]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'items' && styles.tabActive]}
        onPress={() => setActiveTab('items')}
      >
        <Package size={18} color={activeTab === 'items' ? colors.background : colors.mutedForeground} />
        <Text style={[styles.tabText, activeTab === 'items' && styles.tabTextActive]}>
          {t('itemsTab')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'composite' && styles.tabActive]}
        onPress={() => setActiveTab('composite')}
      >
        <Layers size={18} color={activeTab === 'composite' ? colors.background : colors.mutedForeground} />
        <Text style={[styles.tabText, activeTab === 'composite' && styles.tabTextActive]}>
          {t('compositeItemsTab')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'products' && styles.tabActive]}
        onPress={() => setActiveTab('products')}
      >
        <ShoppingBag size={18} color={activeTab === 'products' ? colors.background : colors.mutedForeground} />
        <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
          {t('productsTab')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderItemCard = (item: Item, isComposite: boolean = false) => (
    <View key={item.id} style={styles.itemCard}>
      <View style={[styles.itemCardContent, isRTL && styles.rtlRow]}>
        <View style={[styles.itemIcon, { backgroundColor: isComposite ? '#8b5cf615' : '#3b82f615' }]}>
          {isComposite ? (
            <Layers size={22} color="#8b5cf6" />
          ) : (
            <Package size={22} color="#3b82f6" />
          )}
        </View>
        <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
          <Text style={[styles.itemName, isRTL && styles.rtlText]} numberOfLines={1}>
            {language === 'ar' && item.name_ar ? item.name_ar : item.name}
          </Text>
          <Text style={[styles.itemCategory, isRTL && styles.rtlText]}>
            {getCategoryLabel(item.category)}
          </Text>
        </View>
        <View style={[styles.itemPriceContainer, isRTL && { alignItems: 'flex-start' }]}>
          <Text style={styles.itemPrice}>
            {formatCurrency(item.effective_price || item.cost_per_unit)}
          </Text>
          <Text style={styles.itemUnit}>/{item.unit}</Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setBarcodeItem(item);
              setShowBarcodeModal(true);
            }}
          >
            <Barcode size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setEditingItem(item);
              if (isComposite) {
                setShowAddCompositeModal(true);
              } else {
                setShowAddItemModal(true);
              }
            }}
          >
            <Edit2 size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteItem(item.id)}
          >
            <Trash2 size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderProductCard = (product: Product) => (
    <View key={product.id} style={styles.itemCard}>
      <View style={[styles.itemCardContent, isRTL && styles.rtlRow]}>
        <View style={[styles.itemIcon, { backgroundColor: '#22c55e15' }]}>
          <ShoppingBag size={22} color="#22c55e" />
        </View>
        <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
          <Text style={[styles.itemName, isRTL && styles.rtlText]} numberOfLines={1}>
            {language === 'ar' && product.name_ar ? product.name_ar : product.name}
          </Text>
          <Text style={[styles.itemCategory, isRTL && styles.rtlText]}>
            {product.category || 'Uncategorized'}
          </Text>
        </View>
        <View style={[styles.itemPriceContainer, isRTL && { alignItems: 'flex-start' }]}>
          <Text style={[styles.itemPrice, { color: '#22c55e' }]}>
            {formatCurrency(product.price)}
          </Text>
          {product.cost && (
            <Text style={styles.itemCost}>
              Cost: {formatCurrency(product.cost)}
            </Text>
          )}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              setEditingProduct(product);
              setShowAddProductModal(true);
            }}
          >
            <Edit2 size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteProduct(product.id)}
          >
            <Trash2 size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'items':
        return (
          <View style={styles.tabContent}>
            {itemsLoading ? (
              <>
                <ItemSkeleton styles={styles} />
                <ItemSkeleton styles={styles} />
                <ItemSkeleton styles={styles} />
              </>
            ) : filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>{t('noItems')}</Text>
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
                <ItemSkeleton styles={styles} />
                <ItemSkeleton styles={styles} />
                <ItemSkeleton styles={styles} />
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
      case 'products':
        return (
          <View style={styles.tabContent}>
            {productsLoading ? (
              <>
                <ItemSkeleton styles={styles} />
                <ItemSkeleton styles={styles} />
                <ItemSkeleton styles={styles} />
              </>
            ) : filteredProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <ShoppingBag size={48} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>{t('noProducts')}</Text>
              </View>
            ) : (
              filteredProducts.map(product => renderProductCard(product))
            )}
          </View>
        );
    }
  };

  const getAddButtonText = () => {
    switch (activeTab) {
      case 'items': return t('addItem');
      case 'composite': return t('addCompositeItem');
      case 'products': return t('addProduct');
    }
  };

  const handleAddPress = () => {
    setEditingItem(null);
    setEditingProduct(null);
    switch (activeTab) {
      case 'items':
        setShowAddItemModal(true);
        break;
      case 'composite':
        setShowAddCompositeModal(true);
        break;
      case 'products':
        setShowAddProductModal(true);
        break;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
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
            {t('itemsAndProducts')}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        
        {/* Search */}
        <View style={[styles.searchContainer, isRTL && styles.rtlRow]}>
          <Search size={20} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, isRTL && styles.rtlText]}
            placeholder={activeTab === 'products' ? t('searchProducts') : t('searchItems')}
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

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {renderContent()}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
        <Plus size={24} color="#fff" />
        <Text style={styles.addButtonText}>{getAddButtonText()}</Text>
      </TouchableOpacity>

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
        t={t}
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
        t={t}
        config={config}
      />

      {/* Add Product Modal */}
      <AddProductModal
        visible={showAddProductModal}
        onClose={() => {
          setShowAddProductModal(false);
          setEditingProduct(null);
        }}
        onSave={() => {
          setShowAddProductModal(false);
          setEditingProduct(null);
          fetchProducts();
        }}
        editingProduct={editingProduct}
        categories={categories}
        items={[...items, ...compositeItems]}
        isRTL={isRTL}
        language={language}
        t={t}
        currency={currency}
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
        t={t}
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

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={[modalStyles.header, isRTL && styles.rtlRow]}>
            <Text style={[modalStyles.title, isRTL && styles.rtlText]}>
              {editingItem ? t('editItem') : t('addItem')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
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
              <View style={[modalStyles.inputWithIcon, isRTL && styles.rtlRow]}>
                <Text style={modalStyles.currencyPrefix}>{currency}</Text>
                <TextInput
                  style={[modalStyles.inputNoBorder, isRTL && styles.rtlText]}
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
        </View>
      </View>
    </Modal>
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
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [batchQuantity, setBatchQuantity] = useState('');
  const [batchUnit, setBatchUnit] = useState<string>('grams');
  const [components, setComponents] = useState<{ item_id: number; quantity: number }[]>([]);
  
  // Get config values with fallbacks
  const itemCategories = config?.itemCategories || [];
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
        
        // Fetch components from API
        setLoadingComponents(true);
        try {
          const response = await api.get(`/inventory/composite-items/${editingItem.id}`);
          const itemWithComponents = response.data.data;
          if (itemWithComponents?.components) {
            setComponents(itemWithComponents.components.map((c: any) => ({
              item_id: c.component_item_id,
              quantity: c.quantity,
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
    setComponents([...components, { item_id: item.id, quantity: 1 }]);
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

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={[modalStyles.header, isRTL && styles.rtlRow]}>
            <Text style={[modalStyles.title, isRTL && styles.rtlText]}>
              {editingItem ? t('editCompositeItem') : t('addCompositeItem')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.content} showsVerticalScrollIndicator={false}>
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
                <TouchableOpacity 
                  style={[modalStyles.unitPicker]}
                  onPress={() => {}}
                >
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
        </View>
      </View>
    </Modal>
  );
}

// Add Product Modal Component
function AddProductModal({ visible, onClose, onSave, editingProduct, categories, items, isRTL, language, t, currency }: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editingProduct: Product | null;
  categories: Category[];
  items: Item[];
  isRTL: boolean;
  language: string;
  t: (key: string) => string;
  currency: string;
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
    if (!id) return 'Select Category';
    const cat = categories.find(c => c.id === id);
    if (!cat) return 'Unknown';
    return language === 'ar' && cat.name_ar ? cat.name_ar : cat.name;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
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
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>Product Name</Text>
              <TextInput
                style={[modalStyles.input, isRTL && styles.rtlText]}
                value={name}
                onChangeText={setName}
                placeholder="Enter product name"
                placeholderTextColor={colors.mutedForeground}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Name Arabic */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>Product Name (Arabic)</Text>
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
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>Description</Text>
              <TextInput
                style={[modalStyles.input, modalStyles.textArea, isRTL && styles.rtlText]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Price */}
            <View style={modalStyles.field}>
              <Text style={[modalStyles.label, isRTL && styles.rtlText]}>{t('price')} ({currency})</Text>
              <View style={[modalStyles.inputWithIcon, isRTL && styles.rtlRow]}>
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
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
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
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          {/* Header */}
          <View style={modalStyles.header}>
            <View style={modalStyles.headerIcon}>
              <Barcode size={22} color={colors.primary} />
            </View>
            <View style={modalStyles.headerTextContainer}>
              <Text style={modalStyles.title}>
                {language === 'ar' ? 'الباركود' : 'Barcode'}
              </Text>
              <Text style={modalStyles.subtitle} numberOfLines={1}>
                {itemName}
              </Text>
            </View>
            <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
              <X size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Content */}
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
        </View>
      </View>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.foreground,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.background,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 100,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  itemCategory: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  itemPriceContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  itemUnit: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  itemCost: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${colors.primary}15`,
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
    color: colors.mutedForeground,
    marginTop: 12,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  inputNoBorder: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.mutedForeground,
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
    color: '#fff',
  },
});




