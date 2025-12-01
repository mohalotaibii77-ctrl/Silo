/**
 * STORE PRODUCTS SERVICE
 * Products management for store-setup (simpler than POS products)
 */

import { supabaseAdmin } from '../config/database';
import { storageService } from './storage.service';

export interface StoreProduct {
  id: number;
  business_id: number;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  category?: string;
  category_id?: number;
  price: number;
  cost?: number;
  tax_rate: number;
  is_active: boolean;
  has_variants: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStoreProductInput {
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  sku?: string;
  category_id?: number;
  price: number;
  tax_rate?: number;
  has_variants?: boolean;
  image_url?: string;
}

export class StoreProductsService {
  
  /**
   * Get all products for a business (with variants, ingredients, and modifiers for POS)
   */
  async getProducts(businessId: number): Promise<any[]> {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        product_categories (
          id,
          name,
          name_ar
        ),
        product_variants (
          id,
          name,
          name_ar,
          price_adjustment,
          sort_order
        ),
        product_ingredients (
          id,
          variant_id,
          item_id,
          quantity,
          removable,
          items (
            id,
            name,
            name_ar,
            unit
          )
        )
      `)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch products:', error);
      throw new Error('Failed to fetch products');
    }

    // Fetch modifiers separately (table might be new)
    const productIds = (products || []).map(p => p.id);
    let modifiersMap: Map<number, any[]> = new Map();
    
    if (productIds.length > 0) {
      try {
        const { data: allModifiers } = await supabaseAdmin
          .from('product_modifiers')
          .select('*')
          .in('product_id', productIds)
          .order('sort_order');
        
        if (allModifiers) {
          allModifiers.forEach(mod => {
            if (!modifiersMap.has(mod.product_id)) {
              modifiersMap.set(mod.product_id, []);
            }
            modifiersMap.get(mod.product_id)!.push(mod);
          });
        }
      } catch (e) {
        console.log('product_modifiers not available yet');
      }
    }

    // Map products with all related data
    return (products || []).map(p => {
      // Format ingredients with item names
      const ingredients = (p.product_ingredients || [])
        .filter((ing: any) => !ing.variant_id)
        .map((ing: any) => ({
          id: ing.id,
          item_id: ing.item_id,
          item_name: ing.items?.name,
          item_name_ar: ing.items?.name_ar,
          quantity: ing.quantity,
          removable: ing.removable || false,
          unit: ing.items?.unit,
        }));

      // Format variants with their ingredients
      const variants = (p.product_variants || [])
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((v: any) => ({
          id: v.id,
          name: v.name,
          name_ar: v.name_ar,
          price_adjustment: v.price_adjustment || 0,
          ingredients: (p.product_ingredients || [])
            .filter((ing: any) => ing.variant_id === v.id)
            .map((ing: any) => ({
              id: ing.id,
              item_id: ing.item_id,
              item_name: ing.items?.name,
              item_name_ar: ing.items?.name_ar,
              quantity: ing.quantity,
              removable: ing.removable || false,
              unit: ing.items?.unit,
            })),
        }));

      // Get modifiers for this product
      const modifiers = modifiersMap.get(p.id) || [];

      return {
        ...p,
        category_name: p.product_categories?.name || null,
        category: p.product_categories?.name || null,
        variants: p.has_variants ? variants : undefined,
        ingredients: !p.has_variants ? ingredients : undefined,
        modifiers: modifiers.map((m: any) => ({
          id: m.id,
          item_id: m.item_id,
          name: m.name,
          name_ar: m.name_ar,
          extra_price: m.extra_price || 0,
          removable: m.removable || false,
          addable: m.addable ?? true,
        })),
        // Clean up raw relations
        product_categories: undefined,
        product_variants: undefined,
        product_ingredients: undefined,
      };
    });
  }

  /**
   * Get single product
   */
  async getProduct(productId: number, businessId: number): Promise<StoreProduct | null> {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('business_id', businessId)
      .single();

    if (error || !product) return null;
    return product;
  }

  /**
   * Create a new product
   */
  async createProduct(businessId: number, data: CreateStoreProductInput): Promise<StoreProduct> {
    // Handle base64 image upload if provided
    let finalImageUrl: string | null = null;
    if (data.image_url && data.image_url.startsWith('data:')) {
      try {
        const uploadResult = await storageService.uploadBase64(data.image_url, businessId, 'product' as any);
        finalImageUrl = uploadResult.url;
      } catch (err) {
        console.error('Failed to upload product image:', err);
        // Continue without image if upload fails
      }
    } else if (data.image_url) {
      finalImageUrl = data.image_url;
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert({
        business_id: businessId,
        name: data.name,
        name_ar: data.name_ar || null,
        description: data.description || null,
        description_ar: data.description_ar || null,
        sku: data.sku || null,
        category_id: data.category_id || null,
        price: data.price,
        tax_rate: data.tax_rate || 0,
        has_variants: data.has_variants || false,
        image_url: finalImageUrl,
        is_active: true,
      })
      .select()
      .single();

    if (error || !product) {
      console.error('Failed to create product:', error);
      throw new Error('Failed to create product');
    }

    return product;
  }

  /**
   * Update a product
   */
  async updateProduct(productId: number, businessId: number, data: Partial<CreateStoreProductInput> & { is_active?: boolean }): Promise<StoreProduct> {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.name_ar !== undefined) updateData.name_ar = data.name_ar;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.description_ar !== undefined) updateData.description_ar = data.description_ar;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.category_id !== undefined) updateData.category_id = data.category_id;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate;
    if (data.has_variants !== undefined) updateData.has_variants = data.has_variants;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    
    // Handle base64 image upload if provided
    if (data.image_url !== undefined) {
      if (data.image_url && data.image_url.startsWith('data:')) {
        try {
          const uploadResult = await storageService.uploadBase64(data.image_url, businessId, 'product' as any);
          updateData.image_url = uploadResult.url;
        } catch (err) {
          console.error('Failed to upload product image:', err);
          // Don't update image if upload fails
        }
      } else {
        updateData.image_url = data.image_url;
      }
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error || !product) {
      console.error('Failed to update product:', error);
      throw new Error('Failed to update product');
    }

    return product;
  }

  /**
   * Delete a product (soft delete)
   */
  async deleteProduct(productId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to delete product:', error);
      throw new Error('Failed to delete product');
    }
  }
}

export const storeProductsService = new StoreProductsService();

