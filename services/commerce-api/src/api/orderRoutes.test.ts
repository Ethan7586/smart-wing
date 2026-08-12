import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleCreateOrder, handleInternalPayment } from './orderRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

const env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  PII_ENCRYPTION_KEY: btoa('12345678901234567890123456789012'),
} satisfies WorkerEnv;

const authorization = {
  tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', mallCode: 'MALL',
  userId: 'user-one', employeeNo: 'E-001', roles: ['employee'], permissions: ['order.create'], stepUpAt: null,
  membership: {
    id: 'membership-one', memberId: 'member-one', target: 'storefront', status: 'active', roleIds: ['employee'],
    permissions: ['order.create'], deniedPermissions: [], expiresAt: null, authzVersion: 1,
    context: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', userId: 'user-one' },
    scopeBindings: [{ kind: 'self', resourceId: 'user-one' }],
  },
} satisfies AuthorizationContext;

afterEach(() => vi.unstubAllGlobals());

describe('phone assurance at order boundaries', () => {
  it('blocks order creation before inventory, PII, or order RPC work', async () => {
    const database = accountOnlyDatabase();
    vi.stubGlobal('fetch', database);
    const response = await handleCreateOrder(
      new Request('https://hbbtzn.com/api/v1/orders', { method: 'POST' }),
      env, authorization, 'unverified-order'
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PHONE_VERIFICATION_REQUIRED' } });
    expect(database).toHaveBeenCalledTimes(1);
    expect(String((database.mock.calls as unknown[][])[0]?.[0])).toContain('/rpc/api_member_assurance');
  });

  it('blocks internal payment before looking up the order or debiting an account', async () => {
    const database = accountOnlyDatabase();
    vi.stubGlobal('fetch', database);
    const response = await handleInternalPayment(
      new Request('https://hbbtzn.com/api/v1/orders/order-one/pay-internal', { method: 'POST' }),
      env, authorization, 'unverified-payment', 'unverified-payment'
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PHONE_VERIFICATION_REQUIRED' } });
    expect(database).toHaveBeenCalledTimes(1);
    expect(String((database.mock.calls as unknown[][])[0]?.[0])).toContain('/rpc/api_member_assurance');
  });
});

function accountOnlyDatabase() {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        level: 'account', accountAuthenticated: true, accountAuthenticatedAt: '2026-08-13T00:00:00Z',
        phoneVerified: false, phoneVerifiedAt: null, phoneVerificationMethod: null,
        paymentEligible: false, restrictedCapabilities: ['order.create', 'payment.execute'],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  );
}
