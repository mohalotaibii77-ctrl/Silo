/**
 * DELIVERY API TEST SUITE
 * Tests delivery-related API endpoints:
 * - Delivery Partners
 * - Drivers (in-house delivery)
 * - Customers
 * - Restaurant Tables
 * 
 * Run with: npm run test:delivery
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
// DELIVERY PARTNERS TESTS
// ============================================
async function testDeliveryPartners(ctx: TestContext): Promise<{ partnerId: number | null }> {
  console.log('\n🚚 DELIVERY PARTNERS');
  
  let partnerId: number | null = null;
  
  // GET /api/delivery/partners - List delivery partners
  const listPartners = await apiRequest(ctx, 'GET', '/delivery/partners');
  track(assertSuccess(listPartners, 'GET /delivery/partners - List partners'));
  
  // GET /api/delivery/partners with filters
  const activePartners = await apiRequest(ctx, 'GET', '/delivery/partners?status=active');
  track(assertSuccess(activePartners, 'GET /delivery/partners?status=active - Filter active'));
  
  // Note: Creating delivery partners requires a branch_id
  // We'll test validation instead
  const missingBranch = await apiRequest(ctx, 'POST', '/delivery/partners', {
    name: 'Test Partner',
    commission_type: 'percentage',
    commission_value: 15,
    // Missing branch_id
  });
  track(assertStatus(missingBranch, 400, 'POST /delivery/partners - Validation (missing branch)'));
  
  const missingFields = await apiRequest(ctx, 'POST', '/delivery/partners', {
    name: 'Test Partner',
    // Missing commission fields
  });
  track(assertStatus(missingFields, 400, 'POST /delivery/partners - Validation (missing commission)'));
  
  // GET /api/delivery/partners/:id - Not found
  const notFound = await apiRequest(ctx, 'GET', '/delivery/partners/999999');
  track(assertStatus(notFound, 404, 'GET /delivery/partners/999999 - Not found'));
  
  return { partnerId };
}

// ============================================
// DRIVERS TESTS
// ============================================
async function testDrivers(ctx: TestContext): Promise<{ driverId: number | null }> {
  console.log('\n🏍️ DRIVERS');
  
  let driverId: number | null = null;
  
  // GET /api/drivers - List drivers
  const listDrivers = await apiRequest(ctx, 'GET', '/drivers');
  track(assertSuccess(listDrivers, 'GET /drivers - List drivers'));
  
  // GET /api/drivers with filters
  const activeDrivers = await apiRequest(ctx, 'GET', '/drivers?is_active=true');
  track(assertSuccess(activeDrivers, 'GET /drivers?is_active=true - Filter active'));
  
  // GET /api/drivers/available - Get available drivers
  const availableDrivers = await apiRequest(ctx, 'GET', '/drivers/available');
  track(assertSuccess(availableDrivers, 'GET /drivers/available - Get available'));
  
  // POST /api/drivers - Create driver
  const driverName = `Test Driver ${uniqueId()}`;
  const createDriver = await apiRequest(ctx, 'POST', '/drivers', {
    name: driverName,
    name_ar: 'سائق اختبار',
    phone: '+966500000000',
    vehicle_type: 'motorcycle',
    vehicle_number: 'ABC123',
  });
  track(assertSuccess(createDriver, 'POST /drivers - Create driver'));
  
  if (createDriver.data.data?.id) {
    driverId = createDriver.data.data.id;
    
    // GET /api/drivers/:id - Get single driver
    const getDriver = await apiRequest(ctx, 'GET', `/drivers/${driverId}`);
    track(assertSuccess(getDriver, `GET /drivers/${driverId} - Get single driver`));
    
    // PUT /api/drivers/:id - Update driver
    const updateDriver = await apiRequest(ctx, 'PUT', `/drivers/${driverId}`, {
      name: `Updated ${driverName}`,
      vehicle_number: 'XYZ789',
    });
    track(assertSuccess(updateDriver, `PUT /drivers/${driverId} - Update driver`));
    
    // PUT /api/drivers/:id/status - Update driver status
    const updateStatus = await apiRequest(ctx, 'PUT', `/drivers/${driverId}/status`, {
      status: 'busy',
    });
    track(assertSuccess(updateStatus, `PUT /drivers/${driverId}/status - Set busy`));
    
    const setAvailable = await apiRequest(ctx, 'PUT', `/drivers/${driverId}/status`, {
      status: 'available',
    });
    track(assertSuccess(setAvailable, `PUT /drivers/${driverId}/status - Set available`));
  }
  
  // Validation tests
  const missingName = await apiRequest(ctx, 'POST', '/drivers', {
    phone: '+966500000000',
  });
  track(assertStatus(missingName, 400, 'POST /drivers - Validation (missing name)'));
  
  // Invalid status
  if (driverId) {
    const invalidStatus = await apiRequest(ctx, 'PUT', `/drivers/${driverId}/status`, {
      status: 'invalid_status',
    });
    track(assertStatus(invalidStatus, 400, `PUT /drivers/${driverId}/status - Validation (invalid)`));
  }
  
  // Not found
  const notFound = await apiRequest(ctx, 'GET', '/drivers/999999');
  track(assertStatus(notFound, 404, 'GET /drivers/999999 - Not found'));
  
  return { driverId };
}

// ============================================
// CUSTOMERS TESTS
// ============================================
async function testCustomers(ctx: TestContext): Promise<{ customerId: number | null }> {
  console.log('\n👤 CUSTOMERS');
  
  let customerId: number | null = null;
  
  // GET /api/customers - List customers
  const listCustomers = await apiRequest(ctx, 'GET', '/customers');
  track(assertSuccess(listCustomers, 'GET /customers - List customers'));
  
  // GET /api/customers with filters
  const activeCustomers = await apiRequest(ctx, 'GET', '/customers?is_active=true');
  track(assertSuccess(activeCustomers, 'GET /customers?is_active=true - Filter active'));
  
  // POST /api/customers - Create customer
  const customerName = `Test Customer ${uniqueId()}`;
  const customerPhone = `+9665${Date.now().toString().slice(-8)}`;
  const createCustomer = await apiRequest(ctx, 'POST', '/customers', {
    name: customerName,
    name_ar: 'عميل اختبار',
    phone: customerPhone,
    email: `customer_${uniqueId()}@test.com`,
    address: '123 Test Street',
    notes: 'Test customer',
  });
  track(assertSuccess(createCustomer, 'POST /customers - Create customer'));
  
  if (createCustomer.data.data?.id) {
    customerId = createCustomer.data.data.id;
    
    // GET /api/customers/:id - Get single customer
    const getCustomer = await apiRequest(ctx, 'GET', `/customers/${customerId}`);
    track(assertSuccess(getCustomer, `GET /customers/${customerId} - Get single customer`));
    
    // PUT /api/customers/:id - Update customer
    const updateCustomer = await apiRequest(ctx, 'PUT', `/customers/${customerId}`, {
      name: `Updated ${customerName}`,
      notes: 'Updated notes',
    });
    track(assertSuccess(updateCustomer, `PUT /customers/${customerId} - Update customer`));
    
    // GET /api/customers/search - Search by phone
    const searchByPhone = await apiRequest(ctx, 'GET', `/customers/search?q=${customerPhone.slice(-4)}`);
    track(assertSuccess(searchByPhone, `GET /customers/search - Search by phone`));
    
    // GET /api/customers/search - Search by name
    const searchByName = await apiRequest(ctx, 'GET', `/customers/search?q=${customerName.split(' ')[0]}`);
    track(assertSuccess(searchByName, `GET /customers/search - Search by name`));
  }
  
  // Validation tests
  const missingInfo = await apiRequest(ctx, 'POST', '/customers', {});
  track(assertStatus(missingInfo, 400, 'POST /customers - Validation (missing name/phone)'));
  
  // Search validation
  const searchNoQuery = await apiRequest(ctx, 'GET', '/customers/search');
  track(assertStatus(searchNoQuery, 400, 'GET /customers/search - Validation (missing query)'));
  
  // Not found
  const notFound = await apiRequest(ctx, 'GET', '/customers/999999');
  track(assertStatus(notFound, 404, 'GET /customers/999999 - Not found'));
  
  return { customerId };
}

// ============================================
// TABLES TESTS
// ============================================
async function testTables(ctx: TestContext): Promise<{ tableId: number | null }> {
  console.log('\n🪑 RESTAURANT TABLES');
  
  let tableId: number | null = null;
  
  // GET /api/tables - List tables
  const listTables = await apiRequest(ctx, 'GET', '/tables');
  track(assertSuccess(listTables, 'GET /tables - List tables'));
  
  // GET /api/tables with filters
  const activeTables = await apiRequest(ctx, 'GET', '/tables?is_active=true');
  track(assertSuccess(activeTables, 'GET /tables?is_active=true - Filter active'));
  
  const availableTables = await apiRequest(ctx, 'GET', '/tables/available');
  track(assertSuccess(availableTables, 'GET /tables/available - Get available tables'));
  
  // POST /api/tables - Create table
  const tableNumber = `T${Date.now().toString().slice(-4)}`;
  const createTable = await apiRequest(ctx, 'POST', '/tables', {
    table_number: tableNumber,
    table_code: `CODE${uniqueId()}`,
    seats: 4,
    zone: 'indoor',
    description: 'Test table',
  });
  track(assertSuccess(createTable, 'POST /tables - Create table'));
  
  if (createTable.data.data?.id) {
    tableId = createTable.data.data.id;
    
    // GET /api/tables/:id - Get single table
    const getTable = await apiRequest(ctx, 'GET', `/tables/${tableId}`);
    track(assertSuccess(getTable, `GET /tables/${tableId} - Get single table`));
    
    // PUT /api/tables/:id - Update table
    const updateTable = await apiRequest(ctx, 'PUT', `/tables/${tableId}`, {
      seats: 6,
      zone: 'outdoor',
    });
    track(assertSuccess(updateTable, `PUT /tables/${tableId} - Update table`));
    
    // POST /api/tables/:id/occupy - Occupy table
    const occupyTable = await apiRequest(ctx, 'POST', `/tables/${tableId}/occupy`, {});
    track(assertSuccess(occupyTable, `POST /tables/${tableId}/occupy - Occupy table`));
    
    // POST /api/tables/:id/release - Release table
    const releaseTable = await apiRequest(ctx, 'POST', `/tables/${tableId}/release`, {});
    track(assertSuccess(releaseTable, `POST /tables/${tableId}/release - Release table`));
  }
  
  // Validation tests
  const missingNumber = await apiRequest(ctx, 'POST', '/tables', {
    seats: 4,
  });
  track(assertStatus(missingNumber, 400, 'POST /tables - Validation (missing table_number)'));
  
  const invalidSeats = await apiRequest(ctx, 'POST', '/tables', {
    table_number: `T${uniqueId()}`,
    seats: 0,
  });
  track(assertStatus(invalidSeats, 400, 'POST /tables - Validation (invalid seats)'));
  
  // Not found
  const notFound = await apiRequest(ctx, 'GET', '/tables/999999');
  track(assertStatus(notFound, 404, 'GET /tables/999999 - Not found'));
  
  return { tableId };
}

// ============================================
// CLEANUP TESTS
// ============================================
async function cleanupTestData(
  ctx: TestContext,
  driverId: number | null,
  customerId: number | null,
  tableId: number | null
): Promise<void> {
  console.log('\n🧹 CLEANUP');
  
  if (driverId) {
    const deleteDriver = await apiRequest(ctx, 'DELETE', `/drivers/${driverId}`);
    track(assertSuccess(deleteDriver, `DELETE /drivers/${driverId} - Delete driver`));
  }
  
  if (customerId) {
    const deleteCustomer = await apiRequest(ctx, 'DELETE', `/customers/${customerId}`);
    track(assertSuccess(deleteCustomer, `DELETE /customers/${customerId} - Delete customer`));
  }
  
  if (tableId) {
    const deleteTable = await apiRequest(ctx, 'DELETE', `/tables/${tableId}`);
    track(assertSuccess(deleteTable, `DELETE /tables/${tableId} - Delete table`));
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 DELIVERY API TEST SUITE');
  console.log('='.repeat(60));
  
  try {
    console.log('\n🔐 Authenticating...');
    const ctx = await authenticate();
    
    // Track IDs for cleanup
    let driverId: number | null = null;
    let customerId: number | null = null;
    let tableId: number | null = null;
    
    // Run test groups
    await testDeliveryPartners(ctx);
    
    const driverResult = await testDrivers(ctx);
    driverId = driverResult.driverId;
    
    const customerResult = await testCustomers(ctx);
    customerId = customerResult.customerId;
    
    const tableResult = await testTables(ctx);
    tableId = tableResult.tableId;
    
    // Cleanup
    await cleanupTestData(ctx, driverId, customerId, tableId);
    
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


