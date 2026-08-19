import type { Order, OrderStatus } from '../types';

type ApiOrderItem = {
  productId?: unknown;
  productTitle?: unknown;
  productImage?: unknown;
  priceCents?: unknown;
  quantity?: unknown;
  specs?: unknown;
};

export type ApiOrder = {
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

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cents(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : 0;
}

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

function isoDateTime(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : date.toISOString();
}

function dateText(value: unknown): string {
  const iso = isoDateTime(value);
  return iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '暂无时间记录';
}

/**
 * Creates the UI projection while preserving the machine-readable timestamp
 * and all monetary values in integer cents. Display values remain compatibility
 * fields only and must never be parsed back into business data.
 */
export function toAdminOrder(raw: ApiOrder): Order {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const first = items[0] as ApiOrderItem | undefined;
  const status = orderStatus(raw.status);
  const payableCents = cents(raw.payableCents);
  const welfarePaidCents = cents(raw.welfarePaidCents);
  const mealPaidCents = cents(raw.mealPaidCents);
  const unitPriceCents = cents(first?.priceCents);
  const orderId = text(raw.id, text(raw.orderNo, crypto.randomUUID()));
  const createdAtIso = isoDateTime(raw.createdAt);
  const createdAt = dateText(raw.createdAt);

  return {
    id: orderId,
    orderNo: text(raw.orderNo, orderId),
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
    unitPriceCents,
    totalCents: payableCents,
    corporateBudgetPaidCents: welfarePaidCents,
    employeeSelfPaidCents: mealPaidCents,
    unitPrice: unitPriceCents / 100,
    totalAmount: payableCents / 100,
    corporateBudgetPaid: welfarePaidCents / 100,
    employeeSelfPaid: mealPaidCents / 100,
    status,
    isProblematic: status === '退款申请中' || status === '异常挂起',
    problemType: status === '退款申请中' ? 'REFUND_DISPUTE' : undefined,
    problemSummary: status === '退款申请中' ? '售后退款申请待处理' : undefined,
    slaDeadline: '由供应商履约系统计算',
    createdAtIso,
    createdAt,
    shippingAddress: '收货信息已脱敏',
    timeline: [
      { id: `${orderId}:created`, nodeName: '创建订单', timestamp: createdAt, status: 'success', operator: '系统', remark: '订单已在生产数据库创建。' },
      { id: `${orderId}:status`, nodeName: '当前状态', timestamp: dateText(raw.updatedAt), status: status === '异常挂起' ? 'warning' : 'success', operator: '系统', remark: `当前状态：${status}` },
    ],
    retryLogs: [],
    benefitsCard: { welfarePlanName: '企业福利账户', quotaUsed: welfarePaidCents / 100, remainingQuota: 0 },
    supplierId: 'not-exposed',
    supplierName: '供应商信息按订单权限展示',
  };
}
