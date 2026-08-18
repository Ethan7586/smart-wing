import { sha256 } from './crypto';
import { getDemoAccounts, isDemoAuthEnabled, resolveDemoMembership, verifyDemoPassword } from './demoAuth';
import { apiError, json, methodNotAllowed } from './http';
import { isTestLoginRateLimitBypassed, readTrustedClientIp } from './loginRateLimitBypass';
import { parseMembershipRuntime, resolveMembershipRuntimeByIds, type MembershipRuntime } from './membershipContext';
import { localPhoneSubject } from './registrationRoutes';
import { hashPassword, normalizeChineseMobile, normalizeLocalUsername, validRegistrationPassword, verifyPassword } from './registrationSecurity';
import { readJsonBody } from './routerSupport';
import { clearSessionCookie, createTrackedSessionCookie, readSession, targetForRequest } from './session';
import { callRpc, isSupabaseConfigured } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';

interface CatalogRow {
  id: string;
  sku_id: string;
  name: string;
  name_en: string | null;
  name_zh: string | null;
  subtitle: string | null;
  subtitle_en: string | null;
  subtitle_zh: string | null;
  category_code: string;
  taxonomy_l1: string | null;
  taxonomy_l2: string | null;
  taxonomy_l3: string | null;
  classification_status: string;
  cover_url: string | null;
  price_cents: number;
  market_price_cents: number | null;
  available_stock: number;
  supplier_name: string;
  is_test: boolean;
  purchasable: boolean;
  qualification: Record<string, unknown>;
}

export async function handleHealth(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  // Liveness must not synchronously cross regions to the database. Doing so
  // made load-balancer probes take seconds and amplified an upstream outage.
  // Use /api/ready for a deliberate deep dependency check instead.
  const authReady = Boolean(env.SESSION_SIGNING_KEY && env.ADMIN_SESSION_SIGNING_KEY && (env.AUTH_MODE === 'membership' || isDemoAuthEnabled(env)));
  const piiReady = Boolean(env.PII_ENCRYPTION_KEY);
  return json({
    service: 'smart-wing-production-mvp',
    status: 'ok',
    probe: 'liveness',
    checks: {
      database: isSupabaseConfigured(env) ? 'not_checked' : 'configuration_required',
      authentication: authReady ? 'mvp_session_ready' : 'awaiting_enterprise_provider',
      piiEncryption: piiReady ? 'configured' : 'required_for_orders',
    },
    database: { provider: 'Supabase PostgreSQL', region: env.SUPABASE_REGION ?? 'unconfigured' },
    requestId,
  });
}

/**
 * Deep readiness is intentionally separate from the fast liveness endpoint.
 * It is for deployment gates and diagnostics, not for high-frequency traffic
 * or browser startup. A database outage therefore remains visible without
 * turning every ordinary health probe into a remote database round trip.
 */
export async function handleReadiness(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  let health = { databaseReady: false, tableCount: 0 };
  if (isSupabaseConfigured(env)) {
    try {
      health = await callRpc<typeof health>(env, 'api_health');
    } catch {
      // Readiness must state the dependency failure explicitly rather than
      // hiding it behind a generic 5xx from the global error handler.
      health = { databaseReady: false, tableCount: 0 };
    }
  }
  const authReady = Boolean(env.SESSION_SIGNING_KEY && env.ADMIN_SESSION_SIGNING_KEY && (env.AUTH_MODE === 'membership' || isDemoAuthEnabled(env)));
  const piiReady = Boolean(env.PII_ENCRYPTION_KEY);
  const status = health.databaseReady && authReady && piiReady ? 'ok' : 'degraded';
  return json({
    service: 'smart-wing-production-mvp',
    status,
    probe: 'readiness',
    checks: {
      database: health.databaseReady ? 'ready' : 'unavailable_or_configuration_required',
      authentication: authReady ? 'mvp_session_ready' : 'awaiting_enterprise_provider',
      piiEncryption: piiReady ? 'configured' : 'required_for_orders',
    },
    database: { provider: 'Supabase PostgreSQL', region: env.SUPABASE_REGION ?? 'unconfigured', tableCount: health.tableCount },
    requestId,
  });
}

export async function handleLogin(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const registeredAuthEnabled = isSupabaseConfigured(env);
  if (!registeredAuthEnabled && !isDemoAuthEnabled(env)) {
    return apiError(503, 'AUTH_PROVIDER_NOT_CONFIGURED', '生产环境仅接受已配置的企业身份提供方登录', requestId);
  }
  const input = await readLoginInput(request);
  if (!input) return apiError(400, 'INVALID_LOGIN_INPUT', '登录信息不完整', requestId);
  const username = typeof input.username === 'string' ? input.username : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const selectedMembershipId = readSelectedMembershipId(input);
  const clientIp = readTrustedClientIp(request);
  const ipHash = await loginAttemptKey(clientIp, username, env);
  const bypassRateLimit = isTestLoginRateLimitBypassed(clientIp, env);
  if (bypassRateLimit) {
    console.info(
      JSON.stringify({
        event: 'login_rate_limit_bypassed',
        requestId,
        ipHash,
        bypassFrom: env.TEST_LOGIN_RATE_LIMIT_BYPASS_FROM,
        bypassUntil: env.TEST_LOGIN_RATE_LIMIT_BYPASS_UNTIL,
      })
    );
  } else {
    const loginAllowed = await callRpc<boolean>(env, 'api_login_allowed', {
      p_ip_hash: ipHash,
    });
    if (!loginAllowed) {
      return apiError(429, 'LOGIN_RATE_LIMITED', '登录尝试过多，请15分钟后重试', requestId);
    }
  }

  if (username.trim() === '' || password.trim() === '') {
    return apiError(400, 'INVALID_LOGIN_INPUT', '账号或密码缺失', requestId);
  }
  const target = targetForRequest(request);
  const localLogin = registeredAuthEnabled ? await authenticateLocalMember(username, password, target, env, selectedMembershipId) : NO_LOCAL_LOGIN;
  const registeredRuntime = localLogin.runtime;
  const account = registeredRuntime || localLogin.credentialFound ? null : getDemoAccounts(env).find((candidate) => candidate.username.trim().toLowerCase() === username.trim().toLowerCase());
  const demoRuntime = account && (await verifyDemoPassword(password, account.password)) ? await resolveDemoMembership(env, account, target) : null;
  const runtime = registeredRuntime ?? demoRuntime;
  if (!runtime) {
    // The password was right; this account simply has no identity on this host.
    // Saying so beats a false "wrong password", and it is not a failed attempt.
    if (localLogin.targetUnavailable) return apiError(403, 'ENTRANCE_NOT_AVAILABLE', entranceMessage(localLogin.entrances), requestId);
    if (!bypassRateLimit) {
      await callRpc<string | null>(env, 'api_record_login_failure', {
        p_ip_hash: ipHash,
      });
    }
    return apiError(401, 'INVALID_USERNAME_PASSWORD', '账号或密码不正确', requestId);
  }
  if (registeredRuntime && localLogin.mustResetPassword) {
    return apiError(403, 'PASSWORD_RESET_REQUIRED', '首次登录必须先修改临时密码', requestId);
  }
  await callRpc<boolean>(env, 'api_clear_login_failures', { p_ip_hash: ipHash });
  // `ethan` is an explicit test-only Owner alias. It retains the same resolved
  // membership and permissions, while the shell can identify the demo account
  // by the name the presenter used to sign in.
  const sessionEmployeeNo = account?.username.toLowerCase() === 'ethan' ? 'Ethan' : runtime.authorization.employeeNo;
  const cookie = await createTrackedSessionCookie(request, env, sessionEmployeeNo, runtime.authorization.mallCode, {
    target,
    memberId: runtime.membership.memberId,
    membershipId: runtime.membership.id,
    authzVersion: runtime.membership.authzVersion,
  });
  const redirect = safeLoginRedirect(request);
  if (redirect && target === 'admin') {
    // Public test flow: a top-level form POST lets smart.hbbtzn.com set its own
    // host-only cookie, then lands directly in the admin app. No password or
    // ticket is placed in the URL.
    return new Response(null, {
      status: 303,
      headers: { 'set-cookie': cookie, location: redirect },
    });
  }
  return json({ authenticated: true, authorization: publicAuthorization(runtime.authorization), requestId }, { headers: { 'set-cookie': cookie } });
}

export async function handleRegisteredCredentialDiscovery(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (!isSupabaseConfigured(env)) {
    return apiError(503, 'AUTH_PROVIDER_NOT_CONFIGURED', '会员账号服务尚未配置', requestId);
  }
  const input = await readLoginInput(request);
  const username = typeof input?.username === 'string' ? input.username : '';
  const password = typeof input?.password === 'string' ? input.password : '';
  if (!username || !password) return apiError(400, 'INVALID_LOGIN_INPUT', '登录信息不完整', requestId);

  const clientIp = readTrustedClientIp(request);
  const ipHash = await loginAttemptKey(clientIp, username, env);
  const bypassRateLimit = isTestLoginRateLimitBypassed(clientIp, env);
  if (!bypassRateLimit) {
    const loginAllowed = await callRpc<boolean>(env, 'api_login_allowed', { p_ip_hash: ipHash });
    if (!loginAllowed) return apiError(429, 'LOGIN_RATE_LIMITED', '登录尝试过多，请15分钟后重试', requestId);
  }

  // No target is pinned here: discovery reports where this account can go, and
  // the storefront-first ordering makes shopping the default landing.
  const localLogin = await authenticateLocalMember(username, password, undefined, env);
  const demoAccount = localLogin.credentialFound ? null : getDemoAccounts(env).find((candidate) => candidate.username.trim().toLowerCase() === username.trim().toLowerCase());
  const demoTarget = demoAccount?.adminMembershipId ? 'admin' : 'storefront';
  const demoRuntime = demoAccount && (await verifyDemoPassword(password, demoAccount.password)) ? await resolveDemoMembership(env, demoAccount, demoTarget) : null;
  const runtime = localLogin.runtime ?? demoRuntime;
  if (!runtime) {
    if (!bypassRateLimit) await callRpc<string | null>(env, 'api_record_login_failure', { p_ip_hash: ipHash });
    return apiError(401, 'INVALID_USERNAME_PASSWORD', '账号或密码不正确', requestId);
  }
  await callRpc<boolean>(env, 'api_clear_login_failures', { p_ip_hash: ipHash });
  const memberships = localLogin.runtime ? await listSelectableMemberships(env, localLogin.runtime.membership.memberId) : [fallbackSelectableMembership(runtime)];
  if (memberships.length === 0) return apiError(403, 'MEMBERSHIP_SELECTION_UNAVAILABLE', '账号暂无可用访问身份，请联系管理员授权', requestId);
  return json({
    authenticated: true,
    requiresPasswordReset: localLogin.mustResetPassword,
    authorization: publicAuthorization(runtime.authorization),
    entrances: loginEntrances(localLogin, runtime, demoAccount ? demoTarget : undefined),
    memberships,
    requestId,
  });
}

/**
 * Login failures are counted per account per address. A shared office egress
 * address no longer collapses every tester into one bucket, while guessing a
 * single account's password is stopped after ten attempts.
 */
async function loginAttemptKey(clientIp: string | null, username: string, env: WorkerEnv): Promise<string> {
  return sha256(`${clientIp ?? 'unknown'}:${username.trim().toLowerCase()}:${env.SESSION_SIGNING_KEY ?? ''}`);
}

function entranceMessage(entrances: Entrance[]): string {
  return entrances.some((entrance) => entrance.target === 'admin') ? '该账号是运营后台账号，请前往 smart.hbbtzn.com 登录' : '该账号是员工商城账号，请前往 hbbtzn.com 登录';
}

function loginEntrances(localLogin: LocalLogin, runtime: MembershipRuntime, demoTarget?: 'storefront' | 'admin') {
  const targets = localLogin.entrances.length > 0 ? localLogin.entrances.map((entrance) => entrance.target) : [demoTarget ?? runtime.authorization.membership.target];
  return { storefront: targets.includes('storefront'), admin: targets.includes('admin') };
}

export async function handleInitialPasswordChange(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const input = await readLoginInput(request);
  const username = typeof input?.username === 'string' ? input.username : '';
  const currentPassword = typeof input?.password === 'string' ? input.password : '';
  const newPassword = typeof input?.newPassword === 'string' ? input.newPassword : '';
  if (!username || !currentPassword || !validRegistrationPassword(newPassword)) return apiError(422, 'INVALID_PASSWORD_CHANGE', '新密码至少10位，并同时包含字母和数字', requestId);
  const clientIp = readTrustedClientIp(request);
  const ipHash = await loginAttemptKey(clientIp, username, env);
  if (!(await callRpc<boolean>(env, 'api_login_allowed', { p_ip_hash: ipHash }))) return apiError(429, 'LOGIN_RATE_LIMITED', '登录尝试过多，请15分钟后重试', requestId);
  const localLogin = await authenticateLocalMember(username, currentPassword, undefined, env);
  if (!localLogin.runtime || !localLogin.mustResetPassword || !localLogin.passwordHash) {
    await callRpc<string | null>(env, 'api_record_login_failure', { p_ip_hash: ipHash });
    return apiError(401, 'INVALID_USERNAME_PASSWORD', '账号或临时密码不正确', requestId);
  }
  if (await verifyPassword(newPassword, localLogin.passwordHash)) return apiError(422, 'PASSWORD_REUSE_FORBIDDEN', '新密码不能与临时密码相同', requestId);
  const changed = await callRpc<boolean>(env, 'api_initial_change_local_password', {
    p_member_id: localLogin.runtime.membership.memberId,
    p_password_hash: await hashPassword(newPassword),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  if (!changed) return apiError(409, 'PASSWORD_RESET_STATE_CHANGED', '初始密码状态已变化，请重新登录', requestId);
  await callRpc<boolean>(env, 'api_clear_login_failures', { p_ip_hash: ipHash });
  return json({ changed: true, loginRequired: true, requestId });
}

type Entrance = { target: 'storefront' | 'admin'; membershipId: string };
type CandidateEntrance = Entrance & { runtime?: unknown };
type RegisteredCandidate = { memberId?: string; membershipId?: string; target?: 'storefront' | 'admin'; passwordHash?: string; mustResetPassword?: boolean; entrances?: CandidateEntrance[] };
type LocalLogin = { runtime: MembershipRuntime | null; credentialFound: boolean; mustResetPassword: boolean; passwordHash: string | null; entrances: Entrance[]; targetUnavailable: boolean };
type SelectableMembership = {
  id: string;
  target: 'storefront' | 'admin';
  status: 'active';
  enterpriseName: string;
  storeName: string;
  roleName: string;
  dataScope: string;
  accountTypeLabel?: string;
  subjectScope?: '平台' | '租户' | '企业' | '供应商' | '商城';
  keyPermissions?: string[];
  expireAt?: string;
  requiresStepUp?: boolean;
};
const DUMMY_PASSWORD_HASH = `pbkdf2-sha256$310000$AAAAAAAAAAAAAAAAAAAAAA==$${'A'.repeat(43)}=`;
const NO_LOCAL_LOGIN: LocalLogin = { runtime: null, credentialFound: false, mustResetPassword: false, passwordHash: null, entrances: [], targetUnavailable: false };

function readEntrances(candidate: RegisteredCandidate): Entrance[] {
  const rows = Array.isArray(candidate.entrances) ? candidate.entrances : [];
  const entrances = rows.filter((entrance): entrance is Entrance => (entrance?.target === 'storefront' || entrance?.target === 'admin') && typeof entrance.membershipId === 'string' && entrance.membershipId.length > 0);
  // A database that has not yet applied the entrance migration reports only the
  // single resolved membership. Treating that as the sole entrance keeps login
  // working when the API rolls out ahead of the migration.
  if (entrances.length > 0) return entrances;
  return candidate.target && candidate.membershipId ? [{ target: candidate.target, membershipId: candidate.membershipId }] : [];
}

/** The credential lookup may carry a server-derived runtime per entrance. Its
 * shape and exact identity are revalidated locally before it can issue a
 * session. Older databases do not return this field and safely use the
 * existing resolver below. */
function runtimeFromCandidate(candidate: RegisteredCandidate, selected: Entrance): MembershipRuntime | null {
  const entry = candidate.entrances?.find((entrance) => entrance?.target === selected.target && entrance.membershipId === selected.membershipId);
  const runtime = parseMembershipRuntime(entry?.runtime);
  if (!runtime) return null;
  return runtime.membership.memberId === candidate.memberId && runtime.membership.id === selected.membershipId && runtime.membership.target === selected.target ? runtime : null;
}

/**
 * Resolves one credential and every entrance it holds. With no requested
 * target, storefront is the default. A requested host must have a matching
 * entrance; a mismatch receives an explicit access message rather than a false
 * "wrong password" response.
 */
export async function authenticateLocalMember(identifier: string, password: string, target: 'storefront' | 'admin' | undefined, env: WorkerEnv, selectedMembershipId?: string): Promise<LocalLogin> {
  const mobile = normalizeChineseMobile(identifier);
  const username = normalizeLocalUsername(identifier);
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const demoAlias = isDemoAuthEnabled(env) && getDemoAccounts(env).some((candidate) => candidate.username.trim().toLowerCase() === normalizedIdentifier);
  const provider = mobile ? 'local_phone' : demoAlias ? 'test' : username ? 'local_username' : isDemoAuthEnabled(env) ? 'test' : null;
  const subject = mobile ? await localPhoneSubject(mobile, env) : (username ?? identifier.trim().toLowerCase());
  if (!provider || !subject) return NO_LOCAL_LOGIN;
  // Always look the credential up unfiltered, so a target mismatch stays
  // distinguishable from a wrong password.
  const candidate = await callRpc<RegisteredCandidate | null>(env, 'api_local_login_candidate', {
    p_provider: provider,
    p_subject: subject,
    p_target: null,
  });
  if (!candidate?.memberId || !candidate.membershipId || !candidate.passwordHash) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return NO_LOCAL_LOGIN;
  }
  const credentialOnly = { runtime: null, credentialFound: true, mustResetPassword: false, passwordHash: null, entrances: [], targetUnavailable: false };
  if (!(await verifyPassword(password, candidate.passwordHash))) return credentialOnly;

  const entrances = readEntrances(candidate);
  const selected = selectedMembershipId
    ? entrances.find((entrance) => entrance.membershipId === selectedMembershipId && (!target || entrance.target === target))
    : target
      ? entrances.find((entrance) => entrance.target === target)
      : entrances[0];
  if (!selected && selectedMembershipId && target) {
    // A newly migrated selector may know about an additional membership before
    // an older candidate RPC has been upgraded to include every entrance. The
    // credential has already been verified; resolve the selected identity again
    // against that same member and the destination host before creating a session.
    return {
      runtime: await resolveMembershipRuntimeByIds(env, candidate.memberId, selectedMembershipId, target),
      credentialFound: true,
      mustResetPassword: candidate.mustResetPassword === true,
      passwordHash: candidate.passwordHash,
      entrances,
      targetUnavailable: false,
    };
  }
  // Falls back to the first entrance, which the RPC orders storefront-first:
  // shopping is the default landing for every account that has a mall identity.
  if (!selected) return { ...credentialOnly, entrances, targetUnavailable: entrances.length > 0 };
  return {
    runtime: runtimeFromCandidate(candidate, selected) ?? (await resolveMembershipRuntimeByIds(env, candidate.memberId, selected.membershipId, selected.target)),
    credentialFound: true,
    mustResetPassword: candidate.mustResetPassword === true,
    passwordHash: candidate.passwordHash,
    entrances,
    targetUnavailable: false,
  };
}

function readSelectedMembershipId(input: Record<string, unknown>): string | undefined {
  const value = input.membershipId;
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/.test(value) ? value : undefined;
}

async function listSelectableMemberships(env: WorkerEnv, memberId: string): Promise<SelectableMembership[]> {
  const raw = await callRpc<unknown>(env, 'api_list_login_memberships', { p_member_id: memberId });
  if (!Array.isArray(raw)) return [];
  const validScopes = new Set<NonNullable<SelectableMembership['subjectScope']>>(['平台', '租户', '企业', '供应商', '商城']);
  const memberships: SelectableMembership[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || (record.target !== 'storefront' && record.target !== 'admin') || record.status !== 'active') continue;
    memberships.push({
      id: record.id,
      target: record.target,
      status: 'active',
      enterpriseName: typeof record.enterpriseName === 'string' ? record.enterpriseName : '已绑定主体',
      storeName: typeof record.storeName === 'string' ? record.storeName : record.target === 'admin' ? '智慧翼运营后台' : '智慧翼企业福利商城',
      roleName: typeof record.roleName === 'string' ? record.roleName : record.target === 'admin' ? '运营成员' : '员工会员',
      dataScope: typeof record.dataScope === 'string' ? record.dataScope : record.target === 'admin' ? '已授权业务范围' : '个人福利账户',
      ...(typeof record.accountTypeLabel === 'string' ? { accountTypeLabel: record.accountTypeLabel } : {}),
      ...(typeof record.subjectScope === 'string' && validScopes.has(record.subjectScope as NonNullable<SelectableMembership['subjectScope']>) ? { subjectScope: record.subjectScope as NonNullable<SelectableMembership['subjectScope']> } : {}),
      ...(Array.isArray(record.keyPermissions) && record.keyPermissions.every((permission) => typeof permission === 'string') ? { keyPermissions: record.keyPermissions as string[] } : {}),
      ...(typeof record.expireAt === 'string' ? { expireAt: record.expireAt } : {}),
      ...(record.requiresStepUp === true ? { requiresStepUp: true } : {}),
    });
  }
  return memberships;
}

function fallbackSelectableMembership(runtime: MembershipRuntime): SelectableMembership {
  return {
    id: runtime.membership.id,
    target: runtime.membership.target,
    status: 'active',
    enterpriseName: '已绑定主体',
    storeName: runtime.membership.target === 'admin' ? '智慧翼运营后台' : '智慧翼企业福利商城',
    roleName: runtime.membership.target === 'admin' ? '运营成员' : '员工会员',
    dataScope: runtime.membership.target === 'admin' ? '已授权业务范围' : '个人福利账户',
    ...(runtime.membership.target === 'storefront' ? { accountTypeLabel: '福利账户' } : {}),
  };
}

async function readLoginInput(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    const raw = await request.text();
    if (raw.length > 32 * 1024) return null;
    const form = new URLSearchParams(raw);
    return { username: form.get('username') ?? '', password: form.get('password') ?? '', membershipId: form.get('membershipId') ?? '' };
  }

  const body = await readJsonBody(request);
  return body.ok && typeof body.value === 'object' && body.value !== null ? (body.value as Record<string, unknown>) : null;
}

function safeLoginRedirect(request: Request): string | null {
  const requested = new URL(request.url).searchParams.get('redirect');
  // Only a site-local absolute path may be used. This prevents an auth endpoint
  // from becoming an open redirector.
  return requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : null;
}

function publicAuthorization(context: import('./types').AuthorizationContext) {
  return {
    memberId: context.membership.memberId,
    membershipId: context.membership.id,
    target: context.membership.target,
    roles: context.roles,
    permissions: context.permissions,
  };
}

export async function handleLogout(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const session = await readSession(request, env);
  if (session) await callRpc<boolean>(env, 'api_revoke_auth_session', { p_actor_member_id: session.memberId, p_session_id: session.sessionId, p_reason: 'logout' });
  return json({ authenticated: false, requestId }, { headers: { 'set-cookie': clearSessionCookie(request) } });
}

export async function handleProducts(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const url = new URL(request.url);
  const category = url.searchParams.get('category')?.slice(0, 80) ?? null;
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '24', 10) || 24, 1), 100);
  const cursor = Math.max(Number.parseInt(url.searchParams.get('cursor') ?? '0', 10) || 0, 0);
  const rows = await callRpc<CatalogRow[]>(env, 'api_catalog_qualified', {
    p_tenant_id: authorization.tenantId,
    p_enterprise_id: authorization.enterpriseId,
    p_mall_id: authorization.mallId,
    p_user_id: authorization.userId,
    p_membership_id: authorization.membership.id,
    p_category: category,
    p_limit: limit,
    p_offset: cursor,
  });
  return json({
    items: rows.map((row) => ({
      id: row.id,
      skuId: row.sku_id,
      name: row.name,
      nameEn: row.name_en,
      nameZh: row.name_zh,
      subtitle: row.subtitle,
      subtitleEn: row.subtitle_en,
      subtitleZh: row.subtitle_zh,
      categoryCode: row.category_code,
      taxonomy: {
        l1: row.taxonomy_l1,
        l2: row.taxonomy_l2,
        l3: row.taxonomy_l3,
        status: row.classification_status,
      },
      coverUrl: row.cover_url,
      priceCents: Number(row.price_cents),
      marketPriceCents: row.market_price_cents === null ? null : Number(row.market_price_cents),
      availableStock: row.available_stock,
      supplierName: row.supplier_name,
      isTest: row.is_test,
      purchasable: row.purchasable,
      qualification: row.qualification,
    })),
    pagination: {
      cursor,
      nextCursor: rows.length === limit ? cursor + limit : null,
      limit,
    },
    requestId,
  });
}
