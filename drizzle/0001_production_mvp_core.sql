PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enterprises (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, code)
);

CREATE TABLE malls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  code TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand_name TEXT NOT NULL DEFAULT '智慧翼企业福利商城',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, code)
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  parent_id TEXT REFERENCES departments(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (enterprise_id, code)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  department_id TEXT REFERENCES departments(id),
  employee_no TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  mobile_masked TEXT,
  identity_subject TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (enterprise_id, employee_no),
  UNIQUE (tenant_id, identity_subject)
);

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  settlement_mode TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, code)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  spu_code TEXT NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT,
  category_code TEXT NOT NULL,
  cover_url TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mall_id, spu_code)
);

CREATE TABLE skus (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  sku_code TEXT NOT NULL,
  specs_json TEXT NOT NULL DEFAULT '{}',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  market_price_cents INTEGER CHECK (market_price_cents IS NULL OR market_price_cents >= price_cents),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mall_id, sku_code)
);

CREATE TABLE inventory (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  sku_id TEXT PRIMARY KEY REFERENCES skus(id),
  available_qty INTEGER NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  reserved_qty INTEGER NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE welfare_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('welfare', 'meal')),
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mall_id, user_id, account_type)
);

CREATE TABLE account_ledgers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  account_id TEXT NOT NULL REFERENCES welfare_accounts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  balance_after_cents INTEGER NOT NULL CHECK (balance_after_cents >= 0),
  business_type TEXT NOT NULL,
  business_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (account_id, idempotency_key)
);

CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mall_id, user_id)
);

CREATE TABLE cart_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  sku_id TEXT NOT NULL REFERENCES skus(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  selected INTEGER NOT NULL DEFAULT 1 CHECK (selected IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cart_id, sku_id)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refund_pending', 'refunded')),
  goods_amount_cents INTEGER NOT NULL CHECK (goods_amount_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  payable_cents INTEGER NOT NULL CHECK (payable_cents >= 0),
  paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  recipient_snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sub_orders (
  id TEXT PRIMARY KEY,
  sub_order_no TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  parent_order_id TEXT NOT NULL REFERENCES orders(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  sub_order_id TEXT NOT NULL REFERENCES sub_orders(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  sku_id TEXT NOT NULL REFERENCES skus(id),
  product_name_snapshot TEXT NOT NULL,
  specs_snapshot_json TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_amount_cents INTEGER NOT NULL CHECK (line_amount_cents >= 0)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  payment_no TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  channel TEXT NOT NULL CHECK (channel IN ('welfare', 'meal', 'wechat', 'alipay', 'unionpay', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('created', 'processing', 'succeeded', 'failed', 'closed', 'refunded')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  provider_trade_no TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE (mall_id, idempotency_key)
);

CREATE TABLE payment_allocations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  payment_id TEXT NOT NULL REFERENCES payments(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  account_id TEXT REFERENCES welfare_accounts(id),
  channel TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0)
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  refund_no TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  payment_id TEXT REFERENCES payments(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('created', 'processing', 'succeeded', 'failed')),
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE (mall_id, idempotency_key)
);

CREATE TABLE after_sales (
  id TEXT PRIMARY KEY,
  after_sale_no TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  order_item_id TEXT REFERENCES order_items(id),
  type TEXT NOT NULL CHECK (type IN ('refund_only', 'return_refund', 'exchange')),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'reviewing', 'approved', 'rejected', 'returning', 'completed', 'closed')),
  reason TEXT NOT NULL,
  requested_amount_cents INTEGER NOT NULL CHECK (requested_amount_cents >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  enterprise_id TEXT,
  mall_id TEXT,
  actor_user_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'system', 'supplier')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  request_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE idempotency_keys (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  mall_id TEXT NOT NULL REFERENCES malls(id),
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  resource_id TEXT,
  response_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (mall_id, scope, idempotency_key)
);

CREATE INDEX idx_enterprises_tenant ON enterprises (tenant_id);
CREATE INDEX idx_malls_tenant_enterprise ON malls (tenant_id, enterprise_id);
CREATE INDEX idx_users_tenant_enterprise ON users (tenant_id, enterprise_id);
CREATE INDEX idx_products_catalog ON products (tenant_id, mall_id, status, category_code);
CREATE INDEX idx_skus_product ON skus (tenant_id, mall_id, product_id, status);
CREATE INDEX idx_inventory_scope ON inventory (tenant_id, mall_id, sku_id);
CREATE INDEX idx_accounts_owner ON welfare_accounts (tenant_id, mall_id, user_id);
CREATE INDEX idx_ledger_business ON account_ledgers (tenant_id, mall_id, business_type, business_id);
CREATE INDEX idx_orders_owner ON orders (tenant_id, mall_id, user_id, created_at);
CREATE INDEX idx_orders_status ON orders (tenant_id, mall_id, status, created_at);
CREATE INDEX idx_sub_orders_parent ON sub_orders (tenant_id, mall_id, parent_order_id);
CREATE INDEX idx_payments_order ON payments (tenant_id, mall_id, order_id);
CREATE INDEX idx_after_sales_owner ON after_sales (tenant_id, mall_id, user_id, created_at);
CREATE INDEX idx_audit_scope ON audit_logs (tenant_id, mall_id, created_at);
