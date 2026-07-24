INSERT INTO tenants (id, code, name)
VALUES ('tenant-smart-wing', 'SMART_WING', '智慧翼福利平台');

INSERT INTO enterprises (id, tenant_id, code, name)
VALUES ('enterprise-demo', 'tenant-smart-wing', 'DEMO_ENTERPRISE', '示范企业');

INSERT INTO malls (
  id, tenant_id, enterprise_id, code, public_slug, name, brand_name
)
VALUES (
  'mall-demo',
  'tenant-smart-wing',
  'enterprise-demo',
  'SMART_WING_DEMO',
  'smart-wing-demo',
  '智慧翼企业福利商城',
  '智慧翼企业福利商城'
);

INSERT INTO departments (id, tenant_id, enterprise_id, code, name)
VALUES ('department-digital', 'tenant-smart-wing', 'enterprise-demo', 'DIGITAL', '数字化推进部');

INSERT INTO users (
  id, tenant_id, enterprise_id, department_id, employee_no, display_name, email
)
VALUES (
  'user-demo',
  'tenant-smart-wing',
  'enterprise-demo',
  'department-digital',
  'SW0001',
  '演示员工',
  'demo@example.invalid'
);

INSERT INTO roles (id, tenant_id, code, name)
VALUES
  ('role-employee', 'tenant-smart-wing', 'employee', '员工'),
  ('role-mall-admin', 'tenant-smart-wing', 'mall_admin', '商城管理员');

INSERT INTO permissions (id, code, name)
VALUES
  ('permission-catalog-read', 'catalog:read', '查看商品'),
  ('permission-order-create', 'order:create', '创建订单'),
  ('permission-order-read-own', 'order:read:own', '查看本人订单');

INSERT INTO role_permissions (role_id, permission_id)
VALUES
  ('role-employee', 'permission-catalog-read'),
  ('role-employee', 'permission-order-create'),
  ('role-employee', 'permission-order-read-own');

INSERT INTO user_roles (tenant_id, user_id, role_id)
VALUES ('tenant-smart-wing', 'user-demo', 'role-employee');

INSERT INTO suppliers (id, tenant_id, code, name)
VALUES
  ('supplier-central', 'tenant-smart-wing', 'CENTRAL_SUPPLY', '央企供应链'),
  ('supplier-local', 'tenant-smart-wing', 'LOCAL_SERVICE', '本地生活服务');

INSERT INTO products (
  id, tenant_id, mall_id, supplier_id, spu_code, name, subtitle,
  category_code, cover_url, status
)
VALUES
  (
    'product-rice',
    'tenant-smart-wing',
    'mall-demo',
    'supplier-central',
    'SPU-RICE-001',
    '五常大米礼盒',
    '企业福利严选',
    'food',
    NULL,
    'active'
  ),
  (
    'product-movie',
    'tenant-smart-wing',
    'mall-demo',
    'supplier-local',
    'SPU-MOVIE-001',
    '全国通用电影券',
    '电子券即时发放',
    'virtual-card',
    NULL,
    'active'
  );

INSERT INTO skus (
  id, tenant_id, mall_id, product_id, sku_code, specs_json,
  price_cents, market_price_cents
)
VALUES
  (
    'sku-rice-5kg',
    'tenant-smart-wing',
    'mall-demo',
    'product-rice',
    'SKU-RICE-5KG',
    '{"重量":"5kg"}',
    8900,
    10900
  ),
  (
    'sku-movie-single',
    'tenant-smart-wing',
    'mall-demo',
    'product-movie',
    'SKU-MOVIE-SINGLE',
    '{"类型":"单人票"}',
    4500,
    6000
  );

INSERT INTO inventory (
  tenant_id, mall_id, sku_id, available_qty, reserved_qty
)
VALUES
  ('tenant-smart-wing', 'mall-demo', 'sku-rice-5kg', 1000, 0),
  ('tenant-smart-wing', 'mall-demo', 'sku-movie-single', 10000, 0);

INSERT INTO welfare_accounts (
  id, tenant_id, enterprise_id, mall_id, user_id, account_type, balance_cents
)
VALUES
  (
    'account-demo-welfare',
    'tenant-smart-wing',
    'enterprise-demo',
    'mall-demo',
    'user-demo',
    'welfare',
    328000
  ),
  (
    'account-demo-meal',
    'tenant-smart-wing',
    'enterprise-demo',
    'mall-demo',
    'user-demo',
    'meal',
    85050
  );
