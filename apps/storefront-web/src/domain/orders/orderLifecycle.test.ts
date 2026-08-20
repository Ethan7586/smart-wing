import { describe, expect, it } from 'vitest';
import { API_ORDER_STATUSES, canRequestAfterSale, mapApiOrderStatus, orderStatusLabel } from './orderLifecycle';

describe('order lifecycle contract', () => {
  it('maps every server status to the storefront status without losing cancellations or refunds', () => {
    expect(API_ORDER_STATUSES.map(mapApiOrderStatus)).toEqual(['pending_payment', 'pending_shipment', 'pending_shipment', 'pending_receipt', 'completed', 'cancelled', 'after_sale', 'refunded']);
  });

  it('only permits after-sale requests for fulfilled orders', () => {
    expect(canRequestAfterSale('pending_payment')).toBe(false);
    expect(canRequestAfterSale('pending_shipment')).toBe(true);
    expect(orderStatusLabel('refunded')).toBe('已退款');
  });
});
