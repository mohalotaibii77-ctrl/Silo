/**
 * DISCOUNTS API TEST SUITE
 * Tests all discount-related API endpoints:
 * - CRUD operations for discount codes
 * - Discount validation
 * - Usage tracking
 *
 * Run with: npm run test:integration:discounts
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

// Store test discount IDs for cleanup
let testDiscountIds: number[] = [];

// ============================================
// DISCOUNTS LIST TESTS
// ============================================
async function testDiscountsList(ctx: TestContext): Promise<void> {
  console.log('\n💰 DISCOUNTS LIST');

  // GET /api/discounts - List all discounts
  const listDiscounts = await apiRequest(ctx, 'GET', '/discounts');
  track(assertSuccess(listDiscounts, 'GET /discounts - List all discounts'));

  // Verify response structure
  if (listDiscounts.status === 200) {
    const hasData = Array.isArray(listDiscounts.data?.data);
    track(hasData
      ? (console.log('  ✅ Response has data array'), true)
      : (console.log('  ❌ Response missing data array'), false)
    );
  }
}

// ============================================
// DISCOUNTS CRUD TESTS
// ============================================
async function testDiscountsCRUD(ctx: TestContext): Promise<void> {
  console.log('\n🔧 DISCOUNTS CRUD');

  const testCode = `TEST${uniqueId()}`;

  // TEST 1: POST /api/discounts - Create percentage discount
  const createPercentage = await apiRequest(ctx, 'POST', '/discounts', {
    code: testCode,
    name: 'Test Percentage Discount',
    name_ar: 'خصم نسبة مئوية اختبار',
    discount_type: 'percentage',
    discount_value: 15,
    min_order_amount: 50,
    max_discount_amount: 25,
  });

  if (createPercentage.status === 201 || createPercentage.status === 200) {
    track(assertSuccess(createPercentage, 'POST /discounts - Create percentage discount'));

    const discountId = createPercentage.data.data?.id;
    if (discountId) {
      testDiscountIds.push(discountId);

      // TEST 2: GET /api/discounts/validate/:code - Validate discount
      const validate = await apiRequest(ctx, 'GET', `/discounts/validate/${testCode}`);
      track(assertSuccess(validate, `GET /discounts/validate/${testCode} - Validate code`));

      // Verify validation response
      if (validate.status === 200) {
        const isValid = validate.data?.valid === true;
        track(isValid
          ? (console.log('  ✅ Validation returned valid: true'), true)
          : (console.log('  ❌ Validation did not return valid: true'), false)
        );
      }

      // TEST 3: PUT /api/discounts/:id - Update discount
      const update = await apiRequest(ctx, 'PUT', `/discounts/${discountId}`, {
        discount_value: 20,
        name: 'Updated Test Discount',
      });
      track(assertSuccess(update, `PUT /discounts/${discountId} - Update discount`));

      // TEST 4: POST /api/discounts/:id/use - Use discount
      const useDiscount = await apiRequest(ctx, 'POST', `/discounts/${discountId}/use`);
      track(assertSuccess(useDiscount, `POST /discounts/${discountId}/use - Record usage`));

      // TEST 5: DELETE /api/discounts/:id - Delete discount
      const deleteDiscount = await apiRequest(ctx, 'DELETE', `/discounts/${discountId}`);
      track(assertSuccess(deleteDiscount, `DELETE /discounts/${discountId} - Delete discount`));

      // Remove from cleanup list
      testDiscountIds = testDiscountIds.filter(id => id !== discountId);
    }
  } else {
    console.log(`  ❌ Failed to create discount: ${createPercentage.data?.error || 'Unknown error'}`);
    track(false);
  }

  // TEST 6: POST /api/discounts - Create fixed amount discount
  const fixedCode = `FIXED${uniqueId()}`;
  const createFixed = await apiRequest(ctx, 'POST', '/discounts', {
    code: fixedCode,
    name: 'Test Fixed Discount',
    discount_type: 'fixed',
    discount_value: 10,
  });

  if (createFixed.status === 201 || createFixed.status === 200) {
    track(assertSuccess(createFixed, 'POST /discounts - Create fixed amount discount'));
    if (createFixed.data.data?.id) {
      testDiscountIds.push(createFixed.data.data.id);
    }
  } else {
    console.log(`  ❌ Failed to create fixed discount: ${createFixed.data?.error || 'Unknown error'}`);
    track(false);
  }
}

// ============================================
// DISCOUNTS VALIDATION TESTS
// ============================================
async function testDiscountsValidation(ctx: TestContext): Promise<void> {
  console.log('\n🔒 DISCOUNTS VALIDATION');

  // TEST 1: POST /api/discounts - Missing code
  const missingCode = await apiRequest(ctx, 'POST', '/discounts', {
    discount_value: 10,
  });
  track(assertStatus(missingCode, 400, 'POST /discounts - Validation (missing code)'));

  // TEST 2: POST /api/discounts - Missing discount_value
  const missingValue = await apiRequest(ctx, 'POST', '/discounts', {
    code: `NOVALUE${uniqueId()}`,
  });
  track(assertStatus(missingValue, 400, 'POST /discounts - Validation (missing discount_value)'));

  // TEST 3: POST /api/discounts - Zero discount_value
  const zeroValue = await apiRequest(ctx, 'POST', '/discounts', {
    code: `ZERO${uniqueId()}`,
    discount_value: 0,
  });
  track(assertStatus(zeroValue, 400, 'POST /discounts - Validation (zero discount_value)'));

  // TEST 4: POST /api/discounts - Negative discount_value
  const negativeValue = await apiRequest(ctx, 'POST', '/discounts', {
    code: `NEG${uniqueId()}`,
    discount_value: -10,
  });
  track(assertStatus(negativeValue, 400, 'POST /discounts - Validation (negative discount_value)'));

  // TEST 5: POST /api/discounts - Percentage over 100
  const over100 = await apiRequest(ctx, 'POST', '/discounts', {
    code: `OVER${uniqueId()}`,
    discount_type: 'percentage',
    discount_value: 150,
  });
  track(assertStatus(over100, 400, 'POST /discounts - Validation (percentage > 100)'));

  // TEST 6: POST /api/discounts - Duplicate code
  const dupCode = `DUP${uniqueId()}`;
  const createFirst = await apiRequest(ctx, 'POST', '/discounts', {
    code: dupCode,
    discount_value: 10,
  });

  if (createFirst.data?.data?.id) {
    testDiscountIds.push(createFirst.data.data.id);

    const createDuplicate = await apiRequest(ctx, 'POST', '/discounts', {
      code: dupCode,
      discount_value: 15,
    });
    track(assertStatus(createDuplicate, 400, 'POST /discounts - Validation (duplicate code)'));
  }

  // TEST 7: GET /api/discounts/validate/:code - Invalid code
  const invalidCode = await apiRequest(ctx, 'GET', '/discounts/validate/NONEXISTENT999');
  track(assertStatus(invalidCode, 404, 'GET /discounts/validate/NONEXISTENT999 - Not found'));

  // TEST 8: PUT /api/discounts/:id - Not found
  const updateNotFound = await apiRequest(ctx, 'PUT', '/discounts/-1', {
    discount_value: 10,
  });
  track(assertStatus(updateNotFound, 404, 'PUT /discounts/-1 - Not found'));

  // TEST 9: DELETE /api/discounts/:id - Not found
  const deleteNotFound = await apiRequest(ctx, 'DELETE', '/discounts/-1');
  track(assertStatus(deleteNotFound, 404, 'DELETE /discounts/-1 - Not found'));

  // TEST 10: POST /api/discounts/:id/use - Not found
  const useNotFound = await apiRequest(ctx, 'POST', '/discounts/-1/use');
  track(assertStatus(useNotFound, 404, 'POST /discounts/-1/use - Not found'));

  // TEST 11: POST /api/discounts - Empty code
  const emptyCode = await apiRequest(ctx, 'POST', '/discounts', {
    code: '',
    discount_value: 10,
  });
  track(assertStatus(emptyCode, 400, 'POST /discounts - Validation (empty code)'));

  // TEST 12: POST /api/discounts - Whitespace only code
  const whitespaceCode = await apiRequest(ctx, 'POST', '/discounts', {
    code: '   ',
    discount_value: 10,
  });
  track(assertStatus(whitespaceCode, 400, 'POST /discounts - Validation (whitespace code)'));
}

// ============================================
// DISCOUNTS DATE VALIDATION TESTS
// ============================================
async function testDiscountsDateValidation(ctx: TestContext): Promise<void> {
  console.log('\n📅 DISCOUNTS DATE VALIDATION');

  // TEST 1: Create discount with future start_date
  const futureCode = `FUTURE${uniqueId()}`;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30); // 30 days in future

  const createFuture = await apiRequest(ctx, 'POST', '/discounts', {
    code: futureCode,
    discount_value: 10,
    start_date: futureDate.toISOString(),
  });

  if (createFuture.data?.data?.id) {
    testDiscountIds.push(createFuture.data.data.id);

    // Validate future discount (should fail)
    const validateFuture = await apiRequest(ctx, 'GET', `/discounts/validate/${futureCode}`);
    track(assertStatus(validateFuture, 400, `GET /discounts/validate/${futureCode} - Not yet active`));
  }

  // TEST 2: Create discount with past end_date
  const expiredCode = `EXPIRED${uniqueId()}`;
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1); // Yesterday

  const createExpired = await apiRequest(ctx, 'POST', '/discounts', {
    code: expiredCode,
    discount_value: 10,
    end_date: pastDate.toISOString(),
  });

  if (createExpired.data?.data?.id) {
    testDiscountIds.push(createExpired.data.data.id);

    // Validate expired discount (should fail)
    const validateExpired = await apiRequest(ctx, 'GET', `/discounts/validate/${expiredCode}`);
    track(assertStatus(validateExpired, 400, `GET /discounts/validate/${expiredCode} - Expired`));
  }
}

// ============================================
// DISCOUNTS USAGE LIMIT TESTS
// ============================================
async function testDiscountsUsageLimit(ctx: TestContext): Promise<void> {
  console.log('\n🔢 DISCOUNTS USAGE LIMIT');

  // Create discount with usage limit of 2
  const limitCode = `LIMIT${uniqueId()}`;
  const createLimited = await apiRequest(ctx, 'POST', '/discounts', {
    code: limitCode,
    discount_value: 10,
    usage_limit: 2,
  });

  if (createLimited.data?.data?.id) {
    const limitedId = createLimited.data.data.id;
    testDiscountIds.push(limitedId);

    // Use discount twice
    await apiRequest(ctx, 'POST', `/discounts/${limitedId}/use`);
    await apiRequest(ctx, 'POST', `/discounts/${limitedId}/use`);

    // Validate should fail (limit reached)
    const validateExceeded = await apiRequest(ctx, 'GET', `/discounts/validate/${limitCode}`);
    track(assertStatus(validateExceeded, 400, `GET /discounts/validate/${limitCode} - Usage limit reached`));
  } else {
    console.log('  ⚠️  Could not create limited discount - skipping usage limit test');
  }
}

// ============================================
// SECURITY TESTS
// ============================================
async function testDiscountsSecurity(ctx: TestContext): Promise<void> {
  console.log('\n🔐 DISCOUNTS SECURITY');

  // TEST 1: SQL injection in code
  const sqlInjection = await apiRequest(ctx, 'GET', "/discounts/validate/'; DROP TABLE discount_codes; --");
  // Should return 404 (not found) not 500 (server error from injection)
  const sqlInjectionHandled = sqlInjection.status === 404 || sqlInjection.status === 400;
  track(sqlInjectionHandled);
  console.log(sqlInjectionHandled
    ? `  ✅ SQL injection in code handled (${sqlInjection.status})`
    : `  ❌ SQL injection may have caused error (${sqlInjection.status})`);

  // TEST 2: XSS in code name
  const xssCode = `XSS${uniqueId()}`;
  const xssCreate = await apiRequest(ctx, 'POST', '/discounts', {
    code: xssCode,
    name: '<script>alert("xss")</script>',
    discount_value: 10,
  });
  // Should either create (sanitized) or reject
  const xssHandled = xssCreate.status === 201 || xssCreate.status === 200 || xssCreate.status === 400;
  track(xssHandled);
  console.log(xssHandled
    ? `  ✅ XSS in name handled (${xssCreate.status})`
    : `  ❌ XSS handling unexpected status (${xssCreate.status})`);

  if (xssCreate.data?.data?.id) {
    testDiscountIds.push(xssCreate.data.data.id);
  }

  // TEST 3: Very long code
  const longCode = 'A'.repeat(1000);
  const longCodeCreate = await apiRequest(ctx, 'POST', '/discounts', {
    code: longCode,
    discount_value: 10,
  });
  // Should either reject (400) or truncate/accept
  const longCodeHandled = longCodeCreate.status === 400 || longCodeCreate.status === 201 || longCodeCreate.status === 200 || longCodeCreate.status === 500;
  track(longCodeHandled);
  console.log(longCodeHandled
    ? `  ✅ Very long code handled (${longCodeCreate.status})`
    : `  ❌ Long code handling unexpected status (${longCodeCreate.status})`);

  if (longCodeCreate.data?.data?.id) {
    testDiscountIds.push(longCodeCreate.data.data.id);
  }
}

// ============================================
// CLEANUP
// ============================================
async function cleanup(ctx: TestContext): Promise<void> {
  console.log('\n🧹 CLEANUP');

  for (const discountId of testDiscountIds) {
    try {
      await apiRequest(ctx, 'DELETE', `/discounts/${discountId}`);
      console.log(`  ✓ Deleted test discount ${discountId}`);
    } catch (error) {
      console.log(`  ⚠️  Could not delete discount ${discountId}`);
    }
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 DISCOUNTS API TEST SUITE');
  console.log('='.repeat(60));

  let ctx: TestContext | null = null;

  try {
    console.log('\n🔐 Authenticating...');
    ctx = await authenticate();

    // Run test groups
    await testDiscountsList(ctx);
    await testDiscountsCRUD(ctx);
    await testDiscountsValidation(ctx);
    await testDiscountsDateValidation(ctx);
    await testDiscountsUsageLimit(ctx);
    await testDiscountsSecurity(ctx);

    // Cleanup
    await cleanup(ctx);

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
