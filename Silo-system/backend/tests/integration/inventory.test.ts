/**
 * INVENTORY API TEST SUITE
 * Tests all inventory-related API endpoints
 * 
 * Run with: npm run test:inventory
 * 
 * Before running:
 * 1. Make sure backend is running (npm run dev)
 * 2. Set TEST_USERNAME and TEST_PASSWORD environment variables
 *    Or create a .env.test file with these values
 */

import { validateConfig } from './test.config';
import { authenticate, apiRequest, assertSuccess, assertStatus, uniqueId, TestContext } from './test.utils';

// Validate configuration before running
validateConfig();

// Track test results
let passed = 0;
let failed = 0;

function track(success: boolean): void {
  if (success) passed++;
  else failed++;
}

// ============================================
// INVENTORY ITEMS TESTS
// ============================================
async function testInventoryItems(ctx: TestContext): Promise<void> {
  console.log('\n📦 INVENTORY ITEMS');
  
  let testItemId: number | null = null;
  
  // GET /api/inventory/items - List all items
  const listItems = await apiRequest(ctx, 'GET', '/inventory/items');
  track(assertSuccess(listItems, 'GET /inventory/items - List all items'));
  
  // GET /api/inventory/items?category=meat - Filter by category
  const filterItems = await apiRequest(ctx, 'GET', '/inventory/items?category=meat');
  track(assertSuccess(filterItems, 'GET /inventory/items?category=meat - Filter by category'));
  
  // GET /api/inventory/items with pagination
  const paginatedItems = await apiRequest(ctx, 'GET', '/inventory/items?page=1&limit=5');
  track(assertSuccess(paginatedItems, 'GET /inventory/items?page=1&limit=5 - Pagination'));
  
  // POST /api/inventory/items - Create item
  // Note: item_type must be 'food' or 'non_food', storage_unit must be 'Kg' (capital K) for grams
  const itemName = `Test Item ${uniqueId()}`;
  const createItem = await apiRequest(ctx, 'POST', '/inventory/items', {
    name: itemName,
    name_ar: 'عنصر اختبار',
    item_type: 'food',  // Must be 'food' or 'non_food'
    category: 'vegetable',
    unit: 'grams',
    storage_unit: 'Kg',
    cost_per_unit: 5.99,
  });
  track(assertSuccess(createItem, 'POST /inventory/items - Create item'));
  
  if (createItem.data.data?.id) {
    testItemId = createItem.data.data.id;
    
    // GET /api/inventory/items/:itemId - Get single item
    const getItem = await apiRequest(ctx, 'GET', `/inventory/items/${testItemId}`);
    track(assertSuccess(getItem, `GET /inventory/items/${testItemId} - Get single item`));
    
    // PUT /api/inventory/items/:itemId - Update item
    const updateItem = await apiRequest(ctx, 'PUT', `/inventory/items/${testItemId}`, {
      name: `Updated ${itemName}`,
      cost_per_unit: 6.99,
    });
    track(assertSuccess(updateItem, `PUT /inventory/items/${testItemId} - Update item`));
    
    // PUT /api/inventory/items/:itemId/price - Set business price
    const setPrice = await apiRequest(ctx, 'PUT', `/inventory/items/${testItemId}/price`, {
      price: 7.50,
    });
    track(assertSuccess(setPrice, `PUT /inventory/items/${testItemId}/price - Set business price`));
    
    // GET /api/inventory/items/:itemId/usage - Get item usage
    const getUsage = await apiRequest(ctx, 'GET', `/inventory/items/${testItemId}/usage`);
    track(assertSuccess(getUsage, `GET /inventory/items/${testItemId}/usage - Get item usage`));
    
    // DELETE /api/inventory/items/:itemId/price - Remove business price
    const removePrice = await apiRequest(ctx, 'DELETE', `/inventory/items/${testItemId}/price`);
    track(assertSuccess(removePrice, `DELETE /inventory/items/${testItemId}/price - Remove business price`));
    
    // DELETE /api/inventory/items/:itemId - Delete item
    const deleteItem = await apiRequest(ctx, 'DELETE', `/inventory/items/${testItemId}`);
    track(assertSuccess(deleteItem, `DELETE /inventory/items/${testItemId} - Delete item`));
  }
}

// ============================================
// COMPOSITE ITEMS TESTS
// ============================================
async function testCompositeItems(ctx: TestContext): Promise<void> {
  console.log('\n🔗 COMPOSITE ITEMS');
  
  let testCompositeId: number | null = null;
  let ingredientId: number | null = null;
  
  // First, create an item to use as a component
  const ingredientName = `Ingredient ${uniqueId()}`;
  const createIngredient = await apiRequest(ctx, 'POST', '/inventory/items', {
    name: ingredientName,
    item_type: 'food',  // Must be 'food' or 'non_food'
    category: 'vegetable',
    unit: 'grams',
    storage_unit: 'Kg',
    cost_per_unit: 2.00,
  });
  
  ingredientId = createIngredient.data.data?.id;
  
  if (ingredientId) {
    // GET /api/inventory/composite-items - List all composite items
    const listComposites = await apiRequest(ctx, 'GET', '/inventory/composite-items');
    track(assertSuccess(listComposites, 'GET /inventory/composite-items - List all'));
    
    // POST /api/inventory/composite-items - Create composite item
    const compositeName = `Test Sauce ${uniqueId()}`;
    const createComposite = await apiRequest(ctx, 'POST', '/inventory/composite-items', {
      name: compositeName,
      name_ar: 'صلصة اختبار',
      category: 'sauce',  // Singular, not 'sauces'
      unit: 'grams',
      batch_quantity: 500,
      batch_unit: 'grams',
      components: [
        { item_id: ingredientId, quantity: 200 },
      ],
    });
    track(assertSuccess(createComposite, 'POST /inventory/composite-items - Create'));
    
    if (createComposite.data.data?.id) {
      testCompositeId = createComposite.data.data.id;
      
      // GET /api/inventory/composite-items/:itemId - Get single
      const getComposite = await apiRequest(ctx, 'GET', `/inventory/composite-items/${testCompositeId}`);
      track(assertSuccess(getComposite, `GET /inventory/composite-items/${testCompositeId} - Get single`));
      
      // PUT /api/inventory/composite-items/:itemId/components - Update components
      const updateComponents = await apiRequest(ctx, 'PUT', `/inventory/composite-items/${testCompositeId}/components`, {
        components: [
          { item_id: ingredientId, quantity: 250 },
        ],
      });
      track(assertSuccess(updateComponents, `PUT /inventory/composite-items/${testCompositeId}/components - Update`));
      
      // POST /api/inventory/composite-items/:itemId/recalculate-cost - Recalculate
      const recalcCost = await apiRequest(ctx, 'POST', `/inventory/composite-items/${testCompositeId}/recalculate-cost`);
      track(assertSuccess(recalcCost, `POST /inventory/composite-items/${testCompositeId}/recalculate-cost`));
      
      // Cleanup composite item
      await apiRequest(ctx, 'DELETE', `/inventory/items/${testCompositeId}?cascade=true`);
    }
    
    // Cleanup ingredient
    await apiRequest(ctx, 'DELETE', `/inventory/items/${ingredientId}`);
  } else {
    console.log('  ⚠️  Skipping composite tests - could not create ingredient');
  }
}

// ============================================
// VENDORS TESTS
// ============================================
async function testVendors(ctx: TestContext): Promise<void> {
  console.log('\n🏪 VENDORS');
  
  let testVendorId: number | null = null;
  
  // GET /api/inventory-stock/vendors - List vendors
  const listVendors = await apiRequest(ctx, 'GET', '/inventory-stock/vendors');
  track(assertSuccess(listVendors, 'GET /inventory-stock/vendors - List all'));
  
  // GET /api/inventory-stock/vendors with search
  const searchVendors = await apiRequest(ctx, 'GET', '/inventory-stock/vendors?search=test');
  track(assertSuccess(searchVendors, 'GET /inventory-stock/vendors?search=test - Search'));
  
  // POST /api/inventory-stock/vendors - Create vendor
  const vendorName = `Test Vendor ${uniqueId()}`;
  const createVendor = await apiRequest(ctx, 'POST', '/inventory-stock/vendors', {
    name: vendorName,
    name_ar: 'مورد اختبار',
    contact_person: 'John Doe',
    phone: '+123456789',
    email: 'vendor@test.com',
  });
  track(assertSuccess(createVendor, 'POST /inventory-stock/vendors - Create'));
  
  if (createVendor.data.data?.id) {
    testVendorId = createVendor.data.data.id;
    
    // GET /api/inventory-stock/vendors/:id - Get single
    const getVendor = await apiRequest(ctx, 'GET', `/inventory-stock/vendors/${testVendorId}`);
    track(assertSuccess(getVendor, `GET /inventory-stock/vendors/${testVendorId} - Get single`));
    
    // PUT /api/inventory-stock/vendors/:id - Update
    const updateVendor = await apiRequest(ctx, 'PUT', `/inventory-stock/vendors/${testVendorId}`, {
      contact_person: 'Jane Doe Updated',
    });
    track(assertSuccess(updateVendor, `PUT /inventory-stock/vendors/${testVendorId} - Update`));
    
    // DELETE /api/inventory-stock/vendors/:id - Delete
    const deleteVendor = await apiRequest(ctx, 'DELETE', `/inventory-stock/vendors/${testVendorId}`);
    track(assertSuccess(deleteVendor, `DELETE /inventory-stock/vendors/${testVendorId} - Delete`));
  }
}

// ============================================
// STOCK LEVELS TESTS
// ============================================
async function testStockLevels(ctx: TestContext): Promise<void> {
  console.log('\n📊 STOCK LEVELS');
  
  // GET /api/inventory-stock/stock/stats - Get stock stats
  const getStats = await apiRequest(ctx, 'GET', '/inventory-stock/stock/stats');
  track(assertSuccess(getStats, 'GET /inventory-stock/stock/stats - Get stock statistics'));
  
  // GET /api/inventory-stock/stock - Get stock levels
  const getStock = await apiRequest(ctx, 'GET', '/inventory-stock/stock');
  track(assertSuccess(getStock, 'GET /inventory-stock/stock - Get all stock levels'));
  
  // GET /api/inventory-stock/stock?low_stock=true - Get low stock items
  const getLowStock = await apiRequest(ctx, 'GET', '/inventory-stock/stock?low_stock=true');
  track(assertSuccess(getLowStock, 'GET /inventory-stock/stock?low_stock=true - Get low stock'));
  
  // GET /api/inventory-stock/stock with pagination
  const paginatedStock = await apiRequest(ctx, 'GET', '/inventory-stock/stock?page=1&limit=10');
  track(assertSuccess(paginatedStock, 'GET /inventory-stock/stock?page=1&limit=10 - Pagination'));
}

// ============================================
// PURCHASE ORDERS TESTS
// ============================================
async function testPurchaseOrders(ctx: TestContext): Promise<void> {
  console.log('\n📋 PURCHASE ORDERS');
  
  // First create a vendor and item for the PO
  const vendorName = `PO Vendor ${uniqueId()}`;
  const vendor = await apiRequest(ctx, 'POST', '/inventory-stock/vendors', {
    name: vendorName,
  });
  
  const itemName = `PO Item ${uniqueId()}`;
  const item = await apiRequest(ctx, 'POST', '/inventory/items', {
    name: itemName,
    item_type: 'food',
    category: 'vegetable',
    unit: 'grams',
    storage_unit: 'Kg',
    cost_per_unit: 10,
  });
  
  const vendorId = vendor.data.data?.id;
  const itemId = item.data.data?.id;
  let poId: number | null = null;
  
  // GET /api/inventory-stock/purchase-orders - List POs (always works)
  const listPOs = await apiRequest(ctx, 'GET', '/inventory-stock/purchase-orders');
  track(assertSuccess(listPOs, 'GET /inventory-stock/purchase-orders - List all'));
  
  // GET /api/inventory-stock/purchase-orders with filters
  const filterPOs = await apiRequest(ctx, 'GET', '/inventory-stock/purchase-orders?status=pending');
  track(assertSuccess(filterPOs, 'GET /inventory-stock/purchase-orders?status=pending - Filter'));
  
  if (vendorId && itemId) {
    // POST /api/inventory-stock/purchase-orders - Create PO
    const createPO = await apiRequest(ctx, 'POST', '/inventory-stock/purchase-orders', {
      vendor_id: vendorId,
      expected_date: new Date(Date.now() + 86400000).toISOString(),
      notes: 'Test purchase order',
      items: [
        { item_id: itemId, quantity: 50 },
      ],
    });
    track(assertSuccess(createPO, 'POST /inventory-stock/purchase-orders - Create'));
    
    if (createPO.data.data?.id) {
      poId = createPO.data.data.id;
      
      // GET /api/inventory-stock/purchase-orders/:id - Get single
      const getPO = await apiRequest(ctx, 'GET', `/inventory-stock/purchase-orders/${poId}`);
      track(assertSuccess(getPO, `GET /inventory-stock/purchase-orders/${poId} - Get single`));
      
      // GET /api/inventory-stock/purchase-orders/:id/activity - Get activity
      const getActivity = await apiRequest(ctx, 'GET', `/inventory-stock/purchase-orders/${poId}/activity`);
      track(assertSuccess(getActivity, `GET /inventory-stock/purchase-orders/${poId}/activity - Get activity`));
      
      // PUT /api/inventory-stock/purchase-orders/:id - Update PO
      const updatePO = await apiRequest(ctx, 'PUT', `/inventory-stock/purchase-orders/${poId}`, {
        notes: 'Updated test purchase order',
      });
      track(assertSuccess(updatePO, `PUT /inventory-stock/purchase-orders/${poId} - Update`));
      
      // PUT /api/inventory-stock/purchase-orders/:id/status - Cancel PO
      const cancelPO = await apiRequest(ctx, 'PUT', `/inventory-stock/purchase-orders/${poId}/status`, {
        status: 'cancelled',
        note: 'Cancelled for testing',
      });
      track(assertSuccess(cancelPO, `PUT /inventory-stock/purchase-orders/${poId}/status - Cancel`));
    }
    
    // Cleanup
    await apiRequest(ctx, 'DELETE', `/inventory-stock/vendors/${vendorId}`);
    await apiRequest(ctx, 'DELETE', `/inventory/items/${itemId}`);
  } else {
    console.log('  ⚠️  Skipping PO create/update tests - could not create vendor/item');
  }
}

// ============================================
// TRANSFERS TESTS
// ============================================
async function testTransfers(ctx: TestContext): Promise<void> {
  console.log('\n🔄 TRANSFERS');
  
  // GET /api/inventory-stock/transfers/destinations - Get destinations
  const getDestinations = await apiRequest(ctx, 'GET', '/inventory-stock/transfers/destinations');
  track(assertSuccess(getDestinations, 'GET /inventory-stock/transfers/destinations - Get destinations'));
  
  // GET /api/inventory-stock/transfers - List transfers
  const listTransfers = await apiRequest(ctx, 'GET', '/inventory-stock/transfers');
  track(assertSuccess(listTransfers, 'GET /inventory-stock/transfers - List all'));
  
  // GET /api/inventory-stock/transfers with filters
  const filterTransfers = await apiRequest(ctx, 'GET', '/inventory-stock/transfers?status=pending');
  track(assertSuccess(filterTransfers, 'GET /inventory-stock/transfers?status=pending - Filter'));
}

// ============================================
// INVENTORY COUNTS TESTS
// ============================================
async function testInventoryCounts(ctx: TestContext): Promise<void> {
  console.log('\n📝 INVENTORY COUNTS');
  
  // GET /api/inventory-stock/counts - List counts
  const listCounts = await apiRequest(ctx, 'GET', '/inventory-stock/counts');
  track(assertSuccess(listCounts, 'GET /inventory-stock/counts - List all'));
  
  // GET /api/inventory-stock/counts with filters
  const filterCounts = await apiRequest(ctx, 'GET', '/inventory-stock/counts?status=in_progress');
  track(assertSuccess(filterCounts, 'GET /inventory-stock/counts?status=in_progress - Filter'));
}

// ============================================
// MOVEMENTS TESTS
// ============================================
async function testMovements(ctx: TestContext): Promise<void> {
  console.log('\n📈 MOVEMENTS');
  
  // GET /api/inventory-stock/movements - Get movements
  const getMovements = await apiRequest(ctx, 'GET', '/inventory-stock/movements');
  track(assertSuccess(getMovements, 'GET /inventory-stock/movements - Get all'));
  
  // GET /api/inventory-stock/movements?limit=10 - Get limited movements
  const getLimited = await apiRequest(ctx, 'GET', '/inventory-stock/movements?limit=10');
  track(assertSuccess(getLimited, 'GET /inventory-stock/movements?limit=10 - Get limited'));
}

// ============================================
// TRANSACTION / TIMELINE TESTS
// ============================================
async function testTransactions(ctx: TestContext): Promise<void> {
  console.log('\n⏱️ TRANSACTIONS & TIMELINE');
  
  // GET /api/inventory/timeline - Get timeline
  const getTimeline = await apiRequest(ctx, 'GET', '/inventory/timeline');
  track(assertSuccess(getTimeline, 'GET /inventory/timeline - Get global timeline'));
  
  // GET /api/inventory/timeline with pagination
  const paginatedTimeline = await apiRequest(ctx, 'GET', '/inventory/timeline?page=1&limit=20');
  track(assertSuccess(paginatedTimeline, 'GET /inventory/timeline?page=1&limit=20 - Pagination'));
  
  // GET /api/inventory/timeline/stats - Get timeline stats
  const getStats = await apiRequest(ctx, 'GET', '/inventory/timeline/stats');
  track(assertSuccess(getStats, 'GET /inventory/timeline/stats - Get timeline stats'));
}

// ============================================
// PRODUCTION TESTS
// ============================================
async function testProduction(ctx: TestContext): Promise<void> {
  console.log('\n🏭 PRODUCTION');
  
  // GET /api/inventory/production - Get productions
  const getProductions = await apiRequest(ctx, 'GET', '/inventory/production');
  track(assertSuccess(getProductions, 'GET /inventory/production - Get all productions'));
  
  // GET /api/inventory/production with filters
  const filterProductions = await apiRequest(ctx, 'GET', '/inventory/production?limit=10');
  track(assertSuccess(filterProductions, 'GET /inventory/production?limit=10 - Limited'));
  
  // GET /api/inventory/production/stats - Get production stats
  const getStats = await apiRequest(ctx, 'GET', '/inventory/production/stats');
  track(assertSuccess(getStats, 'GET /inventory/production/stats - Get stats'));
  
  // GET /api/inventory/production/templates - Get templates
  const getTemplates = await apiRequest(ctx, 'GET', '/inventory/production/templates');
  track(assertSuccess(getTemplates, 'GET /inventory/production/templates - Get all templates'));
}

// ============================================
// PO TEMPLATES TESTS
// ============================================
async function testPOTemplates(ctx: TestContext): Promise<void> {
  console.log('\n📄 PO TEMPLATES');
  
  // GET /api/inventory-stock/po-templates - List templates
  const listTemplates = await apiRequest(ctx, 'GET', '/inventory-stock/po-templates');
  track(assertSuccess(listTemplates, 'GET /inventory-stock/po-templates - List all'));
  
  // GET /api/inventory-stock/po-templates with filters
  const filterTemplates = await apiRequest(ctx, 'GET', '/inventory-stock/po-templates?is_active=true');
  track(assertSuccess(filterTemplates, 'GET /inventory-stock/po-templates?is_active=true - Filter'));
}

// ============================================
// BARCODE TESTS
// ============================================
async function testBarcodes(ctx: TestContext): Promise<void> {
  console.log('\n🔖 BARCODES');
  
  // Create a test item
  const itemName = `Barcode Item ${uniqueId()}`;
  const item = await apiRequest(ctx, 'POST', '/inventory/items', {
    name: itemName,
    item_type: 'food',
    category: 'vegetable',
    unit: 'piece',
    storage_unit: 'piece',
    cost_per_unit: 1.00,
  });
  
  const itemId = item.data.data?.id;
  
  if (itemId) {
    const testBarcode = `BC${Date.now()}`;
    
    // POST /api/inventory-stock/items/:id/barcode - Associate barcode
    const setBarcode = await apiRequest(ctx, 'POST', `/inventory-stock/items/${itemId}/barcode`, {
      barcode: testBarcode,
    });
    track(assertSuccess(setBarcode, `POST /inventory-stock/items/${itemId}/barcode - Set barcode`));
    
    // GET /api/inventory-stock/items/:id/barcode - Get item barcode
    const getBarcode = await apiRequest(ctx, 'GET', `/inventory-stock/items/${itemId}/barcode`);
    track(assertSuccess(getBarcode, `GET /inventory-stock/items/${itemId}/barcode - Get barcode`));
    
    // GET /api/inventory-stock/items/barcode/:barcode - Lookup by barcode
    const lookupBarcode = await apiRequest(ctx, 'GET', `/inventory-stock/items/barcode/${testBarcode}`);
    track(assertSuccess(lookupBarcode, `GET /inventory-stock/items/barcode/${testBarcode} - Lookup`));
    
    // Cleanup
    await apiRequest(ctx, 'DELETE', `/inventory/items/${itemId}`);
  } else {
    console.log('  ⚠️  Skipping barcode tests - could not create item');
  }
}

// ============================================
// PRODUCT ENDPOINTS TESTS
// ============================================
async function testProductEndpoints(ctx: TestContext): Promise<void> {
  console.log('\n🍔 PRODUCT ENDPOINTS');
  
  // GET /api/inventory/products/stats - Get product stats
  const getStats = await apiRequest(ctx, 'GET', '/inventory/products/stats');
  track(assertSuccess(getStats, 'GET /inventory/products/stats - Get product stats'));
}

// ============================================
// CANCELLED ORDERS → INVENTORY RETURN TESTS
// ============================================
async function testCancelledOrderInventory(ctx: TestContext): Promise<void> {
  console.log('\n🚫 CANCELLED ORDERS → INVENTORY');
  
  // GET /api/pos/kitchen/cancelled-items - Get pending cancelled items
  const getCancelledItems = await apiRequest(ctx, 'GET', '/pos/kitchen/cancelled-items');
  track(assertSuccess(getCancelledItems, 'GET /pos/kitchen/cancelled-items - Get pending items'));
  
  // GET /api/pos/kitchen/cancelled-stats - Get cancelled items statistics
  const getCancelledStats = await apiRequest(ctx, 'GET', '/pos/kitchen/cancelled-stats');
  track(assertSuccess(getCancelledStats, 'GET /pos/kitchen/cancelled-stats - Get statistics'));
  
  // Note: POST /pos/kitchen/process-waste requires actual cancelled_item_ids
  // We test the validation without actual data
  const processWasteEmpty = await apiRequest(ctx, 'POST', '/pos/kitchen/process-waste', {
    decisions: [],
  });
  track(assertStatus(processWasteEmpty, 400, 'POST /pos/kitchen/process-waste - Validation (empty array)'));
  
  // Test invalid decision type
  const processWasteInvalid = await apiRequest(ctx, 'POST', '/pos/kitchen/process-waste', {
    decisions: [{ cancelled_item_id: -1, decision: 'invalid' }],
  });
  track(assertStatus(processWasteInvalid, 400, 'POST /pos/kitchen/process-waste - Validation (invalid decision)'));
}

// ============================================
// POS ORDERS (INVENTORY RELATED) TESTS
// ============================================
async function testPOSInventoryFlow(ctx: TestContext): Promise<void> {
  console.log('\n🛒 POS ORDERS (Inventory Flow)');
  
  // GET /api/pos/product-availability - Get product inventory availability
  const getAvailability = await apiRequest(ctx, 'GET', '/pos/product-availability');
  track(assertSuccess(getAvailability, 'GET /pos/product-availability - Get product availability'));
  
  // GET /api/pos/orders - List orders (inventory was deducted)
  const listOrders = await apiRequest(ctx, 'GET', '/pos/orders?limit=5');
  track(assertSuccess(listOrders, 'GET /pos/orders - List recent orders'));
  
  // GET /api/pos/stats - Get order/revenue stats
  const getStats = await apiRequest(ctx, 'GET', '/pos/stats');
  track(assertSuccess(getStats, 'GET /pos/stats - Get order statistics'));
  
  // GET /api/pos/kitchen/orders - Kitchen display orders
  const getKitchenOrders = await apiRequest(ctx, 'GET', '/pos/kitchen/orders');
  track(assertSuccess(getKitchenOrders, 'GET /pos/kitchen/orders - Kitchen display orders'));
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 INVENTORY API TEST SUITE');
  console.log('='.repeat(60));
  
  try {
    // Authenticate first
    console.log('\n🔐 Authenticating...');
    const ctx = await authenticate();
    
    // Run all test groups
    await testInventoryItems(ctx);
    await testCompositeItems(ctx);
    await testVendors(ctx);
    await testStockLevels(ctx);
    await testPurchaseOrders(ctx);
    await testTransfers(ctx);
    await testInventoryCounts(ctx);
    await testMovements(ctx);
    await testTransactions(ctx);
    await testProduction(ctx);
    await testPOTemplates(ctx);
    await testBarcodes(ctx);
    await testProductEndpoints(ctx);
    await testCancelledOrderInventory(ctx);
    await testPOSInventoryFlow(ctx);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${passed + failed}`);
    console.log(`🎯 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
    
    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();

