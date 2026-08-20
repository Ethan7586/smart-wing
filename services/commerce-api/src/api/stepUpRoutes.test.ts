import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleStartAdminStepUp, handleVerifyAdminStepUp } from './stepUpRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

const { callRpcMock, readSessionMock, decryptJsonMock, verifyTotpMock } = vi.hoisted(() => ({
  callRpcMock: vi.fn(),
  readSessionMock: vi.fn(),
  decryptJsonMock: vi.fn(),
  verifyTotpMock: vi.fn(),
}));

vi.mock('./supabase', () => ({ callRpc: callRpcMock }));
vi.mock('./crypto', () => ({ decryptJson: decryptJsonMock }));
vi.mock('./totp', () => ({ verifyTotp: verifyTotpMock }));
vi.mock('./session', async (importOriginal) => ({ ...(await importOriginal<typeof import('./session')>()), readSession: readSessionMock }));

const env: WorkerEnv = {
  ADMIN_SESSION_SIGNING_KEY: 'test-admin-step-up-signing-key-longer-than-32-bytes',
  PII_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
};

function authorization(): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-admin-a',
    memberId: 'member-admin-a',
    target: 'admin',
    status: 'active',
    roleIds: ['role-voucher-store-operator-v1'],
    permissions: [PERMISSIONS.voucherRedeem],
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
    scopeBindings: [{ kind: 'mall', resourceId: 'mall-a' }],
    expiresAt: null,
    authzVersion: 3,
  };
  return {
    tenantId: 'tenant-a',
    distributorId: null,
    enterpriseId: 'enterprise-a',
    mallId: 'mall-a',
    mallCode: 'MALL_A',
    userId: 'user-a',
    employeeNo: 'U001',
    roles: membership.roleIds,
    permissions: membership.permissions,
    membership,
    stepUpAt: null,
  };
}

function activeSession() {
  return {
    sessionId: 'session-1234567890',
    employeeNo: 'U001',
    mallCode: 'MALL_A',
    target: 'admin' as const,
    memberId: 'member-admin-a',
    membershipId: 'membership-admin-a',
    authzVersion: 3,
    expiresAt: Math.floor(Date.now() / 1_000) + 3600,
  };
}

describe('admin step-up routes', () => {
  it('creates a session-bound challenge but never returns an encrypted MFA secret', async () => {
    callRpcMock.mockReset();
    readSessionMock.mockResolvedValue(activeSession());
    callRpcMock.mockResolvedValueOnce({ challengeId: 'challenge-1234567890', expiresAt: '2026-08-17T08:05:00.000Z', secretCiphertext: 'ciphertext-must-not-leak' });
    const response = await handleStartAdminStepUp(
      new Request('https://smart.example/api/v1/auth/step-up', {
        method: 'POST',
        headers: { 'idempotency-key': 'step-up-start-request' },
      }),
      env,
      authorization(),
      'step-up-start'
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ challengeId: 'challenge-1234567890', method: 'totp', expiresAt: '2026-08-17T08:05:00.000Z', requestId: 'step-up-start' });
    expect(callRpcMock).toHaveBeenCalledWith(env, 'api_admin_step_up_start', expect.objectContaining({ p_session_id: 'session-1234567890', p_membership_id: 'membership-admin-a', p_user_id: 'user-a' }));
  });

  it('refuses verification before loading a factor when the code shape is invalid', async () => {
    callRpcMock.mockReset();
    readSessionMock.mockResolvedValue(activeSession());
    const response = await handleVerifyAdminStepUp(
      new Request('https://smart.example/api/v1/auth/step-up/challenge-1234567890/verify', {
        method: 'POST',
        headers: { 'idempotency-key': 'step-up-verify-short-code' },
        body: JSON.stringify({ code: '12345' }),
      }),
      env,
      authorization(),
      'challenge-1234567890',
      'step-up-invalid-code'
    );
    expect(response.status).toBe(422);
    expect(callRpcMock).not.toHaveBeenCalled();
  });

  it('rotates the host-only admin cookie only after the server verifies the factor and records completion', async () => {
    callRpcMock.mockReset();
    decryptJsonMock.mockReset();
    verifyTotpMock.mockReset();
    readSessionMock.mockResolvedValue(activeSession());
    callRpcMock.mockResolvedValueOnce({ secretCiphertext: 'encrypted-factor' }).mockResolvedValueOnce({ verifiedAt: '2026-08-17T08:00:00.000Z' });
    decryptJsonMock.mockResolvedValue({ totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
    verifyTotpMock.mockResolvedValue(true);
    const response = await handleVerifyAdminStepUp(
      new Request('https://smart.example/api/v1/auth/step-up/challenge-1234567890/verify', {
        method: 'POST',
        headers: { 'idempotency-key': 'step-up-verify-success' },
        body: JSON.stringify({ code: '287082' }),
      }),
      env,
      authorization(),
      'challenge-1234567890',
      'step-up-success'
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('__Host-hbbtzn_admin_session=');
    await expect(response.json()).resolves.toMatchObject({ authenticated: true, stepUpAt: '2026-08-17T08:00:00.000Z' });
    expect(callRpcMock).toHaveBeenNthCalledWith(1, env, 'api_admin_step_up_verification_material', expect.objectContaining({ p_challenge_id: 'challenge-1234567890' }));
    expect(callRpcMock).toHaveBeenNthCalledWith(2, env, 'api_admin_step_up_complete', expect.objectContaining({ p_challenge_id: 'challenge-1234567890' }));
  });
});
