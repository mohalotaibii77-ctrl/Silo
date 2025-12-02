import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  CreditCard,
  Banknote,
  Receipt,
  X,
  User,
  Clock,
  LogOut,
  Grid3X3,
  UtensilsCrossed,
  Coffee,
  IceCream,
  Beef,
  Salad,
  ChevronRight,
  CheckCircle,
  Printer,
  Check,
  Truck,
  Boxes,
} from 'lucide-react-native';
import { API_URL } from '../api/client';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;

// Menu categories - these will be dynamic based on products
const DEFAULT_CATEGORIES = [
  { id: 'all', name: 'All Products', icon: Grid3X3 },
];

// Product variant option
interface VariantOption {
  id: string;
  name: string;
  name_ar?: string;
  price_adjustment: number;
}

// Product variant group (e.g., "Size", "Type")
interface VariantGroup {
  id: string;
  name: string;
  name_ar?: string;
  required: boolean;
  options: VariantOption[];
}

// Product modifier (removable items)
interface ProductModifier {
  id: string;
  name: string;
  name_ar?: string;
  removable: boolean;
  addable: boolean;
  extra_price: number;
}

// Full product with variants and modifiers
interface Product {
  id: string;
  name: string;
  name_ar?: string;
  base_price: number;
  category_id?: string;
  category_name?: string;
  available: boolean;
  variant_groups: VariantGroup[];
  modifiers: ProductModifier[];
  isBundle?: boolean; // Flag to identify bundles
  bundleItems?: any[]; // Items included in the bundle
}

interface Category {
  id: string;
  name: string;
  icon: any;
}

// Cart item with selected variants and modifiers
interface CartItem {
  id: string; // unique cart item id
  productId: string;
  name: string;
  basePrice: number;
  quantity: number;
  selectedVariants: { groupName: string; optionName: string; priceAdjustment: number }[];
  removedModifiers: string[]; // names of removed items
  addedModifiers: { name: string; price: number }[]; // extra items added
  totalPrice: number; // calculated total per item
  isBundle?: boolean; // Flag to identify bundles in cart
  bundleItems?: any[]; // Items included in the bundle for receipt
}

interface OrderType {
  type: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: string;
  customerName?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
}

export default function POSScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>({ type: 'dine_in' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [currency, setCurrency] = useState('KWD');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0); // VAT rate from business settings
  
  // Customization modal state
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, VariantOption>>({});
  const [removedModifiers, setRemovedModifiers] = useState<Set<string>>(new Set());
  const [addedModifiers, setAddedModifiers] = useState<Set<string>>(new Set());
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    loadUser();
    loadBusinessSettings();
    loadProducts();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadBusinessSettings = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const businessData = await AsyncStorage.getItem('business');
      
      // First try to get from stored business data
      if (businessData) {
        const business = JSON.parse(businessData);
        if (business.currency) setCurrency(business.currency);
        // Check if VAT is enabled
        if (business.vat_enabled !== undefined) {
          setVatEnabled(business.vat_enabled);
          setTaxRate(business.vat_enabled ? (business.tax_rate || 0) : 0);
        }
      }
      
      // Then try to fetch fresh from API
      if (token && API_URL) {
        try {
          const response = await fetch(`${API_URL}/business-settings`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const result = await response.json();
          if (result.success && result.data) {
            if (result.data.currency) setCurrency(result.data.currency);
            // Apply VAT settings from store-setup
            const isVatEnabled = result.data.vat_enabled || false;
            setVatEnabled(isVatEnabled);
            setTaxRate(isVatEnabled ? (result.data.tax_rate || 0) : 0);
          }
        } catch (err) {
          console.log('Could not fetch business settings from API');
        }
      }
    } catch (error) {
      console.error('Error loading business settings:', error);
    }
  };

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const token = await AsyncStorage.getItem('token');
      
      if (token && API_URL) {
        let posProducts: Product[] = [];
        let posBundles: Product[] = [];

        // Fetch products from store-products endpoint
        try {
          const response = await fetch(`${API_URL}/store-products`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const result = await response.json();
          if (result.success && result.data) {
            // Transform products to POS format
            posProducts = result.data.map((p: any) => ({
              id: String(p.id),
              name: p.name,
              name_ar: p.name_ar,
              base_price: p.price,
              category_id: p.category_id ? String(p.category_id) : undefined,
              category_name: p.category_name || p.category,
              available: p.is_active !== false,
              // Map variants to variant_groups format
              variant_groups: p.has_variants && p.variants ? [{
                id: 'size',
                name: 'Size',
                name_ar: 'الحجم',
                required: true,
                options: p.variants.map((v: any) => ({
                  id: String(v.id),
                  name: v.name,
                  name_ar: v.name_ar,
                  price_adjustment: v.price_adjustment || 0,
                }))
              }] : [],
              // Map ingredients with removable flag + modifiers as combined modifiers for POS
              modifiers: [
                // Removable ingredients
                ...(p.ingredients || [])
                  .filter((ing: any) => ing.removable)
                  .map((ing: any) => ({
                    id: `ing-${ing.id || ing.item_id}`,
                    name: ing.item_name || ing.name,
                    name_ar: ing.item_name_ar || ing.name_ar,
                    removable: true,
                    addable: false,
                    extra_price: 0,
                  })),
                // Addable modifiers (add-ons)
                ...(p.modifiers || []).map((mod: any) => ({
                  id: `mod-${mod.id || mod.item_id}`,
                  name: mod.name,
                  name_ar: mod.name_ar,
                  removable: false,
                  addable: true,
                  extra_price: mod.extra_price || 0,
                }))
              ]
            }));
          }
        } catch (apiError) {
          console.log('Products API error:', apiError);
        }

        // Fetch bundles from bundles endpoint
        try {
          const bundlesResponse = await fetch(`${API_URL}/bundles`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const bundlesResult = await bundlesResponse.json();
          if (bundlesResult.success && bundlesResult.data) {
            // Transform bundles to POS format (bundles are simple - no variants/modifiers)
            posBundles = bundlesResult.data
              .filter((b: any) => b.is_active)
              .map((b: any) => ({
                id: `bundle-${b.id}`,
                name: b.name,
                name_ar: b.name_ar,
                base_price: b.price,
                category_id: 'bundles',
                category_name: 'Bundles',
                available: true,
                variant_groups: [],
                modifiers: [],
                isBundle: true, // Flag to identify bundles
                bundleItems: b.items, // Store bundle items for receipt
              }));
          }
        } catch (bundlesError) {
          console.log('Bundles API error:', bundlesError);
        }

        // Combine products and bundles
        const allItems = [...posProducts, ...posBundles];
        setProducts(allItems);
        
        // Build categories from products + add Bundles category if there are bundles
        const cats = new Set<string>();
        posProducts.forEach((p: Product) => {
          if (p.category_name) cats.add(p.category_name);
        });
        const categoryList = [
          DEFAULT_CATEGORIES[0],
          ...Array.from(cats).map(name => ({ id: name, name, icon: Grid3X3 }))
        ];
        // Add Bundles category if there are bundles
        if (posBundles.length > 0) {
          categoryList.push({ id: 'Bundles', name: 'Bundles', icon: Boxes });
        }
        setCategories(categoryList);
        return;
      }
      
      // No products found - show empty state
      setProducts([]);
      setCategories(DEFAULT_CATEGORIES);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category_name === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Handle product tap - bundles add directly, products show customization
  const handleProductTap = (product: Product) => {
    if (!product.available) {
      Alert.alert('Unavailable', 'This item is currently unavailable');
      return;
    }

    // Bundles: Add directly to cart (no customization)
    if (product.isBundle) {
      const cartItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        basePrice: product.base_price,
        quantity: 1,
        selectedVariants: [],
        removedModifiers: [],
        addedModifiers: [],
        totalPrice: product.base_price,
        isBundle: true,
        bundleItems: product.bundleItems,
      };
      setCart(prev => [...prev, cartItem]);
      return;
    }

    // Regular products: Show customization modal
    setSelectedProduct(product);
    // Pre-select first option for required variant groups
    const initialVariants: Record<string, VariantOption> = {};
    product.variant_groups.forEach(group => {
      if (group.required && group.options.length > 0) {
        initialVariants[group.id] = group.options[0];
      }
    });
    setSelectedVariants(initialVariants);
    setRemovedModifiers(new Set());
    setAddedModifiers(new Set());
    setShowCustomizeModal(true);
  };

  // Add a simple product (no variants) to cart
  const addSimpleProductToCart = (product: Product) => {
    const cartItem: CartItem = {
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      basePrice: product.base_price,
      quantity: 1,
      selectedVariants: [],
      removedModifiers: [],
      addedModifiers: [],
      totalPrice: product.base_price,
    };
    setCart(prev => [...prev, cartItem]);
  };

  // Calculate customized item price
  const calculateCustomizedPrice = () => {
    if (!selectedProduct) return 0;
    let price = selectedProduct.base_price;
    
    // Add variant price adjustments
    Object.values(selectedVariants).forEach(option => {
      price += option.price_adjustment;
    });
    
    // Add extra modifier prices
    selectedProduct.modifiers.forEach(mod => {
      if (addedModifiers.has(mod.id) && mod.addable) {
        price += mod.extra_price;
      }
    });
    
    return price;
  };

  // Add customized product to cart
  const addCustomizedToCart = () => {
    if (!selectedProduct) return;

    // Check all required variants are selected
    const missingRequired = selectedProduct.variant_groups.find(
      g => g.required && !selectedVariants[g.id]
    );
    if (missingRequired) {
      Alert.alert('Required', `Please select ${missingRequired.name}`);
      return;
    }

    const itemPrice = calculateCustomizedPrice();
    
    // Build variant display names
    const variantsList = Object.entries(selectedVariants).map(([groupId, option]) => {
      const group = selectedProduct.variant_groups.find(g => g.id === groupId);
      return {
        groupName: group?.name || '',
        optionName: option.name,
        priceAdjustment: option.price_adjustment,
      };
    });

    // Build modifier lists
    const removed = Array.from(removedModifiers).map(id => {
      const mod = selectedProduct.modifiers.find(m => m.id === id);
      return mod?.name || '';
    }).filter(Boolean);

    const added = Array.from(addedModifiers).map(id => {
      const mod = selectedProduct.modifiers.find(m => m.id === id);
      return mod ? { name: mod.name, price: mod.extra_price } : null;
    }).filter(Boolean) as { name: string; price: number }[];

    const cartItem: CartItem = {
      id: `${selectedProduct.id}-${Date.now()}`,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      basePrice: selectedProduct.base_price,
      quantity: 1,
      selectedVariants: variantsList,
      removedModifiers: removed,
      addedModifiers: added,
      totalPrice: itemPrice,
    };

    setCart(prev => [...prev, cartItem]);
    setShowCustomizeModal(false);
    setSelectedProduct(null);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
      return updated;
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);
  const tax = subtotal * (taxRate / 100); // Dynamic tax rate
  const total = subtotal + tax;
  
  // Helper function to format currency
  const formatPrice = (amount: number) => `${currency} ${amount.toFixed(2)}`;

  const processPayment = async (method: 'cash' | 'card') => {
    // Prevent double-clicks
    if (isProcessingPayment) {
      console.log('Already processing payment...');
      return;
    }
    
    setIsProcessingPayment(true);
    console.log('Processing payment:', method);
    
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token || !API_URL) {
        console.error('Not authenticated - no token or API_URL');
        if (Platform.OS === 'web') {
          window.alert('Not authenticated');
        } else {
          Alert.alert('Error', 'Not authenticated');
        }
        setIsProcessingPayment(false);
        return;
      }

      console.log('API_URL:', API_URL);
      console.log('Cart items:', cart.length);

      // Build order items for API
      const orderItems = cart.map(item => ({
        product_id: item.productId.startsWith('bundle-') ? null : parseInt(item.productId),
        product_name: item.name,
        product_category: item.isBundle ? 'Bundle' : undefined,
        quantity: item.quantity,
        unit_price: item.totalPrice, // Total price per item (with modifiers)
        special_instructions: [
          ...item.selectedVariants.map(v => v.optionName),
          ...item.removedModifiers.map(m => `No ${m}`),
          ...item.addedModifiers.map(m => `+${m.name}`),
        ].join(', ') || undefined,
        is_combo: item.isBundle || false,
        modifiers: item.addedModifiers.map(m => ({
          modifier_name: m.name,
          unit_price: m.price,
          quantity: 1,
        })),
      }));

      console.log('Sending order to API...');
      
      // Create order via API
      const response = await fetch(`${API_URL}/pos/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_source: 'pos',
          order_type: orderType.type,
          table_number: orderType.tableNumber,
          customer_name: orderType.customerName,
          delivery_address: orderType.deliveryAddress,
          customer_phone: orderType.deliveryPhone,
          items: orderItems,
          payment_method: method,
        }),
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
      }

      // Order created successfully
      setLastOrderNumber(result.data.order_number || result.data.display_number);
      setShowPaymentModal(false);
      setShowReceiptModal(true);

      // Mark as paid
      if (result.data.id) {
        await fetch(`${API_URL}/pos/orders/${result.data.id}/payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_method: method,
            amount: total,
          }),
        });
      }

    } catch (error: any) {
      console.error('Error creating order:', error);
      if (Platform.OS === 'web') {
        window.alert('Error: ' + (error.message || 'Failed to process payment'));
      } else {
        Alert.alert('Error', error.message || 'Failed to process payment');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const completeOrder = () => {
    setShowReceiptModal(false);
    setCart([]);
    setOrderType({ type: 'dine_in' });
    setLastOrderNumber(null);
    Alert.alert('Success', 'Order completed successfully!');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      flexDirection: 'row',
    },
    // Left Sidebar
    sidebar: {
      width: 72,
      backgroundColor: colors.card,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      alignItems: 'center',
      paddingVertical: 16,
      justifyContent: 'space-between',
    },
    sidebarTop: {
      alignItems: 'center',
      gap: 8,
    },
    logo: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    brandName: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.foreground,
      textAlign: 'center',
    },
    brandSubtitle: {
      fontSize: 9,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    sidebarBottom: {
      alignItems: 'center',
      gap: 12,
    },
    timeDisplay: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    timeIcon: {
      marginBottom: 4,
    },
    timeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.foreground,
      textAlign: 'center',
    },
    logoutBtn: {
      width: 44,
      height: 44,
      backgroundColor: colors.secondary,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Main Content Area
    mainContent: {
      flex: 1,
      flexDirection: 'row',
    },
    // Menu Panel
    menuPanel: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Cart Panel (Right Sidebar)
    cartPanel: {
      width: 320,
      backgroundColor: colors.card,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      flexDirection: 'column',
    },
    cartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cartTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.foreground,
    },
    cartCount: {
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    cartCountText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    orderTypeRow: {
      flexDirection: 'row',
      padding: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    orderTypeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      gap: 6,
    },
    orderTypeBtnActive: {
      backgroundColor: colors.primary,
    },
    orderTypeBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
    },
    orderTypeBtnTextActive: {
      color: colors.primaryForeground,
    },
    cartList: {
      flex: 1,
      padding: 12,
    },
    cartItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cartItemInfo: {
      flex: 1,
    },
    cartItemName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 2,
    },
    cartItemPrice: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    quantityControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    qtyBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      minWidth: 20,
      textAlign: 'center',
    },
    deleteBtn: {
      marginLeft: 6,
      padding: 4,
    },
    emptyCart: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    emptyCartText: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 10,
    },
    cartFooter: {
      padding: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    totalsLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    totalsValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.foreground,
    },
    totalValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    chargeBtn: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    chargeBtnDisabled: {
      opacity: 0.5,
    },
    chargeBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primaryForeground,
    },
    searchContainer: {
      padding: 16,
      backgroundColor: colors.card,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      marginLeft: 10,
      fontSize: 15,
      color: colors.foreground,
    },
    categoriesContainer: {
      backgroundColor: colors.card,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    categoriesList: {
      paddingHorizontal: 12,
    },
    categoryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      marginHorizontal: 4,
      backgroundColor: colors.secondary,
      gap: 8,
    },
    categoryBtnActive: {
      backgroundColor: colors.primary,
    },
    categoryText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    categoryTextActive: {
      color: colors.primaryForeground,
    },
    menuGrid: {
      padding: 12,
    },
    menuRow: {
      justifyContent: 'flex-start',
    },
    emptyMenu: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyMenuTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
      marginTop: 16,
      marginBottom: 8,
    },
    emptyMenuText: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: 'center',
      maxWidth: 280,
    },
    menuItem: {
      width: isTablet ? (width - 72 - 320 - 48) / 3 : (width - 48) / 2,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      margin: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    menuItemUnavailable: {
      opacity: 0.5,
    },
    menuItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      textAlign: 'center',
      marginBottom: 8,
    },
    menuItemPrice: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    unavailableBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: colors.destructive,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    unavailableText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#fff',
    },
    bundleBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: '#8B5CF6',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    bundleText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#fff',
    },
    bundleItemCount: {
      fontSize: 10,
      color: '#8B5CF6',
      marginTop: 2,
    },
    customizableTag: {
      fontSize: 10,
      color: colors.primary,
      marginTop: 4,
    },
    cartItemMods: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 2,
      marginBottom: 2,
    },
    // Customize Modal Styles
    customizeModalContent: {
      width: isTablet ? 420 : width - 32,
      maxHeight: height * 0.8,
      backgroundColor: colors.card,
      borderRadius: 20,
      overflow: 'hidden',
    },
    customizeHeader: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    customizeTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.foreground,
    },
    customizePrice: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    customizeBody: {
      padding: 16,
      maxHeight: height * 0.5,
    },
    variantSection: {
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.mutedForeground,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    optionBtnSelected: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    optionText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.foreground,
    },
    optionTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    optionPrice: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    modifierBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      gap: 6,
    },
    modifierBtnActive: {
      backgroundColor: colors.destructive + '20',
    },
    modifierBtnAdded: {
      backgroundColor: colors.primary + '20',
    },
    modifierText: {
      fontSize: 13,
      color: colors.foreground,
    },
    modifierTextRemoved: {
      textDecorationLine: 'line-through',
      color: colors.destructive,
    },
    customizeFooter: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    addToCartBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    addToCartText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primaryForeground,
    },
    // Cart styles (used in modal)
    cartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cartTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.foreground,
    },
    cartCount: {
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    cartCountText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    orderTypeRow: {
      flexDirection: 'row',
      padding: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    orderTypeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      gap: 8,
    },
    orderTypeBtnActive: {
      backgroundColor: colors.primary,
    },
    orderTypeBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    orderTypeBtnTextActive: {
      color: colors.primaryForeground,
    },
    cartList: {
      flex: 1,
      padding: 12,
    },
    cartItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cartItemInfo: {
      flex: 1,
    },
    cartItemName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 4,
    },
    cartItemPrice: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    quantityControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    qtyBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
      minWidth: 24,
      textAlign: 'center',
    },
    deleteBtn: {
      marginLeft: 8,
      padding: 6,
    },
    emptyCart: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyCartText: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 12,
    },
    cartFooter: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    totalsLabel: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    totalsValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.foreground,
    },
    totalValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    chargeBtn: {
      marginTop: 16,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    chargeBtnDisabled: {
      opacity: 0.5,
    },
    chargeBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primaryForeground,
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: isTablet ? 420 : width - 48,
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
    },
    closeBtn: {
      padding: 8,
      backgroundColor: colors.secondary,
      borderRadius: 10,
    },
    paymentOptions: {
      gap: 12,
    },
    paymentBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      borderRadius: 16,
      backgroundColor: colors.secondary,
      gap: 16,
    },
    paymentIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    paymentText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
    },
    paymentSubtext: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    // Receipt Modal
    receiptContent: {
      alignItems: 'center',
    },
    receiptIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#22c55e20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    receiptTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: 8,
    },
    receiptOrderNumber: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginBottom: 24,
    },
    receiptTotal: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 32,
    },
    receiptActions: {
      width: '100%',
      gap: 12,
    },
    printBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.secondary,
      gap: 10,
    },
    printBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.foreground,
    },
    doneBtn: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    doneBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
  });

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={[styles.menuItem, !item.available && styles.menuItemUnavailable]}
      onPress={() => handleProductTap(item)}
      activeOpacity={0.7}
    >
      {!item.available && (
        <View style={styles.unavailableBadge}>
          <Text style={styles.unavailableText}>Sold Out</Text>
        </View>
      )}
      {item.isBundle && (
        <View style={styles.bundleBadge}>
          <Text style={styles.bundleText}>Bundle</Text>
        </View>
      )}
      <Text style={styles.menuItemName}>{item.name}</Text>
      <Text style={styles.menuItemPrice}>{formatPrice(item.base_price)}</Text>
      {item.isBundle && item.bundleItems && (
        <Text style={styles.bundleItemCount}>{item.bundleItems.length} items</Text>
      )}
      {!item.isBundle && (item.variant_groups.length > 0 || item.modifiers.length > 0) && (
        <Text style={styles.customizableTag}>Customizable</Text>
      )}
    </TouchableOpacity>
  );

  // Get cart item display text with customizations
  const getCartItemDescription = (item: CartItem) => {
    // For bundles, show the items included
    if (item.isBundle && item.bundleItems && item.bundleItems.length > 0) {
      const bundleItemNames = item.bundleItems
        .map((bi: any) => `${bi.quantity}x ${bi.product?.name || 'Item'}`)
        .join(', ');
      return `Bundle: ${bundleItemNames}`;
    }

    const parts: string[] = [];
    
    // Add variants
    if (item.selectedVariants.length > 0) {
      parts.push(item.selectedVariants.map(v => v.optionName).join(', '));
    }
    
    // Add removed modifiers
    if (item.removedModifiers.length > 0) {
      parts.push(item.removedModifiers.map(m => `No ${m}`).join(', '));
    }
    
    // Add extra modifiers
    if (item.addedModifiers.length > 0) {
      parts.push(item.addedModifiers.map(m => `+${m.name}`).join(', '));
    }
    
    return parts.join(' • ');
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const description = getCartItemDescription(item);
    return (
      <View style={styles.cartItem}>
        <View style={styles.cartItemInfo}>
          <Text style={styles.cartItemName}>{item.name}</Text>
          {description ? (
            <Text style={styles.cartItemMods}>{description}</Text>
          ) : null}
          <Text style={styles.cartItemPrice}>{formatPrice(item.totalPrice)}</Text>
        </View>
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => updateQuantity(item.id, -1)}
          >
            <Minus size={16} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => updateQuantity(item.id, 1)}
          >
            <Plus size={16} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => removeFromCart(item.id)}
          >
            <Trash2 size={18} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Left Sidebar */}
      <View style={styles.sidebar}>
        <View style={styles.sidebarTop}>
          <View style={styles.logo}>
            <ShoppingCart size={26} color="#fff" />
          </View>
          <Text style={styles.brandName}>Silo POS</Text>
          <Text style={styles.brandSubtitle}>POS Terminal</Text>
        </View>
        
        <View style={styles.sidebarBottom}>
          <View style={styles.timeDisplay}>
            <Clock size={16} color={colors.mutedForeground} style={styles.timeIcon} />
            <Text style={styles.timeText}>
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Menu Panel */}
        <View style={[styles.menuPanel, { flex: 1 }]}>
          {/* Search */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Search size={20} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search menu items..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Categories */}
          <View style={styles.categoriesContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
            >
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryBtn,
                    selectedCategory === cat.id && styles.categoryBtnActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <cat.icon
                    size={16}
                    color={
                      selectedCategory === cat.id
                        ? colors.primaryForeground
                        : colors.foreground
                    }
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === cat.id && styles.categoryTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Menu Grid */}
          {loadingProducts ? (
            <View style={styles.emptyMenu}>
              <Text style={styles.emptyMenuText}>Loading products...</Text>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={styles.emptyMenu}>
              <Grid3X3 size={48} color={colors.mutedForeground} />
              <Text style={styles.emptyMenuTitle}>No Products Yet</Text>
              <Text style={styles.emptyMenuText}>
                Products will appear here once added through the business management portal.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              renderItem={renderProduct}
              keyExtractor={item => item.id}
              numColumns={isTablet ? 3 : 2}
              contentContainerStyle={styles.menuGrid}
              columnWrapperStyle={styles.menuRow}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Cart Panel - Right Sidebar */}
        <View style={styles.cartPanel}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Current Order</Text>
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items
              </Text>
            </View>
          </View>

          {/* Order Type */}
          <View style={styles.orderTypeRow}>
            <TouchableOpacity
              style={[
                styles.orderTypeBtn,
                orderType.type === 'dine_in' && styles.orderTypeBtnActive,
              ]}
              onPress={() => setOrderType({ ...orderType, type: 'dine_in' })}
            >
              <UtensilsCrossed
                size={16}
                color={
                  orderType.type === 'dine_in'
                    ? colors.primaryForeground
                    : colors.foreground
                }
              />
              <Text
                style={[
                  styles.orderTypeBtnText,
                  orderType.type === 'dine_in' && styles.orderTypeBtnTextActive,
                ]}
              >
                Dine In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.orderTypeBtn,
                orderType.type === 'takeaway' && styles.orderTypeBtnActive,
              ]}
              onPress={() => setOrderType({ ...orderType, type: 'takeaway' })}
            >
              <ShoppingCart
                size={16}
                color={
                  orderType.type === 'takeaway'
                    ? colors.primaryForeground
                    : colors.foreground
                }
              />
              <Text
                style={[
                  styles.orderTypeBtnText,
                  orderType.type === 'takeaway' && styles.orderTypeBtnTextActive,
                ]}
              >
                Takeaway
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.orderTypeBtn,
                orderType.type === 'delivery' && styles.orderTypeBtnActive,
              ]}
              onPress={() => setOrderType({ ...orderType, type: 'delivery' })}
            >
              <Truck
                size={16}
                color={
                  orderType.type === 'delivery'
                    ? colors.primaryForeground
                    : colors.foreground
                }
              />
              <Text
                style={[
                  styles.orderTypeBtnText,
                  orderType.type === 'delivery' && styles.orderTypeBtnTextActive,
                ]}
              >
                Delivery
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cart Items */}
          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <ShoppingCart size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyCartText}>No items in cart</Text>
            </View>
          ) : (
            <FlatList
              data={cart}
              renderItem={renderCartItem}
              keyExtractor={item => item.id}
              style={styles.cartList}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Cart Footer */}
          <View style={styles.cartFooter}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatPrice(subtotal)}</Text>
            </View>
            {taxRate > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>VAT ({taxRate}%)</Text>
                <Text style={styles.totalsValue}>{formatPrice(tax)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.chargeBtn, cart.length === 0 && styles.chargeBtnDisabled]}
              onPress={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
            >
              <CreditCard size={18} color={colors.primaryForeground} />
              <Text style={styles.chargeBtnText}>
                Charge {formatPrice(total)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Customize Product Modal */}
      <Modal
        visible={showCustomizeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomizeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customizeModalContent}>
            {/* Header */}
            <View style={styles.customizeHeader}>
              <View>
                <Text style={styles.customizeTitle}>{selectedProduct?.name}</Text>
                <Text style={styles.customizePrice}>
                  {formatPrice(calculateCustomizedPrice())}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowCustomizeModal(false)}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <ScrollView style={styles.customizeBody} showsVerticalScrollIndicator={false}>
              {/* Variant Groups */}
              {selectedProduct?.variant_groups.map(group => (
                <View key={group.id} style={styles.variantSection}>
                  <Text style={styles.sectionLabel}>
                    {group.name} {group.required ? '*' : ''}
                  </Text>
                  <View style={styles.optionsRow}>
                    {group.options.map(option => {
                      const isSelected = selectedVariants[group.id]?.id === option.id;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.optionBtn,
                            isSelected && styles.optionBtnSelected,
                          ]}
                          onPress={() => {
                            setSelectedVariants(prev => ({
                              ...prev,
                              [group.id]: option,
                            }));
                          }}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              isSelected && styles.optionTextSelected,
                            ]}
                          >
                            {option.name}
                          </Text>
                          {option.price_adjustment !== 0 && (
                            <Text style={styles.optionPrice}>
                              {option.price_adjustment > 0 ? '+' : ''}
                              {option.price_adjustment} {currency}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Modifiers - Removable Items */}
              {selectedProduct?.modifiers.filter(m => m.removable).length > 0 && (
                <View style={styles.variantSection}>
                  <Text style={styles.sectionLabel}>Remove</Text>
                  <View style={styles.optionsRow}>
                    {selectedProduct?.modifiers
                      .filter(m => m.removable)
                      .map(mod => {
                        const isRemoved = removedModifiers.has(mod.id);
                        return (
                          <TouchableOpacity
                            key={mod.id}
                            style={[
                              styles.modifierBtn,
                              isRemoved && styles.modifierBtnActive,
                            ]}
                            onPress={() => {
                              setRemovedModifiers(prev => {
                                const next = new Set(prev);
                                if (next.has(mod.id)) {
                                  next.delete(mod.id);
                                } else {
                                  next.add(mod.id);
                                }
                                return next;
                              });
                            }}
                          >
                            {isRemoved && <X size={14} color={colors.destructive} />}
                            <Text
                              style={[
                                styles.modifierText,
                                isRemoved && styles.modifierTextRemoved,
                              ]}
                            >
                              No {mod.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </View>
              )}

              {/* Modifiers - Addable Extras */}
              {selectedProduct?.modifiers.filter(m => m.addable).length > 0 && (
                <View style={styles.variantSection}>
                  <Text style={styles.sectionLabel}>Add Extra</Text>
                  <View style={styles.optionsRow}>
                    {selectedProduct?.modifiers
                      .filter(m => m.addable)
                      .map(mod => {
                        const isAdded = addedModifiers.has(mod.id);
                        return (
                          <TouchableOpacity
                            key={mod.id}
                            style={[
                              styles.modifierBtn,
                              isAdded && styles.modifierBtnAdded,
                            ]}
                            onPress={() => {
                              setAddedModifiers(prev => {
                                const next = new Set(prev);
                                if (next.has(mod.id)) {
                                  next.delete(mod.id);
                                } else {
                                  next.add(mod.id);
                                }
                                return next;
                              });
                            }}
                          >
                            {isAdded ? (
                              <Check size={14} color={colors.primary} />
                            ) : (
                              <Plus size={14} color={colors.foreground} />
                            )}
                            <Text style={styles.modifierText}>
                              {mod.name} +{mod.extra_price} {currency}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.customizeFooter}>
              <TouchableOpacity
                style={styles.addToCartBtn}
                onPress={addCustomizedToCart}
              >
                <ShoppingCart size={18} color={colors.primaryForeground} />
                <Text style={styles.addToCartText}>
                  Add to Cart - {formatPrice(calculateCustomizedPrice())}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Payment Method</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowPaymentModal(false)}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentOptions}>
              {isProcessingPayment && (
                <Text style={{ textAlign: 'center', marginBottom: 12, color: colors.primary }}>
                  Processing payment...
                </Text>
              )}
              <TouchableOpacity
                style={[styles.paymentBtn, isProcessingPayment && { opacity: 0.5 }]}
                onPress={() => processPayment('cash')}
                disabled={isProcessingPayment}
              >
                <View style={styles.paymentIcon}>
                  <Banknote size={24} color="#fff" />
                </View>
                <View>
                  <Text style={styles.paymentText}>Cash</Text>
                  <Text style={styles.paymentSubtext}>Pay with cash</Text>
                </View>
                <ChevronRight
                  size={20}
                  color={colors.mutedForeground}
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentBtn, isProcessingPayment && { opacity: 0.5 }]}
                onPress={() => processPayment('card')}
                disabled={isProcessingPayment}
              >
                <View style={styles.paymentIcon}>
                  <CreditCard size={24} color="#fff" />
                </View>
                <View>
                  <Text style={styles.paymentText}>Card</Text>
                  <Text style={styles.paymentSubtext}>Credit / Debit card</Text>
                </View>
                <ChevronRight
                  size={20}
                  color={colors.mutedForeground}
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        visible={showReceiptModal}
        transparent
        animationType="fade"
        onRequestClose={completeOrder}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.receiptContent}>
              <View style={styles.receiptIcon}>
                <CheckCircle size={40} color="#22c55e" />
              </View>
              <Text style={styles.receiptTitle}>Payment Successful</Text>
              <Text style={styles.receiptOrderNumber}>
                Order #{lastOrderNumber}
              </Text>
              <Text style={styles.receiptTotal}>{formatPrice(total)}</Text>

              <View style={styles.receiptActions}>
                <TouchableOpacity style={styles.printBtn}>
                  <Printer size={18} color={colors.foreground} />
                  <Text style={styles.printBtnText}>Print Receipt</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={completeOrder}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

          </View>
  );
}

