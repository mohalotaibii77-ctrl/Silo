/**
 * BUNDLES SERVICE
 * Manage product bundles - 2+ products sold together as 1
 */

import { supabaseAdmin } from '../config/database';

export interface Bundle {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: BundleItem[];
}

export interface BundleItem {
  id: number;
  bundle_id: number;
  product_id: number;
  quantity: number;
  product?: {
    id: number;
    name: string;
    name_ar?: string;
    price: number;
    image_url?: string;
  };
}

export interface CreateBundleInput {
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  items: { product_id: number; quantity: number }[];
}

export interface UpdateBundleInput {
  name?: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  price?: number;
  compare_at_price?: number;
  image_url?: string;
  is_active?: boolean;
  items?: { product_id: number; quantity: number }[];
}

class BundlesService {
  /**
   * Get all bundles for a business
   */
  async getBundles(businessId: number): Promise<Bundle[]> {
    const { data: bundles, error } = await supabaseAdmin
      .from('bundles')
      .select(`
        *,
        bundle_items (
          id,
          product_id,
          quantity,
          products (
            id,
            name,
            name_ar,
            price,
            image_url
          )
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bundles:', error);
      throw new Error(`Failed to fetch bundles: ${error.message}`);
    }

    // Transform the data to match our interface
    return (bundles || []).map((bundle: any) => ({
      ...bundle,
      items: (bundle.bundle_items || []).map((item: any) => ({
        id: item.id,
        bundle_id: bundle.id,
        product_id: item.product_id,
        quantity: item.quantity,
        product: item.products
      }))
    }));
  }

  /**
   * Get a single bundle by ID
   */
  async getBundle(bundleId: number, businessId: number): Promise<Bundle | null> {
    const { data: bundle, error } = await supabaseAdmin
      .from('bundles')
      .select(`
        *,
        bundle_items (
          id,
          product_id,
          quantity,
          products (
            id,
            name,
            name_ar,
            price,
            image_url
          )
        )
      `)
      .eq('id', bundleId)
      .eq('business_id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch bundle: ${error.message}`);
    }

    return {
      ...bundle,
      items: (bundle.bundle_items || []).map((item: any) => ({
        id: item.id,
        bundle_id: bundle.id,
        product_id: item.product_id,
        quantity: item.quantity,
        product: item.products
      }))
    };
  }

  /**
   * Create a new bundle
   */
  async createBundle(businessId: number, input: CreateBundleInput): Promise<Bundle> {
    // Validate at least 2 products
    if (!input.items || input.items.length < 2) {
      throw new Error('A bundle must contain at least 2 products');
    }

    // Create the bundle
    const { data: bundle, error } = await supabaseAdmin
      .from('bundles')
      .insert({
        business_id: businessId,
        name: input.name,
        name_ar: input.name_ar || null,
        description: input.description || null,
        description_ar: input.description_ar || null,
        sku: input.sku || null,
        price: input.price,
        compare_at_price: input.compare_at_price || null,
        image_url: input.image_url || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create bundle: ${error.message}`);
    }

    // Add bundle items
    const bundleItems = input.items.map(item => ({
      bundle_id: bundle.id,
      product_id: item.product_id,
      quantity: item.quantity
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('bundle_items')
      .insert(bundleItems);

    if (itemsError) {
      // Rollback bundle creation
      await supabaseAdmin.from('bundles').delete().eq('id', bundle.id);
      throw new Error(`Failed to add bundle items: ${itemsError.message}`);
    }

    // Fetch and return the complete bundle
    return this.getBundle(bundle.id, businessId) as Promise<Bundle>;
  }

  /**
   * Update a bundle
   */
  async updateBundle(bundleId: number, businessId: number, input: UpdateBundleInput): Promise<Bundle> {
    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.name_ar !== undefined) updateData.name_ar = input.name_ar;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.description_ar !== undefined) updateData.description_ar = input.description_ar;
    if (input.sku !== undefined) updateData.sku = input.sku;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.compare_at_price !== undefined) updateData.compare_at_price = input.compare_at_price;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const { error } = await supabaseAdmin
      .from('bundles')
      .update(updateData)
      .eq('id', bundleId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to update bundle: ${error.message}`);
    }

    // Update items if provided
    if (input.items !== undefined) {
      if (input.items.length < 2) {
        throw new Error('A bundle must contain at least 2 products');
      }

      // Delete existing items
      await supabaseAdmin
        .from('bundle_items')
        .delete()
        .eq('bundle_id', bundleId);

      // Insert new items
      const bundleItems = input.items.map(item => ({
        bundle_id: bundleId,
        product_id: item.product_id,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('bundle_items')
        .insert(bundleItems);

      if (itemsError) {
        throw new Error(`Failed to update bundle items: ${itemsError.message}`);
      }
    }

    return this.getBundle(bundleId, businessId) as Promise<Bundle>;
  }

  /**
   * Delete a bundle
   */
  async deleteBundle(bundleId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('bundles')
      .delete()
      .eq('id', bundleId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to delete bundle: ${error.message}`);
    }
  }

  /**
   * Toggle bundle active status
   */
  async toggleBundleStatus(bundleId: number, businessId: number, isActive: boolean): Promise<Bundle> {
    const { error } = await supabaseAdmin
      .from('bundles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', bundleId)
      .eq('business_id', businessId);

    if (error) {
      throw new Error(`Failed to toggle bundle status: ${error.message}`);
    }

    return this.getBundle(bundleId, businessId) as Promise<Bundle>;
  }
}

export const bundlesService = new BundlesService();

