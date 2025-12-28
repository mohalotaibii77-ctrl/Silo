// Store Setup Types

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export interface RestaurantProfile {
  name: string;
  type: 'quick_service' | 'full_service' | 'cafe' | 'bar' | 'food_truck' | 'cloud_kitchen';
  cuisine?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  timezone: string;
  currency: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  active: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  active: boolean;
  modifiers?: MenuModifier[];
}

export interface MenuModifier {
  id: string;
  name: string;
  options: ModifierOption[];
  required: boolean;
  multiSelect: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
}

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'owner' | 'manager' | 'cashier' | 'server' | 'kitchen' | 'inventory';
  pin?: string;
}

export interface PaymentMethod {
  type: 'cash' | 'card' | 'mobile' | 'online';
  enabled: boolean;
  provider?: string;
  credentials?: Record<string, string>;
}

export interface SetupProgress {
  currentStep: number;
  totalSteps: number;
  steps: SetupStep[];
  restaurantProfile?: Partial<RestaurantProfile>;
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  staff: StaffMember[];
  paymentMethods: PaymentMethod[];
}







