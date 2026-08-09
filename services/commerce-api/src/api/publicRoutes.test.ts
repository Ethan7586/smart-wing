import { describe, expect, it } from 'vitest';
import { handleHealth, handleLogin } from './publicRoutes';
import type { WorkerEnv } from './types';

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
});
