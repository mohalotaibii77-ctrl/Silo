/**
 * BUNDLES API ROUTES
 * Manage product bundles - 2+ products sold together as 1
 */

import { Router, Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/database';
import { businessAuthService } from '../services/business-auth.service';
import { bundlesService } from '../services/bundles.service';

const router = Router();

interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    username: string;
    role: string;
  };
}

// Auth middleware - supports workspace switching via X-Business-Id header
async function authenticateBusinessToken(req: AuthenticatedRequest, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = businessAuthService.verifyToken(token);
    
    const user = await businessAuthService.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check for workspace switching header (X-Business-Id)
    const headerBusinessId = req.headers['x-business-id'] as string;
    let businessId = user.business_id;

    if (headerBusinessId && parseInt(headerBusinessId) !== user.business_id) {
      if (user.role === 'owner') {
        const { data: ownerAccess } = await supabase
          .from('owners')
          .select(`id, business_owners!inner (business_id)`)
          .ilike('username', user.username)
          .eq('business_owners.business_id', parseInt(headerBusinessId))
          .single();

        if (ownerAccess) {
          businessId = parseInt(headerBusinessId);
        } else {
          return res.status(403).json({ error: 'Access denied to this business' });
        }
      } else {
        return res.status(403).json({ error: 'Only owners can switch workspaces' });
      }
    }

    req.businessUser = {
      id: user.id,
      business_id: businessId,
      username: user.username,
      role: user.role,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/bundles - Get all bundles for the business
// Query params: branch_id (optional) - for stock checking
router.get('/', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : undefined;
    const bundles = await bundlesService.getBundles(businessId, branchId);
    res.json({ success: true, data: bundles });
  } catch (error: any) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bundles/stats - Get bundle sales stats (sold count, cost for margin)
router.get('/stats', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    const stats = await bundlesService.getBundleStats(businessId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching bundle stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/bundles/:id - Get a single bundle
router.get('/:id', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const bundleId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    const bundle = await bundlesService.getBundle(bundleId, businessId);
    if (!bundle) {
      return res.status(404).json({ success: false, error: 'Bundle not found' });
    }

    res.json({ success: true, data: bundle });
  } catch (error: any) {
    console.error('Error fetching bundle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/bundles - Create a new bundle
router.post('/', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    const { name, name_ar, description, description_ar, sku, price, compare_at_price, image_url, items } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    if (!items || items.length < 2) {
      return res.status(400).json({ error: 'A bundle must contain at least 2 products' });
    }

    const bundle = await bundlesService.createBundle(businessId, {
      name,
      name_ar,
      description,
      description_ar,
      sku,
      price,
      compare_at_price,
      image_url,
      items
    });

    res.status(201).json({ success: true, data: bundle, message: 'Bundle created successfully' });
  } catch (error: any) {
    console.error('Error creating bundle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/bundles/:id - Update a bundle
router.put('/:id', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const bundleId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    const { name, name_ar, description, description_ar, sku, price, compare_at_price, image_url, is_active, items } = req.body;

    const bundle = await bundlesService.updateBundle(bundleId, businessId, {
      name,
      name_ar,
      description,
      description_ar,
      sku,
      price,
      compare_at_price,
      image_url,
      is_active,
      items
    });

    res.json({ success: true, data: bundle, message: 'Bundle updated successfully' });
  } catch (error: any) {
    console.error('Error updating bundle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/bundles/:id - Delete a bundle
router.delete('/:id', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const bundleId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    await bundlesService.deleteBundle(bundleId, businessId);
    res.json({ success: true, message: 'Bundle deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting bundle:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/bundles/:id/toggle - Toggle bundle active status
router.patch('/:id/toggle', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const bundleId = parseInt(req.params.id);
    const { is_active } = req.body;

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    if (is_active === undefined) {
      return res.status(400).json({ error: 'is_active is required' });
    }

    const bundle = await bundlesService.toggleBundleStatus(bundleId, businessId, is_active);
    res.json({ success: true, data: bundle });
  } catch (error: any) {
    console.error('Error toggling bundle status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

