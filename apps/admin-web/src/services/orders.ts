import type { Order } from '../types';

export const ORDER_STATUS_OPTIONS = [
  ['pending_payment', '待付款'],
  ['paid', '已支付'],
  ['processing', '待发货'],
  ['shipped', '已发货'],
  ['completed', '已签收'],
  ['cancelled', '已取消'],
  ['refund_pending', '退款申请中'],
  ['refunded', '已退款'],
] as const;
export const AFTER_SALE_STATUS_OPTIONS = [
  ['submitted', '已提交'],
  ['reviewing', '审核中'],
  ['approved', '已同意'],
  ['rejected', '已拒绝'],
  ['returning', '退货中'],
  ['completed', '已完成'],
  ['closed', '已关闭'],
] as const;

export type OrderFilters = { keyword: string; status: string; createdFrom: string; createdTo: string; sort: string; limit: number; offset: number };
export type Page<T> = { items: T[]; total: number; limit: number; offset: number };
export type OrderListItem = {
  id: string;
  orderNo: string;
  status: string;
  payableCents: number;
  paidCents: number;
  welfarePaidCents: number;
  mealPaidCents: number;
  itemCount: number;
  firstProductName: string;
  supplierNames: string[];
  createdAt: string;
  updatedAt: string;
};
export type AfterSaleListItem = {
  id: string;
  afterSaleNo: string;
  orderId: string;
  orderNo: string;
  type: string;
  status: string;
  reason: string;
  requestedAmountCents: number;
  firstProductName: string;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_ORDER_FILTERS: OrderFilters = { keyword: '', status: '', createdFrom: '', createdTo: '', sort: 'created_at_desc', limit: 20, offset: 0 };

export function buildOrderQuery(filters: OrderFilters): string {
  const params = new URLSearchParams();
  const values: Record<string, string | number> = {
    keyword: filters.keyword.trim(),
    status: filters.status,
    createdFrom: toIsoStart(filters.createdFrom),
    createdTo: toIsoEnd(filters.createdTo),
    sort: filters.sort,
    limit: filters.limit,
    offset: filters.offset,
  };
  Object.entries(values).forEach(([key, value]) => {
    if (value !== '') params.set(key, String(value));
  });
  return params.toString();
}

export async function loadOrderPage(filters: OrderFilters): Promise<Page<OrderListItem>> {
  return getPage<OrderListItem>('/api/v1/admin/orders', filters);
}

export async function loadAfterSalePage(filters: OrderFilters): Promise<Page<AfterSaleListItem>> {
  return getPage<AfterSaleListItem>('/api/v1/admin/after-sales', filters);
}

export async function exportOrderPage(kind: 'orders' | 'after-sales', filters: OrderFilters): Promise<void> {
  const response = await fetch(`/api/v1/admin/${kind}/export?${buildOrderQuery(filters)}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`ORDER_EXPORT_REQUEST_FAILED_${response.status}`);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = kind === 'orders' ? 'orders.csv' : 'after-sales.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function executeAfterSaleRefund(afterSaleId: string, refundCents: number): Promise<void> {
  const response = await fetch(`/api/v1/after-sales/${encodeURIComponent(afterSaleId)}/refund`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify({ refundCents }),
  });
  if (!response.ok) throw new Error(`AFTER_SALE_REFUND_REQUEST_FAILED_${response.status}`);
}

export function formatCents(cents: number): string {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : '暂无时间记录';
}

export function statusLabel(status: string, options: readonly (readonly [string, string])[]): string {
  return options.find(([value]) => value === status)?.[1] ?? status;
}

export function legacyOrderPage(orders: Order[], filters: OrderFilters): Page<OrderListItem> {
  const keyword = filters.keyword.trim();
  const items = orders
    .filter((order) => !keyword || order.orderNo.includes(keyword) || order.productTitle.includes(keyword))
    .slice(filters.offset, filters.offset + filters.limit)
    .map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      status: legacyOrderStatus(order.status),
      payableCents: Math.round(order.totalAmount * 100),
      paidCents: Math.round(order.totalAmount * 100),
      welfarePaidCents: Math.round(order.corporateBudgetPaid * 100),
      mealPaidCents: Math.round(order.employeeSelfPaid * 100),
      itemCount: order.quantity,
      firstProductName: order.productTitle,
      supplierNames: [order.supplierName],
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    }));
  return { items, total: orders.length, limit: filters.limit, offset: filters.offset };
}

export function legacyAfterSalePage(orders: Order[], filters: OrderFilters): Page<AfterSaleListItem> {
  const sources = orders.filter((order) => order.status === '退款申请中' || order.status === '已退款');
  const items = sources.slice(filters.offset, filters.offset + filters.limit).map((order) => ({
    id: `after-sale:${order.id}`,
    afterSaleNo: `AS-${order.orderNo}`,
    orderId: order.id,
    orderNo: order.orderNo,
    type: 'refund_only',
    status: order.status === '已退款' ? 'completed' : 'reviewing',
    reason: order.problemSummary ?? '售后申请处理中',
    requestedAmountCents: Math.round(order.totalAmount * 100),
    firstProductName: order.productTitle,
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  }));
  return { items, total: sources.length, limit: filters.limit, offset: filters.offset };
}

async function getPage<T>(path: string, filters: OrderFilters): Promise<Page<T>> {
  const response = await fetch(`${path}?${buildOrderQuery(filters)}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`ORDER_PAGE_REQUEST_FAILED_${response.status}`);
  const payload = (await response.json()) as Partial<Page<T>>;
  if (!Array.isArray(payload.items) || !Number.isFinite(payload.total)) throw new Error('ORDER_PAGE_RESPONSE_INVALID');
  return { items: payload.items, total: Number(payload.total), limit: Number(payload.limit) || filters.limit, offset: Number(payload.offset) || 0 };
}

function toIsoStart(value: string): string {
  return value ? new Date(`${value}T00:00:00`).toISOString() : '';
}

function toIsoEnd(value: string): string {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : '';
}

function legacyOrderStatus(status: Order['status']): string {
  return ({ 待付款: 'pending_payment', 库存预占: 'processing', 已支付: 'paid', 待发货: 'processing', 已发货: 'shipped', 已签收: 'completed', 退款申请中: 'refund_pending', 已退款: 'refunded', 异常挂起: 'cancelled' } as const)[status];
}
