import { Router, Request, Response } from 'express';
import { supabaseAdmin as supabase } from '../config/database';
import { businessAuthService } from '../services/business-auth.service';

const router = Router();

// Extend Request type
interface AuthenticatedRequest extends Request {
  businessUser?: {
    id: number;
    business_id: number;
    username: string;
    role: string;
  };
}

// Simple middleware for business token authentication - supports workspace switching
async function authenticateBusinessToken(req: AuthenticatedRequest, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = businessAuthService.verifyToken(token);
    
    // Get user info
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

// Get all business settings (for POS and other apps)
router.get('/', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, slug, country, currency, timezone, language, tax_rate, vat_enabled, tax_number, logo_url')
      .eq('id', businessId)
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching business settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update business settings (general settings including VAT)
router.put('/', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { vat_enabled, tax_rate, tax_number, country, currency, language, timezone } = req.body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // VAT settings
    if (vat_enabled !== undefined) updateData.vat_enabled = vat_enabled;
    if (tax_rate !== undefined) updateData.tax_rate = tax_rate;
    if (tax_number !== undefined) updateData.tax_number = tax_number;
    
    // Localization settings (if provided)
    if (country !== undefined) updateData.country = country;
    if (currency !== undefined) updateData.currency = currency;
    if (language !== undefined) updateData.language = language;
    if (timezone !== undefined) updateData.timezone = timezone;

    const { data, error } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', businessId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data, message: 'Settings updated successfully' });
  } catch (error: any) {
    console.error('Error updating business settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get localization settings
router.get('/localization', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    
    const { data, error } = await supabase
      .from('businesses')
      .select('country, currency, timezone, language')
      .eq('id', businessId)
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Error fetching localization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update localization settings
router.put('/localization', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { country, currency, language, timezone } = req.body;

    const { data, error } = await supabase
      .from('businesses')
      .update({
        country,
        currency,
        language,
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId)
      .select()
      .single();

    if (error) throw error;

    res.json({ data, message: 'Localization settings updated' });
  } catch (error: any) {
    console.error('Error updating localization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get change requests for the business
router.get('/change-requests', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;

    const { data, error } = await supabase
      .from('business_change_requests')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    console.error('Error fetching change requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit a change request (profile changes)
router.post('/change-requests', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const userId = req.businessUser?.id;
    const { request_type, new_name, new_email, new_phone, new_address, new_logo_url, new_certificate_url } = req.body;

    // Check if there's already a pending request of this type
    const { data: existing } = await supabase
      .from('business_change_requests')
      .select('id')
      .eq('business_id', businessId)
      .eq('request_type', request_type)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return res.status(400).json({ error: 'You already have a pending request of this type' });
    }

    const { data, error } = await supabase
      .from('business_change_requests')
      .insert({
        business_id: businessId,
        requested_by: userId,
        request_type,
        new_name,
        new_email,
        new_phone,
        new_address,
        new_logo_url,
        new_certificate_url,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data, message: 'Change request submitted' });
  } catch (error: any) {
    console.error('Error submitting change request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload file and create change request (using base64 for now)
router.post('/upload-request', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const userId = req.businessUser?.id;
    const { request_type, file_data, file_name } = req.body;

    if (!file_data) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    // Check if there's already a pending request of this type
    const { data: existing } = await supabase
      .from('business_change_requests')
      .select('id')
      .eq('business_id', businessId)
      .eq('request_type', request_type)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return res.status(400).json({ error: 'You already have a pending request of this type' });
    }

    // For now, store base64 data directly (in production, upload to storage)
    const fileUrl = file_data;

    const requestData: any = {
      business_id: businessId,
      requested_by: userId,
      request_type,
      status: 'pending',
    };

    if (request_type === 'logo') {
      requestData.new_logo_url = fileUrl;
    } else if (request_type === 'certificate') {
      requestData.new_certificate_url = fileUrl;
    }

    const { data, error } = await supabase
      .from('business_change_requests')
      .insert(requestData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ data, message: 'File uploaded and request submitted' });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
