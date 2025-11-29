/**
 * BUSINESS ROUTES
 * REST API for business management (Super Admin)
 */

import { Router, Request, Response } from 'express';
import { businessService, CreateBusinessInput, UpdateBusinessInput } from '../services/business.service';

const router = Router();

/**
 * GET /api/businesses
 * Get all businesses
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const businesses = await businessService.getAllBusinesses();
    res.json({ businesses });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch businesses',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/businesses/:id
 * Get business by ID with users
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid business ID' });
      return;
    }

    const business = await businessService.getBusinessById(id);
    res.json({ business });
  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(404).json({ 
      error: 'Business not found',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/businesses
 * Create new business with optional users
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const input: CreateBusinessInput = req.body;

    // Validate required fields
    if (!input.name || !input.slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }

    const result = await businessService.createBusiness(input);
    
    res.status(201).json({
      message: 'Business created successfully',
      business: result.business,
      userCredentials: result.userCredentials,
    });
  } catch (error) {
    console.error('Error creating business:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.includes('already exists')) {
      res.status(409).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to create business', message });
    }
  }
});

/**
 * PUT /api/businesses/:id
 * Update business
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid business ID' });
      return;
    }

    const input: UpdateBusinessInput = req.body;
    const result = await businessService.updateBusiness(id, input);
    
    res.json({
      message: 'Business updated successfully',
      business: result.business,
      userCredentials: result.userCredentials,
    });
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ 
      error: 'Failed to update business',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/businesses/:id
 * Delete business and all related data
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid business ID' });
      return;
    }

    await businessService.deleteBusiness(id);
    res.json({ message: 'Business deleted successfully' });
  } catch (error) {
    console.error('Error deleting business:', error);
    res.status(500).json({ 
      error: 'Failed to delete business',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/businesses/:id/users
 * Get users for a specific business
 */
router.get('/:id/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid business ID' });
      return;
    }

    const users = await businessService.getBusinessUsers(id);
    res.json({ users });
  } catch (error) {
    console.error('Error fetching business users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch business users',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

