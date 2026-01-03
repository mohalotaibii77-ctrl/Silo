import { Router, Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/database';
import { businessAuthService } from '../services/business-auth.service';
import bcrypt from 'bcryptjs';

const router = Router();

const DEFAULT_PASSWORD = '90074009';

/**
 * Generate a unique 4-digit PIN for a business
 * Ensures no duplicate PINs within the same business
 */
async function generateUniquePIN(businessId: number): Promise<string> {
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random 4-digit PIN (1000-9999)
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    
    // Check if PIN already exists in this business
    const { data: existing } = await supabase
      .from('business_users')
      .select('id')
      .eq('business_id', businessId)
      .eq('pos_pin', pin)
      .single();
    
    if (!existing) {
      return pin;
    }
  }
  
  // Fallback to 6-digit PIN if all 4-digit PINs are taken (very unlikely)
  const pin6 = String(Math.floor(100000 + Math.random() * 900000));
  return pin6;
}

// Default permissions by role
const DEFAULT_PERMISSIONS = {
  manager: {
    orders: true,
    menu_edit: true,
    inventory: true,
    delivery: true,
    tables: true,
    drivers: true,
    discounts: true,
    pos_access: true,  // Managers can access POS by default
  },
  employee: {
    orders: false,
    menu_edit: false,
    inventory: false,
    delivery: false,
    tables: false,
    drivers: false,
    discounts: false,
    pos_access: false, // Must be explicitly granted
  },
  // POS and Kitchen Display have fixed access - no configurable permissions
  pos: null,
  kitchen_display: null,
};

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
      .select('id, username, role, first_name, last_name, email, phone, status, permissions, last_login, created_at, pos_pin, branch_id')
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
    const { username, role, first_name, last_name, email, phone, permissions, branch_id } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!role || !['manager', 'employee', 'pos', 'kitchen_display'].includes(role)) {
      return res.status(400).json({ error: 'Role must be manager, employee, pos, or kitchen_display' });
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

    // Check if username already exists in this business (case-insensitive to match login behavior)
    const { data: existing } = await supabase
      .from('business_users')
      .select('id')
      .eq('business_id', businessId)
      .ilike('username', username.trim())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Set permissions: use provided permissions or default based on role
    // POS and Kitchen Display don't have configurable permissions
    let userPermissions = null;
    if (role === 'manager' || role === 'employee') {
      if (permissions && typeof permissions === 'object') {
        userPermissions = permissions;
      } else {
        userPermissions = DEFAULT_PERMISSIONS[role as 'manager' | 'employee'];
      }
    }

    // Check if user needs a POS PIN
    // PIN is required if: role is 'pos', 'manager', or has pos_access permission
    const needsPosPin = role === 'pos' || role === 'manager' || 
      (userPermissions && userPermissions.pos_access);
    
    let posPin = null;
    if (needsPosPin) {
      posPin = await generateUniquePIN(businessId!);
    }

    const { data: user, error } = await supabase
      .from('business_users')
      .insert({
        business_id: businessId,
        branch_id: branch_id || null,
        username: username.trim(),
        password_hash,
        role,
        first_name: first_name?.trim() || null,
        last_name: last_name?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        status: 'active',
        permissions: userPermissions,
        password_changed: false, // Requires password change on first login
        pos_pin: posPin,
      })
      .select('id, username, role, first_name, last_name, email, phone, status, permissions, created_at, pos_pin, branch_id')
      .single();

    if (error) throw error;

    // Update user_count
    await supabase
      .from('businesses')
      .update({ user_count: (count || 0) + 1 })
      .eq('id', businessId);

    res.status(201).json({ 
      data: user, 
      message: posPin 
        ? `User created successfully. POS PIN: ${posPin}` 
        : 'User created successfully',
      default_password: DEFAULT_PASSWORD,
      pos_pin: posPin,
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
    const { username, role, first_name, last_name, email, phone, status, permissions, branch_id } = req.body;

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

    // Check if new username already exists (case-insensitive to match login behavior)
    if (username !== undefined && username.trim().toLowerCase() !== user.username.toLowerCase()) {
      const { data: existingUsername } = await supabase
        .from('business_users')
        .select('id')
        .eq('business_id', businessId)
        .ilike('username', username.trim())
        .single();

      if (existingUsername) {
        return res.status(400).json({ error: 'Username already exists' });
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
    if (branch_id !== undefined) updateData.branch_id = branch_id || null;
    
    // Update permissions only for manager/employee roles
    const effectiveRole = role !== undefined ? role : user.role;
    if (permissions !== undefined && (effectiveRole === 'manager' || effectiveRole === 'employee')) {
      updateData.permissions = permissions;
    }
    // If role is changing to POS or Kitchen Display, clear permissions
    if (role !== undefined && (role === 'pos' || role === 'kitchen_display')) {
      updateData.permissions = null;
    }
    // If role is changing to manager/employee and no permissions provided, set defaults
    if (role !== undefined && (role === 'manager' || role === 'employee') && permissions === undefined) {
      updateData.permissions = DEFAULT_PERMISSIONS[role as 'manager' | 'employee'];
    }

    // Handle POS PIN generation/update
    // Check if user now needs a PIN (didn't have one before, now needs POS access)
    const currentPermissions = user.permissions || {};
    const newPermissions = updateData.permissions || currentPermissions;
    const effectiveRoleFinal = updateData.role || user.role;
    
    const previouslyNeededPin = user.role === 'pos' || user.role === 'manager' || currentPermissions.pos_access;
    const nowNeedsPin = effectiveRoleFinal === 'pos' || effectiveRoleFinal === 'manager' || 
      (newPermissions && newPermissions.pos_access);
    
    // Generate PIN if user now needs one but doesn't have one
    if (nowNeedsPin && !user.pos_pin) {
      updateData.pos_pin = await generateUniquePIN(businessId!);
    }
    
    // Optionally clear PIN if user no longer needs POS access
    // (commented out - we keep the PIN in case they need it again)
    // if (!nowNeedsPin && previouslyNeededPin) {
    //   updateData.pos_pin = null;
    // }

    const { data, error } = await supabase
      .from('business_users')
      .update(updateData)
      .eq('id', userId)
      .select('id, username, role, first_name, last_name, email, phone, status, permissions, created_at, pos_pin, branch_id')
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

// POST /api/business-users/:id/reset-pin - Reset user POS PIN
router.post('/:id/reset-pin', authenticateOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const userId = parseInt(req.params.id);

    // Check if user belongs to this business
    const { data: user } = await supabase
      .from('business_users')
      .select('id, role, permissions')
      .eq('id', userId)
      .eq('business_id', businessId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has POS access
    const hasPosAccess = user.role === 'pos' || user.role === 'manager' || user.role === 'owner' ||
      (user.permissions && user.permissions.pos_access);

    if (!hasPosAccess) {
      return res.status(400).json({ error: 'User does not have POS access' });
    }

    // Generate new unique PIN
    const newPin = await generateUniquePIN(businessId!);

    const { error } = await supabase
      .from('business_users')
      .update({ pos_pin: newPin, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;

    res.json({ message: 'POS PIN reset successfully', pos_pin: newPin });
  } catch (error: any) {
    console.error('Error resetting PIN:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/business-users/:id/set-pin - Set a specific POS PIN (owner can set custom PIN)
router.put('/:id/set-pin', authenticateOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const userId = parseInt(req.params.id);
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    // Check if user belongs to this business
    const { data: user } = await supabase
      .from('business_users')
      .select('id, role, permissions')
      .eq('id', userId)
      .eq('business_id', businessId)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if PIN is already used by another user in this business
    const { data: existingPin } = await supabase
      .from('business_users')
      .select('id')
      .eq('business_id', businessId)
      .eq('pos_pin', pin)
      .neq('id', userId)
      .single();

    if (existingPin) {
      return res.status(400).json({ error: 'This PIN is already in use by another employee' });
    }

    const { error } = await supabase
      .from('business_users')
      .update({ pos_pin: pin, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;

    res.json({ message: 'POS PIN updated successfully', pos_pin: pin });
  } catch (error: any) {
    console.error('Error setting PIN:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

