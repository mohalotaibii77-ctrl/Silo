/**
 * TEST CONFIGURATION
 * Configuration for running API tests
 * 
 * Set environment variables before running tests:
 *   TEST_USERNAME - Username of an existing business user (owner recommended)
 *   TEST_PASSWORD - Password for that user
 *   
 * Or create a .env.test file with these values
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.test if it exists, otherwise use .env
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const testConfig = {
  // Base URL for API
  baseUrl: process.env.TEST_API_URL || 'http://localhost:9000/api',
  
  // Test user credentials (must exist in business_users table)
  // Use an owner or manager for full access to all endpoints
  credentials: {
    username: process.env.TEST_USERNAME || '',
    password: process.env.TEST_PASSWORD || '',
  },
  
  // SuperAdmin credentials (for SuperAdmin API tests)
  superAdminCredentials: {
    email: process.env.SUPERADMIN_EMAIL || '',
    password: process.env.SUPERADMIN_PASSWORD || '',
  },
  
  // Optional: specific business/branch for testing
  businessId: process.env.TEST_BUSINESS_ID ? parseInt(process.env.TEST_BUSINESS_ID) : undefined,
  branchId: process.env.TEST_BRANCH_ID ? parseInt(process.env.TEST_BRANCH_ID) : undefined,
  
  // Test timeouts
  timeout: 30000,
};

export interface TestContext {
  token: string;
  businessId: number;
  branchId?: number;
  userId: number;
  username: string;
}

/**
 * Validate that test configuration is complete
 */
export function validateConfig(): void {
  if (!testConfig.credentials.username || !testConfig.credentials.password) {
    console.error('❌ Test configuration incomplete!');
    console.error('');
    console.error('Please set the following environment variables:');
    console.error('  TEST_USERNAME - Username of a business user (owner recommended)');
    console.error('  TEST_PASSWORD - Password for that user');
    console.error('');
    console.error('Option 1: Set environment variables directly:');
    console.error('  $env:TEST_USERNAME="your_username"');
    console.error('  $env:TEST_PASSWORD="your_password"');
    console.error('');
    console.error('Option 2: Create a .env.test file in the backend folder:');
    console.error('  TEST_USERNAME=your_username');
    console.error('  TEST_PASSWORD=your_password');
    console.error('');
    process.exit(1);
  }
}

