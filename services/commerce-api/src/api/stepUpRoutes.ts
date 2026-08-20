import { decryptJson } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { readJsonBody, invalidBody, requireIdempotencyKey } from './routerSupport';
import { createSessionCookie, readSession, type SessionPayload } from './session';
import { callRpc } from './supabase';
import { verifyTotp } from './totp';
import type { AuthorizationContext, WorkerEnv } from './types';

interface StepUpStartResult {
  challengeId?: unknown;
  method?: unknown;
  expiresAt?: unknown;
  secretCiphertext?: unknown;
}

interface VerificationMaterial {
  secretCiphertext?: unknown;
}

interface MfaSecretPayload {
  totpSecret?: unknown;
}

function isStepUpSession(session: SessionPayload | null, authorization: AuthorizationContext): session is SessionPayload {
  return Boolean(session && session.target === 'admin' && session.membershipId === authorization.membership.id && session.memberId === authorization.membership.memberId);
}

function startResult(value: StepUpStartResult): { challengeId: string; expiresAt: string } | null {
  return typeof value.challengeId === 'string' && value.challengeId.length > 0 && typeof value.expiresAt === 'string' ? { challengeId: value.challengeId, expiresAt: value.expiresAt } : null;
}

function totpSecret(value: unknown): string | null {
  const payload = typeof value === 'object' && value !== null ? (value as MfaSecretPayload) : null;
  return typeof payload?.totpSecret === 'string' && payload.totpSecret.length >= 16 ? payload.totpSecret : null;
}

function challengeId(value: string): boolean {
  return value.length >= 16 && value.length <= 120 && /^[a-zA-Z0-9-]+$/.test(value);
}

export async function handleStartAdminStepUp(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const _idempotencyKey = requireIdempotencyKey(request, requestId, '二次认证发起必须提供 Idempotency-Key');
  if (typeof _idempotencyKey !== 'string') return _idempotencyKey;
  const session = await readSession(request, env);
  if (!isStepUpSession(session, authorization)) return apiError(401, 'AUTHENTICATION_REQUIRED', '安全会话已失效，请重新登录', requestId);
  const result = await callRpc<StepUpStartResult>(env, 'api_admin_step_up_start', {
    p_membership_id: authorization.membership.id,
    p_user_id: authorization.userId,
    p_session_id: session.sessionId,
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  const challenge = startResult(result);
  if (!challenge) throw new Error('STEP_UP_RESPONSE_INVALID');
  // The encrypted factor secret is intentionally discarded before response.
  return json({ challengeId: challenge.challengeId, method: 'totp', expiresAt: challenge.expiresAt, requestId }, { status: 201 });
}

export async function handleVerifyAdminStepUp(request: Request, env: WorkerEnv, authorization: AuthorizationContext, challenge: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const _idempotencyKey = requireIdempotencyKey(request, requestId, '二次认证提交必须提供 Idempotency-Key');
  if (typeof _idempotencyKey !== 'string') return _idempotencyKey;
  if (!challengeId(challenge)) return apiError(404, 'STEP_UP_CHALLENGE_NOT_FOUND', '二次认证请求不存在或已失效', requestId);
  if (!env.PII_ENCRYPTION_KEY) return apiError(503, 'STEP_UP_NOT_CONFIGURED', '二次认证服务尚未配置', requestId);
  const session = await readSession(request, env);
  if (!isStepUpSession(session, authorization)) return apiError(401, 'AUTHENTICATION_REQUIRED', '安全会话已失效，请重新登录', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const suppliedCode = typeof (body.value as { code?: unknown })?.code === 'string' ? (body.value as { code: string }).code.trim() : '';
  if (!/^\d{6}$/.test(suppliedCode)) return apiError(422, 'STEP_UP_CODE_INVALID', '请输入 6 位动态口令', requestId);

  const material = await callRpc<VerificationMaterial>(env, 'api_admin_step_up_verification_material', {
    p_membership_id: authorization.membership.id,
    p_user_id: authorization.userId,
    p_session_id: session.sessionId,
    p_challenge_id: challenge,
  });
  if (typeof material.secretCiphertext !== 'string') throw new Error('STEP_UP_RESPONSE_INVALID');
  let secret: string | null = null;
  try {
    secret = totpSecret(await decryptJson<MfaSecretPayload>(material.secretCiphertext, env.PII_ENCRYPTION_KEY));
  } catch {
    return apiError(503, 'STEP_UP_NOT_CONFIGURED', '二次认证服务尚未配置', requestId);
  }
  if (!secret) return apiError(503, 'STEP_UP_NOT_CONFIGURED', '二次认证服务尚未配置', requestId);

  if (!(await verifyTotp(secret, suppliedCode))) {
    const failure = await callRpc<{ locked?: unknown }>(env, 'api_admin_step_up_record_failure', {
      p_membership_id: authorization.membership.id,
      p_user_id: authorization.userId,
      p_session_id: session.sessionId,
      p_challenge_id: challenge,
      p_request_id: requestId,
      p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    });
    return apiError(401, failure.locked === true ? 'STEP_UP_LOCKED' : 'STEP_UP_FAILED', failure.locked === true ? '动态口令连续错误，认证请求已锁定' : '动态口令错误或已过期', requestId);
  }

  const completion = await callRpc<{ verifiedAt?: unknown }>(env, 'api_admin_step_up_complete', {
    p_membership_id: authorization.membership.id,
    p_user_id: authorization.userId,
    p_session_id: session.sessionId,
    p_challenge_id: challenge,
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  const stepUpAt = typeof completion.verifiedAt === 'string' ? new Date(completion.verifiedAt) : new Date();
  if (!Number.isFinite(stepUpAt.getTime())) throw new Error('STEP_UP_RESPONSE_INVALID');
  const refreshedCookie = await createSessionCookie(env, session.employeeNo, session.mallCode, {
    target: 'admin',
    memberId: session.memberId,
    membershipId: session.membershipId,
    authzVersion: session.authzVersion,
    stepUpAt: Math.floor(stepUpAt.getTime() / 1_000),
  });
  return json({ authenticated: true, stepUpAt: stepUpAt.toISOString(), requestId }, { headers: { 'set-cookie': refreshedCookie } });
}
