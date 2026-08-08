import { sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { readJsonBody } from './routerSupport';
import { clearSessionCookie, createSessionCookie, verifyAccessCode } from './session';
import { callRpc, isSupabaseConfigured } from './supabase';
import type { Actor, WorkerEnv } from './types';

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
}

const DEFAULT_MALL_SLUG = 'smart-wing-demo';

export async function handleHealth(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  let health = { databaseReady: false, tableCount: 0 };
  if (isSupabaseConfigured(env)) {
    health = await callRpc<typeof health>(env, 'api_health');
  }
  const authReady = Boolean((env.SESSION_SIGNING_KEY && env.DEMO_LOGIN_CODE) || (env.APP_ENV === 'development' && env.AUTH_MODE === 'development'));
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
  const body = await readJsonBody(request);
  if (!body.ok || typeof body.value !== 'object' || body.value === null) {
    return apiError(400, 'INVALID_LOGIN_INPUT', '登录信息不完整', requestId);
  }
  const input = body.value as Record<string, unknown>;
  const accessCode = typeof input.accessCode === 'string' ? input.accessCode : '';
  const ipHash = await sha256(`${request.headers.get('cf-connecting-ip') ?? 'unknown'}:${env.SESSION_SIGNING_KEY ?? ''}`);
  const loginAllowed = await callRpc<boolean>(env, 'api_login_allowed', {
    p_ip_hash: ipHash,
  });
  if (!loginAllowed) {
    return apiError(429, 'LOGIN_RATE_LIMITED', '登录尝试过多，请15分钟后重试', requestId);
  }
  if (!(await verifyAccessCode(accessCode, env.DEMO_LOGIN_CODE))) {
    await callRpc<string | null>(env, 'api_record_login_failure', {
      p_ip_hash: ipHash,
    });
    return apiError(401, 'INVALID_ACCESS_CODE', '访问码不正确', requestId);
  }
  const employeeNo = 'SW0001';
  const mallCode = 'SMART_WING_DEMO';
  const actor = await callRpc<Actor | null>(env, 'api_resolve_actor', {
    p_employee_no: employeeNo,
    p_mall_code: mallCode,
  });
  if (!actor) {
    return apiError(503, 'DEMO_ACTOR_NOT_READY', '演示员工尚未初始化', requestId);
  }
  await callRpc<boolean>(env, 'api_clear_login_failures', { p_ip_hash: ipHash });
  const cookie = await createSessionCookie(env, employeeNo, mallCode);
  return json({ authenticated: true, actor, requestId }, { headers: { 'set-cookie': cookie } });
}

export async function handleLogout(request: Request, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  return json({ authenticated: false, requestId }, { headers: { 'set-cookie': clearSessionCookie() } });
}

export async function handleProducts(request: Request, env: WorkerEnv, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const url = new URL(request.url);
  const mallSlug = (url.searchParams.get('mall') ?? DEFAULT_MALL_SLUG).slice(0, 80);
  const category = url.searchParams.get('category')?.slice(0, 80) ?? null;
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '24', 10) || 24, 1), 100);
  const cursor = Math.max(Number.parseInt(url.searchParams.get('cursor') ?? '0', 10) || 0, 0);
  const rows = await callRpc<CatalogRow[]>(env, 'api_catalog', {
    p_mall_slug: mallSlug,
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
    })),
    pagination: {
      cursor,
      nextCursor: rows.length === limit ? cursor + limit : null,
      limit,
    },
    requestId,
  });
}
