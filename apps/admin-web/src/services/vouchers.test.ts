import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLiveVoucherOverview } from './vouchers';

describe('live voucher reads', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects an HTML SPA fallback before it reaches a voucher workstation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })));

    await expect(loadLiveVoucherOverview()).rejects.toThrow('卡券服务返回了非预期内容');
  });
});
