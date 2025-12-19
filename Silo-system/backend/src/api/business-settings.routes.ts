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

// Submit a change request (profile, localization, or tax changes)
router.post('/change-requests', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const userId = req.businessUser?.id;
    const { 
      request_type, 
      new_name, 
      new_email, 
      new_phone, 
      new_address, 
      new_logo_url, 
      new_certificate_url, 
      requester_notes,
      // Localization fields
      new_currency,
      new_language,
      new_timezone,
      // Tax fields
      new_vat_enabled,
      new_vat_rate,
    } = req.body;

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
        requester_notes,
        // Localization fields
        new_currency,
        new_language,
        new_timezone,
        // Tax fields
        new_vat_enabled,
        new_vat_rate,
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

// ============================================
// USER SETTINGS ENDPOINTS
// ============================================

// Get current user's settings
router.get('/user-settings', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.businessUser?.id;
    
    const { data, error } = await supabase
      .from('business_users')
      .select('preferred_language, preferred_theme, settings')
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Return with defaults if null
    res.json({
      success: true,
      data: {
        preferred_language: data.preferred_language || 'en',
        preferred_theme: data.preferred_theme || 'system',
        settings: data.settings || {},
      }
    });
  } catch (error: any) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update current user's settings
router.put('/user-settings', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.businessUser?.id;
    const { preferred_language, preferred_theme, settings } = req.body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Only update fields that are provided
    if (preferred_language !== undefined) updateData.preferred_language = preferred_language;
    if (preferred_theme !== undefined) updateData.preferred_theme = preferred_theme;
    if (settings !== undefined) updateData.settings = settings;

    const { data, error } = await supabase
      .from('business_users')
      .update(updateData)
      .eq('id', userId)
      .select('preferred_language, preferred_theme, settings')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        preferred_language: data.preferred_language || 'en',
        preferred_theme: data.preferred_theme || 'system',
        settings: data.settings || {},
      },
      message: 'User settings updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RECEIPT SETTINGS ENDPOINTS
// ============================================

// Get receipt settings for the business
router.get('/receipt', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    
    const { data, error } = await supabase
      .from('receipt_settings')
      .select('*')
      .eq('business_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine for new businesses
      throw error;
    }

    // Return defaults if no settings exist
    const defaultSettings = {
      business_id: businessId,
      receipt_logo_url: null,
      print_languages: ['en'],
      main_language: 'en',
      receipt_header: '',
      receipt_footer: '',
      show_order_number: true,
      show_subtotal: true,
      show_closer_username: false,
      show_creator_username: false,
    };

    res.json({ 
      success: true, 
      data: data || defaultSettings 
    });
  } catch (error: any) {
    console.error('Error fetching receipt settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update receipt settings
router.put('/receipt', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { 
      receipt_logo_url,
      print_languages,
      main_language,
      receipt_header,
      receipt_footer,
      show_order_number,
      show_subtotal,
      show_closer_username,
      show_creator_username,
    } = req.body;

    // Check if settings exist
    const { data: existing } = await supabase
      .from('receipt_settings')
      .select('id')
      .eq('business_id', businessId)
      .single();

    const settingsData: any = {
      updated_at: new Date().toISOString(),
    };

    // Only update fields that are provided
    if (receipt_logo_url !== undefined) settingsData.receipt_logo_url = receipt_logo_url;
    if (print_languages !== undefined) settingsData.print_languages = print_languages;
    if (main_language !== undefined) settingsData.main_language = main_language;
    if (receipt_header !== undefined) settingsData.receipt_header = receipt_header;
    if (receipt_footer !== undefined) settingsData.receipt_footer = receipt_footer;
    if (show_order_number !== undefined) settingsData.show_order_number = show_order_number;
    if (show_subtotal !== undefined) settingsData.show_subtotal = show_subtotal;
    if (show_closer_username !== undefined) settingsData.show_closer_username = show_closer_username;
    if (show_creator_username !== undefined) settingsData.show_creator_username = show_creator_username;

    let result;
    
    if (existing) {
      // Update existing settings
      const { data, error } = await supabase
        .from('receipt_settings')
        .update(settingsData)
        .eq('business_id', businessId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new settings
      settingsData.business_id = businessId;
      settingsData.created_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('receipt_settings')
        .insert(settingsData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ 
      success: true, 
      data: result, 
      message: 'Receipt settings updated successfully' 
    });
  } catch (error: any) {
    console.error('Error updating receipt settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload receipt logo
router.post('/receipt/logo', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { file_data, file_name } = req.body;

    if (!file_data) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    // For now, store base64 data directly
    // In production, this should upload to Supabase Storage
    const logoUrl = file_data;

    // Check if settings exist
    const { data: existing } = await supabase
      .from('receipt_settings')
      .select('id')
      .eq('business_id', businessId)
      .single();

    let result;
    
    if (existing) {
      const { data, error } = await supabase
        .from('receipt_settings')
        .update({ 
          receipt_logo_url: logoUrl,
          updated_at: new Date().toISOString() 
        })
        .eq('business_id', businessId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('receipt_settings')
        .insert({ 
          business_id: businessId,
          receipt_logo_url: logoUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ 
      success: true, 
      data: result, 
      message: 'Receipt logo uploaded successfully' 
    });
  } catch (error: any) {
    console.error('Error uploading receipt logo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload file and create change request (using base64 for now)
router.post('/upload-request', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const userId = req.businessUser?.id;
    const { request_type, file_data, file_name, requester_notes } = req.body;

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
      requester_notes,
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
