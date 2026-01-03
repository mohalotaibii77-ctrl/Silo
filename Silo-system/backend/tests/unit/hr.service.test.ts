/**
 * HR SERVICE UNIT TESTS
 * Tests for pure functions: distance calculation, working hours, working days, attendance status
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HRService } from '../../src/services/hr.service';

describe('HRService', () => {
  let hrService: HRService;

  beforeEach(() => {
    hrService = new HRService();
  });

  // =====================================================
  // DISTANCE CALCULATION (Haversine Formula)
  // =====================================================
  describe('calculateDistance', () => {
    it('should return 0 for same coordinates', () => {
      const distance = hrService.calculateDistance(25.0, 45.0, 25.0, 45.0);
      expect(distance).toBe(0);
    });

    it('should calculate distance correctly for known locations', () => {
      // Riyadh to Jeddah (approximately 950km)
      const riyadhLat = 24.7136;
      const riyadhLon = 46.6753;
      const jeddahLat = 21.4858;
      const jeddahLon = 39.1925;

      const distance = hrService.calculateDistance(riyadhLat, riyadhLon, jeddahLat, jeddahLon);

      // Should be approximately 950km (950,000 meters) with some tolerance
      expect(distance).toBeGreaterThan(800000);
      expect(distance).toBeLessThan(1100000);
    });

    it('should calculate short distances accurately (100 meters)', () => {
      // Two points approximately 100 meters apart
      const lat1 = 25.0;
      const lon1 = 45.0;
      // Moving ~100m east at this latitude
      const lat2 = 25.0;
      const lon2 = 45.001; // ~100m at this latitude

      const distance = hrService.calculateDistance(lat1, lon1, lat2, lon2);

      // Should be close to 100 meters (with some tolerance)
      expect(distance).toBeGreaterThan(80);
      expect(distance).toBeLessThan(120);
    });

    it('should be symmetric (A to B = B to A)', () => {
      const lat1 = 25.0;
      const lon1 = 45.0;
      const lat2 = 26.0;
      const lon2 = 46.0;

      const distanceAtoB = hrService.calculateDistance(lat1, lon1, lat2, lon2);
      const distanceBtoA = hrService.calculateDistance(lat2, lon2, lat1, lon1);

      expect(distanceAtoB).toBeCloseTo(distanceBtoA, 5);
    });

    it('should handle negative coordinates (western/southern hemispheres)', () => {
      // New York to Sao Paulo
      const nyLat = 40.7128;
      const nyLon = -74.0060;
      const spLat = -23.5505;
      const spLon = -46.6333;

      const distance = hrService.calculateDistance(nyLat, nyLon, spLat, spLon);

      // Should be approximately 7,700km
      expect(distance).toBeGreaterThan(7500000);
      expect(distance).toBeLessThan(8000000);
    });

    it('should handle crossing the prime meridian', () => {
      // London to Paris
      const londonLat = 51.5074;
      const londonLon = -0.1278;
      const parisLat = 48.8566;
      const parisLon = 2.3522;

      const distance = hrService.calculateDistance(londonLat, londonLon, parisLat, parisLon);

      // Should be approximately 340km
      expect(distance).toBeGreaterThan(300000);
      expect(distance).toBeLessThan(400000);
    });
  });

  // =====================================================
  // WORKING HOURS VALIDATION
  // =====================================================
  describe('isWithinWorkingHours', () => {
    it('should return true when current time is within working hours', () => {
      const currentTime = new Date('2026-01-02T10:00:00'); // 10:00 AM
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '09:00',
        '17:00',
        15, // buffer before
        30  // buffer after
      );
      expect(result).toBe(true);
    });

    it('should return true when within buffer before opening', () => {
      const currentTime = new Date('2026-01-02T08:50:00'); // 8:50 AM (10 min before 9:00)
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '09:00',
        '17:00',
        15, // buffer before
        30  // buffer after
      );
      expect(result).toBe(true);
    });

    it('should return true when within buffer after closing', () => {
      const currentTime = new Date('2026-01-02T17:20:00'); // 5:20 PM (20 min after 5:00)
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '09:00',
        '17:00',
        15, // buffer before
        30  // buffer after
      );
      expect(result).toBe(true);
    });

    it('should return false when before buffer start', () => {
      const currentTime = new Date('2026-01-02T08:40:00'); // 8:40 AM (20 min before 9:00, buffer is 15)
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '09:00',
        '17:00',
        15, // buffer before
        30  // buffer after
      );
      expect(result).toBe(false);
    });

    it('should return false when after buffer end', () => {
      const currentTime = new Date('2026-01-02T17:35:00'); // 5:35 PM (35 min after 5:00, buffer is 30)
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '09:00',
        '17:00',
        15, // buffer before
        30  // buffer after
      );
      expect(result).toBe(false);
    });

    it('should handle overnight shifts correctly (inside hours)', () => {
      const currentTime = new Date('2026-01-02T23:30:00'); // 11:30 PM
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '22:00',
        '06:00',
        15,
        30
      );
      expect(result).toBe(true);
    });

    it('should handle overnight shifts correctly (early morning)', () => {
      const currentTime = new Date('2026-01-02T02:00:00'); // 2:00 AM
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '22:00',
        '06:00',
        15,
        30
      );
      expect(result).toBe(true);
    });

    it('should handle overnight shifts correctly (outside hours)', () => {
      const currentTime = new Date('2026-01-02T12:00:00'); // 12:00 PM (noon)
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '22:00',
        '06:00',
        15,
        30
      );
      expect(result).toBe(false);
    });

    it('should return true exactly at opening time', () => {
      const currentTime = new Date('2026-01-02T09:00:00');
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '09:00',
        '17:00',
        0, // no buffer
        0
      );
      expect(result).toBe(true);
    });

    it('should return true exactly at closing time', () => {
      const currentTime = new Date('2026-01-02T17:00:00');
      const result = hrService.isWithinWorkingHours(
        currentTime,
        '09:00',
        '17:00',
        0, // no buffer
        0
      );
      expect(result).toBe(true);
    });
  });

  // =====================================================
  // WORKING DAY VALIDATION
  // =====================================================
  describe('isWorkingDay', () => {
    it('should return true for a working day', () => {
      // January 5, 2026 is a Monday
      const date = new Date('2026-01-05');
      const workingDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

      const result = hrService.isWorkingDay(date, workingDays);
      expect(result).toBe(true);
    });

    it('should return false for a rest day', () => {
      // January 2, 2026 is a Friday (rest day in Middle East schedule)
      const date = new Date('2026-01-02');
      const workingDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'];

      const result = hrService.isWorkingDay(date, workingDays);
      expect(result).toBe(false);
    });

    it('should handle case-insensitive day names', () => {
      // Sunday, January 4, 2026
      const date = new Date('2026-01-04');
      const workingDays = ['SUNDAY', 'Monday', 'TUESDAY'];

      const result = hrService.isWorkingDay(date, workingDays);
      expect(result).toBe(true);
    });

    it('should return false for empty working days array', () => {
      const date = new Date('2026-01-02');
      const workingDays: string[] = [];

      const result = hrService.isWorkingDay(date, workingDays);
      expect(result).toBe(false);
    });

    it('should handle all days as working days', () => {
      // Test every day of the week
      const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      for (let i = 0; i < 7; i++) {
        const date = new Date('2026-01-04'); // Sunday
        date.setDate(date.getDate() + i);
        expect(hrService.isWorkingDay(date, allDays)).toBe(true);
      }
    });

    it('should correctly identify Saturday', () => {
      // Saturday, January 10, 2026
      const date = new Date('2026-01-10');
      const workingDays = ['saturday'];

      const result = hrService.isWorkingDay(date, workingDays);
      expect(result).toBe(true);
    });
  });

  // =====================================================
  // ATTENDANCE STATUS CALCULATION
  // =====================================================
  describe('calculateAttendanceStatus', () => {
    it('should return on_time when checking in before scheduled start', () => {
      const checkinTime = new Date('2026-01-02T08:45:00'); // 8:45 AM
      const scheduledStart = '09:00';
      const buffer = 15;

      const result = hrService.calculateAttendanceStatus(checkinTime, scheduledStart, buffer);

      expect(result.status).toBe('on_time');
      expect(result.late_minutes).toBe(0);
    });

    it('should return on_time when checking in exactly at scheduled start', () => {
      const checkinTime = new Date('2026-01-02T09:00:00'); // 9:00 AM
      const scheduledStart = '09:00';
      const buffer = 15;

      const result = hrService.calculateAttendanceStatus(checkinTime, scheduledStart, buffer);

      expect(result.status).toBe('on_time');
      expect(result.late_minutes).toBe(0);
    });

    it('should return late with correct minutes when checking in after scheduled start', () => {
      const checkinTime = new Date('2026-01-02T09:15:00'); // 9:15 AM
      const scheduledStart = '09:00';
      const buffer = 15;

      const result = hrService.calculateAttendanceStatus(checkinTime, scheduledStart, buffer);

      expect(result.status).toBe('late');
      expect(result.late_minutes).toBe(15);
    });

    it('should return late with exact minutes calculation', () => {
      const checkinTime = new Date('2026-01-02T09:23:00'); // 9:23 AM
      const scheduledStart = '09:00';
      const buffer = 15;

      const result = hrService.calculateAttendanceStatus(checkinTime, scheduledStart, buffer);

      expect(result.status).toBe('late');
      expect(result.late_minutes).toBe(23);
    });

    it('should handle afternoon scheduled start', () => {
      const checkinTime = new Date('2026-01-02T14:30:00'); // 2:30 PM
      const scheduledStart = '14:00';
      const buffer = 15;

      const result = hrService.calculateAttendanceStatus(checkinTime, scheduledStart, buffer);

      expect(result.status).toBe('late');
      expect(result.late_minutes).toBe(30);
    });

    it('should return on_time for early check-in by hours', () => {
      const checkinTime = new Date('2026-01-02T07:00:00'); // 7:00 AM
      const scheduledStart = '09:00';
      const buffer = 15;

      const result = hrService.calculateAttendanceStatus(checkinTime, scheduledStart, buffer);

      expect(result.status).toBe('on_time');
      expect(result.late_minutes).toBe(0);
    });

    it('should calculate correctly for very late check-in', () => {
      const checkinTime = new Date('2026-01-02T11:00:00'); // 11:00 AM
      const scheduledStart = '09:00';
      const buffer = 15;

      const result = hrService.calculateAttendanceStatus(checkinTime, scheduledStart, buffer);

      expect(result.status).toBe('late');
      expect(result.late_minutes).toBe(120); // 2 hours late
    });

    it('should ignore buffer for status calculation (buffer only affects window)', () => {
      // Note: buffer is for working hours validation, not status calculation
      const checkinTime = new Date('2026-01-02T09:10:00'); // 9:10 AM
      const scheduledStart = '09:00';
      const buffer = 15; // Buffer doesn't make 9:10 "on time"

      const result = hrService.calculateAttendanceStatus(checkinTime, scheduledStart, buffer);

      expect(result.status).toBe('late');
      expect(result.late_minutes).toBe(10);
    });
  });
});
