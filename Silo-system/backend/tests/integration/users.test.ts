/**
 * USERS API TEST SUITE
 * Tests business users management (owner-only endpoints)
 * 
 * Run with: npm run test:users
 * 
 * Note: These tests require owner-level authentication
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
// BUSINESS USERS TESTS
// ============================================
async function testBusinessUsers(ctx: TestContext): Promise<{ userId: number | null }> {
  console.log('\n👥 BUSINESS USERS');
  
  let testUserId: number | null = null;
  
  // GET /api/business-users - List all users
  const listUsers = await apiRequest(ctx, 'GET', '/business-users');
  track(assertSuccess(listUsers, 'GET /business-users - List all users'));
  
  // Check if we got user count info
  if (listUsers.data.max_users !== undefined) {
    console.log(`    📊 Users: ${listUsers.data.user_count}/${listUsers.data.max_users}`);
  }
  
  // POST /api/business-users - Create employee
  const username = `test_employee_${uniqueId()}`;
  const createEmployee = await apiRequest(ctx, 'POST', '/business-users', {
    username,
    role: 'employee',
    first_name: 'Test',
    last_name: 'Employee',
    email: `${username}@test.com`,
  });
  track(assertSuccess(createEmployee, 'POST /business-users - Create employee'));
  
  if (createEmployee.data.data?.id) {
    testUserId = createEmployee.data.data.id;
    console.log(`    📝 Default password: ${createEmployee.data.default_password || '90074009'}`);
    
    // PUT /api/business-users/:id - Update user
    const updateUser = await apiRequest(ctx, 'PUT', `/business-users/${testUserId}`, {
      first_name: 'Updated',
      last_name: 'Name',
      permissions: {
        orders: true,
        inventory: false,
        pos_access: true,
      },
    });
    track(assertSuccess(updateUser, `PUT /business-users/${testUserId} - Update user`));
    
    // PUT /api/business-users/:id - Change role to manager
    const changeRole = await apiRequest(ctx, 'PUT', `/business-users/${testUserId}`, {
      role: 'manager',
    });
    track(assertSuccess(changeRole, `PUT /business-users/${testUserId} - Change role`));
    
    // POST /api/business-users/:id/reset-password - Reset password
    const resetPassword = await apiRequest(ctx, 'POST', `/business-users/${testUserId}/reset-password`);
    track(assertSuccess(resetPassword, `POST /business-users/${testUserId}/reset-password - Reset`));
  }
  
  // POST /api/business-users - Create POS user
  const posUsername = `pos_${uniqueId()}`;
  const createPOS = await apiRequest(ctx, 'POST', '/business-users', {
    username: posUsername,
    role: 'pos',
    first_name: 'POS',
    last_name: 'Terminal',
  });
  track(assertSuccess(createPOS, 'POST /business-users - Create POS user'));
  
  // Cleanup POS user
  if (createPOS.data.data?.id) {
    await apiRequest(ctx, 'DELETE', `/business-users/${createPOS.data.data.id}`);
  }
  
  // POST /api/business-users - Create kitchen display user
  const kdUsername = `kd_${uniqueId()}`;
  const createKD = await apiRequest(ctx, 'POST', '/business-users', {
    username: kdUsername,
    role: 'kitchen_display',
    first_name: 'Kitchen',
    last_name: 'Display',
  });
  track(assertSuccess(createKD, 'POST /business-users - Create kitchen display user'));
  
  // Cleanup kitchen display user
  if (createKD.data.data?.id) {
    await apiRequest(ctx, 'DELETE', `/business-users/${createKD.data.data.id}`);
  }
  
  // Validation tests
  const emptyUsername = await apiRequest(ctx, 'POST', '/business-users', {
    username: '',
    role: 'employee',
  });
  track(assertStatus(emptyUsername, 400, 'POST /business-users - Validation (empty username)'));
  
  const invalidRole = await apiRequest(ctx, 'POST', '/business-users', {
    username: `invalid_${uniqueId()}`,
    role: 'invalid_role',
  });
  track(assertStatus(invalidRole, 400, 'POST /business-users - Validation (invalid role)'));
  
  // Duplicate username test
  if (testUserId) {
    const duplicateUser = await apiRequest(ctx, 'POST', '/business-users', {
      username,  // Same username as before
      role: 'employee',
    });
    track(assertStatus(duplicateUser, 400, 'POST /business-users - Validation (duplicate username)'));
  }
  
  // Not found test
  const notFound = await apiRequest(ctx, 'PUT', '/business-users/999999', {
    first_name: 'Test',
  });
  track(assertStatus(notFound, 404, 'PUT /business-users/999999 - Not found'));
  
  return { userId: testUserId };
}

// ============================================
// USER PERMISSIONS TESTS
// ============================================
async function testUserPermissions(ctx: TestContext, userId: number | null): Promise<void> {
  console.log('\n🔐 USER PERMISSIONS');
  
  if (!userId) {
    console.log('  ⚠️  Skipping permission tests - no user ID available');
    return;
  }
  
  // Test setting various permission combinations
  const permissionSets = [
    {
      name: 'Full access',
      permissions: {
        orders: true,
        menu_edit: true,
        inventory: true,
        delivery: true,
        tables: true,
        drivers: true,
        discounts: true,
        pos_access: true,
      },
    },
    {
      name: 'Read-only',
      permissions: {
        orders: true,
        menu_edit: false,
        inventory: false,
        delivery: false,
        tables: false,
        drivers: false,
        discounts: false,
        pos_access: false,
      },
    },
    {
      name: 'POS operator',
      permissions: {
        orders: true,
        menu_edit: false,
        inventory: false,
        delivery: false,
        tables: true,
        drivers: false,
        discounts: true,
        pos_access: true,
      },
    },
  ];
  
  for (const permSet of permissionSets) {
    const updatePerm = await apiRequest(ctx, 'PUT', `/business-users/${userId}`, {
      permissions: permSet.permissions,
    });
    track(assertSuccess(updatePerm, `PUT /business-users/${userId} - Set ${permSet.name} permissions`));
  }
}

// ============================================
// POS PIN TESTS
// ============================================
async function testPosPIN(ctx: TestContext, userId: number | null): Promise<void> {
  console.log('\n🔑 POS PIN');
  
  // Create a user with POS access (should auto-generate PIN)
  const username = `pos_pin_test_${uniqueId()}`;
  const createWithPosAccess = await apiRequest(ctx, 'POST', '/business-users', {
    username,
    role: 'employee',
    first_name: 'PIN',
    last_name: 'Test',
    permissions: {
      orders: true,
      menu_edit: false,
      inventory: false,
      delivery: false,
      tables: false,
      drivers: false,
      discounts: false,
      pos_access: true,  // Should trigger PIN generation
    },
  });
  track(assertSuccess(createWithPosAccess, 'POST /business-users - Create user with POS access'));
  
  const testUserId = createWithPosAccess.data.data?.id;
  const generatedPin = createWithPosAccess.data.data?.pos_pin || createWithPosAccess.data.pos_pin;
  
  if (testUserId) {
    // Check that PIN was auto-generated
    if (generatedPin) {
      console.log(`    📌 Auto-generated PIN: ${generatedPin}`);
      track(true);
      console.log('    ✅ PIN auto-generated for POS access user');
    } else {
      track(false);
      console.log('    ❌ PIN should have been auto-generated for POS access user');
    }
    
    // POST /api/business-users/:id/reset-pin - Reset PIN
    const resetPin = await apiRequest(ctx, 'POST', `/business-users/${testUserId}/reset-pin`);
    track(assertSuccess(resetPin, `POST /business-users/${testUserId}/reset-pin - Reset PIN`));
    
    const newPin = resetPin.data.pos_pin;
    if (newPin && newPin !== generatedPin) {
      console.log(`    📌 New PIN after reset: ${newPin}`);
    }
    
    // PUT /api/business-users/:id/set-pin - Set custom PIN
    const customPin = '9876';
    const setPin = await apiRequest(ctx, 'PUT', `/business-users/${testUserId}/set-pin`, {
      pin: customPin,
    });
    track(assertSuccess(setPin, `PUT /business-users/${testUserId}/set-pin - Set custom PIN`));
    
    // Validation: Invalid PIN format (too short)
    const shortPin = await apiRequest(ctx, 'PUT', `/business-users/${testUserId}/set-pin`, {
      pin: '12',  // Too short
    });
    track(assertStatus(shortPin, 400, `PUT /business-users/${testUserId}/set-pin - Validation (too short)`));
    
    // Validation: Invalid PIN format (non-numeric)
    const alphaPin = await apiRequest(ctx, 'PUT', `/business-users/${testUserId}/set-pin`, {
      pin: 'abcd',  // Non-numeric
    });
    track(assertStatus(alphaPin, 400, `PUT /business-users/${testUserId}/set-pin - Validation (non-numeric)`));
    
    // Test PIN authentication (via pos-sessions endpoint)
    const pinAuth = await apiRequest(ctx, 'POST', '/pos-sessions/pin-authenticate', {
      pin: customPin,
    });
    track(assertSuccess(pinAuth, 'POST /pos-sessions/pin-authenticate - Valid PIN'));
    
    // Verify employee data returned
    if (pinAuth.data.data?.employee) {
      console.log(`    👤 Authenticated as: ${pinAuth.data.data.employee.display_name}`);
    }
    
    // Test invalid PIN
    const invalidPin = await apiRequest(ctx, 'POST', '/pos-sessions/pin-authenticate', {
      pin: '0000',  // Wrong PIN
    });
    track(assertStatus(invalidPin, 401, 'POST /pos-sessions/pin-authenticate - Invalid PIN'));
    
    // Test duplicate PIN prevention
    // Create another user and try to set same PIN
    const username2 = `pos_pin_test2_${uniqueId()}`;
    const createUser2 = await apiRequest(ctx, 'POST', '/business-users', {
      username: username2,
      role: 'pos',
      first_name: 'Duplicate',
      last_name: 'PIN Test',
    });
    
    if (createUser2.data.data?.id) {
      const duplicatePinAttempt = await apiRequest(ctx, 'PUT', `/business-users/${createUser2.data.data.id}/set-pin`, {
        pin: customPin,  // Same as first user
      });
      track(assertStatus(duplicatePinAttempt, 400, 'PUT /business-users - Duplicate PIN rejected'));
      
      // Cleanup second user
      await apiRequest(ctx, 'DELETE', `/business-users/${createUser2.data.data.id}`);
    }
    
    // Cleanup first user
    await apiRequest(ctx, 'DELETE', `/business-users/${testUserId}`);
  }
}

// ============================================
// CLEANUP TESTS
// ============================================
async function cleanupTestData(ctx: TestContext, userId: number | null): Promise<void> {
  console.log('\n🧹 CLEANUP');
  
  if (userId) {
    const deleteUser = await apiRequest(ctx, 'DELETE', `/business-users/${userId}`);
    track(assertSuccess(deleteUser, `DELETE /business-users/${userId} - Delete test user`));
  }
  
  // Try to delete non-existent user
  const deleteNotFound = await apiRequest(ctx, 'DELETE', '/business-users/999999');
  track(assertStatus(deleteNotFound, 404, 'DELETE /business-users/999999 - Not found'));
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 USERS API TEST SUITE');
  console.log('='.repeat(60));
  
  try {
    console.log('\n🔐 Authenticating...');
    const ctx = await authenticate();
    
    // These tests require owner role
    console.log('    ℹ️  Note: User management requires owner role');
    
    let userId: number | null = null;
    
    // Run test groups
    const result = await testBusinessUsers(ctx);
    userId = result.userId;
    
    await testUserPermissions(ctx, userId);
    await testPosPIN(ctx, userId);
    await cleanupTestData(ctx, userId);
    
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

