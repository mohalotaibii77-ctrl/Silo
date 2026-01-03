/**
 * HR ROUTES
 * Employee attendance, check-in/out, schedule overrides
 */

import { Router, Request, Response } from 'express';
import { hrService } from '../services/hr.service';
import { businessAuthService } from '../services/business-auth.service';
import { z } from 'zod';

const router = Router();

// =====================================================
// TYPES & VALIDATION SCHEMAS
// =====================================================

interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    branch_id?: number;
    username: string;
    role: string;
  };
}

// Check-in request validation
const checkInSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number(),
  device_info: z.object({
    platform: z.string(),
    os_version: z.string(),
    app_version: z.string(),
  }).optional(),
});

// Schedule override validation
const scheduleOverrideSchema = z.object({
  working_days: z.array(z.string()).nullable().optional(),
  opening_time: z.string().nullable().optional(),
  closing_time: z.string().nullable().optional(),
  checkin_buffer_minutes_before: z.number().nullable().optional(),
  checkin_buffer_minutes_after: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

/**
 * Authenticate any business user (employee, manager, owner)
 */
async function authenticateUser(req: AuthenticatedRequest, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = businessAuthService.verifyToken(token);

    const user = await businessAuthService.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    req.businessUser = {
      id: user.id,
      business_id: user.business_id,
      branch_id: user.branch_id,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

/**
 * Authenticate owner or manager only
 */
async function authenticateManager(req: AuthenticatedRequest, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = businessAuthService.verifyToken(token);

    const user = await businessAuthService.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    if (user.role !== 'owner' && user.role !== 'manager') {
      return res.status(403).json({ success: false, error: 'Only owners and managers can access this' });
    }

    req.businessUser = {
      id: user.id,
      business_id: user.business_id,
      branch_id: user.branch_id,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// =====================================================
// ATTENDANCE ENDPOINTS (Employee)
// =====================================================

/**
 * POST /hr/attendance/check-in
 * Employee check-in with GPS validation
 */
router.post('/attendance/check-in', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    console.log('[CHECK-IN ROUTE] User:', { id: user.id, username: user.username, branch_id: user.branch_id, business_id: user.business_id });

    // Validate request body
    const parseResult = checkInSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.log('[CHECK-IN ROUTE] Validation failed:', parseResult.error.errors);
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: parseResult.error.errors,
      });
    }

    // Must have a branch assigned
    if (!user.branch_id) {
      console.log('[CHECK-IN ROUTE] User has no branch_id assigned!');
      return res.status(400).json({
        success: false,
        error: 'You are not assigned to a branch',
        error_code: 'GEOFENCE_NOT_CONFIGURED',
      });
    }

    console.log('[CHECK-IN ROUTE] Calling hrService.checkIn...');
    const result = await hrService.checkIn(
      user.id,
      user.business_id,
      user.branch_id,
      parseResult.data
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Check-in error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check in',
    });
  }
});

/**
 * POST /hr/attendance/check-out
 * Employee check-out with GPS
 */
router.post('/attendance/check-out', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;

    // Validate request body
    const parseResult = checkInSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: parseResult.error.errors,
      });
    }

    const result = await hrService.checkOut(
      user.id,
      user.business_id,
      parseResult.data
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Check-out error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check out',
    });
  }
});

/**
 * GET /hr/attendance/status
 * Get current attendance status for logged-in employee
 */
router.get('/attendance/status', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const status = await hrService.getAttendanceStatus(user.id);

    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get attendance status',
    });
  }
});

/**
 * GET /hr/attendance/history
 * Get attendance history for logged-in employee
 * Query params: start_date, end_date (YYYY-MM-DD format)
 */
router.get('/attendance/history', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const { start_date, end_date } = req.query;

    // Default to last 30 days if not specified
    const endDate = end_date as string || new Date().toISOString().split('T')[0];
    const startDate = start_date as string || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();

    const history = await hrService.getAttendanceHistory(
      user.id,
      user.business_id,
      startDate,
      endDate
    );

    return res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    console.error('Get history error:', error);
    console.error('Error details:', error?.message, error?.code, error?.details);
    return res.status(500).json({
      success: false,
      error: 'Failed to get attendance history',
      details: process.env.NODE_ENV !== 'production' ? error?.message : undefined,
    });
  }
});

/**
 * GET /hr/attendance/employees
 * Get attendance records for all employees (owner/manager view)
 * Query params: start_date, end_date, branch_id (optional)
 */
router.get('/attendance/employees', authenticateManager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const { start_date, end_date, branch_id } = req.query;

    // Default to last 7 days
    const endDate = end_date as string || new Date().toISOString().split('T')[0];
    const startDate = start_date as string || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    })();

    const branchIdNum = branch_id ? parseInt(branch_id as string) : null;

    const result = await hrService.getEmployeesAttendance(
      user.business_id,
      branchIdNum,
      startDate,
      endDate
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get employees attendance error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get employees attendance',
    });
  }
});

/**
 * GET /hr/attendance/summary/:employeeId
 * Get attendance summary for a specific employee (manager view)
 */
router.get('/attendance/summary/:employeeId', authenticateManager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const employeeId = parseInt(req.params.employeeId);
    const { start_date, end_date } = req.query;

    // Default to last 30 days
    const endDate = end_date as string || new Date().toISOString().split('T')[0];
    const startDate = start_date as string || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();

    const history = await hrService.getAttendanceHistory(
      employeeId,
      user.business_id,
      startDate,
      endDate
    );

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get summary error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get attendance summary',
    });
  }
});

// =====================================================
// SCHEDULE OVERRIDES (Special Attendance) - Owner/Manager only
// =====================================================

/**
 * GET /hr/schedule-overrides
 * List all employee schedule overrides for the business
 */
router.get('/schedule-overrides', authenticateManager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const overrides = await hrService.getScheduleOverrides(user.business_id);

    return res.json({
      success: true,
      data: overrides,
    });
  } catch (error) {
    console.error('Get overrides error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get schedule overrides',
    });
  }
});

/**
 * GET /hr/schedule-overrides/:employeeId
 * Get schedule override for a specific employee
 */
router.get('/schedule-overrides/:employeeId', authenticateManager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const employeeId = parseInt(req.params.employeeId);

    const override = await hrService.getScheduleOverride(employeeId, user.business_id);

    return res.json({
      success: true,
      data: override,
    });
  } catch (error) {
    console.error('Get override error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get schedule override',
    });
  }
});

/**
 * PUT /hr/schedule-overrides/:employeeId
 * Create or update schedule override for an employee
 */
router.put('/schedule-overrides/:employeeId', authenticateManager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const employeeId = parseInt(req.params.employeeId);

    // Validate request body
    const parseResult = scheduleOverrideSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: parseResult.error.errors,
      });
    }

    const override = await hrService.upsertScheduleOverride(
      employeeId,
      user.business_id,
      parseResult.data
    );

    return res.json({
      success: true,
      data: override,
    });
  } catch (error) {
    console.error('Update override error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update schedule override',
    });
  }
});

/**
 * DELETE /hr/schedule-overrides/:employeeId
 * Delete schedule override for an employee (revert to business default)
 */
router.delete('/schedule-overrides/:employeeId', authenticateManager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const employeeId = parseInt(req.params.employeeId);

    await hrService.deleteScheduleOverride(employeeId, user.business_id);

    return res.json({
      success: true,
      message: 'Schedule override deleted',
    });
  } catch (error) {
    console.error('Delete override error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete schedule override',
    });
  }
});

/**
 * GET /hr/effective-schedule
 * Get the effective schedule for the logged-in employee
 */
router.get('/effective-schedule', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const schedule = await hrService.getEffectiveSchedule(user.id, user.business_id);

    return res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('Get effective schedule error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get effective schedule',
    });
  }
});

/**
 * GET /hr/effective-schedule/:employeeId
 * Get the effective schedule for a specific employee (manager view)
 */
router.get('/effective-schedule/:employeeId', authenticateManager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.businessUser!;
    const employeeId = parseInt(req.params.employeeId);

    const schedule = await hrService.getEffectiveSchedule(employeeId, user.business_id);

    return res.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('Get effective schedule error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get effective schedule',
    });
  }
});

export default router;
