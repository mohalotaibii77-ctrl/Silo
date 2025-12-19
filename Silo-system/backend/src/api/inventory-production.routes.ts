/**
 * INVENTORY PRODUCTION ROUTES
 * Simplified: Templates + Production
 */

import { Router, Request, Response } from 'express';
import { inventoryProductionService } from '../services/inventory-production.service';
import { businessAuthService } from '../services/business-auth.service';

const router = Router();

interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    branch_id?: number;
    username: string;
    role: string;
  };
}

// Business auth middleware
async function authenticateBusiness(req: AuthenticatedRequest, res: Response, next: Function) {
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

    // Check for workspace switching via X-Business-Id header
    const headerBusinessId = req.headers['x-business-id'] as string;
    let effectiveBusinessId = user.business_id;

    if (headerBusinessId && parseInt(headerBusinessId) !== user.business_id) {
      if (user.role === 'owner') {
        const hasAccess = await businessAuthService.checkOwnerBusinessAccess(
          user.username,
          parseInt(headerBusinessId)
        );
        
        if (hasAccess) {
          effectiveBusinessId = parseInt(headerBusinessId);
        } else {
          return res.status(403).json({ success: false, error: 'Access denied to this business' });
        }
      } else {
        return res.status(403).json({ success: false, error: 'Access denied to this business' });
      }
    }

    // Get branch ID from header
    const headerBranchId = req.headers['x-branch-id'] as string;
    const branchId = headerBranchId ? parseInt(headerBranchId) : undefined;

    req.businessUser = {
      id: user.id,
      business_id: effectiveBusinessId,
      branch_id: branchId,
      username: user.username,
      role: user.role,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ==================== TEMPLATES ====================

/**
 * Get all templates
 * GET /api/inventory/production/templates
 */
router.get('/templates', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser!.business_id;
    const templates = await inventoryProductionService.getTemplates(businessId);
    res.json({ success: true, templates });
  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch templates' });
  }
});

/**
 * Get single template
 * GET /api/inventory/production/templates/:id
 */
router.get('/templates/:id', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const businessId = req.businessUser!.business_id;

    const template = await inventoryProductionService.getTemplate(templateId, businessId);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    res.json({ success: true, template });
  } catch (error: any) {
    console.error('Get template error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch template' });
  }
});

/**
 * Create template
 * POST /api/inventory/production/templates
 */
router.post('/templates', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { composite_item_id, name, name_ar, default_batch_count } = req.body;
    const businessId = req.businessUser!.business_id;

    if (!composite_item_id || !name) {
      return res.status(400).json({ success: false, error: 'composite_item_id and name are required' });
    }

    const template = await inventoryProductionService.createTemplate({
      business_id: businessId,
      composite_item_id,
      name,
      name_ar,
      default_batch_count,
      created_by: req.businessUser!.id,
    });

    res.status(201).json({ success: true, template });
  } catch (error: any) {
    console.error('Create template error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create template' });
  }
});

/**
 * Update template
 * PUT /api/inventory/production/templates/:id
 */
router.put('/templates/:id', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const { composite_item_id, name, name_ar, default_batch_count } = req.body;
    const businessId = req.businessUser!.business_id;

    const template = await inventoryProductionService.updateTemplate(templateId, businessId, {
      composite_item_id,
      name,
      name_ar,
      default_batch_count,
    });

    res.json({ success: true, template });
  } catch (error: any) {
    console.error('Update template error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update template' });
  }
});

/**
 * Delete template
 * DELETE /api/inventory/production/templates/:id
 */
router.delete('/templates/:id', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const businessId = req.businessUser!.business_id;

    await inventoryProductionService.deleteTemplate(templateId, businessId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete template error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete template' });
  }
});

// ==================== PRODUCTION ====================

/**
 * Check inventory availability
 * GET /api/inventory/production/check-availability
 */
router.get('/check-availability', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser!.business_id;
    const compositeItemId = parseInt(req.query.composite_item_id as string);
    const batchCount = parseFloat(req.query.batch_count as string) || 1;
    const branchId = req.businessUser!.branch_id;

    if (!compositeItemId) {
      return res.status(400).json({ success: false, error: 'composite_item_id is required' });
    }

    const result = await inventoryProductionService.checkInventoryAvailability(
      businessId,
      compositeItemId,
      batchCount,
      branchId
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Check availability error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to check availability' });
  }
});

/**
 * Get production stats
 * GET /api/inventory/production/stats
 */
router.get('/stats', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser!.business_id;
    const branchId = req.businessUser!.branch_id;

    const stats = await inventoryProductionService.getProductionStats(businessId, branchId);
    res.json({ success: true, ...stats });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get stats' });
  }
});

/**
 * Get production history
 * GET /api/inventory/production
 */
router.get('/', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser!.business_id;
    const branchId = req.businessUser!.branch_id;
    const compositeItemId = req.query.composite_item_id ? parseInt(req.query.composite_item_id as string) : undefined;
    const templateId = req.query.template_id ? parseInt(req.query.template_id as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const productions = await inventoryProductionService.getProductions(businessId, {
      branchId,
      compositeItemId,
      templateId,
      limit,
    });

    res.json({ success: true, productions });
  } catch (error: any) {
    console.error('Get productions error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch productions' });
  }
});

/**
 * Get single production
 * GET /api/inventory/production/:id
 */
router.get('/:id', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const productionId = parseInt(req.params.id);
    const businessId = req.businessUser!.business_id;

    const production = await inventoryProductionService.getProduction(productionId, businessId);
    if (!production) {
      return res.status(404).json({ success: false, error: 'Production not found' });
    }

    res.json({ success: true, production });
  } catch (error: any) {
    console.error('Get production error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch production' });
  }
});

/**
 * Create production (execute)
 * POST /api/inventory/production
 */
router.post('/', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { composite_item_id, batch_count, template_id, notes } = req.body;
    const businessId = req.businessUser!.business_id;
    const branchId = req.businessUser!.branch_id;

    if (!composite_item_id || !batch_count) {
      return res.status(400).json({ success: false, error: 'composite_item_id and batch_count are required' });
    }

    const production = await inventoryProductionService.createProduction({
      business_id: businessId,
      branch_id: branchId,
      composite_item_id,
      batch_count,
      template_id,
      notes,
      created_by: req.businessUser!.id,
    });

    res.status(201).json({ success: true, production });
  } catch (error: any) {
    console.error('Create production error:', error);
    
    if (error.message?.includes('Insufficient inventory')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: error.message || 'Failed to create production' });
  }
});

export default router;
