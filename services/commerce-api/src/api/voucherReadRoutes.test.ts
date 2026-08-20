import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@smart-wing/api-contract';
import { handleAdminVoucherAudit, handleAdminVoucherDetail, handleAdminVoucherOverview, handleAdminVoucherVoidHolds, handleAdminVouchers } from './voucherReadRoutes';
import type { AuthorizationContext } from './types';
import { context, contextWithPermissions } from './voucherTestSupport';

const { callRpcMock, sha256Mock } = vi.hoisted(() => ({ callRpcMock: vi.fn(), sha256Mock: vi.fn() }));

vi.mock('./supabase', () => ({ callRpc: callRpcMock }));
vi.mock('./crypto', () => ({ sha256: sha256Mock }));

describe('admin voucher read routes', () => {
  it('allows audit records only to an explicitly authorized, scoped auditor', async () => {
    callRpcMock.mockReset();
    const noAuditResponse = await handleAdminVoucherAudit(new Request('https://smart.example/api/v1/admin/voucher-audit'), {}, context(), 'voucher-audit-denied');
    expect(noAuditResponse.status).toBe(403);
    expect(callRpcMock).not.toHaveBeenCalled();

    callRpcMock.mockResolvedValueOnce([{ id: 'audit-1', action: 'voucher.redeemed', request_id: 'request-1' }]);
    const response = await handleAdminVoucherAudit(new Request('https://smart.example/api/v1/admin/voucher-audit?limit=20&offset=5'), {}, contextWithPermissions([PERMISSIONS.voucherAuditRead]), 'voucher-audit-live');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ dataSource: 'live', data: { items: [{ id: 'audit-1' }], limit: 20, offset: 5 } });
    expect(callRpcMock).toHaveBeenCalledWith({}, 'api_voucher_audit_scoped', { p_membership_id: 'membership-voucher-admin', p_limit: 20, p_offset: 5 });
  });

  it('shows a scoped void-balance worklist to finance without consuming a step-up session', async () => {
    callRpcMock.mockReset();
    callRpcMock.mockResolvedValueOnce([{ id: 'hold-a', voucher_code: 'SWV-A', status: 'open' }]);
    const response = await handleAdminVoucherVoidHolds(new Request('https://smart.example/api/v1/admin/voucher-void-holds?limit=20&offset=5'), {}, contextWithPermissions([PERMISSIONS.voucherReconcile]), 'voucher-void-holds-live');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ dataSource: 'live', data: { items: [{ id: 'hold-a' }], limit: 20, offset: 5 } });
    expect(callRpcMock).toHaveBeenCalledWith({}, 'api_voucher_void_holds_scoped', { p_membership_id: 'membership-voucher-admin', p_limit: 20, p_offset: 5 });
  });

  it('rejects void-balance worklist access before querying data without reconciliation permission', async () => {
    callRpcMock.mockReset();
    const response = await handleAdminVoucherVoidHolds(new Request('https://smart.example/api/v1/admin/voucher-void-holds'), {}, context(), 'voucher-void-holds-denied');
    expect(response.status).toBe(403);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('rejects overview requests before querying data when voucher read permission is absent', async () => {
    callRpcMock.mockReset();
    const authorization = context({ permissions: [], membership: { ...context().membership, permissions: [] } });
    const response = await handleAdminVoucherOverview(new Request('https://smart.example/api/v1/admin/vouchers/overview'), {}, authorization, 'voucher-overview-denied');
    expect(response.status).toBe(403);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('returns a marked live payload scoped to the resolved membership', async () => {
    callRpcMock.mockReset();
    callRpcMock.mockResolvedValueOnce({ activeVoucherCount: 3, remainingValueCents: 90000 });
    const response = await handleAdminVoucherOverview(new Request('https://smart.example/api/v1/admin/vouchers/overview'), {}, context(), 'voucher-overview-live');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ dataSource: 'live', data: { activeVoucherCount: 3 }, requestId: 'voucher-overview-live' });
    expect(callRpcMock).toHaveBeenCalledWith({}, 'api_voucher_overview_scoped', { p_membership_id: 'membership-voucher-admin' });
  });

  it('rejects an invalid status filter before querying data', async () => {
    callRpcMock.mockReset();
    const response = await handleAdminVouchers(new Request('https://smart.example/api/v1/admin/vouchers?status=anything'), {}, context(), 'voucher-filter-invalid');
    expect(response.status).toBe(422);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('refuses a voucher from another tenant after loading its server-side resource scope', async () => {
    callRpcMock.mockReset();
    callRpcMock.mockResolvedValueOnce({ tenant_id: 'tenant-b', enterprise_id: 'enterprise-b', mall_id: 'mall-b' });
    const response = await handleAdminVoucherDetail(new Request('https://smart.example/api/v1/admin/vouchers/voucher-b'), {}, context(), 'voucher-b', 'voucher-cross-tenant');
    expect(response.status).toBe(403);
    expect(callRpcMock).toHaveBeenCalledTimes(1);
    expect(callRpcMock).toHaveBeenCalledWith({}, 'api_voucher_authorization_scope', { p_voucher_id: 'voucher-b' });
  });
});
