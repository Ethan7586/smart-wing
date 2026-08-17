import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLockoutState, loginWithPassword, MAX_LOGIN_FAILURES, reportLoginFailure, TEST_ACCOUNT_MEMBERSHIPS, verifyStepUp } from './auth';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('public test authentication fixtures', () => {
  it('contains all 25 requested accounts with one active membership each', () => {
    const usernames = ['buyer', 'seller', 'ops', 'cs', 'admin'].flatMap((prefix) => Array.from({ length: 5 }, (_, index) => `${prefix}${String(index + 1).padStart(3, '0')}`));

    for (const username of usernames) {
      expect(TEST_ACCOUNT_MEMBERSHIPS[username]).toHaveLength(1);
      expect(TEST_ACCOUNT_MEMBERSHIPS[username][0].status).toBe('active');
    }
  });

  it('accepts a roster account, preserves all selectable identities, and rejects former universal passwords', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authorization: { membershipId: 'membership-test-buyer-001', target: 'storefront' },
            entrances: { storefront: true, admin: true },
            memberships: [
              { id: 'membership-test-buyer-001', target: 'storefront', status: 'active', enterpriseName: '示范企业', storeName: '智慧翼企业福利商城', roleName: '员工会员', dataScope: '个人福利账户' },
              { id: 'membership-owner-001', target: 'admin', status: 'active', enterpriseName: '智慧翼福利平台', storeName: '智慧翼平台运营后台', roleName: 'Platform Owner', dataScope: '平台级全部授权范围', subjectScope: '平台' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: '账号或密码不正确' } }), { status: 401, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const accepted = loginWithPassword('buyer001', '123456');
    await expect(accepted).resolves.toMatchObject({
      identifier: 'buyer001',
      entrances: { storefront: true, admin: true },
      memberships: [
        { id: 'membership-test-buyer-001', target: 'storefront' },
        { id: 'membership-owner-001', target: 'admin', subjectScope: '平台' },
      ],
    });

    const rejected = loginWithPassword('not-an-account', 'password123');
    await expect(rejected).rejects.toThrow('账号或密码不正确');
  });

  it('requires the documented test step-up code', async () => {
    vi.useFakeTimers();
    const rejected = verifyStepUp('pat', 'membership', '654321');
    const rejectedAssertion = expect(rejected).rejects.toThrow('动态口令错误');
    await vi.runAllTimersAsync();
    await rejectedAssertion;

    const accepted = verifyStepUp('pat', 'membership', '123456');
    await vi.runAllTimersAsync();
    await expect(accepted).resolves.toMatchObject({ targetDomain: 'smart.hbbtzn.com' });
  });

  it('locks an identifier only after ten consecutive failed login attempts', async () => {
    const identifier = `lockout-${Date.now()}`;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    for (let attempt = 0; attempt < MAX_LOGIN_FAILURES - 1; attempt += 1) {
      await reportLoginFailure(identifier, 'test failure');
      expect(getLockoutState(identifier).isLocked).toBe(false);
    }

    await reportLoginFailure(identifier, 'test failure');
    const lockout = getLockoutState(identifier);
    expect(lockout).toMatchObject({ isLocked: true, failedAttempts: MAX_LOGIN_FAILURES });
    expect(lockout.remainingSeconds).toBeGreaterThan(0);
  });
});
