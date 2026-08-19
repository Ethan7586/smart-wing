import { describe, expect, it } from 'vitest';
import { buildOrderQuery, DEFAULT_ORDER_FILTERS, formatCents, legacyOrderPage } from './orders';
import { INITIAL_ORDERS } from '../data/mockData';
import { pageWindow } from '../components/workstations/order/Pagination';

describe('order management presentation helpers', () => {
  it('converts all amount edge cases from cents', () => {
    expect(formatCents(0)).toBe('¥0.00');
    expect(formatCents(-1234)).toBe('¥-12.34');
    expect(formatCents(123456789)).toBe('¥1,234,567.89');
  });

  it('creates a query string from visible filters', () => {
    const query = buildOrderQuery({ ...DEFAULT_ORDER_FILTERS, keyword: 'SW2026', status: 'paid', createdFrom: '2026-08-01', createdTo: '2026-08-18', limit: 50, offset: 100 });
    expect(query).toContain('keyword=SW2026');
    expect(query).toContain('status=paid');
    expect(query).toContain('limit=50');
    expect(query).toContain('offset=100');
  });

  it('calculates pagination boundaries without an off-by-one error', () => {
    expect(pageWindow(101, 20, 100)).toEqual({ page: 6, pageCount: 6, first: 101, last: 101 });
    expect(pageWindow(0, 20, 0)).toEqual({ page: 1, pageCount: 1, first: 0, last: 0 });
  });

  it('does not present a paid stock-conflict order as a cancelled refund', () => {
    const page = legacyOrderPage(INITIAL_ORDERS, { ...DEFAULT_ORDER_FILTERS, limit: 20 });
    expect(page.items.find((order) => order.orderNo === 'ORD-20260808-001')).toMatchObject({ status: 'refund_pending', paidCents: 199000 });
  });
});
