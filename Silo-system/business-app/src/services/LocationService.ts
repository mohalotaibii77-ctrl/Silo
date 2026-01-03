/**
 * LOCATION SERVICE
 * Handles GPS permissions and location fetching for employee check-in
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface LocationResult {
  success: boolean;
  location?: GPSLocation;
  error?: string;
  errorCode?: 'PERMISSION_DENIED' | 'LOCATION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';
}

class LocationService {
  private permissionGranted: boolean = false;

  /**
   * Request location permissions
   * Returns true if permissions are granted
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // First check current permission status
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      if (existingStatus === 'granted') {
        this.permissionGranted = true;
        return true;
      }

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.permissionGranted = status === 'granted';

      return this.permissionGranted;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Check if location permission is granted
   */
  async hasPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      this.permissionGranted = status === 'granted';
      return this.permissionGranted;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current location with high accuracy
   * Used for GPS check-in validation
   */
  async getCurrentLocation(): Promise<LocationResult> {
    try {
      // Check permissions first
      if (!this.permissionGranted) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return {
            success: false,
            error: 'Location permission denied. Please enable location access in settings.',
            errorCode: 'PERMISSION_DENIED',
          };
        }
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        return {
          success: false,
          error: 'Location services are disabled. Please enable GPS.',
          errorCode: 'LOCATION_UNAVAILABLE',
        };
      }

      // Get current position with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        // Android-specific: use GPS provider for better accuracy
        ...(Platform.OS === 'android' && {
          mayShowUserSettingsDialog: true,
        }),
      });

      return {
        success: true,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
        },
      };
    } catch (error: any) {
      console.error('Error getting location:', error);

      // Handle specific error cases
      if (error.code === 'E_LOCATION_SERVICES_DISABLED') {
        return {
          success: false,
          error: 'Location services are disabled. Please enable GPS.',
          errorCode: 'LOCATION_UNAVAILABLE',
        };
      }

      if (error.code === 'E_LOCATION_TIMEOUT') {
        return {
          success: false,
          error: 'Could not get location. Please try again in an open area.',
          errorCode: 'TIMEOUT',
        };
      }

      return {
        success: false,
        error: 'Failed to get location. Please try again.',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Get location with timeout (for check-in scenarios)
   * Will retry with lower accuracy if high accuracy times out
   */
  async getLocationWithFallback(timeoutMs: number = 15000): Promise<LocationResult> {
    try {
      // Check permissions first
      if (!this.permissionGranted) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return {
            success: false,
            error: 'Location permission denied. Please enable location access in settings.',
            errorCode: 'PERMISSION_DENIED',
          };
        }
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        return {
          success: false,
          error: 'Location services are disabled. Please enable GPS.',
          errorCode: 'LOCATION_UNAVAILABLE',
        };
      }

      // Try high accuracy first
      try {
        const location = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
          ),
        ]);

        return {
          success: true,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
          },
        };
      } catch (highAccuracyError) {
        // Fallback to balanced accuracy
        console.log('High accuracy timed out, trying balanced...');

        const location = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs / 2)
          ),
        ]);

        return {
          success: true,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
          },
        };
      }
    } catch (error: any) {
      console.error('Error getting location with fallback:', error);

      if (error.message === 'TIMEOUT') {
        return {
          success: false,
          error: 'Could not get GPS signal. Please move to an open area.',
          errorCode: 'TIMEOUT',
        };
      }

      return {
        success: false,
        error: 'Failed to get location. Please try again.',
        errorCode: 'UNKNOWN',
      };
    }
  }
}

export const locationService = new LocationService();
export default locationService;
