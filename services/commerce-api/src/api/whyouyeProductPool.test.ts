import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleWhyouyeIntegrationStatus, handleWhyouyeJdVopPoolEnroll, handleWhyouyeProductPoolEnroll } from './whyouyeProductPool';
import type { AuthorizationContext, WorkerEnv } from './types';

function context(withPublishPermission = true): AuthorizationContext {
  const permissions = withPublishPermission ? [PERMISSIONS.productPublish] : [];
  const membership: Membership = {
    id: 'membership-admin',
    memberId: 'member-fubao',
    target: 'admin',
    status: 'active',
    roleIds: ['role-mall-admin'],
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

afterEach(() => vi.unstubAllGlobals());

describe('whyouye product-pool write adapter', () => {
  it('previews the verified general pool payload without calling the partner', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleWhyouyeProductPoolEnroll(
      new Request('https://smart.example/api/v1/admin/integrations/whyouye/pool-enroll', {
        method: 'POST',
        body: JSON.stringify({ source: 104, remoteProductIds: ['S120403035'] }),
      }),
      {},
      context(),
      'pool-preview',
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mode: 'preview',
      endpoint: '/ybt-backend/product/siteproduct/orgBatchPrePick',
      payload: { source: 104, productIds: 'S120403035', priceType: 'supplyPrice' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires an explicit external-write confirmation before committing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleWhyouyeProductPoolEnroll(
      new Request('https://smart.example/api/v1/admin/integrations/whyouye/pool-enroll', {
        method: 'POST',
        body: JSON.stringify({ mode: 'commit', source: 1, remoteProductIds: ['100156506399'] }),
      }),
      { WHYOUYE_API_TOKEN: 'test-token', WHYOUYE_ORG_ID: 'org-a', WHYOUYE_SITE_ID: 'site-a' },
      context(),
      'pool-confirmation-required',
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'EXTERNAL_WRITE_CONFIRMATION_REQUIRED' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('includes an explicit target site and listing choice only when supplied', async () => {
    const response = await handleWhyouyeProductPoolEnroll(
      new Request('https://smart.example/api/v1/admin/integrations/whyouye/pool-enroll', {
        method: 'POST',
        body: JSON.stringify({ source: 104, remoteProductIds: ['S120403035'], targetSiteIds: ['site-a'], operStatus: 3 }),
      }),
      {},
      context(),
      'pool-site-target-preview',
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ payload: { siteIds: 'site-a', operStatus: 3 } });
  });

  it('reports readiness without exposing partner credentials', async () => {
    const response = handleWhyouyeIntegrationStatus(
      new Request('https://smart.example/api/v1/admin/integrations/whyouye/status'),
      { WHYOUYE_API_TOKEN: 'test-token', WHYOUYE_ORG_ID: 'org-a', WHYOUYE_SITE_ID: 'site-a' },
      context(),
      'pool-status',
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      capabilities: { generalPoolEnroll: true, jdVopPoolEnroll: false, catalogRead: false, arbitraryProductCreate: false },
      externalWritePolicy: 'explicit-confirmation',
    });
  });

  it('posts the exact JD VOP enrolment shape only on a confirmed commit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0, msg: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env: WorkerEnv = {
      WHYOUYE_API_TOKEN: 'test-token',
      WHYOUYE_ORG_ID: 'org-a',
      WHYOUYE_SITE_ID: 'site-a',
      WHYOUYE_ACCOUNT_CODE: 'account-a',
    };
    const response = await handleWhyouyeJdVopPoolEnroll(
      new Request('https://smart.example/api/v1/admin/integrations/whyouye/jd-vop-pool-enroll', {
        method: 'POST',
        headers: { 'x-confirm-external-write': 'commit' },
        body: JSON.stringify({ mode: 'commit', remoteProductIds: ['100156506399'], targetPool: 'standard' }),
      }),
      env,
      context(),
      'jd-vop-commit',
    );
    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://mall.whyouye.com/ybt-backend/api/vop/product/addToPool');
    expect(init.headers).toMatchObject({ token: 'test-token.org-a.site-a' });
    expect(JSON.parse(String(init.body))).toEqual({ productIds: ['100156506399'], targetPool: 'standard', accountCode: 'account-a' });
  });

  it('rejects a caller without product publishing permission before any partner request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleWhyouyeJdVopPoolEnroll(
      new Request('https://smart.example/api/v1/admin/integrations/whyouye/jd-vop-pool-enroll', {
        method: 'POST',
        body: JSON.stringify({ remoteProductIds: ['100156506399'], targetPool: 'standard' }),
      }),
      {},
      context(false),
      'permission-denied',
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
