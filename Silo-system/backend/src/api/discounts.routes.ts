import { Router, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/database';
import { authenticateBusiness, AuthenticatedRequest } from '../middleware/business-auth.middleware';

const router = Router();

// GET /api/discounts - Get all discount codes for business
router.get('/', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;

    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (error: any) {
    console.error('Error fetching discount codes:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/discounts/validate/:code - Validate a discount code (for POS)
router.get('/validate/:code', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const code = req.params.code.toUpperCase();

    const { data: discount, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('business_id', businessId)
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (error || !discount) {
      return res.status(404).json({ error: 'Invalid discount code' });
    }

    // Check if code has expired
    if (discount.end_date && new Date(discount.end_date) < new Date()) {
      return res.status(400).json({ error: 'Discount code has expired' });
    }

    // Check if code hasn't started yet
    if (discount.start_date && new Date(discount.start_date) > new Date()) {
      return res.status(400).json({ error: 'Discount code is not yet active' });
    }

    // Check usage limit
    if (discount.usage_limit && discount.used_count >= discount.usage_limit) {
      return res.status(400).json({ error: 'Discount code usage limit reached' });
    }

    res.json({ 
      data: {
        id: discount.id,
        code: discount.code,
        name: discount.name,
        name_ar: discount.name_ar,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        min_order_amount: discount.min_order_amount,
        max_discount_amount: discount.max_discount_amount,
      },
      valid: true 
    });
  } catch (error: any) {
    console.error('Error validating discount code:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/discounts - Create a new discount code
router.post('/', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const userId = req.businessUser?.id;
    const { 
      code, 
      name, 
      name_ar, 
      discount_type, 
      discount_value, 
      min_order_amount, 
      max_discount_amount,
      usage_limit,
      start_date,
      end_date 
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Discount code is required' });
    }

    if (!discount_value || discount_value <= 0) {
      return res.status(400).json({ error: 'Valid discount value is required' });
    }

    // Validate percentage is not over 100
    if (discount_type === 'percentage' && discount_value > 100) {
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from('discount_codes')
      .select('id')
      .eq('business_id', businessId)
      .eq('code', code.toUpperCase().trim())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'A discount code with this code already exists' });
    }

    const { data, error } = await supabase
      .from('discount_codes')
      .insert({
        business_id: businessId,
        code: code.toUpperCase().trim(),
        name: name?.trim() || null,
        name_ar: name_ar?.trim() || null,
        discount_type: discount_type || 'percentage',
        discount_value,
        min_order_amount: min_order_amount || 0,
        max_discount_amount: max_discount_amount || null,
        usage_limit: usage_limit || null,
        start_date: start_date || null,
        end_date: end_date || null,
        is_active: true,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data, message: 'Discount code created successfully' });
  } catch (error: any) {
    console.error('Error creating discount code:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/discounts/:id - Update a discount code
router.put('/:id', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const discountId = parseInt(req.params.id);
    const { 
      code, 
      name, 
      name_ar, 
      discount_type, 
      discount_value, 
      min_order_amount, 
      max_discount_amount,
      usage_limit,
      start_date,
      end_date,
      is_active 
    } = req.body;

    // Check if discount belongs to this business
    const { data: discount } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('id', discountId)
      .eq('business_id', businessId)
      .single();

    if (!discount) {
      return res.status(404).json({ error: 'Discount code not found' });
    }

    // If code is being changed, check for duplicates
    if (code && code.toUpperCase().trim() !== discount.code) {
      const { data: existing } = await supabase
        .from('discount_codes')
        .select('id')
        .eq('business_id', businessId)
        .eq('code', code.toUpperCase().trim())
        .single();

      if (existing) {
        return res.status(400).json({ error: 'A discount code with this code already exists' });
      }
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (code !== undefined) updateData.code = code.toUpperCase().trim();
    if (name !== undefined) updateData.name = name?.trim() || null;
    if (name_ar !== undefined) updateData.name_ar = name_ar?.trim() || null;
    if (discount_type !== undefined) updateData.discount_type = discount_type;
    if (discount_value !== undefined) updateData.discount_value = discount_value;
    if (min_order_amount !== undefined) updateData.min_order_amount = min_order_amount;
    if (max_discount_amount !== undefined) updateData.max_discount_amount = max_discount_amount;
    if (usage_limit !== undefined) updateData.usage_limit = usage_limit;
    // Explicitly handle null for dates to allow clearing them
    if ('start_date' in req.body) updateData.start_date = start_date || null;
    if ('end_date' in req.body) updateData.end_date = end_date || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('discount_codes')
      .update(updateData)
      .eq('id', discountId)
      .select()
      .single();

    if (error) throw error;

    res.json({ data, message: 'Discount code updated successfully' });
  } catch (error: any) {
    console.error('Error updating discount code:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/discounts/:id - Delete a discount code
router.delete('/:id', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const discountId = parseInt(req.params.id);

    // Check if discount belongs to this business
    const { data: discount } = await supabase
      .from('discount_codes')
      .select('id')
      .eq('id', discountId)
      .eq('business_id', businessId)
      .single();

    if (!discount) {
      return res.status(404).json({ error: 'Discount code not found' });
    }

    const { error } = await supabase
      .from('discount_codes')
      .delete()
      .eq('id', discountId);

    if (error) throw error;

    res.json({ message: 'Discount code deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting discount code:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/discounts/:id/use - Increment usage count (called when order is placed)
router.post('/:id/use', authenticateBusiness, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const discountId = parseInt(req.params.id);

    const { data: discount, error: fetchError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('id', discountId)
      .eq('business_id', businessId)
      .single();

    if (fetchError || !discount) {
      return res.status(404).json({ error: 'Discount code not found' });
    }

    const { error } = await supabase
      .from('discount_codes')
      .update({ 
        used_count: (discount.used_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', discountId);

    if (error) throw error;

    res.json({ message: 'Discount usage recorded' });
  } catch (error: any) {
    console.error('Error recording discount usage:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

