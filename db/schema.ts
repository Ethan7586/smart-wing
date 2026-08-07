/**
 * 智慧翼生产型 MVP 数据域。
 *
 * 所有金额都使用人民币分（integer cents），避免浮点误差。
 * 所有业务记录都必须携带 tenant_id，商城数据同时携带 mall_id。
 */
export const TABLES = {
  tenants: 'tenants',
  enterprises: 'enterprises',
  malls: 'malls',
  departments: 'departments',
  users: 'users',
  roles: 'roles',
  permissions: 'permissions',
  userRoles: 'user_roles',
  suppliers: 'suppliers',
  products: 'products',
  skus: 'skus',
  inventory: 'inventory',
  welfareAccounts: 'welfare_accounts',
  accountLedgers: 'account_ledgers',
  carts: 'carts',
  cartItems: 'cart_items',
  orders: 'orders',
  subOrders: 'sub_orders',
  orderItems: 'order_items',
  payments: 'payments',
  paymentAllocations: 'payment_allocations',
  refunds: 'refunds',
  afterSales: 'after_sales',
  auditLogs: 'audit_logs',
  idempotencyKeys: 'idempotency_keys',
} as const;

export type MoneyCents = number;

export interface TenantScope {
  tenantId: string;
  enterpriseId: string;
  mallId: string;
}

export interface RequestActor extends TenantScope {
  userId: string;
  employeeNo: string;
  roles: string[];
}

export interface ProductListRow {
  id: string;
  skuId: string;
  name: string;
  subtitle: string | null;
  categoryCode: string;
  coverUrl: string | null;
  priceCents: MoneyCents;
  marketPriceCents: MoneyCents | null;
  availableStock: number;
  supplierName: string;
}
