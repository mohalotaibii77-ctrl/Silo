/**
 * HR SERVICE
 * Employee management, shifts, attendance
 */

import { supabaseAdmin } from '../config/database';
import { Employee, Shift } from '../types';

export class HRService {
  
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
   * Clock in employee
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
   * Clock out employee
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








