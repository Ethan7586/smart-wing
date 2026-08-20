import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticateLocalMember } from './publicRoutes';
import { hashPassword } from './registrationSecurity';
import type { WorkerEnv } from './types';

afterEach(() => vi.unstubAllGlobals());

const env: WorkerEnv = {
  APP_ENV: 'production',
  AUTH_MODE: 'membership',
  SUPABASE_URL: 'https://database.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
};

function runtimeFor(target: 'storefront' | 'admin') {
  const isStorefront = target === 'storefront';
  return {
    id: isStorefront ? 'membership-storefront-for-membership-admin-1' : 'membership-admin-1',
    memberId: 'member-1',
    target,
    status: 'active',
    roleIds: [isStorefront ? 'role-employee' : 'role-admin'],
    permissions: isStorefront ? ['catalog.read', 'order.create', 'order.read'] : ['catalog.read', 'order.read', 'product.publish'],
    deniedPermissions: [],
    context: { tenantId: 'tenant-1', enterpriseId: 'enterprise-1', mallId: 'mall-1', userId: 'user-1' },
    scopeBindings: [{ kind: isStorefront ? 'self' : 'mall', resourceId: isStorefront ? 'user-1' : 'mall-1' }],
    expiresAt: null,
    authzVersion: 1,
    actor: { tenantId: 'tenant-1', enterpriseId: 'enterprise-1', mallId: 'mall-1', mallCode: 'MALL-1', userId: 'user-1', employeeNo: 'ADMIN-1' },
  };
}

describe('universal storefront access', () => {
  it('uses the same password for storefront-by-default and the explicit admin entrance', async () => {
    const passwordHash = await hashPassword('CorrectPassword2026');
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rpcName = String(input).split('/').at(-1);
      if (rpcName === 'api_local_login_candidate') {
        return new Response(
          JSON.stringify({
            memberId: 'member-1',
            membershipId: 'membership-storefront-for-membership-admin-1',
            target: 'storefront',
            passwordHash,
            entrances: [
              { target: 'storefront', membershipId: 'membership-storefront-for-membership-admin-1', runtime: runtimeFor('storefront') },
              { target: 'admin', membershipId: 'membership-admin-1', runtime: runtimeFor('admin') },
            ],
          }),
          { headers: { 'content-type': 'application/json' } }
        );
      }
      throw new Error(`unexpected RPC: ${rpcName}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const shopping = await authenticateLocalMember('admin.user', 'CorrectPassword2026', undefined, env);
    const operations = await authenticateLocalMember('admin.user', 'CorrectPassword2026', 'admin', env);

    expect(shopping.runtime?.membership).toMatchObject({ target: 'storefront', roleIds: ['role-employee'] });
    expect(shopping.runtime?.membership.scopeBindings).toEqual([{ kind: 'self', resourceId: 'user-1' }]);
    expect(operations.runtime?.membership).toMatchObject({ target: 'admin', roleIds: ['role-admin'] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
