import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership, type Permission } from '@smart-wing/api-contract';
import { handleMallApplicationCenter, handleMallApplicationMutation } from './mallApplicationRoutes';
import { defaultMallApplicationConfig } from './mallApplicationModel';
import type { AuthorizationContext, WorkerEnv } from './types';

const env: WorkerEnv = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' };

function context(permissions: Permission[] = [PERMISSIONS.mallRead], target: Membership['target'] = 'admin'): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-admin',
    memberId: 'member-admin',
    target,
    status: 'active',
    roleIds: ['role-enterprise-manager'],
    permissions,
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
    scopeBindings: [{ kind: 'enterprise', resourceId: 'enterprise-a' }],
    expiresAt: null,
    authzVersion: 1,
  };
  return {
    tenantId: 'tenant-a',
    distributorId: null,
    enterpriseId: 'enterprise-a',
    mallId: 'mall-a',
    mallCode: 'MALL_A',
    userId: 'user-a',
    employeeNo: 'M001',
    roles: membership.roleIds,
    permissions,
    membership,
    stepUpAt: null,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('mall application routes', () => {
  it('returns only the server-scoped center with capability and frozen-rule metadata', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ malls: [{ id: 'mall-a', name: '示范商城' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const response = await handleMallApplicationCenter(new Request('https://smart.example/api/v1/admin/mall-applications'), env, context(), 'mall-center');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      malls: [{ id: 'mall-a', name: '示范商城' }],
      capabilities: { read: true, manage: false, decorate: false, publish: false },
      frozenRules: expect.arrayContaining(['会员码名称与安全语义']),
      requestId: 'mall-center',
    });
    expect(fetchRpc).toHaveBeenCalledOnce();
    expect(fetchRpc.mock.calls[0]?.[0]).toBe('https://supabase.example/rest/v1/rpc/api_mall_application_center');
  });

  it('blocks storefront identities before any database request', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handleMallApplicationCenter(new Request('https://smart.example/api/v1/admin/mall-applications'), env, context([PERMISSIONS.mallRead], 'storefront'), 'wrong-target');
    expect(response.status).toBe(403);
    expect(fetchRpc).not.toHaveBeenCalled();
  });

  it('requires an idempotency key before a page-configuration mutation', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handleMallApplicationMutation(
      new Request('https://smart.example/api/v1/admin/mall-applications/mall-a/draft', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRowVersion: 2, reason: '保存商城页面配置', config: defaultMallApplicationConfig() }),
      }),
      env,
      context([PERMISSIONS.mallDecorate]),
      'mall-a',
      'save',
      'missing-idempotency'
    );
    expect(response.status).toBe(400);
    expect(fetchRpc).not.toHaveBeenCalled();
  });

  it('passes a normalized, version-guarded save to the server-side mutation RPC', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ mallId: 'mall-a', rowVersion: 3, status: 'save' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const config = defaultMallApplicationConfig('示范商城');
    const response = await handleMallApplicationMutation(
      new Request('https://smart.example/api/v1/admin/mall-applications/mall-a/draft', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'mall-save-0001' },
        body: JSON.stringify({ expectedRowVersion: 2, reason: '保存商城页面配置', config }),
      }),
      env,
      context([PERMISSIONS.mallDecorate]),
      'mall-a',
      'save',
      'save-request'
    );
    expect(response.status).toBe(200);
    const request = fetchRpc.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      p_action: 'save',
      p_tenant_id: 'tenant-a',
      p_enterprise_id: 'enterprise-a',
      p_context_mall_id: 'mall-a',
      p_target_mall_id: 'mall-a',
      p_expected_row_version: 2,
      p_payload: config,
      p_reason: '保存商城页面配置',
      p_idempotency_key: 'mall-save-0001',
    });
  });
});
