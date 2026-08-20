import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAdminOverview, loadLiveCatalog } from './catalog';

describe('live order time mapping', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the ISO timestamp separate from the Chinese display time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            authenticated: true,
            authorization: { target: 'admin', employeeNo: 'REG-TEST', roles: [] },
            products: [],
            orders: [
              {
                id: 'order-1',
                createdAt: '2026-08-08T11:20:00.000Z',
                updatedAt: '2026-08-08T12:20:00.000Z',
                payableCents: 12345,
                welfarePaidCents: 12000,
                mealPaidCents: 345,
                items: [{ priceCents: 12345 }],
              },
            ],
            summary: {},
          }),
          { status: 200 }
        )
      )
    );

    const overview = await loadAdminOverview();

    expect(overview.orders[0]).toMatchObject({
      createdAtIso: '2026-08-08T11:20:00.000Z',
      totalCents: 12345,
      corporateBudgetPaidCents: 12000,
      employeeSelfPaidCents: 345,
    });
    expect(overview.orders[0].createdAt).toMatch(/^2026\/8\/8/);
  });

  it('rejects an HTML SPA fallback instead of treating it as an empty catalogue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })));

    await expect(loadLiveCatalog()).rejects.toThrow('商品目录服务返回了非预期内容');
  });

  it('rejects a partial authenticated overview instead of fabricating empty business data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true, authorization: {} }), { status: 200 })));

    await expect(loadAdminOverview()).rejects.toThrow('运营概览服务返回了不完整的数据');
  });
});
