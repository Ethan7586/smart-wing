import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleQualificationCenter } from './qualificationAdminRoutes';
import type { AuthorizationContext } from './types';

function context(permissions: Membership['permissions'], target: Membership['target'] = 'admin'): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-admin',
    memberId: 'member-admin',
    target,
    status: 'active',
    roleIds: ['role-owner'],
    permissions,
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
    scopeBindings: [{ kind: 'mall', resourceId: 'mall-a' }],
    expiresAt: null,
    authzVersion: 1,
  };
  return {
    tenantId: 'tenant-a',
    enterpriseId: 'enterprise-a',
    mallId: 'mall-a',
    mallCode: 'MALL_A',
    userId: 'user-a',
    employeeNo: 'U001',
    roles: membership.roleIds,
    permissions,
    membership,
    stepUpAt: null,
  };
}

describe('qualification center read boundary', () => {
  it('rejects a storefront membership before querying', async () => {
    const response = await handleQualificationCenter(new Request('https://smart.example/api/v1/admin/qualification-center'), {}, context([PERMISSIONS.entitlementRead], 'storefront'), 'wrong-target');
    expect(response.status).toBe(403);
  });

  it('requires at least one dedicated read permission', async () => {
    const response = await handleQualificationCenter(new Request('https://smart.example/api/v1/admin/qualification-center'), {}, context([PERMISSIONS.catalogRead]), 'missing-permission');
    expect(response.status).toBe(403);
  });

  it('rejects a membership whose scope does not include the current mall', async () => {
    const authorization = context([PERMISSIONS.entitlementRead]);
    authorization.membership.scopeBindings = [{ kind: 'mall', resourceId: 'mall-other' }];
    const response = await handleQualificationCenter(new Request('https://smart.example/api/v1/admin/qualification-center'), {}, authorization, 'scope-mismatch');
    expect(response.status).toBe(403);
  });

  it('returns capabilities derived from the current membership', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ catalogPools: [], cityZones: [], policies: [], limitTemplates: [], commercialSummary: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    try {
      const response = await handleQualificationCenter(
        new Request('https://smart.example/api/v1/admin/qualification-center'),
        { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
        context([PERMISSIONS.entitlementRead, PERMISSIONS.purchaseLimitManage]),
        'qualified'
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        capabilities: {
          readEntitlements: true,
          manageEntitlements: false,
          readPurchaseLimits: false,
          managePurchaseLimits: true,
        },
      });
    } finally {
      fetchRpc.mockRestore();
    }
  });
});
