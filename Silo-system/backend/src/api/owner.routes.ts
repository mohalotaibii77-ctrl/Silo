/**
 * OWNER ROUTES
 * API endpoints for platform-level owner management
 * Used by SuperAdmin to manage owners and their business assignments
 */

import { Router, Request, Response } from 'express';
import { ownerService } from '../services/owner.service';

const router = Router();

/**
 * GET /api/owners/platform-stats
 * Get platform-wide statistics for super-admin dashboard
 * All calculations done on backend
 */
router.get('/platform-stats', async (req: Request, res: Response) => {
  try {
    const stats = await ownerService.getPlatformStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch platform stats' });
  }
});

/**
 * GET /api/owners
 * Get all owners with their business counts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const owners = await ownerService.getAllOwners();
    res.json({ owners });
  } catch (error: any) {
    console.error('Error fetching owners:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch owners' });
  }
});

/**
 * GET /api/owners/unassigned-businesses
 * Get businesses that have no owner assigned
 */
router.get('/unassigned-businesses', async (req: Request, res: Response) => {
  try {
    const businesses = await ownerService.getUnassignedBusinesses();
    res.json({ businesses });
  } catch (error: any) {
    console.error('Error fetching unassigned businesses:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch unassigned businesses' });
  }
});

/**
 * GET /api/owners/businesses-by-username
 * Get all businesses linked to an owner by their username
 * Used for workspace switching in store-setup app
 * NOTE: This must be defined BEFORE /:id to avoid route conflicts
 */
router.get('/businesses-by-username', async (req: Request, res: Response) => {
  try {
    const username = req.query.username as string;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const businesses = await ownerService.getBusinessesByOwnerUsername(username);
    res.json({ businesses });
  } catch (error: any) {
    console.error('Error fetching businesses by owner username:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch businesses' });
  }
});

/**
 * GET /api/owners/:id
 * Get owner by ID with associated businesses
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    const owner = await ownerService.getOwnerById(id);
    if (!owner) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    res.json({ owner });
  } catch (error: any) {
    console.error('Error fetching owner:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch owner' });
  }
});

/**
 * POST /api/owners
 * Create a new owner
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const owner = await ownerService.createOwner({
      email,
      password,
      first_name,
      last_name,
      phone
    });

    res.status(201).json({ 
      message: 'Owner created successfully',
      owner 
    });
  } catch (error: any) {
    console.error('Error creating owner:', error);
    res.status(500).json({ error: error.message || 'Failed to create owner' });
  }
});

/**
 * PUT /api/owners/:id
 * Update an owner
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    const { email, password, first_name, last_name, phone, status } = req.body;

    const owner = await ownerService.updateOwner(id, {
      email,
      password,
      first_name,
      last_name,
      phone,
      status
    });

    res.json({ 
      message: 'Owner updated successfully',
      owner 
    });
  } catch (error: any) {
    console.error('Error updating owner:', error);
    res.status(500).json({ error: error.message || 'Failed to update owner' });
  }
});

/**
 * DELETE /api/owners/:id
 * Delete an owner
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    await ownerService.deleteOwner(id);
    res.json({ message: 'Owner deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting owner:', error);
    res.status(500).json({ error: error.message || 'Failed to delete owner' });
  }
});

/**
 * POST /api/owners/:id/link-business
 * Link a business to an owner
 */
router.post('/:id/link-business', async (req: Request, res: Response) => {
  try {
    const ownerId = parseInt(req.params.id);
    if (isNaN(ownerId)) {
      return res.status(400).json({ error: 'Invalid owner ID' });
    }

    const { business_id, role } = req.body;
    if (!business_id) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    const businessOwner = await ownerService.linkBusinessToOwner(
      ownerId, 
      business_id, 
      role || 'owner'
    );

    res.status(201).json({ 
      message: 'Business linked to owner successfully',
      businessOwner 
    });
  } catch (error: any) {
    console.error('Error linking business to owner:', error);
    res.status(500).json({ error: error.message || 'Failed to link business to owner' });
  }
});

/**
 * DELETE /api/owners/:id/unlink-business/:businessId
 * Unlink a business from an owner
 */
router.delete('/:id/unlink-business/:businessId', async (req: Request, res: Response) => {
  try {
    const ownerId = parseInt(req.params.id);
    const businessId = parseInt(req.params.businessId);
    
    if (isNaN(ownerId) || isNaN(businessId)) {
      return res.status(400).json({ error: 'Invalid owner or business ID' });
    }

    await ownerService.unlinkBusinessFromOwner(ownerId, businessId);
    res.json({ message: 'Business unlinked from owner successfully' });
  } catch (error: any) {
    console.error('Error unlinking business from owner:', error);
    res.status(500).json({ error: error.message || 'Failed to unlink business from owner' });
  }
});

export default router;

