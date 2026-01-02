/**
 * OPERATIONS SERVICE
 * Tasks, checklists, daily operations
 */

import { supabaseAdmin } from '../config/database';
import { Task, Checklist } from '../types';

export class OperationsService {
  
  // ============ TASKS ============
  
  /**
   * Get tasks for a business
   */
  async getTasks(businessId: string, filters?: {
    status?: string;
    assignedTo?: string;
    priority?: string;
  }): Promise<Task[]> {
    let query = supabaseAdmin
      .from('tasks')
      .select('*, assigned_employee:employees(*)')
      .eq('business_id', businessId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }

    const { data, error } = await query.order('due_date').order('priority');
    if (error) throw new Error('Failed to fetch tasks');
    
    return data as Task[];
  }

  /**
   * Create task
   */
  async createTask(data: Partial<Task>): Promise<Task> {
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error('Failed to create task');
    return task as Task;
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, data: Partial<Task>): Promise<Task> {
    const { data: task, error } = await supabaseAdmin
      .from('tasks')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw new Error('Failed to update task');
    return task as Task;
  }

  /**
   * Complete task
   */
  async completeTask(taskId: string): Promise<Task> {
    return this.updateTask(taskId, { status: 'completed' });
  }

  // ============ CHECKLISTS ============

  /**
   * Get checklists for a business
   */
  async getChecklists(businessId: string, type?: string): Promise<Checklist[]> {
    let query = supabaseAdmin
      .from('checklists')
      .select('*')
      .eq('business_id', businessId);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query.order('name');
    if (error) throw new Error('Failed to fetch checklists');
    
    return data as Checklist[];
  }

  /**
   * Create checklist
   */
  async createChecklist(data: Partial<Checklist>): Promise<Checklist> {
    const { data: checklist, error } = await supabaseAdmin
      .from('checklists')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error('Failed to create checklist');
    return checklist as Checklist;
  }

  /**
   * Record checklist completion
   */
  async recordChecklistCompletion(data: {
    businessId: string;
    checklistId: string;
    completedBy: string;
    completedItems: string[];
    notes?: string;
  }): Promise<void> {
    const { error } = await supabaseAdmin
      .from('checklist_completions')
      .insert({
        business_id: data.businessId,
        checklist_id: data.checklistId,
        completed_by: data.completedBy,
        completed_items: data.completedItems,
        notes: data.notes,
        completed_at: new Date().toISOString(),
      });

    if (error) throw new Error('Failed to record completion');
  }

  // ============ END OF DAY ============

  /**
   * Get EOD summary
   */
  async getEODSummary(businessId: string, date: string): Promise<{
    totalOrders: number;
    totalRevenue: number;
    tasksCompleted: number;
    tasksPending: number;
    shiftsCompleted: number;
  }> {
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    // Get orders
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('total')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    // Get tasks
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('status')
      .eq('business_id', businessId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    // Get shifts
    const { count: shiftsCompleted } = await supabaseAdmin
      .from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('date', date)
      .eq('status', 'completed');

    return {
      totalOrders: orders?.length || 0,
      totalRevenue: orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0,
      tasksCompleted: tasks?.filter(t => t.status === 'completed').length || 0,
      tasksPending: tasks?.filter(t => t.status === 'pending').length || 0,
      shiftsCompleted: shiftsCompleted || 0,
    };
  }
}

export const operationsService = new OperationsService();










