import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleHealth, handleLogin, handleReadiness, handleRegisteredCredentialDiscovery } from './publicRoutes';
import { hashPassword } from './registrationSecurity';
import type { WorkerEnv } from './types';
afterEach(() => vi.unstubAllGlobals());

describe('health and readiness endpoints', () => {
  it('keeps the liveness probe fast and independent of database access', async () => {
    const env: WorkerEnv = {
      APP_ENV: 'production',
      AUTH_MODE: 'membership',
      SUPABASE_REGION: 'ap-southeast-1',
      SESSION_SIGNING_KEY: 'storefront-test-key-that-is-longer-than-32-bytes',
      ADMIN_SESSION_SIGNING_KEY: 'admin-test-key-that-is-longer-than-32-bytes',
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleHealth(new Request('https://mall.example/api/health'), { ...env, SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' }, 'health-request');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('health-request');
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      probe: 'liveness',
      checks: { authentication: 'mvp_session_ready', piiEncryption: 'required_for_orders' },
      database: { region: 'ap-southeast-1' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the database check on the explicit readiness probe', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ databaseReady: true, tableCount: 27 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleReadiness(
      new Request('https://mall.example/api/ready'),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SUPABASE_REGION: 'ap-northeast-1',
        SESSION_SIGNING_KEY: 'storefront-test-key-that-is-longer-than-32-bytes',
        ADMIN_SESSION_SIGNING_KEY: 'admin-test-key-that-is-longer-than-32-bytes',
        PII_ENCRYPTION_KEY: 'a'.repeat(32),
      },
      'ready-request'
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      probe: 'readiness',
      checks: { database: 'ready', authentication: 'mvp_session_ready', piiEncryption: 'configured' },
      database: { region: 'ap-northeast-1', tableCount: 27 },
    });
  });

  it('rejects methods other than GET', async () => {
    const response = await handleHealth(new Request('https://mall.example/api/health', { method: 'POST' }), {}, 'health-request');

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('rejects demo credential login in production before any database access', async () => {
    const response = await handleLogin(
      new Request('https://hbbtzn.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'onewr', password: '123456' }),
      }),
      { APP_ENV: 'production', AUTH_MODE: 'production' },
      'production-login-request'
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AUTH_PROVIDER_NOT_CONFIGURED', requestId: 'production-login-request' },
    });
  });

  it('authenticates a registered phone against the real credential hash and membership', async () => {
    const passwordHash = await hashPassword('SmartWing2026');
    const responses = [
      true,
      { memberId: 'member-new', membershipId: 'membership-new', target: 'storefront', passwordHash },
      {
        id: 'membership-new',
        memberId: 'member-new',
        target: 'storefront',
        status: 'active',
        roleIds: ['role-employee'],
        permissions: ['catalog.read'],
        deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-new' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-new' }],
        expiresAt: null,
        authzVersion: 1,
        actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: 'user-new', employeeNo: 'REG-NEW' },
      },
      true,
      true,
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }))
    );
    const response = await handleLogin(
      new Request('https://hbbtzn.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.8' },
        body: JSON.stringify({ username: '13800138000', password: 'SmartWing2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
        IDENTITY_LOOKUP_KEY: 'identity-key-that-is-longer-than-thirty-two-bytes',
      },
      'registered-login'
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('__Host-hbbtzn_store_session=');
    await expect(response.json()).resolves.toMatchObject({ authenticated: true, authorization: { membershipId: 'membership-new', target: 'storefront' } });
  });

  it('authenticates a registered username through the local username alias', async () => {
    const passwordHash = await hashPassword('SmartWing2026');
    const responses = [
      true,
      { memberId: 'member-username', membershipId: 'membership-username', target: 'storefront', passwordHash },
      {
        id: 'membership-username',
        memberId: 'member-username',
        target: 'storefront',
        status: 'active',
        roleIds: ['role-employee'],
        permissions: ['catalog.read'],
        deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-username' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-username' }],
        expiresAt: null,
        authzVersion: 1,
        actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: 'user-username', employeeNo: 'REG-USERNAME' },
      },
      true,
      true,
    ];
    const fetchMock = vi.fn(async (_input: unknown, _init?: unknown) => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleLogin(
      new Request('https://hbbtzn.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.18' },
        body: JSON.stringify({ username: 'New.Employee', password: 'SmartWing2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
      },
      'username-login'
    );

    expect(response.status).toBe(200);
    const calls = fetchMock.mock.calls as unknown as Array<[unknown, { body?: unknown }?]>;
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toMatchObject({ p_provider: 'local_username', p_subject: 'new.employee' });
    await expect(response.json()).resolves.toMatchObject({ authenticated: true, authorization: { membershipId: 'membership-username' } });
  });

  it('does not restore the old demo password after a test account changes its password', async () => {
    const passwordHash = await hashPassword('ChangedBuyer2026');
    const responses = [
      true,
      {
        memberId: 'member-test-buyer-001',
        membershipId: 'membership-test-buyer-001',
        target: 'storefront',
        passwordHash,
      },
      null,
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleLogin(
      new Request('https://hbbtzn.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9' },
        body: JSON.stringify({ username: 'buyer001', password: '123456' }),
      }),
      {
        APP_ENV: 'test',
        AUTH_MODE: 'test',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
      },
      'changed-test-password'
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_USERNAME_PASSWORD' } });
  });

  it('rate-limits credential discovery before verifying a registered password', async () => {
    const fetchMock = vi.fn(async () => new Response('false', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleRegisteredCredentialDiscovery(
      new Request('https://hbbtzn.com/api/v1/auth/credential/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.10' },
        body: JSON.stringify({ username: '13800138000', password: 'WrongPassword2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
        IDENTITY_LOOKUP_KEY: 'identity-key-that-is-longer-than-thirty-two-bytes',
      },
      'credential-discovery'
    );
    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns only the verified member\'s active storefront and admin choices before a session is created', async () => {
    const passwordHash = await hashPassword('SmartWing2026');
    const runtime = {
      id: 'membership-storefront-ethan',
      memberId: 'member-ethan',
      target: 'storefront',
      status: 'active',
      roleIds: ['role-employee'],
      permissions: ['catalog.read'],
      deniedPermissions: [],
      context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-ethan' },
      scopeBindings: [{ kind: 'self', resourceId: 'user-ethan' }],
      expiresAt: null,
      authzVersion: 1,
      actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: 'user-ethan', employeeNo: 'ETHAN' },
    };
    const selectable = [
      { id: 'membership-storefront-ethan', target: 'storefront', status: 'active', enterpriseName: '示范企业', storeName: '智慧翼企业福利商城', roleName: '员工会员', dataScope: '个人福利账户', accountTypeLabel: '福利账户' },
      { id: 'membership-platform-owner-ethan-v1', target: 'admin', status: 'active', enterpriseName: '智慧翼福利平台', storeName: '智慧翼平台运营后台', roleName: '平台业主', dataScope: '平台级全部授权范围', subjectScope: '平台' },
    ];
    const responses = [
      true,
      { memberId: 'member-ethan', membershipId: 'membership-storefront-ethan', target: 'storefront', passwordHash },
      runtime,
      true,
      selectable,
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleRegisteredCredentialDiscovery(
      new Request('https://hbbtzn.com/api/v1/auth/credential/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.56' },
        body: JSON.stringify({ username: 'ethan', password: 'SmartWing2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
      },
      'ethan-discovery'
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      memberships: [
        { id: 'membership-storefront-ethan', target: 'storefront' },
        { id: 'membership-platform-owner-ethan-v1', target: 'admin', subjectScope: '平台' },
      ],
    });
    const calls = fetchMock.mock.calls as unknown as Array<[string, { body?: string }]>;
    expect(calls.some(([url]) => url.includes('/rpc/api_list_login_memberships'))).toBe(true);
  });

  it('never creates a session while a registered member must reset the initial password', async () => {
    const passwordHash = await hashPassword('Temporary2026');
    const responses = [
      true,
      { memberId: 'member-new', membershipId: 'membership-new', target: 'storefront', passwordHash, mustResetPassword: true },
      {
        id: 'membership-new',
        memberId: 'member-new',
        target: 'storefront',
        status: 'active',
        roleIds: ['role-employee'],
        permissions: ['catalog.read'],
        deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-new' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-new' }],
        expiresAt: null,
        authzVersion: 1,
        actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: 'user-new', employeeNo: 'REG-NEW' },
      },
      null,
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleLogin(
      new Request('https://hbbtzn.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.24' },
        body: JSON.stringify({ username: 'new.employee', password: 'Temporary2026' }),
      }),
      { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role', SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes' },
      'must-reset'
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PASSWORD_RESET_REQUIRED' } });
  });
});
