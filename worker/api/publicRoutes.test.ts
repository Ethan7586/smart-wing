import { describe, expect, it } from 'vitest';
import { handleHealth } from './publicRoutes';
import type { WorkerEnv } from './types';

describe('health endpoint', () => {
  it('does not report ready when encryption is unavailable', async () => {
    const env: WorkerEnv = { APP_ENV: 'development', AUTH_MODE: 'development' };
    const response = await handleHealth(new Request('https://mall.example/api/health'), env, 'health-request');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('health-request');
    await expect(response.json()).resolves.toMatchObject({
      status: 'degraded',
      checks: { authentication: 'mvp_session_ready', piiEncryption: 'required_for_orders' },
    });
  });

  it('rejects methods other than GET', async () => {
    const response = await handleHealth(new Request('https://mall.example/api/health', { method: 'POST' }), {}, 'health-request');

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
