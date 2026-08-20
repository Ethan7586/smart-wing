import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleHealth, handleReadiness } from './publicRoutes';
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
});
