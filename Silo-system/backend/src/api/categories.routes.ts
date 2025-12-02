import { Router, Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/database';
import { businessAuthService } from '../services/business-auth.service';

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
      // User is trying to access a different business (workspace switching)
      // Only owners can switch workspaces
      if (user.role === 'owner') {
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

// GET /api/categories - Get all categories (system + business-specific)
router.get('/', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;

    // Get both system categories and business-specific categories
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .or(`is_system.eq.true,business_id.eq.${businessId}`)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Mark which are system (general) categories
    const categoriesWithType = (data || []).map(cat => ({
      ...cat,
      is_general: cat.is_system && !cat.business_id,
    }));

    res.json({ data: categoriesWithType });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/categories - Create a new business-specific category
router.post('/', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { name, name_ar, description, display_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category with same name exists for this business
    const { data: existing } = await supabase
      .from('product_categories')
      .select('id')
      .eq('business_id', businessId)
      .ilike('name', name.trim())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'A category with this name already exists' });
    }

    // Get max display_order
    const { data: maxOrder } = await supabase
      .from('product_categories')
      .select('display_order')
      .or(`is_system.eq.true,business_id.eq.${businessId}`)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        name: name.trim(),
        name_ar: name_ar?.trim() || null,
        description: description?.trim() || null,
        business_id: businessId,
        is_system: false,
        display_order: display_order || ((maxOrder?.display_order || 0) + 1),
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data, message: 'Category created successfully' });
  } catch (error: any) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/categories/:id - Update a business-specific category
router.put('/:id', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const categoryId = parseInt(req.params.id);
    const { name, name_ar, description, display_order, is_active } = req.body;

    // Check if category belongs to this business (not system)
    const { data: category } = await supabase
      .from('product_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Cannot edit system categories
    if (category.is_system) {
      return res.status(403).json({ error: 'Cannot edit system categories' });
    }

    if (category.business_id !== businessId) {
      return res.status(403).json({ error: 'Cannot edit categories from other businesses' });
    }

    const { data, error } = await supabase
      .from('product_categories')
      .update({
        name: name?.trim() || category.name,
        name_ar: name_ar?.trim() || category.name_ar,
        description: description?.trim() || category.description,
        display_order: display_order ?? category.display_order,
        is_active: is_active ?? category.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;

    res.json({ data, message: 'Category updated successfully' });
  } catch (error: any) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/categories/:id - Delete a business-specific category
router.delete('/:id', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const categoryId = parseInt(req.params.id);

    // Check if category belongs to this business (not system)
    const { data: category } = await supabase
      .from('product_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category.is_system) {
      return res.status(403).json({ error: 'Cannot delete system categories' });
    }

    if (category.business_id !== businessId) {
      return res.status(403).json({ error: 'Cannot delete categories from other businesses' });
    }

    // Check if any products are using this category
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('category_id', categoryId)
      .limit(1);

    if (products && products.length > 0) {
      return res.status(400).json({ error: 'Cannot delete category that has products. Remove products from this category first.' });
    }

    const { error } = await supabase
      .from('product_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

