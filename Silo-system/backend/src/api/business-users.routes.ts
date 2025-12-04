import { Router, Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/database';
import { businessAuthService } from '../services/business-auth.service';
import bcrypt from 'bcryptjs';

const router = Router();

const DEFAULT_PASSWORD = '90074007';

interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    username: string;
    role: string;
  };
}

// Auth middleware - only owner can manage users
// Supports workspace switching via X-Business-Id header
async function authenticateOwner(req: AuthenticatedRequest, res: Response, next: Function) {
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

    // Only owners can manage users
    if (user.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can manage users' });
    }

    // Check for workspace switching header (X-Business-Id)
    const headerBusinessId = req.headers['x-business-id'] as string;
    let businessId = user.business_id;

    console.log(`[business-users] User: ${user.username}, Token business_id: ${user.business_id}, Header X-Business-Id: ${headerBusinessId}`);

    if (headerBusinessId && parseInt(headerBusinessId) !== user.business_id) {
      // Owner is trying to access a different business (workspace switching)
      // Verify they have access via the business_owners table
      const { data: ownerAccess } = await supabase
        .from('owners')
        .select(`
          id,
          business_owners!inner (
            business_id
          )
        `)
        .ilike('username', user.username)
        .eq('business_owners.business_id', parseInt(headerBusinessId))
        .single();

      console.log(`[business-users] Owner access check for business ${headerBusinessId}:`, ownerAccess ? 'GRANTED' : 'DENIED');

      if (!ownerAccess) {
        return res.status(403).json({ error: 'Access denied to this business' });
      }

      // Owner has access - use the header's business ID
      businessId = parseInt(headerBusinessId);
    }

    console.log(`[business-users] Final business_id used: ${businessId}`);

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

// GET /api/business-users - Get all users for the business
router.get('/', authenticateOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const ownerUsername = req.businessUser?.username;

    // Sync owner data from owners table to ensure consistency across workspaces
    if (ownerUsername) {
      // Get owner details from owners table (source of truth)
      const { data: owner } = await supabase
        .from('owners')
        .select('username, email, first_name, last_name, phone, password_hash')
        .ilike('username', ownerUsername)
        .single();

      if (owner) {
        const { data: ownerUserRecord } = await supabase
          .from('business_users')
          .select('id')
          .eq('business_id', businessId)
          .ilike('username', ownerUsername)
          .single();

        if (!ownerUserRecord) {
          // Create missing business_users record
          console.log(`[business-users] Creating missing business_users record for owner ${ownerUsername} in business ${businessId}`);
          await supabase
            .from('business_users')
            .insert({
              business_id: businessId,
              username: owner.username,
              email: owner.email,
              password_hash: owner.password_hash,
              role: 'owner',
              first_name: owner.first_name,
              last_name: owner.last_name,
              phone: owner.phone,
              status: 'active'
            });
        } else {
          // Update existing record to sync with owners table
          console.log(`[business-users] Syncing owner data for ${ownerUsername} in business ${businessId}`);
          await supabase
            .from('business_users')
            .update({
              first_name: owner.first_name,
              last_name: owner.last_name,
              email: owner.email,
              phone: owner.phone,
              updated_at: new Date().toISOString()
            })
            .eq('id', ownerUserRecord.id);
        }
      }
    }

    // Get business info for max_users
    const { data: business } = await supabase
      .from('businesses')
      .select('max_users, user_count')
      .eq('id', businessId)
      .single();

    const { data: users, error } = await supabase
      .from('business_users')
      .select('id, username, role, first_name, last_name, email, phone, status, last_login, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ 
      data: users || [],
      max_users: business?.max_users || 5,
      user_count: users?.length || 0,
      current_user_id: req.businessUser?.id,
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/business-users - Create a new user
router.post('/', authenticateOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { username, role, first_name, last_name, email, phone } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!role || !['manager', 'employee', 'pos'].includes(role)) {
      return res.status(400).json({ error: 'Role must be manager, employee, or pos' });
    }

    // Check max users limit
    const { data: business } = await supabase
      .from('businesses')
      .select('max_users')
      .eq('id', businessId)
      .single();

    const { count } = await supabase
      .from('business_users')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (count && business && count >= business.max_users) {
      return res.status(400).json({ error: `Maximum ${business.max_users} users allowed for this business` });
    }

    // Check if username already exists in this business
    const { data: existing } = await supabase
      .from('business_users')
      .select('id')
      .eq('business_id', businessId)
      .eq('username', username.trim())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const { data: user, error } = await supabase
      .from('business_users')
      .insert({
        business_id: businessId,
        username: username.trim(),
        password_hash,
        role,
        first_name: first_name?.trim() || null,
        last_name: last_name?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        status: 'active',
      })
      .select('id, username, role, first_name, last_name, email, phone, status, created_at')
      .single();

    if (error) throw error;

    // Update user_count
    await supabase
      .from('businesses')
      .update({ user_count: (count || 0) + 1 })
      .eq('id', businessId);

    res.status(201).json({ 
      data: user, 
      message: 'User created successfully',
      default_password: DEFAULT_PASSWORD,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/business-users/:id - Update a user
router.put('/:id', authenticateOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const currentUserId = req.businessUser?.id;
    const userId = parseInt(req.params.id);
    const { username, role, first_name, last_name, email, phone, status } = req.body;

    // Check if user belongs to this business
    const { data: user } = await supabase
      .from('business_users')
      .select('*')
      .eq('id', userId)
      .eq('business_id', businessId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Owner can only edit their own info, not another owner's
    if (user.role === 'owner' && userId !== currentUserId) {
      return res.status(403).json({ error: 'Cannot edit another owner\'s information' });
    }

    // Cannot change owner's role
    if (user.role === 'owner' && role && role !== 'owner') {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    // Cannot demote the only owner (only check if role is explicitly being changed)
    if (user.role === 'owner' && role !== undefined && role !== 'owner') {
      const { count } = await supabase
        .from('business_users')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('role', 'owner');

      if (count === 1) {
        return res.status(400).json({ error: 'Cannot remove the only owner' });
      }
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (username !== undefined) updateData.username = username.trim();
    if (role !== undefined && user.role !== 'owner') updateData.role = role;
    if (first_name !== undefined) updateData.first_name = first_name?.trim() || null;
    if (last_name !== undefined) updateData.last_name = last_name?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (status !== undefined && user.role !== 'owner') updateData.status = status;

    const { data, error } = await supabase
      .from('business_users')
      .update(updateData)
      .eq('id', userId)
      .select('id, username, role, first_name, last_name, email, phone, status, created_at')
      .single();

    if (error) throw error;

    // If updating an owner, also update the owners table (source of truth)
    // This ensures owner data stays consistent across all workspaces
    if (user.role === 'owner') {
      const ownerUpdateData: any = { updated_at: new Date().toISOString() };
      if (first_name !== undefined) ownerUpdateData.first_name = first_name?.trim() || null;
      if (last_name !== undefined) ownerUpdateData.last_name = last_name?.trim() || null;
      if (email !== undefined) ownerUpdateData.email = email?.trim() || null;
      if (phone !== undefined) ownerUpdateData.phone = phone?.trim() || null;
      
      await supabase
        .from('owners')
        .update(ownerUpdateData)
        .ilike('username', user.username);
      
      console.log(`[business-users] Updated owners table for ${user.username}`);
    }

    res.json({ data, message: 'User updated successfully' });
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/business-users/:id - Delete a user
router.delete('/:id', authenticateOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const currentUserId = req.businessUser?.id;
    const userId = parseInt(req.params.id);

    // Cannot delete yourself
    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user belongs to this business
    const { data: user } = await supabase
      .from('business_users')
      .select('role')
      .eq('id', userId)
      .eq('business_id', businessId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete owner
    if (user.role === 'owner') {
      return res.status(400).json({ error: 'Cannot delete owner account' });
    }

    const { error } = await supabase
      .from('business_users')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    // Update user_count
    const { count } = await supabase
      .from('business_users')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    await supabase
      .from('businesses')
      .update({ user_count: count || 0 })
      .eq('id', businessId);

    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/business-users/:id/reset-password - Reset user password to default
router.post('/:id/reset-password', authenticateOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const userId = parseInt(req.params.id);

    // Check if user belongs to this business
    const { data: user } = await supabase
      .from('business_users')
      .select('id')
      .eq('id', userId)
      .eq('business_id', businessId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const { error } = await supabase
      .from('business_users')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;

    res.json({ message: 'Password reset to default', default_password: DEFAULT_PASSWORD });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

