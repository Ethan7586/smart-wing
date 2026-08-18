import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleAdminOrderExport, handleAdminOrderPage, toCsv } from './adminOrderRoutes';
import { callRpc } from './supabase';
import type { AuthorizationContext } from './types';

vi.mock('./supabase', () => ({ callRpc: vi.fn() }));

function context(permissions = [PERMISSIONS.orderRead]): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-a',
    memberId: 'member-a',
    target: 'admin',
    status: 'active',
    roleIds: ['role-a'],
    permissions,
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
    scopeBindings: [{ kind: 'mall', resourceId: 'mall-a' }],
    expiresAt: null,
    authzVersion: 1,
  };
  return { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', mallCode: 'MALL_A', userId: 'user-a', employeeNo: 'U001', roles: ['role-a'], permissions, membership, stepUpAt: new Date().toISOString() };
}

describe('admin order management routes', () => {
  it('rejects a principal without order.read before querying data', async () => {
    const response = await handleAdminOrderPage(new Request('https://smart.example/api/v1/admin/orders'), {}, context([]), 'denied');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('rejects an unknown order status with 422', async () => {
    const response = await handleAdminOrderPage(new Request('https://smart.example/api/v1/admin/orders?status=unrecognized'), {}, context(), 'bad-status');
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_STATUS' } });
  });

  it('writes a UTF-8 BOM before a successful CSV export', async () => {
    vi.mocked(callRpc)
      .mockResolvedValueOnce([
        { orderNo: 'SW1', firstProductName: '福利礼包', itemCount: 1, payableCents: 100, paidCents: 100, welfarePaidCents: 100, mealPaidCents: 0, supplierNames: ['供应商'], status: 'paid', createdAt: '2026-08-18T00:00:00Z' },
      ])
      .mockResolvedValueOnce(undefined);
    const response = await handleAdminOrderExport(new Request('https://smart.example/api/v1/admin/orders/export'), {}, context(), 'csv-ok');
    expect(response.status).toBe(200);
    expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('records an over-limit export attempt before refusing it', async () => {
    vi.mocked(callRpc).mockReset();
    vi.mocked(callRpc).mockResolvedValueOnce(Array.from({ length: 5001 }, () => ({ orderNo: 'SW1' })));
    const response = await handleAdminOrderExport(new Request('https://smart.example/api/v1/admin/orders/export'), {}, context(), 'too-large');
    expect(response.status).toBe(413);
    expect(callRpc).toHaveBeenCalledTimes(2);
    expect(vi.mocked(callRpc).mock.calls[1]?.[2]).toMatchObject({ p_row_count: 5001, p_filters: { outcome: 'rejected_too_large' } });
  });

  it('escapes spreadsheet formulas and formats cent values in CSV', () => {
    const output = toCsv('orders', [{ orderNo: '=unsafe', firstProductName: '礼品', itemCount: 1, payableCents: 1234, paidCents: 0, welfarePaidCents: 0, mealPaidCents: 0, supplierNames: [], status: 'paid', createdAt: '2026-08-18' }]);
    expect(output).toContain("'=unsafe");
    expect(output).toContain('12.34');
  });

  it('prevents an order export from being cached or content-sniffed', async () => {
    vi.mocked(callRpc).mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);
    const response = await handleAdminOrderExport(new Request('https://smart.example/api/v1/admin/orders/export'), {}, context(), 'csv-headers');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toBe('csv-headers');
  });
});
