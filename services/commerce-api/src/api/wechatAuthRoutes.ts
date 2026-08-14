import { sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { isTestLoginRateLimitBypassed, readTrustedClientIp } from './loginRateLimitBypass';
import { resolveMembershipRuntimeByIds, type MembershipRuntime } from './membershipContext';
import { authenticateLocalMember } from './publicRoutes';
import { readJsonBody } from './routerSupport';
import { createTrackedMiniappSessionToken } from './session';
import { callRpc, isSupabaseConfigured } from './supabase';
import type { WorkerEnv } from './types';

const BINDING_SECONDS = 10 * 60;
const WECHAT_CODE_ENDPOINT = 'https://api.weixin.qq.com/sns/jscode2session';

interface WechatCodeSession {
  openid?: string;
  unionid?: string;
  errcode?: number;
}

interface WechatIdentityCandidate {
  memberId?: string;
  membershipId?: string;
}

export async function handleWechatSession(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const body = await readJsonBody(request);
  const code = body.ok && isRecord(body.value) && typeof body.value.code === 'string' ? body.value.code.trim() : '';
  if (!code || code.length > 256) return apiError(422, 'INVALID_WECHAT_CODE', '微信登录凭证无效', requestId);
  if (!wechatAuthConfigured(env)) return apiError(503, 'WECHAT_AUTH_NOT_CONFIGURED', '微信登录服务尚未完成服务器配置', requestId);

  const exchanged = await exchangeWechatCode(env, code);
  if (!exchanged.ok) return apiError(exchanged.status, exchanged.code, exchanged.message, requestId);
  const candidate = await callRpc<WechatIdentityCandidate | null>(env, 'api_resolve_wechat_identity', {
    p_app_id: env.WECHAT_MINIAPP_APP_ID,
    p_open_id: exchanged.openId,
  });
  if (!candidate?.memberId || !candidate.membershipId) {
    const bindingChallenge = await callRpc<string>(env, 'api_create_wechat_binding_challenge', {
      p_app_id: env.WECHAT_MINIAPP_APP_ID,
      p_open_id: exchanged.openId,
      p_union_id: exchanged.unionId ?? null,
      p_expires_at: new Date(Date.now() + BINDING_SECONDS * 1_000).toISOString(),
    });
    return json(
      {
        error: {
          code: 'WECHAT_BINDING_REQUIRED',
          message: '首次使用需要绑定已有智慧翼会员账号',
          requestId,
          bindingChallenge,
          expiresIn: BINDING_SECONDS,
        },
      },
      { status: 409 }
    );
  }
  const runtime = await resolveMembershipRuntimeByIds(env, candidate.memberId, candidate.membershipId, 'storefront');
  if (!runtime) return apiError(403, 'WECHAT_MEMBERSHIP_INACTIVE', '绑定的会员身份当前不可用', requestId);
  return issueMiniappSession(request, env, runtime, requestId);
}

export async function handleWechatBind(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (!wechatAuthConfigured(env)) return apiError(503, 'WECHAT_AUTH_NOT_CONFIGURED', '微信登录服务尚未完成服务器配置', requestId);
  const body = await readJsonBody(request);
  const input = body.ok && isRecord(body.value) ? body.value : null;
  const bindingChallenge = typeof input?.bindingChallenge === 'string' ? input.bindingChallenge : '';
  const username = typeof input?.username === 'string' ? input.username : '';
  const password = typeof input?.password === 'string' ? input.password : '';
  if (!isUuid(bindingChallenge) || !username || !password) return apiError(422, 'INVALID_WECHAT_BINDING', '会员账号绑定信息不完整', requestId);

  const clientIp = readTrustedClientIp(request);
  const ipHash = await sha256(`${clientIp ?? 'unknown'}:${env.MINIAPP_SESSION_SIGNING_KEY ?? ''}`);
  const bypass = isTestLoginRateLimitBypassed(clientIp, env);
  if (!bypass && !(await callRpc<boolean>(env, 'api_login_allowed', { p_ip_hash: ipHash }))) {
    return apiError(429, 'LOGIN_RATE_LIMITED', '登录尝试过多，请15分钟后重试', requestId);
  }
  const login = await authenticateLocalMember(username, password, 'storefront', env);
  if (!login.runtime || login.mustResetPassword) {
    if (!bypass) await callRpc<string | null>(env, 'api_record_login_failure', { p_ip_hash: ipHash });
    return apiError(login.mustResetPassword ? 403 : 401, login.mustResetPassword ? 'PASSWORD_RESET_REQUIRED' : 'INVALID_USERNAME_PASSWORD', login.mustResetPassword ? '请先在智慧翼商城修改初始密码' : '账号或密码不正确', requestId);
  }
  const bound = await callRpc<boolean>(env, 'api_bind_wechat_identity', {
    p_challenge_id: bindingChallenge,
    p_member_id: login.runtime.membership.memberId,
    p_membership_id: login.runtime.membership.id,
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  if (!bound) return apiError(409, 'WECHAT_BINDING_EXPIRED', '绑定凭证已过期或已使用，请重新登录', requestId);
  await callRpc<boolean>(env, 'api_clear_login_failures', { p_ip_hash: ipHash });
  return issueMiniappSession(request, env, login.runtime, requestId);
}

export async function exchangeWechatCode(
  env: Pick<WorkerEnv, 'WECHAT_MINIAPP_APP_ID' | 'WECHAT_MINIAPP_APP_SECRET'>,
  code: string,
  fetcher: typeof fetch = fetch
): Promise<{ ok: true; openId: string; unionId?: string } | { ok: false; status: number; code: string; message: string }> {
  const url = new URL(WECHAT_CODE_ENDPOINT);
  url.searchParams.set('appid', env.WECHAT_MINIAPP_APP_ID ?? '');
  url.searchParams.set('secret', env.WECHAT_MINIAPP_APP_SECRET ?? '');
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');
  try {
    const response = await fetcher(url, { method: 'GET', headers: { accept: 'application/json' } });
    if (!response.ok) return { ok: false, status: 502, code: 'WECHAT_AUTH_UNAVAILABLE', message: '微信登录服务暂时不可用' };
    const result = (await response.json()) as WechatCodeSession;
    if (result.errcode === 45011) return { ok: false, status: 429, code: 'WECHAT_LOGIN_RATE_LIMITED', message: '微信登录过于频繁，请稍后重试' };
    if (result.errcode || typeof result.openid !== 'string' || !result.openid) {
      return { ok: false, status: 401, code: 'INVALID_WECHAT_CODE', message: '微信登录凭证已失效，请重试' };
    }
    return { ok: true, openId: result.openid, ...(typeof result.unionid === 'string' && result.unionid ? { unionId: result.unionid } : {}) };
  } catch {
    return { ok: false, status: 502, code: 'WECHAT_AUTH_UNAVAILABLE', message: '微信登录服务暂时不可用' };
  }
}

function wechatAuthConfigured(env: WorkerEnv): boolean {
  return Boolean(isSupabaseConfigured(env) && env.WECHAT_MINIAPP_APP_ID && env.WECHAT_MINIAPP_APP_SECRET && env.MINIAPP_SESSION_SIGNING_KEY && env.MINIAPP_SESSION_SIGNING_KEY.length >= 32);
}

async function issueMiniappSession(request: Request, env: WorkerEnv, runtime: MembershipRuntime, requestId: string): Promise<Response> {
  const session = await createTrackedMiniappSessionToken(request, env, runtime.authorization.employeeNo, runtime.authorization.mallCode, {
    memberId: runtime.membership.memberId,
    membershipId: runtime.membership.id,
    authzVersion: runtime.membership.authzVersion,
  });
  return json({
    authenticated: true,
    ...session,
    expiresAt: new Date(Date.now() + session.expiresIn * 1_000).toISOString(),
    authorization: {
      memberId: runtime.membership.memberId,
      membershipId: runtime.membership.id,
      target: runtime.membership.target,
      roles: runtime.authorization.roles,
      permissions: runtime.authorization.permissions,
    },
    requestId,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
