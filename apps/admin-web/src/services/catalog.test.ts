import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAdminOverview } from './catalog';

describe('live order time mapping', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the ISO timestamp separate from the Chinese display time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            authenticated: true,
            orders: [{ id: 'order-1', createdAt: '2026-08-08T11:20:00.000Z', updatedAt: '2026-08-08T12:20:00.000Z', items: [] }],
            summary: {},
          }),
          { status: 200 }
        )
      )
    );

    const overview = await loadAdminOverview();

    expect(overview.orders[0]).toMatchObject({ createdAtIso: '2026-08-08T11:20:00.000Z' });
    expect(overview.orders[0].createdAt).toMatch(/^2026\/8\/8/);
  });
});
