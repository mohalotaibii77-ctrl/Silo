/**
 * ANALYTICS ROUTES
 * Dashboard analytics endpoints for business owners
 */

import { Router, Request, Response } from 'express';
import { analyticsService, TimePeriod } from '../services/analytics.service';
import { businessAuthService } from '../services/business-auth.service';
import { supabaseAdmin } from '../config/database';

const router = Router();

// Middleware to authenticate business user
async function authenticateBusinessToken(req: any, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    const payload = businessAuthService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

/**
 * GET /api/analytics/dashboard
 * Get dashboard stats for current business or all businesses
 * Query params:
 *   - period: 'today' | 'week' | 'month' | 'year' | 'all' (default: 'today')
 *   - combined: 'true' to get stats for all owner's businesses
 */
router.get('/dashboard', authenticateBusinessToken, async (req: any, res: Response) => {
  try {
    const period = (req.query.period as TimePeriod) || 'today';
    const combined = req.query.combined === 'true';
    const businessId = parseInt(req.user.businessId);

    if (combined && req.user.role === 'owner') {
      // Get all businesses this owner has access to
      const { data: ownerData } = await supabaseAdmin
        .from('owners')
        .select('id')
        .eq('username', req.user.username)
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
router.get('/low-stock', authenticateBusinessToken, async (req: any, res: Response) => {
  try {
    const businessId = parseInt(req.user.businessId);
    const limit = parseInt(req.query.limit as string) || 10;

    const items = await analyticsService.getLowStockItems(businessId, limit);
    res.json({ success: true, items });
  } catch (error) {
    console.error('Low stock items error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch low stock items' });
  }
});

export default router;

