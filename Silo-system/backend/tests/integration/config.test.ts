/**
 * CONFIG API TEST SUITE
 * Tests system configuration endpoints (no auth required)
 * 
 * Run with: npm run test:config
 */

import { testConfig } from './test.config';

let passed = 0;
let failed = 0;

function track(success: boolean): void {
  if (success) passed++;
  else failed++;
}

// Simple request helper for unauthenticated endpoints
async function getRequest(path: string): Promise<{ status: number; data: any }> {
  const url = `${testConfig.baseUrl}${path}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await response.json();
    return { status: response.status, data };
  } catch (error: any) {
    console.error(`    ❌ Request failed: ${error.message}`);
    return { status: 0, data: { error: error.message } };
  }
}

function assertSuccess(result: { status: number; data: any }, name: string): boolean {
  const success = result.status >= 200 && result.status < 300;
  console.log(`  ${success ? '✅' : '❌'} ${name}`);
  if (!success) {
    console.log(`      Status: ${result.status}, Error: ${result.data?.error || 'Unknown'}`);
  }
  return success;
}

// ============================================
// SYSTEM CONFIG TESTS
// ============================================
async function testSystemConfig(): Promise<void> {
  console.log('\n⚙️ SYSTEM CONFIG');
  
  // GET /api/config/system - Get system configuration
  const getSystem = await getRequest('/config/system');
  track(assertSuccess(getSystem, 'GET /config/system - Get system config'));
}

// ============================================
// ITEM CONFIG TESTS
// ============================================
async function testItemConfig(): Promise<void> {
  console.log('\n📦 ITEM CONFIG');
  
  // GET /api/config/item-types - Get item types
  const getItemTypes = await getRequest('/config/item-types');
  track(assertSuccess(getItemTypes, 'GET /config/item-types - Get item types'));
  
  // GET /api/config/item-categories - Get item categories
  const getCategories = await getRequest('/config/item-categories');
  track(assertSuccess(getCategories, 'GET /config/item-categories - Get item categories'));
  
  // GET /api/config/units - Get units
  const getUnits = await getRequest('/config/units');
  track(assertSuccess(getUnits, 'GET /config/units - Get units'));
  
  // GET /api/config/units/compatible - Get compatible units
  const getCompatible = await getRequest('/config/units/compatible?serving_unit=grams');
  track(assertSuccess(getCompatible, 'GET /config/units/compatible?serving_unit=grams - Get compatible units'));
  
  // GET /api/config/accessory-order-types - Get accessory order types
  const getAccessoryTypes = await getRequest('/config/accessory-order-types');
  track(assertSuccess(getAccessoryTypes, 'GET /config/accessory-order-types - Get types'));
  
  // GET /api/config/production-rates - Get production rates
  const getProductionRates = await getRequest('/config/production-rates');
  track(assertSuccess(getProductionRates, 'GET /config/production-rates - Get production rates'));
}

// ============================================
// CURRENCY CONFIG TESTS
// ============================================
async function testCurrencyConfig(): Promise<void> {
  console.log('\n💰 CURRENCY CONFIG');
  
  // GET /api/config/currencies - Get all currencies
  const getCurrencies = await getRequest('/config/currencies');
  track(assertSuccess(getCurrencies, 'GET /config/currencies - Get all currencies'));
  
  // GET /api/config/currencies/:code - Get specific currency
  const getSAR = await getRequest('/config/currencies/SAR');
  track(assertSuccess(getSAR, 'GET /config/currencies/SAR - Get SAR currency'));
  
  const getUSD = await getRequest('/config/currencies/USD');
  track(assertSuccess(getUSD, 'GET /config/currencies/USD - Get USD currency'));
}

// ============================================
// ROLES & ORDER CONFIG TESTS
// ============================================
async function testRolesAndOrderConfig(): Promise<void> {
  console.log('\n👥 ROLES & ORDER CONFIG');
  
  // GET /api/config/roles - Get roles
  const getRoles = await getRequest('/config/roles');
  track(assertSuccess(getRoles, 'GET /config/roles - Get roles'));
  
  // GET /api/config/order-statuses - Get order statuses
  const getStatuses = await getRequest('/config/order-statuses');
  track(assertSuccess(getStatuses, 'GET /config/order-statuses - Get order statuses'));
  
  // GET /api/config/payment-methods - Get payment methods
  const getPayments = await getRequest('/config/payment-methods');
  track(assertSuccess(getPayments, 'GET /config/payment-methods - Get payment methods'));
  
  // GET /api/config/order-types - Get order types
  const getOrderTypes = await getRequest('/config/order-types');
  track(assertSuccess(getOrderTypes, 'GET /config/order-types - Get order types'));
  
  // GET /api/config/discount-types - Get discount types
  const getDiscountTypes = await getRequest('/config/discount-types');
  track(assertSuccess(getDiscountTypes, 'GET /config/discount-types - Get discount types'));
}

// ============================================
// RESTAURANT CONFIG TESTS
// ============================================
async function testRestaurantConfig(): Promise<void> {
  console.log('\n🍽️ RESTAURANT CONFIG');
  
  // GET /api/config/restaurant-types - Get restaurant types
  const getRestaurantTypes = await getRequest('/config/restaurant-types');
  track(assertSuccess(getRestaurantTypes, 'GET /config/restaurant-types - Get restaurant types'));
}

// ============================================
// HEALTH CHECK TEST
// ============================================
async function testHealthCheck(): Promise<void> {
  console.log('\n❤️ HEALTH CHECK');
  
  // GET /api/health - Health check
  const health = await getRequest('/health');
  track(assertSuccess(health, 'GET /health - Health check'));
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 CONFIG API TEST SUITE');
  console.log('='.repeat(60));
  console.log('\nℹ️  Note: Config endpoints do not require authentication');
  
  try {
    // Run test groups
    await testHealthCheck();
    await testSystemConfig();
    await testItemConfig();
    await testCurrencyConfig();
    await testRolesAndOrderConfig();
    await testRestaurantConfig();
    
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

