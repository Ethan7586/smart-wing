import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleRegistration, handleRegistrationOtp } from './registrationRoutes';
import type { WorkerEnv } from './types';

const env: WorkerEnv = {
  APP_ENV: 'test',
  AUTH_MODE: 'test',
  SELF_REGISTRATION_ENABLED: 'true',
  SMS_PROVIDER: 'debug',
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
  IDENTITY_LOOKUP_KEY: 'identity-key-that-is-longer-than-thirty-two-bytes',
  PII_ENCRYPTION_KEY: btoa('12345678901234567890123456789012'),
};

afterEach(() => vi.unstubAllGlobals());

describe('member registration routes', () => {
  it('creates a random debug challenge without exposing it in production', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('true', { status: 200, headers: { 'content-type': 'application/json' } })));
    const response = await handleRegistrationOtp(post('/otp', { mobile: '13800138000' }), env, 'otp-request');
    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;
    expect(payload.challengeId).toEqual(expect.any(String));
    expect(payload.debugCode).toMatch(/^\d{6}$/);

    const production = await handleRegistrationOtp(post('/otp', { mobile: '13800138000' }), { ...env, APP_ENV: 'production', SMS_PROVIDER: 'debug' }, 'prod-request');
    expect(production.status).toBe(503);
    await expect(production.json()).resolves.toMatchObject({ error: { code: 'SMS_PROVIDER_NOT_CONFIGURED' } });
  });

  it('rejects weak passwords before a database write', async () => {
    const database = vi.fn();
    vi.stubGlobal('fetch', database);
    const response = await handleRegistration(post('/register', {
      mobile: '13800138000', challengeId: crypto.randomUUID(), code: '123456',
      displayName: '新员工', inviteCode: 'SW-DEMO-EMPLOYEE-2026', password: '123456',
    }), env, 'register-request');
    expect(response.status).toBe(422);
    expect(database).not.toHaveBeenCalled();
  });

  it('maps a valid invitation result to a created storefront account', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'active', employeeNo: 'REG-123' }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const response = await handleRegistration(post('/register', {
      mobile: '13800138000', challengeId: crypto.randomUUID(), code: '123456',
      displayName: '新员工', inviteCode: 'SW-DEMO-EMPLOYEE-2026', password: 'SmartWing2026',
    }), env, 'register-request');
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ registered: true, status: 'active', employeeNo: 'REG-123' });
  });
});

function post(path: string, body: unknown): Request {
  return new Request(`https://hbbtzn.com/api/v1/auth/registration${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9' }, body: JSON.stringify(body),
  });
}
