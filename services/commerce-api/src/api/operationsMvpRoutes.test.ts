import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import {
  handleControlCenter,
  handleControlSettings,
  handleCreateDistributionChannel,
  handleCreatePartnerCatalogConnection,
  handleDistributionHub,
  handlePartnerCatalogHub,
} from './operationsMvpRoutes';
import type { AuthorizationContext } from './types';

function context(permissions: Membership['permissions'], target: Membership['target'] = 'admin', stepUpAt: string | null = new Date().toISOString()): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-admin', memberId: 'member-admin', target, status: 'active', roleIds: ['role-owner'], permissions,
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
    scopeBindings: [{ kind: 'mall', resourceId: 'mall-a' }], expiresAt: null, authzVersion: 1,
  };
  return { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', mallCode: 'MALL_A', userId: 'user-a', employeeNo: 'U001', roles: membership.roleIds, permissions, membership, stepUpAt };
}

const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' };

describe('operations MVP read boundaries', () => {
  it('requires the real order and catalogue permissions for the control center', async () => {
    const missing = await handleControlCenter(new Request('https://smart.example/api/v1/admin/control-center'), {}, context([PERMISSIONS.orderRead]), 'control-missing');
    expect(missing.status).toBe(403);
    const storefront = await handleControlCenter(new Request('https://smart.example/api/v1/admin/control-center'), {}, context([PERMISSIONS.catalogRead, PERMISSIONS.orderRead], 'storefront'), 'control-storefront');
    expect(storefront.status).toBe(403);
  });

  it('returns only server-derived control facts and capabilities', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ sales: { paidOrderCount: 3 }, settings: { configured: false } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleControlCenter(new Request('https://smart.example/api/v1/admin/control-center'), env, context([PERMISSIONS.catalogRead, PERMISSIONS.orderRead]), 'control-read');
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ sales: { paidOrderCount: 3 }, capabilities: { canManageSettings: false } });
      expect(String(fetchRpc.mock.calls[0]?.[0])).toContain('api_admin_control_center');
    } finally { fetchRpc.mockRestore(); }
  });

  it('keeps distribution and partner-catalog reads behind their dedicated data permissions', async () => {
    const distribution = await handleDistributionHub(new Request('https://smart.example/api/v1/admin/distribution'), {}, context([PERMISSIONS.catalogRead]), 'distribution-denied');
    expect(distribution.status).toBe(403);
    const partner = await handlePartnerCatalogHub(new Request('https://smart.example/api/v1/admin/partner-catalog'), {}, context([PERMISSIONS.orderRead]), 'partner-denied');
    expect(partner.status).toBe(403);
  });
});

describe('operations MVP write boundaries', () => {
  it('requires tenant management and idempotency before persisting a control setting or channel', async () => {
    const control = await handleControlSettings(new Request('https://smart.example/api/v1/admin/control-center/settings', { method: 'PUT', body: JSON.stringify({ expectedVersion: 0, operationsNotice: '', orderAttentionThreshold: 0 }) }), {}, context([PERMISSIONS.catalogRead, PERMISSIONS.orderRead]), 'control-denied');
    expect(control.status).toBe(403);
    const channel = await handleCreateDistributionChannel(new Request('https://smart.example/api/v1/admin/distribution/channels', { method: 'POST', body: JSON.stringify({ code: 'NORTH_01', name: '华北渠道', distributorId: '', sourceReference: '' }) }), {}, context([PERMISSIONS.tenantManage]), 'channel-missing-key');
    expect(channel.status).toBe(400);
    await expect(channel.json()).resolves.toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
  });

  it('persists a channel only as server-owned pending setup metadata', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ id: 'channel-1', code: 'NORTH_01', name: '华北渠道', status: 'pending_setup' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleCreateDistributionChannel(
        new Request('https://smart.example/api/v1/admin/distribution/channels', { method: 'POST', headers: { 'idempotency-key': 'channel-key-001' }, body: JSON.stringify({ code: 'north_01', name: '华北渠道', distributorId: '', sourceReference: 'CONTRACT-1' }) }),
        env,
        context([PERMISSIONS.tenantManage]),
        'channel-create'
      );
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({ channel: { status: 'pending_setup' } });
      const rpcBody = JSON.parse(String(fetchRpc.mock.calls[0]?.[1]?.body));
      expect(rpcBody).toMatchObject({ p_tenant_id: 'tenant-a', p_mall_id: 'mall-a', p_code: 'NORTH_01', p_source_reference: 'CONTRACT-1' });
    } finally { fetchRpc.mockRestore(); }
  });

  it('does not allow an external partner connection to be declared active by the browser', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ id: 'partner-1', providerCode: 'partner', displayName: '甲方目录', status: 'pending_credentials' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleCreatePartnerCatalogConnection(
        new Request('https://smart.example/api/v1/admin/partner-catalog/connections', { method: 'POST', headers: { 'idempotency-key': 'partner-key-001' }, body: JSON.stringify({ providerCode: 'partner', displayName: '甲方目录', externalCatalogReference: 'CATALOG-1', status: 'active' }) }),
        env,
        context([PERMISSIONS.commercialResourceManage]),
        'partner-create'
      );
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({ connection: { status: 'pending_credentials' } });
      const rpcBody = JSON.parse(String(fetchRpc.mock.calls[0]?.[1]?.body));
      expect(rpcBody).not.toHaveProperty('p_status');
    } finally { fetchRpc.mockRestore(); }
  });
});
