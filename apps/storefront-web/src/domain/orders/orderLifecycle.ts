import type { OrderStatus } from '../../types';

/** Server statuses are intentionally mapped here once so PC, H5 and mini-program views cannot drift. */
export const API_ORDER_STATUSES = ['pending_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refund_pending', 'refunded'] as const;
export type ApiOrderStatus = (typeof API_ORDER_STATUSES)[number];

const STATUS_MAP: Record<ApiOrderStatus, OrderStatus> = {
  pending_payment: 'pending_payment',
  paid: 'pending_shipment',
  processing: 'pending_shipment',
  shipped: 'pending_receipt',
  completed: 'completed',
  cancelled: 'cancelled',
  refund_pending: 'after_sale',
  refunded: 'refunded',
};

const LABELS: Record<OrderStatus, string> = {
  pending_payment: '待付款',
  pending_shipment: '待发货',
  pending_receipt: '待收货',
  completed: '已完成',
  after_sale: '售后处理中',
  cancelled: '已取消',
  refunded: '已退款',
};

export function mapApiOrderStatus(status: string): OrderStatus {
  return STATUS_MAP[status as ApiOrderStatus] ?? 'pending_payment';
}

export function orderStatusLabel(status: OrderStatus): string {
  return LABELS[status];
}

export function canRequestAfterSale(status: OrderStatus): boolean {
  return status === 'pending_shipment' || status === 'pending_receipt' || status === 'completed';
}
