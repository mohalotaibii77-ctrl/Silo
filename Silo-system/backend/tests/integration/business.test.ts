/**
 * BUSINESS API TEST SUITE
 * Tests business settings, localization, receipt settings, and analytics
 *
 * IMPORTANT: This test saves all original settings before testing and restores
 * them after. Business settings should never be permanently changed by tests.
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
// ORIGINAL SETTINGS STORAGE
// ============================================
interface OriginalSettings {
  businessSettings: any;
  localization: any;
  userSettings: any;
  receiptSettings: any;
  operationalSettings: any;
}

async function saveOriginalSettings(ctx: TestContext): Promise<OriginalSettings> {
  console.log('\n💾 Saving original settings...');

  const [businessSettings, localization, userSettings, receiptSettings, operationalSettings] = await Promise.all([
    apiRequest(ctx, 'GET', '/business-settings'),
    apiRequest(ctx, 'GET', '/business-settings/localization'),
    apiRequest(ctx, 'GET', '/business-settings/user-settings'),
    apiRequest(ctx, 'GET', '/business-settings/receipt'),
    apiRequest(ctx, 'GET', '/business-settings/operational'),
  ]);

  return {
    businessSettings: businessSettings.data?.data || {},
    localization: localization.data?.data || {},
    userSettings: userSettings.data?.data || {},
    receiptSettings: receiptSettings.data?.data || {},
    operationalSettings: operationalSettings.data?.data || {},
  };
}

async function restoreOriginalSettings(ctx: TestContext, original: OriginalSettings): Promise<void> {
  console.log('\n🔄 Restoring original settings...');

  // Restore business settings (VAT, tax_rate, etc.)
  if (original.businessSettings && Object.keys(original.businessSettings).length > 0) {
    const restoreBusiness = await apiRequest(ctx, 'PUT', '/business-settings', {
      vat_enabled: original.businessSettings.vat_enabled,
      tax_rate: original.businessSettings.tax_rate,
    });
    if (restoreBusiness.status === 200) {
      console.log('  ✅ Restored business settings');
    } else {
      console.log('  ⚠️  Could not restore business settings');
    }
  }

  // Restore localization settings
  if (original.localization && Object.keys(original.localization).length > 0) {
    const restoreLocalization = await apiRequest(ctx, 'PUT', '/business-settings/localization', {
      language: original.localization.language,
      currency: original.localization.currency,
      timezone: original.localization.timezone,
    });
    if (restoreLocalization.status === 200) {
      console.log('  ✅ Restored localization settings');
    } else {
      console.log('  ⚠️  Could not restore localization settings');
    }
  }

  // Restore user settings
  if (original.userSettings && Object.keys(original.userSettings).length > 0) {
    const restoreUser = await apiRequest(ctx, 'PUT', '/business-settings/user-settings', {
      preferred_language: original.userSettings.preferred_language,
      preferred_theme: original.userSettings.preferred_theme,
      settings: original.userSettings.settings,
    });
    if (restoreUser.status === 200) {
      console.log('  ✅ Restored user settings');
    } else {
      console.log('  ⚠️  Could not restore user settings');
    }
  }

  // Restore receipt settings
  if (original.receiptSettings && Object.keys(original.receiptSettings).length > 0) {
    const restoreReceipt = await apiRequest(ctx, 'PUT', '/business-settings/receipt', {
      print_languages: original.receiptSettings.print_languages,
      main_language: original.receiptSettings.main_language,
      receipt_header: original.receiptSettings.receipt_header,
      receipt_footer: original.receiptSettings.receipt_footer,
      show_order_number: original.receiptSettings.show_order_number,
      show_subtotal: original.receiptSettings.show_subtotal,
      show_closer_username: original.receiptSettings.show_closer_username,
      show_creator_username: original.receiptSettings.show_creator_username,
    });
    if (restoreReceipt.status === 200) {
      console.log('  ✅ Restored receipt settings');
    } else {
      console.log('  ⚠️  Could not restore receipt settings');
    }
  }

  // Restore operational settings
  if (original.operationalSettings && Object.keys(original.operationalSettings).length > 0) {
    const restoreOperational = await apiRequest(ctx, 'PUT', '/business-settings/operational', {
      order_number_prefix: original.operationalSettings.order_number_prefix,
      auto_accept_orders: original.operationalSettings.auto_accept_orders,
      order_preparation_time: original.operationalSettings.order_preparation_time,
      enable_order_notifications: original.operationalSettings.enable_order_notifications,
      kitchen_display_auto_clear: original.operationalSettings.kitchen_display_auto_clear,
      require_customer_phone: original.operationalSettings.require_customer_phone,
      allow_order_notes: original.operationalSettings.allow_order_notes,
      opening_time: original.operationalSettings.opening_time,
      closing_time: original.operationalSettings.closing_time,
      pos_opening_float_fixed: original.operationalSettings.pos_opening_float_fixed,
      pos_opening_float_amount: original.operationalSettings.pos_opening_float_amount,
      pos_session_allowed_user_ids: original.operationalSettings.pos_session_allowed_user_ids,
    });
    if (restoreOperational.status === 200) {
      console.log('  ✅ Restored operational settings');
    } else {
      console.log('  ⚠️  Could not restore operational settings');
    }
  }
}

// ============================================
// BUSINESS SETTINGS TESTS
// ============================================
async function testBusinessSettings(ctx: TestContext): Promise<void> {
  console.log('\n⚙️ BUSINESS SETTINGS');

  // GET /api/business-settings - Get business settings
  const getSettings = await apiRequest(ctx, 'GET', '/business-settings');
  track(assertSuccess(getSettings, 'GET /business-settings - Get settings'));

  // PUT /api/business-settings - Update settings (will be restored after)
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

  // PUT /api/business-settings/localization - Update localization (will be restored after)
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

  if (settings.status === 200 && settings.data.data) {
    const hasCurrency = !!settings.data.data.currency;
    track(hasCurrency
      ? (console.log('  ✅ GET /business-settings - Currency exists (no fallback)'), true)
      : (console.log('  ❌ GET /business-settings - Currency missing (should not happen)'), false)
    );
  }

  // Verify localization endpoint returns currency (no fallback)
  const localization = await apiRequest(ctx, 'GET', '/business-settings/localization');
  track(assertSuccess(localization, 'GET /business-settings/localization - Returns currency'));

  if (localization.status === 200 && localization.data.data) {
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

  // PUT /api/business-settings/user-settings - Update user settings (will be restored after)
  const updateUserSettings = await apiRequest(ctx, 'PUT', '/business-settings/user-settings', {
    preferred_language: 'en',
    preferred_theme: 'dark',
    settings: {
      notifications_enabled: true,
      sound_enabled: false,
    },
  });
  track(assertSuccess(updateUserSettings, 'PUT /business-settings/user-settings - Update'));
}

// ============================================
// RECEIPT SETTINGS TESTS
// ============================================
async function testReceiptSettings(ctx: TestContext): Promise<void> {
  console.log('\n🧾 RECEIPT SETTINGS');

  // GET /api/business-settings/receipt - Get receipt settings
  const getReceipt = await apiRequest(ctx, 'GET', '/business-settings/receipt');
  track(assertSuccess(getReceipt, 'GET /business-settings/receipt - Get settings'));

  // PUT /api/business-settings/receipt - Update receipt settings (will be restored after)
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

  // PUT /api/business-settings/operational - Update operational settings (will be restored after)
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
}

// ============================================
// CHANGE REQUESTS TESTS
// ============================================
async function testChangeRequests(ctx: TestContext): Promise<void> {
  console.log('\n📝 CHANGE REQUESTS');

  // GET /api/business-settings/change-requests - List change requests
  const getRequests = await apiRequest(ctx, 'GET', '/business-settings/change-requests');
  track(assertSuccess(getRequests, 'GET /business-settings/change-requests - List requests'));

  // Note: We don't submit change requests in tests as they require admin approval
  // and would leave pending requests in the system
  console.log('  ℹ️  Skipping POST change-requests (would leave pending request)');
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

  let ctx: TestContext | null = null;
  let originalSettings: OriginalSettings | null = null;

  try {
    console.log('\n🔐 Authenticating...');
    ctx = await authenticate();

    // Save original settings BEFORE any tests
    originalSettings = await saveOriginalSettings(ctx);

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

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    // ALWAYS restore original settings, even if tests fail
    if (ctx && originalSettings) {
      await restoreOriginalSettings(ctx, originalSettings);
    }

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
  }
}

runTests();
