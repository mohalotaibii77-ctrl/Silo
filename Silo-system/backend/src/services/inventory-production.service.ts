/**
 * INVENTORY PRODUCTION SERVICE
 * Simplified production of composite items using templates
 */

import { supabaseAdmin } from '../config/database';
import { inventoryService } from './inventory.service';
import { inventoryStockService } from './inventory-stock.service';

// ==================== UNIT CONVERSION ====================

// Storage unit type
type StorageUnit = 'Kg' | 'kg' | 'L' | 'liter' | 'grams' | 'mL' | 'piece' | 'carton';

// Conversion factors to base unit (grams for weight, mL for volume, 1 for piece)
const CONVERSION_TO_BASE: Record<string, number> = {
  'Kg': 1000,      // 1 Kg = 1000 grams
  'kg': 1000,      // 1 kg = 1000 grams (lowercase variant)
  'grams': 1,
  'gram': 1,
  'g': 1,
  'L': 1000,       // 1 L = 1000 mL
  'liter': 1000,
  'liters': 1000,
  'mL': 1,
  'ml': 1,
  'piece': 1,
  'pieces': 1,
  'carton': 1,     // Carton is treated as is (no conversion)
  'unit': 1,
  'units': 1,
};

// Get base unit for a storage unit
const getBaseUnit = (storageUnit: string): string => {
  const lower = storageUnit.toLowerCase();
  if (['kg', 'grams', 'gram', 'g'].includes(lower)) return 'grams';
  if (['l', 'liter', 'liters', 'ml'].includes(lower)) return 'mL';
  return storageUnit; // For piece, carton, etc.
};

// Convert from storage unit to base unit
const convertToBase = (quantity: number, unit: string): number => {
  const factor = CONVERSION_TO_BASE[unit] || CONVERSION_TO_BASE[unit.toLowerCase()] || 1;
  return quantity * factor;
};

// Convert from base unit to storage unit
const convertFromBase = (quantity: number, unit: string): number => {
  const factor = CONVERSION_TO_BASE[unit] || CONVERSION_TO_BASE[unit.toLowerCase()] || 1;
  return quantity / factor;
};

// ==================== TYPES ====================

export interface ProductionTemplate {
  id: number;
  business_id: number;
  composite_item_id: number;
  name: string;
  name_ar?: string | null;
  default_batch_count: number;
  status: 'active' | 'inactive';
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  composite_item?: any;
}

export interface Production {
  id: number;
  business_id: number;
  branch_id?: number | null;
  composite_item_id: number;
  template_id?: number | null;
  batch_count: number;
  total_yield: number;
  yield_unit: string;
  total_cost: number;
  cost_per_batch: number;
  status: 'completed' | 'failed';
  production_date: string;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  // Joined data
  composite_item?: any;
  consumed_items?: ProductionConsumedItem[];
  branch?: any;
  template?: ProductionTemplate;
}

export interface ProductionConsumedItem {
  id: number;
  production_id: number;
  item_id: number;
  quantity_consumed: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  // Joined data
  item?: any;
}

export interface InventoryAvailability {
  item_id: number;
  item_name: string;
  item_name_ar?: string;
  required_quantity: number;
  available_quantity: number;
  unit: string;
  is_sufficient: boolean;
  shortage: number;
}

export class InventoryProductionService {

  // ==================== TEMPLATES ====================

  /**
   * Get all production templates for a business
   */
  async getTemplates(businessId: number): Promise<ProductionTemplate[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('production_templates')
        .select(`
          *,
          items:composite_item_id (id, name, name_ar, unit, batch_quantity, batch_unit, sku)
        `)
        .eq('business_id', businessId)
        .eq('status', 'active')
        .order('name');

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('production_templates table does not exist yet');
          return [];
        }
        console.error('Failed to fetch templates:', error);
        return [];
      }

      return (data || []).map((t: any) => ({
        ...t,
        composite_item: t.items,
        items: undefined,
      })) as ProductionTemplate[];
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      return [];
    }
  }

  /**
   * Get a single template
   */
  async getTemplate(templateId: number, businessId: number): Promise<ProductionTemplate | null> {
    const { data, error } = await supabaseAdmin
      .from('production_templates')
      .select(`
        *,
        items:composite_item_id (id, name, name_ar, unit, batch_quantity, batch_unit, sku)
      `)
      .eq('id', templateId)
      .eq('business_id', businessId)
      .single();

    if (error || !data) return null;

    return {
      ...data,
      composite_item: data.items,
      items: undefined,
    } as ProductionTemplate;
  }

  /**
   * Create a new production template
   */
  async createTemplate(data: {
    business_id: number;
    composite_item_id: number;
    name: string;
    name_ar?: string;
    default_batch_count?: number;
    created_by?: number;
  }): Promise<ProductionTemplate> {
    // Verify composite item exists
    const compositeItem = await inventoryService.getCompositeItem(data.composite_item_id, data.business_id);
    if (!compositeItem) {
      throw new Error('Composite item not found');
    }

    const { data: template, error } = await supabaseAdmin
      .from('production_templates')
      .insert({
        business_id: data.business_id,
        composite_item_id: data.composite_item_id,
        name: data.name,
        name_ar: data.name_ar || null,
        default_batch_count: data.default_batch_count || 1,
        status: 'active',
        created_by: data.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create template:', error);
      throw new Error('Failed to create template');
    }

    return this.getTemplate(template.id, data.business_id) as Promise<ProductionTemplate>;
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: number,
    businessId: number,
    updates: Partial<{
      composite_item_id: number;
      name: string;
      name_ar: string;
      default_batch_count: number;
    }>
  ): Promise<ProductionTemplate> {
    const { error } = await supabaseAdmin
      .from('production_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to update template:', error);
      throw new Error('Failed to update template');
    }

    return this.getTemplate(templateId, businessId) as Promise<ProductionTemplate>;
  }

  /**
   * Delete a template (soft delete)
   */
  async deleteTemplate(templateId: number, businessId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('production_templates')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', templateId)
      .eq('business_id', businessId);

    if (error) {
      console.error('Failed to delete template:', error);
      throw new Error('Failed to delete template');
    }
  }

  // ==================== PRODUCTION ====================

  /**
   * Check if inventory has sufficient items to produce
   * 
   * IMPORTANT: Recipe components store quantities in base units (grams, mL, piece)
   * but inventory can be stored in storage units (Kg, L, etc.)
   * This function converts everything to base units for comparison.
   */
  async checkInventoryAvailability(
    businessId: number,
    compositeItemId: number,
    batchCount: number,
    branchId?: number
  ): Promise<{ canProduce: boolean; availability: InventoryAvailability[] }> {
    // Get composite item with components
    const compositeItem = await inventoryService.getCompositeItem(compositeItemId, businessId);
    if (!compositeItem) {
      throw new Error('Composite item not found');
    }

    if (!compositeItem.components || compositeItem.components.length === 0) {
      throw new Error('Composite item has no components defined');
    }

    const availability: InventoryAvailability[] = [];
    let canProduce = true;

    for (const component of compositeItem.components) {
      // Get current stock for this component
      const stockResult = await inventoryStockService.getStockLevels(businessId, {
        itemId: component.component_item_id,
        branchId,
      });

      // Handle both array and paginated result formats
      const stocks = Array.isArray(stockResult) ? stockResult : stockResult.data;
      const stock = stocks[0];
      
      // Get the component item's storage unit (how inventory is tracked)
      // This could be Kg, L, or base units like grams, mL
      const storageUnit = component.component_item?.storage_unit || 
                          component.component_item?.batch_unit || 
                          component.component_item?.unit || 
                          'grams';
      
      // The base/serving unit (grams, mL, piece)
      const servingUnit = component.component_item?.unit || 'grams';
      
      // Inventory quantity is in storage units (e.g., 100 Kg)
      const stockQuantityInStorageUnits = stock?.quantity || 0;
      
      // Convert inventory from storage units to base units (e.g., 100 Kg → 100,000 grams)
      const availableInBaseUnits = convertToBase(stockQuantityInStorageUnits, storageUnit);
      
      // Recipe component quantity is in base/serving units (e.g., 100 grams)
      const requiredInBaseUnits = component.quantity * batchCount;
      
      const isSufficient = availableInBaseUnits >= requiredInBaseUnits;
      const shortageInBaseUnits = isSufficient ? 0 : requiredInBaseUnits - availableInBaseUnits;

      if (!isSufficient) {
        canProduce = false;
      }

      // Display in base units (grams, mL, piece) for clarity
      const baseUnit = getBaseUnit(storageUnit);
      
      availability.push({
        item_id: component.component_item_id,
        item_name: component.component_item?.name || `Item ${component.component_item_id}`,
        item_name_ar: component.component_item?.name_ar || undefined,
        required_quantity: requiredInBaseUnits,
        available_quantity: availableInBaseUnits,
        unit: baseUnit,
        is_sufficient: isSufficient,
        shortage: shortageInBaseUnits,
      });
    }

    return { canProduce, availability };
  }

  /**
   * Execute production - consumes raw items and adds composite item to inventory
   */
  async createProduction(data: {
    business_id: number;
    branch_id?: number;
    composite_item_id: number;
    batch_count: number;
    template_id?: number;
    notes?: string;
    created_by?: number;
  }): Promise<Production> {
    const { business_id, branch_id, composite_item_id, batch_count, template_id, notes, created_by } = data;

    // Get composite item details
    const compositeItem = await inventoryService.getCompositeItem(composite_item_id, business_id);
    if (!compositeItem) {
      throw new Error('Composite item not found');
    }

    // Check inventory availability
    const { canProduce, availability } = await this.checkInventoryAvailability(
      business_id,
      composite_item_id,
      batch_count,
      branch_id
    );

    if (!canProduce) {
      const shortages = availability.filter(a => !a.is_sufficient);
      const shortageMsg = shortages.map(s => 
        `${s.item_name}: need ${s.required_quantity}, have ${s.available_quantity}`
      ).join('; ');
      throw new Error(`Insufficient inventory: ${shortageMsg}`);
    }

    // Calculate yield and cost
    const batchQuantity = compositeItem.batch_quantity || 1;
    const batchUnit = compositeItem.batch_unit || compositeItem.unit;
    const totalYield = batchQuantity * batch_count;

    let totalCost = 0;
    const consumedItems: { 
      item_id: number; 
      quantity_serving: number;  // Quantity in serving units (for records)
      quantity_storage: number;  // Quantity in storage units (for deducting from inventory)
      serving_unit: string; 
      storage_unit: string;
      unit_cost: number; 
      total_cost: number;
    }[] = [];

    for (const component of compositeItem.components || []) {
      // Recipe component quantity is in serving units (grams, mL, piece)
      const quantityInServingUnits = component.quantity * batch_count;
      
      // Get the component item's units
      const servingUnit = component.component_item?.unit || 'grams';
      const storageUnit = component.component_item?.storage_unit || 
                          component.component_item?.batch_unit || 
                          servingUnit;
      
      // Convert serving units to storage units for inventory deduction
      // e.g., 100 grams → 0.1 Kg
      const quantityInBaseUnits = convertToBase(quantityInServingUnits, servingUnit);
      const quantityInStorageUnits = convertFromBase(quantityInBaseUnits, storageUnit);
      
      // Cost is per serving unit
      const unitCost = component.component_item?.cost_per_unit || 0;
      const itemTotalCost = quantityInServingUnits * unitCost;
      totalCost += itemTotalCost;

      consumedItems.push({
        item_id: component.component_item_id,
        quantity_serving: quantityInServingUnits,
        quantity_storage: quantityInStorageUnits,
        serving_unit: servingUnit,
        storage_unit: storageUnit,
        unit_cost: unitCost,
        total_cost: itemTotalCost,
      });
    }

    const costPerBatch = totalCost / batch_count;

    // Create production record
    const { data: production, error } = await supabaseAdmin
      .from('composite_item_productions')
      .insert({
        business_id,
        branch_id: branch_id || null,
        composite_item_id,
        template_id: template_id || null,
        batch_count,
        total_yield: totalYield,
        yield_unit: batchUnit,
        total_cost: totalCost,
        cost_per_batch: costPerBatch,
        status: 'completed',
        production_date: new Date().toISOString().split('T')[0],
        notes: notes || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create production:', error);
      throw new Error('Failed to create production record');
    }

    // Record consumed items (store in serving units for consistency with recipe)
    const consumedItemsToInsert = consumedItems.map(item => ({
      production_id: production.id,
      item_id: item.item_id,
      quantity_consumed: item.quantity_serving,
      unit: item.serving_unit,
      unit_cost: item.unit_cost,
      total_cost: item.total_cost,
    }));

    await supabaseAdmin.from('production_consumed_items').insert(consumedItemsToInsert);

    // Deduct raw items from inventory (use storage units since inventory is in storage units)
    for (const consumed of consumedItems) {
      await inventoryStockService.updateStock(
        business_id,
        consumed.item_id,
        -consumed.quantity_storage,  // Deduct in storage units (e.g., 0.1 Kg, not 100 grams)
        'production_consume',
        {
          branchId: branch_id,
          referenceType: 'production',
          referenceId: production.id,
          unitCost: consumed.unit_cost,
          userId: created_by,
          notes: `Consumed ${consumed.quantity_serving} ${consumed.serving_unit} for production of ${compositeItem.name}`,
        }
      );
    }

    // Add produced composite item to inventory
    await inventoryStockService.updateStock(
      business_id,
      composite_item_id,
      totalYield,
      'production_output',
      {
        branchId: branch_id,
        referenceType: 'production',
        referenceId: production.id,
        unitCost: costPerBatch / batchQuantity,
        userId: created_by,
        notes: `Produced ${batch_count} batch(es)`,
      }
    );

    return this.getProduction(production.id, business_id) as Promise<Production>;
  }

  /**
   * Get a single production with details
   */
  async getProduction(productionId: number, businessId: number): Promise<Production | null> {
    const { data: production, error } = await supabaseAdmin
      .from('composite_item_productions')
      .select(`
        *,
        items:composite_item_id (id, name, name_ar, unit, batch_quantity, batch_unit, sku),
        branches:branch_id (id, name, name_ar),
        templates:template_id (id, name, name_ar)
      `)
      .eq('id', productionId)
      .eq('business_id', businessId)
      .single();

    if (error || !production) return null;

    // Get consumed items
    const { data: consumedItems } = await supabaseAdmin
      .from('production_consumed_items')
      .select(`
        *,
        items:item_id (id, name, name_ar, unit, sku)
      `)
      .eq('production_id', productionId);

    return {
      ...production,
      composite_item: production.items,
      branch: production.branches,
      template: production.templates,
      consumed_items: (consumedItems || []).map((c: any) => ({
        ...c,
        item: c.items,
        items: undefined,
      })),
      items: undefined,
      branches: undefined,
      templates: undefined,
    } as Production;
  }

  /**
   * Get production history
   */
  async getProductions(businessId: number, filters?: {
    branchId?: number;
    compositeItemId?: number;
    templateId?: number;
    limit?: number;
  }): Promise<Production[]> {
    try {
      let query = supabaseAdmin
        .from('composite_item_productions')
        .select(`
          *,
          items:composite_item_id (id, name, name_ar, unit, batch_quantity, batch_unit, sku),
          branches:branch_id (id, name, name_ar),
          templates:template_id (id, name, name_ar)
        `)
        .eq('business_id', businessId);

      if (filters?.branchId) query = query.eq('branch_id', filters.branchId);
      if (filters?.compositeItemId) query = query.eq('composite_item_id', filters.compositeItemId);
      if (filters?.templateId) query = query.eq('template_id', filters.templateId);

      query = query.order('created_at', { ascending: false });
      if (filters?.limit) query = query.limit(filters.limit);

      const { data, error } = await query;

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.log('composite_item_productions table does not exist yet');
          return [];
        }
        console.error('Failed to fetch productions:', error);
        return [];
      }

      return (data || []).map((p: any) => ({
        ...p,
        composite_item: p.items,
        branch: p.branches,
        template: p.templates,
        items: undefined,
        branches: undefined,
        templates: undefined,
      })) as Production[];
    } catch (err) {
      console.error('Failed to fetch productions:', err);
      return [];
    }
  }

  /**
   * Get production statistics
   */
  async getProductionStats(businessId: number, branchId?: number): Promise<{
    today_count: number;
    week_count: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Today's count
      let todayQuery = supabaseAdmin
        .from('composite_item_productions')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .eq('production_date', today);
      if (branchId) todayQuery = todayQuery.eq('branch_id', branchId);
      const { count: todayCount, error: todayError } = await todayQuery;

      if (todayError) {
        // Table might not exist yet
        if (todayError.code === '42P01' || todayError.message?.includes('does not exist')) {
          return { today_count: 0, week_count: 0 };
        }
      }

      // Week count
      let weekQuery = supabaseAdmin
        .from('composite_item_productions')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .gte('production_date', weekAgo);
      if (branchId) weekQuery = weekQuery.eq('branch_id', branchId);
      const { count: weekCount } = await weekQuery;

      return {
        today_count: todayCount || 0,
        week_count: weekCount || 0,
      };
    } catch (err) {
      console.error('Failed to get production stats:', err);
      return { today_count: 0, week_count: 0 };
    }
  }
}

export const inventoryProductionService = new InventoryProductionService();
