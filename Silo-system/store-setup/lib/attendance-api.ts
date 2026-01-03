/**
 * Attendance API Client
 * Handles employee attendance records API calls for owners/managers
 *
 * IMPORTANT: Uses shared api client from './api' which has baseURL set to
 * NEXT_PUBLIC_API_URL (e.g., http://localhost:9000/api)
 * All paths should NOT include '/api' prefix as it's already in the baseURL
 */

import api from './api';

export type AttendanceStatus = 'on_time' | 'late' | 'absent' | 'checked_in' | 'checked_out' | 'rest_day';

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_role: string;
  date: string;
  day_name: string;
  checkin_time: string | null;
  checkout_time: string | null;
  total_hours: number | null;
  status: AttendanceStatus;
  late_minutes: number;
  branch_name: string | null;
}

export interface AttendanceSummary {
  total_records: number;
  on_time: number;
  late: number;
  absent: number;
  checked_in: number;
}

export interface AttendanceResponse {
  records: AttendanceRecord[];
  summary: AttendanceSummary;
}

export interface GetAttendanceParams {
  start_date?: string;
  end_date?: string;
  branch_id?: number;
}

/**
 * Get attendance records for all employees in the business
 * @param params - Query parameters for filtering
 * @returns Attendance records with summary
 */
export async function getEmployeesAttendance(params?: GetAttendanceParams): Promise<AttendanceResponse> {
  const response = await api.get('/hr/attendance/employees', { params });
  return response.data.data;
}

/**
 * Get attendance summary for a specific employee
 * @param employeeId - Employee ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 */
export async function getEmployeeAttendanceSummary(
  employeeId: number,
  startDate?: string,
  endDate?: string
) {
  const response = await api.get(`/hr/attendance/summary/${employeeId}`, {
    params: { start_date: startDate, end_date: endDate },
  });
  return response.data.data;
}
