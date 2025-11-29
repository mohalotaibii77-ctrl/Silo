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

// Items (Menu Items / Ingredients)
export interface Item extends BaseEntity {
  business_id: string;
  name: string;
  sku?: string;
  type: 'product' | 'ingredient' | 'supply';
  category_id?: string;
  unit: string;
  cost_price?: number;
  sell_price?: number;
  current_stock: number;
  min_stock_level: number;
  is_active: boolean;
}

// Category
export interface Category extends BaseEntity {
  business_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
}

// Order (POS)
export interface Order extends BaseEntity {
  business_id: string;
  order_number: string;
  status: OrderStatus;
  type: 'dine_in' | 'takeaway' | 'delivery';
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method?: string;
  paid_at?: string;
  created_by: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface OrderItem extends BaseEntity {
  order_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
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

