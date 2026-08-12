import { sha256 } from './crypto';
import { getDemoAccounts, isDemoAuthEnabled, resolveDemoMembership, verifyDemoPassword } from './demoAuth';
import { apiError, json, methodNotAllowed } from './http';
import { isTestLoginRateLimitBypassed, readTrustedClientIp } from './loginRateLimitBypass';
import { readJsonBody } from './routerSupport';
import { clearSessionCookie, createSessionCookie, targetForRequest } from './session';
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
  let health = { databaseReady: false, tableCount: 0 };
  if (isSupabaseConfigured(env)) {
    health = await callRpc<typeof health>(env, 'api_health');
  }
  const authReady = Boolean(env.SESSION_SIGNING_KEY && env.ADMIN_SESSION_SIGNING_KEY && (env.AUTH_MODE === 'membership' || isDemoAuthEnabled(env)));
  const piiReady = Boolean(env.PII_ENCRYPTION_KEY);
  const status = health.databaseReady && authReady && piiReady ? 'ok' : 'degraded';
  return json({
    service: 'smart-wing-production-mvp',
    status,
    checks: {
      database: health.databaseReady ? 'ready' : 'configuration_required',
      authentication: authReady ? 'mvp_session_ready' : 'awaiting_enterprise_provider',
      piiEncryption: piiReady ? 'configured' : 'required_for_orders',
    },
    database: { provider: 'Supabase PostgreSQL', region: env.SUPABASE_REGION ?? 'unconfigured' },
    requestId,
  });
}

export async function handleLogin(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (!isDemoAuthEnabled(env)) {
    return apiError(503, 'AUTH_PROVIDER_NOT_CONFIGURED', '生产环境仅接受已配置的企业身份提供方登录', requestId);
  }
  const input = await readLoginInput(request);
  if (!input) return apiError(400, 'INVALID_LOGIN_INPUT', '登录信息不完整', requestId);
  const username = typeof input.username === 'string' ? input.username : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const clientIp = readTrustedClientIp(request);
  const ipHash = await sha256(`${clientIp ?? 'unknown'}:${env.SESSION_SIGNING_KEY ?? ''}`);
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
  const account = getDemoAccounts(env).find((candidate) => candidate.username.trim().toLowerCase() === username.trim().toLowerCase());
  if (!account || !(await verifyDemoPassword(password, account.password))) {
    if (!bypassRateLimit) {
      await callRpc<string | null>(env, 'api_record_login_failure', {
        p_ip_hash: ipHash,
      });
    }
    return apiError(401, 'INVALID_USERNAME_PASSWORD', '账号或密码不正确', requestId);
  }
  const target = targetForRequest(request);
  const runtime = await resolveDemoMembership(env, account, target);
  if (!runtime) {
    if (!bypassRateLimit) {
      await callRpc<string | null>(env, 'api_record_login_failure', { p_ip_hash: ipHash });
    }
    return apiError(503, 'DEMO_MEMBERSHIP_NOT_READY', '演示会员关系尚未初始化', requestId);
  }
  await callRpc<boolean>(env, 'api_clear_login_failures', { p_ip_hash: ipHash });
  const cookie = await createSessionCookie(env, runtime.authorization.employeeNo, runtime.authorization.mallCode, {
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

async function readLoginInput(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    const raw = await request.text();
    if (raw.length > 32 * 1024) return null;
    const form = new URLSearchParams(raw);
    return { username: form.get('username') ?? '', password: form.get('password') ?? '' };
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

export async function handleLogout(request: Request, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
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
