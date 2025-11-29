import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { colors } from '../theme/colors';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  X,
  Package,
  CheckCircle,
} from 'lucide-react-native';
import {
  getProducts,
  getRegions,
  createCart,
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  completeCart,
  storeCartId,
  getStoredCartId,
  clearStoredCartId,
  formatPrice,
  Product,
  Cart,
  Region,
} from '../api/medusa';

export default function StorefrontScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [completingOrder, setCompletingOrder] = useState(false);

  // Initialize region and cart
  useEffect(() => {
    initializeStore();
  }, []);

  // Filter products based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);

  const initializeStore = async () => {
    try {
      setLoading(true);

      // Get regions
      const regions = await getRegions();
      if (regions.length > 0) {
        setRegion(regions[0]);

        // Check for existing cart
        const storedCartId = await getStoredCartId();
        if (storedCartId) {
          try {
            const existingCart = await getCart(storedCartId);
            setCart(existingCart);
          } catch {
            // Cart expired or invalid, create new one
            const newCart = await createCart(regions[0].id);
            setCart(newCart);
            await storeCartId(newCart.id);
          }
        } else {
          // Create new cart
          const newCart = await createCart(regions[0].id);
          setCart(newCart);
          await storeCartId(newCart.id);
        }
      }

      // Get products
      const productsData = await getProducts();
      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error: any) {
      console.error('Error initializing store:', error);
      Alert.alert('Error', 'Failed to load store. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedProduct || !cart) return;

    const variant = selectedProduct.variants[0];
    if (!variant) {
      Alert.alert('Error', 'Product variant not available');
      return;
    }

    setAddingToCart(true);
    try {
      const updatedCart = await addToCart(cart.id, variant.id, quantity);
      setCart(updatedCart);
      setSelectedProduct(null);
      setQuantity(1);
      Alert.alert('Success', `${selectedProduct.title} added to cart!`);
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add item to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (!cart) return;

    try {
      if (newQuantity <= 0) {
        const updatedCart = await removeFromCart(cart.id, itemId);
        setCart(updatedCart);
      } else {
        const updatedCart = await updateCartItem(cart.id, itemId, newQuantity);
        setCart(updatedCart);
      }
    } catch (error: any) {
      console.error('Error updating cart:', error);
      Alert.alert('Error', 'Failed to update cart');
    }
  };

  const handleCompleteOrder = async () => {
    if (!cart || cart.items.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    setCompletingOrder(true);
    try {
      const result = await completeCart(cart.id);
      await clearStoredCartId();
      
      // Create new cart for next order
      if (region) {
        const newCart = await createCart(region.id);
        setCart(newCart);
        await storeCartId(newCart.id);
      }

      setCartModalVisible(false);
      Alert.alert(
        'Order Placed! 🎉',
        `Order #${result.order?.display_id || 'N/A'} has been submitted successfully.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Error completing order:', error);
      Alert.alert('Error', 'Failed to complete order. Please try again.');
    } finally {
      setCompletingOrder(false);
    }
  };

  const getCartItemCount = () => {
    return cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
  };

  const getProductPrice = (product: Product): string => {
    const variant = product.variants[0];
    if (!variant || !variant.prices || variant.prices.length === 0) {
      return 'N/A';
    }
    const price = variant.prices[0];
    return formatPrice(price.amount, price.currency_code);
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => {
        setSelectedProduct(item);
        setQuantity(1);
      }}
    >
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.productImage} />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Package size={40} color={colors.mutedForeground} />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.productPrice}>{getProductPrice(item)}</Text>
      </View>
      <TouchableOpacity
        style={styles.quickAddButton}
        onPress={() => {
          setSelectedProduct(item);
          setQuantity(1);
        }}
      >
        <Plus size={20} color={colors.primaryForeground} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading store...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Walk-in Orders</Text>
          <Text style={styles.headerSubtitle}>Select items for customer</Text>
        </View>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => setCartModalVisible(true)}
        >
          <ShoppingCart size={24} color={colors.primaryForeground} />
          {getCartItemCount() > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{getCartItemCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={colors.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Products Grid */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.productList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Package size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      {/* Product Detail Modal */}
      <Modal
        visible={selectedProduct !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setSelectedProduct(null)}
            >
              <X size={24} color={colors.foreground} />
            </TouchableOpacity>

            {selectedProduct && (
              <>
                {selectedProduct.thumbnail ? (
                  <Image
                    source={{ uri: selectedProduct.thumbnail }}
                    style={styles.modalImage}
                  />
                ) : (
                  <View style={styles.modalImagePlaceholder}>
                    <Package size={60} color={colors.mutedForeground} />
                  </View>
                )}

                <Text style={styles.modalTitle}>{selectedProduct.title}</Text>
                <Text style={styles.modalDescription}>
                  {selectedProduct.description || 'No description available'}
                </Text>
                <Text style={styles.modalPrice}>
                  {getProductPrice(selectedProduct)}
                </Text>

                <View style={styles.quantityContainer}>
                  <Text style={styles.quantityLabel}>Quantity:</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus size={20} color={colors.foreground} />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => setQuantity(quantity + 1)}
                    >
                      <Plus size={20} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.addToCartButton, addingToCart && styles.buttonDisabled]}
                  onPress={handleAddToCart}
                  disabled={addingToCart}
                >
                  {addingToCart ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <>
                      <ShoppingCart size={20} color={colors.primaryForeground} />
                      <Text style={styles.addToCartText}>Add to Order</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Cart Modal */}
      <Modal
        visible={cartModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cartModalContent}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Current Order</Text>
              <TouchableOpacity onPress={() => setCartModalVisible(false)}>
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cartItems}>
              {cart?.items.length === 0 ? (
                <View style={styles.emptyCart}>
                  <ShoppingCart size={48} color={colors.mutedForeground} />
                  <Text style={styles.emptyCartText}>Cart is empty</Text>
                </View>
              ) : (
                cart?.items.map((item) => (
                  <View key={item.id} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemTitle}>{item.title}</Text>
                      <Text style={styles.cartItemPrice}>
                        {formatPrice(item.unit_price, region?.currency_code)}
                      </Text>
                    </View>
                    <View style={styles.cartItemQuantity}>
                      <TouchableOpacity
                        style={styles.quantityButtonSmall}
                        onPress={() =>
                          handleUpdateQuantity(item.id, item.quantity - 1)
                        }
                      >
                        <Minus size={16} color={colors.foreground} />
                      </TouchableOpacity>
                      <Text style={styles.cartItemQuantityText}>
                        {item.quantity}
                      </Text>
                      <TouchableOpacity
                        style={styles.quantityButtonSmall}
                        onPress={() =>
                          handleUpdateQuantity(item.id, item.quantity + 1)
                        }
                      >
                        <Plus size={16} color={colors.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {cart && cart.items.length > 0 && (
              <View style={styles.cartFooter}>
                <View style={styles.cartTotal}>
                  <Text style={styles.cartTotalLabel}>Total:</Text>
                  <Text style={styles.cartTotalAmount}>
                    {formatPrice(cart.total || cart.subtotal || 0, region?.currency_code)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.completeOrderButton,
                    completingOrder && styles.buttonDisabled,
                  ]}
                  onPress={handleCompleteOrder}
                  disabled={completingOrder}
                >
                  {completingOrder ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <>
                      <CheckCircle size={20} color={colors.primaryForeground} />
                      <Text style={styles.completeOrderText}>
                        Complete Order
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {},
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  cartButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.card,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cartBadgeText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: colors.foreground,
  },
  productList: {
    padding: 8,
  },
  productCard: {
    flex: 1,
    margin: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '47%',
  },
  productImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  productImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: colors.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  quickAddButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    backgroundColor: colors.primary,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  modalImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: colors.muted,
    borderRadius: 16,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 24,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.muted,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.foreground,
    marginHorizontal: 20,
  },
  addToCartButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  addToCartText: {
    color: colors.primaryForeground,
    fontSize: 18,
    fontWeight: '600',
  },
  cartModalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  cartItems: {
    flex: 1,
    padding: 20,
  },
  emptyCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCartText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.mutedForeground,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  cartItemQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButtonSmall: {
    width: 32,
    height: 32,
    backgroundColor: colors.muted,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemQuantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginHorizontal: 12,
  },
  cartFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  cartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cartTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  cartTotalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  completeOrderButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  completeOrderText: {
    color: colors.primaryForeground,
    fontSize: 18,
    fontWeight: '600',
  },
});




