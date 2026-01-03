/**
 * HR SERVICE
 * Employee management, shifts, attendance, geofencing
 */

import { supabaseAdmin } from '../config/database';
import {
  Employee,
  Shift,
  AttendanceRecord,
  AttendanceStatusType,
  CheckInValidationResult,
  CheckInRequest,
  CheckInResponse,
  AttendanceHistoryItem,
  AttendanceSummary,
  AttendanceHistoryResponse,
  EmployeeScheduleOverride,
  EffectiveSchedule,
  GeofenceSettings,
  BranchGeofence,
} from '../types';

// Day names for display
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_DISPLAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export class HRService {

  // =====================================================
  // GEOFENCE & DISTANCE CALCULATIONS
  // =====================================================

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * @returns Distance in meters
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Check if current time is within working hours (with buffer)
   */
  isWithinWorkingHours(
    currentTime: Date,
    openingTime: string,
    closingTime: string,
    bufferBefore: number,
    bufferAfter: number
  ): boolean {
    const [openHour, openMin] = openingTime.split(':').map(Number);
    const [closeHour, closeMin] = closingTime.split(':').map(Number);

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const openingMinutes = openHour * 60 + openMin - bufferBefore;
    const closingMinutes = closeHour * 60 + closeMin + bufferAfter;

    // Handle overnight shifts
    if (closingMinutes < openingMinutes) {
      // Overnight: e.g., 22:00 to 06:00
      return currentMinutes >= openingMinutes || currentMinutes <= closingMinutes;
    }

    return currentMinutes >= openingMinutes && currentMinutes <= closingMinutes;
  }

  /**
   * Check if a date is a working day
   */
  isWorkingDay(date: Date, workingDays: string[]): boolean {
    const dayName = DAY_NAMES[date.getDay()];
    return workingDays.map(d => d.toLowerCase()).includes(dayName);
  }

  /**
   * Calculate attendance status based on check-in time
   */
  calculateAttendanceStatus(
    checkinTime: Date,
    scheduledStart: string,
    bufferMinutes: number
  ): { status: AttendanceStatusType; late_minutes: number } {
    const [hour, min] = scheduledStart.split(':').map(Number);
    const scheduledMinutes = hour * 60 + min;
    const checkinMinutes = checkinTime.getHours() * 60 + checkinTime.getMinutes();

    if (checkinMinutes <= scheduledMinutes) {
      return { status: 'on_time', late_minutes: 0 };
    } else {
      const lateMinutes = checkinMinutes - scheduledMinutes;
      return { status: 'late', late_minutes: lateMinutes };
    }
  }

  // =====================================================
  // SCHEDULE MANAGEMENT
  // =====================================================

  /**
   * Get effective schedule for an employee (override or business default)
   */
  async getEffectiveSchedule(employeeId: number, businessId: number): Promise<EffectiveSchedule> {
    // Get employee's schedule override (use maybeSingle to avoid error when no override exists)
    const { data: override } = await supabaseAdmin
      .from('employee_schedule_overrides')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    // Get business default settings (use maybeSingle to handle missing settings gracefully)
    const { data: settings } = await supabaseAdmin
      .from('operational_settings')
      .select('working_days, opening_time, closing_time, checkin_buffer_minutes_before, checkin_buffer_minutes_after')
      .eq('business_id', businessId)
      .maybeSingle();

    const defaults = {
      working_days: settings?.working_days || DAY_NAMES,
      opening_time: settings?.opening_time || '09:00',
      closing_time: settings?.closing_time || '22:00',
      checkin_buffer_minutes_before: settings?.checkin_buffer_minutes_before || 15,
      checkin_buffer_minutes_after: settings?.checkin_buffer_minutes_after || 30,
    };

    if (override) {
      return {
        working_days: override.working_days || defaults.working_days,
        opening_time: override.opening_time || defaults.opening_time,
        closing_time: override.closing_time || defaults.closing_time,
        checkin_buffer_minutes_before: override.checkin_buffer_minutes_before ?? defaults.checkin_buffer_minutes_before,
        checkin_buffer_minutes_after: override.checkin_buffer_minutes_after ?? defaults.checkin_buffer_minutes_after,
        has_override: true,
      };
    }

    return { ...defaults, has_override: false };
  }

  /**
   * Get geofence settings for a business
   */
  async getGeofenceSettings(businessId: number): Promise<GeofenceSettings> {
    const { data, error } = await supabaseAdmin
      .from('operational_settings')
      .select('*')
      .eq('business_id', businessId)
      .single();

    // Return defaults if no settings configured (allows check-in without GPS requirement)
    if (error || !data) {
      console.log(`No operational_settings found for business ${businessId}, using defaults`);
      return {
        require_gps_checkin: false, // Default: GPS not required
        checkin_buffer_minutes_before: 15,
        checkin_buffer_minutes_after: 30,
        gps_accuracy_threshold_meters: 50,
        default_geofence_radius_meters: 100,
        working_days: DAY_NAMES, // All days are working days by default
        opening_time: '00:00', // 24/7 by default
        closing_time: '23:59',
        // Checkout restrictions - defaults
        min_shift_hours: 4,
        checkout_buffer_minutes_before: 30,
        require_checkout_restrictions: true,
      };
    }

    return {
      require_gps_checkin: data.require_gps_checkin || false,
      checkin_buffer_minutes_before: data.checkin_buffer_minutes_before || 15,
      checkin_buffer_minutes_after: data.checkin_buffer_minutes_after || 30,
      gps_accuracy_threshold_meters: data.gps_accuracy_threshold_meters || 50,
      default_geofence_radius_meters: data.default_geofence_radius_meters || 100,
      working_days: data.working_days || DAY_NAMES,
      opening_time: data.opening_time || '09:00',
      closing_time: data.closing_time || '22:00',
      // Checkout restrictions
      min_shift_hours: data.min_shift_hours ?? 4,
      checkout_buffer_minutes_before: data.checkout_buffer_minutes_before ?? 30,
      require_checkout_restrictions: data.require_checkout_restrictions ?? true,
    };
  }

  /**
   * Get branch geofence configuration
   */
  async getBranchGeofence(branchId: number): Promise<BranchGeofence | null> {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('id, name, latitude, longitude, geofence_radius_meters, geofence_enabled')
      .eq('id', branchId)
      .single();

    if (error || !data) return null;

    return {
      branch_id: data.id,
      branch_name: data.name,
      latitude: data.latitude,
      longitude: data.longitude,
      geofence_radius_meters: data.geofence_radius_meters || 100,
      geofence_enabled: data.geofence_enabled || false,
    };
  }

  // =====================================================
  // ATTENDANCE CHECK-IN/OUT
  // =====================================================

  /**
   * Employee check-in with GPS validation
   */
  async checkIn(
    userId: number,
    businessId: number,
    branchId: number,
    request: CheckInRequest
  ): Promise<CheckInResponse> {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      // 1. Get employee's effective schedule
      const schedule = await this.getEffectiveSchedule(userId, businessId);

      // 2. Check if today is a working day
      if (!this.isWorkingDay(now, schedule.working_days)) {
        return {
          success: false,
          error: 'Today is not a working day',
          error_code: 'NOT_WORKING_DAY',
        };
      }

      // 3. Get geofence settings (always returns defaults if not configured)
      const settings = await this.getGeofenceSettings(businessId);

      // 4. Get branch geofence
      const branch = await this.getBranchGeofence(branchId);
      console.log(`[CHECK-IN DEBUG] Branch lookup for ID ${branchId}:`, branch);

      if (!branch) {
        console.error(`[CHECK-IN] Branch not found for ID: ${branchId}`);
        return {
          success: false,
          error: 'Branch not found. Please contact your manager.',
          error_code: 'GEOFENCE_NOT_CONFIGURED',
        };
      }

      let distance_meters = 0;
      let within_geofence = true;

      // 5. Validate GPS if required AND branch has coordinates configured
      const branchHasCoordinates = branch.latitude !== null && branch.longitude !== null;
      console.log(`[CHECK-IN DEBUG] Branch ${branch.branch_name}: hasCoords=${branchHasCoordinates}, lat=${branch.latitude}, lng=${branch.longitude}, geofenceEnabled=${branch.geofence_enabled}`);
      const shouldValidateGPS = settings.require_gps_checkin && branch.geofence_enabled && branchHasCoordinates;

      if (shouldValidateGPS) {
        // Check GPS accuracy
        if (request.accuracy > settings.gps_accuracy_threshold_meters) {
          return {
            success: false,
            error: 'GPS signal is weak. Please move to an open area.',
            error_code: 'GPS_ACCURACY_LOW',
          };
        }

        // Calculate distance
        distance_meters = this.calculateDistance(
          request.latitude,
          request.longitude,
          branch.latitude!,
          branch.longitude!
        );

        // Check geofence
        const radius = branch.geofence_radius_meters || settings.default_geofence_radius_meters;
        if (distance_meters > radius) {
          within_geofence = false;
          return {
            success: false,
            error: `You are ${Math.round(distance_meters)}m away. Must be within ${radius}m of the restaurant.`,
            error_code: 'OUTSIDE_GEOFENCE',
          };
        }
      } else if (settings.require_gps_checkin && !branchHasCoordinates) {
        // Log warning but allow check-in if branch location not configured
        console.warn(`Branch ${branch.branch_id} (${branch.branch_name}) has GPS check-in enabled but no coordinates configured. Allowing check-in without location validation.`);
      }

      // 6. Check working hours
      if (!this.isWithinWorkingHours(
        now,
        schedule.opening_time,
        schedule.closing_time,
        schedule.checkin_buffer_minutes_before,
        schedule.checkin_buffer_minutes_after
      )) {
        return {
          success: false,
          error: 'Check-in is only allowed during working hours',
          error_code: 'OUTSIDE_WORKING_HOURS',
        };
      }

      // 7. Check if already checked in today
      const { data: existingRecord } = await supabaseAdmin
        .from('attendance_records')
        .select('id, status')
        .eq('employee_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (existingRecord && existingRecord.status === 'checked_in') {
        return {
          success: false,
          error: 'You are already checked in',
          error_code: 'ALREADY_CHECKED_IN',
        };
      }

      // 8. Calculate status (on_time or late)
      const { status, late_minutes } = this.calculateAttendanceStatus(
        now,
        schedule.opening_time,
        schedule.checkin_buffer_minutes_before
      );

      // 9. Create or update attendance record
      const attendanceData = {
        business_id: businessId,
        branch_id: branchId,
        employee_id: userId,
        date: today,
        checkin_time: now.toISOString(),
        checkin_latitude: request.latitude,
        checkin_longitude: request.longitude,
        checkin_accuracy_meters: request.accuracy,
        checkin_distance_meters: distance_meters,
        checkin_device_info: request.device_info || null,
        status: 'checked_in' as AttendanceStatusType,
        late_minutes,
        updated_at: now.toISOString(),
      };

      let attendance_id: number;

      if (existingRecord) {
        // Update existing record (e.g., if they were absent and now checking in late)
        const { data: updated, error } = await supabaseAdmin
          .from('attendance_records')
          .update(attendanceData)
          .eq('id', existingRecord.id)
          .select('id')
          .single();

        if (error) throw error;
        attendance_id = updated.id;
      } else {
        // Create new record
        const { data: created, error } = await supabaseAdmin
          .from('attendance_records')
          .insert({
            ...attendanceData,
            created_at: now.toISOString(),
          })
          .select('id')
          .single();

        if (error) throw error;
        attendance_id = created.id;
      }

      return {
        success: true,
        data: {
          attendance_id,
          checkin_time: now.toISOString(),
          distance_meters: Math.round(distance_meters),
          within_geofence,
          branch_name: branch.branch_name,
          status: late_minutes > 0 ? 'late' : 'on_time',
          late_minutes,
        },
      };

    } catch (error) {
      console.error('Check-in error:', error);
      return {
        success: false,
        error: 'Failed to check in. Please try again.',
      };
    }
  }

  /**
   * Check if current time is within checkout window (before closing time)
   */
  isWithinCheckoutWindow(
    currentTime: Date,
    closingTime: string,
    bufferMinutesBefore: number
  ): boolean {
    const [closeHour, closeMin] = closingTime.split(':').map(Number);
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const closingMinutes = closeHour * 60 + closeMin;
    const earliestCheckoutMinutes = closingMinutes - bufferMinutesBefore;

    // Can checkout if current time is >= (closing - buffer)
    return currentMinutes >= earliestCheckoutMinutes;
  }

  /**
   * Employee check-out with GPS
   */
  async checkOut(
    userId: number,
    businessId: number,
    request: CheckInRequest
  ): Promise<CheckInResponse> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    try {
      // Get current attendance record
      const { data: record, error: fetchError } = await supabaseAdmin
        .from('attendance_records')
        .select('*, branches(name)')
        .eq('employee_id', userId)
        .eq('date', today)
        .eq('status', 'checked_in')
        .maybeSingle();

      if (fetchError || !record) {
        return {
          success: false,
          error: 'You are not checked in',
          error_code: 'NOT_CHECKED_IN',
        };
      }

      // Calculate total hours worked
      const checkinTime = new Date(record.checkin_time);
      const totalHours = (now.getTime() - checkinTime.getTime()) / (1000 * 60 * 60);

      // Get checkout restriction settings
      const settings = await this.getGeofenceSettings(businessId);
      const schedule = await this.getEffectiveSchedule(userId, businessId);

      // Validate checkout restrictions if enabled
      if (settings.require_checkout_restrictions) {
        // Check 1: Minimum shift hours
        if (totalHours < settings.min_shift_hours) {
          const remainingMinutes = Math.ceil((settings.min_shift_hours - totalHours) * 60);
          return {
            success: false,
            error: `You must work at least ${settings.min_shift_hours} hours before checking out. ${remainingMinutes} minutes remaining.`,
            error_code: 'MIN_HOURS_NOT_MET',
          };
        }

        // Check 2: Within checkout window (near closing time)
        if (!this.isWithinCheckoutWindow(now, schedule.closing_time, settings.checkout_buffer_minutes_before)) {
          const [closeHour, closeMin] = schedule.closing_time.split(':').map(Number);
          const earliestCheckoutMinutes = (closeHour * 60 + closeMin) - settings.checkout_buffer_minutes_before;
          const earliestHour = Math.floor(earliestCheckoutMinutes / 60);
          const earliestMin = earliestCheckoutMinutes % 60;
          const earliestTimeStr = `${earliestHour.toString().padStart(2, '0')}:${earliestMin.toString().padStart(2, '0')}`;

          return {
            success: false,
            error: `Checkout is only allowed ${settings.checkout_buffer_minutes_before} minutes before closing time. You can checkout after ${earliestTimeStr}.`,
            error_code: 'OUTSIDE_CHECKOUT_WINDOW',
          };
        }
      }

      // Determine final status based on late_minutes
      const finalStatus: AttendanceStatusType = record.late_minutes > 0 ? 'late' : 'on_time';

      // Calculate distance (optional for checkout)
      let distance_meters = 0;
      if (record.branch_id) {
        const branch = await this.getBranchGeofence(record.branch_id);
        if (branch && branch.latitude && branch.longitude) {
          distance_meters = this.calculateDistance(
            request.latitude,
            request.longitude,
            branch.latitude,
            branch.longitude
          );
        }
      }

      // Update attendance record
      const { error: updateError } = await supabaseAdmin
        .from('attendance_records')
        .update({
          checkout_time: now.toISOString(),
          checkout_latitude: request.latitude,
          checkout_longitude: request.longitude,
          checkout_accuracy_meters: request.accuracy,
          checkout_distance_meters: distance_meters,
          checkout_device_info: request.device_info || null,
          total_hours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
          status: finalStatus,
          updated_at: now.toISOString(),
        })
        .eq('id', record.id);

      if (updateError) throw updateError;

      return {
        success: true,
        data: {
          attendance_id: record.id,
          checkin_time: record.checkin_time,
          distance_meters: Math.round(distance_meters),
          within_geofence: true,
          branch_name: record.branches?.name || 'Unknown',
          status: finalStatus,
          late_minutes: record.late_minutes,
        },
      };

    } catch (error) {
      console.error('Check-out error:', error);
      return {
        success: false,
        error: 'Failed to check out. Please try again.',
      };
    }
  }

  /**
   * Get current attendance status for an employee
   */
  async getAttendanceStatus(userId: number): Promise<AttendanceRecord | null> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('attendance_records')
      .select('*, branches(name)')
      .eq('employee_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (error || !data) return null;
    return data as AttendanceRecord;
  }

  /**
   * Get attendance records for all employees in a business (owner/manager view)
   */
  async getEmployeesAttendance(
    businessId: number,
    branchId: number | null,
    startDate: string,
    endDate: string
  ): Promise<{
    records: Array<{
      id: number;
      employee_id: number;
      employee_name: string;
      employee_role: string;
      date: string;
      day_name: string;
      checkin_time: string | null;
      checkout_time: string | null;
      total_hours: number | null;
      status: AttendanceStatusType;
      late_minutes: number;
      branch_name: string | null;
    }>;
    summary: {
      total_records: number;
      on_time: number;
      late: number;
      absent: number;
      checked_in: number;
    };
  }> {
    // Build query for attendance records
    let query = supabaseAdmin
      .from('attendance_records')
      .select(`
        id,
        employee_id,
        date,
        checkin_time,
        checkout_time,
        total_hours,
        status,
        late_minutes,
        branch_id,
        branches(name)
      `)
      .eq('business_id', businessId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('checkin_time', { ascending: false });

    // Filter by branch if specified
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: records, error } = await query;

    if (error) throw error;

    // Get all employees for the business to include their names
    let employeesQuery = supabaseAdmin
      .from('business_users')
      .select('id, first_name, last_name, role')
      .eq('business_id', businessId)
      .in('role', ['employee', 'manager', 'operations_manager']);

    if (branchId) {
      employeesQuery = employeesQuery.eq('branch_id', branchId);
    }

    const { data: employees } = await employeesQuery;

    // Create employee map for quick lookup
    const employeeMap = new Map(
      (employees || []).map(e => [
        e.id,
        {
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
          role: e.role,
        },
      ])
    );

    // Transform records with employee info
    const transformedRecords = (records || []).map(record => {
      const employee = employeeMap.get(record.employee_id);
      const recordDate = new Date(record.date);
      const dayName = DAY_DISPLAY_NAMES[recordDate.getDay()];

      return {
        id: record.id,
        employee_id: record.employee_id,
        employee_name: employee?.name || 'Unknown',
        employee_role: employee?.role || 'unknown',
        date: record.date,
        day_name: dayName,
        checkin_time: record.checkin_time
          ? new Date(record.checkin_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null,
        checkout_time: record.checkout_time
          ? new Date(record.checkout_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : null,
        total_hours: record.total_hours,
        status: record.status as AttendanceStatusType,
        late_minutes: record.late_minutes || 0,
        branch_name: (record.branches as any)?.name || null,
      };
    });

    // Calculate summary
    const summary = {
      total_records: transformedRecords.length,
      on_time: transformedRecords.filter(r => r.status === 'on_time').length,
      late: transformedRecords.filter(r => r.status === 'late').length,
      absent: transformedRecords.filter(r => r.status === 'absent').length,
      checked_in: transformedRecords.filter(r => r.status === 'checked_in').length,
    };

    return { records: transformedRecords, summary };
  }

  /**
   * Get attendance history for an employee
   */
  async getAttendanceHistory(
    userId: number,
    businessId: number,
    startDate: string,
    endDate: string
  ): Promise<AttendanceHistoryResponse> {
    // Get attendance records
    const { data: records, error } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('employee_id', userId)
      .eq('business_id', businessId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw error;

    // Get employee's effective schedule for working days
    const schedule = await this.getEffectiveSchedule(userId, businessId);

    // Build history with all dates including rest days and absences
    const historyItems: AttendanceHistoryItem[] = [];
    const summary: AttendanceSummary = {
      total_days: 0,
      on_time: 0,
      late: 0,
      absent: 0,
      rest_days: 0,
    };

    // Create a map of records by date
    const recordsByDate = new Map<string, any>();
    (records || []).forEach(r => recordsByDate.set(r.date, r));

    // Iterate through all dates in range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date().toISOString().split('T')[0];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Skip future dates
      if (dateStr > today) continue;

      const dayName = DAY_DISPLAY_NAMES[d.getDay()];
      const isWorkingDay = this.isWorkingDay(d, schedule.working_days);

      const record = recordsByDate.get(dateStr);

      if (!isWorkingDay) {
        // Rest day
        historyItems.push({
          date: dateStr,
          day_name: dayName,
          checkin_time: null,
          checkout_time: null,
          total_hours: null,
          status: 'rest_day',
          late_minutes: 0,
        });
        summary.rest_days++;
      } else if (record) {
        // Has record
        historyItems.push({
          date: dateStr,
          day_name: dayName,
          checkin_time: record.checkin_time ? new Date(record.checkin_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
          checkout_time: record.checkout_time ? new Date(record.checkout_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
          total_hours: record.total_hours,
          status: record.status,
          late_minutes: record.late_minutes || 0,
        });

        summary.total_days++;
        if (record.status === 'on_time' || record.status === 'checked_out') {
          if (record.late_minutes === 0) summary.on_time++;
          else summary.late++;
        } else if (record.status === 'late') {
          summary.late++;
        } else if (record.status === 'absent') {
          summary.absent++;
        } else if (record.status === 'checked_in') {
          // Still checked in today
          if (record.late_minutes > 0) summary.late++;
          else summary.on_time++;
        }
      } else {
        // Working day with no record = absent
        historyItems.push({
          date: dateStr,
          day_name: dayName,
          checkin_time: null,
          checkout_time: null,
          total_hours: null,
          status: 'absent',
          late_minutes: 0,
        });
        summary.total_days++;
        summary.absent++;
      }
    }

    return { records: historyItems, summary };
  }

  // =====================================================
  // SCHEDULE OVERRIDES (Special Attendance)
  // =====================================================

  /**
   * Get all schedule overrides for a business
   */
  async getScheduleOverrides(businessId: number): Promise<EmployeeScheduleOverride[]> {
    console.log('[HR Service] Getting schedule overrides for business:', businessId);

    // First, get the overrides
    const { data: overrides, error: overridesError } = await supabaseAdmin
      .from('employee_schedule_overrides')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (overridesError) {
      console.error('[HR Service] Error fetching overrides:', overridesError);
      throw overridesError;
    }

    console.log('[HR Service] Found overrides:', overrides?.length || 0);

    if (!overrides || overrides.length === 0) {
      return [];
    }

    // Get employee info for each override
    const employeeIds = overrides.map(o => o.employee_id);
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('business_users')
      .select('id, first_name, last_name, role')
      .in('id', employeeIds);

    if (employeesError) {
      console.error('Error fetching employees for overrides:', employeesError);
      // Return overrides without employee names if lookup fails
      return overrides;
    }

    // Create a map for quick lookup
    const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);

    return overrides.map(d => {
      const employee = employeeMap.get(d.employee_id);
      return {
        ...d,
        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown',
        employee_role: employee?.role,
      };
    });
  }

  /**
   * Get schedule override for a specific employee
   */
  async getScheduleOverride(employeeId: number, businessId: number): Promise<EmployeeScheduleOverride | null> {
    const { data, error } = await supabaseAdmin
      .from('employee_schedule_overrides')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  /**
   * Create or update schedule override
   */
  async upsertScheduleOverride(
    employeeId: number,
    businessId: number,
    override: Partial<EmployeeScheduleOverride>
  ): Promise<EmployeeScheduleOverride> {
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('employee_schedule_overrides')
      .upsert({
        employee_id: employeeId,
        business_id: businessId,
        working_days: override.working_days,
        opening_time: override.opening_time,
        closing_time: override.closing_time,
        checkin_buffer_minutes_before: override.checkin_buffer_minutes_before,
        checkin_buffer_minutes_after: override.checkin_buffer_minutes_after,
        notes: override.notes,
        is_active: override.is_active ?? true,
        updated_at: now,
      }, {
        onConflict: 'business_id,employee_id',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete schedule override
   */
  async deleteScheduleOverride(employeeId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('employee_schedule_overrides')
      .delete()
      .eq('employee_id', employeeId)
      .eq('business_id', businessId);

    if (error) throw error;
  }

  // =====================================================
  // EXISTING EMPLOYEE/SHIFT METHODS
  // =====================================================

  /**
   * Get all employees for a business
   */
  async getEmployees(businessId: string): Promise<Employee[]> {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('first_name');

    if (error) throw new Error('Failed to fetch employees');
    return data as Employee[];
  }

  /**
   * Get single employee
   */
  async getEmployee(employeeId: string): Promise<Employee | null> {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (error) return null;
    return data as Employee;
  }

  /**
   * Create employee
   */
  async createEmployee(data: Partial<Employee>): Promise<Employee> {
    // Generate employee code
    const code = await this.generateEmployeeCode(data.business_id!);

    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .insert({ ...data, employee_code: code })
      .select()
      .single();

    if (error) throw new Error('Failed to create employee');
    return employee as Employee;
  }

  /**
   * Update employee
   */
  async updateEmployee(employeeId: string, data: Partial<Employee>): Promise<Employee> {
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw new Error('Failed to update employee');
    return employee as Employee;
  }

  /**
   * Create shift
   */
  async createShift(data: Partial<Shift>): Promise<Shift> {
    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error('Failed to create shift');
    return shift as Shift;
  }

  /**
   * Get shifts for date range
   */
  async getShifts(businessId: string, startDate: string, endDate: string): Promise<Shift[]> {
    const { data, error } = await supabaseAdmin
      .from('shifts')
      .select('*, employees(*)')
      .eq('business_id', businessId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('start_time');

    if (error) throw new Error('Failed to fetch shifts');
    return data as Shift[];
  }

  /**
   * Clock in employee (legacy shift-based)
   */
  async clockIn(shiftId: string): Promise<Shift> {
    const { data, error } = await supabaseAdmin
      .from('shifts')
      .update({
        actual_start: new Date().toISOString(),
        status: 'started',
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw new Error('Failed to clock in');
    return data as Shift;
  }

  /**
   * Clock out employee (legacy shift-based)
   */
  async clockOut(shiftId: string): Promise<Shift> {
    const { data, error } = await supabaseAdmin
      .from('shifts')
      .update({
        actual_end: new Date().toISOString(),
        status: 'completed',
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw new Error('Failed to clock out');
    return data as Shift;
  }

  /**
   * Generate employee code
   */
  private async generateEmployeeCode(businessId: string): Promise<string> {
    const { count } = await supabaseAdmin
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    return `EMP${String((count || 0) + 1).padStart(4, '0')}`;
  }
}

export const hrService = new HRService();

