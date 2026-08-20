import { describe, expect, it, vi } from 'vitest';
import { buildOrderQuery, DEFAULT_ORDER_FILTERS, formatCents, legacyOrderPage, loadOrderPage, ORDER_STATUS_OPTIONS } from './orders';
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

  it('does not throw or silently widen a malformed date filter', () => {
    const query = buildOrderQuery({ ...DEFAULT_ORDER_FILTERS, createdFrom: 'not-a-date' });
    expect(query).toContain('createdFrom=not-a-date');
  });

  it('uses the shared completed status vocabulary', () => {
    expect(ORDER_STATUS_OPTIONS.find(([status]) => status === 'completed')).toEqual(['completed', '已完成']);
  });

  it('calculates pagination boundaries without an off-by-one error', () => {
    expect(pageWindow(101, 20, 100)).toEqual({ page: 6, pageCount: 6, first: 101, last: 101 });
    expect(pageWindow(0, 20, 0)).toEqual({ page: 1, pageCount: 1, first: 0, last: 0 });
  });

  it('does not present a paid stock-conflict order as a cancelled refund', () => {
    const page = legacyOrderPage(INITIAL_ORDERS, { ...DEFAULT_ORDER_FILTERS, limit: 20 });
    expect(page.items.find((order) => order.orderNo === 'ORD-20260808-001')).toMatchObject({
      status: 'refund_pending',
      payableCents: 199000,
      paidCents: 199000,
      welfarePaidCents: 199000,
      mealPaidCents: 0,
    });
  });

  it('keeps product lines and total unit quantity as separate facts', () => {
    const page = legacyOrderPage(INITIAL_ORDERS, { ...DEFAULT_ORDER_FILTERS, limit: 20 });
    expect(page.items.find((order) => order.orderNo === 'ORD-20260808-001')).toMatchObject({ lineCount: 1, itemCount: 10 });
  });

  it('rejects an order page that is JSON but omits the required line count', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'o1',
              orderNo: 'ORD-1',
              status: 'paid',
              payableCents: 100,
              paidCents: 100,
              welfarePaidCents: 0,
              mealPaidCents: 0,
              itemCount: 1,
              firstProductName: '礼品',
              supplierNames: [],
              createdAt: '2026-08-19T00:00:00Z',
              updatedAt: '2026-08-19T00:00:00Z',
            },
          ],
          total: 1,
        })
      )
    );
    await expect(loadOrderPage(DEFAULT_ORDER_FILTERS)).rejects.toThrow('订单查询服务返回了不完整的数据');
    fetchMock.mockRestore();
  });

  it('keeps a legacy zero-line order readable instead of rejecting the full page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'o-archived-lines',
              orderNo: 'ORD-ARCHIVED-LINES',
              status: 'completed',
              payableCents: 100,
              paidCents: 100,
              welfarePaidCents: 0,
              mealPaidCents: 0,
              lineCount: 0,
              itemCount: 1,
              firstProductName: '已归档商品',
              supplierNames: [],
              createdAt: '2026-08-19T00:00:00Z',
              updatedAt: '2026-08-19T00:00:00Z',
            },
          ],
          total: 1,
        })
      )
    );

    await expect(loadOrderPage(DEFAULT_ORDER_FILTERS)).resolves.toMatchObject({
      items: [{ orderNo: 'ORD-ARCHIVED-LINES', lineCount: 0 }],
      total: 1,
    });
    fetchMock.mockRestore();
  });
});
