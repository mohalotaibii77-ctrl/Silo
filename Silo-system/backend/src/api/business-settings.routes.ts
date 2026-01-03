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
// Query params: branch_id (optional) - if provided, returns branch-specific settings with fallback to business defaults
router.get('/', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;

    // Always get business defaults first (for shared fields: name, email, logo)
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, slug, email, logo_url, country, currency, timezone, language, tax_rate, vat_enabled, tax_number')
      .eq('id', businessId)
      .single();

    if (businessError) throw businessError;

    let resultData = { ...businessData };

    // If branch_id provided, get branch-specific settings and merge
    if (branchId) {
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('id, name, phone, address, country, currency, timezone, language, tax_rate, vat_enabled, tax_number')
        .eq('id', branchId)
        .eq('business_id', businessId)
        .single();

      if (!branchError && branchData) {
        // Merge branch-specific fields (use branch value if not null, else business default)
        resultData = {
          ...resultData,
          branch_id: branchData.id,
          branch_name: branchData.name,
          phone: branchData.phone || businessData.phone,
          address: branchData.address || businessData.address,
          country: branchData.country || businessData.country,
          currency: branchData.currency || businessData.currency,
          timezone: branchData.timezone || businessData.timezone,
          language: branchData.language || businessData.language,
          tax_rate: branchData.tax_rate ?? businessData.tax_rate,
          vat_enabled: branchData.vat_enabled ?? businessData.vat_enabled,
          tax_number: branchData.tax_number || businessData.tax_number,
        };
      }
    }

    // Validate currency exists - no fallback allowed
    if (!resultData.currency) {
      return res.status(500).json({
        success: false,
        error: 'Business configuration incomplete: currency not set. Contact administrator.'
      });
    }

    res.json({ success: true, data: resultData, branch_id: branchId });
  } catch (error: any) {
    console.error('Error fetching business settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update business settings (general settings including VAT)
// Body params: branch_id (optional) - if provided, updates branch-specific settings
router.put('/', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { branch_id: branchId, vat_enabled, tax_rate, tax_number, country, currency, language, timezone, phone, address } = req.body;

    if (branchId) {
      // Update branch-specific settings
      const branchUpdateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Branch-specific fields
      if (phone !== undefined) branchUpdateData.phone = phone;
      if (address !== undefined) branchUpdateData.address = address;
      if (country !== undefined) branchUpdateData.country = country;
      if (currency !== undefined) branchUpdateData.currency = currency;
      if (language !== undefined) branchUpdateData.language = language;
      if (timezone !== undefined) branchUpdateData.timezone = timezone;
      if (vat_enabled !== undefined) branchUpdateData.vat_enabled = vat_enabled;
      if (tax_rate !== undefined) branchUpdateData.tax_rate = tax_rate;
      if (tax_number !== undefined) branchUpdateData.tax_number = tax_number;

      const { data, error } = await supabase
        .from('branches')
        .update(branchUpdateData)
        .eq('id', branchId)
        .eq('business_id', businessId)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data, message: 'Branch settings updated successfully' });
    } else {
      // Update business-wide settings (only name, email, logo are truly business-wide now)
      const businessUpdateData: any = {
        updated_at: new Date().toISOString(),
      };

      // These remain as business defaults for branches without overrides
      if (vat_enabled !== undefined) businessUpdateData.vat_enabled = vat_enabled;
      if (tax_rate !== undefined) businessUpdateData.tax_rate = tax_rate;
      if (tax_number !== undefined) businessUpdateData.tax_number = tax_number;
      if (country !== undefined) businessUpdateData.country = country;
      if (currency !== undefined) businessUpdateData.currency = currency;
      if (language !== undefined) businessUpdateData.language = language;
      if (timezone !== undefined) businessUpdateData.timezone = timezone;

      const { data, error } = await supabase
        .from('businesses')
        .update(businessUpdateData)
        .eq('id', businessId)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, data, message: 'Business settings updated successfully' });
    }
  } catch (error: any) {
    console.error('Error updating business settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get localization settings (branch-specific with fallback to business defaults)
// Query params: branch_id (optional)
router.get('/localization', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;

    // Get business defaults first
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('country, currency, timezone, language')
      .eq('id', businessId)
      .single();

    if (businessError) throw businessError;

    let resultData = { ...businessData };

    // If branch_id provided, get branch-specific settings
    if (branchId) {
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('country, currency, timezone, language')
        .eq('id', branchId)
        .eq('business_id', businessId)
        .single();

      if (!branchError && branchData) {
        // Use branch value if not null, else business default
        resultData = {
          country: branchData.country || businessData.country,
          currency: branchData.currency || businessData.currency,
          timezone: branchData.timezone || businessData.timezone,
          language: branchData.language || businessData.language,
        };
      }
    }

    // Validate currency exists - no fallback allowed
    if (!resultData.currency) {
      return res.status(500).json({
        error: 'Business configuration incomplete: currency not set. Contact administrator.'
      });
    }

    res.json({ data: resultData, branch_id: branchId });
  } catch (error: any) {
    console.error('Error fetching localization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update localization settings (branch-specific if branch_id provided)
// Body params: branch_id (optional)
router.put('/localization', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { branch_id: branchId, country, currency, language, timezone } = req.body;

    if (branchId) {
      // Update branch-specific localization
      const { data, error } = await supabase
        .from('branches')
        .update({
          country,
          currency,
          language,
          timezone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', branchId)
        .eq('business_id', businessId)
        .select()
        .single();

      if (error) throw error;

      res.json({ data, message: 'Branch localization settings updated' });
    } else {
      // Update business defaults
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

      res.json({ data, message: 'Business localization settings updated' });
    }
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
      new_country,
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

    // Fetch current business data to store old values
    const { data: currentBusiness, error: fetchError } = await supabase
      .from('businesses')
      .select('name, email, phone, address, logo_url, certificate_url, country, currency, language, timezone, vat_enabled, tax_rate')
      .eq('id', businessId)
      .single();

    if (fetchError) throw fetchError;

    // Validate currency exists - no fallback allowed
    if (!currentBusiness.currency) {
      return res.status(500).json({ 
        error: 'Business configuration incomplete: currency not set. Contact administrator.' 
      });
    }

    // Build the change request with both old and new values
    const changeRequestData: any = {
      business_id: businessId,
      requested_by: userId,
      request_type,
      requester_notes,
      status: 'pending',
    };

    // Profile fields - store old and new values
    if (new_name !== undefined) {
      changeRequestData.old_name = currentBusiness.name;
      changeRequestData.new_name = new_name;
    }
    if (new_email !== undefined) {
      changeRequestData.old_email = currentBusiness.email;
      changeRequestData.new_email = new_email;
    }
    if (new_phone !== undefined) {
      changeRequestData.old_phone = currentBusiness.phone;
      changeRequestData.new_phone = new_phone;
    }
    if (new_address !== undefined) {
      changeRequestData.old_address = currentBusiness.address;
      changeRequestData.new_address = new_address;
    }
    if (new_logo_url !== undefined) {
      changeRequestData.old_logo_url = currentBusiness.logo_url;
      changeRequestData.new_logo_url = new_logo_url;
    }
    if (new_certificate_url !== undefined) {
      changeRequestData.old_certificate_url = currentBusiness.certificate_url;
      changeRequestData.new_certificate_url = new_certificate_url;
    }

    // Localization fields - store old and new values
    if (new_country !== undefined) {
      changeRequestData.old_country = currentBusiness.country;
      changeRequestData.new_country = new_country;
    }
    if (new_currency !== undefined) {
      changeRequestData.old_currency = currentBusiness.currency;
      changeRequestData.new_currency = new_currency;
    }
    if (new_language !== undefined) {
      changeRequestData.old_language = currentBusiness.language;
      changeRequestData.new_language = new_language;
    }
    if (new_timezone !== undefined) {
      changeRequestData.old_timezone = currentBusiness.timezone;
      changeRequestData.new_timezone = new_timezone;
    }

    // Tax fields - store old and new values
    if (new_vat_enabled !== undefined) {
      changeRequestData.old_vat_enabled = currentBusiness.vat_enabled;
      changeRequestData.new_vat_enabled = new_vat_enabled;
    }
    if (new_vat_rate !== undefined) {
      changeRequestData.old_vat_rate = currentBusiness.tax_rate;
      changeRequestData.new_vat_rate = new_vat_rate;
    }

    const { data, error } = await supabase
      .from('business_change_requests')
      .insert(changeRequestData)
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

// ============================================
// OPERATIONAL SETTINGS ENDPOINTS
// ============================================

// Get operational settings for the business (or specific branch)
// Query params: branch_id (optional) - if provided, gets branch-specific settings with fallback to defaults
router.get('/operational', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;

    // Default settings template
    const defaultSettings = {
      business_id: businessId,
      branch_id: null,
      order_number_prefix: 'ORD',
      auto_accept_orders: false,
      order_preparation_time: 15,
      enable_order_notifications: true,
      kitchen_display_auto_clear: 30,
      kitchen_operation_mode: 'display',
      require_customer_phone: false,
      allow_order_notes: true,
      opening_time: '09:00',
      closing_time: '22:00',
      // POS Operation settings
      pos_opening_float_fixed: false,
      pos_opening_float_amount: 0,
      pos_session_allowed_user_ids: [],
      // Working days/hours and GPS check-in settings
      working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      require_gps_checkin: false,
      checkin_buffer_minutes_before: 15,
      checkin_buffer_minutes_after: 30,
      gps_accuracy_threshold_meters: 50,
      default_geofence_radius_meters: 100,
    };

    let data = null;

    if (branchId) {
      // Try to get branch-specific settings first
      const { data: branchSettings, error: branchError } = await supabase
        .from('operational_settings')
        .select('*')
        .eq('business_id', businessId)
        .eq('branch_id', branchId)
        .single();

      if (!branchError && branchSettings) {
        data = branchSettings;
      } else {
        // Fall back to business defaults (branch_id IS NULL)
        const { data: businessSettings, error: businessError } = await supabase
          .from('operational_settings')
          .select('*')
          .eq('business_id', businessId)
          .is('branch_id', null)
          .single();

        if (!businessError && businessSettings) {
          // Return business defaults but indicate it's not branch-specific
          data = { ...businessSettings, branch_id: null, is_branch_default: true };
        }
      }
    } else {
      // Get business-wide defaults (branch_id IS NULL)
      const { data: businessSettings, error } = await supabase
        .from('operational_settings')
        .select('*')
        .eq('business_id', businessId)
        .is('branch_id', null)
        .single();

      if (!error) {
        data = businessSettings;
      }
    }

    res.json({
      success: true,
      data: data || { ...defaultSettings, branch_id: branchId },
      branch_id: branchId,
    });
  } catch (error: any) {
    console.error('Error fetching operational settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update operational settings (for business or specific branch)
// Body params: branch_id (optional) - if provided, updates branch-specific settings
router.put('/operational', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const {
      branch_id: branchId, // Optional - if provided, this is branch-specific
      order_number_prefix,
      auto_accept_orders,
      order_preparation_time,
      enable_order_notifications,
      kitchen_display_auto_clear,
      kitchen_operation_mode,
      require_customer_phone,
      allow_order_notes,
      opening_time,
      closing_time,
      // POS Operation settings
      pos_opening_float_fixed,
      pos_opening_float_amount,
      pos_session_allowed_user_ids,
      // Working days/hours and GPS check-in settings
      working_days,
      require_gps_checkin,
      checkin_buffer_minutes_before,
      checkin_buffer_minutes_after,
      gps_accuracy_threshold_meters,
      default_geofence_radius_meters,
    } = req.body;

    // Build query to check for existing settings
    let existingQuery = supabase
      .from('operational_settings')
      .select('id')
      .eq('business_id', businessId);

    if (branchId) {
      existingQuery = existingQuery.eq('branch_id', branchId);
    } else {
      existingQuery = existingQuery.is('branch_id', null);
    }

    const { data: existing } = await existingQuery.single();

    const settingsData: any = {
      updated_at: new Date().toISOString(),
    };

    // Only update fields that are provided
    if (order_number_prefix !== undefined) settingsData.order_number_prefix = order_number_prefix;
    if (auto_accept_orders !== undefined) settingsData.auto_accept_orders = auto_accept_orders;
    if (order_preparation_time !== undefined) settingsData.order_preparation_time = order_preparation_time;
    if (enable_order_notifications !== undefined) settingsData.enable_order_notifications = enable_order_notifications;
    if (kitchen_display_auto_clear !== undefined) settingsData.kitchen_display_auto_clear = kitchen_display_auto_clear;
    if (kitchen_operation_mode !== undefined) settingsData.kitchen_operation_mode = kitchen_operation_mode;
    if (require_customer_phone !== undefined) settingsData.require_customer_phone = require_customer_phone;
    if (allow_order_notes !== undefined) settingsData.allow_order_notes = allow_order_notes;
    if (opening_time !== undefined) settingsData.opening_time = opening_time;
    if (closing_time !== undefined) settingsData.closing_time = closing_time;
    // POS Operation settings
    if (pos_opening_float_fixed !== undefined) settingsData.pos_opening_float_fixed = pos_opening_float_fixed;
    if (pos_opening_float_amount !== undefined) settingsData.pos_opening_float_amount = pos_opening_float_amount;
    if (pos_session_allowed_user_ids !== undefined) settingsData.pos_session_allowed_user_ids = pos_session_allowed_user_ids;
    // Working days/hours and GPS check-in settings
    if (working_days !== undefined) settingsData.working_days = working_days;
    if (require_gps_checkin !== undefined) settingsData.require_gps_checkin = require_gps_checkin;
    if (checkin_buffer_minutes_before !== undefined) settingsData.checkin_buffer_minutes_before = checkin_buffer_minutes_before;
    if (checkin_buffer_minutes_after !== undefined) settingsData.checkin_buffer_minutes_after = checkin_buffer_minutes_after;
    if (gps_accuracy_threshold_meters !== undefined) settingsData.gps_accuracy_threshold_meters = gps_accuracy_threshold_meters;
    if (default_geofence_radius_meters !== undefined) settingsData.default_geofence_radius_meters = default_geofence_radius_meters;

    let result;

    if (existing) {
      // Update existing settings
      let updateQuery = supabase
        .from('operational_settings')
        .update(settingsData)
        .eq('business_id', businessId);

      if (branchId) {
        updateQuery = updateQuery.eq('branch_id', branchId);
      } else {
        updateQuery = updateQuery.is('branch_id', null);
      }

      const { data, error } = await updateQuery.select().single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new settings
      settingsData.business_id = businessId;
      settingsData.branch_id = branchId || null;
      settingsData.created_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('operational_settings')
        .insert(settingsData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({
      success: true,
      data: result,
      message: branchId
        ? `Branch operational settings updated successfully`
        : 'Business operational settings updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating operational settings:', error);
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

    // Fetch current business data to store old values
    const { data: currentBusiness, error: fetchError } = await supabase
      .from('businesses')
      .select('logo_url, certificate_url')
      .eq('id', businessId)
      .single();

    if (fetchError) throw fetchError;

    // For now, store base64 data directly (in production, upload to storage)
    const fileUrl = file_data;

    const requestData: any = {
      business_id: businessId,
      requested_by: userId,
      request_type,
      status: 'pending',
      requester_notes,
    };

    // Store both old and new values
    if (request_type === 'logo') {
      requestData.old_logo_url = currentBusiness.logo_url;
      requestData.new_logo_url = fileUrl;
    } else if (request_type === 'certificate') {
      requestData.old_certificate_url = currentBusiness.certificate_url;
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

// ============================================
// GEOFENCE SETTINGS ENDPOINTS
// ============================================

// Get business-level geofence settings (from operational_settings)
router.get('/geofence', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;

    const { data, error } = await supabase
      .from('operational_settings')
      .select('require_gps_checkin, checkin_buffer_minutes_before, checkin_buffer_minutes_after, gps_accuracy_threshold_meters, default_geofence_radius_meters')
      .eq('business_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return defaults if no settings exist
    const defaultSettings = {
      require_gps_checkin: false,
      checkin_buffer_minutes_before: 15,
      checkin_buffer_minutes_after: 30,
      gps_accuracy_threshold_meters: 50,
      default_geofence_radius_meters: 100,
    };

    res.json({
      success: true,
      data: data || defaultSettings
    });
  } catch (error: any) {
    console.error('Error fetching geofence settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update business-level geofence settings
router.put('/geofence', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const {
      require_gps_checkin,
      checkin_buffer_minutes_before,
      checkin_buffer_minutes_after,
      gps_accuracy_threshold_meters,
      default_geofence_radius_meters,
    } = req.body;

    // Check if settings exist
    const { data: existing } = await supabase
      .from('operational_settings')
      .select('id')
      .eq('business_id', businessId)
      .single();

    const settingsData: any = {
      updated_at: new Date().toISOString(),
    };

    if (require_gps_checkin !== undefined) settingsData.require_gps_checkin = require_gps_checkin;
    if (checkin_buffer_minutes_before !== undefined) settingsData.checkin_buffer_minutes_before = checkin_buffer_minutes_before;
    if (checkin_buffer_minutes_after !== undefined) settingsData.checkin_buffer_minutes_after = checkin_buffer_minutes_after;
    if (gps_accuracy_threshold_meters !== undefined) settingsData.gps_accuracy_threshold_meters = gps_accuracy_threshold_meters;
    if (default_geofence_radius_meters !== undefined) settingsData.default_geofence_radius_meters = default_geofence_radius_meters;

    let result;

    if (existing) {
      const { data, error } = await supabase
        .from('operational_settings')
        .update(settingsData)
        .eq('business_id', businessId)
        .select('require_gps_checkin, checkin_buffer_minutes_before, checkin_buffer_minutes_after, gps_accuracy_threshold_meters, default_geofence_radius_meters')
        .single();

      if (error) throw error;
      result = data;
    } else {
      settingsData.business_id = businessId;
      settingsData.created_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('operational_settings')
        .insert(settingsData)
        .select('require_gps_checkin, checkin_buffer_minutes_before, checkin_buffer_minutes_after, gps_accuracy_threshold_meters, default_geofence_radius_meters')
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({
      success: true,
      data: result,
      message: 'Geofence settings updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating geofence settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BRANCH MANAGEMENT ENDPOINTS
// ============================================

// Get all branches for the authenticated user's business
router.get('/branches', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;

    const { data, error } = await supabase
      .from('branches')
      .select('id, name, branch_code, address, phone, is_main, latitude, longitude')
      .eq('business_id', businessId)
      .order('is_main', { ascending: false })
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BRANCH GEOFENCE ENDPOINTS
// ============================================

// Get all branches with geofence status for the business
// NOTE: This route MUST be before /branches/:branchId/geofence to avoid matching "geofence" as branchId
router.get('/branches/geofence', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;

    const { data, error } = await supabase
      .from('branches')
      .select('id, name, branch_code, latitude, longitude, geofence_radius_meters, geofence_enabled')
      .eq('business_id', businessId)
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: data.map(branch => ({
        id: branch.id,
        name: branch.name,
        code: branch.branch_code,
        latitude: branch.latitude,
        longitude: branch.longitude,
        geofence_radius_meters: branch.geofence_radius_meters || 100,
        geofence_enabled: branch.geofence_enabled || false,
      }))
    });
  } catch (error: any) {
    console.error('Error fetching branches geofence:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single branch geofence configuration
router.get('/branches/:branchId/geofence', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const branchId = parseInt(req.params.branchId);

    // Verify branch belongs to this business
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, latitude, longitude, geofence_radius_meters, geofence_enabled')
      .eq('id', branchId)
      .eq('business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Branch not found' });
      }
      throw error;
    }

    res.json({
      success: true,
      data: {
        branch_id: data.id,
        branch_name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        geofence_radius_meters: data.geofence_radius_meters || 100,
        geofence_enabled: data.geofence_enabled || false,
      }
    });
  } catch (error: any) {
    console.error('Error fetching branch geofence:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update branch geofence configuration
router.put('/branches/:branchId/geofence', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const branchId = parseInt(req.params.branchId);
    const { latitude, longitude, geofence_radius_meters, geofence_enabled } = req.body;

    // Verify branch belongs to this business
    const { data: existing, error: checkError } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .eq('business_id', businessId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (geofence_radius_meters !== undefined) updateData.geofence_radius_meters = geofence_radius_meters;
    if (geofence_enabled !== undefined) updateData.geofence_enabled = geofence_enabled;

    const { data, error } = await supabase
      .from('branches')
      .update(updateData)
      .eq('id', branchId)
      .select('id, name, latitude, longitude, geofence_radius_meters, geofence_enabled')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        branch_id: data.id,
        branch_name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        geofence_radius_meters: data.geofence_radius_meters,
        geofence_enabled: data.geofence_enabled,
      },
      message: 'Branch geofence updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating branch geofence:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WORKING DAYS ENDPOINTS
// ============================================

// Get working days configuration
router.get('/working-days', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;

    const { data, error } = await supabase
      .from('operational_settings')
      .select('working_days, opening_time, closing_time')
      .eq('business_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return defaults if no settings exist
    const defaultSettings = {
      working_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      opening_time: '09:00',
      closing_time: '22:00',
    };

    res.json({
      success: true,
      data: data || defaultSettings
    });
  } catch (error: any) {
    console.error('Error fetching working days:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update working days configuration
router.put('/working-days', authenticateBusinessToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessUser?.business_id;
    const { working_days, opening_time, closing_time } = req.body;

    // Validate working_days if provided
    if (working_days !== undefined) {
      const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const isValid = Array.isArray(working_days) && working_days.every(day => validDays.includes(day.toLowerCase()));
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid working_days. Must be an array of day names (sunday, monday, etc.)'
        });
      }
    }

    // Check if settings exist
    const { data: existing } = await supabase
      .from('operational_settings')
      .select('id')
      .eq('business_id', businessId)
      .single();

    const settingsData: any = {
      updated_at: new Date().toISOString(),
    };

    if (working_days !== undefined) settingsData.working_days = working_days.map((d: string) => d.toLowerCase());
    if (opening_time !== undefined) settingsData.opening_time = opening_time;
    if (closing_time !== undefined) settingsData.closing_time = closing_time;

    let result;

    if (existing) {
      const { data, error } = await supabase
        .from('operational_settings')
        .update(settingsData)
        .eq('business_id', businessId)
        .select('working_days, opening_time, closing_time')
        .single();

      if (error) throw error;
      result = data;
    } else {
      settingsData.business_id = businessId;
      settingsData.created_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('operational_settings')
        .insert(settingsData)
        .select('working_days, opening_time, closing_time')
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({
      success: true,
      data: result,
      message: 'Working days updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating working days:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
