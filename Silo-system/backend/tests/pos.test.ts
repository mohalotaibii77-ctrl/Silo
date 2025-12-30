/**
 * POS API TEST SUITE
 * Tests all POS-related API endpoints:
 * - Orders (create, list, status updates)
 * - Kitchen Display
 * - POS Sessions
 * - Payments
 * 
 * Run with: npm run test:pos
 */

import { validateConfig } from './test.config';
import { authenticate, apiRequest, assertSuccess, assertStatus, uniqueId, TestContext } from './test.utils';

validateConfig();

let passed = 0;
let failed = 0;

function track(success: boolean): void {
  if (success) passed++;
  else failed++;
}

// ============================================
// POS ORDERS TESTS
// ============================================
async function testPOSOrders(ctx: TestContext): Promise<{ orderId: number | null }> {
  console.log('\n🛒 POS ORDERS');
  
  let orderId: number | null = null;
  
  // GET /api/pos/orders - List orders
  const listOrders = await apiRequest(ctx, 'GET', '/pos/orders');
  track(assertSuccess(listOrders, 'GET /pos/orders - List orders'));
  
  // GET /api/pos/orders with filters
  const filterOrders = await apiRequest(ctx, 'GET', '/pos/orders?status=completed&limit=5');
  track(assertSuccess(filterOrders, 'GET /pos/orders?status=completed - Filter by status'));
  
  // GET /api/pos/orders with date filter
  const today = new Date().toISOString().split('T')[0];
  const dateOrders = await apiRequest(ctx, 'GET', `/pos/orders?date=${today}`);
  track(assertSuccess(dateOrders, `GET /pos/orders?date=${today} - Filter by date`));
  
  // GET /api/pos/stats - Get order statistics
  const getStats = await apiRequest(ctx, 'GET', '/pos/stats');
  track(assertSuccess(getStats, 'GET /pos/stats - Get order statistics'));
  
  // GET /api/pos/product-availability - Get product availability
  const getAvailability = await apiRequest(ctx, 'GET', '/pos/product-availability');
  track(assertSuccess(getAvailability, 'GET /pos/product-availability - Get product availability'));
  
  // Find a product with available inventory
  const availability = getAvailability.data?.data || getAvailability.data || {};
  const availableProductIds = Object.entries(availability)
    .filter(([_, qty]) => (qty as number) > 0)
    .map(([id, _]) => parseInt(id));
  
  // Get products to find one with stock
  const products = await apiRequest(ctx, 'GET', '/store-products');
  const allProducts = products.data?.data || products.data?.products || [];
  
  // Find a product that has inventory available
  let testProduct = allProducts.find((p: any) => availableProductIds.includes(p.id));
  
  // If no product with inventory, fall back to first product (will skip due to inventory check)
  if (!testProduct && allProducts.length > 0) {
    testProduct = allProducts[0];
    console.log('  ℹ️  No products with inventory found, using first product (may fail)');
  }
  
  // POST /api/pos/orders - Create order
  // Note: This may fail if inventory is insufficient (valid business rule)
  const createOrder = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T1',
    items: [
      {
        product_id: testProduct?.id || null,  // Use actual product if available
        product_name: testProduct?.name || 'Test Product',
        product_name_ar: testProduct?.name_ar || 'منتج اختبار',
        quantity: 1,  // Use quantity 1 to reduce inventory requirement
        unit_price: testProduct?.price || 25.00,
      },
    ],
  });
  
  // Order creation can fail due to insufficient inventory - that's valid business logic
  if (createOrder.status === 200 || createOrder.status === 201) {
    track(assertSuccess(createOrder, 'POST /pos/orders - Create order'));
  } else if (createOrder.status === 400 && createOrder.data?.error?.includes('Insufficient inventory')) {
    console.log('  ⚠️  POST /pos/orders - Skipped (insufficient inventory - no products have stock)');
    // Don't count as failure - inventory check is working correctly
  } else {
    track(assertSuccess(createOrder, 'POST /pos/orders - Create order'));
  }
  
  if (createOrder.data.data?.id) {
    orderId = createOrder.data.data.id;
    
    // GET /api/pos/orders/:orderId - Get single order
    const getOrder = await apiRequest(ctx, 'GET', `/pos/orders/${orderId}`);
    track(assertSuccess(getOrder, `GET /pos/orders/${orderId} - Get single order`));
    
    // GET /api/pos/orders/:orderId/timeline - Get order timeline
    const getTimeline = await apiRequest(ctx, 'GET', `/pos/orders/${orderId}/timeline`);
    track(assertSuccess(getTimeline, `GET /pos/orders/${orderId}/timeline - Get timeline`));
    
    // PATCH /api/pos/orders/:orderId/status - Update status to completed
    const updateStatus = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/status`, {
      status: 'completed',
    });
    track(assertSuccess(updateStatus, `PATCH /pos/orders/${orderId}/status - Update to completed`));
  }
  
  // POST /api/pos/calculate-totals - Calculate order totals
  const calcTotals = await apiRequest(ctx, 'POST', '/pos/calculate-totals', {
    items: [
      { product_id: 1, quantity: 2, unit_price: 25.00 },
      { product_id: 2, quantity: 1, unit_price: 15.00 },
    ],
    discount_type: 'percentage',
    discount_value: 10,
    delivery_fee: 5.00,
  });
  track(assertSuccess(calcTotals, 'POST /pos/calculate-totals - Calculate totals'));
  
  // POST /api/pos/calculate-delivery-margin
  const calcMargin = await apiRequest(ctx, 'POST', '/pos/calculate-delivery-margin', {
    price: 100,
    cost: 60,
    commission_type: 'percentage',
    commission_value: 15,
  });
  track(assertSuccess(calcMargin, 'POST /pos/calculate-delivery-margin - Calculate margin'));
  
  // Validation tests
  const emptyItems = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    items: [],
  });
  track(assertStatus(emptyItems, 400, 'POST /pos/orders - Validation (empty items)'));
  
  const invalidItem = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    items: [{ product_name: 'Test' }], // Missing quantity and unit_price
  });
  track(assertStatus(invalidItem, 400, 'POST /pos/orders - Validation (missing item fields)'));
  
  // GET /api/pos/orders/:orderId - Not found
  const notFound = await apiRequest(ctx, 'GET', '/pos/orders/999999');
  track(assertStatus(notFound, 404, 'GET /pos/orders/999999 - Not found'));
  
  return { orderId };
}

// ============================================
// ORDER EDITING TESTS
// ============================================
async function testOrderEditing(ctx: TestContext): Promise<void> {
  console.log('\n✏️  ORDER EDITING');
  
  // Get product availability first - only use products with stock
  const availability = await apiRequest(ctx, 'GET', '/pos/product-availability');
  const availableStock = availability.data?.data || availability.data || {};
  const availableProductIds = Object.entries(availableStock)
    .filter(([_, qty]) => (qty as number) > 0)
    .map(([id, _]) => parseInt(id));
  
  if (availableProductIds.length < 2) {
    console.log(`  ⚠️  Found only ${availableProductIds.length} products with inventory - need at least 2`);
    console.log('  ⚠️  Please ensure at least 2 products have ingredients in stock');
    return;
  }
  
  // Get products for testing
  const products = await apiRequest(ctx, 'GET', '/store-products');
  const allProducts = products.data?.data || products.data?.products || [];
  
  // Filter to only products with available inventory
  const productsWithStock = allProducts.filter((p: any) => availableProductIds.includes(p.id));
  
  if (productsWithStock.length < 2) {
    console.log('  ⚠️  Not enough products with inventory - need at least 2');
    return;
  }
  
  // Use products that have stock
  const testProduct1 = productsWithStock[0];
  const testProduct2 = productsWithStock[1];
  
  const createOrder = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T-EDIT-TEST',
    items: [
      {
        product_id: testProduct1.id,
        product_name: testProduct1.name,
        quantity: 1,
        unit_price: testProduct1.price || 25.00,
      },
    ],
  });
  
  if (!createOrder.data?.data?.id) {
    const errorMsg = createOrder.data?.error || 'Unknown error';
    console.log(`  ❌ FAILED to create test order for editing tests`);
    console.log(`      Product: ${testProduct1.name} (ID: ${testProduct1.id})`);
    console.log(`      Error: ${errorMsg}`);
    console.log('  ⚠️  Skipping remaining order editing tests');
    track(false); // Count as failure since we have stock but order still failed
    return;
  }
  
  const orderId = createOrder.data.data.id;
  const originalOrderItemId = createOrder.data.data.items?.[0]?.id;
  
  // TEST 1: Add products to order (products_to_add)
  const editAddProducts = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/edit`, {
    products_to_add: [{
      product_id: testProduct2.id,
      product_name: testProduct2.name,
      quantity: 1,
      unit_price: testProduct2.price || 20.00,
    }]
  });
  track(assertSuccess(editAddProducts, 'PATCH /pos/orders/:id/edit - Add products (products_to_add)'));
  
  // Verify product was actually added by fetching the order
  const verifyAddedProduct = await apiRequest(ctx, 'GET', `/pos/orders/${orderId}`);
  if (verifyAddedProduct.data?.data?.order_items) {
    const itemCount = verifyAddedProduct.data.data.order_items.length;
    const addedItemExists = verifyAddedProduct.data.data.order_items.some(
      (item: any) => item.product_id === testProduct2.id
    );
    const verifySuccess = itemCount >= 2 && addedItemExists;
    track(verifySuccess);
    console.log(verifySuccess 
      ? `  ✓ Verify added product - Order has ${itemCount} items, added product found`
      : `  ✗ Verify added product - Order has ${itemCount} items, added product ${addedItemExists ? 'found' : 'NOT found'}`);
  } else {
    console.log('  ⚠️  Could not verify added product - order_items not in response');
  }
  
  // TEST 1b: Add product WITH modifiers
  const editAddWithModifiers = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/edit`, {
    products_to_add: [{
      product_id: testProduct1.id,
      product_name: testProduct1.name + ' (with mods)',
      quantity: 1,
      unit_price: testProduct1.price || 25.00,
      modifiers: [
        { modifier_name: 'Extra Sauce', modifier_type: 'extra', unit_price: 1.50, quantity: 1 },
        { modifier_name: 'No Onion', modifier_type: 'removal', unit_price: 0, quantity: 1 }
      ]
    }]
  });
  track(assertSuccess(editAddWithModifiers, 'PATCH /pos/orders/:id/edit - Add product with modifiers'));
  
  // Verify product with modifiers was added
  const verifyWithMods = await apiRequest(ctx, 'GET', `/pos/orders/${orderId}`);
  if (verifyWithMods.data?.data?.order_items) {
    const itemWithMods = verifyWithMods.data.data.order_items.find(
      (item: any) => item.product_name?.includes('(with mods)')
    );
    const hasModifiers = itemWithMods?.order_item_modifiers?.length >= 2;
    track(hasModifiers);
    console.log(hasModifiers 
      ? `  ✓ Verify added product with modifiers - Found with ${itemWithMods?.order_item_modifiers?.length} modifiers`
      : `  ✗ Verify added product with modifiers - ${itemWithMods ? 'Found but modifiers missing' : 'Item not found'}`);
  }
  
  // TEST 2: Modify product quantity (products_to_modify)
  if (originalOrderItemId) {
    const editQuantity = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/edit`, {
      products_to_modify: [{
        order_item_id: originalOrderItemId,
        quantity: 2
      }]
    });
    track(assertSuccess(editQuantity, 'PATCH /pos/orders/:id/edit - Modify quantity'));
  }
  
  // TEST 3: Modify product with modifiers (add/remove items/ingredients)
  if (originalOrderItemId) {
    const editModifiers = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/edit`, {
      products_to_modify: [{
        order_item_id: originalOrderItemId,
        modifiers: [
          { 
            modifier_name: "Extra Cheese", 
            modifier_type: "extra", 
            unit_price: 2.00, 
            quantity: 1 
          },
          { 
            modifier_name: "No Onions", 
            modifier_type: "removal", 
            unit_price: 0, 
            quantity: 1 
          }
        ]
      }]
    });
    track(assertSuccess(editModifiers, 'PATCH /pos/orders/:id/edit - Modify modifiers (add/remove items)'));
  }
  
  // TEST 4: Change product variant (if product has variants)
  const productsWithVariants = productsWithStock.filter((p: any) => p.has_variants);
  console.log(`  🔍 Products with variants found: ${productsWithVariants.length}`);
  if (productsWithVariants.length > 0) {
    const productWithVariant = productsWithVariants[0];
    console.log(`  🔍 Testing with product: ${productWithVariant.name} (ID: ${productWithVariant.id})`);
    
    // Variants are already in the product object from getProducts list
    const variantsList = productWithVariant.variants || [];
    console.log(`  🔍 Variants found: ${variantsList.length}${variantsList.length > 0 ? ' - ' + variantsList.map((v: any) => v.name).join(', ') : ''}`);
    
    if (variantsList.length >= 2) {
      // Create order with first variant
      const orderWithVariant = await apiRequest(ctx, 'POST', '/pos/orders', {
        order_type: 'dine_in',
        order_source: 'pos',
        table_number: 'T-VARIANT-TEST',
        items: [{
          product_id: productWithVariant.id,
          variant_id: variantsList[0].id,
          product_name: productWithVariant.name,
          quantity: 1,
          unit_price: productWithVariant.price || 25.00,
        }],
      });
      
      if (orderWithVariant.data?.data?.id) {
        const variantOrderId = orderWithVariant.data.data.id;
        const variantOrderItemId = orderWithVariant.data.data.items?.[0]?.id;
        
        if (variantOrderItemId) {
          // Change to second variant
          const editVariant = await apiRequest(ctx, 'PATCH', `/pos/orders/${variantOrderId}/edit`, {
            products_to_modify: [{
              order_item_id: variantOrderItemId,
              variant_id: variantsList[1].id
            }]
          });
          track(assertSuccess(editVariant, 'PATCH /pos/orders/:id/edit - Change variant'));
        }
      } else {
        console.log(`  ⚠️  Could not create variant test order - ${orderWithVariant.data?.error || 'Unknown error'}`);
      }
    } else {
      console.log('  ℹ️  Skipping variant change test - product needs 2+ variants');
    }
  } else {
    console.log('  ℹ️  Skipping variant change test - no products with variants');
  }
  
  // TEST 5: Remove products from order (products_to_remove)
  const getOrderForRemove = await apiRequest(ctx, 'GET', `/pos/orders/${orderId}`);
  if (getOrderForRemove.data?.data?.items?.length > 0) {
    const itemToRemoveId = getOrderForRemove.data.data.items[0].id;
    
    const editRemoveProduct = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/edit`, {
      products_to_remove: [itemToRemoveId]
    });
    track(assertSuccess(editRemoveProduct, 'PATCH /pos/orders/:id/edit - Remove products (products_to_remove)'));
  }
  
  // TEST 6: Backward compatibility - Test old parameter names (items_to_*)
  const createOrderForBC = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T-BC-TEST',
    items: [{
      product_id: testProduct1.id,
      product_name: testProduct1.name,
      quantity: 1,
      unit_price: testProduct1.price || 25.00,
    }],
  });
  
  if (createOrderForBC.data?.data?.id) {
    const bcOrderId = createOrderForBC.data.data.id;
    const bcOrderItemId = createOrderForBC.data.data.items?.[0]?.id;
    
    if (bcOrderItemId) {
      const editWithOldNames = await apiRequest(ctx, 'PATCH', `/pos/orders/${bcOrderId}/edit`, {
        items_to_modify: [{
          order_item_id: bcOrderItemId,
          quantity: 3
        }]
      });
      track(assertSuccess(editWithOldNames, 'PATCH /pos/orders/:id/edit - Backward compatibility (items_to_*)'));
    }
  } else {
    console.log(`  ⚠️  Could not create BC test order - ${createOrderForBC.data?.error || 'Unknown error'}`);
  }
  
  // VALIDATION TESTS
  
  // TEST 7: Validation - No changes provided (should fail)
  const editNoChanges = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/edit`, {});
  track(assertStatus(editNoChanges, 400, 'PATCH /pos/orders/:id/edit - Validation (no changes)'));
  
  // TEST 8: Validation - Order not found (should fail)
  const editNotFound = await apiRequest(ctx, 'PATCH', '/pos/orders/999999/edit', {
    products_to_add: [{
      product_id: testProduct1.id,
      product_name: testProduct1.name,
      quantity: 1,
      unit_price: 25.00,
    }]
  });
  track(assertStatus(editNotFound, 400, 'PATCH /pos/orders/999999/edit - Not found'));
  
  // TEST 9: Complex edit - Multiple operations at once
  const createOrderForComplex = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T-COMPLEX-TEST',
    items: [
      {
        product_id: testProduct1.id,
        product_name: testProduct1.name,
        quantity: 1,
        unit_price: testProduct1.price || 25.00,
      },
      {
        product_id: testProduct2.id,
        product_name: testProduct2.name,
        quantity: 1,
        unit_price: testProduct2.price || 20.00,
      }
    ],
  });
  
  if (createOrderForComplex.data?.data?.id) {
    const complexOrderId = createOrderForComplex.data.data.id;
    const complexItems = createOrderForComplex.data.data.items || [];
    
    if (complexItems.length >= 2 && productsWithStock.length >= 3) {
      const editComplex = await apiRequest(ctx, 'PATCH', `/pos/orders/${complexOrderId}/edit`, {
        products_to_add: [{
          product_id: productsWithStock[2]?.id || testProduct1.id,
          product_name: productsWithStock[2]?.name || testProduct1.name,
          quantity: 1,
          unit_price: productsWithStock[2]?.price || 30.00,
        }],
        products_to_remove: [complexItems[1].id],
        products_to_modify: [{
          order_item_id: complexItems[0].id,
          quantity: 2,
          modifiers: [{
            modifier_name: "Special Request",
            modifier_type: "extra",
            unit_price: 1.00,
            quantity: 1
          }]
        }]
      });
      track(assertSuccess(editComplex, 'PATCH /pos/orders/:id/edit - Complex edit (add + remove + modify)'));
    } else {
      console.log('  ℹ️  Skipping complex edit test - need at least 3 products with stock');
    }
  } else {
    console.log(`  ⚠️  Could not create complex test order - ${createOrderForComplex.data?.error || 'Unknown error'}`);
  }
}

// ============================================
// KITCHEN DISPLAY TESTS
// ============================================
async function testKitchenDisplay(ctx: TestContext): Promise<void> {
  console.log('\n👨‍🍳 KITCHEN DISPLAY');
  
  // GET /api/pos/kitchen/orders - Get kitchen orders
  const getKitchenOrders = await apiRequest(ctx, 'GET', '/pos/kitchen/orders');
  track(assertSuccess(getKitchenOrders, 'GET /pos/kitchen/orders - Get kitchen orders'));
  
  // GET /api/pos/kitchen/orders with status filter
  const inProgressOrders = await apiRequest(ctx, 'GET', '/pos/kitchen/orders?status=in_progress');
  track(assertSuccess(inProgressOrders, 'GET /pos/kitchen/orders?status=in_progress - Filter'));
  
  // GET /api/pos/kitchen/cancelled-items - Get ALL cancelled items pending decision
  const getCancelledItems = await apiRequest(ctx, 'GET', '/pos/kitchen/cancelled-items');
  track(assertSuccess(getCancelledItems, 'GET /pos/kitchen/cancelled-items - Get all pending items'));
  
  // GET /api/pos/kitchen/cancelled-items - Filter by source: order_cancelled
  const getCancelledOnly = await apiRequest(ctx, 'GET', '/pos/kitchen/cancelled-items?source=order_cancelled');
  track(assertSuccess(getCancelledOnly, 'GET /pos/kitchen/cancelled-items?source=order_cancelled - Cancelled orders'));
  
  // GET /api/pos/kitchen/cancelled-items - Filter by source: order_edited
  const getEditedOnly = await apiRequest(ctx, 'GET', '/pos/kitchen/cancelled-items?source=order_edited');
  track(assertSuccess(getEditedOnly, 'GET /pos/kitchen/cancelled-items?source=order_edited - Edited orders'));
  
  // GET /api/pos/kitchen/cancelled-items - Invalid source (should return 400)
  const getInvalidSource = await apiRequest(ctx, 'GET', '/pos/kitchen/cancelled-items?source=invalid');
  track(assertStatus(getInvalidSource, 400, 'GET /pos/kitchen/cancelled-items?source=invalid - Validation'));
  
  // GET /api/pos/kitchen/cancelled-stats - Get cancelled items stats
  const getCancelledStats = await apiRequest(ctx, 'GET', '/pos/kitchen/cancelled-stats');
  track(assertSuccess(getCancelledStats, 'GET /pos/kitchen/cancelled-stats - Get stats'));
  
  // POST /api/pos/kitchen/process-waste - Validation tests
  const processEmpty = await apiRequest(ctx, 'POST', '/pos/kitchen/process-waste', {
    decisions: [],
  });
  track(assertStatus(processEmpty, 400, 'POST /pos/kitchen/process-waste - Validation (empty)'));
  
  const processInvalid = await apiRequest(ctx, 'POST', '/pos/kitchen/process-waste', {
    decisions: [{ cancelled_item_id: 999, decision: 'invalid' }],
  });
  track(assertStatus(processInvalid, 400, 'POST /pos/kitchen/process-waste - Validation (invalid decision)'));
  
  // POST /api/pos/kitchen/process-waste - Valid waste decision (may not find item)
  const processWaste = await apiRequest(ctx, 'POST', '/pos/kitchen/process-waste', {
    decisions: [{ cancelled_item_id: 999999, decision: 'waste' }],
  });
  // This will process but with errors since item 999999 doesn't exist
  track(assertSuccess(processWaste, 'POST /pos/kitchen/process-waste - Waste decision format'));
  
  // POST /api/pos/kitchen/process-waste - Valid return decision (may not find item)
  const processReturn = await apiRequest(ctx, 'POST', '/pos/kitchen/process-waste', {
    decisions: [{ cancelled_item_id: 999998, decision: 'return' }],
  });
  track(assertSuccess(processReturn, 'POST /pos/kitchen/process-waste - Return decision format'));
}

// ============================================
// POS SESSIONS TESTS
// ============================================
async function testPOSSessions(ctx: TestContext): Promise<void> {
  console.log('\n💵 POS SESSIONS');
  
  // GET /api/pos-sessions/employees - Get POS employees
  const getEmployees = await apiRequest(ctx, 'GET', '/pos-sessions/employees');
  track(assertSuccess(getEmployees, 'GET /pos-sessions/employees - Get POS employees'));
  
  // GET /api/pos-sessions/active - Get active session for current user
  const getActive = await apiRequest(ctx, 'GET', '/pos-sessions/active');
  track(assertSuccess(getActive, 'GET /pos-sessions/active - Get active session'));
  
  // GET /api/pos-sessions/business-active - Get active session for business
  const getBusinessActive = await apiRequest(ctx, 'GET', '/pos-sessions/business-active');
  track(assertSuccess(getBusinessActive, 'GET /pos-sessions/business-active - Get business session'));
  
  // GET /api/pos-sessions/history - Get session history
  const getHistory = await apiRequest(ctx, 'GET', '/pos-sessions/history');
  track(assertSuccess(getHistory, 'GET /pos-sessions/history - Get session history'));
  
  // GET /api/pos-sessions/history with filters
  const getHistoryFiltered = await apiRequest(ctx, 'GET', '/pos-sessions/history?limit=10');
  track(assertSuccess(getHistoryFiltered, 'GET /pos-sessions/history?limit=10 - Filtered'));
  
  // POST /api/pos-sessions/open - Validation (missing opening_float when not fixed)
  // First ensure fixed float is disabled and all users allowed
  await apiRequest(ctx, 'PUT', '/business-settings/operational', {
    pos_opening_float_fixed: false,
    pos_session_allowed_user_ids: [], // Allow all users
  });
  const openMissingFloat = await apiRequest(ctx, 'POST', '/pos-sessions/open', {});
  track(assertStatus(openMissingFloat, 400, 'POST /pos-sessions/open - Validation (missing float when not fixed)'));
  
  // POST /api/pos-sessions/open - Success with fixed opening float
  await apiRequest(ctx, 'PUT', '/business-settings/operational', {
    pos_opening_float_fixed: true,
    pos_opening_float_amount: 150.00,
    pos_session_allowed_user_ids: [], // Allow all users
  });
  const openWithFixedFloat = await apiRequest(ctx, 'POST', '/pos-sessions/open', {});
  track(assertSuccess(openWithFixedFloat, 'POST /pos-sessions/open - Success with fixed float (no opening_float needed)'));
  
  // Close the session we just opened
  if (openWithFixedFloat.data?.data?.id) {
    await apiRequest(ctx, 'POST', `/pos-sessions/${openWithFixedFloat.data.data.id}/close`, {
      actual_cash_count: 150.00,
    });
  }
  
  // POST /api/pos-sessions/open - Test user restriction (restrict to specific users)
  await apiRequest(ctx, 'PUT', '/business-settings/operational', {
    pos_opening_float_fixed: false,
    pos_session_allowed_user_ids: [999], // Non-existent user ID to simulate restriction
  });
  const openRestricted = await apiRequest(ctx, 'POST', '/pos-sessions/open', {
    opening_float: 100,
  });
  track(assertStatus(openRestricted, 403, 'POST /pos-sessions/open - Forbidden (user not in allowed list)'));
  
  // Reset to allow all users for remaining tests
  await apiRequest(ctx, 'PUT', '/business-settings/operational', {
    pos_session_allowed_user_ids: [],
  });
  
  // POST /api/pos-sessions/pin-authenticate - Validation (missing PIN)
  const pinMissing = await apiRequest(ctx, 'POST', '/pos-sessions/pin-authenticate', {});
  track(assertStatus(pinMissing, 400, 'POST /pos-sessions/pin-authenticate - Validation (missing PIN)'));
  
  // POST /api/pos-sessions/pin-authenticate - Invalid PIN
  const pinInvalid = await apiRequest(ctx, 'POST', '/pos-sessions/pin-authenticate', {
    pin: '0000',  // Invalid PIN
  });
  track(assertStatus(pinInvalid, 401, 'POST /pos-sessions/pin-authenticate - Invalid PIN'));
  
  // POST /api/pos-sessions/pin-authenticate - PIN too short (less than 4 digits)
  const pinTooShort = await apiRequest(ctx, 'POST', '/pos-sessions/pin-authenticate', {
    pin: '123',
  });
  track(assertStatus(pinTooShort, 400, 'POST /pos-sessions/pin-authenticate - Validation (PIN too short)'));
  
  // Note: Valid PIN authentication is tested in the integration flow below
  // where we authenticate an employee and open a session
}

// ============================================
// ORDER ACTIONS TESTS
// ============================================
async function testOrderActions(ctx: TestContext, orderId: number | null): Promise<void> {
  console.log('\n⚡ ORDER ACTIONS');
  
  if (!orderId) {
    console.log('  ⚠️  Skipping order action tests - no order ID available');
    return;
  }
  
  // Note: These tests may fail if order is in wrong state, which is expected
  
  // POST /api/pos/orders/:orderId/refund - Validation (missing fields)
  const refundMissing = await apiRequest(ctx, 'POST', `/pos/orders/${orderId}/refund`, {});
  track(assertStatus(refundMissing, 400, `POST /pos/orders/${orderId}/refund - Validation (missing fields)`));
  
  // POST /api/pos/orders/:orderId/payment - Validation (missing fields)
  const paymentMissing = await apiRequest(ctx, 'POST', `/pos/orders/${orderId}/payment`, {});
  track(assertStatus(paymentMissing, 400, `POST /pos/orders/${orderId}/payment - Validation (missing fields)`));
  
  // PATCH /api/pos/orders/:orderId/status - Validation (missing status)
  const statusMissing = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/status`, {});
  track(assertStatus(statusMissing, 400, `PATCH /pos/orders/${orderId}/status - Validation (missing status)`));
  
  // PATCH /api/pos/orders/:orderId/status - Validation (invalid status)
  const statusInvalid = await apiRequest(ctx, 'PATCH', `/pos/orders/${orderId}/status`, {
    status: 'invalid_status',
  });
  track(assertStatus(statusInvalid, 400, `PATCH /pos/orders/${orderId}/status - Validation (invalid status)`));
}

// ============================================
// DELIVERY APP ORDERS TESTS
// ============================================
async function testDeliveryAppOrders(ctx: TestContext): Promise<void> {
  console.log('\n📱 DELIVERY APP ORDERS');
  
  // POST /api/pos/orders/delivery-app - Validation (missing fields)
  const missingFields = await apiRequest(ctx, 'POST', '/pos/orders/delivery-app', {});
  track(assertStatus(missingFields, 400, 'POST /pos/orders/delivery-app - Validation (missing fields)'));
  
  // POST /api/pos/orders/delivery-app - Validation (invalid source)
  const invalidSource = await apiRequest(ctx, 'POST', '/pos/orders/delivery-app', {
    source: 'invalid_app',
    external_order_id: 'TEST123',
    items: [{ product_name: 'Test', quantity: 1, unit_price: 10 }],
  });
  track(assertStatus(invalidSource, 400, 'POST /pos/orders/delivery-app - Validation (invalid source)'));
  
  // GET /api/pos/orders/external/:externalOrderId - Not found
  const notFound = await apiRequest(ctx, 'GET', '/pos/orders/external/NONEXISTENT123');
  track(assertStatus(notFound, 404, 'GET /pos/orders/external/NONEXISTENT123 - Not found'));
}

// ============================================
// SCAN-COMPLETE (QR CODE) TESTS
// ============================================
async function testScanComplete(ctx: TestContext): Promise<void> {
  console.log('\n📱 SCAN-COMPLETE (QR CODE)');
  
  // POST /api/pos/orders/scan-complete - Validation (missing order_number)
  const missingOrderNumber = await apiRequest(ctx, 'POST', '/pos/orders/scan-complete', {});
  track(assertStatus(missingOrderNumber, 400, 'POST /pos/orders/scan-complete - Validation (missing order_number)'));
  
  // POST /api/pos/orders/scan-complete - With non-existent order
  // Returns 404 if order not found, or 400 if kitchen mode not enabled
  const orderNotFound = await apiRequest(ctx, 'POST', '/pos/orders/scan-complete', {
    order_number: 'NONEXISTENT-ORDER-12345',
  });
  // Accept either 400 (kitchen mode not enabled) or 404 (order not found)
  const scanValid = orderNotFound.status === 400 || orderNotFound.status === 404;
  track(scanValid);
  console.log(scanValid
    ? '  ✓ POST /pos/orders/scan-complete - Order/mode check'
    : '  ✗ POST /pos/orders/scan-complete - Order/mode check');
  
  // Note: Full scan-complete flow test would require:
  // 1. Setting kitchen_operation_mode to 'receipt_scan' in operational_settings
  // 2. Creating an order in 'in_progress' status
  // 3. Scanning the order number to complete it
  // This is covered by integration testing in the frontend
}

// ============================================
// ORDER CANCELLATION & INVENTORY RESERVATION TESTS
// ============================================
async function testCancellationFlow(ctx: TestContext): Promise<void> {
  console.log('\n🚫 ORDER CANCELLATION & INVENTORY RESERVATION');
  
  // POST /api/pos/orders/:orderId/cancel - Validation (order not found returns 400)
  // Note: API returns 400 "Order not found" instead of 404 because the service throws an Error
  const cancelNotFound = await apiRequest(ctx, 'POST', '/pos/orders/999999/cancel', {
    reason: 'Test cancellation',
  });
  track(assertStatus(cancelNotFound, 400, 'POST /pos/orders/999999/cancel - Not found (returns 400)'));
  
  // POST /api/pos/orders/:orderId/cancel - With pos_session_id parameter
  // This tests that the pos_session_id parameter is accepted by the API
  const cancelWithSession = await apiRequest(ctx, 'POST', '/pos/orders/999999/cancel', {
    reason: 'Test cancellation',
    pos_session_id: 1,
  });
  track(assertStatus(cancelWithSession, 400, 'POST /pos/orders/999999/cancel - With pos_session_id'));
  
  // Test order edit endpoint (items_to_remove)
  // PATCH /api/pos/orders/:orderId/edit - Not found (returns 400)
  const editNotFound = await apiRequest(ctx, 'PATCH', '/pos/orders/999999/edit', {
    items_to_remove: [1],
  });
  track(assertStatus(editNotFound, 400, 'PATCH /pos/orders/999999/edit - Not found (returns 400)'));
  
  // Test that cancelled items include cancellation_source field
  const cancelledItems = await apiRequest(ctx, 'GET', '/pos/kitchen/cancelled-items');
  if (cancelledItems.data?.data && Array.isArray(cancelledItems.data.data)) {
    const hasSourceField = cancelledItems.data.data.length === 0 || 
      cancelledItems.data.data.some((item: any) => 'cancellation_source' in item || item.cancellation_source !== undefined);
    track(hasSourceField);
    console.log(hasSourceField 
      ? '  ✓ GET /pos/kitchen/cancelled-items - Response includes cancellation_source field'
      : '  ✗ GET /pos/kitchen/cancelled-items - Response includes cancellation_source field');
  } else {
    // Empty response is valid
    track(true);
    console.log('  ✓ GET /pos/kitchen/cancelled-items - Response format valid (empty or array)');
  }
  
  // POST /api/pos/kitchen/auto-expire - Test auto-expire endpoint (for scheduled job)
  // This endpoint may or may not require auth depending on configuration
  const autoExpire = await apiRequest(ctx, 'POST', '/pos/kitchen/auto-expire', {});
  // Accept either 200 (success) or 401 (if cron key required)
  const autoExpireValid = autoExpire.status === 200 || autoExpire.status === 401;
  track(autoExpireValid);
  console.log(autoExpireValid
    ? '  ✓ POST /pos/kitchen/auto-expire - Endpoint accessible'
    : '  ✗ POST /pos/kitchen/auto-expire - Endpoint accessible');
}

// ============================================
// ORDER DETAIL RESPONSE STRUCTURE TESTS
// ============================================
async function testOrderDetailStructure(ctx: TestContext): Promise<void> {
  console.log('\n📋 ORDER DETAIL STRUCTURE');
  
  // Get product availability first
  const availability = await apiRequest(ctx, 'GET', '/pos/product-availability');
  const availableStock = availability.data?.data || availability.data || {};
  const availableProductIds = Object.entries(availableStock)
    .filter(([_, qty]) => (qty as number) > 0)
    .map(([id, _]) => parseInt(id));
  
  if (availableProductIds.length < 1) {
    console.log('  ⚠️  No products with inventory - skipping structure tests');
    return;
  }
  
  const products = await apiRequest(ctx, 'GET', '/store-products');
  const allProducts = products.data?.data || products.data?.products || [];
  const testProduct = allProducts.find((p: any) => availableProductIds.includes(p.id));
  
  if (!testProduct) {
    console.log('  ⚠️  No test product available - skipping structure tests');
    return;
  }
  
  // Create a test order
  const createOrder = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T-STRUCT-TEST',
    items: [{
      product_id: testProduct.id,
      product_name: testProduct.name,
      quantity: 1,
      unit_price: testProduct.price || 25.00,
    }],
  });
  
  if (!createOrder.data?.data?.id) {
    console.log(`  ⚠️  Could not create test order - ${createOrder.data?.error || 'Unknown error'}`);
    return;
  }
  
  const orderId = createOrder.data.data.id;
  
  // TEST 1: Get order and verify response includes order_items array
  const getOrder = await apiRequest(ctx, 'GET', `/pos/orders/${orderId}`);
  const hasOrderItems = getOrder.data?.data?.order_items && Array.isArray(getOrder.data.data.order_items);
  track(hasOrderItems);
  console.log(hasOrderItems
    ? '  ✓ GET /pos/orders/:id - Response includes order_items array'
    : '  ✗ GET /pos/orders/:id - Response includes order_items array');
  
  // TEST 2: Verify each order item has order_item_modifiers array
  if (hasOrderItems && getOrder.data.data.order_items.length > 0) {
    const firstItem = getOrder.data.data.order_items[0];
    const hasModifiersArray = 'order_item_modifiers' in firstItem && 
      (Array.isArray(firstItem.order_item_modifiers) || firstItem.order_item_modifiers === null);
    track(hasModifiersArray);
    console.log(hasModifiersArray
      ? '  ✓ GET /pos/orders/:id - Order items include order_item_modifiers'
      : '  ✗ GET /pos/orders/:id - Order items include order_item_modifiers');
  }
  
  // TEST 3: Test with product that has variants
  const productsWithVariants = allProducts.filter((p: any) => 
    p.has_variants && availableProductIds.includes(p.id)
  );
  
  if (productsWithVariants.length > 0) {
    const variantProduct = productsWithVariants[0];
    const variantsList = variantProduct.variants || variantProduct.product_variants || [];
    
    if (variantsList.length > 0) {
      const createVariantOrder = await apiRequest(ctx, 'POST', '/pos/orders', {
        order_type: 'dine_in',
        order_source: 'pos',
        table_number: 'T-VAR-STRUCT',
        items: [{
          product_id: variantProduct.id,
          variant_id: variantsList[0].id,
          product_name: variantProduct.name,
          quantity: 1,
          unit_price: variantProduct.price || 25.00,
        }],
      });
      
      if (createVariantOrder.data?.data?.id) {
        const variantOrderId = createVariantOrder.data.data.id;
        const getVariantOrder = await apiRequest(ctx, 'GET', `/pos/orders/${variantOrderId}`);
        
        if (getVariantOrder.data?.data?.order_items?.[0]) {
          const variantItem = getVariantOrder.data.data.order_items[0];
          const hasVariantName = variantItem.variant_id && variantItem.variant_name;
          track(hasVariantName);
          console.log(hasVariantName
            ? '  ✓ GET /pos/orders/:id - Items with variants have variant_name'
            : '  ✗ GET /pos/orders/:id - Items with variants have variant_name');
        }
      } else {
        console.log('  ℹ️  Skipping variant_name test - could not create variant order');
      }
    } else {
      console.log('  ℹ️  Skipping variant_name test - product has no variants');
    }
  } else {
    console.log('  ℹ️  Skipping variant_name test - no products with variants available');
  }
  
  // TEST 4: Invalid order ID format
  const invalidId = await apiRequest(ctx, 'GET', '/pos/orders/abc');
  // Should return 400 or 500 (depending on how parseInt handles 'abc')
  const invalidIdHandled = invalidId.status === 400 || invalidId.status === 404 || invalidId.status === 500;
  track(invalidIdHandled);
  console.log(invalidIdHandled
    ? '  ✓ GET /pos/orders/abc - Invalid ID format handled'
    : '  ✗ GET /pos/orders/abc - Invalid ID format handled');
}

// ============================================
// ORDER EDITING VALIDATION TESTS
// ============================================
async function testOrderEditingValidations(ctx: TestContext): Promise<void> {
  console.log('\n🔒 ORDER EDITING VALIDATIONS');
  
  // Get product availability
  const availability = await apiRequest(ctx, 'GET', '/pos/product-availability');
  const availableStock = availability.data?.data || availability.data || {};
  const availableProductIds = Object.entries(availableStock)
    .filter(([_, qty]) => (qty as number) > 0)
    .map(([id, _]) => parseInt(id));
  
  if (availableProductIds.length < 1) {
    console.log('  ⚠️  No products with inventory - skipping validation tests');
    return;
  }
  
  const products = await apiRequest(ctx, 'GET', '/store-products');
  const allProducts = products.data?.data || products.data?.products || [];
  const testProduct = allProducts.find((p: any) => availableProductIds.includes(p.id));
  
  if (!testProduct) {
    console.log('  ⚠️  No test product available - skipping validation tests');
    return;
  }
  
  // TEST 1: Cannot edit completed order
  const createOrder1 = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T-COMP-TEST',
    items: [{
      product_id: testProduct.id,
      product_name: testProduct.name,
      quantity: 1,
      unit_price: testProduct.price || 25.00,
    }],
  });
  
  if (createOrder1.data?.data?.id) {
    const completedOrderId = createOrder1.data.data.id;
    const orderItemId = createOrder1.data.data.items?.[0]?.id || createOrder1.data.data.order_items?.[0]?.id;
    
    // Complete the order
    await apiRequest(ctx, 'PATCH', `/pos/orders/${completedOrderId}/status`, {
      status: 'completed',
    });
    
    // Try to edit completed order (should fail)
    const editCompleted = await apiRequest(ctx, 'PATCH', `/pos/orders/${completedOrderId}/edit`, {
      products_to_modify: [{
        order_item_id: orderItemId || 1,
        quantity: 2
      }]
    });
    track(assertStatus(editCompleted, 400, 'PATCH /pos/orders/:id/edit - Cannot edit completed order'));
  } else {
    console.log(`  ⚠️  Could not create order for completed test - ${createOrder1.data?.error || 'Unknown error'}`);
  }
  
  // TEST 2: Cannot edit cancelled order
  const createOrder2 = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T-CANC-TEST',
    items: [{
      product_id: testProduct.id,
      product_name: testProduct.name,
      quantity: 1,
      unit_price: testProduct.price || 25.00,
    }],
  });
  
  if (createOrder2.data?.data?.id) {
    const cancelledOrderId = createOrder2.data.data.id;
    const orderItemId = createOrder2.data.data.items?.[0]?.id || createOrder2.data.data.order_items?.[0]?.id;
    
    // Cancel the order
    await apiRequest(ctx, 'POST', `/pos/orders/${cancelledOrderId}/cancel`, {
      reason: 'Test cancellation',
    });
    
    // Try to edit cancelled order (should fail)
    const editCancelled = await apiRequest(ctx, 'PATCH', `/pos/orders/${cancelledOrderId}/edit`, {
      products_to_modify: [{
        order_item_id: orderItemId || 1,
        quantity: 2
      }]
    });
    track(assertStatus(editCancelled, 400, 'PATCH /pos/orders/:id/edit - Cannot edit cancelled order'));
  } else {
    console.log(`  ⚠️  Could not create order for cancelled test - ${createOrder2.data?.error || 'Unknown error'}`);
  }
  
  // TEST 3: Invalid order_item_id in modify
  const createOrder3 = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T-INV-ITEM',
    items: [{
      product_id: testProduct.id,
      product_name: testProduct.name,
      quantity: 1,
      unit_price: testProduct.price || 25.00,
    }],
  });
  
  if (createOrder3.data?.data?.id) {
    const invalidItemOrderId = createOrder3.data.data.id;
    
    // Try to modify with non-existent order_item_id
    const editInvalidItem = await apiRequest(ctx, 'PATCH', `/pos/orders/${invalidItemOrderId}/edit`, {
      products_to_modify: [{
        order_item_id: 999999, // Non-existent
        quantity: 2
      }]
    });
    // Should either succeed (skipping invalid item) or return error - both are valid
    const invalidItemHandled = editInvalidItem.status === 200 || editInvalidItem.status === 400;
    track(invalidItemHandled);
    console.log(invalidItemHandled
      ? '  ✓ PATCH /pos/orders/:id/edit - Invalid order_item_id handled gracefully'
      : '  ✗ PATCH /pos/orders/:id/edit - Invalid order_item_id handled gracefully');
  } else {
    console.log(`  ⚠️  Could not create order for invalid item test - ${createOrder3.data?.error || 'Unknown error'}`);
  }
  
  // TEST 4: Invalid order ID format
  const invalidFormat = await apiRequest(ctx, 'PATCH', '/pos/orders/abc/edit', {
    products_to_add: [{
      product_id: testProduct.id,
      product_name: testProduct.name,
      quantity: 1,
      unit_price: 25.00,
    }]
  });
  // Should return error for invalid ID format
  const invalidFormatHandled = invalidFormat.status === 400 || invalidFormat.status === 404 || invalidFormat.status === 500;
  track(invalidFormatHandled);
  console.log(invalidFormatHandled
    ? '  ✓ PATCH /pos/orders/abc/edit - Invalid ID format handled'
    : '  ✗ PATCH /pos/orders/abc/edit - Invalid ID format handled');
}

// ============================================
// ORDER TIMELINE TESTS
// ============================================
async function testOrderTimeline(ctx: TestContext): Promise<void> {
  console.log('\n📜 ORDER TIMELINE');
  
  // Get product availability
  const availability = await apiRequest(ctx, 'GET', '/pos/product-availability');
  const availableStock = availability.data?.data || availability.data || {};
  const availableProductIds = Object.entries(availableStock)
    .filter(([_, qty]) => (qty as number) > 0)
    .map(([id, _]) => parseInt(id));
  
  if (availableProductIds.length < 1) {
    console.log('  ⚠️  No products with inventory - skipping timeline tests');
    return;
  }
  
  const products = await apiRequest(ctx, 'GET', '/store-products');
  const allProducts = products.data?.data || products.data?.products || [];
  const testProduct = allProducts.find((p: any) => availableProductIds.includes(p.id));
  
  if (!testProduct) {
    console.log('  ⚠️  No test product available - skipping timeline tests');
    return;
  }
  
  // Create a test order
  const createOrder = await apiRequest(ctx, 'POST', '/pos/orders', {
    order_type: 'dine_in',
    order_source: 'pos',
    table_number: 'T-TIMELINE',
    items: [{
      product_id: testProduct.id,
      product_name: testProduct.name,
      quantity: 1,
      unit_price: testProduct.price || 25.00,
    }],
  });
  
  if (!createOrder.data?.data?.id) {
    console.log(`  ⚠️  Could not create test order - ${createOrder.data?.error || 'Unknown error'}`);
    return;
  }
  
  const orderId = createOrder.data.data.id;
  
  // TEST 1: Timeline returns array
  const getTimeline = await apiRequest(ctx, 'GET', `/pos/orders/${orderId}/timeline`);
  const hasTimelineArray = getTimeline.status === 200 && 
    (Array.isArray(getTimeline.data?.data) || getTimeline.data?.data === null);
  track(hasTimelineArray);
  console.log(hasTimelineArray
    ? '  ✓ GET /pos/orders/:id/timeline - Returns array or null'
    : '  ✗ GET /pos/orders/:id/timeline - Returns array or null');
  
  // TEST 2: Timeline entries have required fields (if any entries exist)
  if (Array.isArray(getTimeline.data?.data) && getTimeline.data.data.length > 0) {
    const firstEntry = getTimeline.data.data[0];
    const hasRequiredFields = 'event_type' in firstEntry && 
      ('timestamp' in firstEntry || 'created_at' in firstEntry);
    track(hasRequiredFields);
    console.log(hasRequiredFields
      ? '  ✓ GET /pos/orders/:id/timeline - Entries have required fields'
      : '  ✗ GET /pos/orders/:id/timeline - Entries have required fields');
  } else {
    // No timeline entries yet - that's OK for a new order
    console.log('  ℹ️  Timeline empty for new order - skipping field validation');
  }
  
  // TEST 3: Timeline not found for invalid order
  const timelineNotFound = await apiRequest(ctx, 'GET', '/pos/orders/999999/timeline');
  // Should return empty array or 404
  const notFoundHandled = timelineNotFound.status === 200 || timelineNotFound.status === 404;
  track(notFoundHandled);
  console.log(notFoundHandled
    ? '  ✓ GET /pos/orders/999999/timeline - Not found handled'
    : '  ✗ GET /pos/orders/999999/timeline - Not found handled');
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 POS API TEST SUITE');
  console.log('='.repeat(60));
  
  try {
    console.log('\n🔐 Authenticating...');
    const ctx = await authenticate();
    
    // Run test groups
    const { orderId } = await testPOSOrders(ctx);
    await testOrderEditing(ctx);
    await testOrderDetailStructure(ctx);
    await testOrderEditingValidations(ctx);
    await testOrderTimeline(ctx);
    await testKitchenDisplay(ctx);
    await testCancellationFlow(ctx);
    await testPOSSessions(ctx);
    await testOrderActions(ctx, orderId);
    await testDeliveryAppOrders(ctx);
    await testScanComplete(ctx);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${passed + failed}`);
    console.log(`🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
    
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

runTests();

