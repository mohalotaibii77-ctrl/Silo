import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// SecureStore keys
const SECURE_KEYS = {
  CREDENTIALS_EMAIL: 'biometric_credentials_email',
  CREDENTIALS_PASSWORD: 'biometric_credentials_password',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  BIOMETRIC_PROMPTED: 'biometric_prompted',
  DEVICE_ID: 'biometric_device_id',
  AUTH_TOKEN: 'auth_token',
};

export type BiometricType = 'face' | 'fingerprint' | 'iris' | 'none';

export interface BiometricCapability {
  isSupported: boolean;
  biometricType: BiometricType;
  isEnrolled: boolean;
  securityLevel: LocalAuthentication.SecurityLevel;
}

export interface StoredCredentials {
  email: string;
  password: string;
}

class BiometricAuthService {
  private deviceId: string | null = null;

  // Initialize the service and get device ID
  async initialize(): Promise<void> {
    try {
      // Get or generate device ID
      let storedDeviceId = await SecureStore.getItemAsync(SECURE_KEYS.DEVICE_ID);
      if (!storedDeviceId) {
        storedDeviceId = this.generateDeviceId();
        await SecureStore.setItemAsync(SECURE_KEYS.DEVICE_ID, storedDeviceId);
      }
      this.deviceId = storedDeviceId;
    } catch (error) {
      console.error('[BiometricAuth] Error initializing:', error);
    }
  }

  // Generate a unique device identifier
  private generateDeviceId(): string {
    const deviceInfo = [
      Device.brand,
      Device.modelName,
      Device.osName,
      Device.osVersion,
      Date.now().toString(36),
      Math.random().toString(36).substring(2, 15),
    ].filter(Boolean).join('-');
    return deviceInfo;
  }

  // Get the device ID
  getDeviceId(): string | null {
    return this.deviceId;
  }

  // Check if device supports biometrics
  async isDeviceSupported(): Promise<BiometricCapability> {
    try {
      // Check hardware support
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        return {
          isSupported: false,
          biometricType: 'none',
          isEnrolled: false,
          securityLevel: LocalAuthentication.SecurityLevel.NONE,
        };
      }

      // Check if biometrics are enrolled
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // Get supported authentication types
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      // Determine biometric type
      let biometricType: BiometricType = 'none';
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'face';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }

      // Get security level
      const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

      return {
        isSupported: hasHardware && isEnrolled,
        biometricType,
        isEnrolled,
        securityLevel,
      };
    } catch (error) {
      console.error('[BiometricAuth] Error checking device support:', error);
      return {
        isSupported: false,
        biometricType: 'none',
        isEnrolled: false,
        securityLevel: LocalAuthentication.SecurityLevel.NONE,
      };
    }
  }

  // Prompt for biometric authentication
  async promptBiometric(reason: string = 'Authenticate to continue'): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allow PIN/password fallback on device
        fallbackLabel: 'Use Password',
      });

      if (result.success) {
        console.log('[BiometricAuth] Authentication successful');
        return true;
      } else {
        console.log('[BiometricAuth] Authentication failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('[BiometricAuth] Error during authentication:', error);
      return false;
    }
  }

  // Store credentials securely after successful login
  async storeCredentials(email: string, password: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(SECURE_KEYS.CREDENTIALS_EMAIL, email);
      await SecureStore.setItemAsync(SECURE_KEYS.CREDENTIALS_PASSWORD, password);
      console.log('[BiometricAuth] Credentials stored securely');
      return true;
    } catch (error) {
      console.error('[BiometricAuth] Error storing credentials:', error);
      return false;
    }
  }

  // Retrieve stored credentials
  async getStoredCredentials(): Promise<StoredCredentials | null> {
    try {
      const email = await SecureStore.getItemAsync(SECURE_KEYS.CREDENTIALS_EMAIL);
      const password = await SecureStore.getItemAsync(SECURE_KEYS.CREDENTIALS_PASSWORD);

      if (email && password) {
        return { email, password };
      }
      return null;
    } catch (error) {
      console.error('[BiometricAuth] Error retrieving credentials:', error);
      return null;
    }
  }

  // Clear stored credentials
  async clearCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SECURE_KEYS.CREDENTIALS_EMAIL);
      await SecureStore.deleteItemAsync(SECURE_KEYS.CREDENTIALS_PASSWORD);
      console.log('[BiometricAuth] Credentials cleared');
    } catch (error) {
      console.error('[BiometricAuth] Error clearing credentials:', error);
    }
  }

  // Check if biometric is enabled for this user
  async isBiometricEnabled(userId?: string): Promise<boolean> {
    try {
      const key = userId
        ? `${SECURE_KEYS.BIOMETRIC_ENABLED}_${userId}`
        : SECURE_KEYS.BIOMETRIC_ENABLED;
      const enabled = await SecureStore.getItemAsync(key);
      return enabled === 'true';
    } catch (error) {
      console.error('[BiometricAuth] Error checking biometric enabled:', error);
      return false;
    }
  }

  // Enable biometric for user
  async enableBiometric(userId: string): Promise<boolean> {
    try {
      const key = `${SECURE_KEYS.BIOMETRIC_ENABLED}_${userId}`;
      await SecureStore.setItemAsync(key, 'true');
      console.log('[BiometricAuth] Biometric enabled for user:', userId);
      return true;
    } catch (error) {
      console.error('[BiometricAuth] Error enabling biometric:', error);
      return false;
    }
  }

  // Disable biometric for user
  async disableBiometric(userId: string): Promise<boolean> {
    try {
      const key = `${SECURE_KEYS.BIOMETRIC_ENABLED}_${userId}`;
      await SecureStore.deleteItemAsync(key);
      await this.clearCredentials();
      console.log('[BiometricAuth] Biometric disabled for user:', userId);
      return true;
    } catch (error) {
      console.error('[BiometricAuth] Error disabling biometric:', error);
      return false;
    }
  }

  // Check if user has been prompted for biometric enrollment
  async hasBeenPrompted(userId: string): Promise<boolean> {
    try {
      const key = `${SECURE_KEYS.BIOMETRIC_PROMPTED}_${userId}`;
      const prompted = await SecureStore.getItemAsync(key);
      return prompted === 'true';
    } catch (error) {
      console.error('[BiometricAuth] Error checking prompted status:', error);
      return false;
    }
  }

  // Mark user as prompted for biometric enrollment
  async markAsPrompted(userId: string): Promise<void> {
    try {
      const key = `${SECURE_KEYS.BIOMETRIC_PROMPTED}_${userId}`;
      await SecureStore.setItemAsync(key, 'true');
    } catch (error) {
      console.error('[BiometricAuth] Error marking as prompted:', error);
    }
  }

  // Reset prompted status (for testing or settings change)
  async resetPromptedStatus(userId: string): Promise<void> {
    try {
      const key = `${SECURE_KEYS.BIOMETRIC_PROMPTED}_${userId}`;
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('[BiometricAuth] Error resetting prompted status:', error);
    }
  }

  // Store auth token securely
  async storeToken(token: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(SECURE_KEYS.AUTH_TOKEN, token);
      return true;
    } catch (error) {
      console.error('[BiometricAuth] Error storing token:', error);
      return false;
    }
  }

  // Get auth token from secure storage
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(SECURE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('[BiometricAuth] Error getting token:', error);
      return null;
    }
  }

  // Clear auth token
  async clearToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SECURE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('[BiometricAuth] Error clearing token:', error);
    }
  }

  // Get human-readable biometric type name
  getBiometricTypeName(type: BiometricType, language: 'en' | 'ar' = 'en'): string {
    const names = {
      en: {
        face: 'Face ID',
        fingerprint: 'Fingerprint',
        iris: 'Iris',
        none: 'None',
      },
      ar: {
        face: 'بصمة الوجه',
        fingerprint: 'بصمة الإصبع',
        iris: 'قزحية العين',
        none: 'غير متوفر',
      },
    };
    return names[language][type] || names.en[type];
  }

  // Full biometric login flow
  async authenticateWithBiometric(reason?: string): Promise<{ success: boolean; credentials?: StoredCredentials }> {
    try {
      // Check if biometric is available
      const capability = await this.isDeviceSupported();
      if (!capability.isSupported) {
        return { success: false };
      }

      // Check if we have stored credentials
      const credentials = await this.getStoredCredentials();
      if (!credentials) {
        return { success: false };
      }

      // Prompt for biometric
      const biometricTypeName = this.getBiometricTypeName(capability.biometricType);
      const authenticated = await this.promptBiometric(
        reason || `Use ${biometricTypeName} to login`
      );

      if (authenticated) {
        return { success: true, credentials };
      }

      return { success: false };
    } catch (error) {
      console.error('[BiometricAuth] Error in authenticateWithBiometric:', error);
      return { success: false };
    }
  }

  // Clear all biometric data (for logout)
  async clearAll(): Promise<void> {
    try {
      await this.clearCredentials();
      await this.clearToken();
      console.log('[BiometricAuth] All data cleared');
    } catch (error) {
      console.error('[BiometricAuth] Error clearing all data:', error);
    }
  }
}

// Export singleton instance
export const biometricAuth = new BiometricAuthService();

// Export class for testing
export { BiometricAuthService };
