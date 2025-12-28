/**
 * POS SESSION API ROUTES
 * Handles POS shift/session management, cash drawer, and reconciliation
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { posSessionService } from '../services/pos-session.service';
import { asyncHandler } from '../middleware/error.middleware';
import { authenticate, requireBusinessAccess } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../config/database';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/pos-sessions/employees
 * Get employees with POS access permission
 */
router.get('/employees', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { branch_id } = req.query;

  const employees = await posSessionService.getPOSEmployees(
    parseInt(req.user!.businessId),
    branch_id ? parseInt(branch_id as string) : undefined
  );

  res.json({
    success: true,
    data: employees,
  });
}));

/**
 * POST /api/pos-sessions/authenticate
 * Authenticate POS employee (verify password and check for active session)
 */
router.post('/authenticate', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { employee_id, password } = req.body;

  if (!employee_id || !password) {
    return res.status(400).json({
      success: false,
      error: 'employee_id and password are required',
    });
  }

  // Get employee from database
  const { data: employee, error } = await supabaseAdmin
    .from('business_users')
    .select('id, password_hash, business_id, status')
    .eq('id', employee_id)
    .single();

  if (error || !employee) {
    return res.status(401).json({
      success: false,
      error: 'Employee not found',
    });
  }

  // Check employee is active
  if (employee.status !== 'active') {
    return res.status(401).json({
      success: false,
      error: 'Employee account is not active',
    });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, employee.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      error: 'Invalid password',
    });
  }

  // Check for active session
  const activeSession = await posSessionService.getActiveSession(employee_id);
  
  if (activeSession) {
    // Get cash summary for the session
    const cashSummary = await posSessionService.getSessionCashSummary(activeSession.id);
    
    return res.json({
      success: true,
      data: {
        has_active_session: true,
        active_session: {
          ...activeSession,
          cash_summary: cashSummary,
        },
      },
    });
  }

  // No active session
  res.json({
    success: true,
    data: {
      has_active_session: false,
      employee_id: employee_id,
    },
  });
}));

/**
 * POST /api/pos-sessions/pin-authenticate
 * Authenticate POS employee using PIN (for screen unlock after idle)
 * This is used when the screen locks after 5 minutes of inactivity
 * 
 * Flow:
 * 1. Device is already logged in (has business context)
 * 2. Screen locks after idle
 * 3. Any employee with POS access can unlock with their PIN
 * 4. Order is tagged to that employee
 */
router.post('/pin-authenticate', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { pin } = req.body;
  const businessId = parseInt(req.user!.businessId);

  if (!pin) {
    return res.status(400).json({
      success: false,
      error: 'PIN is required',
    });
  }

  // Validate PIN format (4-6 digits)
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid PIN format. Must be 4-6 digits.',
    });
  }

  // Find employee by PIN within this business
  // First try to find by plain PIN (for simpler lookup)
  const { data: employee, error } = await supabaseAdmin
    .from('business_users')
    .select('id, username, first_name, last_name, role, status, permissions, pos_pin')
    .eq('business_id', businessId)
    .eq('pos_pin', pin)
    .single();

  if (error || !employee) {
    return res.status(401).json({
      success: false,
      error: 'Invalid PIN',
    });
  }

  // Check employee is active
  if (employee.status !== 'active') {
    return res.status(401).json({
      success: false,
      error: 'Employee account is not active',
    });
  }

  // Check employee has POS access
  const hasPosAccess = 
    employee.role === 'owner' || 
    employee.role === 'manager' || 
    employee.role === 'pos' ||
    (employee.permissions && employee.permissions.pos_access);

  if (!hasPosAccess) {
    return res.status(403).json({
      success: false,
      error: 'Employee does not have POS access',
    });
  }

  // Return employee info for the POS to use
  res.json({
    success: true,
    data: {
      employee: {
        id: employee.id,
        username: employee.username,
        first_name: employee.first_name,
        last_name: employee.last_name,
        display_name: employee.first_name && employee.last_name 
          ? `${employee.first_name} ${employee.last_name}` 
          : employee.username,
        role: employee.role,
      },
    },
    message: 'PIN verified successfully',
  });
}));

/**
 * GET /api/pos-sessions/active
 * Get active session for current cashier
 */
router.get('/active', requireBusinessAccess, asyncHandler(async (req, res) => {
  const session = await posSessionService.getActiveSession(parseInt(req.user!.userId));

  res.json({
    success: true,
    data: session,
  });
}));

/**
 * GET /api/pos-sessions/business-active
 * Get active session for business/branch
 */
router.get('/business-active', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { branch_id } = req.query;

  const session = await posSessionService.getBusinessActiveSession(
    parseInt(req.user!.businessId),
    branch_id ? parseInt(branch_id as string) : undefined
  );

  res.json({
    success: true,
    data: session,
  });
}));

/**
 * POST /api/pos-sessions/open
 * Open a new POS session
 */
router.post('/open', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { opening_float, branch_id, notes, cashier_id } = req.body;
  const businessId = parseInt(req.user!.businessId);
  
  // Use provided cashier_id or fall back to current user
  const targetCashierId = cashier_id ? parseInt(cashier_id) : parseInt(req.user!.userId);

  // Get operational settings to check session restrictions and opening float
  const { data: opSettings } = await supabaseAdmin
    .from('operational_settings')
    .select('pos_opening_float_fixed, pos_opening_float_amount, pos_session_allowed_user_ids')
    .eq('business_id', businessId)
    .single();

  // Check if user is allowed to open sessions
  if (opSettings?.pos_session_allowed_user_ids && opSettings.pos_session_allowed_user_ids.length > 0) {
    if (!opSettings.pos_session_allowed_user_ids.includes(targetCashierId)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to open POS sessions',
      });
    }
  }

  // Determine opening float amount
  let finalOpeningFloat = opening_float;
  
  if (opSettings?.pos_opening_float_fixed) {
    // Use fixed amount from settings
    finalOpeningFloat = opSettings.pos_opening_float_amount || 0;
  } else {
    // Employee must provide opening float
    if (opening_float === undefined) {
      return res.status(400).json({
        success: false,
        error: 'opening_float is required',
      });
    }
  }

  const session = await posSessionService.openSession(
    businessId,
    targetCashierId,
    finalOpeningFloat,
    branch_id ? parseInt(branch_id) : undefined,
    notes
  );

  res.status(201).json({
    success: true,
    data: session,
    message: 'Session opened successfully',
  });
}));

/**
 * GET /api/pos-sessions/:sessionId/summary
 * Get session cash summary (real-time drawer balance)
 */
router.get('/:sessionId/summary', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const summary = await posSessionService.getSessionCashSummary(parseInt(sessionId));

  res.json({
    success: true,
    data: summary,
  });
}));

/**
 * POST /api/pos-sessions/:sessionId/close
 * Close a POS session
 */
router.post('/:sessionId/close', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { actual_cash_count, closing_notes } = req.body;

  if (actual_cash_count === undefined) {
    return res.status(400).json({
      success: false,
      error: 'actual_cash_count is required',
    });
  }

  const session = await posSessionService.closeSession(
    parseInt(sessionId),
    actual_cash_count,
    closing_notes
  );

  res.json({
    success: true,
    data: session,
    message: 'Session closed successfully',
  });
}));

/**
 * POST /api/pos-sessions/:sessionId/adjustment
 * Add cash adjustment (petty cash, correction, etc.)
 */
router.post('/:sessionId/adjustment', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { type, amount, reason } = req.body;

  if (!type || amount === undefined || !reason) {
    return res.status(400).json({
      success: false,
      error: 'type, amount, and reason are required',
    });
  }

  const validTypes = ['cash_in', 'cash_out', 'correction'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
    });
  }

  const adjustment = await posSessionService.addCashAdjustment(
    parseInt(sessionId),
    type,
    amount,
    reason,
    parseInt(req.user!.userId)
  );

  res.status(201).json({
    success: true,
    data: adjustment,
    message: 'Adjustment added successfully',
  });
}));

/**
 * GET /api/pos-sessions/history
 * Get session history
 */
router.get('/history', requireBusinessAccess, asyncHandler(async (req, res) => {
  const { cashier_id, branch_id, status, date_from, date_to, limit } = req.query;

  const sessions = await posSessionService.getSessionHistory(
    parseInt(req.user!.businessId),
    {
      cashierId: cashier_id ? parseInt(cashier_id as string) : undefined,
      branchId: branch_id ? parseInt(branch_id as string) : undefined,
      status: status as string | undefined,
      dateFrom: date_from as string | undefined,
      dateTo: date_to as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    }
  );

  res.json({
    success: true,
    data: sessions,
    count: sessions.length,
  });
}));

export default router;
