export const ORDER_STATUS = {
  pendingPayment: 'pending_payment',
  paid: 'paid',
  processing: 'processing',
  pendingShipment: 'pending_shipment',
  shipped: 'shipped',
  pendingReceipt: 'pending_receipt',
  completed: 'completed',
  cancelled: 'cancelled',
  refundPending: 'refund_pending',
  refunded: 'refunded',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

/**
 * One display vocabulary for every client. Machine status codes are stored and
 * transmitted; a client may render this label but must never parse it back.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: '待付款',
  paid: '已支付',
  processing: '处理中',
  pending_shipment: '待发货',
  shipped: '已发货',
  pending_receipt: '待收货',
  completed: '已完成',
  cancelled: '已取消',
  refund_pending: '退款申请中',
  refunded: '已退款',
};

/** The order states that the administration query API currently exposes. */
export const ADMIN_ORDER_STATUS_VALUES = [
  ORDER_STATUS.pendingPayment,
  ORDER_STATUS.paid,
  ORDER_STATUS.processing,
  ORDER_STATUS.pendingShipment,
  ORDER_STATUS.shipped,
  ORDER_STATUS.pendingReceipt,
  ORDER_STATUS.completed,
  ORDER_STATUS.cancelled,
  ORDER_STATUS.refundPending,
  ORDER_STATUS.refunded,
] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUS_VALUES)[number];

export const ADMIN_ORDER_STATUS_OPTIONS = ADMIN_ORDER_STATUS_VALUES.map((value) => [value, ORDER_STATUS_LABELS[value]] as const);

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (Object.values(ORDER_STATUS) as string[]).includes(value);
}

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

export const PAYMENT_STATUS = {
  notStarted: 'not_started',
  pending: 'pending',
  paid: 'paid',
  closed: 'closed',
  failed: 'failed',
  refunded: 'refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export type WechatPaymentAttemptStatus = 'created' | 'prepay_ready' | 'prepay_failed' | 'processing' | 'succeeded' | 'closed' | 'failed';

/** Converts provider/storage detail into the one payment vocabulary exposed to every client. */
export function toPaymentStatus(attemptStatus: unknown, orderStatus?: unknown): PaymentStatus {
  if (orderStatus === ORDER_STATUS.refunded) return PAYMENT_STATUS.refunded;
  if (
    orderStatus === ORDER_STATUS.paid ||
    orderStatus === ORDER_STATUS.processing ||
    orderStatus === ORDER_STATUS.pendingShipment ||
    orderStatus === ORDER_STATUS.shipped ||
    orderStatus === ORDER_STATUS.pendingReceipt ||
    orderStatus === ORDER_STATUS.completed
  ) {
    return PAYMENT_STATUS.paid;
  }
  switch (attemptStatus) {
    case 'succeeded':
      return PAYMENT_STATUS.paid;
    case 'closed':
      return PAYMENT_STATUS.closed;
    case 'prepay_failed':
    case 'failed':
      return PAYMENT_STATUS.failed;
    case 'created':
    case 'prepay_ready':
    case 'processing':
      return PAYMENT_STATUS.pending;
    default:
      return PAYMENT_STATUS.notStarted;
  }
}

export interface OrderPaymentStatus {
  orderId: string;
  orderNo: string;
  orderStatus: OrderStatus;
  status: PaymentStatus;
  paidAt: string | null;
  providerTradeNo: string | null;
  totalCents: number;
  prepayExpiresAt: string | null;
  lastQueryAt: string | null;
}
