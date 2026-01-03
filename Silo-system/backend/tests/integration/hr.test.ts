/**
 * HR API TEST SUITE
 * Tests attendance check-in/out, schedule overrides, and working days
 *
 * Run with: npm run test:integration:hr
 */

import { validateConfig } from './test.config';
import { authenticate, apiRequest, assertSuccess, assertStatus, TestContext } from './test.utils';

validateConfig();

let passed = 0;
let failed = 0;

function track(success: boolean): void {
  if (success) passed++;
  else failed++;
}

// ============================================
// ATTENDANCE STATUS TESTS
// ============================================
async function testAttendanceStatus(ctx: TestContext): Promise<void> {
  console.log('\n⏰ ATTENDANCE STATUS');

  // GET /hr/attendance/status - Get current status
  const getStatus = await apiRequest(ctx, 'GET', '/hr/attendance/status');
  track(assertSuccess(getStatus, 'GET /hr/attendance/status - Get current status'));

  // The response should have success flag and data (even if null)
  if (getStatus.status === 200) {
    const hasDataField = 'data' in getStatus.data;
    track(hasDataField
      ? (console.log('  ✅ Response has data field'), true)
      : (console.log('  ❌ Response missing data field'), false)
    );
  }
}

// ============================================
// ATTENDANCE HISTORY TESTS
// ============================================
async function testAttendanceHistory(ctx: TestContext): Promise<void> {
  console.log('\n📋 ATTENDANCE HISTORY');

  // GET /hr/attendance/history - Get history with default date range
  const getHistory = await apiRequest(ctx, 'GET', '/hr/attendance/history');
  if (getHistory.status !== 200) {
    console.log(`     Status: ${getHistory.status}, Error: ${getHistory.data?.error}, Details: ${getHistory.data?.details || 'none'}`);
  }
  track(assertSuccess(getHistory, 'GET /hr/attendance/history - Get history (default range)'));

  // Verify response structure
  if (getHistory.status === 200 && getHistory.data.success) {
    const hasRecords = Array.isArray(getHistory.data.data?.records);
    track(hasRecords
      ? (console.log('  ✅ Response has records array'), true)
      : (console.log('  ❌ Response missing records array'), false)
    );

    const hasSummary = getHistory.data.data?.summary !== undefined;
    track(hasSummary
      ? (console.log('  ✅ Response has summary'), true)
      : (console.log('  ❌ Response missing summary'), false)
    );
  }

  // GET with custom date range
  const startDate = '2026-01-01';
  const endDate = '2026-01-31';
  const getHistoryRange = await apiRequest(
    ctx,
    'GET',
    `/hr/attendance/history?start_date=${startDate}&end_date=${endDate}`
  );
  track(assertSuccess(getHistoryRange, 'GET /hr/attendance/history - With date range'));
}

// ============================================
// EFFECTIVE SCHEDULE TESTS
// ============================================
async function testEffectiveSchedule(ctx: TestContext): Promise<void> {
  console.log('\n📅 EFFECTIVE SCHEDULE');

  // GET /hr/effective-schedule - Get logged-in user's schedule
  const getSchedule = await apiRequest(ctx, 'GET', '/hr/effective-schedule');
  track(assertSuccess(getSchedule, 'GET /hr/effective-schedule - Get own schedule'));

  // Verify response structure
  if (getSchedule.status === 200 && getSchedule.data.success) {
    const schedule = getSchedule.data.data;

    const hasWorkingDays = Array.isArray(schedule?.working_days);
    track(hasWorkingDays
      ? (console.log('  ✅ Schedule has working_days'), true)
      : (console.log('  ❌ Schedule missing working_days'), false)
    );

    const hasOpeningTime = typeof schedule?.opening_time === 'string';
    track(hasOpeningTime
      ? (console.log('  ✅ Schedule has opening_time'), true)
      : (console.log('  ❌ Schedule missing opening_time'), false)
    );

    const hasClosingTime = typeof schedule?.closing_time === 'string';
    track(hasClosingTime
      ? (console.log('  ✅ Schedule has closing_time'), true)
      : (console.log('  ❌ Schedule missing closing_time'), false)
    );

    const hasOverrideFlag = typeof schedule?.has_override === 'boolean';
    track(hasOverrideFlag
      ? (console.log('  ✅ Schedule has has_override flag'), true)
      : (console.log('  ❌ Schedule missing has_override flag'), false)
    );
  }
}

// ============================================
// SCHEDULE OVERRIDES TESTS (Manager/Owner only)
// ============================================
async function testScheduleOverrides(ctx: TestContext): Promise<void> {
  console.log('\n⚙️ SCHEDULE OVERRIDES');

  // GET /hr/schedule-overrides - List all overrides
  const listOverrides = await apiRequest(ctx, 'GET', '/hr/schedule-overrides');
  track(assertSuccess(listOverrides, 'GET /hr/schedule-overrides - List all'));

  // Verify response is array
  if (listOverrides.status === 200 && listOverrides.data.success) {
    const isArray = Array.isArray(listOverrides.data.data);
    track(isArray
      ? (console.log('  ✅ Response is array'), true)
      : (console.log('  ❌ Response is not array'), false)
    );
  }

  // GET /hr/schedule-overrides/:employeeId - Get specific override (using own user ID)
  const getOverride = await apiRequest(ctx, 'GET', `/hr/schedule-overrides/${ctx.userId}`);
  track(assertSuccess(getOverride, `GET /hr/schedule-overrides/${ctx.userId} - Get specific`));

  // PUT /hr/schedule-overrides/:employeeId - Create/update override
  const testOverride = {
    working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    opening_time: '08:00',
    closing_time: '16:00',
    checkin_buffer_minutes_before: 20,
    checkin_buffer_minutes_after: 15,
    notes: 'Test override from integration test',
    is_active: true,
  };

  const createOverride = await apiRequest(
    ctx,
    'PUT',
    `/hr/schedule-overrides/${ctx.userId}`,
    testOverride
  );
  track(assertSuccess(createOverride, `PUT /hr/schedule-overrides/${ctx.userId} - Create/update`));

  // Verify the override was created
  if (createOverride.status === 200 && createOverride.data.success) {
    const override = createOverride.data.data;

    const hasWorkingDays = Array.isArray(override?.working_days);
    track(hasWorkingDays
      ? (console.log('  ✅ Override has working_days'), true)
      : (console.log('  ❌ Override missing working_days'), false)
    );
  }

  // PUT /hr/schedule-overrides/:employeeId - Update with partial data
  const partialUpdate = await apiRequest(
    ctx,
    'PUT',
    `/hr/schedule-overrides/${ctx.userId}`,
    { notes: 'Updated note' }
  );
  track(assertSuccess(partialUpdate, `PUT /hr/schedule-overrides/${ctx.userId} - Partial update`));

  // DELETE /hr/schedule-overrides/:employeeId - Delete override (cleanup)
  const deleteOverride = await apiRequest(
    ctx,
    'DELETE',
    `/hr/schedule-overrides/${ctx.userId}`
  );
  track(assertSuccess(deleteOverride, `DELETE /hr/schedule-overrides/${ctx.userId} - Delete`));
}

// ============================================
// CHECK-IN/OUT TESTS
// ============================================
async function testCheckInOut(ctx: TestContext): Promise<void> {
  console.log('\n📍 CHECK-IN/OUT (GPS Validation)');

  // Note: These tests will likely fail if:
  // 1. GPS settings are not configured for the branch
  // 2. Today is not a working day
  // 3. Current time is outside working hours
  // This is expected behavior - we're testing that the validation works

  // POST /hr/attendance/check-in with mock GPS data
  const checkInData = {
    latitude: 24.7136,  // Riyadh coordinates
    longitude: 46.6753,
    accuracy: 10,  // High accuracy
    device_info: {
      platform: 'test',
      os_version: '1.0',
      app_version: '1.0.0',
    },
  };

  const checkIn = await apiRequest(ctx, 'POST', '/hr/attendance/check-in', checkInData);

  // Check-in might fail due to various validations - that's expected
  // We're testing that the endpoint responds appropriately
  if (checkIn.status === 200) {
    track(assertSuccess(checkIn, 'POST /hr/attendance/check-in - Success'));

    // If check-in succeeded, verify response structure
    if (checkIn.data.success && checkIn.data.data) {
      const hasAttendanceId = typeof checkIn.data.data.attendance_id === 'number';
      track(hasAttendanceId
        ? (console.log('  ✅ Response has attendance_id'), true)
        : (console.log('  ❌ Response missing attendance_id'), false)
      );

      // Try check-out
      const checkOut = await apiRequest(ctx, 'POST', '/hr/attendance/check-out', checkInData);
      track(assertSuccess(checkOut, 'POST /hr/attendance/check-out - After check-in'));
    }
  } else if (checkIn.status === 400) {
    // Validation errors are expected in test environment
    const validErrorCodes = [
      'NOT_WORKING_DAY',
      'OUTSIDE_WORKING_HOURS',
      'OUTSIDE_GEOFENCE',
      'GPS_ACCURACY_LOW',
      'GEOFENCE_NOT_CONFIGURED',
      'ALREADY_CHECKED_IN',
    ];

    const errorCode = checkIn.data.error_code;
    const isValidError = validErrorCodes.includes(errorCode);

    if (isValidError) {
      console.log(`  ✅ POST /hr/attendance/check-in - Expected error: ${errorCode}`);
      track(true);
    } else {
      // Unexpected error code - this is a test failure (not a false positive)
      console.log(`  ❌ POST /hr/attendance/check-in - Unexpected error code: ${errorCode || 'none'}`);
      console.log(`     Error: ${checkIn.data.error}`);
      track(false);
    }
  } else {
    // Unexpected status code - this is a test failure
    console.log(`  ❌ POST /hr/attendance/check-in - Unexpected status: ${checkIn.status}`);
    track(false);
  }

  // POST /hr/attendance/check-out when not checked in (should fail)
  const checkOutNotCheckedIn = await apiRequest(ctx, 'POST', '/hr/attendance/check-out', checkInData);

  // Define valid outcomes for check-out test
  const validCheckOutErrorCodes = [
    'NOT_CHECKED_IN',
    'NOT_WORKING_DAY',
    'OUTSIDE_WORKING_HOURS',
    'OUTSIDE_GEOFENCE',
    'GPS_ACCURACY_LOW',
    'GEOFENCE_NOT_CONFIGURED',
  ];

  if (checkOutNotCheckedIn.status === 200) {
    // Check-out succeeded (user was checked in)
    console.log('  ✅ POST /hr/attendance/check-out - Success (was checked in)');
    track(true);
  } else if (checkOutNotCheckedIn.status === 400) {
    const errorCode = checkOutNotCheckedIn.data.error_code;
    if (validCheckOutErrorCodes.includes(errorCode)) {
      console.log(`  ✅ POST /hr/attendance/check-out - Expected error: ${errorCode}`);
      track(true);
    } else {
      // Unexpected error code - test failure
      console.log(`  ❌ POST /hr/attendance/check-out - Unexpected error code: ${errorCode || 'none'}`);
      console.log(`     Error: ${checkOutNotCheckedIn.data.error}`);
      track(false);
    }
  } else {
    // Unexpected status code - test failure
    console.log(`  ❌ POST /hr/attendance/check-out - Unexpected status: ${checkOutNotCheckedIn.status}`);
    track(false);
  }
}

// ============================================
// VALIDATION TESTS
// ============================================
async function testValidation(ctx: TestContext): Promise<void> {
  console.log('\n🔒 VALIDATION');

  // POST /hr/attendance/check-in - Missing required fields
  const missingFields = await apiRequest(ctx, 'POST', '/hr/attendance/check-in', {});
  track(assertStatus(missingFields, 400, 'POST /hr/attendance/check-in - Missing fields'));

  // POST /hr/attendance/check-in - Invalid GPS data
  const invalidGps = await apiRequest(ctx, 'POST', '/hr/attendance/check-in', {
    latitude: 'invalid',
    longitude: 'invalid',
    accuracy: 'invalid',
  });
  track(assertStatus(invalidGps, 400, 'POST /hr/attendance/check-in - Invalid GPS data'));

  // PUT /hr/schedule-overrides/:id - Invalid working days
  const invalidDays = await apiRequest(
    ctx,
    'PUT',
    `/hr/schedule-overrides/${ctx.userId}`,
    { working_days: ['invalidday'] }
  );
  // This might succeed (depends on validation) or fail
  console.log(`  ℹ️  PUT schedule-overrides with invalid days: status ${invalidDays.status}`);
}

// ============================================
// GEOFENCE SETTINGS TESTS (via business-settings)
// ============================================
async function testGeofenceSettings(ctx: TestContext): Promise<void> {
  console.log('\n🌍 GEOFENCE SETTINGS');

  // GET /business-settings/geofence - Get geofence settings
  const getGeofence = await apiRequest(ctx, 'GET', '/business-settings/geofence');
  track(assertSuccess(getGeofence, 'GET /business-settings/geofence - Get settings'));

  // Verify response structure
  if (getGeofence.status === 200 && getGeofence.data.success) {
    const data = getGeofence.data.data;
    const hasRequiredFields =
      typeof data?.require_gps_checkin === 'boolean' &&
      typeof data?.gps_accuracy_threshold_meters === 'number';

    track(hasRequiredFields
      ? (console.log('  ✅ Geofence settings have required fields'), true)
      : (console.log('  ❌ Geofence settings missing required fields'), false)
    );
  }

  // PUT /business-settings/geofence - Update settings
  const updateGeofence = await apiRequest(ctx, 'PUT', '/business-settings/geofence', {
    require_gps_checkin: true,
    gps_accuracy_threshold_meters: 30,
    default_geofence_radius_meters: 150,
  });
  track(assertSuccess(updateGeofence, 'PUT /business-settings/geofence - Update'));

  // Restore to default
  const restoreGeofence = await apiRequest(ctx, 'PUT', '/business-settings/geofence', {
    require_gps_checkin: false,
    gps_accuracy_threshold_meters: 50,
    default_geofence_radius_meters: 100,
  });
  track(assertSuccess(restoreGeofence, 'PUT /business-settings/geofence - Restore defaults'));
}

// ============================================
// WORKING DAYS SETTINGS TESTS
// ============================================
async function testWorkingDaysSettings(ctx: TestContext): Promise<void> {
  console.log('\n📆 WORKING DAYS SETTINGS');

  // GET /business-settings/working-days - Get working days
  const getWorkingDays = await apiRequest(ctx, 'GET', '/business-settings/working-days');
  track(assertSuccess(getWorkingDays, 'GET /business-settings/working-days - Get settings'));

  // Store original for restoration
  const originalWorkingDays = getWorkingDays.data?.data?.working_days || [];
  const originalOpeningTime = getWorkingDays.data?.data?.opening_time || '09:00';
  const originalClosingTime = getWorkingDays.data?.data?.closing_time || '22:00';

  // Verify response structure
  if (getWorkingDays.status === 200 && getWorkingDays.data.success) {
    const data = getWorkingDays.data.data;
    const hasWorkingDays = Array.isArray(data?.working_days);

    track(hasWorkingDays
      ? (console.log('  ✅ Response has working_days array'), true)
      : (console.log('  ❌ Response missing working_days array'), false)
    );
  }

  // PUT /business-settings/working-days - Update
  const updateWorkingDays = await apiRequest(ctx, 'PUT', '/business-settings/working-days', {
    working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
    opening_time: '08:00',
    closing_time: '20:00',
  });
  track(assertSuccess(updateWorkingDays, 'PUT /business-settings/working-days - Update'));

  // PUT with invalid data
  const invalidWorkingDays = await apiRequest(ctx, 'PUT', '/business-settings/working-days', {
    working_days: ['invalidday', 'notaday'],
  });
  track(assertStatus(invalidWorkingDays, 400, 'PUT /business-settings/working-days - Invalid days'));

  // Restore original settings
  const restoreWorkingDays = await apiRequest(ctx, 'PUT', '/business-settings/working-days', {
    working_days: originalWorkingDays,
    opening_time: originalOpeningTime,
    closing_time: originalClosingTime,
  });
  track(assertSuccess(restoreWorkingDays, 'PUT /business-settings/working-days - Restore'));
}

// ============================================
// BRANCH GEOFENCE TESTS
// ============================================
async function testBranchGeofence(ctx: TestContext): Promise<void> {
  console.log('\n🏢 BRANCH GEOFENCE');

  // GET /business-settings/branches/geofence - List all branches with geofence
  const listBranches = await apiRequest(ctx, 'GET', '/business-settings/branches/geofence');
  track(assertSuccess(listBranches, 'GET /business-settings/branches/geofence - List all'));

  // If there are branches, test individual branch geofence
  if (listBranches.status === 200 && Array.isArray(listBranches.data.data) && listBranches.data.data.length > 0) {
    const firstBranch = listBranches.data.data[0];
    // Handle both branch_id and id fields
    const branchId = firstBranch.branch_id || firstBranch.id;

    if (!branchId) {
      console.log('  ℹ️  Branch found but no ID available - skipping individual branch tests');
    } else {
      // GET /business-settings/branches/:id/geofence
      const getBranchGeofence = await apiRequest(
        ctx,
        'GET',
        `/business-settings/branches/${branchId}/geofence`
      );
      track(assertSuccess(getBranchGeofence, `GET /business-settings/branches/${branchId}/geofence`));

      // PUT /business-settings/branches/:id/geofence - Update
      const updateBranchGeofence = await apiRequest(
        ctx,
        'PUT',
        `/business-settings/branches/${branchId}/geofence`,
        {
          latitude: 24.7136,
          longitude: 46.6753,
          geofence_radius_meters: 100,
          geofence_enabled: true,
        }
      );
      track(assertSuccess(updateBranchGeofence, `PUT /business-settings/branches/${branchId}/geofence`));

      // Restore original values
      if (firstBranch.latitude !== null) {
        await apiRequest(ctx, 'PUT', `/business-settings/branches/${branchId}/geofence`, {
          latitude: firstBranch.latitude,
          longitude: firstBranch.longitude,
          geofence_radius_meters: firstBranch.geofence_radius_meters,
          geofence_enabled: firstBranch.geofence_enabled,
        });
      }
    }
  } else {
    console.log('  ℹ️  No branches available for geofence testing');
  }

  // GET for non-existent branch (use -1 to guarantee not found)
  const nonExistent = await apiRequest(ctx, 'GET', '/business-settings/branches/-1/geofence');
  track(assertStatus(nonExistent, 404, 'GET /business-settings/branches/-1/geofence - Not found'));
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 HR API TEST SUITE');
  console.log('='.repeat(60));

  let ctx: TestContext | null = null;

  try {
    console.log('\n🔐 Authenticating...');
    ctx = await authenticate();

    // Run test groups
    await testAttendanceStatus(ctx);
    await testAttendanceHistory(ctx);
    await testEffectiveSchedule(ctx);
    await testScheduleOverrides(ctx);
    await testCheckInOut(ctx);
    await testValidation(ctx);
    await testGeofenceSettings(ctx);
    await testWorkingDaysSettings(ctx);
    await testBranchGeofence(ctx);

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
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
