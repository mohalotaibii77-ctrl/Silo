/**
 * BUSINESS API TEST SUITE
 * Tests business settings, localization, receipt settings, and analytics
 * 
 * Run with: npm run test:business
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
// BUSINESS SETTINGS TESTS
// ============================================
async function testBusinessSettings(ctx: TestContext): Promise<void> {
  console.log('\n⚙️ BUSINESS SETTINGS');
  
  // GET /api/business-settings - Get business settings
  const getSettings = await apiRequest(ctx, 'GET', '/business-settings');
  track(assertSuccess(getSettings, 'GET /business-settings - Get settings'));
  
  // PUT /api/business-settings - Update settings
  const updateSettings = await apiRequest(ctx, 'PUT', '/business-settings', {
    vat_enabled: true,
    tax_rate: 15,
  });
  track(assertSuccess(updateSettings, 'PUT /business-settings - Update VAT settings'));
}

// ============================================
// LOCALIZATION SETTINGS TESTS
// ============================================
async function testLocalizationSettings(ctx: TestContext): Promise<void> {
  console.log('\n🌍 LOCALIZATION SETTINGS');
  
  // GET /api/business-settings/localization - Get localization
  const getLocalization = await apiRequest(ctx, 'GET', '/business-settings/localization');
  track(assertSuccess(getLocalization, 'GET /business-settings/localization - Get localization'));
  
  // Store original values for restoration
  const original = getLocalization.data.data || {};
  
  // PUT /api/business-settings/localization - Update localization
  const updateLocalization = await apiRequest(ctx, 'PUT', '/business-settings/localization', {
    language: 'en',
    currency: 'SAR',
    timezone: 'Asia/Riyadh',
  });
  track(assertSuccess(updateLocalization, 'PUT /business-settings/localization - Update'));
}

// ============================================
// CURRENCY VALIDATION TESTS
// ============================================
async function testCurrencyValidation(ctx: TestContext): Promise<void> {
  console.log('\n💱 CURRENCY VALIDATION');
  
  // Verify business settings endpoint returns currency (no fallback)
  const settings = await apiRequest(ctx, 'GET', '/business-settings');
  track(assertSuccess(settings, 'GET /business-settings - Returns currency'));
  
  if (settings.success && settings.data.data) {
    const hasCurrency = !!settings.data.data.currency;
    track(hasCurrency 
      ? (console.log('  ✅ GET /business-settings - Currency exists (no fallback)'), true)
      : (console.log('  ❌ GET /business-settings - Currency missing (should not happen)'), false)
    );
  }
  
  // Verify localization endpoint returns currency (no fallback)
  const localization = await apiRequest(ctx, 'GET', '/business-settings/localization');
  track(assertSuccess(localization, 'GET /business-settings/localization - Returns currency'));
  
  if (localization.success && localization.data.data) {
    const hasCurrency = !!localization.data.data.currency;
    track(hasCurrency 
      ? (console.log('  ✅ GET /business-settings/localization - Currency exists (no fallback)'), true)
      : (console.log('  ❌ GET /business-settings/localization - Currency missing (should not happen)'), false)
    );
  }
  
  // Note: Cannot test business creation without currency here as this test suite
  // uses an existing business. See superadmin.test.ts for creation validation tests.
}

// ============================================
// USER SETTINGS TESTS
// ============================================
async function testUserSettings(ctx: TestContext): Promise<void> {
  console.log('\n👤 USER SETTINGS');
  
  // GET /api/business-settings/user-settings - Get user settings
  const getUserSettings = await apiRequest(ctx, 'GET', '/business-settings/user-settings');
  track(assertSuccess(getUserSettings, 'GET /business-settings/user-settings - Get settings'));
  
  // PUT /api/business-settings/user-settings - Update user settings
  const updateUserSettings = await apiRequest(ctx, 'PUT', '/business-settings/user-settings', {
    preferred_language: 'en',
    preferred_theme: 'dark',
    settings: {
      notifications_enabled: true,
      sound_enabled: false,
    },
  });
  track(assertSuccess(updateUserSettings, 'PUT /business-settings/user-settings - Update'));
  
  // Reset to system theme
  const resetTheme = await apiRequest(ctx, 'PUT', '/business-settings/user-settings', {
    preferred_theme: 'system',
  });
  track(assertSuccess(resetTheme, 'PUT /business-settings/user-settings - Reset theme'));
}

// ============================================
// RECEIPT SETTINGS TESTS
// ============================================
async function testReceiptSettings(ctx: TestContext): Promise<void> {
  console.log('\n🧾 RECEIPT SETTINGS');
  
  // GET /api/business-settings/receipt - Get receipt settings
  const getReceipt = await apiRequest(ctx, 'GET', '/business-settings/receipt');
  track(assertSuccess(getReceipt, 'GET /business-settings/receipt - Get settings'));
  
  // PUT /api/business-settings/receipt - Update receipt settings
  const updateReceipt = await apiRequest(ctx, 'PUT', '/business-settings/receipt', {
    print_languages: ['en', 'ar'],
    main_language: 'en',
    receipt_header: 'Thank you for your order!',
    receipt_footer: 'Please visit us again',
    show_order_number: true,
    show_subtotal: true,
    show_closer_username: false,
    show_creator_username: true,
  });
  track(assertSuccess(updateReceipt, 'PUT /business-settings/receipt - Update'));
}

// ============================================
// OPERATIONAL SETTINGS TESTS
// ============================================
async function testOperationalSettings(ctx: TestContext): Promise<void> {
  console.log('\n⚙️ OPERATIONAL SETTINGS');
  
  // GET /api/business-settings/operational - Get operational settings
  const getOperational = await apiRequest(ctx, 'GET', '/business-settings/operational');
  track(assertSuccess(getOperational, 'GET /business-settings/operational - Get settings'));
  
  // PUT /api/business-settings/operational - Update operational settings
  const updateOperational = await apiRequest(ctx, 'PUT', '/business-settings/operational', {
    order_number_prefix: 'TEST',
    auto_accept_orders: true,
    order_preparation_time: 20,
    enable_order_notifications: true,
    kitchen_display_auto_clear: 45,
    require_customer_phone: true,
    allow_order_notes: true,
    opening_time: '08:00',
    closing_time: '23:00',
    // POS Operation settings
    pos_opening_float_fixed: true,
    pos_opening_float_amount: 100.00,
    pos_session_allowed_user_ids: [],
  });
  track(assertSuccess(updateOperational, 'PUT /business-settings/operational - Update all fields'));
  
  // PUT /api/business-settings/operational - Partial update
  const partialUpdate = await apiRequest(ctx, 'PUT', '/business-settings/operational', {
    auto_accept_orders: false,
    order_number_prefix: 'ORD',
  });
  track(assertSuccess(partialUpdate, 'PUT /business-settings/operational - Partial update'));
  
  // Reset to defaults
  const resetDefaults = await apiRequest(ctx, 'PUT', '/business-settings/operational', {
    order_number_prefix: 'ORD',
    auto_accept_orders: false,
    order_preparation_time: 15,
    enable_order_notifications: true,
    kitchen_display_auto_clear: 30,
    require_customer_phone: false,
    allow_order_notes: true,
    opening_time: '09:00',
    closing_time: '22:00',
    // POS Operation settings - reset to defaults
    pos_opening_float_fixed: false,
    pos_opening_float_amount: 0,
    pos_session_allowed_user_ids: [],
  });
  track(assertSuccess(resetDefaults, 'PUT /business-settings/operational - Reset to defaults'));
  
  // PUT /api/business-settings/operational - Update POS settings with restricted users
  const updatePOSSettings = await apiRequest(ctx, 'PUT', '/business-settings/operational', {
    pos_opening_float_fixed: true,
    pos_opening_float_amount: 200.50,
    pos_session_allowed_user_ids: [1, 2],
  });
  track(assertSuccess(updatePOSSettings, 'PUT /business-settings/operational - Update POS settings'));
}

// ============================================
// CHANGE REQUESTS TESTS
// ============================================
async function testChangeRequests(ctx: TestContext): Promise<void> {
  console.log('\n📝 CHANGE REQUESTS');
  
  // GET /api/business-settings/change-requests - List change requests
  const getRequests = await apiRequest(ctx, 'GET', '/business-settings/change-requests');
  track(assertSuccess(getRequests, 'GET /business-settings/change-requests - List requests'));
  
  // POST /api/business-settings/change-requests - Submit change request
  const submitRequest = await apiRequest(ctx, 'POST', '/business-settings/change-requests', {
    request_type: 'profile',
    new_name: 'Test Business Name',
    new_email: 'test@example.com',
    requester_notes: 'Test change request',
  });
  // This might fail if there's already a pending request, which is fine
  if (submitRequest.status === 201) {
    track(assertSuccess(submitRequest, 'POST /business-settings/change-requests - Submit request'));
  } else if (submitRequest.status === 400) {
    track(assertStatus(submitRequest, 400, 'POST /business-settings/change-requests - Pending request exists'));
  } else {
    track(assertSuccess(submitRequest, 'POST /business-settings/change-requests - Submit request'));
  }
}

// ============================================
// ANALYTICS TESTS
// ============================================
async function testAnalytics(ctx: TestContext): Promise<void> {
  console.log('\n📊 ANALYTICS');
  
  // GET /api/analytics/dashboard - Get dashboard stats
  const getDashboard = await apiRequest(ctx, 'GET', '/analytics/dashboard');
  track(assertSuccess(getDashboard, 'GET /analytics/dashboard - Get dashboard stats'));
  
  // GET /api/analytics/dashboard with period
  const getWeekly = await apiRequest(ctx, 'GET', '/analytics/dashboard?period=week');
  track(assertSuccess(getWeekly, 'GET /analytics/dashboard?period=week - Weekly stats'));
  
  const getMonthly = await apiRequest(ctx, 'GET', '/analytics/dashboard?period=month');
  track(assertSuccess(getMonthly, 'GET /analytics/dashboard?period=month - Monthly stats'));
  
  // GET /api/analytics/low-stock - Get low stock items
  const getLowStock = await apiRequest(ctx, 'GET', '/analytics/low-stock');
  track(assertSuccess(getLowStock, 'GET /analytics/low-stock - Get low stock items'));
  
  // GET /api/analytics/low-stock with limit
  const getLowStockLimited = await apiRequest(ctx, 'GET', '/analytics/low-stock?limit=5');
  track(assertSuccess(getLowStockLimited, 'GET /analytics/low-stock?limit=5 - Limited'));
}

// ============================================
// IMAGES API TESTS
// ============================================
async function testImagesAPI(ctx: TestContext): Promise<void> {
  console.log('\n🖼️ IMAGES API');
  
  // GET /api/images/transform - Transform image URL (no auth required but we test with auth)
  const testImageUrl = 'https://example.supabase.co/storage/v1/object/public/images/test.jpg';
  const transformThumb = await apiRequest(ctx, 'GET', `/images/transform?url=${encodeURIComponent(testImageUrl)}&size=thumb`);
  track(assertSuccess(transformThumb, 'GET /images/transform?size=thumb - Transform to thumbnail'));
  
  const transformMedium = await apiRequest(ctx, 'GET', `/images/transform?url=${encodeURIComponent(testImageUrl)}&size=medium`);
  track(assertSuccess(transformMedium, 'GET /images/transform?size=medium - Transform to medium'));
  
  // Validation: missing URL
  const missingUrl = await apiRequest(ctx, 'GET', '/images/transform');
  track(assertStatus(missingUrl, 400, 'GET /images/transform - Validation (missing URL)'));
  
  // Validation: invalid size
  const invalidSize = await apiRequest(ctx, 'GET', `/images/transform?url=${encodeURIComponent(testImageUrl)}&size=invalid`);
  track(assertStatus(invalidSize, 400, 'GET /images/transform - Validation (invalid size)'));
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 BUSINESS API TEST SUITE');
  console.log('='.repeat(60));
  
  try {
    console.log('\n🔐 Authenticating...');
    const ctx = await authenticate();
    
    // Run test groups
    await testBusinessSettings(ctx);
    await testLocalizationSettings(ctx);
    await testCurrencyValidation(ctx);
    await testUserSettings(ctx);
    await testReceiptSettings(ctx);
    await testOperationalSettings(ctx);
    await testChangeRequests(ctx);
    await testAnalytics(ctx);
    await testImagesAPI(ctx);
    
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

