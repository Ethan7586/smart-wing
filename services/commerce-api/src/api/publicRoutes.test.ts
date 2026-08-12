import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleHealth, handleLogin } from './publicRoutes';
import { hashPassword } from './registrationSecurity';
import type { WorkerEnv } from './types';
afterEach(() => vi.unstubAllGlobals());

describe('health endpoint', () => {
  it('does not report ready when encryption is unavailable', async () => {
    const env: WorkerEnv = {
      APP_ENV: 'production',
      AUTH_MODE: 'membership',
      SUPABASE_REGION: 'ap-southeast-1',
      SESSION_SIGNING_KEY: 'storefront-test-key-that-is-longer-than-32-bytes',
      ADMIN_SESSION_SIGNING_KEY: 'admin-test-key-that-is-longer-than-32-bytes',
    };
    const response = await handleHealth(new Request('https://mall.example/api/health'), env, 'health-request');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('health-request');
    await expect(response.json()).resolves.toMatchObject({
      status: 'degraded',
      checks: { authentication: 'mvp_session_ready', piiEncryption: 'required_for_orders' },
      database: { region: 'ap-southeast-1' },
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
      { memberId: 'member-new', membershipId: 'membership-new', passwordHash },
      {
        id: 'membership-new', memberId: 'member-new', target: 'storefront', status: 'active',
        roleIds: ['role-employee'], permissions: ['catalog.read'], deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-new' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-new' }], expiresAt: null, authzVersion: 1,
        actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: 'user-new', employeeNo: 'REG-NEW' },
      },
      true,
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } })));
    const response = await handleLogin(new Request('https://hbbtzn.com/api/v1/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.8' },
      body: JSON.stringify({ username: '13800138000', password: 'SmartWing2026' }),
    }), {
      APP_ENV: 'production', AUTH_MODE: 'membership', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes', IDENTITY_LOOKUP_KEY: 'identity-key-that-is-longer-than-thirty-two-bytes',
    }, 'registered-login');
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('__Host-hbbtzn_store_session=');
    await expect(response.json()).resolves.toMatchObject({ authenticated: true, authorization: { membershipId: 'membership-new', target: 'storefront' } });
  });
});
