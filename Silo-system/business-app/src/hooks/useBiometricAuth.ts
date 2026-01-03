/**
 * useBiometricAuth Hook
 *
 * React hook for managing biometric authentication state and actions.
 * Provides easy access to biometric capabilities and operations.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  biometricAuth,
  BiometricCapability,
  BiometricType,
  StoredCredentials,
} from '../services/BiometricAuthService';
import api from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UseBiometricAuthReturn {
  // State
  isLoading: boolean;
  isAvailable: boolean;
  isEnabled: boolean;
  biometricType: BiometricType;
  capability: BiometricCapability | null;
  hasStoredCredentials: boolean;

  // Actions
  checkAvailability: () => Promise<BiometricCapability>;
  checkEnabled: (userId: string) => Promise<boolean>;
  enableBiometric: (userId: string, email: string, password: string) => Promise<boolean>;
  disableBiometric: (userId: string) => Promise<boolean>;
  authenticateWithBiometric: (reason?: string) => Promise<{ success: boolean; credentials?: StoredCredentials }>;
  promptAndLogin: (reason?: string) => Promise<{ success: boolean; userData?: any; error?: string }>;
  markAsPrompted: (userId: string) => Promise<void>;
  hasBeenPrompted: (userId: string) => Promise<boolean>;
  clearAll: () => Promise<void>;
  getBiometricTypeName: (language?: 'en' | 'ar') => string;
}

export function useBiometricAuth(): UseBiometricAuthReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

  // Check availability on mount
  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    setIsLoading(true);
    try {
      await biometricAuth.initialize();
      const cap = await biometricAuth.isDeviceSupported();
      setCapability(cap);

      // Check if user has stored credentials
      const credentials = await biometricAuth.getStoredCredentials();
      setHasStoredCredentials(!!credentials);

      // Get current user ID to check if biometric is enabled
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const enabled = await biometricAuth.isBiometricEnabled(user.id?.toString());
        setIsEnabled(enabled);
      }
    } catch (error) {
      console.error('[useBiometricAuth] Error initializing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAvailability = useCallback(async (): Promise<BiometricCapability> => {
    const cap = await biometricAuth.isDeviceSupported();
    setCapability(cap);
    return cap;
  }, []);

  const checkEnabled = useCallback(async (userId: string): Promise<boolean> => {
    const enabled = await biometricAuth.isBiometricEnabled(userId);
    setIsEnabled(enabled);
    return enabled;
  }, []);

  const enableBiometric = useCallback(async (
    userId: string,
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      // First verify biometric works
      const verified = await biometricAuth.promptBiometric('Verify your identity to enable biometric login');
      if (!verified) {
        return false;
      }

      // Store credentials securely
      const stored = await biometricAuth.storeCredentials(email, password);
      if (!stored) {
        return false;
      }

      // Enable biometric for this user
      await biometricAuth.enableBiometric(userId);

      // Update backend settings
      try {
        const deviceId = biometricAuth.getDeviceId();
        await api.put('/business-settings/user-settings', {
          settings: {
            biometric_enabled: true,
            biometric_enrolled_devices: [deviceId],
          },
        });
      } catch (apiError) {
        console.warn('[useBiometricAuth] Could not sync settings to backend:', apiError);
        // Continue anyway - local settings are set
      }

      setIsEnabled(true);
      setHasStoredCredentials(true);
      return true;
    } catch (error) {
      console.error('[useBiometricAuth] Error enabling biometric:', error);
      return false;
    }
  }, []);

  const disableBiometric = useCallback(async (userId: string): Promise<boolean> => {
    try {
      await biometricAuth.disableBiometric(userId);

      // Update backend settings
      try {
        await api.put('/business-settings/user-settings', {
          settings: {
            biometric_enabled: false,
            biometric_enrolled_devices: [],
          },
        });
      } catch (apiError) {
        console.warn('[useBiometricAuth] Could not sync settings to backend:', apiError);
      }

      setIsEnabled(false);
      setHasStoredCredentials(false);
      return true;
    } catch (error) {
      console.error('[useBiometricAuth] Error disabling biometric:', error);
      return false;
    }
  }, []);

  const authenticateWithBiometric = useCallback(async (
    reason?: string
  ): Promise<{ success: boolean; credentials?: StoredCredentials }> => {
    return biometricAuth.authenticateWithBiometric(reason);
  }, []);

  // Full flow: prompt biometric -> get credentials -> login via API
  const promptAndLogin = useCallback(async (
    reason?: string
  ): Promise<{ success: boolean; userData?: any; error?: string }> => {
    try {
      // Authenticate with biometric and get stored credentials
      const authResult = await biometricAuth.authenticateWithBiometric(reason);

      if (!authResult.success || !authResult.credentials) {
        return { success: false, error: 'Biometric authentication failed' };
      }

      // Login via API with stored credentials
      const { email, password } = authResult.credentials;
      const response = await api.post('/business-auth/login', { email, password });

      if (response.data.status === 'success') {
        return { success: true, userData: response.data.data };
      } else {
        // Credentials may be outdated - clear them
        await biometricAuth.clearCredentials();
        setHasStoredCredentials(false);
        return { success: false, error: response.data.error || 'Login failed' };
      }
    } catch (error: any) {
      console.error('[useBiometricAuth] Error in promptAndLogin:', error);

      // If login failed due to invalid credentials, clear stored credentials
      if (error.response?.status === 401) {
        await biometricAuth.clearCredentials();
        setHasStoredCredentials(false);
      }

      return { success: false, error: error.message || 'Login failed' };
    }
  }, []);

  const markAsPrompted = useCallback(async (userId: string): Promise<void> => {
    await biometricAuth.markAsPrompted(userId);
  }, []);

  const hasBeenPrompted = useCallback(async (userId: string): Promise<boolean> => {
    return biometricAuth.hasBeenPrompted(userId);
  }, []);

  const clearAll = useCallback(async (): Promise<void> => {
    await biometricAuth.clearAll();
    setIsEnabled(false);
    setHasStoredCredentials(false);
  }, []);

  const getBiometricTypeName = useCallback((language: 'en' | 'ar' = 'en'): string => {
    const type = capability?.biometricType || 'fingerprint';
    return biometricAuth.getBiometricTypeName(type, language);
  }, [capability]);

  return {
    // State
    isLoading,
    isAvailable: capability?.isSupported ?? false,
    isEnabled,
    biometricType: capability?.biometricType ?? 'none',
    capability,
    hasStoredCredentials,

    // Actions
    checkAvailability,
    checkEnabled,
    enableBiometric,
    disableBiometric,
    authenticateWithBiometric,
    promptAndLogin,
    markAsPrompted,
    hasBeenPrompted,
    clearAll,
    getBiometricTypeName,
  };
}

export default useBiometricAuth;
