/**
 * INVENTORY TRANSACTION ROUTES
 * API endpoints for inventory adjustments and timeline
 */

import { Router, Request, Response } from 'express';
import { inventoryTransactionService, TransactionType, DeductionReason, ReferenceType } from '../services/inventory-transaction.service';
import { authenticateBusiness, AuthenticatedRequest } from '../middleware/business-auth.middleware';

const router = Router();

// Helper for async route handlers
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => 
  (req: Request, res: Response, next: (err?: any) => void) => 
    Promise.resolve(fn(req, res)).catch(next);

// ==================== MANUAL ADJUSTMENTS ====================

/**
 * POST /api/inventory/adjustments/add
 * Add stock to inventory (manual addition)
 * Requires justification notes
 */
router.post('/adjustments/add', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
  const { item_id, branch_id, quantity, notes } = req.body;
  const businessId = req.businessUser!.business_id;
  const userId = req.businessUser!.id;

  // Validate required fields
  if (!item_id) {
    res.status(400).json({ success: false, error: 'item_id is required' });
    return;
  }
  if (!quantity || quantity <= 0) {
    res.status(400).json({ success: false, error: 'quantity must be greater than 0' });
    return;
  }
  if (!notes || notes.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Justification notes are required for stock additions' });
    return;
  }

  try {
    const result = await inventoryTransactionService.addStock({
      business_id: businessId,
      branch_id: branch_id || null,
      item_id,
      quantity,
      notes,
      performed_by: userId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}));

/**
 * POST /api/inventory/adjustments/deduct
 * Deduct stock from inventory (manual deduction)
 * Requires reason (expired, damaged, spoiled, others)
 * If reason is 'others', notes are required
 */
router.post('/adjustments/deduct', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
  const { item_id, branch_id, quantity, reason, notes } = req.body;
  const businessId = req.businessUser!.business_id;
  const userId = req.businessUser!.id;

  // Validate required fields
  if (!item_id) {
    res.status(400).json({ success: false, error: 'item_id is required' });
    return;
  }
  if (!quantity || quantity <= 0) {
    res.status(400).json({ success: false, error: 'quantity must be greater than 0' });
    return;
  }
  if (!reason || !['expired', 'damaged', 'spoiled', 'others'].includes(reason)) {
    res.status(400).json({ 
      success: false, 
      error: 'reason is required and must be one of: expired, damaged, spoiled, others' 
    });
    return;
  }
  if (reason === 'others' && (!notes || notes.trim().length === 0)) {
    res.status(400).json({ 
      success: false, 
      error: 'Justification notes are required when reason is "others"' 
    });
    return;
  }

  try {
    const result = await inventoryTransactionService.deductStock({
      business_id: businessId,
      branch_id: branch_id || null,
      item_id,
      quantity,
      reason: reason as DeductionReason,
      notes: notes || null,
      performed_by: userId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}));

// ==================== TIMELINE ====================

/**
 * GET /api/inventory/timeline
 * Get global inventory timeline for the business
 * Query params: branch_id, item_id, transaction_type, reference_type, 
 *               deduction_reason, date_from, date_to, page, limit
 */
router.get('/timeline', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
  const businessId = req.businessUser!.business_id;
  const {
    branch_id,
    item_id,
    transaction_type,
    reference_type,
    deduction_reason,
    date_from,
    date_to,
    page,
    limit,
  } = req.query;

  try {
    const result = await inventoryTransactionService.getTimeline(businessId, {
      branch_id: branch_id ? parseInt(branch_id as string) : undefined,
      item_id: item_id ? parseInt(item_id as string) : undefined,
      transaction_type: transaction_type as TransactionType | undefined,
      reference_type: reference_type as ReferenceType | undefined,
      deduction_reason: deduction_reason as DeductionReason | undefined,
      date_from: date_from as string | undefined,
      date_to: date_to as string | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}));

/**
 * GET /api/inventory/timeline/stats
 * Get timeline statistics for dashboard
 */
router.get('/timeline/stats', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
  const businessId = req.businessUser!.business_id;
  const { branch_id } = req.query;

  try {
    const stats = await inventoryTransactionService.getTimelineStats(
      businessId,
      branch_id ? parseInt(branch_id as string) : undefined
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}));

/**
 * GET /api/inventory/items/:itemId/timeline
 * Get timeline for a specific item
 */
router.get('/items/:itemId/timeline', authenticateBusiness, asyncHandler(async (req: AuthenticatedRequest, res): Promise<void> => {
  const businessId = req.businessUser!.business_id;
  const itemId = parseInt(req.params.itemId);
  const {
    branch_id,
    transaction_type,
    reference_type,
    deduction_reason,
    date_from,
    date_to,
    page,
    limit,
  } = req.query;

  if (isNaN(itemId)) {
    res.status(400).json({ success: false, error: 'Invalid item ID' });
    return;
  }

  try {
    const result = await inventoryTransactionService.getItemTimeline(businessId, itemId, {
      branch_id: branch_id ? parseInt(branch_id as string) : undefined,
      transaction_type: transaction_type as TransactionType | undefined,
      reference_type: reference_type as ReferenceType | undefined,
      deduction_reason: deduction_reason as DeductionReason | undefined,
      date_from: date_from as string | undefined,
      date_to: date_to as string | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
}));

export default router;
