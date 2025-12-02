/**
 * PRODUCTS SERVICE
 * Products with variants (size, type) and modifiers (removable items)
 */

import { supabaseAdmin } from '../config/database';

export interface ProductVariantOption {
  id?: string;
  name: string;
  name_ar?: string;
  price_adjustment: number; // +5 for Large, 0 for Regular
}

export interface ProductVariantGroup {
  id?: string;
  name: string; // "Size", "Type"
  name_ar?: string;
  required: boolean;
  options: ProductVariantOption[];
}

export interface ProductModifier {
  id?: string;
  name: string; // "Tomato", "Onion"
  name_ar?: string;
  removable: boolean; // Can be removed
  addable: boolean; // Can be added extra
  extra_price: number; // Price if added extra
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  name_ar?: string;
  sku?: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  base_price: number;
  image_url?: string;
  available: boolean;
  variant_groups: ProductVariantGroup[];
  modifiers: ProductModifier[];
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  business_id: string;
  name: string;
  name_ar?: string;
  description?: string;
  category_id?: string;
  base_price: number;
  image_url?: string;
  variant_groups?: ProductVariantGroup[];
  modifiers?: ProductModifier[];
}

export class ProductsService {
  
  /**
   * Generate unique SKU for a new POS product
   */
  private async generateProductSku(businessId: string): Promise<string> {
    // Get count of products for this business
    const { count } = await supabaseAdmin
      .from('pos_products')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    const sequence = String((count || 0) + 1).padStart(4, '0');
    return `${businessId}-POS-${sequence}`;
  }

  /**
   * Get all products for a business (for POS)
   */
  async getProducts(businessId: string): Promise<Product[]> {
    const { data: products, error } = await supabaseAdmin
      .from('pos_products')
      .select(`
        *,
        pos_product_variant_groups (
          id, name, name_ar, required, sort_order,
          pos_product_variant_options (
            id, name, name_ar, price_adjustment, sort_order
          )
        ),
        pos_product_modifiers (
          id, name, name_ar, removable, addable, extra_price, sort_order
        ),
        pos_categories (
          id, name, name_ar
        )
      `)
      .eq('business_id', businessId)
      .eq('status', 'active')
      .order('name');

    if (error) {
      console.error('Failed to fetch products:', error);
      throw new Error('Failed to fetch products');
    }

    return (products || []).map(p => this.formatProduct(p));
  }

  /**
   * Get single product with all details
   */
  async getProduct(productId: string, businessId: string): Promise<Product | null> {
    const { data: product, error } = await supabaseAdmin
      .from('pos_products')
      .select(`
        *,
        pos_product_variant_groups (
          id, name, name_ar, required, sort_order,
          pos_product_variant_options (
            id, name, name_ar, price_adjustment, sort_order
          )
        ),
        pos_product_modifiers (
          id, name, name_ar, removable, addable, extra_price, sort_order
        ),
        pos_categories (
          id, name, name_ar
        )
      `)
      .eq('id', productId)
      .eq('business_id', businessId)
      .single();

    if (error || !product) return null;
    return this.formatProduct(product);
  }

  /**
   * Create a new product
   */
  async createProduct(data: CreateProductInput): Promise<Product> {
    // Generate unique SKU for this POS product
    const sku = await this.generateProductSku(data.business_id);
    
    // Insert product
    const { data: product, error } = await supabaseAdmin
      .from('pos_products')
      .insert({
        business_id: data.business_id,
        name: data.name,
        name_ar: data.name_ar || null,
        description: data.description || null,
        category_id: data.category_id || null,
        base_price: data.base_price,
        image_url: data.image_url || null,
        sku: sku,
        status: 'active',
      })
      .select()
      .single();

    if (error || !product) {
      console.error('Failed to create product:', error);
      throw new Error('Failed to create product');
    }

    // Insert variant groups and options
    if (data.variant_groups && data.variant_groups.length > 0) {
      for (let i = 0; i < data.variant_groups.length; i++) {
        const group = data.variant_groups[i];
        const { data: variantGroup, error: groupError } = await supabaseAdmin
          .from('pos_product_variant_groups')
          .insert({
            product_id: product.id,
            name: group.name,
            name_ar: group.name_ar || null,
            required: group.required,
            sort_order: i,
          })
          .select()
          .single();

        if (!groupError && variantGroup && group.options) {
          const optionsToInsert = group.options.map((opt, idx) => ({
            variant_group_id: variantGroup.id,
            name: opt.name,
            name_ar: opt.name_ar || null,
            price_adjustment: opt.price_adjustment || 0,
            sort_order: idx,
          }));
          await supabaseAdmin.from('pos_product_variant_options').insert(optionsToInsert);
        }
      }
    }

    // Insert modifiers
    if (data.modifiers && data.modifiers.length > 0) {
      const modifiersToInsert = data.modifiers.map((mod, idx) => ({
        product_id: product.id,
        name: mod.name,
        name_ar: mod.name_ar || null,
        removable: mod.removable ?? true,
        addable: mod.addable ?? false,
        extra_price: mod.extra_price || 0,
        sort_order: idx,
      }));
      await supabaseAdmin.from('pos_product_modifiers').insert(modifiersToInsert);
    }

    return this.getProduct(product.id, data.business_id) as Promise<Product>;
  }

  /**
   * Update a product
   */
  async updateProduct(productId: string, businessId: string, data: Partial<CreateProductInput>): Promise<Product> {
    // Update product base info
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.name_ar !== undefined) updateData.name_ar = data.name_ar;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category_id !== undefined) updateData.category_id = data.category_id;
    if (data.base_price !== undefined) updateData.base_price = data.base_price;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;

    const { error } = await supabaseAdmin
      .from('pos_products')
      .update(updateData)
      .eq('id', productId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to update product:', error);
      throw new Error('Failed to update product');
    }

    // Update variant groups if provided
    if (data.variant_groups !== undefined) {
      // Delete existing variant groups (cascades to options)
      await supabaseAdmin
        .from('pos_product_variant_groups')
        .delete()
        .eq('product_id', productId);

      // Insert new variant groups
      for (let i = 0; i < data.variant_groups.length; i++) {
        const group = data.variant_groups[i];
        const { data: variantGroup, error: groupError } = await supabaseAdmin
          .from('pos_product_variant_groups')
          .insert({
            product_id: productId,
            name: group.name,
            name_ar: group.name_ar || null,
            required: group.required,
            sort_order: i,
          })
          .select()
          .single();

        if (!groupError && variantGroup && group.options) {
          const optionsToInsert = group.options.map((opt, idx) => ({
            variant_group_id: variantGroup.id,
            name: opt.name,
            name_ar: opt.name_ar || null,
            price_adjustment: opt.price_adjustment || 0,
            sort_order: idx,
          }));
          await supabaseAdmin.from('pos_product_variant_options').insert(optionsToInsert);
        }
      }
    }

    // Update modifiers if provided
    if (data.modifiers !== undefined) {
      // Delete existing modifiers
      await supabaseAdmin
        .from('pos_product_modifiers')
        .delete()
        .eq('product_id', productId);

      // Insert new modifiers
      if (data.modifiers.length > 0) {
        const modifiersToInsert = data.modifiers.map((mod, idx) => ({
          product_id: productId,
          name: mod.name,
          name_ar: mod.name_ar || null,
          removable: mod.removable ?? true,
          addable: mod.addable ?? false,
          extra_price: mod.extra_price || 0,
          sort_order: idx,
        }));
        await supabaseAdmin.from('pos_product_modifiers').insert(modifiersToInsert);
      }
    }

    return this.getProduct(productId, businessId) as Promise<Product>;
  }

  /**
   * Delete a product (soft delete)
   */
  async deleteProduct(productId: string, businessId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('pos_products')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to delete product:', error);
      throw new Error('Failed to delete product');
    }
  }

  /**
   * Toggle product availability
   */
  async toggleAvailability(productId: string, businessId: string, available: boolean): Promise<Product> {
    const { error } = await supabaseAdmin
      .from('pos_products')
      .update({ available, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to toggle availability:', error);
      throw new Error('Failed to toggle availability');
    }

    return this.getProduct(productId, businessId) as Promise<Product>;
  }

  /**
   * Get categories for a business
   */
  async getCategories(businessId: string): Promise<{ id: string; name: string; name_ar?: string }[]> {
    const { data, error } = await supabaseAdmin
      .from('pos_categories')
      .select('id, name, name_ar, sort_order')
      .eq('business_id', businessId)
      .order('sort_order');

    if (error) {
      console.error('Failed to fetch categories:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create a category
   */
  async createCategory(businessId: string, name: string, name_ar?: string): Promise<{ id: string; name: string; name_ar?: string }> {
    const { data, error } = await supabaseAdmin
      .from('pos_categories')
      .insert({ business_id: businessId, name, name_ar: name_ar || null })
      .select()
      .single();

    if (error) {
      console.error('Failed to create category:', error);
      throw new Error('Failed to create category');
    }

    return data;
  }

  /**
   * Format product from database to API response
   */
  private formatProduct(p: any): Product {
    return {
      id: p.id,
      business_id: p.business_id,
      name: p.name,
      name_ar: p.name_ar,
      sku: p.sku,
      description: p.description,
      category_id: p.category_id,
      category_name: p.pos_categories?.name,
      base_price: p.base_price,
      image_url: p.image_url,
      available: p.available ?? true,
      variant_groups: (p.pos_product_variant_groups || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((g: any) => ({
          id: g.id,
          name: g.name,
          name_ar: g.name_ar,
          required: g.required,
          options: (g.pos_product_variant_options || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((o: any) => ({
              id: o.id,
              name: o.name,
              name_ar: o.name_ar,
              price_adjustment: o.price_adjustment,
            })),
        })),
      modifiers: (p.pos_product_modifiers || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((m: any) => ({
          id: m.id,
          name: m.name,
          name_ar: m.name_ar,
          removable: m.removable,
          addable: m.addable,
          extra_price: m.extra_price,
        })),
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }
}

export const productsService = new ProductsService();

