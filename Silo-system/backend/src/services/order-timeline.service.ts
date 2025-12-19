/**
 * ORDER TIMELINE SERVICE
 * Tracks all order events for audit trail
 */

import { supabaseAdmin } from '../config/database';

// Timeline event types
export type TimelineEventType =
  | 'created'              // Order created
  | 'item_added'           // Item added to order
  | 'item_removed'         // Item removed from order
  | 'item_modified'        // Item quantity/variant/modifiers changed
  | 'status_changed'       // Order status changed
  | 'payment_received'     // Payment received
  | 'payment_updated'      // Payment status changed (e.g., additional payment needed after edit)
  | 'cancelled'            // Order cancelled
  | 'completed'            // Order completed (food ready)
  | 'picked_up'            // Delivery order picked up by driver
  | 'ingredient_wasted'    // Ingredient marked as waste
  | 'ingredient_returned'; // Ingredient returned to inventory

export interface TimelineEvent {
  id: number;
  order_id: number;
  event_type: TimelineEventType;
  event_data: Record<string, any>;
  created_by?: number;
  created_at: string;
  // Joined data
  user?: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface CreateTimelineEventInput {
  order_id: number;
  event_type: TimelineEventType;
  event_data?: Record<string, any>;
  created_by?: number;
}

export class OrderTimelineService {

  /**
   * Log a timeline event
   */
  async logEvent(input: CreateTimelineEventInput): Promise<TimelineEvent> {
    const { data, error } = await supabaseAdmin
      .from('order_timeline')
      .insert({
        order_id: input.order_id,
        event_type: input.event_type,
        event_data: input.event_data || {},
        created_by: input.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to log timeline event:', error);
      throw new Error('Failed to log timeline event');
    }

    return data as TimelineEvent;
  }

  /**
   * Log order created event
   */
  async logOrderCreated(
    orderId: number,
    orderData: {
      order_number: string;
      order_source: string;
      order_type: string;
      items_count: number;
      total_amount: number;
      customer_name?: string;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'created',
      event_data: {
        order_number: orderData.order_number,
        order_source: orderData.order_source,
        order_type: orderData.order_type,
        items_count: orderData.items_count,
        total_amount: orderData.total_amount,
        customer_name: orderData.customer_name,
      },
      created_by: userId,
    });
  }

  /**
   * Log item added event
   */
  async logItemAdded(
    orderId: number,
    itemData: {
      product_id: number;
      product_name: string;
      quantity: number;
      unit_price: number;
      variant_id?: number;
      variant_name?: string;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'item_added',
      event_data: itemData,
      created_by: userId,
    });
  }

  /**
   * Log item removed event
   */
  async logItemRemoved(
    orderId: number,
    itemData: {
      product_id: number;
      product_name: string;
      quantity: number;
      reason?: string;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'item_removed',
      event_data: itemData,
      created_by: userId,
    });
  }

  /**
   * Log item modified event
   */
  async logItemModified(
    orderId: number,
    itemData: {
      product_id: number;
      product_name: string;
      changes: {
        field: string;
        from: any;
        to: any;
      }[];
      price_difference?: number;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'item_modified',
      event_data: itemData,
      created_by: userId,
    });
  }

  /**
   * Log status changed event
   */
  async logStatusChanged(
    orderId: number,
    fromStatus: string | undefined,
    toStatus: string,
    reason?: string,
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'status_changed',
      event_data: {
        from_status: fromStatus,
        to_status: toStatus,
        reason,
      },
      created_by: userId,
    });
  }

  /**
   * Log payment received event
   */
  async logPaymentReceived(
    orderId: number,
    paymentData: {
      amount: number;
      payment_method: string;
      payment_reference?: string;
      remaining_amount?: number;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'payment_received',
      event_data: paymentData,
      created_by: userId,
    });
  }

  /**
   * Log payment updated event (e.g., when order edit requires additional payment)
   */
  async logPaymentUpdated(
    orderId: number,
    paymentData: {
      previous_status: string;
      new_status: string;
      remaining_amount: number;
      reason: string;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'payment_updated',
      event_data: paymentData,
      created_by: userId,
    });
  }

  /**
   * Log order cancelled event
   */
  async logOrderCancelled(
    orderId: number,
    reason: string,
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'cancelled',
      event_data: { reason },
      created_by: userId,
    });
  }

  /**
   * Log order completed event
   */
  async logOrderCompleted(
    orderId: number,
    completionData?: {
      completed_by_kitchen?: boolean;
      items_completed?: number;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'completed',
      event_data: completionData || {},
      created_by: userId,
    });
  }

  /**
   * Log ingredient wasted event
   */
  async logIngredientWasted(
    orderId: number,
    ingredientData: {
      item_id: number;
      item_name: string;
      quantity: number;
      unit: string;
      reason?: string;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'ingredient_wasted',
      event_data: ingredientData,
      created_by: userId,
    });
  }

  /**
   * Log ingredient returned event
   */
  async logIngredientReturned(
    orderId: number,
    ingredientData: {
      item_id: number;
      item_name: string;
      quantity: number;
      unit: string;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'ingredient_returned',
      event_data: ingredientData,
      created_by: userId,
    });
  }

  /**
   * Get timeline for an order
   */
  async getTimeline(orderId: number): Promise<TimelineEvent[]> {
    const { data, error } = await supabaseAdmin
      .from('order_timeline')
      .select(`
        *,
        business_users (
          id,
          username,
          first_name,
          last_name
        )
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch order timeline:', error);
      throw new Error('Failed to fetch order timeline');
    }

    return (data || []).map((event: any) => ({
      ...event,
      user: event.business_users || null,
      business_users: undefined,
    })) as TimelineEvent[];
  }

  /**
   * Get timeline events by type for an order
   */
  async getTimelineByType(orderId: number, eventType: TimelineEventType): Promise<TimelineEvent[]> {
    const { data, error } = await supabaseAdmin
      .from('order_timeline')
      .select(`
        *,
        business_users (
          id,
          username,
          first_name,
          last_name
        )
      `)
      .eq('order_id', orderId)
      .eq('event_type', eventType)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch order timeline:', error);
      throw new Error('Failed to fetch order timeline');
    }

    return (data || []).map((event: any) => ({
      ...event,
      user: event.business_users || null,
      business_users: undefined,
    })) as TimelineEvent[];
  }
}

export const orderTimelineService = new OrderTimelineService();


