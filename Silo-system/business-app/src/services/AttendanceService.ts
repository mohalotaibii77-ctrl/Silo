/**
 * ATTENDANCE SERVICE
 * Handles employee check-in/out with GPS validation
 */

import api from '../api/client';
import { locationService, GPSLocation } from './LocationService';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Check-in/out error codes from backend
export type AttendanceErrorCode =
  | 'OUTSIDE_GEOFENCE'
  | 'OUTSIDE_WORKING_HOURS'
  | 'NOT_WORKING_DAY'
  | 'GPS_ACCURACY_LOW'
  | 'GEOFENCE_NOT_CONFIGURED'
  | 'ALREADY_CHECKED_IN'
  | 'NOT_CHECKED_IN'
  | 'PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE';

export type AttendanceStatus = 'on_time' | 'late' | 'absent' | 'checked_in' | 'checked_out' | 'rest_day';

export interface CheckInResult {
  success: boolean;
  data?: {
    attendance_id: number;
    checkin_time: string;
    distance_meters: number;
    within_geofence: boolean;
    branch_name: string;
    status: 'on_time' | 'late';
    late_minutes: number;
  };
  error?: string;
  errorCode?: AttendanceErrorCode;
}

export interface AttendanceStatusResult {
  success: boolean;
  data?: {
    id: number;
    date: string;
    checkin_time: string | null;
    checkout_time: string | null;
    status: AttendanceStatus;
    late_minutes: number;
    total_hours: number | null;
  } | null;
  error?: string;
}

export interface AttendanceHistoryItem {
  date: string;
  day_name: string;
  checkin_time: string | null;
  checkout_time: string | null;
  total_hours: number | null;
  status: AttendanceStatus;
  late_minutes: number;
}

export interface AttendanceSummary {
  total_days: number;
  on_time: number;
  late: number;
  absent: number;
  rest_days: number;
}

export interface AttendanceHistoryResult {
  success: boolean;
  data?: {
    records: AttendanceHistoryItem[];
    summary: AttendanceSummary;
  };
  error?: string;
}

export interface EffectiveScheduleResult {
  success: boolean;
  data?: {
    working_days: string[];
    opening_time: string;
    closing_time: string;
    checkin_buffer_minutes_before: number;
    checkin_buffer_minutes_after: number;
    has_override: boolean;
  };
  error?: string;
}

// Get device info for logging
function getDeviceInfo() {
  return {
    platform: Platform.OS,
    os_version: Platform.Version?.toString() || 'unknown',
    app_version: Constants.expoConfig?.version || '1.0.0',
  };
}

class AttendanceService {
  /**
   * Check in with GPS location
   * Gets current location and sends to backend for validation
   */
  async checkIn(): Promise<CheckInResult> {
    try {
      // Step 1: Get current location
      const locationResult = await locationService.getLocationWithFallback(15000);

      if (!locationResult.success || !locationResult.location) {
        return {
          success: false,
          error: locationResult.error || 'Could not get location',
          errorCode: locationResult.errorCode as AttendanceErrorCode,
        };
      }

      // Step 2: Send check-in request to backend
      const response = await api.post('/hr/attendance/check-in', {
        latitude: locationResult.location.latitude,
        longitude: locationResult.location.longitude,
        accuracy: locationResult.location.accuracy,
        device_info: getDeviceInfo(),
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          error: response.data.error,
          errorCode: response.data.error_code,
        };
      }
    } catch (error: any) {
      console.error('Check-in error:', error);

      // Handle API errors
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.error || 'Check-in failed',
          errorCode: error.response.data.error_code,
        };
      }

      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  /**
   * Check out with GPS location
   */
  async checkOut(): Promise<CheckInResult> {
    try {
      // Step 1: Get current location
      const locationResult = await locationService.getLocationWithFallback(15000);

      if (!locationResult.success || !locationResult.location) {
        return {
          success: false,
          error: locationResult.error || 'Could not get location',
          errorCode: locationResult.errorCode as AttendanceErrorCode,
        };
      }

      // Step 2: Send check-out request to backend
      const response = await api.post('/hr/attendance/check-out', {
        latitude: locationResult.location.latitude,
        longitude: locationResult.location.longitude,
        accuracy: locationResult.location.accuracy,
        device_info: getDeviceInfo(),
      });

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        return {
          success: false,
          error: response.data.error,
          errorCode: response.data.error_code,
        };
      }
    } catch (error: any) {
      console.error('Check-out error:', error);

      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.error || 'Check-out failed',
          errorCode: error.response.data.error_code,
        };
      }

      return {
        success: false,
        error: 'Network error. Please check your connection.',
      };
    }
  }

  /**
   * Get current attendance status
   */
  async getStatus(): Promise<AttendanceStatusResult> {
    try {
      const response = await api.get('/hr/attendance/status');

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error('Get status error:', error);

      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get status',
      };
    }
  }

  /**
   * Get attendance history for the current user
   */
  async getHistory(startDate?: string, endDate?: string): Promise<AttendanceHistoryResult> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const url = `/hr/attendance/history${params.toString() ? '?' + params.toString() : ''}`;
      const response = await api.get(url);

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error('Get history error:', error);

      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get history',
      };
    }
  }

  /**
   * Get effective schedule for the current user
   */
  async getEffectiveSchedule(): Promise<EffectiveScheduleResult> {
    try {
      const response = await api.get('/hr/effective-schedule');

      return {
        success: true,
        data: response.data.data,
      };
    } catch (error: any) {
      console.error('Get schedule error:', error);

      return {
        success: false,
        error: error.response?.data?.error || 'Failed to get schedule',
      };
    }
  }

  /**
   * Get user-friendly error message for error code
   */
  getErrorMessage(errorCode: AttendanceErrorCode | undefined, defaultMessage: string): string {
    switch (errorCode) {
      case 'OUTSIDE_GEOFENCE':
        return 'You are too far from the restaurant. Please move closer to check in.';
      case 'OUTSIDE_WORKING_HOURS':
        return 'Check-in is only allowed during working hours.';
      case 'NOT_WORKING_DAY':
        return 'Today is a rest day. Check-in is not required.';
      case 'GPS_ACCURACY_LOW':
        return 'GPS signal is weak. Please move to an open area and try again.';
      case 'GEOFENCE_NOT_CONFIGURED':
        return 'Branch location is not configured. Please contact your manager.';
      case 'ALREADY_CHECKED_IN':
        return 'You are already checked in.';
      case 'NOT_CHECKED_IN':
        return 'You are not checked in.';
      case 'PERMISSION_DENIED':
        return 'Location permission denied. Please enable location access in settings.';
      case 'LOCATION_UNAVAILABLE':
        return 'Location services are disabled. Please enable GPS.';
      default:
        return defaultMessage;
    }
  }
}

export const attendanceService = new AttendanceService();
export default attendanceService;
