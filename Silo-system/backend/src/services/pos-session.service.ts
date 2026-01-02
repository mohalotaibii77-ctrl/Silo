import { supabaseAdmin } from '../config/database';
import { posService } from './pos.service';

export interface POSSession {
  id: number;
  business_id: number;
  branch_id?: number;
  session_number: string;
  cashier_id: number;
  cashier_name: string;
  opened_at: string;
  closed_at?: string;
  opening_float: number;
  total_cash_sales: number;
  total_cash_received: number;
  total_change_given: number;
  expected_cash?: number;
  actual_cash_count?: number;
  variance?: number;
  status: 'open' | 'closed' | 'suspended';
  opening_notes?: string;
  closing_notes?: string;
}

export interface POSCashAdjustment {
  id: number;
  pos_session_id: number;
  adjustment_type: 'cash_in' | 'cash_out' | 'correction';
  amount: number;
  reason: string;
  performed_by?: number;
  performed_at: string;
}

class POSSessionService {
  /**
   * Generate session number
   */
  private async generateSessionNumber(businessId: number): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const { count } = await supabaseAdmin
      .from('pos_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('opened_at', today.toISOString().split('T')[0]);

    const sessionNum = (count || 0) + 1;
    return `POS-${dateStr}-${sessionNum.toString().padStart(3, '0')}`;
  }

  /**
   * Get employees with POS access permission
   */
  async getPOSEmployees(businessId: number, branchId?: number): Promise<any[]> {
    let query = supabaseAdmin
      .from('business_users')
      .select('id, username, first_name, last_name, role, branch_id, permissions')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .in('role', ['owner', 'manager', 'employee']);

    if (branchId) {
      // Include users assigned to this branch OR unassigned (business-wide)
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch POS employees: ${error.message}`);

    // Filter to only those with pos_access permission (owners always have access)
    const posEmployees = (data || []).filter((user: any) => {
      if (user.role === 'owner') return true;
      if (!user.permissions) return false;
      return user.permissions.pos_access === true;
    });

    return posEmployees.map((user: any) => ({
      id: user.id,
      username: user.username,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
      role: user.role,
    }));
  }

  /**
   * Get active session for a cashier
   */
  async getActiveSession(cashierId: number): Promise<POSSession | null> {
    const { data, error } = await supabaseAdmin
      .from('pos_sessions')
      .select('*')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw new Error(`Failed to get active session: ${error.message}`);
    }

    return data as POSSession | null;
  }

  /**
   * Get active session for a business/branch
   */
  async getBusinessActiveSession(businessId: number, branchId?: number): Promise<POSSession | null> {
    let query = supabaseAdmin
      .from('pos_sessions')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'open');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query
      .order('opened_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get active session: ${error.message}`);
    }

    return data as POSSession | null;
  }

  /**
   * Open a new POS session
   */
  async openSession(
    businessId: number,
    cashierId: number,
    openingFloat: number,
    branchId?: number,
    notes?: string
  ): Promise<POSSession> {
    // Check if cashier already has an open session
    const existingSession = await this.getActiveSession(cashierId);
    if (existingSession) {
      throw new Error('You already have an open session. Please close it first.');
    }

    // Get cashier name
    const { data: cashier } = await supabaseAdmin
      .from('business_users')
      .select('first_name, last_name, username')
      .eq('id', cashierId)
      .single();

    const cashierName = cashier 
      ? [cashier.first_name, cashier.last_name].filter(Boolean).join(' ') || cashier.username
      : 'Unknown';

    const sessionNumber = await this.generateSessionNumber(businessId);

    const { data, error } = await supabaseAdmin
      .from('pos_sessions')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        session_number: sessionNumber,
        cashier_id: cashierId,
        cashier_name: cashierName,
        opening_float: openingFloat,
        opening_notes: notes,
        status: 'open',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to open session: ${error.message}`);

    return data as POSSession;
  }

  /**
   * Get session cash summary (for real-time drawer balance)
   */
  async getSessionCashSummary(sessionId: number): Promise<{
    opening_float: number;
    total_cash_received: number;
    total_change_given: number;
    total_refunds: number;
    total_adjustments: number;
    current_balance: number;
  }> {
    console.log('[CashSummary] Getting summary for session:', sessionId);

    // Get session
    const { data: session } = await supabaseAdmin
      .from('pos_sessions')
      .select('opening_float')
      .eq('id', sessionId)
      .single();

    if (!session) throw new Error('Session not found');

    // Get cash payments for this session (includes both regular payments and refunds)
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('order_payments')
      .select('amount, amount_received, change_given, status')
      .eq('pos_session_id', sessionId)
      .eq('payment_method', 'cash');

    console.log('[CashSummary] Payments query result:', {
      sessionId,
      paymentsCount: payments?.length || 0,
      payments: payments?.slice(0, 5), // Log first 5 for debugging
      error: paymentsError?.message,
    });

    // Regular payments: use amount_received and change_given
    const regularPayments = (payments || []).filter(p => p.status !== 'refunded');
    const totalCashReceived = regularPayments.reduce((sum, p) => sum + (p.amount_received || 0), 0);
    const totalChangeGiven = regularPayments.reduce((sum, p) => sum + (p.change_given || 0), 0);

    // Refunds: use the amount field (which is negative for refunds)
    const refundPayments = (payments || []).filter(p => p.status === 'refunded');
    const totalRefunds = refundPayments.reduce((sum, p) => sum + (p.amount || 0), 0); // Negative values

    // Get adjustments
    const { data: adjustments } = await supabaseAdmin
      .from('pos_cash_adjustments')
      .select('adjustment_type, amount')
      .eq('pos_session_id', sessionId);

    const totalAdjustments = (adjustments || []).reduce((sum, adj) => {
      if (adj.adjustment_type === 'cash_in') return sum + adj.amount;
      if (adj.adjustment_type === 'cash_out') return sum - adj.amount;
      return sum + adj.amount; // correction can be positive or negative
    }, 0);

    // Current balance = opening + received - change + adjustments + refunds (refunds are negative, so they subtract)
    const currentBalance = session.opening_float + totalCashReceived - totalChangeGiven + totalAdjustments + totalRefunds;

    console.log('[CashSummary] Final calculation:', {
      sessionId,
      opening_float: session.opening_float,
      total_cash_received: totalCashReceived,
      total_change_given: totalChangeGiven,
      total_refunds: totalRefunds,
      total_adjustments: totalAdjustments,
      current_balance: currentBalance,
    });

    return {
      opening_float: session.opening_float,
      total_cash_received: totalCashReceived,
      total_change_given: totalChangeGiven,
      total_refunds: totalRefunds,
      total_adjustments: totalAdjustments,
      current_balance: currentBalance,
    };
  }

  /**
   * Close a POS session
   * Also auto-expires any pending cancelled items from this session as waste
   */
  async closeSession(
    sessionId: number,
    actualCashCount: number,
    closingNotes?: string
  ): Promise<POSSession> {
    // Get session summary
    const summary = await this.getSessionCashSummary(sessionId);
    
    const expectedCash = summary.current_balance;
    const variance = actualCashCount - expectedCash;

    const { data, error } = await supabaseAdmin
      .from('pos_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        total_cash_received: summary.total_cash_received,
        total_change_given: summary.total_change_given,
        expected_cash: expectedCash,
        actual_cash_count: actualCashCount,
        variance: variance,
        closing_notes: closingNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to close session: ${error.message}`);

    // Auto-expire any pending cancelled items from this session as waste
    // This ensures inventory decisions are finalized when shift ends
    try {
      const expireResult = await posService.autoExpireCancelledItems(sessionId);
      if (expireResult.expired > 0) {
        console.log(`[POS Session Close] Auto-expired ${expireResult.expired} cancelled items for session ${sessionId}`);
      }
    } catch (expireError) {
      console.error(`[POS Session Close] Failed to auto-expire items for session ${sessionId}:`, expireError);
      // Don't fail session close if auto-expire fails
    }

    return data as POSSession;
  }

  /**
   * Add cash adjustment (petty cash, correction, etc.)
   */
  async addCashAdjustment(
    sessionId: number,
    type: 'cash_in' | 'cash_out' | 'correction',
    amount: number,
    reason: string,
    performedBy?: number
  ): Promise<POSCashAdjustment> {
    const { data, error } = await supabaseAdmin
      .from('pos_cash_adjustments')
      .insert({
        pos_session_id: sessionId,
        adjustment_type: type,
        amount,
        reason,
        performed_by: performedBy,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add adjustment: ${error.message}`);

    return data as POSCashAdjustment;
  }

  /**
   * Get session history
   */
  async getSessionHistory(
    businessId: number,
    filters?: {
      cashierId?: number;
      branchId?: number;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
    }
  ): Promise<POSSession[]> {
    let query = supabaseAdmin
      .from('pos_sessions')
      .select('*')
      .eq('business_id', businessId)
      .order('opened_at', { ascending: false });

    if (filters?.cashierId) query = query.eq('cashier_id', filters.cashierId);
    if (filters?.branchId) query = query.eq('branch_id', filters.branchId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.dateFrom) query = query.gte('opened_at', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('opened_at', filters.dateTo);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch session history: ${error.message}`);

    return (data || []) as POSSession[];
  }
}

export const posSessionService = new POSSessionService();

