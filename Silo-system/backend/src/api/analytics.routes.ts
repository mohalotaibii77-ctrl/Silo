/**
 * ANALYTICS ROUTES
 * Dashboard analytics endpoints for business owners
 */

import { Router, Response } from 'express';
import { analyticsService, TimePeriod } from '../services/analytics.service';
import { supabaseAdmin } from '../config/database';
import { authenticateBusiness, AuthenticatedRequest } from '../middleware/business-auth.middleware';

const router = Router();

/**
 * GET /api/analytics/dashboard
 * Get dashboard stats for current business or all businesses
 * Query params:
 *   - period: 'today' | 'week' | 'month' | 'year' | 'all' (default: 'today')
 *   - combined: 'true' to get stats for all owner's businesses
 */
router.get('/dashboard', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = (req.query.period as TimePeriod) || 'today';
    const combined = req.query.combined === 'true';
    const businessId = req.businessUser!.business_id;

    if (combined && req.businessUser!.role === 'owner') {
      // Get all businesses this owner has access to
      const { data: ownerData } = await supabaseAdmin
        .from('owners')
        .select('id')
        .eq('username', req.businessUser!.username)
        .single();

      if (ownerData) {
        const { data: businessLinks } = await supabaseAdmin
          .from('business_owners')
          .select('business_id')
          .eq('owner_id', ownerData.id);

        const businessIds = businessLinks?.map(b => b.business_id) || [];
        
        if (businessIds.length > 0) {
          const stats = await analyticsService.getCombinedDashboardStats(businessIds, period);
          return res.json({ success: true, stats, combined: true });
        }
      }
    }

    // Single business stats
    const stats = await analyticsService.getDashboardStats(businessId, period);
    res.json({ success: true, stats, combined: false });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

/**
 * GET /api/analytics/low-stock
 * Get list of low stock items
 */
router.get('/low-stock', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser!.business_id;
    const limit = parseInt(req.query.limit as string) || 10;

    const items = await analyticsService.getLowStockItems(businessId, limit);
    res.json({ success: true, items });
  } catch (error) {
    console.error('Low stock items error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch low stock items' });
  }
});

export default router;





