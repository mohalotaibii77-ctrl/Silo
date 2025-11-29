/**
 * SILO INTERNAL MICROSERVICES
 * 
 * All services are internal and communicate directly via function calls.
 * This is the single export point for all services.
 */

export { authService, AuthService } from './auth.service';
export { posService, POSService } from './pos.service';
export { inventoryService, InventoryService } from './inventory.service';
export { hrService, HRService } from './hr.service';
export { operationsService, OperationsService } from './operations.service';
export { businessService, BusinessService } from './business.service';

/**
 * Service Registry
 * Quick reference to all available services
 */
export const services = {
  auth: () => import('./auth.service').then(m => m.authService),
  pos: () => import('./pos.service').then(m => m.posService),
  inventory: () => import('./inventory.service').then(m => m.inventoryService),
  hr: () => import('./hr.service').then(m => m.hrService),
  operations: () => import('./operations.service').then(m => m.operationsService),
  business: () => import('./business.service').then(m => m.businessService),
};

