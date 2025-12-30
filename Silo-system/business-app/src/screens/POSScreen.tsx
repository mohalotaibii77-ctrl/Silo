import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ClipboardList,
  Command,
  Edit2,
  Edit3,
  Lock,
  Hash,
  Delete,
  DollarSign,
  AlertCircle,
} from 'lucide-react-native';
import { API_URL } from '../api/client';
import { dataPreloader, CACHE_KEYS } from '../services/DataPreloader';
import { useLocalization } from '../localization/LocalizationContext';
import { idleTimeout } from '../services/IdleTimeout';
// QRCode component - optional dependency for receipt scanning feature
let QRCode: any = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch (e) {
  // QRCode package not installed - feature will be disabled
}

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
  in_stock?: boolean; // Whether this variant has enough inventory
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
  outOfStock?: boolean; // True when inventory is insufficient
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
  variantId?: string; // Selected variant ID for inventory checking
  bundleId?: string;  // Bundle ID if this is a bundle
  name: string;
  basePrice: number;
  quantity: number;
  selectedVariants: { groupName: string; optionName: string; priceAdjustment: number; variantId?: string }[];
  removedModifiers: string[]; // names of removed items
  addedModifiers: { name: string; price: number; quantity: number }[]; // extra items added with quantity
  totalPrice: number; // calculated total per item
  isBundle?: boolean; // Flag to identify bundles in cart
  bundleItems?: any[]; // Items included in the bundle for receipt
}

interface OrderType {
  type: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: string;
  tableId?: number; // Selected table ID
  customerName?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryMethod?: string; // Delivery company/method
}

// Delivery partner from API
interface DeliveryPartner {
  id: number;
  name: string;
  name_ar?: string;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  status: 'active' | 'inactive';
}

// Restaurant table from API
interface RestaurantTable {
  id: number;
  table_number: string;
  table_code?: string | null;
  seats: number;
  zone?: string | null;
  description?: string | null;
  is_active: boolean;
  is_occupied: boolean;
  current_order_id?: number | null;
}

// Generate a consistent color based on partner name
const getPartnerColor = (name: string): string => {
  const colors = ['#FF5A00', '#00A859', '#00CCBC', '#6E2594', '#FF0000', '#374151', '#2563EB', '#D97706', '#059669', '#7C3AED'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function POSScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { formatCurrency } = useLocalization();
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
  const [productAvailability, setProductAvailability] = useState<Record<string, number>>({}); // product_id -> max available qty
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false); // Track if availability has been loaded
  const [currency, setCurrency] = useState(''); // Loaded from business settings
  const [vatEnabled, setVatEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0); // VAT rate from business settings
  
  // Customization modal state
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, VariantOption>>({});
  const [removedModifiers, setRemovedModifiers] = useState<Set<string>>(new Set());
  const [addedModifiers, setAddedModifiers] = useState<Map<string, number>>(new Map()); // Map of modifier id -> quantity
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null); // ID of cart item being edited
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Transaction confirmation state (for card payments only)
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionNumber, setTransactionNumber] = useState('');
  
  // Cash payment state (for cash payments - change calculator)
  const [showCashModal, setShowCashModal] = useState(false);
  const [customerPaidAmount, setCustomerPaidAmount] = useState('');
  
  // POS Session state (shift management)
  const [posSession, setPosSession] = useState<any>(null);
  const [showOpeningFloatModal, setShowOpeningFloatModal] = useState(false);
  const [showCloseSessionModal, setShowCloseSessionModal] = useState(false);
  const [selectedPosEmployee, setSelectedPosEmployee] = useState<any>(null);
  
  // PIN Lock Screen state (for idle timeout AND initial employee selection)
  const [showPinLockScreen, setShowPinLockScreen] = useState(false);
  const [needsInitialPinAuth, setNeedsInitialPinAuth] = useState(false); // Show PIN screen after password login
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isAuthenticatingPin, setIsAuthenticatingPin] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes idle timeout
  const [openingFloat, setOpeningFloat] = useState('');
  const [cashDrawerBalance, setCashDrawerBalance] = useState<number>(0);
  const [actualCashCount, setActualCashCount] = useState('');
  
  const [activeSidebarTab, setActiveSidebarTab] = useState<'pos' | 'orders'>('pos');
  const [showDeliveryMethodModal, setShowDeliveryMethodModal] = useState(false);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([]);
  const [showTableSelectionModal, setShowTableSelectionModal] = useState(false);
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>([]);
  
  // Customer info for in-house delivery
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  // Bundle item customizations - track per bundle item index
  const [bundleItemCustomizations, setBundleItemCustomizations] = useState<Record<number, {
    removedModifiers: Set<string>;
    addedModifiers: Map<string, number>; // Map of modifier id -> quantity
  }>>({});

  // Orders tab state
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all');
  
  // Order editing state
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [originalOrderItems, setOriginalOrderItems] = useState<any[]>([]);
  
  // Order details modal state
  const [selectedOrderForView, setSelectedOrderForView] = useState<any>(null);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);
  
  // Order timeline modal state
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [orderTimeline, setOrderTimeline] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  
  // ==================== LOCAL ORDER EDITING STATE ====================
  // All changes are staged locally until payment/refund is confirmed
  // Types for pending changes
  interface PendingProduct {
    tempId: string;
    product_id: number;
    product_name: string;
    variant_id?: number;
    variant_name?: string;
    quantity: number;
    unit_price: number;
    modifiers: Array<{
      modifier_name: string;
      modifier_type: 'extra' | 'removal';
      unit_price: number;
      quantity: number;
    }>;
  }
  
  interface ProductModification {
    order_item_id: number;
    new_variant_id?: number;
    new_variant_name?: string;
    new_quantity?: number;
    new_modifiers?: Array<{
      modifier_name: string;
      modifier_type: 'extra' | 'removal';
      unit_price: number;
      quantity: number;
    }>;
  }
  
  // Pending changes (local state - not saved until confirmed)
  const [pendingProductsToAdd, setPendingProductsToAdd] = useState<PendingProduct[]>([]);
  const [pendingProductsToRemove, setPendingProductsToRemove] = useState<number[]>([]); // order_item_ids
  const [pendingProductModifications, setPendingProductModifications] = useState<ProductModification[]>([]);
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);
  
  // Currently editing item (for inline variant/modifier editing)
  const [editingOrderItemId, setEditingOrderItemId] = useState<number | null>(null);
  const [editItemVariantId, setEditItemVariantId] = useState<number | null>(null);
  const [editItemRemovedMods, setEditItemRemovedMods] = useState<Set<string>>(new Set());
  const [editItemAddedMods, setEditItemAddedMods] = useState<Map<string, number>>(new Map());
  
  // Add products to order modal state
  const [showAddProductsModal, setShowAddProductsModal] = useState(false);
  const [addProductSearchQuery, setAddProductSearchQuery] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<Product | null>(null);
  const [addProductQuantity, setAddProductQuantity] = useState(1);
  
  // Variant list for editing (fetched when editing an item)
  const [editingItemVariants, setEditingItemVariants] = useState<any[]>([]);

  // Load recent orders for the Orders tab (filtered by branch)
  const loadRecentOrders = async () => {
    try {
      setLoadingOrders(true);
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const branchData = await AsyncStorage.getItem('branch');
      const businessData = await AsyncStorage.getItem('business');
      if (!token || !API_URL) return;

      // Get branch_id for order isolation
      let branchId: number | null = null;
      if (userData) {
        const user = JSON.parse(userData);
        branchId = user.branch_id;
      }
      if (!branchId && branchData) {
        const branch = JSON.parse(branchData);
        branchId = branch.id;
      }
      // If still no branch_id, fetch main branch for the business
      if (!branchId && businessData) {
        const business = JSON.parse(businessData);
        try {
          const branchesResponse = await fetch(`${API_URL}/businesses/${business.id}/branches`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const branchesResult = await branchesResponse.json();
          if (branchesResult.branches && branchesResult.branches.length > 0) {
            const mainBranch = branchesResult.branches.find((b: any) => b.is_main) || branchesResult.branches[0];
            branchId = mainBranch.id;
          }
        } catch (err) {
          console.error('Error fetching branches for orders:', err);
        }
      }

      const today = new Date().toISOString().split('T')[0];
      let url = `${API_URL}/pos/orders?date=${today}&limit=50`;
      
      // Branch isolation - only show orders for this branch
      if (branchId) {
        url += `&branch_id=${branchId}`;
      }
      
      if (ordersFilter !== 'all') {
        url += `&status=${ordersFilter}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      
      if (result.success) {
        // Handle both paginated and non-paginated responses
        const orders = result.data?.data || result.data || [];
        setRecentOrders(orders);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Mark a delivery order as picked up (driver collected)
  const markOrderAsPickedUp = async (orderId: number) => {
    try {
      setUpdatingOrderStatus(true);
      const token = await AsyncStorage.getItem('token');
      if (!token || !API_URL) return;

      const response = await fetch(`${API_URL}/pos/orders/${orderId}/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          // Use selected employee ID, or fallback to session's cashier_id (for restored sessions)
          cashier_id: selectedPosEmployee?.id || posSession?.cashier_id,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Update the order in state
        setSelectedOrderForView(result.data);
        // Refresh orders list
        loadRecentOrders();
        Alert.alert('Success', 'Order marked as picked up');
      } else {
        Alert.alert('Error', result.error || 'Failed to update order');
      }
    } catch (error) {
      console.error('Error marking order as picked up:', error);
      Alert.alert('Error', 'Failed to update order');
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  // Fetch order timeline
  const fetchOrderTimeline = async (orderId: number) => {
    try {
      setLoadingTimeline(true);
      const token = await AsyncStorage.getItem('token');
      if (!token || !API_URL) return;

      const response = await fetch(`${API_URL}/pos/orders/${orderId}/timeline`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      
      if (result.success) {
        setOrderTimeline(result.data || []);
        setShowTimelineModal(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to load timeline');
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
      Alert.alert('Error', 'Failed to load timeline');
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Get timeline event color
  const getTimelineEventColor = (eventType: string) => {
    const colors: Record<string, string> = {
      created: '#3b82f6',
      item_added: '#10b981',
      item_removed: '#ef4444',
      item_modified: '#f59e0b',
      status_changed: '#8b5cf6',
      payment_received: '#22c55e',
      payment_updated: '#f59e0b',
      cancelled: '#ef4444',
      completed: '#22c55e',
      picked_up: '#10b981',
      ingredient_wasted: '#ef4444',
      ingredient_returned: '#3b82f6',
    };
    return colors[eventType] || '#6b7280';
  };

  // Format timeline event description
  const formatTimelineEvent = (event: any) => {
    const data = event.event_data || {};
    switch (event.event_type) {
      case 'created':
        return `Order created - ${data.order_type?.replace('_', ' ')} (${data.items_count} items)`;
      case 'status_changed':
        const fromStatus = data.from_status || data.previous_status;
        const toStatus = data.to_status || data.new_status;
        if (fromStatus && toStatus) {
          return `Status changed: ${fromStatus.replace(/_/g, ' ')} → ${toStatus.replace(/_/g, ' ')}`;
        } else if (toStatus) {
          return `Status set to: ${toStatus.replace(/_/g, ' ')}`;
        } else if (data.reason) {
          return `Status updated: ${data.reason}`;
        }
        return 'Status updated';
      case 'payment_received':
        return `Payment received via ${data.payment_method}`;
      case 'payment_updated':
        return `Payment updated${data.remaining_amount ? ` - ${data.remaining_amount} remaining` : ''}`;
      case 'item_added':
        return `Item added: ${data.item_name || data.product_name || 'Item'}`;
      case 'item_removed':
        return `Item removed: ${data.item_name || data.product_name || 'Item'}`;
      case 'item_modified':
        return `Item modified: ${data.item_name || data.product_name || 'Item'}`;
      case 'picked_up':
        return 'Order picked up by driver';
      case 'completed':
        return 'Order completed';
      case 'cancelled':
        return `Order cancelled${data.reason ? `: ${data.reason}` : ''}`;
      case 'ingredient_wasted':
        return `Ingredient wasted: ${data.item_name || 'Item'}`;
      case 'ingredient_returned':
        return `Ingredient returned: ${data.item_name || 'Item'}`;
      default:
        return event.event_type?.replace(/_/g, ' ');
    }
  };

  // Format user name from timeline event
  const formatTimelineUser = (event: any) => {
    if (!event.user) return null;
    const user = event.user;
    // Show full name if available (this is the actual employee)
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) return user.first_name;
    // Username only - likely a POS terminal user or incomplete profile
    if (user.username) return user.username;
    return null;
  };

  // Load orders when orders tab is selected or filter changes
  useEffect(() => {
    if (activeSidebarTab === 'orders') {
      loadRecentOrders();
      // Auto-refresh orders every 30 seconds when on orders tab
      const refreshInterval = setInterval(loadRecentOrders, 30000);
      return () => clearInterval(refreshInterval);
    }
  }, [activeSidebarTab, ordersFilter]);

  // Load an order into the cart for editing
  const loadOrderForEditing = (order: any) => {
    // Only allow editing orders that are not in a final state
    const finalStatuses = ['completed', 'cancelled', 'rejected'];
    if (finalStatuses.includes(order.order_status)) {
      Alert.alert('Cannot Edit', 'This order has already been completed, cancelled, or rejected and cannot be edited.');
      return;
    }

    // Store the original order and items for comparison later
    setEditingOrder(order);
    setOriginalOrderItems(order.order_items || []);

    // Convert order items to cart items
    const cartItems: CartItem[] = (order.order_items || []).map((item: any, index: number) => {
      // Parse modifiers
      // Note: Backend uses 'removal' and 'extra' as modifier_type values
      const removedMods: string[] = [];
      const addedMods: { name: string; price: number; quantity: number }[] = [];
      
      (item.order_item_modifiers || []).forEach((mod: any) => {
        if (mod.modifier_type === 'removal' || mod.modifier_type === 'removed') {
          removedMods.push(mod.modifier_name);
        } else if (mod.modifier_type === 'extra' || mod.modifier_type === 'added') {
          addedMods.push({
            name: mod.modifier_name,
            price: mod.unit_price || mod.price_adjustment || 0,
            quantity: mod.quantity || 1,
          });
        }
      });

      // Parse variants
      const selectedVariants: { groupName: string; optionName: string; priceAdjustment: number; variantId?: string }[] = [];
      if (item.variant_name) {
        selectedVariants.push({
          groupName: 'Variant',
          optionName: item.variant_name,
          priceAdjustment: 0,
          variantId: item.variant_id?.toString(),
        });
      }

      return {
        id: `edit-${item.id}-${index}`,
        productId: item.product_id?.toString() || '',
        variantId: item.variant_id?.toString(),
        bundleId: item.bundle_id?.toString(),
        name: item.product_name || 'Unknown Item',
        basePrice: item.unit_price || 0,
        quantity: item.quantity || 1,
        selectedVariants,
        removedModifiers: removedMods,
        addedModifiers: addedMods,
        totalPrice: item.total_price || item.unit_price * item.quantity,
        isBundle: !!item.bundle_id,
      };
    });

    setCart(cartItems);

    // Set order type based on the order
    setOrderType({
      type: order.order_type || 'dine_in',
      tableId: order.table_id,
      tableNumber: order.table_number,
      deliveryMethod: order.delivery_partner_id?.toString(),
    });

    // Switch to POS tab to show the cart
    setActiveSidebarTab('pos');
  };

  // Cancel editing and clear the cart
  const cancelOrderEditing = () => {
    setEditingOrder(null);
    setOriginalOrderItems([]);
    setCart([]);
    setOrderType({ type: 'dine_in' });
  };

  // ==================== LOCAL ORDER EDITING FUNCTIONS ====================
  // All changes are staged locally until payment/refund is confirmed
  
  // Reset all pending changes
  const resetPendingOrderChanges = () => {
    setPendingProductsToAdd([]);
    setPendingProductsToRemove([]);
    setPendingProductModifications([]);
    setEditingOrderItemId(null);
    setEditItemVariantId(null);
    setEditItemRemovedMods(new Set());
    setEditItemAddedMods(new Map());
    setEditingItemVariants([]);
  };
  
  // Check if there are any pending changes
  const hasPendingChanges = (): boolean => {
    return pendingProductsToAdd.length > 0 || 
           pendingProductsToRemove.length > 0 || 
           pendingProductModifications.length > 0;
  };
  
  // Get the effective order items (original + pending changes applied)
  const getEffectiveOrderItems = () => {
    if (!selectedOrderForView) return [];
    
    const originalItems = selectedOrderForView.order_items || [];
    
    // Start with original items, excluding removed ones
    let effectiveItems = originalItems.filter((item: any) => 
      !pendingProductsToRemove.includes(item.id)
    );
    
    // Apply modifications to existing items
    effectiveItems = effectiveItems.map((item: any) => {
      const modification = pendingProductModifications.find(m => m.order_item_id === item.id);
      if (modification) {
        return {
          ...item,
          variant_id: modification.new_variant_id ?? item.variant_id,
          variant_name: modification.new_variant_name ?? item.variant_name,
          quantity: modification.new_quantity ?? item.quantity,
          // If modifiers are modified, use new modifiers
          order_item_modifiers: modification.new_modifiers 
            ? modification.new_modifiers.map(m => ({
                modifier_name: m.modifier_name,
                modifier_type: m.modifier_type,
                unit_price: m.unit_price,
                quantity: m.quantity,
              }))
            : item.order_item_modifiers,
          _isModified: true,
        };
      }
      return item;
    });
    
    // Add pending new products
    const pendingAsItems = pendingProductsToAdd.map(p => ({
      id: p.tempId, // Use temp ID for React key
      product_id: p.product_id,
      product_name: p.product_name,
      variant_id: p.variant_id,
      variant_name: p.variant_name,
      quantity: p.quantity,
      unit_price: p.unit_price,
      total: p.unit_price * p.quantity + p.modifiers.filter(m => m.modifier_type === 'extra').reduce((sum, m) => sum + m.unit_price * m.quantity, 0),
      order_item_modifiers: p.modifiers,
      _isPending: true,
    }));
    
    return [...effectiveItems, ...pendingAsItems];
  };
  
  // Calculate the new total based on pending changes
  const calculatePendingTotal = (): number => {
    const effectiveItems = getEffectiveOrderItems();
    let total = 0;
    
    effectiveItems.forEach((item: any) => {
      const unitPrice = parseFloat(item.unit_price) || 0;
      const qty = item.quantity || 1;
      let itemTotal = unitPrice * qty;
      
      // Add extras cost
      (item.order_item_modifiers || []).forEach((mod: any) => {
        if (mod.modifier_type === 'extra') {
          itemTotal += (parseFloat(mod.unit_price) || 0) * (mod.quantity || 1);
        }
      });
      
      total += itemTotal;
    });
    
    // Add tax if applicable
    if (selectedOrderForView?.tax_rate) {
      total += total * (parseFloat(selectedOrderForView.tax_rate) / 100);
    }
    
    return total;
  };
  
  // Calculate the price difference (positive = charge more, negative = refund)
  const calculatePriceDifference = (): number => {
    if (!selectedOrderForView) return 0;
    const originalPaid = parseFloat(selectedOrderForView.paid_amount || selectedOrderForView.total_amount || 0);
    const newTotal = calculatePendingTotal();
    return newTotal - originalPaid;
  };
  
  // Add a product to pending (local state)
  const addProductToPending = (product: {
    product_id: number;
    product_name: string;
    variant_id?: number;
    variant_name?: string;
    quantity: number;
    unit_price: number;
    modifiers: Array<{
      modifier_name: string;
      modifier_type: 'extra' | 'removal';
      unit_price: number;
      quantity: number;
    }>;
  }) => {
    const pendingProduct: PendingProduct = {
      tempId: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...product,
    };
    setPendingProductsToAdd(prev => [...prev, pendingProduct]);
  };
  
  // Remove a product (mark for removal - local state)
  const markProductForRemoval = (orderItemId: number) => {
    // Check if this would remove the last item
    const effectiveItems = getEffectiveOrderItems();
    const remainingAfterRemoval = effectiveItems.filter((item: any) => 
      item.id !== orderItemId && !item._isPending
    ).length + pendingProductsToAdd.length;
    
    if (remainingAfterRemoval === 0 && pendingProductsToAdd.length === 0) {
      // Would remove last item - prompt to cancel order
      if (Platform.OS === 'web') {
        if (window.confirm('This is the last product. Removing it will cancel the order. Continue?')) {
          handleCancelOrder(selectedOrderForView.id);
          setShowOrderDetailsModal(false);
        }
      } else {
        Alert.alert(
          'Cancel Order?',
          'This is the last product. Removing it will cancel the order.',
          [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, Cancel', style: 'destructive', onPress: () => {
              handleCancelOrder(selectedOrderForView.id);
              setShowOrderDetailsModal(false);
            }},
          ]
        );
      }
      return;
    }
    
    setPendingProductsToRemove(prev => [...prev, orderItemId]);
  };
  
  // Remove a pending product (before save)
  const removePendingProduct = (tempId: string) => {
    setPendingProductsToAdd(prev => prev.filter(p => p.tempId !== tempId));
  };
  
  // Undo removal of a product
  const undoProductRemoval = (orderItemId: number) => {
    setPendingProductsToRemove(prev => prev.filter(id => id !== orderItemId));
  };
  
  // Start editing an existing order item (variant/modifiers)
  const startEditingOrderItem = (item: any) => {
    setEditingOrderItemId(item.id);
    setEditItemVariantId(item.variant_id || null);
    
    // Check if there's already a pending modification for this item
    const existingMod = pendingProductModifications.find(m => m.order_item_id === item.id);
    
    // Initialize modifiers from existing modification or original item
    const modsToUse = existingMod?.new_modifiers || item.order_item_modifiers || [];
    const currentRemoved = new Set<string>();
    const currentAdded = new Map<string, number>();
    
    modsToUse.forEach((mod: any) => {
      const modName = mod.modifier_name || mod.name;
      if (mod.modifier_type === 'removal') {
        currentRemoved.add(modName);
      } else if (mod.modifier_type === 'extra') {
        currentAdded.set(modName, mod.quantity || 1);
      }
    });
    
    setEditItemRemovedMods(currentRemoved);
    setEditItemAddedMods(currentAdded);
    
    // Fetch variants for this product
    if (item.product_id) {
      fetchProductVariants(item.product_id.toString());
    }
  };
  
  // Fetch variants for a product
  const fetchProductVariants = async (productId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/store-products/${productId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success && result.data) {
        let allVariants: any[] = [];
        
        // Check if variants are in product_variants array (flat structure from backend)
        if (result.data.product_variants && Array.isArray(result.data.product_variants)) {
          allVariants = result.data.product_variants;
        }
        // Check if variants are in variant_groups (nested structure)
        else if (result.data.variant_groups && Array.isArray(result.data.variant_groups)) {
          result.data.variant_groups.forEach((group: any) => {
            if (group.variants && Array.isArray(group.variants)) {
              allVariants.push(...group.variants);
            }
          });
        }
        
        setEditingItemVariants(allVariants);
      } else {
        setEditingItemVariants([]);
      }
    } catch (error) {
      console.error('[Fetch Variants] Error:', error);
      setEditingItemVariants([]);
    }
  };
  
  // Cancel editing order item
  const cancelEditingOrderItem = () => {
    setEditingOrderItemId(null);
    setEditItemVariantId(null);
    setEditItemRemovedMods(new Set());
    setEditItemAddedMods(new Map());
    setEditingItemVariants([]);
  };
  
  // Apply changes to an existing order item (local state)
  const applyOrderItemChanges = (orderItemId: number, item: any, product: Product | null) => {
    // Build the modification
    const modification: ProductModification = {
      order_item_id: orderItemId,
    };
    
    // Check if variant changed
    if (editItemVariantId !== item.variant_id) {
      modification.new_variant_id = editItemVariantId || undefined;
      const variant = editingItemVariants.find(v => v.id === editItemVariantId);
      modification.new_variant_name = variant?.name;
    }
    
    // Build new modifiers array
    const newModifiers: ProductModification['new_modifiers'] = [];
    
    // Add removed modifiers
    editItemRemovedMods.forEach(modName => {
      newModifiers.push({
        modifier_name: modName,
        modifier_type: 'removal',
        unit_price: 0,
        quantity: 1,
      });
    });
    
    // Add extra modifiers
    editItemAddedMods.forEach((qty, modName) => {
      if (qty > 0) {
        const mod = product?.modifiers?.find(m => m.name === modName);
        newModifiers.push({
          modifier_name: modName,
          modifier_type: 'extra',
          unit_price: mod?.extra_price || 0,
          quantity: qty,
        });
      }
    });
    
    modification.new_modifiers = newModifiers;
    
    // Update or add to pending modifications
    setPendingProductModifications(prev => {
      const existing = prev.findIndex(m => m.order_item_id === orderItemId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = modification;
        return updated;
      }
      return [...prev, modification];
    });
    
    // Close editing
    cancelEditingOrderItem();
  };
  
  // Add a product to the current order - opens customization modal if needed
  const addProductToCurrentOrder = (product: Product) => {
    if (!selectedOrderForView) return;
    
    const hasVariants = product.variant_groups && product.variant_groups.length > 0;
    const hasModifiers = product.modifiers && product.modifiers.length > 0;
    
    if (hasVariants || hasModifiers) {
      // Close modals and open customize modal
      setShowAddProductsModal(false);
      setShowOrderDetailsModal(false);
      setSelectedProductToAdd(product);
      setSelectedProduct(product);
      
      // Pre-select first variant if required
      const initialVariants: Record<string, VariantOption> = {};
      product.variant_groups.forEach(group => {
        if (group.required && group.options.length > 0) {
          const firstAvailable = group.options.find(opt => opt.in_stock !== false) || group.options[0];
          initialVariants[group.id] = firstAvailable;
        }
      });
      setSelectedVariants(initialVariants);
      setRemovedModifiers(new Set());
      setAddedModifiers(new Map());
      setBundleItemCustomizations({});
      setShowCustomizeModal(true);
    } else {
      // Add directly to pending (local state)
      addProductToPending({
        product_id: parseInt(product.id),
        product_name: product.name,
        quantity: 1,
        unit_price: product.base_price,
        modifiers: [],
      });
      setShowAddProductsModal(false);
    }
  };
  
  // Add customized product to pending (called from customize modal)
  const addCustomizedProductToPending = () => {
    if (!selectedProduct) return;
    
    // Calculate price with customizations
    let unitPrice = selectedProduct.base_price;
    Object.values(selectedVariants).forEach(variant => {
      unitPrice += variant.price_adjustment || 0;
    });
    
    // Build modifiers
    const modifiers: PendingProduct['modifiers'] = [];
    
    removedModifiers.forEach(modId => {
      const mod = selectedProduct.modifiers?.find(m => m.id === modId);
      if (mod) {
        modifiers.push({
          modifier_name: mod.name,
          modifier_type: 'removal',
          unit_price: 0,
          quantity: 1,
        });
      }
    });
    
    addedModifiers.forEach((qty, modId) => {
      if (qty > 0) {
        const mod = selectedProduct.modifiers?.find(m => m.id === modId);
        if (mod) {
          modifiers.push({
            modifier_name: mod.name,
            modifier_type: 'extra',
            unit_price: mod.extra_price || 0,
            quantity: qty,
          });
        }
      }
    });
    
    // Get variant info
    const variantValues = Object.values(selectedVariants);
    const variantId = variantValues.length > 0 ? parseInt(variantValues[0].id) : undefined;
    const variantName = variantValues.map(v => v.name).join(', ') || undefined;
    
    addProductToPending({
      product_id: parseInt(selectedProduct.id),
      product_name: selectedProduct.name,
      variant_id: variantId,
      variant_name: variantName,
      quantity: 1,
      unit_price: unitPrice,
      modifiers,
    });
    
    // Close modals and re-open order details
    setShowCustomizeModal(false);
    setSelectedProduct(null);
    setSelectedProductToAdd(null);
    setShowOrderDetailsModal(true);
  };
  
  // Save all pending changes to backend (with payment gate)
  const saveOrderChanges = async (paymentMethod?: 'cash' | 'card', paymentDetails?: any) => {
    if (!selectedOrderForView || !hasPendingChanges()) return;
    
    try {
      setSavingOrderEdit(true);
      const token = await AsyncStorage.getItem('token');
      
      // Build the edit payload
      const payload: any = {};
      
      if (pendingProductsToAdd.length > 0) {
        payload.products_to_add = pendingProductsToAdd.map(p => ({
          product_id: p.product_id,
          product_name: p.product_name,
          variant_id: p.variant_id,
          quantity: p.quantity,
          unit_price: p.unit_price,
          modifiers: p.modifiers.map(m => ({
            modifier_name: m.modifier_name,
            modifier_type: m.modifier_type,
            unit_price: m.unit_price,
            quantity: m.quantity,
          })),
        }));
      }
      
      if (pendingProductsToRemove.length > 0) {
        payload.products_to_remove = pendingProductsToRemove;
      }
      
      if (pendingProductModifications.length > 0) {
        payload.products_to_modify = pendingProductModifications.map(m => ({
          order_item_id: m.order_item_id,
          variant_id: m.new_variant_id,
          modifiers: m.new_modifiers?.map(mod => ({
            modifier_name: mod.modifier_name,
            modifier_type: mod.modifier_type,
            unit_price: mod.unit_price,
            quantity: mod.quantity,
          })),
        }));
      }
      
      // Call edit API
      const editResponse = await fetch(`${API_URL}/pos/orders/${selectedOrderForView.id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      const editResult = await editResponse.json();
      
      if (!editResult.success) {
        throw new Error(editResult.error || 'Failed to update order');
      }
      
      // If payment was provided, record it
      if (paymentMethod && paymentDetails) {
        await fetch(`${API_URL}/pos/orders/${selectedOrderForView.id}/payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_method: paymentMethod,
            amount: paymentDetails.amount,
            reference: paymentDetails.reference,
            amount_received: paymentDetails.amount_received,
            change_given: paymentDetails.change_given,
            pos_session_id: posSession?.id,
          }),
        });
      }
      
      // Success - reload order from backend to get updated variant names
      try {
        const reloadResponse = await fetch(`${API_URL}/pos/orders/${selectedOrderForView.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const reloadResult = await reloadResponse.json();
        
        if (reloadResult.success && reloadResult.data) {
          setSelectedOrderForView(reloadResult.data);
        } else {
          // Fallback to edit result if reload fails
          setSelectedOrderForView(editResult.data);
        }
      } catch (reloadErr) {
        console.error('[Reload Order] Error:', reloadErr);
        // Fallback to edit result if reload fails
        setSelectedOrderForView(editResult.data);
      }
      
      loadRecentOrders();
      resetPendingOrderChanges();
      
      const msg = 'Order updated successfully';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Success', msg);
      }
      
    } catch (error: any) {
      console.error('[Save Order Changes] Error:', error);
      const msg = error.message || 'Failed to save changes';
      if (Platform.OS === 'web') {
        window.alert('Error: ' + msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSavingOrderEdit(false);
    }
  };
  
  // Handle save with payment/refund flow
  const handleSaveOrderChanges = async () => {
    const priceDiff = calculatePriceDifference();
    
    if (priceDiff > 0.01) {
      // Extra payment required - open payment modal
      setPendingOrderEdit({
        orderId: selectedOrderForView.id,
        itemId: 0,
        extraCost: priceDiff,
        modifications: {}, // Not used, we use pendingProducts* states instead
      });
      setShowPaymentModal(true);
    } else if (priceDiff < -0.01) {
      // Refund required
      const refundAmount = Math.abs(priceDiff);
      const confirmed = Platform.OS === 'web'
        ? window.confirm(`Process cash refund of ${formatCurrency(refundAmount)}?`)
        : await new Promise<boolean>(resolve => {
            Alert.alert(
              'Process Refund',
              `Refund ${formatCurrency(refundAmount)} in cash to customer?`,
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Process Refund', onPress: () => resolve(true) },
              ]
            );
          });
      
      if (confirmed) {
        try {
          const token = await AsyncStorage.getItem('token');
          // First save the order changes
          await saveOrderChanges();
          // Then process refund
          await fetch(`${API_URL}/pos/orders/${selectedOrderForView.id}/refund`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              amount: refundAmount,
              reason: 'Order edited - customer refund',
            }),
          });
          
          if (Platform.OS === 'web') {
            window.alert(`Refund of ${formatCurrency(refundAmount)} processed`);
          } else {
            Alert.alert('Refund Processed', `${formatCurrency(refundAmount)} refunded`);
          }
        } catch (error: any) {
          console.error('Refund error:', error);
        }
      }
    } else {
      // No payment change needed - save directly
      await saveOrderChanges();
    }
  };

  // Legacy wrapper for adding simple product (redirects to pending)
  const addSimpleProductToOrder = (product: Product, quantity: number) => {
    addProductToPending({
      product_id: parseInt(product.id),
      product_name: product.name,
      quantity: quantity,
      unit_price: product.base_price,
      modifiers: [],
    });
    setShowAddProductsModal(false);
  };

  // Add customized product to the existing order (called from customize modal)
  // Now uses local pending state instead of immediate API call
  const addCustomizedProductToOrder = () => {
    if (!selectedProduct || !selectedOrderForView) return;
    
    // Calculate price with customizations
    let unitPrice = selectedProduct.base_price;
    Object.values(selectedVariants).forEach(variant => {
      unitPrice += variant.price_adjustment || 0;
    });
    
    // Build modifiers
    const modifiers: PendingProduct['modifiers'] = [];
    
    // Removed modifiers
    removedModifiers.forEach(modId => {
      const mod = selectedProduct.modifiers?.find(m => m.id === modId);
      if (mod) {
        modifiers.push({
          modifier_name: mod.name,
          modifier_type: 'removal',
          unit_price: 0,
          quantity: 1,
        });
      }
    });
    
    // Added modifiers
    addedModifiers.forEach((qty, modId) => {
      if (qty > 0) {
        const mod = selectedProduct.modifiers?.find(m => m.id === modId);
        if (mod) {
          modifiers.push({
            modifier_name: mod.name,
            modifier_type: 'extra',
            unit_price: mod.extra_price || 0,
            quantity: qty,
          });
        }
      }
    });
    
    // Get variant info
    const variantValues = Object.values(selectedVariants);
    const variantId = variantValues.length > 0 ? parseInt(variantValues[0].id) : undefined;
    const variantName = variantValues.map(v => v.name).join(', ') || undefined;
    
    // Add to pending products (local state)
    addProductToPending({
      product_id: parseInt(selectedProduct.id),
      product_name: selectedProduct.name,
      variant_id: variantId,
      variant_name: variantName,
      quantity: 1,
      unit_price: unitPrice,
      modifiers,
    });
    
    // Close modals and re-open order details
    setShowCustomizeModal(false);
    setSelectedProduct(null);
    setSelectedProductToAdd(null);
    setShowOrderDetailsModal(true);
  };

  // Change product variant
  const changeProductVariant = async (orderItemId: number, newVariantId: string) => {
    if (!selectedOrderForView) return;
    
    try {
      setSavingOrderEdit(true);
      const token = await AsyncStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/pos/orders/${selectedOrderForView.id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          products_to_modify: [{
            order_item_id: orderItemId,
            variant_id: newVariantId,
          }],
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSelectedOrderForView(result.data);
        loadRecentOrders();
        if (Platform.OS === 'web') {
          window.alert('Variant changed successfully');
        } else {
          Alert.alert('Success', 'Variant changed successfully');
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert('Error: ' + (result.error || 'Failed to change variant'));
        } else {
          Alert.alert('Error', result.error || 'Failed to change variant');
        }
      }
    } catch (error: any) {
      console.error('[Change Variant] Error:', error);
      if (Platform.OS === 'web') {
        window.alert('Error: ' + (error.message || 'Failed to change variant'));
      } else {
        Alert.alert('Error', error.message || 'Failed to change variant');
      }
    } finally {
      setSavingOrderEdit(false);
    }
  };

  // State for extra payment modal (used when payment is required for order edits)
  const [pendingOrderEdit, setPendingOrderEdit] = useState<{
    orderId: number;
    itemId: number;
    extraCost: number;
    modifications: any;
  } | null>(null);


  // Save edited order
  const saveOrderEdits = async () => {
    if (!editingOrder) return;
    
    try {
      setIsProcessingPayment(true);
      const token = await AsyncStorage.getItem('token');
      if (!token || !API_URL) return;

      // Build the edit payload by comparing current cart with original items
      // TERMINOLOGY: products = menu items (Burger, Pizza), items = ingredients (beef, cheese)
      const products_to_add: any[] = [];
      const products_to_remove: number[] = [];
      const products_to_modify: any[] = [];

      // Find products to remove (in original but not in cart)
      originalOrderItems.forEach((origItem: any) => {
        const stillInCart = cart.some(cartItem => 
          cartItem.productId === origItem.product_id?.toString() &&
          cartItem.variantId === origItem.variant_id?.toString()
        );
        if (!stillInCart) {
          products_to_remove.push(origItem.id);
        }
      });

      // Find products to add or modify
      cart.forEach(cartItem => {
        const origItem = originalOrderItems.find((o: any) => 
          o.product_id?.toString() === cartItem.productId &&
          o.variant_id?.toString() === cartItem.variantId
        );

        if (!origItem) {
          // New product to add
          products_to_add.push({
            product_id: parseInt(cartItem.productId),
            variant_id: cartItem.variantId ? parseInt(cartItem.variantId) : undefined,
            product_name: cartItem.name,
            quantity: cartItem.quantity,
            unit_price: cartItem.basePrice,
            modifiers: [
              ...cartItem.removedModifiers.map((name: string) => ({ 
                modifier_name: name, 
                modifier_type: 'removal',
                unit_price: 0,
                quantity: 1
              })),
              ...cartItem.addedModifiers.map((m: any) => ({ 
                modifier_name: m.name, 
                modifier_type: 'extra',
                unit_price: m.price,
                quantity: m.quantity || 1
              })),
            ],
          });
        } else if (origItem.quantity !== cartItem.quantity) {
          // Quantity changed
          products_to_modify.push({
            order_item_id: origItem.id,
            quantity: cartItem.quantity,
          });
        }
      });

      // Only call API if there are actual changes
      if (products_to_add.length === 0 && products_to_remove.length === 0 && products_to_modify.length === 0) {
        Alert.alert('No Changes', 'No changes were made to the order.');
        setIsProcessingPayment(false);
        return;
      }

      const response = await fetch(`${API_URL}/pos/orders/${editingOrder.id}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          products_to_add: products_to_add.length > 0 ? products_to_add : undefined,
          products_to_remove: products_to_remove.length > 0 ? products_to_remove : undefined,
          products_to_modify: products_to_modify.length > 0 ? products_to_modify : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Success', 'Order updated successfully!');
        cancelOrderEditing();
        loadRecentOrders();
      } else {
        Alert.alert('Error', result.error || 'Failed to update order');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update order');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Cancel an order (pending/in_progress → cancelled)
  const handleCancelOrder = async (orderId: number) => {
    // On web, Alert.alert doesn't work, so use window.confirm
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Are you sure you want to cancel this order? This cannot be undone.')
      : await new Promise<boolean>(resolve => {
          Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel this order? This cannot be undone.',
            [
              { text: 'No', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Yes, Cancel Order', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !API_URL) {
        if (Platform.OS === 'web') {
          window.alert('Not authenticated');
        } else {
          Alert.alert('Error', 'Not authenticated');
        }
        return;
      }

      const response = await fetch(`${API_URL}/pos/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Cancelled by cashier' }),
      });

      const result = await response.json();

      if (result.success) {
        if (Platform.OS === 'web') {
          window.alert('Order cancelled successfully');
        } else {
          Alert.alert('Success', 'Order cancelled successfully');
        }
        setShowOrderDetailsModal(false);
        loadRecentOrders();
      } else {
        if (Platform.OS === 'web') {
          window.alert(result.error || 'Failed to cancel order');
        } else {
          Alert.alert('Error', result.error || 'Failed to cancel order');
        }
      }
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to cancel order. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to cancel order. Please try again.');
      }
    }
  };

  useEffect(() => {
    loadUser();
    loadBusinessSettings();
    loadProducts();
    loadProductAvailability(); // Load stock availability for cart limits
    loadDeliveryPartners();
    loadRestaurantTables();
    loadDrivers();
    checkPosSession(); // Check if there's an active POS session
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Refresh business settings when screen comes into focus (for updated VAT, currency, etc.)
    const unsubscribe = navigation.addListener('focus', () => {
      loadBusinessSettings();
      loadDeliveryPartners();
      loadRestaurantTables();
      loadDrivers();
      checkPosSession();
    });
    
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [navigation]);

  // Idle timeout - lock screen after 5 minutes of inactivity
  useEffect(() => {
    // Only track idle if we have an active session AND employee is authenticated (not on login modal or initial PIN)
    if (!posSession || !selectedPosEmployee) {
      return;
    }

    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now();
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(() => {
        // Lock the screen
        setShowPinLockScreen(true);
      }, IDLE_TIMEOUT_MS);
    };

    // Start idle timer
    resetIdleTimer();

    // Cleanup
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [posSession]);

  // Reset idle timer on any user activity
  const resetIdleTimer = useCallback(() => {
    if (!posSession || showPinLockScreen || !selectedPosEmployee) return;
    
    lastActivityRef.current = Date.now();
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setShowPinLockScreen(true);
    }, IDLE_TIMEOUT_MS);
  }, [posSession, showPinLockScreen]);

  // PIN authentication handler
  const handlePinAuthentication = async (pin: string) => {
    if (pin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }

    setIsAuthenticatingPin(true);
    setPinError(null);

    try {
      const token = await AsyncStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/pos-sessions/pin-authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid PIN');
      }

      // Success - update current employee and unlock
      const employee = data.data.employee;
      setSelectedPosEmployee({
        id: employee.id,
        name: employee.display_name || employee.username,
        role: employee.role,
      });
      
      setPinInput('');
      setPinError(null);
      setShowPinLockScreen(false);
      setNeedsInitialPinAuth(false); // Clear initial auth flag
      resetIdleTimer();
      
      // If this was the initial PIN auth after session opening, show success message
      if (needsInitialPinAuth) {
        Alert.alert('Welcome', `Logged in as ${employee.display_name || employee.username}`);
      }
    } catch (err: any) {
      setPinError(err.message || 'Invalid PIN');
      setPinInput('');
    } finally {
      setIsAuthenticatingPin(false);
    }
  };

  // Check for active POS session - first check local storage, then verify with backend
  const checkPosSession = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !API_URL) return;

      // First, check if we have a stored POS session
      const storedSession = await AsyncStorage.getItem('pos_session');
      
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession);
        
        // Verify the stored session is still active on the backend
        const response = await fetch(`${API_URL}/pos-sessions/${parsedSession.id}/summary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (result.success) {
          // Session is still valid - restore it
          setPosSession(parsedSession);
          setCashDrawerBalance(result.data.current_balance || parsedSession.opening_float || 0);
          // Don't auto-select employee - require PIN authentication
          setSelectedPosEmployee(null);
          setNeedsInitialPinAuth(true);
          setShowPinLockScreen(true);
          return;
        } else {
          // Session no longer valid - clear stored session
          await AsyncStorage.removeItem('pos_session');
        }
      }

      // No stored session or it was invalid - check if business has an active session
      const response = await fetch(`${API_URL}/pos-sessions/business-active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        // Found active session for business - store and use it
        await AsyncStorage.setItem('pos_session', JSON.stringify(result.data));
        setPosSession(result.data);
        setCashDrawerBalance(result.data.cash_summary?.current_balance || result.data.opening_float || 0);
        // Don't auto-select employee - require PIN authentication
        setSelectedPosEmployee(null);
        setNeedsInitialPinAuth(true);
        setShowPinLockScreen(true);
      } else {
        // No active session - show PIN screen to select employee
        setPosSession(null);
        setSelectedPosEmployee(null);
        setNeedsInitialPinAuth(true);
        setShowPinLockScreen(true);
      }
    } catch (error) {
      console.error('Error checking POS session:', error);
      // On error, try to use stored session if available
      try {
        const storedSession = await AsyncStorage.getItem('pos_session');
        if (storedSession) {
          const parsedSession = JSON.parse(storedSession);
          setPosSession(parsedSession);
          setCashDrawerBalance(parsedSession.opening_float || 0);
          // Don't auto-select employee - require PIN authentication
          setSelectedPosEmployee(null);
          setNeedsInitialPinAuth(true);
          setShowPinLockScreen(true);
        } else {
          // No stored session - show PIN screen
          setPosSession(null);
          setSelectedPosEmployee(null);
          setNeedsInitialPinAuth(true);
          setShowPinLockScreen(true);
        }
      } catch (e) {
        // Error - show PIN screen
        setPosSession(null);
        setSelectedPosEmployee(null);
        setNeedsInitialPinAuth(true);
        setShowPinLockScreen(true);
      }
    }
  };

  // Open new POS session
  const openPosSession = async () => {
    // Validate employee is authenticated
    if (!selectedPosEmployee) {
      Alert.alert('Authentication Required', 'Please authenticate with your PIN first');
      setShowOpeningFloatModal(false);
      setShowPinLockScreen(true);
      return;
    }

    const floatAmount = parseFloat(openingFloat);
    
    if (isNaN(floatAmount) || floatAmount < 0) {
      Alert.alert('Error', 'Please enter a valid opening float amount');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token || !API_URL) {
        Alert.alert('Error', 'System configuration error. Please restart the app.');
        return;
      }

      const response = await fetch(`${API_URL}/pos-sessions/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cashier_id: selectedPosEmployee.id,
          opening_float: floatAmount,
        }),
      });
      
      const result = await response.json();

      if (result.success) {
        // Store the session in AsyncStorage for persistence across refreshes
        await AsyncStorage.setItem('pos_session', JSON.stringify(result.data));
        setPosSession(result.data);
        setCashDrawerBalance(floatAmount);
        setShowOpeningFloatModal(false);
        setOpeningFloat('');
        // Session opened - employee is authenticated and POS is ready
        Alert.alert(
          'Session Started', 
          `Cashier: ${selectedPosEmployee.name}\nOpening float: ${formatCurrency(floatAmount)}`, 
          [{ text: 'Start Working' }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to open session');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to open session');
    }
  };

  // Close POS session
  const closePosSession = async () => {
    const actualCount = parseFloat(actualCashCount);
    if (isNaN(actualCount) || actualCount < 0) {
      Alert.alert('Error', 'Please enter the actual cash count');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !API_URL || !posSession) return;

      const response = await fetch(`${API_URL}/pos-sessions/${posSession.id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          actual_cash_count: actualCount,
        }),
      });
      const result = await response.json();

      if (result.success) {
        const variance = result.data.variance || 0;
        const varianceText = variance > 0 ? `OVER by ${formatCurrency(variance)}` : 
                            variance < 0 ? `SHORT by ${formatCurrency(Math.abs(variance))}` : 
                            'No variance';
        
        Alert.alert(
          'Session Closed',
          `Expected: ${formatCurrency(result.data.expected_cash)}\n` +
          `Actual: ${formatCurrency(actualCount)}\n` +
          `${varianceText}`,
          [{ text: 'OK', onPress: () => {
            // After acknowledging, clear cart and show PIN screen for next employee
            setCart([]);
            setSelectedPosEmployee(null);
            setNeedsInitialPinAuth(true);
            setShowPinLockScreen(true);
          }}]
        );
        
        // Clear stored session and cart after closing
        await AsyncStorage.removeItem('pos_session');
        setPosSession(null);
        setShowCloseSessionModal(false);
        setActualCashCount('');
      } else {
        Alert.alert('Error', result.error || 'Failed to close session');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to close session');
    }
  };

  // Refresh cash drawer balance
  const refreshCashDrawerBalance = async () => {
    if (!posSession) return;
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !API_URL) return;

      const response = await fetch(`${API_URL}/pos-sessions/${posSession.id}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success) {
        setCashDrawerBalance(result.data.current_balance);
      }
    } catch (error) {
      console.error('Error refreshing cash balance:', error);
    }
  };

  const loadBusinessSettings = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const businessData = await AsyncStorage.getItem('business');
      
      // First try to get from stored business data
      if (businessData) {
        const business = JSON.parse(businessData);
        if (business.currency) {
          setCurrency(business.currency);
        } else {
          // Currency missing - block POS access
          Alert.alert(
            'Configuration Error',
            'Business currency not set. Please contact your administrator.',
            [{ text: 'OK' }]
          );
        }
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
            if (result.data.currency) {
              setCurrency(result.data.currency);
            } else {
              // Currency missing - block POS access
              Alert.alert(
                'Configuration Error',
                'Business currency not set. Please contact your administrator.',
                [{ text: 'OK' }]
              );
            }
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

  const loadDeliveryPartners = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const branchData = await AsyncStorage.getItem('branch');
      const businessData = await AsyncStorage.getItem('business');
      
      // Get branch_id from user data or stored branch
      let branchId: number | null = null;
      if (userData) {
        const user = JSON.parse(userData);
        branchId = user.branch_id;
      }
      if (!branchId && branchData) {
        const branch = JSON.parse(branchData);
        branchId = branch.id;
      }
      
      // If still no branch_id (e.g., owner account), fetch the main branch for the business
      if (!branchId && businessData && token && API_URL) {
        const business = JSON.parse(businessData);
        try {
          const branchesResponse = await fetch(`${API_URL}/businesses/${business.id}/branches`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const branchesResult = await branchesResponse.json();
          if (branchesResult.branches && branchesResult.branches.length > 0) {
            const mainBranch = branchesResult.branches.find((b: any) => b.is_main) || branchesResult.branches[0];
            branchId = mainBranch.id;
          }
        } catch (err) {
          console.error('Error fetching branches:', err);
        }
      }
      
      if (token && API_URL) {
        const url = branchId 
          ? `${API_URL}/delivery/partners?status=active&branch_id=${branchId}`
          : `${API_URL}/delivery/partners?status=active`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success && result.data) {
          setDeliveryPartners(result.data);
        }
      }
    } catch (error) {
      console.error('Error loading delivery partners:', error);
    }
  };

  const loadRestaurantTables = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const branchData = await AsyncStorage.getItem('branch');
      const businessData = await AsyncStorage.getItem('business');
      
      // Get branch_id from user data or stored branch
      let branchId: number | null = null;
      if (userData) {
        const user = JSON.parse(userData);
        branchId = user.branch_id;
      }
      if (!branchId && branchData) {
        const branch = JSON.parse(branchData);
        branchId = branch.id;
      }
      
      // If still no branch_id (e.g., owner account), fetch the main branch for the business
      if (!branchId && businessData && token && API_URL) {
        const business = JSON.parse(businessData);
        try {
          const branchesResponse = await fetch(`${API_URL}/businesses/${business.id}/branches`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const branchesResult = await branchesResponse.json();
          if (branchesResult.branches && branchesResult.branches.length > 0) {
            // Use the main branch or first branch
            const mainBranch = branchesResult.branches.find((b: any) => b.is_main) || branchesResult.branches[0];
            branchId = mainBranch.id;
          }
        } catch (err) {
          console.error('Error fetching branches:', err);
        }
      }
      
      if (token && API_URL && branchId) {
        const response = await fetch(`${API_URL}/tables?is_active=true&branch_id=${branchId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success && result.data) {
          setRestaurantTables(result.data);
        }
      }
    } catch (error) {
      console.error('Error loading restaurant tables:', error);
    }
  };

  // Load in-house drivers for delivery
  const loadDrivers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const branchData = await AsyncStorage.getItem('branch');
      
      let branchId: number | null = null;
      if (branchData) {
        const branch = JSON.parse(branchData);
        branchId = branch.id;
      }
      
      if (token && API_URL) {
        const url = branchId 
          ? `${API_URL}/drivers/available?branch_id=${branchId}`
          : `${API_URL}/drivers/available`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success && result.data) {
          setDrivers(result.data);
        }
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
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
      
      // Try to load from cache first for instant display
      try {
        const cachedProducts = await AsyncStorage.getItem(CACHE_KEYS.PRODUCTS);
        const cachedCategories = await AsyncStorage.getItem(CACHE_KEYS.CATEGORIES);
        if (cachedProducts) {
          const { data } = JSON.parse(cachedProducts);
          if (data && data.length > 0) {
            console.log('[POS] Using cached products:', data.length);
            setProducts(data);
            setLoadingProducts(false);
            // Continue to refresh in background
          }
        }
      } catch (cacheError) {
        console.log('[POS] Cache read error:', cacheError);
      }
      
      console.log('[POS] Loading products...');
      console.log('[POS] Token exists:', !!token);
      console.log('[POS] API_URL:', API_URL);
      
      if (token && API_URL) {
        let posProducts: Product[] = [];
        let posBundles: Product[] = [];

        // Get branch ID for stock checking
        const userData = await AsyncStorage.getItem('user');
        const branchData = await AsyncStorage.getItem('branch');
        const businessData = await AsyncStorage.getItem('business');
        
        let branchId: number | null = null;
        if (userData) {
          const user = JSON.parse(userData);
          branchId = user.branch_id;
        }
        if (!branchId && branchData) {
          const branch = JSON.parse(branchData);
          branchId = branch.id;
        }
        // If still no branch_id, fetch main branch for the business
        if (!branchId && businessData) {
          const business = JSON.parse(businessData);
          try {
            const branchesResponse = await fetch(`${API_URL}/businesses/${business.id}/branches`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const branchesResult = await branchesResponse.json();
            if (branchesResult.branches && branchesResult.branches.length > 0) {
              const mainBranch = branchesResult.branches.find((b: any) => b.is_main) || branchesResult.branches[0];
              branchId = mainBranch.id;
            }
          } catch (err) {
            console.log('[POS] Error fetching branches for stock check:', err);
          }
        }

        // Fetch products from store-products endpoint with branch_id for stock checking
        try {
          const productsUrl = branchId 
            ? `${API_URL}/store-products?branch_id=${branchId}`
            : `${API_URL}/store-products`;
          console.log('[POS] Fetching from:', productsUrl);
          const response = await fetch(productsUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('[POS] Response status:', response.status);
          const result = await response.json();
          console.log('[POS] Products result:', result);
          if (result.success && result.data) {
            // Transform products to POS format
            posProducts = result.data.map((p: any) => {
              // For variant products, collect removable ingredients from ALL variants
              let removableIngredients: any[] = [];
              if (p.has_variants && p.variants) {
                // Collect unique removable ingredients from all variants
                const seen = new Set<string>();
                p.variants.forEach((v: any) => {
                  (v.ingredients || [])
                    .filter((ing: any) => ing.removable)
                    .forEach((ing: any) => {
                      const key = ing.item_name || ing.name || `item-${ing.item_id}`;
                      if (!seen.has(key)) {
                        seen.add(key);
                        removableIngredients.push({
                          id: `ing-${ing.id || ing.item_id}`,
                          name: ing.item_name || ing.name,
                          name_ar: ing.item_name_ar || ing.name_ar,
                          removable: true,
                          addable: false,
                          extra_price: 0,
                        });
                      }
                    });
                });
              } else {
                // For non-variant products, use product-level ingredients
                removableIngredients = (p.ingredients || [])
                  .filter((ing: any) => ing.removable)
                  .map((ing: any) => ({
                    id: `ing-${ing.id || ing.item_id}`,
                    name: ing.item_name || ing.name,
                    name_ar: ing.item_name_ar || ing.name_ar,
                    removable: true,
                    addable: false,
                    extra_price: 0,
                  }));
              }

              // Product is available only if it's active AND in stock
              const isAvailable = p.is_active !== false && p.in_stock !== false;
              
              return {
                id: String(p.id),
                name: p.name,
                name_ar: p.name_ar,
                base_price: p.price,
                category_id: p.category_id ? String(p.category_id) : undefined,
                category_name: p.category_name || p.category,
                available: isAvailable,
                outOfStock: p.in_stock === false, // Explicit flag for out-of-stock status
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
                    in_stock: v.in_stock !== false, // Track individual variant availability
                  }))
                }] : [],
                // Map ingredients with removable flag + modifiers as combined modifiers for POS
                modifiers: [
                  // Removable ingredients (from variants or product-level)
                  ...removableIngredients,
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
              };
            });
          }
        } catch (apiError) {
          console.log('[POS] Products API error:', apiError);
        }

        // Fetch bundles from bundles endpoint with branch_id for stock checking
        try {
          const bundlesUrl = branchId 
            ? `${API_URL}/bundles?branch_id=${branchId}`
            : `${API_URL}/bundles`;
          console.log('[POS] Fetching bundles from:', bundlesUrl);
          const bundlesResponse = await fetch(bundlesUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('[POS] Bundles response status:', bundlesResponse.status);
          const bundlesResult = await bundlesResponse.json();
          console.log('[POS] Bundles result:', bundlesResult);
          if (bundlesResult.success && bundlesResult.data) {
            // Transform bundles to POS format (bundles are simple - no variants/modifiers)
            posBundles = bundlesResult.data
              .filter((b: any) => b.is_active)
              .map((b: any) => {
                // Bundle is available only if it's active AND in stock
                const isAvailable = b.in_stock !== false;
                
                return {
                  id: `bundle-${b.id}`,
                  name: b.name,
                  name_ar: b.name_ar,
                  base_price: b.price,
                  category_id: 'bundles',
                  category_name: 'Bundles',
                  available: isAvailable,
                  outOfStock: b.in_stock === false, // Explicit flag for out-of-stock status
                  variant_groups: [],
                  modifiers: [],
                  isBundle: true, // Flag to identify bundles
                  bundleItems: b.items, // Store bundle items for receipt
                };
              });
          }
        } catch (bundlesError) {
          console.log('[POS] Bundles API error:', bundlesError);
        }

        // Combine products and bundles
        const allItems = [...posProducts, ...posBundles];
        console.log('[POS] Total products loaded:', posProducts.length);
        console.log('[POS] Total bundles loaded:', posBundles.length);
        console.log('[POS] All items:', allItems.length);
        setProducts(allItems);
        
        // Cache for next time
        AsyncStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify({
          data: allItems,
          timestamp: Date.now(),
        })).catch(console.error);
        
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
      } else {
        console.log('[POS] No token or API_URL - cannot load products');
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

  // Load available quantities for each product based on inventory
  const loadProductAvailability = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !API_URL) return;

      // Get branch ID for stock checking
      const userData = await AsyncStorage.getItem('user');
      const branchData = await AsyncStorage.getItem('branch');
      
      let branchId: number | null = null;
      if (userData) {
        const user = JSON.parse(userData);
        branchId = user.branch_id;
      }
      if (!branchId && branchData) {
        const branch = JSON.parse(branchData);
        branchId = branch.id;
      }

      const url = branchId 
        ? `${API_URL}/pos/product-availability?branch_id=${branchId}`
        : `${API_URL}/pos/product-availability`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('[POS] Product availability loaded:', Object.keys(result.data).length, 'products');
        console.log('[POS] Availability data:', JSON.stringify(result.data));
        setProductAvailability(result.data);
        setAvailabilityLoaded(true);
      } else {
        console.log('[POS] Failed to load availability:', result);
        setAvailabilityLoaded(true); // Mark as loaded even on failure to allow ordering
      }
    } catch (error) {
      console.error('Error loading product availability:', error);
      setAvailabilityLoaded(true); // Mark as loaded even on error
    }
  };

  // Get current quantity of a product in the cart
  const getCartQuantityForProduct = (productId: string): number => {
    return cart
      .filter(item => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get available quantity for a product (max - already in cart)
  const getAvailableForProduct = (productId: string): number => {
    // Try both string and numeric key since API returns numeric keys
    const maxAvailable = productAvailability[productId] ?? productAvailability[parseInt(productId)] ?? 999;
    const inCart = getCartQuantityForProduct(productId);
    return Math.max(0, maxAvailable - inCart);
  };
  
  // Get max available for a product (from availability data)
  const getMaxAvailableForProduct = (productId: string): number => {
    return productAvailability[productId] ?? productAvailability[parseInt(productId)] ?? 999;
  };

  const handleLogout = async () => {
    // On web, Alert.alert doesn't work, so use window.confirm
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        await AsyncStorage.clear();
        navigation.replace('Login');
      }
    } else {
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
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category_name === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Helper to find product data for a bundle item
  const findProductForBundleItem = (bundleItem: any): Product | null => {
    const productId = bundleItem.product_id || bundleItem.product?.id;
    if (!productId) return null;
    return products.find(p => p.id === String(productId)) || null;
  };

  // Handle product tap - show customization modal for all products including bundles
  // Close the customization modal and reset all states
  const closeCustomizeModal = () => {
    // Check if we were adding to an existing order before clearing state
    const wasAddingToOrder = selectedProductToAdd && selectedOrderForView;
    
    setShowCustomizeModal(false);
    setSelectedProduct(null);
    setEditingCartItemId(null);
    setSelectedVariants({});
    setRemovedModifiers(new Set());
    setAddedModifiers(new Map());
    setBundleItemCustomizations({});
    // Also clear "add to order" state if set
    setSelectedProductToAdd(null);
    
    // If we were adding to an existing order, re-open the order details modal
    if (wasAddingToOrder) {
      setShowOrderDetailsModal(true);
    }
  };

  const handleProductTap = (product: Product) => {
    if (!product.available) {
      Alert.alert('Unavailable', 'This item is currently unavailable');
      return;
    }

    // Show customization modal for all products (including bundles)
    setSelectedProduct(product);
    // Pre-select first AVAILABLE option for required variant groups
    const initialVariants: Record<string, VariantOption> = {};
    product.variant_groups.forEach(group => {
      if (group.required && group.options.length > 0) {
        // Find the first variant that is in stock, fallback to first option
        const firstAvailable = group.options.find(opt => opt.in_stock !== false) || group.options[0];
        initialVariants[group.id] = firstAvailable;
      }
    });
    setSelectedVariants(initialVariants);
    setRemovedModifiers(new Set());
    setAddedModifiers(new Map());
    
    // Reset bundle item customizations
    if (product.isBundle && product.bundleItems) {
      const initialBundleCustomizations: Record<number, { removedModifiers: Set<string>; addedModifiers: Map<string, number> }> = {};
      product.bundleItems.forEach((_: any, index: number) => {
        initialBundleCustomizations[index] = {
          removedModifiers: new Set(),
          addedModifiers: new Map(),
        };
      });
      setBundleItemCustomizations(initialBundleCustomizations);
    } else {
      setBundleItemCustomizations({});
    }
    
    setShowCustomizeModal(true);
  };

  // Add a simple product (no variants) to cart
  const addSimpleProductToCart = (product: Product) => {
    // Check if session is active
    if (!posSession) {
      Alert.alert('Session Required', 'Please start a POS session first by clicking the "Start Session" button');
      return;
    }
    
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

  /**
   * Calculate customized item price for POS display
   * 
   * NOTE: This calculation is for REAL-TIME UX FEEDBACK only.
   * When the order is submitted, the backend validates and calculates final totals.
   * Product/variant/modifier prices come from backend API.
   * See: POST /api/pos/calculate-totals for backend calculation endpoint.
   */
  const calculateCustomizedPrice = () => {
    if (!selectedProduct) return 0;
    let price = selectedProduct.base_price;
    
    // Add variant price adjustments (prices from backend)
    Object.values(selectedVariants).forEach(option => {
      price += option.price_adjustment;
    });
    
    // Add extra modifier prices (prices from backend)
    selectedProduct.modifiers.forEach(mod => {
      const qty = addedModifiers.get(mod.id) || 0;
      if (qty > 0 && mod.addable) {
        price += mod.extra_price * qty;
      }
    });
    
    // Add bundle item extras
    if (selectedProduct.isBundle && selectedProduct.bundleItems) {
      selectedProduct.bundleItems.forEach((bundleItem: any, index: number) => {
        const itemProduct = findProductForBundleItem(bundleItem);
        const customizations = bundleItemCustomizations[index];
        if (itemProduct && customizations) {
          itemProduct.modifiers.forEach(mod => {
            const qty = customizations.addedModifiers.get(mod.id) || 0;
            if (qty > 0 && mod.addable) {
              price += mod.extra_price * qty;
            }
          });
        }
      });
    }
    
    return price;
  };

  // Add customized product to cart
  const addCustomizedToCart = () => {
    if (!selectedProduct) return;

    // Check if session is active
    if (!posSession) {
      Alert.alert('Session Required', 'Please start a POS session first by clicking the "Start Session" button');
      closeCustomizeModal();
      return;
    }

    // For non-bundle products, check all required variants are selected
    if (!selectedProduct.isBundle) {
      const missingRequired = selectedProduct.variant_groups.find(
        g => g.required && !selectedVariants[g.id]
      );
      if (missingRequired) {
        Alert.alert('Required', `Please select ${missingRequired.name}`);
        return;
      }
    }

    const itemPrice = calculateCustomizedPrice();
    
    // Build variant display names with IDs
    const variantsList = Object.entries(selectedVariants).map(([groupId, option]) => {
      const group = selectedProduct.variant_groups.find(g => g.id === groupId);
      return {
        groupName: group?.name || '',
        optionName: option.name,
        priceAdjustment: option.price_adjustment,
        variantId: option.id, // Include variant ID for inventory checking
      };
    });
    
    // Get the primary variant ID (for size/type variants)
    const primaryVariantId = Object.values(selectedVariants)[0]?.id;

    // Build modifier lists
    const removed = Array.from(removedModifiers).map(id => {
      const mod = selectedProduct.modifiers.find(m => m.id === id);
      return mod?.name || '';
    }).filter(Boolean);

    // Build added modifiers with quantities
    const added: { name: string; price: number; quantity: number }[] = [];
    addedModifiers.forEach((qty, id) => {
      if (qty > 0) {
        const mod = selectedProduct.modifiers.find(m => m.id === id);
        if (mod) {
          added.push({ name: mod.name, price: mod.extra_price, quantity: qty });
        }
      }
    });

    // For bundles, attach customizations to each bundle item
    let bundleItemsWithCustomizations = selectedProduct.bundleItems;
    if (selectedProduct.isBundle && selectedProduct.bundleItems) {
      bundleItemsWithCustomizations = selectedProduct.bundleItems.map((item: any, index: number) => {
        const itemProduct = findProductForBundleItem(item);
        const customizations = bundleItemCustomizations[index];
        
        const itemRemoved = customizations ? Array.from(customizations.removedModifiers).map(modId => {
          const mod = itemProduct?.modifiers.find(m => m.id === modId);
          return mod?.name || '';
        }).filter(Boolean) : [];
        
        // Build added modifiers with quantities for bundle items
        const itemAdded: { name: string; price: number; quantity: number }[] = [];
        if (customizations) {
          customizations.addedModifiers.forEach((qty, modId) => {
            if (qty > 0) {
              const mod = itemProduct?.modifiers.find(m => m.id === modId);
              if (mod) {
                itemAdded.push({ name: mod.name, price: mod.extra_price, quantity: qty });
              }
            }
          });
        }
        
        return {
          ...item,
          removedModifiers: itemRemoved,
          addedModifiers: itemAdded,
        };
      });
    }

    // Check if we can add this product based on available stock
    const maxQty = getMaxAvailableForProduct(selectedProduct.id);
    const inCart = getCartQuantityForProduct(selectedProduct.id);
    const availableQty = maxQty - inCart;
    
    console.log(`[Stock Check - Add] Product: ${selectedProduct.name} (${selectedProduct.id}), Max: ${maxQty}, In Cart: ${inCart}, Available: ${availableQty}, AvailabilityLoaded: ${availabilityLoaded}`);
    console.log(`[Stock Check - Add] productAvailability keys:`, Object.keys(productAvailability));
    
    // If availability is loaded and we have data for this product, enforce the limit
    if (availabilityLoaded && maxQty !== 999) {
      if (availableQty <= 0) {
        const msg = maxQty === 0
          ? `${selectedProduct.name} is out of stock`
          : `Cannot add more ${selectedProduct.name}. Maximum available: ${maxQty}`;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Stock Limit', msg);
        }
        return;
      }
    }

    // If editing an existing cart item, update it instead of adding new
    if (editingCartItemId) {
      setCart(prev => prev.map(item => {
        if (item.id === editingCartItemId) {
          // Update the existing item with new selections
          return {
            ...item,
            variantId: primaryVariantId,
            selectedVariants: variantsList,
            removedModifiers: removed,
            addedModifiers: added,
            totalPrice: itemPrice * item.quantity, // Recalculate total for current quantity
          };
        }
        return item;
      }));
      setEditingCartItemId(null);
    } else {
      // Adding a new item
      const cartItem: CartItem = {
        id: `${selectedProduct.id}-${Date.now()}`,
        productId: selectedProduct.id,
        variantId: primaryVariantId, // Selected variant ID for inventory checking
        bundleId: selectedProduct.isBundle ? selectedProduct.id : undefined, // Bundle ID if applicable
        name: selectedProduct.name,
        basePrice: selectedProduct.base_price,
        quantity: 1,
        selectedVariants: variantsList,
        removedModifiers: removed,
        addedModifiers: added,
        totalPrice: itemPrice,
        isBundle: selectedProduct.isBundle,
        bundleItems: bundleItemsWithCustomizations,
      };

      setCart(prev => [...prev, cartItem]);
    }
    
    closeCustomizeModal();
  };

  const updateQuantity = (id: string, delta: number) => {
    // Find item first to get product info
    const targetItem = cart.find(i => i.id === id);
    if (!targetItem) return;

    // Check stock limit when increasing quantity
    if (delta > 0) {
      const maxAvailable = getMaxAvailableForProduct(targetItem.productId);
      // Calculate current total in cart for this product (using current cart state)
      const currentTotalInCart = cart
        .filter(item => item.productId === targetItem.productId)
        .reduce((sum, item) => sum + item.quantity, 0);
      
      console.log(`[Stock Check - Update] Product: ${targetItem.name}, Max: ${maxAvailable}, In Cart: ${currentTotalInCart}, AvailabilityLoaded: ${availabilityLoaded}`);
      
      // If availability is loaded and we have data for this product, enforce the limit
      if (availabilityLoaded && maxAvailable !== 999 && currentTotalInCart >= maxAvailable) {
        const msg = `Cannot add more ${targetItem.name}. Maximum available: ${maxAvailable}`;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Stock Limit', msg);
        }
        return; // Don't update
      }
    }

    setCart(prev => {
      const updated = prev.map(cartItem => {
        if (cartItem.id === id) {
          const newQty = cartItem.quantity + delta;
          return newQty > 0 ? { ...cartItem, quantity: newQty } : cartItem;
        }
        return cartItem;
      }).filter(cartItem => cartItem.quantity > 0);
      return updated;
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  /**
   * Cart totals for UI display while user builds order
   * // UI preview only - backend calculates actual value on save
   * Item prices (totalPrice) come from backend product data
   * Tax rate comes from business settings via backend API
   * Backend recalculates and validates final totals when order is submitted
   */
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice * item.quantity, 0);
  const tax = subtotal * (taxRate / 100); // UI preview only - backend calculates actual value on save
  const total = subtotal + tax; // UI preview only - backend calculates actual value on save
  
  // Handle card payment - show transaction number modal first
  const handleCardPayment = () => {
    setShowPaymentModal(false);
    setTransactionNumber('');
    setShowTransactionModal(true);
  };

  // Confirm card payment with transaction number
  const confirmCardPayment = () => {
    if (!transactionNumber.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter the transaction number');
      } else {
        Alert.alert('Required', 'Please enter the transaction number');
      }
      return;
    }
    setShowTransactionModal(false);
    processPayment('card', transactionNumber.trim());
  };

  // Handle cash payment - show change calculator modal first
  const handleCashPayment = () => {
    setShowPaymentModal(false);
    setCustomerPaidAmount('');
    setShowCashModal(true);
  };

  // Calculate change for cash payment
  // Uses pendingOrderEdit.extraCost when collecting additional payment for an existing order
  const calculateChange = (): number => {
    const paid = parseFloat(customerPaidAmount) || 0;
    const amountDue = pendingOrderEdit ? pendingOrderEdit.extraCost : total;
    return paid - amountDue;
  };
  
  // Get the amount due for cash modal display
  const getCashModalAmountDue = (): number => {
    return pendingOrderEdit ? pendingOrderEdit.extraCost : total;
  };

  // Confirm cash payment with amount received
  const confirmCashPayment = () => {
    const amountReceived = parseFloat(customerPaidAmount) || 0;
    const amountDue = pendingOrderEdit ? pendingOrderEdit.extraCost : total;
    const change = amountReceived - amountDue;
    if (change < 0) {
      if (Platform.OS === 'web') {
        window.alert('Insufficient amount received');
      } else {
        Alert.alert('Error', 'Insufficient amount received');
      }
      return;
    }
    setShowCashModal(false);
    // Pass cash details for tracking cash drawer
    processPayment('cash', undefined, { amount_received: amountReceived, change_given: change });
  };

  const processPayment = async (
    method: 'cash' | 'card' | 'pay_later' | 'app_payment', 
    paymentReference?: string,
    cashDetails?: { amount_received: number; change_given: number },
    orderTypeOverride?: OrderType // Used when called before state update completes
  ) => {
    // Prevent double-clicks
    if (isProcessingPayment) {
      console.log('Already processing payment...');
      return;
    }
    
    setIsProcessingPayment(true);
    console.log('Processing payment:', method, paymentReference ? `(ref: ${paymentReference})` : '');
    
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const branchData = await AsyncStorage.getItem('branch');
      const businessData = await AsyncStorage.getItem('business');
      
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

      // Get branch_id for order isolation
      let branchId: number | null = null;
      if (userData) {
        const user = JSON.parse(userData);
        branchId = user.branch_id;
      }
      if (!branchId && branchData) {
        const branch = JSON.parse(branchData);
        branchId = branch.id;
      }
      // If still no branch_id (e.g., owner account), fetch the main branch
      if (!branchId && businessData) {
        const business = JSON.parse(businessData);
        try {
          const branchesResponse = await fetch(`${API_URL}/businesses/${business.id}/branches`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const branchesResult = await branchesResponse.json();
          if (branchesResult.branches && branchesResult.branches.length > 0) {
            const mainBranch = branchesResult.branches.find((b: any) => b.is_main) || branchesResult.branches[0];
            branchId = mainBranch.id;
          }
        } catch (err) {
          console.error('Error fetching branches for order:', err);
        }
      }

      // Check if this is an extra payment for an order edit or additional payment collection
      if (pendingOrderEdit) {
        console.log('Processing extra payment for order:', pendingOrderEdit);
        
        // Check if we have pending local changes to save
        const hasPendingLocalChanges = pendingProductsToAdd.length > 0 || 
                                       pendingProductsToRemove.length > 0 || 
                                       pendingProductModifications.length > 0;
        
        if (hasPendingLocalChanges) {
          // Build the edit payload from local pending state
          const payload: any = {};
          
          if (pendingProductsToAdd.length > 0) {
            payload.products_to_add = pendingProductsToAdd.map(p => ({
              product_id: p.product_id,
              product_name: p.product_name,
              variant_id: p.variant_id,
              quantity: p.quantity,
              unit_price: p.unit_price,
              modifiers: p.modifiers.map(m => ({
                modifier_name: m.modifier_name,
                modifier_type: m.modifier_type,
                unit_price: m.unit_price,
                quantity: m.quantity,
              })),
            }));
          }
          
          if (pendingProductsToRemove.length > 0) {
            payload.products_to_remove = pendingProductsToRemove;
          }
          
          if (pendingProductModifications.length > 0) {
            payload.products_to_modify = pendingProductModifications.map(m => ({
              order_item_id: m.order_item_id,
              variant_id: m.new_variant_id,
              modifiers: m.new_modifiers?.map(mod => ({
                modifier_name: mod.modifier_name,
                modifier_type: mod.modifier_type,
                unit_price: mod.unit_price,
                quantity: mod.quantity,
              })),
            }));
          }
          
          // Apply the edits first
          const editResponse = await fetch(`${API_URL}/pos/orders/${pendingOrderEdit.orderId}/edit`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          const editResult = await editResponse.json();
          if (!editResult.success) {
            throw new Error(editResult.error || 'Failed to modify order');
          }
        }

        // Record the extra payment
        const paymentResponse = await fetch(`${API_URL}/pos/orders/${pendingOrderEdit.orderId}/payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_method: method,
            amount: pendingOrderEdit.extraCost,
            reference: paymentReference,
            amount_received: cashDetails?.amount_received,
            change_given: cashDetails?.change_given,
            pos_session_id: posSession?.id,
            is_extra_payment: true,
          }),
        });
        
        const paymentResult = await paymentResponse.json();
        if (!paymentResult.success) {
          throw new Error(paymentResult.error || 'Failed to process payment');
        }

        // Success - fetch updated order and show it
        try {
          const updatedOrderResponse = await fetch(`${API_URL}/pos/orders/${pendingOrderEdit.orderId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const updatedOrderResult = await updatedOrderResponse.json();
          
          if (updatedOrderResult.success && updatedOrderResult.data) {
            // Update the order view with fresh data
            setSelectedOrderForView(updatedOrderResult.data);
          }
        } catch (err) {
          console.error('Failed to fetch updated order:', err);
        }
        
        // Close payment modal, clear pending state
        setShowPaymentModal(false);
        setPendingOrderEdit(null);
        resetPendingOrderChanges();
        loadRecentOrders();
        
        if (method === 'cash') {
          refreshCashDrawerBalance();
        }

        const successMsg = hasPendingLocalChanges 
          ? `Order updated successfully!`
          : `Payment of ${formatCurrency(pendingOrderEdit.extraCost)} collected.`;
        
        if (Platform.OS === 'web') {
          window.alert(successMsg);
        } else {
          Alert.alert('Success', successMsg);
        }
        setIsProcessingPayment(false);
        
        // Order Details Modal will automatically show updated order
        return;
      }

      console.log('API_URL:', API_URL);
      console.log('Cart items:', cart.length);

      // Build order items for API
      const orderItems = cart.map(item => ({
        product_id: item.productId.startsWith('bundle-') ? null : parseInt(item.productId),
        variant_id: item.variantId ? parseInt(item.variantId) : undefined, // Include variant ID for inventory checking
        bundle_id: item.bundleId && item.isBundle ? parseInt(item.bundleId.replace('bundle-', '')) : undefined,
        product_name: item.name,
        product_category: item.isBundle ? 'Bundle' : undefined,
        quantity: item.quantity,
        unit_price: item.totalPrice, // Total price per item (with modifiers)
        special_instructions: [
          ...item.selectedVariants.map(v => v.optionName),
          ...item.removedModifiers.map(m => `No ${m}`),
          ...item.addedModifiers.map(m => m.quantity > 1 ? `+${m.quantity}x ${m.name}` : `+${m.name}`),
        ].join(', ') || undefined,
        is_combo: item.isBundle || false,
        // Include both added extras (with price) and removed modifiers
        modifiers: [
          // Added modifiers (extras with cost)
          ...item.addedModifiers.map(m => ({
            modifier_name: m.name,
            unit_price: m.price,
            quantity: m.quantity,
            modifier_type: 'extra' as const,
          })),
          // Removed modifiers (no cost, just tracking)
          ...item.removedModifiers.map(m => ({
            modifier_name: m,
            unit_price: 0,
            quantity: 1,
            modifier_type: 'removal' as const,
          })),
        ],
      }));

      console.log('Sending order to API...');
      
      // Use orderTypeOverride if provided (for calls before state update completes), otherwise use state
      const effectiveOrderType = orderTypeOverride || orderType;
      
      // Create order via API - OPTIMIZED: process payment inline to avoid second API call
      const shouldProcessPaymentInline = method !== 'pay_later' && method !== 'app_payment';
      
      const response = await fetch(`${API_URL}/pos/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          branch_id: branchId, // Branch isolation - orders belong to specific branch
          order_source: 'pos',
          order_type: effectiveOrderType.type,
          table_number: effectiveOrderType.tableNumber,
          customer_name: effectiveOrderType.customerName,
          delivery_address: effectiveOrderType.deliveryAddress,
          customer_phone: effectiveOrderType.deliveryPhone,
          // For delivery partner orders, send the partner ID (backend sets app_payment status)
          // For in-house delivery, deliveryMethod is 'in_house' - don't send as partner ID
          delivery_partner_id: effectiveOrderType.type === 'delivery' && effectiveOrderType.deliveryMethod && effectiveOrderType.deliveryMethod !== 'in_house' 
            ? parseInt(effectiveOrderType.deliveryMethod) 
            : undefined,
          items: orderItems,
          // For app_payment (delivery partner), don't send payment_method - backend handles it
          payment_method: method === 'app_payment' ? undefined : method,
          payment_reference: paymentReference, // Transaction number for card payments
          pos_session_id: posSession?.id, // Link order to current POS session
          // Use selected employee ID, or fallback to session's cashier_id (for restored sessions)
          cashier_id: selectedPosEmployee?.id || posSession?.cashier_id,
          // OPTIMIZATION: Process payment inline (no second API call needed)
          process_payment_inline: shouldProcessPaymentInline,
          amount_received: cashDetails?.amount_received,
          change_given: cashDetails?.change_given,
        }),
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
      }

      // Order created successfully - payment already processed inline by backend
      setLastOrderNumber(result.data.order_number || result.data.display_number);
      setShowPaymentModal(false);
      setShowReceiptModal(true);

      // Refresh cash drawer balance after cash payment (fire and forget)
      if (method === 'cash') {
        refreshCashDrawerBalance();
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
      setTransactionNumber(''); // Clear transaction number
      setCustomerPaidAmount(''); // Clear cash amount
    }
  };

  const completeOrder = () => {
    setShowReceiptModal(false);
    setCart([]);
    // Reset order type completely - clear table and delivery selections
    setOrderType({ type: 'dine_in', tableId: undefined, tableNumber: undefined, deliveryMethod: undefined });
    setLastOrderNumber(null);
    // Refresh product availability after order (stock has changed)
    setAvailabilityLoaded(false); // Mark as not loaded so it refreshes
    loadProductAvailability();
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
    brandName: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.foreground,
      textAlign: 'center',
      marginTop: 6,
    },
    sidebarTabs: {
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
    },
    sidebarTab: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    sidebarTabActive: {
      backgroundColor: colors.secondary,
      borderColor: colors.foreground,
    },
    sidebarTabLabel: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.mutedForeground,
      marginTop: 4,
      textAlign: 'center',
    },
    sidebarTabLabelActive: {
      color: colors.primary,
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
    outOfStockBadge: {
      backgroundColor: '#F97316', // Orange for out of stock (vs red for unavailable)
    },
    menuItemNameUnavailable: {
      color: colors.mutedForeground,
    },
    menuItemPriceUnavailable: {
      color: colors.mutedForeground,
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
    optionBtnDisabled: {
      backgroundColor: colors.secondary,
      opacity: 0.5,
      borderColor: colors.muted,
    },
    optionTextDisabled: {
      color: colors.mutedForeground,
    },
    outOfStockText: {
      fontSize: 10,
      color: colors.destructive,
      marginTop: 2,
      fontWeight: '500',
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
    },
    customizeBodyWithContent: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      marginBottom: 16,
    },
    qrCodeContainer: {
      alignItems: 'center',
      padding: 16,
      backgroundColor: '#ffffff',
      borderRadius: 12,
      marginBottom: 24,
    },
    qrCodeHint: {
      fontSize: 11,
      color: '#71717a',
      marginTop: 8,
      textAlign: 'center',
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
    checkoutBtn: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      marginTop: 16,
    },
    checkoutText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
  });

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={[styles.menuItem, !item.available && styles.menuItemUnavailable]}
      onPress={() => handleProductTap(item)}
      activeOpacity={item.available ? 0.7 : 1}
      disabled={!item.available}
    >
      {!item.available && (
        <View style={[styles.unavailableBadge, item.outOfStock && styles.outOfStockBadge]}>
          <Text style={styles.unavailableText}>
            {item.outOfStock ? 'Out of Stock' : 'Unavailable'}
          </Text>
        </View>
      )}
      {item.isBundle && (
        <View style={styles.bundleBadge}>
          <Text style={styles.bundleText}>Bundle</Text>
        </View>
      )}
      <Text style={[styles.menuItemName, !item.available && styles.menuItemNameUnavailable]}>
        {item.name}
      </Text>
      <Text style={[styles.menuItemPrice, !item.available && styles.menuItemPriceUnavailable]}>
        {formatCurrency(item.base_price)}
      </Text>
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
    // For bundles, show the items included with their customizations
    if (item.isBundle && item.bundleItems && item.bundleItems.length > 0) {
      const bundleItemDescriptions = item.bundleItems.map((bi: any) => {
        const itemName = `${bi.quantity}x ${bi.product?.name || bi.product_name || 'Item'}`;
        const customizations: string[] = [];
        
        if (bi.removedModifiers && bi.removedModifiers.length > 0) {
          customizations.push(...bi.removedModifiers.map((m: string) => `No ${m}`));
        }
        if (bi.addedModifiers && bi.addedModifiers.length > 0) {
          customizations.push(...bi.addedModifiers.map((m: any) => 
            m.quantity > 1 ? `+${m.quantity}x ${m.name}` : `+${m.name}`
          ));
        }
        
        if (customizations.length > 0) {
          return `${itemName} (${customizations.join(', ')})`;
        }
        return itemName;
      });
      return bundleItemDescriptions.join(' • ');
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
    
    // Add extra modifiers with quantity
    if (item.addedModifiers.length > 0) {
      parts.push(item.addedModifiers.map(m => 
        m.quantity > 1 ? `+${m.quantity}x ${m.name}` : `+${m.name}`
      ).join(', '));
    }
    
    return parts.join(' • ');
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const description = getCartItemDescription(item);
    const product = products.find(p => p.id === item.productId);
    const hasCustomizations = (product?.variant_groups?.length || 0) > 0 || (product?.modifiers?.length || 0) > 0;
    
    // Check if this is a newly added item (only when editing an order)
    const isNewItem = editingOrder && !originalOrderItems.find((original: any) => {
      // Match based on product ID and variant (if any)
      return original.product_id?.toString() === item.productId && 
             (item.variantId ? original.variant_id?.toString() === item.variantId : true);
    });
    
    return (
      <View style={styles.cartItem}>
        <TouchableOpacity 
          style={styles.cartItemInfo}
          onPress={() => {
            // Allow editing variants/modifiers by tapping on the item
            if (hasCustomizations && product) {
              // Reopen customization modal with current selections
              setSelectedProduct(product);
              
              // Restore current variant selections
              // Convert from array format to Record format
              const variantsRecord: Record<string, VariantOption> = {};
              if (item.selectedVariants && Array.isArray(item.selectedVariants)) {
                item.selectedVariants.forEach((v: any) => {
                  // Find the matching variant group and option
                  product.variant_groups.forEach(group => {
                    const option = group.options.find(opt => 
                      opt.name === v.optionName && 
                      (v.variantId ? opt.id === v.variantId : true)
                    );
                    if (option) {
                      variantsRecord[group.id] = option;
                    }
                  });
                });
              }
              setSelectedVariants(variantsRecord);
              
              // Restore removed modifiers (convert array to Set)
              setRemovedModifiers(new Set(item.removedModifiers || []));
              
              // Restore added modifiers (convert array to Map)
              const addedMap = new Map<string, number>();
              if (item.addedModifiers && Array.isArray(item.addedModifiers)) {
                item.addedModifiers.forEach((mod: any) => {
                  // Find the modifier ID by name
                  const modifier = product.modifiers?.find(m => m.name === mod.name);
                  if (modifier) {
                    addedMap.set(modifier.id, mod.quantity);
                  }
                });
              }
              setAddedModifiers(addedMap);
              
              // Store the cart item ID so we can update it instead of adding new
              setEditingCartItemId(item.id);
              setShowCustomizeModal(true);
            }
          }}
          disabled={!hasCustomizations}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Text style={styles.cartItemName}>{item.name}</Text>
            {hasCustomizations && (
              <Edit3 size={14} color={colors.mutedForeground} />
            )}
            {isNewItem && (
              <View style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: colors.primaryForeground,
                }}>
                  NEW
                </Text>
              </View>
            )}
          </View>
          {description ? (
            <Text style={styles.cartItemMods}>{description}</Text>
          ) : null}
          <Text style={styles.cartItemPrice}>{formatCurrency(item.totalPrice)}</Text>
        </TouchableOpacity>
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
          <Command size={32} color={colors.foreground} />
          <Text style={styles.brandName}>Sylo POS</Text>
          
          {/* Sidebar Tabs */}
          <View style={styles.sidebarTabs}>
            <TouchableOpacity
              style={[styles.sidebarTab, activeSidebarTab === 'pos' && styles.sidebarTabActive]}
              onPress={() => setActiveSidebarTab('pos')}
            >
              <ShoppingCart
                size={22}
                color={colors.foreground}
              />
            </TouchableOpacity>
            <Text style={[styles.sidebarTabLabel, activeSidebarTab === 'pos' && styles.sidebarTabLabelActive]}>
              POS
            </Text>
            
            <TouchableOpacity
              style={[styles.sidebarTab, activeSidebarTab === 'orders' && styles.sidebarTabActive]}
              onPress={() => setActiveSidebarTab('orders')}
            >
              <ClipboardList
                size={22}
                color={colors.foreground}
              />
            </TouchableOpacity>
            <Text style={[styles.sidebarTabLabel, activeSidebarTab === 'orders' && styles.sidebarTabLabelActive]}>
              Orders
            </Text>
          </View>
        </View>
        
        <View style={styles.sidebarBottom}>
          {/* Session Control Button */}
          {posSession ? (
            // Show cash drawer + end session button when session is active
            <TouchableOpacity 
              style={{ 
                backgroundColor: colors.muted, 
                padding: 8, 
                borderRadius: 8, 
                alignItems: 'center',
                marginBottom: 8,
              }}
              onPress={() => {
                refreshCashDrawerBalance();
                setShowCloseSessionModal(true);
              }}
            >
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>Cash Drawer</Text>
              <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 12 }}>
                {formatCurrency(cashDrawerBalance)}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 9, marginTop: 4 }}>
                Tap to End Session
              </Text>
            </TouchableOpacity>
          ) : selectedPosEmployee ? (
            // Show "Switch User" and "Start Session" buttons when employee authenticated but no active session
            <View style={{ width: '100%', marginBottom: 8 }}>
              {/* Current Employee Label */}
              <View style={{ 
                backgroundColor: colors.muted,
                padding: 8,
                borderRadius: 6,
                marginBottom: 8,
              }}>
                <Text style={{ 
                  color: colors.mutedForeground, 
                  fontSize: 9, 
                  textAlign: 'center',
                  marginBottom: 2,
                }}>
                  CURRENT USER
                </Text>
                <Text style={{ 
                  color: colors.foreground, 
                  fontSize: 11, 
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  {selectedPosEmployee.name}
                </Text>
              </View>

              {/* Switch User Button */}
              <TouchableOpacity 
                style={{ 
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10, 
                  borderRadius: 8, 
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                  height: 44,
                }}
                onPress={() => {
                  // Sign out from current employee (not from POS)
                  setSelectedPosEmployee(null);
                  setNeedsInitialPinAuth(true);
                  setShowPinLockScreen(true);
                }}
              >
                <User size={22} color={colors.foreground} />
              </TouchableOpacity>

              {/* Start Session Button */}
              <TouchableOpacity 
                style={{ 
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10, 
                  borderRadius: 8, 
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 44,
                }}
                onPress={() => {
                  setOpeningFloat('');
                  setShowOpeningFloatModal(true);
                }}
              >
                <ClipboardList size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          ) : null}
          
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
        {activeSidebarTab === 'orders' ? (
          /* Orders Tab Content */
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Orders Header */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>
                Today's Orders
              </Text>
              <TouchableOpacity 
                onPress={loadRecentOrders}
                style={{ 
                  padding: 8, 
                  backgroundColor: colors.muted, 
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Receipt size={16} color={colors.foreground} />
                <Text style={{ color: colors.foreground, fontSize: 14 }}>Refresh</Text>
              </TouchableOpacity>
            </View>
            
            {/* Filter Tabs */}
            <View style={{ 
              flexDirection: 'row', 
              padding: 12,
              gap: 8,
            }}>
              {(['all', 'pending', 'in_progress', 'completed', 'cancelled'] as const).map(filter => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setOrdersFilter(filter)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: ordersFilter === filter ? colors.primary : colors.muted,
                  }}
                >
                  <Text style={{
                    color: ordersFilter === filter ? colors.primaryForeground : colors.foreground,
                    fontWeight: ordersFilter === filter ? '600' : '400',
                  }}>
                    {filter === 'in_progress' ? 'In Progress' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Orders List */}
            {loadingOrders ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: colors.mutedForeground }}>Loading orders...</Text>
              </View>
            ) : recentOrders.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                <ClipboardList size={48} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>No orders found</Text>
              </View>
            ) : (
              <FlatList
                data={recentOrders}
                keyExtractor={(item) => item.id?.toString() || item.order_number}
                contentContainerStyle={{ padding: 12, gap: 8 }}
                renderItem={({ item }) => {
                  const statusColors: Record<string, string> = {
                    pending: '#f59e0b',
                    confirmed: '#3b82f6',
                    preparing: '#8b5cf6',
                    ready: '#10b981',
                    completed: '#22c55e',
                    picked_up: '#10b981',
                    cancelled: '#ef4444',
                  };
                  const statusColor = statusColors[item.order_status] || colors.mutedForeground;
                  
                  const isEditable = !['completed', 'cancelled', 'rejected'].includes(item.order_status);
                  
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedOrderForView(item);
                        setShowOrderDetailsModal(true);
                      }}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: isEditable ? colors.border : colors.muted,
                        opacity: isEditable ? 1 : 0.7,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.foreground }}>
                            #{item.order_number}
                          </Text>
                          <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '500' }}>
                            TAP TO VIEW
                          </Text>
                        </View>
                        <View style={{ 
                          backgroundColor: statusColor + '20', 
                          paddingHorizontal: 10, 
                          paddingVertical: 4, 
                          borderRadius: 12 
                        }}>
                          <Text style={{ 
                            color: statusColor, 
                            fontSize: 12, 
                            fontWeight: '600',
                            textTransform: 'capitalize',
                          }}>
                            {item.order_status?.replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {item.order_type === 'dine_in' && <UtensilsCrossed size={14} color={colors.mutedForeground} />}
                            {item.order_type === 'takeaway' && <ShoppingCart size={14} color={colors.mutedForeground} />}
                            {item.order_type === 'delivery' && <Truck size={14} color={colors.mutedForeground} />}
                            <Text style={{ color: colors.mutedForeground, fontSize: 12, textTransform: 'capitalize' }}>
                              {item.order_type?.replace('_', ' ')}
                            </Text>
                            {/* Show table number for dine-in orders */}
                            {item.order_type === 'dine_in' && item.table_number && (
                              <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '600' }}>
                                • T{item.table_number}
                              </Text>
                            )}
                          </View>
                          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                            {item.order_items?.length || 0} items
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                            {new Date(item.created_at).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {/* Payment Status Badge */}
                          <View style={{ 
                            backgroundColor: item.payment_status === 'paid' ? '#d1fae5' 
                              : item.payment_status === 'app_payment' ? '#dbeafe' 
                              : '#fef3c7',
                            paddingHorizontal: 8, 
                            paddingVertical: 3, 
                            borderRadius: 8 
                          }}>
                            <Text style={{ 
                              color: item.payment_status === 'paid' ? '#059669' 
                                : item.payment_status === 'app_payment' ? '#2563eb' 
                                : '#d97706',
                              fontSize: 10, 
                              fontWeight: '600',
                            }}>
                              {item.payment_status === 'paid' ? 'Paid' 
                                : item.payment_status === 'app_payment' ? 'App' 
                                : 'Unpaid'}
                            </Text>
                          </View>
                          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.foreground }}>
                            {formatCurrency(item.total_amount || 0)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        ) : (
        /* POS Tab Content */
        <>
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
              key={`products-${isTablet ? 3 : 2}`}
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
            <View style={{ flex: 1 }}>
              <Text style={styles.cartTitle}>
                {editingOrder ? `Editing #${editingOrder.order_number}` : 'Current Order'}
              </Text>
              {editingOrder && (
                <TouchableOpacity onPress={cancelOrderEditing}>
                  <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 2 }}>
                    Cancel Edit
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
              onPress={() => setShowTableSelectionModal(true)}
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
                numberOfLines={1}
              >
                {orderType.type === 'dine_in' && orderType.tableId 
                  ? `T${restaurantTables.find(t => t.id === orderType.tableId)?.table_number || ''}`
                  : 'Dine In'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.orderTypeBtn,
                orderType.type === 'takeaway' && styles.orderTypeBtnActive,
              ]}
              onPress={() => setOrderType({ type: 'takeaway', tableId: undefined, tableNumber: undefined, deliveryMethod: undefined })}
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
              onPress={() => setShowDeliveryMethodModal(true)}
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
                numberOfLines={1}
              >
                {orderType.type === 'delivery' && orderType.deliveryMethod 
                  ? deliveryPartners.find(p => String(p.id) === orderType.deliveryMethod)?.name || 'Delivery'
                  : 'Delivery'}
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
              <Text style={styles.totalsValue}>{formatCurrency(subtotal)}</Text>
            </View>
            {taxRate > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>VAT ({taxRate}%)</Text>
                <Text style={styles.totalsValue}>{formatCurrency(tax)}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.chargeBtn, 
                cart.length === 0 && styles.chargeBtnDisabled,
                editingOrder && { backgroundColor: '#10b981' }, // Green for save
              ]}
              onPress={() => {
                if (editingOrder) {
                  // Save edited order
                  saveOrderEdits();
                  return;
                }
                // For dine-in, require table selection first
                if (orderType.type === 'dine_in' && !orderType.tableId) {
                  setShowTableSelectionModal(true);
                  return;
                }
                // For delivery partner orders, skip payment modal - partner handles payment
                if (orderType.type === 'delivery' && orderType.deliveryMethod && orderType.deliveryMethod !== 'in_house') {
                  processPayment('app_payment');
                  return;
                }
                setShowPaymentModal(true);
              }}
              disabled={cart.length === 0 || isProcessingPayment}
            >
              {editingOrder ? (
                <>
                  <Check size={18} color={colors.primaryForeground} />
                  <Text style={styles.chargeBtnText}>
                    {isProcessingPayment ? 'Saving...' : 'Save Changes'}
                  </Text>
                </>
              ) : (
                <>
                  <CreditCard size={18} color={colors.primaryForeground} />
                  <Text style={styles.chargeBtnText}>
                    {orderType.type === 'dine_in' && !orderType.tableId 
                      ? 'Select Table' 
                      : `Charge ${formatCurrency(total)}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
        </>
        )}
      </View>

      {/* Customize Product Modal */}
      <Modal
        visible={showCustomizeModal}
        transparent
        animationType="slide"
        onRequestClose={closeCustomizeModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeCustomizeModal}
        >
          <TouchableOpacity activeOpacity={1} style={styles.customizeModalContent}>
            {/* Header */}
            <View style={styles.customizeHeader}>
              <View>
                <Text style={styles.customizeTitle}>
                  {selectedProduct?.name}
                  {editingCartItemId && ' (Editing)'}
                </Text>
                <Text style={styles.customizePrice}>
                  {formatCurrency(calculateCustomizedPrice())}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={closeCustomizeModal}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Body - show for variants, modifiers, or bundle items */}
            {((selectedProduct?.variant_groups?.length ?? 0) > 0 || (selectedProduct?.modifiers?.length ?? 0) > 0 || (selectedProduct?.isBundle && selectedProduct?.bundleItems?.length)) && (
            <ScrollView style={[styles.customizeBody, styles.customizeBodyWithContent]} showsVerticalScrollIndicator={false}>
              
              {/* Bundle Items with Customizations */}
              {selectedProduct?.isBundle && selectedProduct?.bundleItems && selectedProduct.bundleItems.length > 0 && (
                <View style={{ gap: 16 }}>
                  {selectedProduct.bundleItems.map((bundleItem: any, itemIndex: number) => {
                    const itemProduct = findProductForBundleItem(bundleItem);
                    const itemName = bundleItem.product?.name || bundleItem.product_name || 'Item';
                    const removableModifiers = itemProduct?.modifiers.filter(m => m.removable) || [];
                    const addableModifiers = itemProduct?.modifiers.filter(m => m.addable) || [];
                    const hasCustomizations = removableModifiers.length > 0 || addableModifiers.length > 0;
                    
                    return (
                      <View key={itemIndex} style={{
                        backgroundColor: colors.muted,
                        borderRadius: 12,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}>
                        {/* Item Header */}
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: hasCustomizations ? 12 : 0 }}>
                          {bundleItem.quantity}x {itemName}
                        </Text>
                        
                        {/* Removable Items for this bundle item */}
                        {removableModifiers.length > 0 && (
                          <View style={{ marginBottom: addableModifiers.length > 0 ? 12 : 0 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.mutedForeground, marginBottom: 8, textTransform: 'uppercase' }}>Remove</Text>
                            <View style={styles.optionsRow}>
                              {removableModifiers.map(mod => {
                                const isRemoved = bundleItemCustomizations[itemIndex]?.removedModifiers.has(mod.id);
                                return (
                                  <TouchableOpacity
                                    key={mod.id}
                                    style={[
                                      styles.modifierBtn,
                                      { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                                      isRemoved && styles.modifierBtnActive,
                                    ]}
                                    onPress={() => {
                                      setBundleItemCustomizations(prev => {
                                        const current = prev[itemIndex] || { removedModifiers: new Set(), addedModifiers: new Set() };
                                        const newRemoved = new Set(current.removedModifiers);
                                        if (newRemoved.has(mod.id)) {
                                          newRemoved.delete(mod.id);
                                        } else {
                                          newRemoved.add(mod.id);
                                        }
                                        return {
                                          ...prev,
                                          [itemIndex]: { ...current, removedModifiers: newRemoved },
                                        };
                                      });
                                    }}
                                  >
                                    {isRemoved && <X size={14} color={colors.destructive} />}
                                    <Text style={[styles.modifierText, isRemoved && styles.modifierTextRemoved]}>
                                      No {mod.name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        )}
                        
                        {/* Addable Items for this bundle item */}
                        {addableModifiers.length > 0 && (
                          <View>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.mutedForeground, marginBottom: 8, textTransform: 'uppercase' }}>Add Extra</Text>
                            <View style={styles.optionsRow}>
                              {addableModifiers.map(mod => {
                                const modQty = bundleItemCustomizations[itemIndex]?.addedModifiers.get(mod.id) || 0;
                                const isAdded = modQty > 0;
                                return (
                                  <View
                                    key={mod.id}
                                    style={[
                                      styles.modifierBtn,
                                      { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
                                      isAdded && styles.modifierBtnAdded,
                                    ]}
                                  >
                                    <TouchableOpacity
                                      onPress={() => {
                                        setBundleItemCustomizations(prev => {
                                          const current = prev[itemIndex] || { removedModifiers: new Set(), addedModifiers: new Map() };
                                          const newAdded = new Map(current.addedModifiers);
                                          const currentQty = newAdded.get(mod.id) || 0;
                                          if (currentQty > 0) {
                                            if (currentQty === 1) {
                                              newAdded.delete(mod.id);
                                            } else {
                                              newAdded.set(mod.id, currentQty - 1);
                                            }
                                          }
                                          return {
                                            ...prev,
                                            [itemIndex]: { ...current, addedModifiers: newAdded },
                                          };
                                        });
                                      }}
                                      style={{ padding: 4 }}
                                    >
                                      <Minus size={14} color={isAdded ? colors.primary : colors.mutedForeground} />
                                    </TouchableOpacity>
                                    <Text style={[styles.modifierText, isAdded && { color: colors.primary, fontWeight: '600' }]}>
                                      {mod.name} {modQty > 0 ? `(${modQty})` : ''} +{formatCurrency(mod.extra_price)}
                                    </Text>
                                    <TouchableOpacity
                                      onPress={() => {
                                        setBundleItemCustomizations(prev => {
                                          const current = prev[itemIndex] || { removedModifiers: new Set(), addedModifiers: new Map() };
                                          const newAdded = new Map(current.addedModifiers);
                                          const currentQty = newAdded.get(mod.id) || 0;
                                          newAdded.set(mod.id, currentQty + 1);
                                          return {
                                            ...prev,
                                            [itemIndex]: { ...current, addedModifiers: newAdded },
                                          };
                                        });
                                      }}
                                      style={{ padding: 4 }}
                                    >
                                      <Plus size={14} color={colors.primary} />
                                    </TouchableOpacity>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Variant Groups */}
              {selectedProduct?.variant_groups.map(group => (
                <View key={group.id} style={styles.variantSection}>
                  <Text style={styles.sectionLabel}>
                    {group.name} {group.required ? '*' : ''}
                  </Text>
                  <View style={styles.optionsRow}>
                    {group.options.map(option => {
                      const isSelected = selectedVariants[group.id]?.id === option.id;
                      const isOutOfStock = option.in_stock === false;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.optionBtn,
                            isSelected && styles.optionBtnSelected,
                            isOutOfStock && styles.optionBtnDisabled,
                          ]}
                          disabled={isOutOfStock}
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
                              isOutOfStock && styles.optionTextDisabled,
                            ]}
                          >
                            {option.name}
                          </Text>
                          {isOutOfStock ? (
                            <Text style={styles.outOfStockText}>Out of Stock</Text>
                          ) : option.price_adjustment !== 0 ? (
                            <Text style={styles.optionPrice}>
                              {option.price_adjustment > 0 ? '+' : ''}{formatCurrency(option.price_adjustment)}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Modifiers - Removable Items */}
              {(selectedProduct?.modifiers?.filter(m => m.removable).length ?? 0) > 0 && (
                <View style={styles.variantSection}>
                  <Text style={styles.sectionLabel}>Remove</Text>
                  <View style={styles.optionsRow}>
                    {selectedProduct?.modifiers
                      ?.filter(m => m.removable)
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
              {(selectedProduct?.modifiers?.filter(m => m.addable).length ?? 0) > 0 && (
                <View style={styles.variantSection}>
                  <Text style={styles.sectionLabel}>Add Extra</Text>
                  <View style={styles.optionsRow}>
                    {selectedProduct?.modifiers
                      ?.filter(m => m.addable)
                      .map(mod => {
                        const modQty = addedModifiers.get(mod.id) || 0;
                        const isAdded = modQty > 0;
                        return (
                          <View
                            key={mod.id}
                            style={[
                              styles.modifierBtn,
                              { flexDirection: 'row', alignItems: 'center', gap: 8 },
                              isAdded && styles.modifierBtnAdded,
                            ]}
                          >
                            <TouchableOpacity
                              onPress={() => {
                                setAddedModifiers(prev => {
                                  const next = new Map(prev);
                                  const currentQty = next.get(mod.id) || 0;
                                  if (currentQty > 0) {
                                    if (currentQty === 1) {
                                      next.delete(mod.id);
                                    } else {
                                      next.set(mod.id, currentQty - 1);
                                    }
                                  }
                                  return next;
                                });
                              }}
                              style={{ padding: 4 }}
                            >
                              <Minus size={14} color={isAdded ? colors.primary : colors.mutedForeground} />
                            </TouchableOpacity>
                            <Text style={[styles.modifierText, isAdded && { color: colors.primary, fontWeight: '600' }]}>
                              {mod.name} {modQty > 0 ? `(${modQty})` : ''} +{formatCurrency(mod.extra_price)}
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                setAddedModifiers(prev => {
                                  const next = new Map(prev);
                                  const currentQty = next.get(mod.id) || 0;
                                  next.set(mod.id, currentQty + 1);
                                  return next;
                                });
                              }}
                              style={{ padding: 4 }}
                            >
                              <Plus size={14} color={colors.primary} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                  </View>
                </View>
              )}
            </ScrollView>
            )}

            {/* Footer */}
            <View style={styles.customizeFooter}>
              <TouchableOpacity
                style={styles.addToCartBtn}
                onPress={() => {
                  // Check if we're adding to an existing order (editing) or to cart (new order)
                  if (selectedProductToAdd && selectedOrderForView) {
                    addCustomizedProductToOrder();
                  } else {
                    addCustomizedToCart();
                  }
                }}
                disabled={savingOrderEdit}
              >
                <ShoppingCart size={18} color={colors.primaryForeground} />
                <Text style={styles.addToCartText}>
                  {selectedProductToAdd && selectedOrderForView 
                    ? `Add to Order - ${formatCurrency(calculateCustomizedPrice())}`
                    : `Add to Cart - ${formatCurrency(calculateCustomizedPrice())}`
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!pendingOrderEdit) setShowPaymentModal(false);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {
            if (!pendingOrderEdit) setShowPaymentModal(false);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pendingOrderEdit ? 'Collect Extra Payment' : 'Select Payment Method'}
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  if (pendingOrderEdit) {
                    // Cancel the pending edit
                    setPendingOrderEdit(null);
                  }
                  setShowPaymentModal(false);
                }}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Show extra payment amount when editing order */}
            {pendingOrderEdit && (
              <View style={{ backgroundColor: colors.primary + '15', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, textAlign: 'center' }}>
                  Extra Amount Due
                </Text>
                <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>
                  {formatCurrency(pendingOrderEdit.extraCost)}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                  for order modifications
                </Text>
              </View>
            )}

            <View style={styles.paymentOptions}>
              {isProcessingPayment && (
                <Text style={{ textAlign: 'center', marginBottom: 12, color: colors.primary }}>
                  Processing payment...
                </Text>
              )}
              <TouchableOpacity
                style={[styles.paymentBtn, isProcessingPayment && { opacity: 0.5 }]}
                onPress={handleCashPayment}
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
                onPress={handleCardPayment}
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

              {/* Pay Later option - only for dine-in orders, not for extra payments */}
              {orderType.type === 'dine_in' && !pendingOrderEdit && (
                <TouchableOpacity
                  style={[styles.paymentBtn, isProcessingPayment && { opacity: 0.5 }, { borderColor: colors.primary, borderWidth: 1 }]}
                  onPress={() => processPayment('pay_later')}
                  disabled={isProcessingPayment}
                >
                  <View style={[styles.paymentIcon, { backgroundColor: colors.primary }]}>
                    <Clock size={24} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.paymentText}>Pay Later</Text>
                    <Text style={styles.paymentSubtext}>Customer pays after dining</Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={colors.mutedForeground}
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Cash Payment Modal (change calculator) */}
      <Modal
        visible={showCashModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCashModal(false);
          setCustomerPaidAmount('');
          // Order Details Modal stays open underneath
        }}
      >
        <TouchableOpacity 
          style={[styles.modalOverlay, { zIndex: 1100 }]} 
          activeOpacity={1} 
          onPress={() => {
            setShowCashModal(false);
            setCustomerPaidAmount('');
          }}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { width: isTablet ? 450 : width - 48, zIndex: 1101 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cash Payment</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setShowCashModal(false);
                  setCustomerPaidAmount('');
                }}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              {/* Amount Due */}
              <View style={{ alignItems: 'center', marginBottom: 24, padding: 16, backgroundColor: colors.muted, borderRadius: 16 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 14, marginBottom: 4 }}>
                  {pendingOrderEdit ? 'Amount Due' : 'Order Total'}
                </Text>
                <Text style={{ fontSize: 36, fontWeight: 'bold', color: colors.foreground }}>
                  {formatCurrency(getCashModalAmountDue())}
                </Text>
              </View>

              {/* Amount Received Input */}
              <Text style={{ color: colors.mutedForeground, marginBottom: 8, fontSize: 14 }}>Amount Received from Customer</Text>
              <TextInput
                style={{
                  backgroundColor: colors.muted,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: colors.foreground,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
                placeholder="0.000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={customerPaidAmount}
                onChangeText={setCustomerPaidAmount}
                autoFocus
              />

              {/* Quick Amount Buttons */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[1, 5, 10, 20].map(amount => (
                  <TouchableOpacity
                    key={amount}
                    onPress={() => setCustomerPaidAmount(amount.toFixed(3))}
                    style={{ 
                      backgroundColor: colors.muted, 
                      paddingVertical: 12, 
                      paddingHorizontal: 20, 
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>{formatCurrency(amount)}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => setCustomerPaidAmount(getCashModalAmountDue().toFixed(3))}
                  style={{ 
                    backgroundColor: colors.primary + '20', 
                    paddingVertical: 12, 
                    paddingHorizontal: 20, 
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.primary,
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 16 }}>Exact</Text>
                </TouchableOpacity>
              </View>

              {/* Change Display */}
              <View style={{ 
                padding: 20, 
                backgroundColor: calculateChange() >= 0 ? '#22c55e15' : '#ef444415', 
                borderRadius: 16,
                borderWidth: 2,
                borderColor: calculateChange() >= 0 ? '#22c55e' : '#ef4444',
                marginBottom: 20,
              }}>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 8 }}>
                  Change to Return
                </Text>
                <Text style={{ 
                  fontSize: 42, 
                  fontWeight: 'bold', 
                  textAlign: 'center',
                  color: calculateChange() >= 0 ? '#22c55e' : '#ef4444',
                }}>
                  {calculateChange() >= 0 ? formatCurrency(calculateChange()) : 'Insufficient'}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.muted,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setShowCashModal(false);
                    setCustomerPaidAmount('');
                  }}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 2,
                    backgroundColor: calculateChange() >= 0 && customerPaidAmount ? colors.primary : colors.muted,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    opacity: isProcessingPayment ? 0.5 : 1,
                  }}
                  onPress={confirmCashPayment}
                  disabled={isProcessingPayment || calculateChange() < 0 || !customerPaidAmount}
                >
                  <Text style={{ 
                    color: calculateChange() >= 0 && customerPaidAmount ? '#fff' : colors.mutedForeground, 
                    fontWeight: '600', 
                    fontSize: 16 
                  }}>
                    {isProcessingPayment ? 'Processing...' : 'Complete Payment'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Transaction Number Modal (for card payments) */}
      <Modal
        visible={showTransactionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowTransactionModal(false);
          setTransactionNumber('');
          // Order Details Modal stays open underneath
        }}
      >
        <TouchableOpacity 
          style={[styles.modalOverlay, { zIndex: 1100 }]} 
          activeOpacity={1} 
          onPress={() => {
            setShowTransactionModal(false);
            setTransactionNumber('');
          }}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { zIndex: 1101 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Card Payment</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setShowTransactionModal(false);
                  setTransactionNumber('');
                }}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              {/* Amount Display */}
              <View style={{ alignItems: 'center', marginBottom: 20, padding: 14, backgroundColor: colors.muted, borderRadius: 12 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 4 }}>
                  {pendingOrderEdit ? 'Amount Due' : 'Order Total'}
                </Text>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.foreground }}>
                  {formatCurrency(getCashModalAmountDue())}
                </Text>
              </View>
              
              <Text style={{ color: colors.mutedForeground, marginBottom: 8 }}>
                Enter the transaction number from the card terminal
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.muted,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 18,
                  color: colors.foreground,
                  marginBottom: 16,
                }}
                placeholder="Transaction Number"
                placeholderTextColor={colors.mutedForeground}
                value={transactionNumber}
                onChangeText={setTransactionNumber}
                autoFocus
                keyboardType="default"
              />
              
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.muted,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setShowTransactionModal(false);
                    setTransactionNumber('');
                  }}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    opacity: isProcessingPayment ? 0.5 : 1,
                  }}
                  onPress={confirmCardPayment}
                  disabled={isProcessingPayment}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {isProcessingPayment ? 'Processing...' : 'Confirm Payment'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        visible={showReceiptModal}
        transparent
        animationType="fade"
        onRequestClose={completeOrder}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={completeOrder}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.receiptContent}>
              <View style={styles.receiptIcon}>
                <CheckCircle size={40} color="#22c55e" />
              </View>
              <Text style={styles.receiptTitle}>Payment Successful</Text>
              <Text style={styles.receiptOrderNumber}>
                Order #{lastOrderNumber}
              </Text>
              <Text style={styles.receiptTotal}>{formatCurrency(total)}</Text>

              {/* QR Code for order completion scanning */}
              {lastOrderNumber && QRCode && (
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={lastOrderNumber}
                    size={120}
                    backgroundColor="#ffffff"
                    color="#000000"
                  />
                  <Text style={styles.qrCodeHint}>
                    Scan to complete order
                  </Text>
                </View>
              )}

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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delivery Method Modal */}
      <Modal
        visible={showDeliveryMethodModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeliveryMethodModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowDeliveryMethodModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Delivery Method</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowDeliveryMethodModal(false)}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              {/* In-house Delivery Option */}
              <TouchableOpacity
                style={[
                  styles.paymentBtn,
                  orderType.deliveryMethod === 'in_house' && {
                    borderWidth: 2,
                    borderColor: colors.primary,
                  }
                ]}
                onPress={() => {
                  setShowDeliveryMethodModal(false);
                  setShowCustomerInfoModal(true);
                }}
              >
                <View style={[styles.paymentIcon, { backgroundColor: colors.primary }]}>
                  <Truck size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentText}>In-house Delivery</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    Use your own drivers
                  </Text>
                </View>
                {orderType.deliveryMethod === 'in_house' && (
                  <Check size={20} color={colors.primary} />
                )}
              </TouchableOpacity>

              {deliveryPartners.length > 0 && (
                <View style={{ paddingVertical: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }}>
                    — Or select a delivery partner —
                  </Text>
                </View>
              )}

              {deliveryPartners.map(partner => (
                <TouchableOpacity
                  key={partner.id}
                  style={[
                    styles.paymentBtn,
                    orderType.deliveryMethod === String(partner.id) && {
                      borderWidth: 2,
                      borderColor: colors.primary,
                    }
                  ]}
                  onPress={() => {
                    const newOrderType: OrderType = { 
                      ...orderType, 
                      type: 'delivery' as const, 
                      deliveryMethod: String(partner.id),
                      tableId: undefined,
                      tableNumber: undefined 
                    };
                    setOrderType(newOrderType);
                    setShowDeliveryMethodModal(false);
                    // Just set the delivery partner - user will click Charge to submit
                  }}
                >
                  <View style={[
                    styles.paymentIcon, 
                    { backgroundColor: getPartnerColor(partner.name) }
                  ]}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                      {partner.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentText}>{partner.name}</Text>
                  </View>
                  {orderType.deliveryMethod === String(partner.id) && (
                    <Check size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Customer Info Modal for In-house Delivery */}
      <Modal
        visible={showCustomerInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomerInfoModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowCustomerInfoModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { maxWidth: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customer Information</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowCustomerInfoModal(false)}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16, paddingBottom: 16 }}>
                {/* Customer Name */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
                    Customer Name
                  </Text>
                  <TextInput
                    style={[styles.searchInput, { paddingLeft: 16 }]}
                    placeholder="Enter customer name"
                    placeholderTextColor={colors.mutedForeground}
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                </View>

                {/* Phone Number */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
                    Phone Number *
                  </Text>
                  <TextInput
                    style={[styles.searchInput, { paddingLeft: 16 }]}
                    placeholder="+965 XXXX XXXX"
                    placeholderTextColor={colors.mutedForeground}
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Delivery Address */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
                    Delivery Address *
                  </Text>
                  <TextInput
                    style={[styles.searchInput, { paddingLeft: 16, height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                    placeholder="Enter delivery address"
                    placeholderTextColor={colors.mutedForeground}
                    value={customerAddress}
                    onChangeText={setCustomerAddress}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Driver Selection */}
                {drivers.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
                      Assign Driver (Optional)
                    </Text>
                    <View style={{ gap: 8 }}>
                      {drivers.map(driver => (
                        <TouchableOpacity
                          key={driver.id}
                          style={[
                            styles.paymentBtn,
                            { paddingVertical: 10 },
                            selectedDriverId === driver.id && {
                              borderWidth: 2,
                              borderColor: colors.primary,
                            }
                          ]}
                          onPress={() => setSelectedDriverId(
                            selectedDriverId === driver.id ? null : driver.id
                          )}
                        >
                          <View style={[styles.paymentIcon, { 
                            backgroundColor: driver.status === 'available' ? '#10b981' : colors.mutedForeground,
                            width: 36,
                            height: 36,
                          }]}>
                            <User size={16} color="#fff" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.paymentText, { fontSize: 14 }]}>{driver.name}</Text>
                            {driver.phone && (
                              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                                {driver.phone}
                              </Text>
                            )}
                          </View>
                          {selectedDriverId === driver.id && (
                            <Check size={18} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.checkoutBtn,
                    (!customerPhone || !customerAddress) && { opacity: 0.5 }
                  ]}
                  disabled={!customerPhone || !customerAddress}
                  onPress={() => {
                    const selectedDriver = drivers.find(d => d.id === selectedDriverId);
                    setOrderType({
                      ...orderType,
                      type: 'delivery',
                      deliveryMethod: 'in_house',
                      customerName: customerName,
                      deliveryPhone: customerPhone,
                      deliveryAddress: customerAddress,
                      tableId: undefined,
                      tableNumber: undefined,
                    });
                    setShowCustomerInfoModal(false);
                    // Clear form
                    setCustomerName('');
                    setCustomerPhone('');
                    setCustomerAddress('');
                    setSelectedDriverId(null);
                    // If cart has items, go to payment
                    if (cart.length > 0) {
                      setShowPaymentModal(true);
                    }
                  }}
                >
                  <Text style={styles.checkoutText}>Confirm Delivery Details</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Table Selection Modal */}
      <Modal
        visible={showTableSelectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTableSelectionModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowTableSelectionModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Table</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowTableSelectionModal(false)}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                {restaurantTables.length === 0 ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                      No tables configured.{'\n'}Add them in Store Setup → Tables.
                    </Text>
                  </View>
                ) : (
                  restaurantTables.map(table => {
                    const isSelected = orderType.tableId === table.id;
                    const isOccupied = table.is_occupied && orderType.tableId !== table.id;
                    
                    return (
                      <TouchableOpacity
                        key={table.id}
                        style={[
                          styles.paymentBtn,
                          isSelected && {
                            borderWidth: 2,
                            borderColor: colors.primary,
                          },
                          isOccupied && {
                            opacity: 0.5,
                          }
                        ]}
                        onPress={() => {
                          if (!isOccupied) {
                            setOrderType({ 
                              ...orderType, 
                              type: 'dine_in', 
                              tableId: table.id,
                              tableNumber: table.table_number,
                              deliveryMethod: undefined 
                            });
                            setShowTableSelectionModal(false);
                            // If cart has items, go directly to payment
                            if (cart.length > 0) {
                              setShowPaymentModal(true);
                            }
                          }
                        }}
                        disabled={isOccupied}
                      >
                        <View style={[
                          styles.paymentIcon, 
                          { backgroundColor: isOccupied ? colors.mutedForeground : colors.primary }
                        ]}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                            T{table.table_number}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paymentText}>Table {table.table_number}</Text>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                            {table.seats} seats{table.zone ? ` • ${table.zone}` : ''}
                            {isOccupied ? ' • Occupied' : ''}
                          </Text>
                        </View>
                        {isSelected && (
                          <Check size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Opening Float Modal (Start Session) */}
      <Modal
        visible={showOpeningFloatModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowOpeningFloatModal(false);
          setOpeningFloat('');
        }}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={[styles.modalContent, { width: isTablet ? 400 : width - 48 }]}>
            <View style={[styles.modalHeader, { borderBottomWidth: 0 }]}>
              <Text style={[styles.modalTitle, { fontSize: 22 }]}>Start Your Shift</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowOpeningFloatModal(false);
                  setOpeningFloat('');
                }}
                style={styles.closeBtn}
              >
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <Text style={{ color: colors.mutedForeground, marginBottom: 20, textAlign: 'center' }}>
                Enter the opening cash float in your drawer
              </Text>

              <Text style={{ color: colors.mutedForeground, marginBottom: 8, fontSize: 14 }}>Opening Float</Text>
              <TextInput
                style={{
                  backgroundColor: colors.muted,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: colors.foreground,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
                placeholder="0.000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={openingFloat}
                onChangeText={setOpeningFloat}
                autoFocus
              />

              {/* Common Float Amounts */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[20, 50, 100].map(amount => (
                  <TouchableOpacity
                    key={amount}
                    onPress={() => setOpeningFloat(amount.toFixed(3))}
                    style={{
                      backgroundColor: colors.muted,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: '600' }}>{formatCurrency(amount)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.muted,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setShowOpeningFloatModal(false);
                    setOpeningFloat('');
                  }}
                >
                  <Text style={{
                    color: colors.foreground,
                    fontWeight: '600',
                    fontSize: 16,
                  }}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 2,
                    backgroundColor: openingFloat ? '#10b981' : colors.muted,
                    padding: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  onPress={openPosSession}
                  disabled={!openingFloat}
                >
                  <Text style={{
                    color: openingFloat ? '#ffffff' : colors.mutedForeground,
                    fontWeight: '600',
                    fontSize: 16,
                  }}>
                    Open Cash Drawer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Close Session Modal */}
      <Modal
        visible={showCloseSessionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCloseSessionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCloseSessionModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { width: isTablet ? 450 : width - 48 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Close Shift</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowCloseSessionModal(false)}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              {/* Expected Cash Display */}
              <View style={{
                padding: 16,
                backgroundColor: colors.muted,
                borderRadius: 12,
                marginBottom: 20,
              }}>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginBottom: 8 }}>
                  Expected Cash in Drawer
                </Text>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.foreground, textAlign: 'center' }}>
                  {formatCurrency(cashDrawerBalance)}
                </Text>
              </View>

              {/* Actual Count Input */}
              <Text style={{ color: colors.mutedForeground, marginBottom: 8, fontSize: 14 }}>
                Count and enter actual cash
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.muted,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: colors.foreground,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
                placeholder="0.000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={actualCashCount}
                onChangeText={setActualCashCount}
                autoFocus
              />

              {/* Variance Preview */}
              {actualCashCount && (
                <View style={{
                  padding: 12,
                  backgroundColor: (() => {
                    const diff = parseFloat(actualCashCount) - cashDrawerBalance;
                    return diff === 0 ? '#22c55e15' : diff > 0 ? '#3b82f615' : '#ef444415';
                  })(),
                  borderRadius: 8,
                  marginBottom: 20,
                }}>
                  <Text style={{
                    textAlign: 'center',
                    fontWeight: '600',
                    color: (() => {
                      const diff = parseFloat(actualCashCount) - cashDrawerBalance;
                      return diff === 0 ? '#22c55e' : diff > 0 ? '#3b82f6' : '#ef4444';
                    })(),
                  }}>
                    {(() => {
                      const diff = parseFloat(actualCashCount) - cashDrawerBalance;
                      if (diff === 0) return 'Perfect! No variance';
                      if (diff > 0) return `Over by ${formatCurrency(diff)}`;
                      return `Short by ${formatCurrency(Math.abs(diff))}`;
                    })()}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.muted,
                    padding: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  onPress={() => setShowCloseSessionModal(false)}
                >
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 2,
                    backgroundColor: actualCashCount ? colors.primary : colors.muted,
                    padding: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  onPress={closePosSession}
                  disabled={!actualCashCount}
                >
                  <Text style={{
                    color: actualCashCount ? '#fff' : colors.mutedForeground,
                    fontWeight: '600',
                  }}>
                    Close Shift
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Order Details Modal */}
      {/* Hide temporarily when payment modal is open for order edit (to avoid z-index stacking issues) */}
      <Modal
        visible={showOrderDetailsModal && !((showCashModal || showTransactionModal) && pendingOrderEdit)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (hasPendingChanges()) {
            if (Platform.OS === 'web') {
              if (window.confirm('Discard unsaved changes?')) {
                resetPendingOrderChanges();
                setShowOrderDetailsModal(false);
              }
            } else {
              Alert.alert('Discard Changes?', 'You have unsaved changes.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => {
                  resetPendingOrderChanges();
                  setShowOrderDetailsModal(false);
                }},
              ]);
            }
          } else {
            setShowOrderDetailsModal(false);
          }
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {}}
        >
          <View style={[styles.modalContent, { width: isTablet ? 550 : width - 32, maxHeight: '90%' }]}>
            {selectedOrderForView && (() => {
              const effectiveItems = getEffectiveOrderItems();
              const canEdit = ['pending', 'in_progress'].includes(selectedOrderForView.order_status) && 
                              selectedOrderForView.order_source === 'pos';
              const priceDiff = calculatePriceDifference();
              const newTotal = calculatePendingTotal();
              const hasChanges = hasPendingChanges();
              
              return (
                <>
                  {/* Header */}
                  <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View>
                      <Text style={styles.modalTitle}>Order #{selectedOrderForView.order_number}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                        {new Date(selectedOrderForView.created_at).toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {/* Timeline Button */}
                      <TouchableOpacity
                        style={{ backgroundColor: colors.muted, padding: 8, borderRadius: 8 }}
                        onPress={() => fetchOrderTimeline(selectedOrderForView.id)}
                        disabled={loadingTimeline}
                      >
                        <Clock size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      {/* Close Button */}
                      <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={() => {
                          if (hasChanges) {
                            if (Platform.OS === 'web') {
                              if (window.confirm('Discard unsaved changes?')) {
                                resetPendingOrderChanges();
                                setShowOrderDetailsModal(false);
                              }
                            } else {
                              Alert.alert('Discard Changes?', 'You have unsaved changes.', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Discard', style: 'destructive', onPress: () => {
                                  resetPendingOrderChanges();
                                  setShowOrderDetailsModal(false);
                                }},
                              ]);
                            }
                          } else {
                            setShowOrderDetailsModal(false);
                          }
                        }}
                      >
                        <X size={20} color={colors.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    <View style={{ padding: 16 }}>
                      {/* Status & Type Row */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <View style={{
                          backgroundColor: selectedOrderForView.order_status === 'completed' ? '#22c55e20' :
                                          selectedOrderForView.order_status === 'in_progress' ? '#3b82f620' :
                                          selectedOrderForView.order_status === 'pending' ? '#f59e0b20' : '#ef444420',
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                        }}>
                          <Text style={{
                            color: selectedOrderForView.order_status === 'completed' ? '#22c55e' :
                                   selectedOrderForView.order_status === 'in_progress' ? '#3b82f6' :
                                   selectedOrderForView.order_status === 'pending' ? '#f59e0b' : '#ef4444',
                            fontWeight: '600', fontSize: 13, textTransform: 'capitalize',
                          }}>
                            {selectedOrderForView.order_status?.replace('_', ' ')}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {selectedOrderForView.order_type === 'takeaway' && <ShoppingCart size={14} color={colors.mutedForeground} />}
                          {selectedOrderForView.order_type === 'dine_in' && <UtensilsCrossed size={14} color={colors.mutedForeground} />}
                          {selectedOrderForView.order_type === 'delivery' && <Truck size={14} color={colors.mutedForeground} />}
                          <Text style={{ color: colors.mutedForeground, fontSize: 13, textTransform: 'capitalize' }}>
                            {selectedOrderForView.order_type?.replace('_', ' ')}
                          </Text>
                        </View>
                      </View>

                      {/* Products List */}
                      <Text style={{ fontWeight: '700', fontSize: 15, color: colors.foreground, marginBottom: 10 }}>
                        Products ({effectiveItems.length})
                      </Text>
                      <View style={{ backgroundColor: colors.muted, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                        {effectiveItems.map((item: any, idx: number) => {
                          const isBeingEdited = editingOrderItemId === item.id;
                          const product = products.find(p => p.id === item.product_id?.toString());
                          const isMarkedForRemoval = pendingProductsToRemove.includes(item.id);
                          const isPendingNew = item._isPending;
                          
                          // Show removed item with undo option
                          if (isMarkedForRemoval) {
                            return (
                              <View key={item.id || idx} style={{ 
                                paddingVertical: 10, opacity: 0.5,
                                borderBottomWidth: idx < effectiveItems.length - 1 ? 1 : 0,
                                borderBottomColor: colors.border,
                              }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={{ textDecorationLine: 'line-through', color: '#ef4444' }}>
                                    {item.quantity}x {item.product_name}
                                  </Text>
                                  <TouchableOpacity onPress={() => undoProductRemoval(item.id)}>
                                    <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>Undo</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          }
                          
                          return (
                            <View key={item.id || idx} style={{ 
                              paddingVertical: 10,
                              borderBottomWidth: idx < effectiveItems.length - 1 ? 1 : 0,
                              borderBottomColor: colors.border,
                              backgroundColor: isPendingNew ? '#22c55e08' : 'transparent',
                              marginHorizontal: isPendingNew ? -12 : 0,
                              paddingHorizontal: isPendingNew ? 12 : 0,
                            }}>
                              {/* Product Header */}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1 }}>
                                  {isPendingNew && (
                                    <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '600', marginBottom: 2 }}>NEW</Text>
                                  )}
                                  <Text style={{ fontWeight: '600', color: colors.foreground }}>
                                    {item.quantity}x {item.product_name}
                                  </Text>
                                  {item.variant_name && (
                                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{item.variant_name}</Text>
                                  )}
                                  {/* Show modifiers */}
                                  {(item.order_item_modifiers || []).map((mod: any, mi: number) => (
                                    <Text key={mi} style={{ 
                                      fontSize: 11, marginTop: 1,
                                      color: mod.modifier_type === 'removal' ? '#ef4444' : colors.primary 
                                    }}>
                                      {mod.modifier_type === 'removal' ? '- No ' : '+ '}{mod.modifier_name}
                                      {mod.quantity > 1 ? ` (x${mod.quantity})` : ''}
                                    </Text>
                                  ))}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ fontWeight: '600', color: colors.foreground }}>
                                    {formatCurrency(item.total || (item.unit_price * item.quantity))}
                                  </Text>
                                  {canEdit && !isBeingEdited && (
                                    <>
                                      {/* Edit button - show if item has variant or product has variants/modifiers */}
                                      {!isPendingNew && (
                                        item.variant_id || // Item already has a variant selected
                                        (product && (
                                          (product.variant_groups?.length || 0) > 0 || 
                                          ((product as any).product_variants?.length || 0) > 0 ||
                                          (product as any).has_variants ||
                                          (product.modifiers?.length || 0) > 0
                                        ))
                                      ) && (
                                        <TouchableOpacity
                                          onPress={() => startEditingOrderItem(item)}
                                          style={{ backgroundColor: colors.primary + '20', padding: 6, borderRadius: 6 }}
                                        >
                                          <Edit2 size={14} color={colors.primary} />
                                        </TouchableOpacity>
                                      )}
                                      {/* Remove button */}
                                      <TouchableOpacity
                                        onPress={() => isPendingNew ? removePendingProduct(item.id) : markProductForRemoval(item.id)}
                                        style={{ backgroundColor: '#ef444420', padding: 6, borderRadius: 6 }}
                                      >
                                        <Trash2 size={14} color="#ef4444" />
                                      </TouchableOpacity>
                                    </>
                                  )}
                                </View>
                              </View>
                              
                              {/* Edit Panel */}
                              {isBeingEdited && product && (
                                <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.primary }}>
                                  {/* Variants */}
                                  {editingItemVariants.length > 0 && (
                                    <View style={{ marginBottom: 12 }}>
                                      <Text style={{ fontWeight: '600', fontSize: 11, color: colors.mutedForeground, marginBottom: 6 }}>VARIANT</Text>
                                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        {editingItemVariants.map((v: any) => {
                                          const selected = v.id === (editItemVariantId ?? item.variant_id);
                                          return (
                                            <TouchableOpacity
                                              key={v.id}
                                              onPress={() => setEditItemVariantId(v.id)}
                                              style={{
                                                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                                                backgroundColor: selected ? colors.primary : colors.muted,
                                                borderWidth: 1, borderColor: selected ? colors.primary : colors.border,
                                              }}
                                            >
                                              <Text style={{ fontSize: 12, color: selected ? '#fff' : colors.foreground, fontWeight: selected ? '600' : '400' }}>
                                                {v.name}
                                              </Text>
                                            </TouchableOpacity>
                                          );
                                        })}
                                      </View>
                                    </View>
                                  )}
                                  
                                  {/* Removable Modifiers */}
                                  {(product.modifiers?.filter((m: any) => m.removable).length || 0) > 0 && (
                                    <View style={{ marginBottom: 12 }}>
                                      <Text style={{ fontWeight: '600', fontSize: 11, color: colors.mutedForeground, marginBottom: 6 }}>REMOVE</Text>
                                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        {product.modifiers.filter((m: any) => m.removable).map((mod: any) => {
                                          const isRemoved = editItemRemovedMods.has(mod.name);
                                          return (
                                            <TouchableOpacity
                                              key={mod.id}
                                              onPress={() => {
                                                setEditItemRemovedMods(prev => {
                                                  const next = new Set(prev);
                                                  isRemoved ? next.delete(mod.name) : next.add(mod.name);
                                                  return next;
                                                });
                                              }}
                                              style={{
                                                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                                                backgroundColor: isRemoved ? '#ef444420' : colors.muted,
                                                borderWidth: 1, borderColor: isRemoved ? '#ef4444' : colors.border,
                                              }}
                                            >
                                              <Text style={{ fontSize: 11, color: isRemoved ? '#ef4444' : colors.foreground }}>
                                                {isRemoved ? '✕ ' : ''}{mod.name}
                                              </Text>
                                            </TouchableOpacity>
                                          );
                                        })}
                                      </View>
                                    </View>
                                  )}
                                  
                                  {/* Addable Modifiers (Extras) */}
                                  {(product.modifiers?.filter((m: any) => m.addable).length || 0) > 0 && (
                                    <View style={{ marginBottom: 12 }}>
                                      <Text style={{ fontWeight: '600', fontSize: 11, color: colors.mutedForeground, marginBottom: 6 }}>EXTRAS</Text>
                                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                        {product.modifiers.filter((m: any) => m.addable).map((mod: any) => {
                                          const qty = editItemAddedMods.get(mod.name) || 0;
                                          return (
                                            <View key={mod.id} style={{
                                              flexDirection: 'row', alignItems: 'center', gap: 4,
                                              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
                                              backgroundColor: qty > 0 ? colors.primary + '20' : colors.muted,
                                              borderWidth: 1, borderColor: qty > 0 ? colors.primary : colors.border,
                                            }}>
                                              <TouchableOpacity
                                                onPress={() => {
                                                  if (qty > 0) {
                                                    setEditItemAddedMods(prev => {
                                                      const next = new Map(prev);
                                                      qty === 1 ? next.delete(mod.name) : next.set(mod.name, qty - 1);
                                                      return next;
                                                    });
                                                  }
                                                }}
                                              >
                                                <Minus size={12} color={qty > 0 ? colors.primary : colors.mutedForeground} />
                                              </TouchableOpacity>
                                              <Text style={{ fontSize: 11, color: qty > 0 ? colors.primary : colors.foreground }}>
                                                {mod.name} {qty > 0 ? `(${qty})` : ''} +{formatCurrency(mod.extra_price || 0)}
                                              </Text>
                                              <TouchableOpacity
                                                onPress={() => {
                                                  setEditItemAddedMods(prev => {
                                                    const next = new Map(prev);
                                                    next.set(mod.name, qty + 1);
                                                    return next;
                                                  });
                                                }}
                                              >
                                                <Plus size={12} color={colors.primary} />
                                              </TouchableOpacity>
                                            </View>
                                          );
                                        })}
                                      </View>
                                    </View>
                                  )}
                                  
                                  {/* Edit Actions */}
                                  <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                      onPress={cancelEditingOrderItem}
                                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center' }}
                                    >
                                      <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 12 }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => applyOrderItemChanges(item.id, item, product)}
                                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center' }}
                                    >
                                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Apply</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>

                      {/* Add Products Button */}
                      {canEdit && (
                        <TouchableOpacity
                          onPress={() => {
                            setAddProductSearchQuery('');
                            setShowAddProductsModal(true);
                          }}
                          style={{
                            backgroundColor: colors.primary, padding: 12, borderRadius: 10,
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                            marginBottom: 16,
                          }}
                        >
                          <Plus size={16} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Add Products</Text>
                        </TouchableOpacity>
                      )}

                      {/* Totals */}
                      <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: 14 }}>
                        {hasChanges && (
                          <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Original Total</Text>
                              <Text style={{ color: colors.mutedForeground, fontSize: 13, textDecorationLine: 'line-through' }}>
                                {formatCurrency(selectedOrderForView.total_amount || 0)}
                              </Text>
                            </View>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.foreground }}>
                            {hasChanges ? 'New Total' : 'Total'}
                          </Text>
                          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.foreground }}>
                            {formatCurrency(hasChanges ? newTotal : selectedOrderForView.total_amount)}
                          </Text>
                        </View>
                        {hasChanges && Math.abs(priceDiff) > 0.01 && (
                          <View style={{
                            marginTop: 10, padding: 10, borderRadius: 8,
                            backgroundColor: priceDiff > 0 ? '#f59e0b15' : '#22c55e15',
                          }}>
                            <Text style={{ 
                              textAlign: 'center', fontWeight: '600', fontSize: 13,
                              color: priceDiff > 0 ? '#f59e0b' : '#22c55e',
                            }}>
                              {priceDiff > 0 ? `Extra Payment: +${formatCurrency(priceDiff)}` : `Refund Due: ${formatCurrency(Math.abs(priceDiff))}`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </ScrollView>

                  {/* Footer */}
                  <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
                    {/* Save/Payment Actions - Only show if there are changes */}
                    {hasChanges && canEdit && (
                      priceDiff > 0.01 ? (
                        // Extra payment required
                        <View style={{ backgroundColor: '#f59e0b15', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#f59e0b40' }}>
                          <Text style={{ color: '#f59e0b', fontWeight: '600', marginBottom: 10, textAlign: 'center' }}>
                            Collect {formatCurrency(priceDiff)} to save changes
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#f59e0b', padding: 12, borderRadius: 8, alignItems: 'center' }}
                              disabled={savingOrderEdit}
                              onPress={() => {
                                setPendingOrderEdit({ orderId: selectedOrderForView.id, itemId: 0, extraCost: priceDiff, modifications: {} });
                                setCustomerPaidAmount('');
                                setShowCashModal(true);
                                // Keep Order Details open - payment modal appears on top
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '600' }}>Cash</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' }}
                              disabled={savingOrderEdit}
                              onPress={() => {
                                setPendingOrderEdit({ orderId: selectedOrderForView.id, itemId: 0, extraCost: priceDiff, modifications: {} });
                                setTransactionNumber('');
                                setShowTransactionModal(true);
                                // Keep Order Details open - payment modal appears on top
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '600' }}>Card</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : priceDiff < -0.01 ? (
                        // Refund required
                        <TouchableOpacity
                          style={{ backgroundColor: '#22c55e', padding: 14, borderRadius: 10, alignItems: 'center' }}
                          disabled={savingOrderEdit}
                          onPress={() => handleSaveOrderChanges()}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600' }}>
                            {savingOrderEdit ? 'Processing...' : `Refund ${formatCurrency(Math.abs(priceDiff))} & Save`}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        // No price change - direct save
                        <TouchableOpacity
                          style={{ backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: 'center' }}
                          disabled={savingOrderEdit}
                          onPress={() => saveOrderChanges()}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600' }}>
                            {savingOrderEdit ? 'Saving...' : 'Save Changes'}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                    
                    {/* Discard button when there are changes */}
                    {hasChanges && canEdit && (
                      <TouchableOpacity
                        style={{ padding: 10, alignItems: 'center' }}
                        onPress={() => resetPendingOrderChanges()}
                      >
                        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Discard Changes</Text>
                      </TouchableOpacity>
                    )}
                    
                    {/* Close button */}
                    {!hasChanges && (
                      <TouchableOpacity
                        style={{ backgroundColor: colors.muted, padding: 14, borderRadius: 10, alignItems: 'center' }}
                        onPress={() => setShowOrderDetailsModal(false)}
                      >
                        <Text style={{ color: colors.foreground, fontWeight: '600' }}>Close</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Products to Order Modal */}
      <Modal
        visible={showAddProductsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddProductsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowAddProductsModal(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={[styles.modalContent, { width: isTablet ? 600 : width - 32, maxHeight: '85%' }]}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Text style={styles.modalTitle}>Add Products to Order</Text>
              <TouchableOpacity onPress={() => setShowAddProductsModal(false)}>
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={styles.searchContainer}>
                <Search size={18} color={colors.mutedForeground} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search products..."
                  placeholderTextColor={colors.mutedForeground}
                  value={addProductSearchQuery}
                  onChangeText={setAddProductSearchQuery}
                  autoFocus
                />
                {addProductSearchQuery ? (
                  <TouchableOpacity onPress={() => setAddProductSearchQuery('')}>
                    <X size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Product List */}
            <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
              {products
                .filter(p => 
                  p.available && 
                  (addProductSearchQuery === '' || 
                   p.name.toLowerCase().includes(addProductSearchQuery.toLowerCase()))
                )
                .slice(0, 20) // Limit to 20 results
                .map((product) => {
                  const hasVariants = product.variant_groups && product.variant_groups.length > 0;
                  const hasModifiers = product.modifiers && product.modifiers.length > 0;
                  const needsCustomization = hasVariants || hasModifiers;
                  
                  return (
                    <TouchableOpacity
                      key={product.id}
                      onPress={() => addProductToCurrentOrder(product)}
                      disabled={savingOrderEdit}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 14,
                        marginBottom: 8,
                        backgroundColor: colors.muted,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: savingOrderEdit ? 0.5 : 1,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
                          {product.name}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          {product.category_name && (
                            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                              {product.category_name}
                            </Text>
                          )}
                          {hasVariants && (
                            <View style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>
                                {product.variant_groups[0]?.options?.length || 0} Options
                              </Text>
                            </View>
                          )}
                          {hasModifiers && (
                            <View style={{ backgroundColor: '#fbbf2420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 10, color: '#d97706', fontWeight: '600' }}>
                                Customizable
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.primary }}>
                          {formatCurrency(product.base_price)}
                        </Text>
                        <View style={{
                          marginTop: 4,
                          backgroundColor: needsCustomization ? colors.secondary : colors.primary,
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          borderRadius: 6,
                        }}>
                          <Text style={{ 
                            fontSize: 12, 
                            fontWeight: '600', 
                            color: needsCustomization ? colors.secondaryForeground : colors.primaryForeground 
                          }}>
                            {needsCustomization ? 'Customize' : '+ Add'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              
              {products.filter(p => 
                p.available && 
                (addProductSearchQuery === '' || 
                 p.name.toLowerCase().includes(addProductSearchQuery.toLowerCase()))
              ).length === 0 && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
                    No products found
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                onPress={() => setShowAddProductsModal(false)}
                style={{
                  backgroundColor: colors.muted,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Timeline Modal */}
      <Modal
        visible={showTimelineModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimelineModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowTimelineModal(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            style={[styles.modalContent, { width: isTablet ? 450 : width - 32, maxHeight: '80%' }]}
          >
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={20} color={colors.foreground} />
                <Text style={styles.modalTitle}>Order Timeline</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowTimelineModal(false)}
              >
                <X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Timeline Content */}
            <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
              {orderTimeline.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, textAlign: 'center', padding: 20 }}>
                  No timeline events
                </Text>
              ) : (
                orderTimeline.map((event: any, index: number) => {
                  const eventColor = getTimelineEventColor(event.event_type);
                  const isLast = index === orderTimeline.length - 1;
                  
                  return (
                    <View key={event.id || index} style={{ flexDirection: 'row', marginBottom: isLast ? 0 : 16 }}>
                      {/* Timeline line and dot */}
                      <View style={{ alignItems: 'center', marginRight: 12 }}>
                        <View style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: eventColor,
                        }} />
                        {!isLast && (
                          <View style={{
                            width: 2,
                            flex: 1,
                            backgroundColor: colors.border,
                            marginTop: 4,
                          }} />
                        )}
                      </View>
                      
                      {/* Event content */}
                      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 8 }}>
                        <Text style={{ 
                          color: colors.foreground, 
                          fontWeight: '600',
                          fontSize: 14,
                          marginBottom: 2,
                        }}>
                          {formatTimelineEvent(event)}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                          {new Date(event.created_at).toLocaleString()}
                        </Text>
                        {formatTimelineUser(event) && (
                          <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
                            by {formatTimelineUser(event)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Close Button */}
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.muted,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
                onPress={() => setShowTimelineModal(false)}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* PIN Lock Screen Modal */}
      <Modal
        visible={showPinLockScreen}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={[styles.modalContent, { width: Math.min(400, width - 40), padding: 32, alignItems: 'center' }]}>
            {/* Lock Icon */}
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.primary + '20',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <Lock size={40} color={colors.primary} />
            </View>

            {/* Title */}
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.foreground, marginBottom: 8 }}>
              {needsInitialPinAuth ? 'Select Employee' : 'Screen Locked'}
            </Text>

            {/* Subtitle with previous employee name */}
            <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: 24, textAlign: 'center' }}>
              {needsInitialPinAuth 
                ? 'Enter your PIN to start your shift'
                : selectedPosEmployee?.name 
                  ? `Last: ${selectedPosEmployee.name}`
                  : 'Enter your PIN to unlock'}
            </Text>

            {/* Error message */}
            {pinError && (
              <View style={{ backgroundColor: colors.destructive + '20', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginBottom: 16 }}>
                <Text style={{ color: colors.destructive, fontSize: 14, fontWeight: '500' }}>
                  {pinError}
                </Text>
              </View>
            )}

            {/* PIN Dots */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: i < pinInput.length ? colors.primary : 'transparent',
                    borderWidth: 2,
                    borderColor: i < pinInput.length ? colors.primary : colors.border,
                  }}
                />
              ))}
            </View>

            {/* Loading indicator */}
            {isAuthenticatingPin && (
              <Command size={24} color={colors.primary} style={{ marginBottom: 16 }} />
            )}

            {/* Keypad */}
            <View style={{ width: '100%', gap: 12 }}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['C', '0', '⌫'],
              ].map((row, rowIndex) => (
                <View key={rowIndex} style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                  {row.map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={{
                        width: 72,
                        height: 56,
                        borderRadius: 12,
                        backgroundColor: key === 'C' || key === '⌫' ? colors.muted : colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        if (key === '⌫') {
                          setPinInput(prev => prev.slice(0, -1));
                          setPinError(null);
                        } else if (key === 'C') {
                          setPinInput('');
                          setPinError(null);
                        } else if (pinInput.length < 6) {
                          const newPin = pinInput + key;
                          setPinInput(newPin);
                          setPinError(null);
                          // Auto-submit when PIN reaches 4-6 digits
                          if (newPin.length >= 4) {
                            setTimeout(() => {
                              handlePinAuthentication(newPin);
                            }, 200);
                          }
                        }
                      }}
                      disabled={isAuthenticatingPin}
                    >
                      {key === '⌫' ? (
                        <Delete size={24} color={colors.foreground} />
                      ) : (
                        <Text style={{ fontSize: 24, fontWeight: '600', color: key === 'C' ? colors.mutedForeground : colors.foreground }}>
                          {key}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            {/* Hint */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.muted,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 8,
              marginTop: 24,
            }}>
              <User size={16} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1 }}>
                Any employee with POS access can unlock
              </Text>
            </View>
          </View>
        </View>
      </Modal>

          </View>
  );
}

