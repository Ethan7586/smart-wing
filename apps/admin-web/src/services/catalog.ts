import type { Order, OrderStatus, Product, ProductStatus } from '../types';

type CatalogItem = {
  id?: unknown;
  skuId?: unknown;
  name?: unknown;
  nameZh?: unknown;
  supplierName?: unknown;
  categoryCode?: unknown;
  coverUrl?: unknown;
  marketPriceCents?: unknown;
  priceCents?: unknown;
  availableStock?: unknown;
  status?: unknown;
};

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toAdminProduct(item: CatalogItem): Product {
  const id = text(item.id, text(item.skuId, crypto.randomUUID()));
  const stock = number(item.availableStock);
  const sourceStatus = text(item.status);
  const status: ProductStatus = sourceStatus === 'active' ? '已发布' : sourceStatus === 'inactive' ? '已下架' : '草稿';
  const title = text(item.nameZh, text(item.name, '未命名商品'));
  const supplierName = text(item.supplierName, '未标注供应商');

  return {
    id,
    spuCode: text(item.skuId, id),
    title,
    brand: supplierName,
    supplierId: supplierName,
    supplierName,
    categoryL1: text(item.categoryCode, '未分类'),
    supplierCategory: text(item.categoryCode, '未分类'),
    costPrice: number(item.marketPriceCents) / 100,
    mallPrice: number(item.priceCents) / 100,
    enterprisePrice: number(item.priceCents) / 100,
    stock,
    status,
    riskLevel: '低',
    missingFields: [],
    reviewer: '生产目录同步',
    visibleEnterprises: ['ALL'],
    mainImage: text(item.coverUrl),
    secondaryImages: [],
    skus: [],
    checklist: { category: true, price: true, stock: true, agreement: true, images: Boolean(text(item.coverUrl)), visibility: true },
    versions: [],
  };
}

/** Reads the full administration catalogue through the authorised commerce API. */
export async function loadLiveCatalog(): Promise<Product[]> {
  const response = await fetch('/api/v1/admin/products', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`CATALOG_REQUEST_FAILED_${response.status}`);
  const payload = (await response.json()) as { items?: unknown };
  if (!Array.isArray(payload.items)) throw new Error('CATALOG_RESPONSE_INVALID');
  return payload.items.filter((item): item is CatalogItem => typeof item === 'object' && item !== null).map(toAdminProduct);
}

/** Changes only the publication state. The server verifies scope, idempotency and writes an immutable audit event. */
export async function setLiveProductStatus(productId: string, status: 'active' | 'inactive'): Promise<void> {
  const response = await fetch(`/api/v1/admin/products/${encodeURIComponent(productId)}/status`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(`PRODUCT_STATUS_REQUEST_FAILED_${response.status}`);
}

export interface LiveOperationsSummary {
  catalogCount: number;
  availableStock: number;
  orderCount: number;
  afterSaleCount: number;
}

type ApiOrderItem = { productId?: unknown; productTitle?: unknown; productImage?: unknown; priceCents?: unknown; quantity?: unknown; specs?: unknown };
type ApiOrder = {
  id?: unknown;
  orderNo?: unknown;
  status?: unknown;
  payableCents?: unknown;
  welfarePaidCents?: unknown;
  mealPaidCents?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  items?: unknown;
};

function orderStatus(status: unknown): OrderStatus {
  switch (status) {
    case 'pending_payment':
      return '待付款';
    case 'paid':
    case 'processing':
      return '待发货';
    case 'shipped':
      return '已发货';
    case 'completed':
      return '已签收';
    case 'refund_pending':
      return '退款申请中';
    case 'refunded':
      return '已退款';
    default:
      return '异常挂起';
  }
}

function dateText(value: unknown): string {
  const date = typeof value === 'string' ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : '暂无时间记录';
}

function toAdminOrder(raw: ApiOrder): Order {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const first = items[0] as ApiOrderItem | undefined;
  const status = orderStatus(raw.status);
  const amount = number(raw.payableCents) / 100;
  const orderId = text(raw.id, text(raw.orderNo, crypto.randomUUID()));
  const createdAt = dateText(raw.createdAt);
  return {
    id: orderId,
    enterpriseId: 'production-enterprise',
    enterpriseName: '授权企业范围',
    employeeId: 'protected-member',
    employeeName: '受保护会员',
    employeeDept: '按最小必要原则隐藏',
    productId: text(first?.productId),
    productTitle: text(first?.productTitle, '订单商品'),
    productImage: text(first?.productImage),
    specName: '订单快照',
    quantity: number(first?.quantity, 1),
    unitPrice: number(first?.priceCents) / 100,
    totalAmount: amount,
    corporateBudgetPaid: number(raw.welfarePaidCents) / 100,
    employeeSelfPaid: number(raw.mealPaidCents) / 100,
    status,
    isProblematic: status === '退款申请中' || status === '异常挂起',
    problemType: status === '退款申请中' ? 'REFUND_DISPUTE' : undefined,
    problemSummary: status === '退款申请中' ? '售后退款申请待处理' : undefined,
    slaDeadline: '由供应商履约系统计算',
    createdAt,
    shippingAddress: '收货信息已脱敏',
    timeline: [
      { id: `${orderId}:created`, nodeName: '创建订单', timestamp: createdAt, status: 'success', operator: '系统', remark: '订单已在生产数据库创建。' },
      { id: `${orderId}:status`, nodeName: '当前状态', timestamp: dateText(raw.updatedAt), status: status === '异常挂起' ? 'warning' : 'success', operator: '系统', remark: `当前状态：${status}` },
    ],
    retryLogs: [],
    benefitsCard: { welfarePlanName: '企业福利账户', quotaUsed: number(raw.welfarePaidCents) / 100, remainingQuota: 0 },
    supplierId: 'not-exposed',
    supplierName: '供应商信息按订单权限展示',
  };
}

export async function shipLiveOrder(orderId: string): Promise<void> {
  const response = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/ship`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'idempotency-key': crypto.randomUUID() },
  });
  if (!response.ok) throw new Error(`ORDER_SHIP_REQUEST_FAILED_${response.status}`);
}

export interface AdminOverview {
  authenticated: boolean;
  authorization: { target?: unknown; roles?: unknown; permissions?: unknown };
  products: Product[];
  orders: Order[];
  summary: LiveOperationsSummary;
}

/** One protected request gives the admin app its session projection and first-paint facts. */
export async function loadAdminOverview(): Promise<AdminOverview> {
  const response = await fetch('/api/v1/admin/overview', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`ADMIN_OVERVIEW_REQUEST_FAILED_${response.status}`);
  const payload = (await response.json()) as { authenticated?: unknown; authorization?: AdminOverview['authorization']; products?: unknown; orders?: unknown; summary?: Partial<LiveOperationsSummary> };
  const products = Array.isArray(payload.products) ? payload.products.filter((item): item is CatalogItem => typeof item === 'object' && item !== null).map(toAdminProduct) : [];
  const orders = Array.isArray(payload.orders) ? payload.orders.filter((item): item is ApiOrder => typeof item === 'object' && item !== null).map(toAdminOrder) : [];
  return {
    authenticated: payload.authenticated === true,
    authorization: payload.authorization ?? {},
    products,
    orders,
    summary: {
      catalogCount: number(payload.summary?.catalogCount, products.length),
      availableStock: number(
        payload.summary?.availableStock,
        products.reduce((total, product) => total + product.stock, 0)
      ),
      orderCount: number(payload.summary?.orderCount, orders.length),
      afterSaleCount: number(payload.summary?.afterSaleCount),
    },
  };
}
