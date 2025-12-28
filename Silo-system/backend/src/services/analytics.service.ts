/**
 * ANALYTICS SERVICE
 * Dashboard analytics and reporting for business owners
 */

import { supabaseAdmin } from '../config/database';

export type TimePeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export interface DashboardStats {
  ordersToday: number;
  activeOrders: number;
  completedToday: number;
  totalRevenue: number;
  lowStockItems: number;
  currency: string;
}

export interface LowStockItem {
  id: number;
  name: string;
  current_stock: number;
  min_stock_level: number;
  unit: string;
}

export class AnalyticsService {
  
  /**
   * Get date range based on period
   */
  private getDateRange(period: TimePeriod): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    let start = new Date(now);
    start.setHours(0, 0, 0, 0);
    
    switch (period) {
      case 'today':
        // Already set to today
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
        start = new Date('2020-01-01'); // Far back date
        break;
    }
    
    return { start, end };
  }

  /**
   * Get dashboard stats for a single business
   */
  async getDashboardStats(businessId: number, period: TimePeriod = 'today'): Promise<DashboardStats> {
    const { start, end } = this.getDateRange(period);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // Get business currency - NO FALLBACK
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('currency')
      .eq('id', businessId)
      .single();
    
    if (!business || !business.currency) {
      throw new Error('Business currency not configured');
    }
    
    const currency = business.currency;

    // Orders created in period
    const { count: ordersInPeriod } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Active orders (pending, preparing, ready)
    const { count: activeOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .in('status', ['pending', 'preparing', 'ready']);

    // Completed orders in period
    const { count: completedInPeriod } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Total revenue in period (from completed orders)
    const { data: revenueData } = await supabaseAdmin
      .from('orders')
      .select('total_amount')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0) || 0;

    // Low stock items (where current_stock <= min_stock_level)
    const { count: lowStockItems } = await supabaseAdmin
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .not('min_stock_level', 'is', null)
      .filter('current_stock', 'lte', 'min_stock_level');

    // Alternative approach for low stock if the filter doesn't work
    const { data: itemsForStock } = await supabaseAdmin
      .from('items')
      .select('id, current_stock, min_stock_level')
      .eq('business_id', businessId)
      .not('min_stock_level', 'is', null);
    
    const lowStockCount = itemsForStock?.filter(item => 
      item.current_stock !== null && 
      item.min_stock_level !== null && 
      item.current_stock <= item.min_stock_level
    ).length || 0;

    return {
      ordersToday: ordersInPeriod || 0,
      activeOrders: activeOrders || 0,
      completedToday: completedInPeriod || 0,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      lowStockItems: lowStockCount,
      currency,
    };
  }

  /**
   * Get combined dashboard stats for multiple businesses (owner view)
   */
  async getCombinedDashboardStats(businessIds: number[], period: TimePeriod = 'today'): Promise<DashboardStats> {
    if (businessIds.length === 0) {
      throw new Error('No businesses provided for combined stats');
    }

    const { start, end } = this.getDateRange(period);

    // Get first business currency - NO FALLBACK
    const { data: business } = await supabaseAdmin
      .from('businesses')
      .select('currency')
      .eq('id', businessIds[0])
      .single();
    
    if (!business || !business.currency) {
      throw new Error('Business currency not configured');
    }
    
    const currency = business.currency;

    // Orders in period across all businesses
    const { count: ordersInPeriod } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('business_id', businessIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Active orders across all businesses
    const { count: activeOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('business_id', businessIds)
      .in('status', ['pending', 'preparing', 'ready']);

    // Completed orders in period
    const { count: completedInPeriod } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('business_id', businessIds)
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Total revenue
    const { data: revenueData } = await supabaseAdmin
      .from('orders')
      .select('total_amount')
      .in('business_id', businessIds)
      .eq('status', 'completed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const totalRevenue = revenueData?.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0) || 0;

    // Low stock items across all businesses
    const { data: itemsForStock } = await supabaseAdmin
      .from('items')
      .select('id, current_stock, min_stock_level')
      .in('business_id', businessIds)
      .not('min_stock_level', 'is', null);
    
    const lowStockCount = itemsForStock?.filter(item => 
      item.current_stock !== null && 
      item.min_stock_level !== null && 
      item.current_stock <= item.min_stock_level
    ).length || 0;

    return {
      ordersToday: ordersInPeriod || 0,
      activeOrders: activeOrders || 0,
      completedToday: completedInPeriod || 0,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      lowStockItems: lowStockCount,
      currency,
    };
  }

  /**
   * Get low stock items list
   */
  async getLowStockItems(businessId: number, limit: number = 10): Promise<LowStockItem[]> {
    const { data: items } = await supabaseAdmin
      .from('items')
      .select('id, name, current_stock, min_stock_level, unit')
      .eq('business_id', businessId)
      .not('min_stock_level', 'is', null)
      .order('current_stock', { ascending: true })
      .limit(limit);

    return (items || []).filter(item => 
      item.current_stock !== null && 
      item.min_stock_level !== null && 
      item.current_stock <= item.min_stock_level
    );
  }
}

export const analyticsService = new AnalyticsService();





