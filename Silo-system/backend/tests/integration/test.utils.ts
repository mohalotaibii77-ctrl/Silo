/**
 * TEST UTILITIES
 * Helper functions for API testing
 */

import { testConfig, TestContext } from './test.config';

// Re-export TestContext for convenience
export { TestContext };

// Type for API response
interface AuthResponse {
  success: boolean;
  token?: string;
  error?: string;
  user?: {
    id: number;
    business_id: number;
    branch_id?: number;
    username: string;
    role: string;
  };
}

/**
 * Login and get authentication token
 */
export async function authenticate(): Promise<TestContext> {
  const response = await fetch(`${testConfig.baseUrl}/business-auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: testConfig.credentials.username,
      password: testConfig.credentials.password,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
    throw new Error(`Authentication failed: ${errorData.error || response.statusText}`);
  }

  const data = await response.json() as AuthResponse;
  
  if (!data.success || !data.token || !data.user) {
    throw new Error(`Authentication failed: ${data.error || 'No token received'}`);
  }

  console.log('✅ Authenticated as:', data.user.username, '| Role:', data.user.role, '| Business ID:', data.user.business_id);

  return {
    token: data.token,
    businessId: data.user.business_id,
    branchId: data.user.branch_id,
    userId: data.user.id,
    username: data.user.username,
  };
}

/**
 * Make authenticated API request
 */
export async function apiRequest(
  ctx: TestContext,
  method: string,
  endpoint: string,
  body?: any,
  options?: { branchId?: number }
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ctx.token}`,
  };

  // Add branch header if specified
  const branchId = options?.branchId || ctx.branchId || testConfig.branchId;
  if (branchId) {
    headers['X-Branch-Id'] = String(branchId);
  }

  const url = `${testConfig.baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({ error: 'Invalid JSON response' }));
    
    return {
      status: response.status,
      data,
    };
  } catch (error: any) {
    return {
      status: 0,
      data: { error: error.message || 'Network error' },
    };
  }
}

/**
 * Assert response is successful (2xx status)
 * Handles both patterns:
 * - { success: true, data: ... } - explicit success flag
 * - { data: ... } or { items: ... } - direct data return (status 2xx implies success)
 */
export function assertSuccess(response: { status: number; data: any }, testName: string): boolean {
  // Check for 2xx status code
  const isSuccessStatus = response.status >= 200 && response.status < 300;
  
  // Check for explicit success: true flag (if present)
  // Also accept responses without success flag but with 2xx status
  const hasExplicitSuccess = response.data?.success === true;
  const hasNoExplicitFailure = response.data?.success !== false && !response.data?.error;
  
  const isSuccess = isSuccessStatus && (hasExplicitSuccess || hasNoExplicitFailure);
  
  if (isSuccess) {
    console.log(`  ✅ ${testName}`);
    return true;
  } else {
    console.log(`  ❌ ${testName}`);
    console.log(`     Status: ${response.status}, Error: ${response.data?.error || 'Unknown error'}`);
    return false;
  }
}

/**
 * Assert response has expected status
 */
export function assertStatus(response: { status: number; data: any }, expectedStatus: number, testName: string): boolean {
  if (response.status === expectedStatus) {
    console.log(`  ✅ ${testName}`);
    return true;
  } else {
    console.log(`  ❌ ${testName}`);
    console.log(`     Expected: ${expectedStatus}, Got: ${response.status}`);
    return false;
  }
}

/**
 * Generate unique test identifier
 */
export function uniqueId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
