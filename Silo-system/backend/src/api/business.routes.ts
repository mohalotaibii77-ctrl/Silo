/**
 * BUSINESS ROUTES
 * REST API for business management (Super Admin)
 */

import { Router, Request, Response } from 'express';
import { businessService, CreateBusinessInput, UpdateBusinessInput } from '../services/business.service';
import { supabaseAdmin as supabase } from '../config/database';
import { authService } from '../services/auth.service';
import bcrypt from 'bcryptjs';

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

// Valid currency codes - must match business.service.ts
const VALID_CURRENCIES = [
  'KWD', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'BHD', 'OMR',
  'EGP', 'JOD', 'LBP', 'INR', 'PKR', 'CNY', 'JPY', 'KRW', 'THB',
  'MYR', 'SGD', 'AUD', 'CAD', 'CHF', 'TRY', 'RUB', 'BRL', 'MXN', 'ZAR'
];

/**
 * POST /api/businesses
 * Create new business with optional users and branches
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const input: CreateBusinessInput = req.body;

    // Validate required fields
    if (!input.name || !input.slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }

    // Validate required localization fields
    if (!input.country) {
      res.status(400).json({ error: 'Country is required' });
      return;
    }

    if (!input.currency) {
      res.status(400).json({ error: 'Currency is required' });
      return;
    }

    if (!VALID_CURRENCIES.includes(input.currency)) {
      res.status(400).json({
        error: `Invalid currency code: ${input.currency}`,
        valid_currencies: VALID_CURRENCIES
      });
      return;
    }

    if (!input.timezone) {
      res.status(400).json({ error: 'Timezone is required' });
      return;
    }

    const result = await businessService.createBusiness(input);

    res.status(201).json({
      message: 'Business created successfully',
      business: result.business,
      userCredentials: result.userCredentials,
      branches: result.branches,
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
 * Requires admin password verification
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid business ID' });
      return;
    }

    const { password } = req.body;
    
    if (!password) {
      res.status(400).json({ error: 'Admin password is required' });
      return;
    }

    // Get the admin user from the token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7);
    let payload;
    try {
      payload = authService.verifyToken(token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Get the admin user's password hash from the database
    const { data: adminUser, error: userError } = await supabase
      .from('users')
      .select('password_hash, role')
      .eq('id', payload.userId)
      .single();

    if (userError || !adminUser) {
      res.status(401).json({ error: 'Admin user not found' });
      return;
    }

    // Verify the user is a super_admin
    if (adminUser.role !== 'super_admin') {
      res.status(403).json({ error: 'Only super admins can delete businesses' });
      return;
    }

    // Verify the password
    const isValidPassword = await bcrypt.compare(password, adminUser.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    // Password verified, proceed with deletion
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

/**
 * GET /api/businesses/change-requests
 * Get all pending change requests (for SuperAdmin notifications)
 */
router.get('/change-requests/all', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string || 'pending';
    
    const { data, error } = await supabase
      .from('business_change_requests')
      .select(`
        *,
        business:businesses(id, name, slug),
        requester:business_users(id, username, first_name, last_name)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ data });
  } catch (error) {
    console.error('Error fetching change requests:', error);
    res.status(500).json({ 
      error: 'Failed to fetch change requests',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/businesses/change-requests/:id/approve
 * Approve a change request
 */
router.put('/change-requests/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { admin_notes, reviewed_by } = req.body;

    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from('business_change_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      res.status(404).json({ error: 'Change request not found' });
      return;
    }

    // Apply the changes to the business
    const updateData: any = {};
    
    // Profile fields
    if (request.new_name) updateData.name = request.new_name;
    if (request.new_email) updateData.email = request.new_email;
    if (request.new_phone) updateData.phone = request.new_phone;
    if (request.new_address) updateData.address = request.new_address;
    if (request.new_logo_url) updateData.logo_url = request.new_logo_url;
    if (request.new_certificate_url) updateData.certificate_url = request.new_certificate_url;
    
    // Localization fields
    if (request.new_country) updateData.country = request.new_country;
    if (request.new_currency) updateData.currency = request.new_currency;
    if (request.new_language) updateData.language = request.new_language;
    if (request.new_timezone) updateData.timezone = request.new_timezone;
    
    // Tax/VAT fields
    if (request.new_vat_enabled !== null && request.new_vat_enabled !== undefined) {
      updateData.vat_enabled = request.new_vat_enabled;
    }
    if (request.new_vat_rate !== null && request.new_vat_rate !== undefined) {
      updateData.tax_rate = request.new_vat_rate;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', request.business_id);

      if (updateError) throw updateError;
    }

    // Update request status
    const { data, error } = await supabase
      .from('business_change_requests')
      .update({
        status: 'approved',
        admin_notes,
        reviewed_by,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    res.json({ data, message: 'Change request approved' });
  } catch (error) {
    console.error('Error approving change request:', error);
    res.status(500).json({ 
      error: 'Failed to approve change request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/businesses/change-requests/:id/reject
 * Reject a change request
 */
router.put('/change-requests/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { admin_notes, reviewed_by } = req.body;

    const { data, error } = await supabase
      .from('business_change_requests')
      .update({
        status: 'rejected',
        admin_notes,
        reviewed_by,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    res.json({ data, message: 'Change request rejected' });
  } catch (error) {
    console.error('Error rejecting change request:', error);
    res.status(500).json({ 
      error: 'Failed to reject change request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// BRANCH MANAGEMENT ROUTES
// ============================================

/**
 * GET /api/businesses/:id/branches
 * Get all branches for a business
 */
router.get('/:id/branches', async (req: Request, res: Response): Promise<void> => {
  try {
    const businessId = parseInt(req.params.id, 10);
    if (isNaN(businessId)) {
      res.status(400).json({ error: 'Invalid business ID' });
      return;
    }

    const branches = await businessService.getBranches(businessId);
    res.json({ branches });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ 
      error: 'Failed to fetch branches',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/businesses/:id/branches
 * Create a new branch for a business
 */
router.post('/:id/branches', async (req: Request, res: Response): Promise<void> => {
  try {
    const businessId = parseInt(req.params.id, 10);
    if (isNaN(businessId)) {
      res.status(400).json({ error: 'Invalid business ID' });
      return;
    }

    const { name, address, phone, email, is_main } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Branch name is required' });
      return;
    }

    const branch = await businessService.createBranch(businessId, {
      name,
      address,
      phone,
      email,
      is_main,
    });

    res.status(201).json({
      message: 'Branch created successfully',
      branch,
    });
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ 
      error: 'Failed to create branch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/businesses/:businessId/branches/:branchId
 * Update a branch
 */
router.put('/:businessId/branches/:branchId', async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId, 10);
    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' });
      return;
    }

    const branch = await businessService.updateBranch(branchId, req.body);
    
    res.json({
      message: 'Branch updated successfully',
      branch,
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ 
      error: 'Failed to update branch',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/businesses/:businessId/branches/:branchId
 * Soft delete a branch (sets is_active to false)
 */
router.delete('/:businessId/branches/:branchId', async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = parseInt(req.params.branchId, 10);
    if (isNaN(branchId)) {
      res.status(400).json({ error: 'Invalid branch ID' });
      return;
    }

    await businessService.deleteBranch(branchId);
    
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Error deleting branch:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    if (message.includes('main branch')) {
      res.status(400).json({ error: message });
    } else {
      res.status(500).json({ error: 'Failed to delete branch', message });
    }
  }
});

export default router;

