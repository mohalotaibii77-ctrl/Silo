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

export type UserRole = 'owner' | 'manager' | 'employee' | 'pos' | 'kitchen_display' | 'super_admin';

// Item Types: Food (ingredients for recipes) vs Non-Food (accessories for products)
export type ItemType = 'food' | 'non_food';

// Item Categories
// - Food items have multiple categories for organization
// - Non-food items (accessories) have a single 'non_food' category
export type ItemCategory = 
  // Food categories
  | 'vegetable' | 'fruit' | 'meat' | 'poultry' | 'seafood' 
  | 'dairy' | 'grain' | 'bread' | 'sauce' | 'condiment' 
  | 'spice' | 'oil' | 'beverage' | 'sweetener'
  // Non-food (accessories) - single category
  | 'non_food';

// Accessory order types - when product accessories should be deducted
export type AccessoryOrderType = 'always' | 'dine_in' | 'takeaway' | 'delivery';

// Serving units (how items are used in products/recipes)
export type ItemUnit = 'grams' | 'mL' | 'piece';

// Storage units (how items are stored in inventory)
export type StorageUnit = 'Kg' | 'grams' | 'L' | 'mL' | 'piece';

// Unit categories for validation
export type UnitCategory = 'weight' | 'volume' | 'count';

// Items (Raw Materials / Ingredients / Packaging / Supplies)
export interface Item {
  id: number;
  business_id: number | null;
  name: string;
  name_ar?: string | null;
  sku?: string | null;
  item_type: ItemType;         // Type: food or non_food (accessories)
  category: ItemCategory;
  unit: ItemUnit;              // Serving unit (for products/recipes)
  storage_unit: StorageUnit;   // Storage unit (for inventory)
  cost_per_unit: number;       // Weighted Average Cost (WAC)
  is_system_item: boolean;
  status: 'active' | 'inactive';
  
  // Inventory Value Tracking (for WAC calculations)
  total_stock_quantity?: number;   // Total stock across all branches
  total_stock_value?: number;      // Total inventory value
  last_purchase_cost?: number;     // Last purchase price (for reference)
  last_purchase_date?: string;     // Date of last purchase
  
  created_at: string;
  updated_at: string;
}

// Product Accessories (non-food items linked to products)
export interface ProductAccessory {
  id: number;
  product_id: number;
  variant_id?: number | null;
  item_id: number;
  quantity: number;
  applicable_order_types: AccessoryOrderType[];
  is_required: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined data (populated when needed)
  item?: Item;
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
// Note: Specific delivery partner is identified via delivery_partner_id (from delivery_partners table)
export type OrderSource = 
  | 'pos'           // Direct POS terminal order
  | 'api'           // External API (delivery partners like Talabat, Jahez, etc.)
  | 'phone'         // Phone order
  | 'website'       // Restaurant website
  | 'mobile_app'    // Restaurant's own mobile app
  | 'walk_in'       // Walk-in customer
  | 'other';        // Other sources

// Order types
export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'drive_thru';

// Order status (7 statuses)
// Flow:
//   POS orders: in_progress → completed/cancelled
//   Delivery API orders: in_progress → completed (food ready) → picked_up (driver collected)
//   Refunded orders: any → refunded (full refund)
export type OrderStatus =
  | 'pending'           // Reserved for future use (scheduled orders)
  | 'in_progress'       // Order being prepared (first status for all orders)
  | 'completed'         // Food ready - for delivery orders, waiting for pickup
  | 'picked_up'         // Delivery orders only: driver has picked up the order
  | 'cancelled'         // Order cancelled
  | 'rejected'          // Reserved for future use
  | 'refunded';         // Order fully refunded

// Payment methods - Simplified to actual methods used
// Note: 'pay_later' is not a payment method, it's a payment timing option stored separately
export type PaymentMethod = 
  | 'cash'          // Cash payment
  | 'card';         // Card payment (includes all card types: visa, mada, mastercard, etc.)

// Payment status
export type PaymentStatus = 
  | 'pending'        // Payment not yet received (dine-in pay later, delivery COD)
  | 'paid'           // Payment received
  | 'app_payment'    // Delivery partner handles payment (Jahez, Talabat, etc.)
  | 'refunded'       // Fully refunded
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

  // Order Edit Tracking
  is_edited?: boolean;           // True if order was edited after creation
  remaining_amount?: number;     // Amount remaining after edit (positive = owes more, negative = credit)
  
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
  
  // Cost Snapshot at Time of Sale (for accurate profit calculations)
  unit_cost_at_sale: number;     // Product cost at time of sale
  total_cost: number;            // Total cost (unit_cost_at_sale × quantity)
  profit: number;                // Profit (total - total_cost)
  profit_margin: number;         // Profit margin percentage
  
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
  delivery_partner_id?: number;  // If set, this is a delivery partner order (app handles payment)
  
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
  is_pay_later?: boolean;  // For dine-in: customer pays after eating
  
  // Cash payment details (for upfront cash payments)
  cash_amount_received?: number;
  cash_change_given?: number;
  
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
  variant_id?: number;        // Product variant ID for inventory checking
  bundle_id?: number;         // Bundle ID if this is a bundle
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

// =====================================================
// CUSTOMER & DRIVER TYPES
// =====================================================

// Customer interface
export interface Customer {
  id: number;
  business_id: number;
  branch_id?: number | null;
  
  name: string;
  name_ar?: string | null;
  phone?: string | null;
  email?: string | null;
  
  address?: string | null;
  address_lat?: number | null;
  address_lng?: number | null;
  
  notes?: string | null;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
}

// Driver status
export type DriverStatus = 'available' | 'busy' | 'offline';

// Driver interface
export interface Driver {
  id: number;
  business_id: number;
  branch_id?: number | null;
  
  name: string;
  name_ar?: string | null;
  phone?: string | null;
  email?: string | null;
  
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  
  status: DriverStatus;
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
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

// =====================================================
// ATTENDANCE & GEOFENCING TYPES
// =====================================================

// GPS Location data from device
export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;  // GPS accuracy in meters
}

// Branch geofence configuration
export interface BranchGeofence {
  branch_id: number;
  branch_name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
  geofence_enabled: boolean;
}

// Geofence settings from operational_settings
export interface GeofenceSettings {
  require_gps_checkin: boolean;
  checkin_buffer_minutes_before: number;
  checkin_buffer_minutes_after: number;
  gps_accuracy_threshold_meters: number;
  default_geofence_radius_meters: number;
  working_days: string[];  // e.g., ["sunday", "monday", "tuesday", ...]
  opening_time: string;    // HH:MM format
  closing_time: string;    // HH:MM format
  // Checkout restrictions
  min_shift_hours: number;              // Minimum hours before checkout allowed
  checkout_buffer_minutes_before: number; // Minutes before closing that checkout is allowed
  require_checkout_restrictions: boolean; // Whether checkout restrictions are enforced
}

// Attendance status types
export type AttendanceStatusType = 'on_time' | 'late' | 'absent' | 'checked_in' | 'checked_out' | 'rest_day';

// Attendance record from database
export interface AttendanceRecord {
  id: number;
  business_id: number;
  branch_id: number | null;
  employee_id: number;
  date: string;  // YYYY-MM-DD

  // Check-in data
  checkin_time: string | null;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  checkin_accuracy_meters: number | null;
  checkin_distance_meters: number | null;
  checkin_device_info: Record<string, unknown> | null;

  // Check-out data
  checkout_time: string | null;
  checkout_latitude: number | null;
  checkout_longitude: number | null;
  checkout_accuracy_meters: number | null;
  checkout_distance_meters: number | null;
  checkout_device_info: Record<string, unknown> | null;

  // Calculated fields
  total_hours: number | null;
  status: AttendanceStatusType;
  late_minutes: number;

  // Audit fields
  notes: string | null;
  adjusted_by: number | null;
  adjustment_reason: string | null;

  created_at: string;
  updated_at: string;
}

// Check-in validation result
export interface CheckInValidationResult {
  valid: boolean;
  error_code?: 'OUTSIDE_GEOFENCE' | 'OUTSIDE_WORKING_HOURS' | 'NOT_WORKING_DAY' |
               'ALREADY_CHECKED_IN' | 'GPS_ACCURACY_LOW' | 'GEOFENCE_NOT_CONFIGURED' |
               'PERMISSION_DENIED' | 'NOT_CHECKED_IN';
  error_message?: string;
  distance_meters?: number;
  within_geofence?: boolean;
  within_working_hours?: boolean;
  is_working_day?: boolean;
}

// Check-in request from frontend
export interface CheckInRequest {
  latitude: number;
  longitude: number;
  accuracy: number;
  device_info?: {
    platform: string;
    os_version: string;
    app_version: string;
  };
}

// Check-in response
export interface CheckInResponse {
  success: boolean;
  data?: {
    attendance_id: number;
    checkin_time: string;
    distance_meters: number;
    within_geofence: boolean;
    branch_name: string;
    status: AttendanceStatusType;
    late_minutes: number;
  };
  error?: string;
  error_code?: CheckInValidationResult['error_code'];
}

// Attendance history item (for employee view)
export interface AttendanceHistoryItem {
  date: string;           // YYYY-MM-DD
  day_name: string;       // e.g., "Thursday"
  checkin_time: string | null;   // HH:MM format
  checkout_time: string | null;  // HH:MM format
  total_hours: number | null;
  status: AttendanceStatusType;
  late_minutes: number;
}

// Attendance summary
export interface AttendanceSummary {
  total_days: number;
  on_time: number;
  late: number;
  absent: number;
  rest_days: number;
}

// Attendance history response
export interface AttendanceHistoryResponse {
  records: AttendanceHistoryItem[];
  summary: AttendanceSummary;
}

// Employee schedule override (Special Attendance)
export interface EmployeeScheduleOverride {
  id: number;
  business_id: number;
  employee_id: number;

  // Override values (null = use business default)
  working_days: string[] | null;
  opening_time: string | null;    // HH:MM format
  closing_time: string | null;    // HH:MM format
  checkin_buffer_minutes_before: number | null;
  checkin_buffer_minutes_after: number | null;

  notes: string | null;
  is_active: boolean;

  created_at: string;
  updated_at: string;

  // Populated when fetching with employee info
  employee_name?: string;
  employee_role?: string;
}

// Effective schedule (combined business default + employee override)
export interface EffectiveSchedule {
  working_days: string[];
  opening_time: string;
  closing_time: string;
  checkin_buffer_minutes_before: number;
  checkin_buffer_minutes_after: number;
  has_override: boolean;
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
  username?: string;
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

