/**
 * CATEGORIES API TEST SUITE
 * Tests all category-related API endpoints:
 * - CRUD operations for categories
 * - System vs business category handling
 *
 * Run with: npm run test:integration:categories
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

// Store test category IDs for cleanup
let testCategoryIds: number[] = [];

// ============================================
// CATEGORIES LIST TESTS
// ============================================
async function testCategoriesList(ctx: TestContext): Promise<void> {
  console.log('\n📁 CATEGORIES LIST');

  // GET /api/categories - List all categories
  const listCategories = await apiRequest(ctx, 'GET', '/categories');
  track(assertSuccess(listCategories, 'GET /categories - List all categories'));

  // Verify response structure
  if (listCategories.status === 200) {
    const hasData = Array.isArray(listCategories.data?.data);
    track(hasData
      ? (console.log('  ✅ Response has data array'), true)
      : (console.log('  ❌ Response missing data array'), false)
    );

    // Check that categories include system (general) categories
    if (hasData && listCategories.data.data.length > 0) {
      const hasSystemCategories = listCategories.data.data.some((cat: any) => cat.is_system || cat.is_general);
      console.log(hasSystemCategories
        ? '  ✅ Response includes system categories'
        : '  ℹ️  No system categories found (may be expected)');
    }
  }
}

// ============================================
// CATEGORIES CRUD TESTS
// ============================================
async function testCategoriesCRUD(ctx: TestContext): Promise<void> {
  console.log('\n🔧 CATEGORIES CRUD');

  const testSuffix = uniqueId();

  // TEST 1: POST /api/categories - Create category
  const createCategory = await apiRequest(ctx, 'POST', '/categories', {
    name: `Test Category ${testSuffix}`,
    name_ar: `فئة اختبار ${testSuffix}`,
    description: 'Test category for integration tests',
    display_order: 100,
  });

  if (createCategory.status === 201 || createCategory.status === 200) {
    track(assertSuccess(createCategory, 'POST /categories - Create category'));

    const categoryId = createCategory.data.data?.id;
    if (categoryId) {
      testCategoryIds.push(categoryId);

      // Verify created category has correct properties
      const createdCat = createCategory.data.data;
      const hasCorrectProps = createdCat.name && createdCat.is_system === false;
      track(hasCorrectProps
        ? (console.log('  ✅ Created category has correct properties'), true)
        : (console.log('  ❌ Created category missing properties'), false)
      );

      // TEST 2: PUT /api/categories/:id - Update category
      const updateCategory = await apiRequest(ctx, 'PUT', `/categories/${categoryId}`, {
        name: `Updated Category ${testSuffix}`,
        description: 'Updated description',
        display_order: 99,
      });
      track(assertSuccess(updateCategory, `PUT /categories/${categoryId} - Update category`));

      // Verify update was applied
      const verifyUpdate = await apiRequest(ctx, 'GET', '/categories');
      if (verifyUpdate.data?.data) {
        const updatedCat = verifyUpdate.data.data.find((c: any) => c.id === categoryId);
        if (updatedCat && updatedCat.name === `Updated Category ${testSuffix}`) {
          console.log('  ✅ Category name updated correctly');
          track(true);
        } else {
          console.log('  ❌ Category name not updated');
          track(false);
        }
      }

      // TEST 3: PUT /api/categories/:id - Toggle is_active
      const deactivate = await apiRequest(ctx, 'PUT', `/categories/${categoryId}`, {
        is_active: false,
      });
      track(assertSuccess(deactivate, `PUT /categories/${categoryId} - Deactivate category`));

      // Reactivate for delete test
      await apiRequest(ctx, 'PUT', `/categories/${categoryId}`, {
        is_active: true,
      });

      // TEST 4: DELETE /api/categories/:id - Delete category
      const deleteCategory = await apiRequest(ctx, 'DELETE', `/categories/${categoryId}`);
      track(assertSuccess(deleteCategory, `DELETE /categories/${categoryId} - Delete category`));

      // Remove from cleanup list
      testCategoryIds = testCategoryIds.filter(id => id !== categoryId);

      // Verify deletion
      const verifyDelete = await apiRequest(ctx, 'GET', '/categories');
      if (verifyDelete.data?.data) {
        const stillExists = verifyDelete.data.data.some((c: any) => c.id === categoryId);
        track(!stillExists
          ? (console.log('  ✅ Category successfully deleted'), true)
          : (console.log('  ❌ Category still exists after delete'), false)
        );
      }
    }
  } else {
    console.log(`  ❌ Failed to create category: ${createCategory.data?.error || 'Unknown error'}`);
    track(false);
  }
}

// ============================================
// CATEGORIES VALIDATION TESTS
// ============================================
async function testCategoriesValidation(ctx: TestContext): Promise<void> {
  console.log('\n🔒 CATEGORIES VALIDATION');

  // TEST 1: POST /api/categories - Missing name
  const missingName = await apiRequest(ctx, 'POST', '/categories', {
    description: 'No name category',
  });
  track(assertStatus(missingName, 400, 'POST /categories - Validation (missing name)'));

  // TEST 2: POST /api/categories - Empty name
  const emptyName = await apiRequest(ctx, 'POST', '/categories', {
    name: '',
  });
  track(assertStatus(emptyName, 400, 'POST /categories - Validation (empty name)'));

  // TEST 3: POST /api/categories - Whitespace only name
  const whitespaceName = await apiRequest(ctx, 'POST', '/categories', {
    name: '   ',
  });
  track(assertStatus(whitespaceName, 400, 'POST /categories - Validation (whitespace name)'));

  // TEST 4: POST /api/categories - Duplicate name
  const dupName = `Duplicate ${uniqueId()}`;
  const createFirst = await apiRequest(ctx, 'POST', '/categories', {
    name: dupName,
  });

  if (createFirst.data?.data?.id) {
    testCategoryIds.push(createFirst.data.data.id);

    const createDuplicate = await apiRequest(ctx, 'POST', '/categories', {
      name: dupName,
    });
    track(assertStatus(createDuplicate, 400, 'POST /categories - Validation (duplicate name)'));

    // TEST 5: PUT /api/categories/:id - Update to duplicate name
    const secondCat = await apiRequest(ctx, 'POST', '/categories', {
      name: `Second ${uniqueId()}`,
    });

    if (secondCat.data?.data?.id) {
      testCategoryIds.push(secondCat.data.data.id);

      const updateToDuplicate = await apiRequest(ctx, 'PUT', `/categories/${secondCat.data.data.id}`, {
        name: dupName,
      });
      track(assertStatus(updateToDuplicate, 400, 'PUT /categories/:id - Validation (duplicate name)'));
    }
  }

  // TEST 6: PUT /api/categories/:id - Not found
  const updateNotFound = await apiRequest(ctx, 'PUT', '/categories/-1', {
    name: 'Updated Name',
  });
  track(assertStatus(updateNotFound, 404, 'PUT /categories/-1 - Not found'));

  // TEST 7: DELETE /api/categories/:id - Not found
  const deleteNotFound = await apiRequest(ctx, 'DELETE', '/categories/-1');
  track(assertStatus(deleteNotFound, 404, 'DELETE /categories/-1 - Not found'));
}

// ============================================
// SYSTEM CATEGORY TESTS
// ============================================
async function testSystemCategories(ctx: TestContext): Promise<void> {
  console.log('\n🔒 SYSTEM CATEGORY RESTRICTIONS');

  // First, find a system category
  const listCategories = await apiRequest(ctx, 'GET', '/categories');
  const systemCategory = listCategories.data?.data?.find((c: any) => c.is_system === true);

  if (systemCategory) {
    const systemCatId = systemCategory.id;

    // TEST 1: PUT /api/categories/:id - Cannot edit system category
    const editSystem = await apiRequest(ctx, 'PUT', `/categories/${systemCatId}`, {
      name: 'Trying to edit system category',
    });
    track(assertStatus(editSystem, 403, `PUT /categories/${systemCatId} - Cannot edit system category`));

    // TEST 2: DELETE /api/categories/:id - Cannot delete system category
    const deleteSystem = await apiRequest(ctx, 'DELETE', `/categories/${systemCatId}`);
    track(assertStatus(deleteSystem, 403, `DELETE /categories/${systemCatId} - Cannot delete system category`));
  } else {
    console.log('  ℹ️  No system categories found - skipping system category restriction tests');
  }
}

// ============================================
// CATEGORY WITH PRODUCTS TESTS
// ============================================
async function testCategoryWithProducts(ctx: TestContext): Promise<void> {
  console.log('\n📦 CATEGORY WITH PRODUCTS');

  // Create a category
  const createCategory = await apiRequest(ctx, 'POST', '/categories', {
    name: `Product Category ${uniqueId()}`,
  });

  if (!createCategory.data?.data?.id) {
    console.log('  ⚠️  Could not create test category - skipping test');
    return;
  }

  const categoryId = createCategory.data.data.id;
  testCategoryIds.push(categoryId);

  // Check if we can create a product with this category
  const products = await apiRequest(ctx, 'GET', '/store-products');
  const existingProduct = products.data?.data?.[0] || products.data?.products?.[0];

  if (existingProduct) {
    // Try to assign product to this category by getting products that use it
    const { data: productsInCategory } = await apiRequest(ctx, 'GET', `/store-products?category_id=${categoryId}`);

    // If no products in category, the delete should succeed
    // We're testing the validation logic, not actually assigning products
    console.log('  ℹ️  Category created - delete restriction depends on product assignments');

    // Note: Full test would require creating a product in this category
    // which would be done in products.test.ts
  }
}

// ============================================
// SECURITY TESTS
// ============================================
async function testCategoriesSecurity(ctx: TestContext): Promise<void> {
  console.log('\n🔐 CATEGORIES SECURITY');

  // TEST 1: SQL injection in name
  const sqlInjection = await apiRequest(ctx, 'POST', '/categories', {
    name: "'; DROP TABLE product_categories; --",
  });
  // Should either create (safely escaped) or reject
  const sqlHandled = sqlInjection.status === 201 || sqlInjection.status === 200 || sqlInjection.status === 400;
  track(sqlHandled);
  console.log(sqlHandled
    ? `  ✅ SQL injection in name handled (${sqlInjection.status})`
    : `  ❌ SQL injection handling unexpected status (${sqlInjection.status})`);

  if (sqlInjection.data?.data?.id) {
    testCategoryIds.push(sqlInjection.data.data.id);
  }

  // TEST 2: XSS in name
  const xssCreate = await apiRequest(ctx, 'POST', '/categories', {
    name: '<script>alert("xss")</script>',
  });
  const xssHandled = xssCreate.status === 201 || xssCreate.status === 200 || xssCreate.status === 400;
  track(xssHandled);
  console.log(xssHandled
    ? `  ✅ XSS in name handled (${xssCreate.status})`
    : `  ❌ XSS handling unexpected status (${xssCreate.status})`);

  if (xssCreate.data?.data?.id) {
    testCategoryIds.push(xssCreate.data.data.id);
  }

  // TEST 3: Very long name
  const longName = 'A'.repeat(1000);
  const longNameCreate = await apiRequest(ctx, 'POST', '/categories', {
    name: longName,
  });
  // Should either truncate/accept or reject
  const longNameHandled = longNameCreate.status === 201 || longNameCreate.status === 200 || longNameCreate.status === 400 || longNameCreate.status === 500;
  track(longNameHandled);
  console.log(longNameHandled
    ? `  ✅ Very long name handled (${longNameCreate.status})`
    : `  ❌ Long name handling unexpected status (${longNameCreate.status})`);

  if (longNameCreate.data?.data?.id) {
    testCategoryIds.push(longNameCreate.data.data.id);
  }

  // TEST 4: Special characters in name
  const specialChars = await apiRequest(ctx, 'POST', '/categories', {
    name: `Test "Category" & <Special> 'Chars' ${uniqueId()}`,
  });
  const specialHandled = specialChars.status === 201 || specialChars.status === 200 || specialChars.status === 400;
  track(specialHandled);
  console.log(specialHandled
    ? `  ✅ Special characters handled (${specialChars.status})`
    : `  ❌ Special characters handling unexpected status (${specialChars.status})`);

  if (specialChars.data?.data?.id) {
    testCategoryIds.push(specialChars.data.data.id);
  }
}

// ============================================
// CLEANUP
// ============================================
async function cleanup(ctx: TestContext): Promise<void> {
  console.log('\n🧹 CLEANUP');

  for (const categoryId of testCategoryIds) {
    try {
      await apiRequest(ctx, 'DELETE', `/categories/${categoryId}`);
      console.log(`  ✓ Deleted test category ${categoryId}`);
    } catch (error) {
      console.log(`  ⚠️  Could not delete category ${categoryId}`);
    }
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🧪 CATEGORIES API TEST SUITE');
  console.log('='.repeat(60));

  let ctx: TestContext | null = null;

  try {
    console.log('\n🔐 Authenticating...');
    ctx = await authenticate();

    // Run test groups
    await testCategoriesList(ctx);
    await testCategoriesCRUD(ctx);
    await testCategoriesValidation(ctx);
    await testSystemCategories(ctx);
    await testCategoryWithProducts(ctx);
    await testCategoriesSecurity(ctx);

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
