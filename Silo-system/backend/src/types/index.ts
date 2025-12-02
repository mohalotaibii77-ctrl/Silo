// ============================================
// SILO RESTAURANT OPERATING SYSTEM - TYPES
// ============================================

// Base types
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// Business/Restaurant
export interface Business extends BaseEntity {
  name: string;
  slug: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  subscription_plan: 'free' | 'starter' | 'professional' | 'enterprise';
  is_active: boolean;
  owner_id: string;
}

// User
export interface User extends BaseEntity {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  business_id: string;
  is_active: boolean;
}

export type UserRole = 'owner' | 'manager' | 'employee' | 'pos' | 'super_admin';

// Item Categories (raw materials/ingredients)
export type ItemCategory = 
  | 'vegetable' | 'fruit' | 'meat' | 'poultry' | 'seafood' 
  | 'dairy' | 'grain' | 'bread' | 'sauce' | 'condiment' 
  | 'spice' | 'oil' | 'beverage' | 'sweetener' | 'other';

export type ItemUnit = 'grams' | 'mL' | 'piece';

// Items (Raw Materials / Ingredients)
export interface Item {
  id: number;
  business_id: number | null;
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  category: ItemCategory;
  unit: ItemUnit;
  cost_per_unit: number;
  is_system_item: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// Category
export interface Category extends BaseEntity {
  business_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
}

// =====================================================
// ORDER TYPES
// =====================================================

// Order sources - where the order originated
export type OrderSource = 
  | 'pos'           // Direct POS terminal order
  | 'talabat'       // Talabat delivery app
  | 'jahez'         // Jahez delivery app
  | 'hungerstation' // HungerStation
  | 'careem'        // Careem Now
  | 'toyou'         // ToYou
  | 'mrsool'        // Mrsool
  | 'deliveroo'     // Deliveroo
  | 'ubereats'      // Uber Eats
  | 'phone'         // Phone order
  | 'website'       // Restaurant website
  | 'mobile_app'    // Restaurant's own mobile app
  | 'walk_in'       // Walk-in customer
  | 'other';        // Other sources

// Order types
export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'drive_thru';

// Order status
export type OrderStatus = 
  | 'pending'           // Order received, not yet confirmed
  | 'confirmed'         // Order confirmed
  | 'preparing'         // Kitchen is preparing
  | 'ready'             // Ready for pickup/delivery
  | 'out_for_delivery'  // Driver has the order
  | 'completed'         // Order fulfilled
  | 'cancelled'         // Order cancelled
  | 'refunded'          // Order refunded
  | 'failed';           // Order failed

// Payment methods
export type PaymentMethod = 
  | 'cash'          // Cash
  | 'card'          // Card at POS
  | 'card_online'   // Online card payment
  | 'apple_pay'     // Apple Pay
  | 'stc_pay'       // STC Pay
  | 'mada'          // Mada card
  | 'visa'          // Visa
  | 'mastercard'    // Mastercard
  | 'wallet'        // Restaurant wallet/credits
  | 'app_payment'   // Paid via delivery app
  | 'bank_transfer' // Bank transfer
  | 'split'         // Split payment
  | 'other';        // Other

// Payment status
export type PaymentStatus = 
  | 'pending'        // Payment not yet received
  | 'paid'           // Fully paid
  | 'partial'        // Partially paid
  | 'refunded'       // Fully refunded
  | 'partial_refund' // Partially refunded
  | 'failed'         // Payment failed
  | 'cancelled';     // Payment cancelled

// Main Order interface
export interface Order {
  id: number;
  
  // Business & Location
  business_id: number;
  branch_id?: number;
  
  // Order Identification
  order_number: string;
  external_order_id?: string;       // Order ID from delivery app
  display_number?: string;          // Short number (#42)
  
  // Order Source & Type
  order_source: OrderSource;
  order_type: OrderType;
  
  // Status
  status: OrderStatus;
  order_status?: OrderStatus;  // Alias for existing database column
  
  // Timing
  order_date: string;
  order_time: string;
  scheduled_time?: string;
  estimated_ready_time?: string;
  actual_ready_time?: string;
  completed_at?: string;
  
  // Customer Information
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_notes?: string;
  
  // Dine-in specific
  table_number?: string;
  zone_area?: string;
  number_of_guests?: number;
  server_id?: number;
  
  // Delivery specific
  delivery_address?: string;
  delivery_address_lat?: number;
  delivery_address_lng?: number;
  delivery_instructions?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_id?: string;
  
  // Pricing
  subtotal: number;
  discount_amount: number;
  discount_id?: number;
  discount_code?: string;
  discount_type?: string;
  discount_reason?: string;
  tax_amount: number;
  tax_rate: number;
  service_charge: number;
  delivery_fee: number;
  packaging_fee: number;
  tip_amount: number;
  total: number;
  total_amount?: number;  // Alias for existing database column
  
  // Payment
  payment_method?: PaymentMethod;
  payment_status: PaymentStatus;
  paid_at?: string;
  payment_reference?: string;
  is_split_payment: boolean;
  split_payment_details?: Record<string, unknown>;
  
  // Cancellation/Refund
  cancelled_at?: string;
  cancelled_by?: number;
  cancellation_reason?: string;
  refund_amount: number;
  refunded_at?: string;
  refund_reference?: string;
  
  // POS Terminal Info
  pos_terminal_id?: string;
  pos_session_id?: number;
  
  // Staff
  created_by: number;
  updated_by?: number;
  cashier_id?: number;
  
  // Additional
  is_rush_order: boolean;
  is_void: boolean;
  void_reason?: string;
  void_at?: string;
  voided_by?: number;
  internal_notes?: string;
  external_metadata?: Record<string, unknown>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Relations (populated)
  items?: OrderItem[];
}

// Order Item interface
export interface OrderItem {
  id: number;
  order_id: number;
  
  // Product reference
  product_id?: number;
  product_name: string;
  product_name_ar?: string;
  product_sku?: string;
  product_category?: string;
  
  // Quantity & Pricing
  quantity: number;
  unit_price: number;
  discount_amount: number;
  discount_percentage: number;
  subtotal: number;
  total: number;
  
  // Modifiers
  has_modifiers: boolean;
  modifiers_total: number;
  modifiers?: OrderItemModifier[];
  
  // Special Instructions
  special_instructions?: string;
  
  // Status
  item_status: string;
  
  // Combo/Bundle
  is_combo: boolean;
  combo_id?: number;
  parent_item_id?: number;
  
  // Void
  is_void: boolean;
  void_reason?: string;
  voided_by?: number;
  voided_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Order Item Modifier interface
export interface OrderItemModifier {
  id: number;
  order_item_id: number;
  
  modifier_id?: number;
  modifier_group_id?: number;
  modifier_name: string;
  modifier_name_ar?: string;
  
  quantity: number;
  unit_price: number;
  total: number;
  
  modifier_type?: string;  // add, remove, substitute
  
  created_at: string;
}

// Order Payment (for split payments)
export interface OrderPayment {
  id: number;
  order_id: number;
  
  payment_method: PaymentMethod;
  amount: number;
  
  payment_reference?: string;
  payment_details?: Record<string, unknown>;
  
  status: PaymentStatus;
  paid_at?: string;
  
  processed_by?: number;
  
  created_at: string;
}

// Order Status History (audit trail)
export interface OrderStatusHistory {
  id: number;
  order_id: number;
  
  from_status?: OrderStatus;
  to_status: OrderStatus;
  
  changed_by?: number;
  change_reason?: string;
  
  created_at: string;
}

// Create Order Input
export interface CreateOrderInput {
  business_id: number;
  branch_id?: number;
  
  order_source: OrderSource;
  order_type: OrderType;
  
  // External order info (for delivery apps)
  external_order_id?: string;
  
  // Customer
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_notes?: string;
  
  // Dine-in
  table_number?: string;
  zone_area?: string;
  number_of_guests?: number;
  server_id?: number;
  
  // Delivery
  delivery_address?: string;
  delivery_address_lat?: number;
  delivery_address_lng?: number;
  delivery_instructions?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_id?: string;
  
  // Items
  items: CreateOrderItemInput[];
  
  // Discount
  discount_id?: number;
  discount_code?: string;
  discount_amount?: number;
  discount_type?: string;
  discount_reason?: string;
  
  // Fees
  delivery_fee?: number;
  packaging_fee?: number;
  service_charge?: number;
  tip_amount?: number;
  
  // Payment
  payment_method?: PaymentMethod;
  payment_reference?: string;
  
  // Scheduling
  scheduled_time?: string;
  
  // Staff
  created_by: number;
  cashier_id?: number;
  pos_terminal_id?: string;
  pos_session_id?: number;
  
  // Flags
  is_rush_order?: boolean;
  
  // Notes
  internal_notes?: string;
  
  // External metadata
  external_metadata?: Record<string, unknown>;
}

// Create Order Item Input
export interface CreateOrderItemInput {
  product_id?: number;
  product_name: string;
  product_name_ar?: string;
  product_sku?: string;
  product_category?: string;
  
  quantity: number;
  unit_price: number;
  
  discount_amount?: number;
  discount_percentage?: number;
  
  special_instructions?: string;
  
  modifiers?: CreateOrderItemModifierInput[];
  
  is_combo?: boolean;
  combo_id?: number;
}

// Create Order Item Modifier Input
export interface CreateOrderItemModifierInput {
  modifier_id?: number;
  modifier_group_id?: number;
  modifier_name: string;
  modifier_name_ar?: string;
  
  quantity?: number;
  unit_price: number;
  
  modifier_type?: string;
}

// Inventory
export interface InventoryTransaction extends BaseEntity {
  business_id: string;
  item_id: string;
  type: 'in' | 'out' | 'adjustment' | 'waste';
  quantity: number;
  reason?: string;
  created_by: string;
}

// Employee / HR
export interface Employee extends BaseEntity {
  business_id: string;
  user_id?: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  hire_date: string;
  hourly_rate?: number;
  is_active: boolean;
}

export interface Shift extends BaseEntity {
  business_id: string;
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string;
  actual_start?: string;
  actual_end?: string;
  status: 'scheduled' | 'started' | 'completed' | 'absent';
}

// Operations
export interface Task extends BaseEntity {
  business_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  category: string;
}

export interface Checklist extends BaseEntity {
  business_id: string;
  name: string;
  type: 'opening' | 'closing' | 'cleaning' | 'safety' | 'custom';
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  is_required: boolean;
  sort_order: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth types
export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  businessId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  business?: Business | null;
}

