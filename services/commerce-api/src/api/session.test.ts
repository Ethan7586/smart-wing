import { describe, expect, it } from 'vitest';
import { createSessionCookie, readSession, verifyAccessCode } from './session';
import type { WorkerEnv } from './types';

const env: WorkerEnv = {
  SESSION_SIGNING_KEY: 'test-session-signing-key-that-is-longer-than-32-bytes',
};

describe('MVP session', () => {
  it('creates and verifies an HttpOnly signed session', async () => {
    const setCookie = await createSessionCookie(env, 'SW0001', 'SMART_WING_DEMO');
    expect(setCookie).toContain('__Host-hbbtzn_store_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).not.toContain('Domain=');
    const request = new Request('https://hbbtzn.com/api/v1/auth/session', {
      headers: { cookie: setCookie.split(';')[0] },
    });
    await expect(readSession(request, env)).resolves.toMatchObject({
      employeeNo: 'SW0001',
      mallCode: 'SMART_WING_DEMO',
      target: 'storefront',
    });
  });

  it('does not accept a storefront session on the admin host', async () => {
    const setCookie = await createSessionCookie(env, 'SW0001', 'SMART_WING_DEMO');
    const request = new Request('https://smart.hbbtzn.com/api/v1/auth/session', {
      headers: { cookie: setCookie.split(';')[0] },
    });
    await expect(readSession(request, env)).resolves.toBeNull();
  });

  it('rejects a tampered session', async () => {
    const setCookie = await createSessionCookie(env, 'SW0001', 'SMART_WING_DEMO');
    const cookie = setCookie.split(';')[0];
    const request = new Request('https://hbbtzn.com/api/v1/auth/session', {
      headers: { cookie: `${cookie}x` },
    });
    await expect(readSession(request, env)).resolves.toBeNull();
  });

  it('checks the access code without storing it in application code', async () => {
    await expect(verifyAccessCode('correct-code', 'correct-code')).resolves.toBe(true);
    await expect(verifyAccessCode('wrong-code', 'correct-code')).resolves.toBe(false);
  });
});
