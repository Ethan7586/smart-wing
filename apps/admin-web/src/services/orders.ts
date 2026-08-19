import type { Order } from '../types';
import { ADMIN_ORDER_STATUS_OPTIONS, isOrderStatus, type AdminOrderStatus } from '@smart-wing/api-contract';
import { isJsonRecord, requestAdminJson } from './adminJson';

export const ORDER_STATUS_OPTIONS = ADMIN_ORDER_STATUS_OPTIONS;
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
type ValidatedPage<T> = { items: T[]; total: number; limit?: number; offset?: number };
export type OrderListItem = {
  id: string;
  orderNo: string;
  status: AdminOrderStatus;
  payableCents: number;
  paidCents: number;
  welfarePaidCents: number;
  mealPaidCents: number;
  /** Distinct product lines. This is not the total number of units. */
  lineCount: number;
  /** Total units across all product lines. */
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
  return getPage('/api/v1/admin/orders', filters, isOrderListItem);
}

export async function loadAfterSalePage(filters: OrderFilters): Promise<Page<AfterSaleListItem>> {
  return getPage('/api/v1/admin/after-sales', filters, isAfterSaleListItem);
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
      status: order.status,
      payableCents: order.totalCents,
      paidCents: order.totalCents,
      welfarePaidCents: order.corporateBudgetPaidCents,
      mealPaidCents: order.employeeSelfPaidCents,
      lineCount: 1,
      itemCount: order.quantity,
      firstProductName: order.productTitle,
      supplierNames: [order.supplierName],
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    }));
  return { items, total: orders.length, limit: filters.limit, offset: filters.offset };
}

export function legacyAfterSalePage(orders: Order[], filters: OrderFilters): Page<AfterSaleListItem> {
  const sources = orders.filter((order) => order.status === 'refund_pending' || order.status === 'refunded');
  const items = sources.slice(filters.offset, filters.offset + filters.limit).map((order) => ({
    id: `after-sale:${order.id}`,
    afterSaleNo: `AS-${order.orderNo}`,
    orderId: order.id,
    orderNo: order.orderNo,
    type: 'refund_only',
    status: order.status === 'refunded' ? 'completed' : 'reviewing',
    reason: order.problemSummary ?? '售后申请处理中',
    requestedAmountCents: order.totalCents,
    firstProductName: order.productTitle,
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  }));
  return { items, total: sources.length, limit: filters.limit, offset: filters.offset };
}

async function getPage<T>(path: string, filters: OrderFilters, isItem: (value: unknown) => value is T): Promise<Page<T>> {
  const payload = await requestAdminJson<ValidatedPage<T>>(`${path}?${buildOrderQuery(filters)}`, {
    label: '订单查询服务',
    validate: (value): value is ValidatedPage<T> => isValidPage(value, isItem),
  });
  return { items: payload.items, total: payload.total, limit: payload.limit ?? filters.limit, offset: payload.offset ?? 0 };
}

function toIsoStart(value: string): string {
  return toIsoBoundary(value, 'T00:00:00');
}

function toIsoEnd(value: string): string {
  return toIsoBoundary(value, 'T23:59:59.999');
}

function toIsoBoundary(value: string, suffix: string): string {
  if (!value) return '';
  const date = new Date(`${value}${suffix}`);
  // Do not let a malformed value crash rendering. Keep it intact so the API
  // can reject it as an invalid query instead of silently widening the scope.
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}

function isValidPage<T>(value: unknown, isItem: (item: unknown) => item is T): value is ValidatedPage<T> {
  return (
    isJsonRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
    isNonNegativeInteger(value.total) &&
    (value.limit === undefined || isPositiveInteger(value.limit)) &&
    (value.offset === undefined || isNonNegativeInteger(value.offset))
  );
}

function isOrderListItem(value: unknown): value is OrderListItem {
  return (
    isJsonRecord(value) &&
    isText(value.id) &&
    isText(value.orderNo) &&
    isOrderStatus(value.status) &&
    ORDER_STATUS_OPTIONS.some(([status]) => status === value.status) &&
    isNonNegativeInteger(value.payableCents) &&
    isNonNegativeInteger(value.paidCents) &&
    isNonNegativeInteger(value.welfarePaidCents) &&
    isNonNegativeInteger(value.mealPaidCents) &&
    // A legacy order can have had all of its lines archived.  Keep the page
    // readable in that case instead of rejecting every result because one
    // record reports zero product kinds.
    isNonNegativeInteger(value.lineCount) &&
    isPositiveInteger(value.itemCount) &&
    isText(value.firstProductName) &&
    Array.isArray(value.supplierNames) &&
    value.supplierNames.every(isText) &&
    isText(value.createdAt) &&
    isText(value.updatedAt)
  );
}

function isAfterSaleListItem(value: unknown): value is AfterSaleListItem {
  return isJsonRecord(value) && ['id', 'afterSaleNo', 'orderId', 'orderNo', 'type', 'status', 'reason', 'firstProductName', 'createdAt', 'updatedAt'].every((key) => isText(value[key])) && isNonNegativeInteger(value.requestedAmountCents);
}

function isText(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}
