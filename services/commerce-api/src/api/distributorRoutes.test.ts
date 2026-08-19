import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership, type Permission, type ScopeBinding } from '@smart-wing/api-contract';
import { handleDistributorCenter, handlePlatformDistributorAttachment, handlePlatformDistributors } from './distributorRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

const env: WorkerEnv = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' };

function context(
  options: {
    permissions?: Permission[];
    scopes?: ScopeBinding[];
    distributorId?: string | null;
    stepUpAt?: string | null;
    target?: Membership['target'];
  } = {}
): AuthorizationContext {
  const permissions = options.permissions ?? [PERMISSIONS.distributorRead];
  const scopes = options.scopes ?? [{ kind: 'tenant', resourceId: 'tenant-a' }];
  const membership: Membership = {
    id: 'membership-admin',
    memberId: 'member-admin',
    target: options.target ?? 'admin',
    status: 'active',
    roleIds: ['role-admin'],
    permissions,
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
    scopeBindings: scopes,
    expiresAt: null,
    authzVersion: 1,
  };
  return {
    tenantId: 'tenant-a',
    distributorId: options.distributorId ?? null,
    enterpriseId: 'enterprise-a',
    mallId: 'mall-a',
    mallCode: 'MALL_A',
    userId: 'user-a',
    employeeNo: 'A001',
    roles: membership.roleIds,
    permissions,
    membership,
    stepUpAt: options.stepUpAt ?? null,
  };
}

function successfulRpc(value: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(value), { status: 200 }));
}

afterEach(() => vi.restoreAllMocks());

describe('platform distributor provisioning', () => {
  it('rejects non-platform identities before a database request', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handlePlatformDistributors(new Request('https://smart.example/api/v1/admin/distributors'), env, context(), 'not-platform');
    expect(response.status).toBe(403);
    expect(fetchRpc).not.toHaveBeenCalled();
  });

  it('requires recent step-up for a critical create operation', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handlePlatformDistributors(
      new Request('https://smart.example/api/v1/admin/distributors', {
        method: 'POST',
        headers: { 'idempotency-key': 'create-distributor-1' },
        body: '{}',
      }),
      env,
      context({
        permissions: [PERMISSIONS.distributorManage],
        scopes: [{ kind: 'platform', resourceId: 'org-platform' }],
      }),
      'step-up'
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STEP_UP_REQUIRED' } });
    expect(fetchRpc).not.toHaveBeenCalled();
  });

  it('sends only server-resolved actor identity to the create RPC', async () => {
    const fetchRpc = successfulRpc({ distributor: { id: 'distributor-a', code: 'north-a' } });
    const response = await handlePlatformDistributors(
      new Request('https://smart.example/api/v1/admin/distributors', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'create-distributor-2' },
        body: JSON.stringify({ code: 'North-A', name: '华北合作商', reason: '新增华北区域合作商' }),
      }),
      env,
      context({
        permissions: [PERMISSIONS.distributorManage],
        scopes: [{ kind: 'platform', resourceId: 'org-platform' }],
        stepUpAt: new Date().toISOString(),
      }),
      'create-ok'
    );
    expect(response.status).toBe(201);
    const body = JSON.parse(String((fetchRpc.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toMatchObject({
      p_actor_membership_id: 'membership-admin',
      p_actor_user_id: 'user-a',
      p_code: 'north-a',
      p_name: '华北合作商',
      p_settlement_mode: 'manual',
    });
    expect(body).not.toHaveProperty('p_tenant_id');
    expect(body).not.toHaveProperty('p_distributor_id');
  });

  it('attaches a tenant through a critical, idempotent platform RPC', async () => {
    const fetchRpc = successfulRpc({ attachment: { distributorId: 'distributor-a', tenantId: 'tenant-b' } });
    const response = await handlePlatformDistributorAttachment(
      new Request('https://smart.example/api/v1/admin/distributors/distributor-a/tenants', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'attach-tenant-0001' },
        body: JSON.stringify({ tenantId: 'tenant-b', reason: '签署渠道合作协议' }),
      }),
      env,
      context({
        permissions: [PERMISSIONS.distributorTenantAttach],
        scopes: [
          { kind: 'platform', resourceId: 'org-platform' },
          { kind: 'tenant', resourceId: 'tenant-a' },
        ],
        stepUpAt: new Date().toISOString(),
      }),
      'distributor-a',
      'attach-ok'
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(String((fetchRpc.mock.calls[0]?.[1] as RequestInit).body))).toMatchObject({
      p_distributor_id: 'distributor-a',
      p_tenant_id: 'tenant-b',
      p_actor_membership_id: 'membership-admin',
    });
  });
});

describe('distributor aggregate reads', () => {
  it('derives distributor scope from the authenticated membership', async () => {
    const fetchRpc = successfulRpc({
      overview: { tenantCount: 2, currentMonthGmvCents: 480000 },
      tenants: [],
      metricDefinition: { timezone: 'Asia/Shanghai' },
    });
    const response = await handleDistributorCenter(
      new Request('https://smart.example/api/v1/distributor/overview'),
      env,
      context({
        distributorId: 'distributor-a',
        scopes: [{ kind: 'distributor', resourceId: 'distributor-a' }],
      }),
      'overview',
      'overview-ok'
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(String((fetchRpc.mock.calls[0]?.[1] as RequestInit).body))).toMatchObject({
      p_distributor_id: 'distributor-a',
      p_tenant_id: null,
    });
  });

  it('fails closed when the session has no unambiguous distributor scope', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handleDistributorCenter(new Request('https://smart.example/api/v1/distributor/tenants'), env, context(), 'tenants', 'no-scope');
    expect(response.status).toBe(403);
    expect(fetchRpc).not.toHaveBeenCalled();
  });

  it('returns aggregate tenant data without member, phone, address or recipient fields', async () => {
    successfulRpc({
      overview: { tenantCount: 1 },
      tenants: [{ id: 'tenant-b', name: '测试企业', activeMallCount: 1, currentMonthOrderCount: 3, currentMonthGmvCents: 90000 }],
      metricDefinition: { gmv: '实付减成功退款' },
    });
    const response = await handleDistributorCenter(
      new Request('https://smart.example/api/v1/distributor/tenants'),
      env,
      context({ distributorId: 'distributor-a', scopes: [{ kind: 'distributor', resourceId: 'distributor-a' }] }),
      'tenants',
      'privacy'
    );
    const payload = JSON.stringify(await response.json()).toLowerCase();
    for (const forbidden of ['member', 'phone', 'address', 'recipient']) expect(payload).not.toContain(forbidden);
  });
});

describe('distributor migration guardrails', () => {
  const migration = readFileSync(resolve(process.cwd(), '../../database/supabase/migrations/20260819160000_distributor_channel_foundation.sql'), 'utf8');

  it('atomically moves the tenant node and verifies the rebuilt closure path', () => {
    expect(migration).toContain('update public.org_units set parent_id = v_distributor.org_unit_id');
    expect(migration).toContain('DISTRIBUTOR_HIERARCHY_REBUILD_FAILED');
    expect(migration).toContain('distributor_tenants_one_active_owner');
  });

  it('keeps aggregate reads in SQL and uses net paid GMV', () => {
    expect(migration).toContain("refund.status = 'succeeded'");
    expect(migration).toContain('orders.paid_at >= v_month_start');
    expect(migration).toContain("'pendingCommission', jsonb_build_object('status', 'notProvisioned')");
  });
});
