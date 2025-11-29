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
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;

// Sample menu categories and items
const CATEGORIES = [
  { id: '1', name: 'All Items', icon: Grid3X3 },
  { id: '2', name: 'Main Dishes', icon: UtensilsCrossed },
  { id: '3', name: 'Beverages', icon: Coffee },
  { id: '4', name: 'Desserts', icon: IceCream },
  { id: '5', name: 'Grilled', icon: Beef },
  { id: '6', name: 'Salads', icon: Salad },
];

const MENU_ITEMS = [
  { id: '1', name: 'Classic Burger', price: 12.99, category: '2', available: true },
  { id: '2', name: 'Cheese Burger', price: 14.99, category: '2', available: true },
  { id: '3', name: 'Chicken Sandwich', price: 11.99, category: '2', available: true },
  { id: '4', name: 'Caesar Salad', price: 9.99, category: '6', available: true },
  { id: '5', name: 'Garden Salad', price: 8.49, category: '6', available: true },
  { id: '6', name: 'Grilled Steak', price: 24.99, category: '5', available: true },
  { id: '7', name: 'BBQ Ribs', price: 22.99, category: '5', available: false },
  { id: '8', name: 'Cola', price: 2.99, category: '3', available: true },
  { id: '9', name: 'Fresh Juice', price: 4.99, category: '3', available: true },
  { id: '10', name: 'Coffee', price: 3.49, category: '3', available: true },
  { id: '11', name: 'Chocolate Cake', price: 6.99, category: '4', available: true },
  { id: '12', name: 'Ice Cream', price: 4.99, category: '4', available: true },
  { id: '13', name: 'Fish & Chips', price: 16.99, category: '2', available: true },
  { id: '14', name: 'Pasta Carbonara', price: 14.49, category: '2', available: true },
  { id: '15', name: 'Grilled Chicken', price: 18.99, category: '5', available: true },
];

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface OrderType {
  type: 'dine_in' | 'takeaway';
  tableNumber?: string;
  customerName?: string;
}

export default function POSScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('1');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>({ type: 'dine_in' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [lastOrderNumber, setLastOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
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

  const filteredItems = MENU_ITEMS.filter(item => {
    const matchesCategory = selectedCategory === '1' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (item: typeof MENU_ITEMS[0]) => {
    if (!item.available) {
      Alert.alert('Unavailable', 'This item is currently unavailable');
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
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

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.15; // 15% VAT
  const total = subtotal + tax;

  const processPayment = (method: 'cash' | 'card') => {
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    setLastOrderNumber(orderNumber);
    setShowPaymentModal(false);
    setShowReceiptModal(true);
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
      flexDirection: isTablet ? 'row' : 'column',
    },
    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 16,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    timeDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.secondary,
      borderRadius: 10,
    },
    timeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      fontVariant: ['tabular-nums'],
    },
    logoutBtn: {
      padding: 10,
      backgroundColor: colors.secondary,
      borderRadius: 10,
    },
    // Menu Panel
    menuPanel: {
      flex: isTablet ? 2 : 1,
      backgroundColor: colors.background,
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
    menuItem: {
      width: isTablet ? (width * 0.66 - 48) / 4 : (width - 48) / 2,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
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
    // Cart Panel
    cartPanel: {
      width: isTablet ? width * 0.34 : '100%',
      height: isTablet ? '100%' : height * 0.45,
      backgroundColor: colors.card,
      borderLeftWidth: isTablet ? 1 : 0,
      borderTopWidth: isTablet ? 0 : 1,
      borderColor: colors.border,
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

  const renderMenuItem = ({ item }: { item: typeof MENU_ITEMS[0] }) => (
    <TouchableOpacity
      style={[styles.menuItem, !item.available && styles.menuItemUnavailable]}
      onPress={() => addToCart(item)}
      activeOpacity={0.7}
    >
      {!item.available && (
        <View style={styles.unavailableBadge}>
          <Text style={styles.unavailableText}>Sold Out</Text>
        </View>
      )}
      <Text style={styles.menuItemName}>{item.name}</Text>
      <Text style={styles.menuItemPrice}>SAR {item.price.toFixed(2)}</Text>
    </TouchableOpacity>
  );

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName}>{item.name}</Text>
        <Text style={styles.cartItemPrice}>SAR {item.price.toFixed(2)}</Text>
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <ShoppingCart size={24} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Silo POS</Text>
            <Text style={styles.headerSubtitle}>
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'POS Terminal'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.timeDisplay}>
            <Clock size={14} color={colors.mutedForeground} />
            <Text style={styles.timeText}>
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
        {/* Menu Panel */}
        <View style={styles.menuPanel}>
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
              {CATEGORIES.map(cat => (
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
          <FlatList
            data={filteredItems}
            renderItem={renderMenuItem}
            keyExtractor={item => item.id}
            numColumns={isTablet ? 4 : 2}
            contentContainerStyle={styles.menuGrid}
            columnWrapperStyle={styles.menuRow}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Cart Panel */}
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
                size={18}
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
                size={18}
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
          </View>

          {/* Cart Items */}
          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <ShoppingCart size={48} color={colors.mutedForeground} />
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
              <Text style={styles.totalsValue}>SAR {subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>VAT (15%)</Text>
              <Text style={styles.totalsValue}>SAR {tax.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>SAR {total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.chargeBtn, cart.length === 0 && styles.chargeBtnDisabled]}
              onPress={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
            >
              <CreditCard size={20} color={colors.primaryForeground} />
              <Text style={styles.chargeBtnText}>
                Charge SAR {total.toFixed(2)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
              <TouchableOpacity
                style={styles.paymentBtn}
                onPress={() => processPayment('cash')}
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
                style={styles.paymentBtn}
                onPress={() => processPayment('card')}
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
              <Text style={styles.receiptTotal}>SAR {total.toFixed(2)}</Text>

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

