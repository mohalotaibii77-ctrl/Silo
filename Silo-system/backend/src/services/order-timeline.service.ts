/**
 * ORDER TIMELINE SERVICE
 * Tracks all order events for audit trail
 */

import { supabaseAdmin } from '../config/database';

// Timeline event types
export type TimelineEventType =
  | 'created'              // Order created
  | 'item_added'           // Product added to order
  | 'item_removed'         // Product removed from order
  | 'item_modified'        // Product quantity/variant/modifiers changed
  | 'status_changed'       // Order status changed
  | 'payment_received'     // Payment received
  | 'payment_updated'      // Payment status changed (e.g., additional payment needed after edit)
  | 'refund_issued'        // Refund issued (partial or full)
  | 'extra_payment_collected' // Extra payment collected after order edit
  | 'cancelled'            // Order cancelled
  | 'completed'            // Order completed (food ready)
  | 'picked_up'            // Delivery order picked up by driver
  | 'ingredient_wasted'    // Ingredient marked as waste
  | 'ingredient_returned'; // Ingredient returned to inventory

// Categorized timeline types for tabbed UI display
export type TimelineCategory = 'order_status' | 'payment_status';

export type SimplifiedEventType =
  | 'created'
  | 'edited'
  | 'canceled'
  | 'completed'
  | 'picked_up'
  | 'paid'
  | 'additional_payment'
  | 'partial_refund'
  | 'full_refund';

export interface CategorizedTimelineEvent {
  id: number;
  order_id: number;
  original_event_type: TimelineEventType;
  display_type: SimplifiedEventType;
  category: TimelineCategory;
  description: string;
  done_by: string | null;
  created_at: string;
  event_data: Record<string, any>;
}

export interface CategorizedTimeline {
  order_status: CategorizedTimelineEvent[];
  payment_status: CategorizedTimelineEvent[];
}

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
   * Log refund issued event
   */
  async logRefundIssued(
    orderId: number,
    refundData: {
      amount: number;
      currency: string;
      reason: string;
      is_partial: boolean;
      refund_reference?: string;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'refund_issued',
      event_data: refundData,
      created_by: userId,
    });
  }

  /**
   * Log extra payment collected event (after order edit increases total)
   */
  async logExtraPaymentCollected(
    orderId: number,
    paymentData: {
      amount: number;
      currency: string;
      payment_method: string;
      payment_reference?: string;
    },
    userId?: number
  ): Promise<TimelineEvent> {
    return this.logEvent({
      order_id: orderId,
      event_type: 'extra_payment_collected',
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

  /**
   * Get categorized timeline for tabbed UI display
   * Organizes events into Order Status and Payment Status tabs
   */
  async getCategorizedTimeline(orderId: number): Promise<CategorizedTimeline> {
    const rawEvents = await this.getTimeline(orderId);

    const categorized: CategorizedTimeline = {
      order_status: [],
      payment_status: [],
    };

    for (const event of rawEvents) {
      const mapped = this.mapToCategory(event);
      if (mapped) {
        categorized[mapped.category].push(mapped);
      }
    }

    return categorized;
  }

  /**
   * Map a raw timeline event to a categorized event
   * Returns null for events that should be hidden (e.g., ingredient_wasted, ingredient_returned)
   */
  private mapToCategory(event: TimelineEvent): CategorizedTimelineEvent | null {
    const eventData = event.event_data || {};
    const doneBy = this.formatDoneBy(event);

    // Order Status events
    switch (event.event_type) {
      case 'created':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'created',
          category: 'order_status',
          description: `Order created - ${(eventData.order_type || 'unknown').replace(/_/g, ' ')} (${eventData.items_count || 0} products)`,
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'item_added':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'edited',
          category: 'order_status',
          description: `Edited: Product added - ${eventData.product_name || 'Unknown'}`,
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'item_removed':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'edited',
          category: 'order_status',
          description: `Edited: Product removed - ${eventData.product_name || 'Unknown'}`,
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'item_modified':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'edited',
          category: 'order_status',
          description: `Edited: Product modified - ${eventData.product_name || 'Unknown'}`,
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'status_changed': {
        const toStatus = eventData.to_status || eventData.new_status;
        // Only show specific status transitions
        if (toStatus === 'cancelled') {
          return {
            id: event.id,
            order_id: event.order_id,
            original_event_type: event.event_type,
            display_type: 'canceled',
            category: 'order_status',
            description: 'Order canceled',
            done_by: doneBy,
            created_at: event.created_at,
            event_data: eventData,
          };
        }
        if (toStatus === 'completed') {
          return {
            id: event.id,
            order_id: event.order_id,
            original_event_type: event.event_type,
            display_type: 'completed',
            category: 'order_status',
            description: 'Order completed',
            done_by: doneBy,
            created_at: event.created_at,
            event_data: eventData,
          };
        }
        if (toStatus === 'picked_up') {
          return {
            id: event.id,
            order_id: event.order_id,
            original_event_type: event.event_type,
            display_type: 'picked_up',
            category: 'order_status',
            description: 'Order picked up',
            done_by: doneBy,
            created_at: event.created_at,
            event_data: eventData,
          };
        }
        // Hide other status transitions
        return null;
      }

      case 'cancelled':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'canceled',
          category: 'order_status',
          description: eventData.reason ? `Order canceled: ${eventData.reason}` : 'Order canceled',
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'completed':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'completed',
          category: 'order_status',
          description: 'Order completed',
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'picked_up':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'picked_up',
          category: 'order_status',
          description: 'Order picked up',
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      // Payment Status events
      case 'payment_received':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'paid',
          category: 'payment_status',
          description: `Payment received via ${eventData.payment_method || 'unknown'}`,
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'payment_updated':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'paid',
          category: 'payment_status',
          description: `Payment updated: ${eventData.reason || 'status changed'}`,
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'extra_payment_collected':
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: 'additional_payment',
          category: 'payment_status',
          description: `Additional payment collected via ${eventData.payment_method || 'unknown'}`,
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };

      case 'refund_issued': {
        const isPartial = eventData.is_partial;
        return {
          id: event.id,
          order_id: event.order_id,
          original_event_type: event.event_type,
          display_type: isPartial ? 'partial_refund' : 'full_refund',
          category: 'payment_status',
          description: isPartial
            ? `Partial refund: ${eventData.amount || 0} ${eventData.currency || ''}`
            : `Full refund: ${eventData.amount || 0} ${eventData.currency || ''}`,
          done_by: doneBy,
          created_at: event.created_at,
          event_data: eventData,
        };
      }

      // Hidden events (tracked in inventory timeline)
      case 'ingredient_wasted':
      case 'ingredient_returned':
        return null;

      default:
        return null;
    }
  }

  /**
   * Format user name for display
   */
  private formatDoneBy(event: TimelineEvent): string | null {
    if (!event.user) return null;
    const user = event.user;
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) return user.first_name;
    if (user.username) return user.username;
    return null;
  }
}

export const orderTimelineService = new OrderTimelineService();


