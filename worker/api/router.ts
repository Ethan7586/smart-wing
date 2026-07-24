import { can, resolveActor } from "./auth";
import { encryptJson, sha256 } from "./crypto";
import { apiError, json, methodNotAllowed } from "./http";
import { callRpc, isSupabaseConfigured } from "./supabase";
import type { Actor, WorkerEnv } from "./types";
import {
  clearSessionCookie,
  createSessionCookie,
  verifyAccessCode,
} from "./session";
import {
  parseCreateAfterSaleInput,
  parseCreateOrderInput,
  parseInternalPaymentInput,
} from "./validation";

interface CatalogRow {
  id: string;
  sku_id: string;
  name: string;
  subtitle: string | null;
  category_code: string;
  cover_url: string | null;
  price_cents: number;
  market_price_cents: number | null;
  available_stock: number;
  supplier_name: string;
}

interface AccountRow {
  id: string;
  account_type: string;
  balance_cents: number;
  status: string;
  updated_at: string;
}

interface OrderRow {
  id: string;
  orderNo: string;
  status: string;
  goodsAmountCents: number;
  discountCents: number;
  payableCents: number;
  paidCents: number;
  welfarePaidCents: number;
  mealPaidCents: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    productId: string;
    productTitle: string;
    productImage: string | null;
    priceCents: number;
    quantity: number;
    specs: Record<string, string>;
    itemType: string;
  }>;
}

interface BootstrapRow {
  mallName: string;
  brandName: string;
  enterpriseName: string;
}

interface HealthRow {
  databaseReady: boolean;
  tableCount: number;
}

const API_PREFIX = "/api/v1";
const DEFAULT_MALL_SLUG = "smart-wing-demo";

export async function routeApi(
  request: Request,
  env: WorkerEnv
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/health" && !url.pathname.startsWith(`${API_PREFIX}/`)) {
    return null;
  }
  const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();

  try {
    if (url.pathname === "/api/health") return handleHealth(request, env, requestId);
    if (url.pathname === `${API_PREFIX}/products`) {
      return handleProducts(request, env, requestId);
    }
    if (url.pathname === `${API_PREFIX}/auth/login`) {
      return handleLogin(request, env, requestId);
    }
    if (url.pathname === `${API_PREFIX}/auth/logout`) {
      return handleLogout(request, requestId);
    }

    const actor = await resolveActor(request, env);
    if (!actor) {
      return apiError(
        401,
        "AUTHENTICATION_REQUIRED",
        "生产身份认证尚未配置，服务端已拒绝匿名业务操作",
        requestId
      );
    }
    if (url.pathname === `${API_PREFIX}/bootstrap`) {
      return handleBootstrap(request, env, actor, requestId);
    }
    if (url.pathname === `${API_PREFIX}/auth/session`) {
      return json({ authenticated: true, actor, requestId });
    }
    if (url.pathname === `${API_PREFIX}/accounts`) {
      return handleAccounts(request, env, actor, requestId);
    }
    if (url.pathname === `${API_PREFIX}/account-ledgers`) {
      return handleAccountLedgers(request, env, actor, requestId);
    }
    if (url.pathname === `${API_PREFIX}/after-sales`) {
      return request.method === "POST"
        ? handleCreateAfterSale(request, env, actor, requestId)
        : handleAfterSales(request, env, actor, requestId);
    }
    if (url.pathname === `${API_PREFIX}/orders`) {
      return request.method === "POST"
        ? handleCreateOrder(request, env, actor, requestId)
        : handleOrders(request, env, actor, requestId);
    }
    const paymentMatch = url.pathname.match(
      /^\/api\/v1\/orders\/([^/]+)\/payments\/internal$/
    );
    if (paymentMatch) {
      return handleInternalPayment(
        request,
        env,
        actor,
        decodeURIComponent(paymentMatch[1]),
        requestId
      );
    }
    return apiError(404, "API_NOT_FOUND", "接口不存在", requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(JSON.stringify({
      level: "error",
      event: "api_request_failed",
      requestId,
      path: url.pathname,
      message,
    }));
    for (const [needle, status, code, text] of [
      ["IDEMPOTENCY_CONFLICT", 409, "IDEMPOTENCY_CONFLICT", "相同幂等键不能用于不同请求"],
      ["INSUFFICIENT_INVENTORY", 409, "INSUFFICIENT_INVENTORY", "部分商品库存不足"],
      ["INSUFFICIENT_ACCOUNT_BALANCE", 409, "INSUFFICIENT_ACCOUNT_BALANCE", "账户余额不足"],
      ["ORDER_NOT_FOUND", 404, "ORDER_NOT_FOUND", "订单不存在"],
      ["ORDER_NOT_PAYABLE", 409, "ORDER_NOT_PAYABLE", "订单当前状态不可支付"],
      ["ACCOUNT_NOT_ACTIVE", 409, "ACCOUNT_NOT_ACTIVE", "账户当前不可用"],
      ["PAYMENT_TOTAL_MISMATCH", 422, "PAYMENT_TOTAL_MISMATCH", "账户扣款合计必须等于订单应付金额"],
      ["SKU_NOT_AVAILABLE", 422, "SKU_NOT_AVAILABLE", "订单中存在无效商品"],
      ["INVALID_AFTER_SALE_INPUT", 422, "INVALID_AFTER_SALE_INPUT", "售后申请信息不完整"],
      ["ORDER_NOT_AFTER_SALE_ELIGIBLE", 409, "ORDER_NOT_AFTER_SALE_ELIGIBLE", "订单当前状态不可申请售后"],
      ["AFTER_SALE_AMOUNT_EXCEEDED", 422, "AFTER_SALE_AMOUNT_EXCEEDED", "售后申请金额超过订单实付金额"],
      ["AFTER_SALE_ALREADY_EXISTS", 409, "AFTER_SALE_ALREADY_EXISTS", "该订单已有处理中售后申请"],
    ] as const) {
      if (message.includes(needle)) return apiError(status, code, text, requestId);
    }
    return apiError(500, "INTERNAL_ERROR", "服务暂时不可用", requestId);
  }
}

async function handleHealth(
  request: Request,
  env: WorkerEnv,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"], requestId);
  let health: HealthRow = { databaseReady: false, tableCount: 0 };
  if (isSupabaseConfigured(env)) {
    health = await callRpc<HealthRow>(env, "api_health");
  }
  const authReady = Boolean(
    (env.SESSION_SIGNING_KEY && env.DEMO_LOGIN_CODE) ||
      (env.APP_ENV === "development" && env.AUTH_MODE === "development")
  );
  return json({
    service: "smart-wing-production-mvp",
    status: health.databaseReady ? "ok" : "degraded",
    checks: {
      database: health.databaseReady ? "ready_supabase_tokyo" : "configuration_required",
      authentication: authReady ? "mvp_session_ready" : "awaiting_enterprise_provider",
      piiEncryption: env.PII_ENCRYPTION_KEY ? "configured" : "required_for_orders",
    },
    database: { provider: "Supabase PostgreSQL", region: "ap-northeast-1" },
    requestId,
  });
}

async function handleLogin(
  request: Request,
  env: WorkerEnv,
  requestId: string
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"], requestId);
  const body = await readJsonBody(request);
  if (!body.ok || typeof body.value !== "object" || body.value === null) {
    return apiError(400, "INVALID_LOGIN_INPUT", "登录信息不完整", requestId);
  }
  const input = body.value as Record<string, unknown>;
  const accessCode = typeof input.accessCode === "string" ? input.accessCode : "";
  const ipHash = await sha256(
    `${request.headers.get("cf-connecting-ip") ?? "unknown"}:${env.SESSION_SIGNING_KEY ?? ""}`
  );
  const loginAllowed = await callRpc<boolean>(env, "api_login_allowed", {
    p_ip_hash: ipHash,
  });
  if (!loginAllowed) {
    return apiError(
      429,
      "LOGIN_RATE_LIMITED",
      "登录尝试过多，请15分钟后重试",
      requestId
    );
  }
  if (!(await verifyAccessCode(accessCode, env.DEMO_LOGIN_CODE))) {
    await callRpc<string | null>(env, "api_record_login_failure", {
      p_ip_hash: ipHash,
    });
    return apiError(401, "INVALID_ACCESS_CODE", "访问码不正确", requestId);
  }

  const employeeNo = "SW0001";
  const mallCode = "SMART_WING_DEMO";
  const actor = await callRpc<Actor | null>(env, "api_resolve_actor", {
    p_employee_no: employeeNo,
    p_mall_code: mallCode,
  });
  if (!actor) {
    return apiError(503, "DEMO_ACTOR_NOT_READY", "演示员工尚未初始化", requestId);
  }
  await callRpc<null>(env, "api_clear_login_failures", { p_ip_hash: ipHash });
  const cookie = await createSessionCookie(env, employeeNo, mallCode);
  return json(
    { authenticated: true, actor, requestId },
    { headers: { "set-cookie": cookie } }
  );
}

async function handleLogout(
  request: Request,
  requestId: string
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"], requestId);
  return json(
    { authenticated: false, requestId },
    { headers: { "set-cookie": clearSessionCookie() } }
  );
}

async function handleProducts(
  request: Request,
  env: WorkerEnv,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"], requestId);
  const url = new URL(request.url);
  const mallSlug = (url.searchParams.get("mall") ?? DEFAULT_MALL_SLUG).slice(0, 80);
  const category = url.searchParams.get("category")?.slice(0, 80) ?? null;
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "24", 10) || 24, 1), 100);
  const cursor = Math.max(Number.parseInt(url.searchParams.get("cursor") ?? "0", 10) || 0, 0);
  const rows = await callRpc<CatalogRow[]>(env, "api_catalog", {
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
      subtitle: row.subtitle,
      categoryCode: row.category_code,
      coverUrl: row.cover_url,
      priceCents: Number(row.price_cents),
      marketPriceCents: row.market_price_cents === null ? null : Number(row.market_price_cents),
      availableStock: row.available_stock,
      supplierName: row.supplier_name,
    })),
    pagination: { cursor, nextCursor: rows.length === limit ? cursor + limit : null, limit },
    requestId,
  });
}

async function handleBootstrap(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"], requestId);
  const scope = await callRpc<BootstrapRow | null>(env, "api_bootstrap", actorScope(actor));
  return json({
    actor: {
      userId: actor.userId,
      employeeNo: actor.employeeNo,
      roles: actor.roles,
      permissions: actor.permissions,
    },
    scope: {
      tenantId: actor.tenantId,
      enterpriseId: actor.enterpriseId,
      mallId: actor.mallId,
      mallCode: actor.mallCode,
      mallName: scope?.mallName ?? "",
      brandName: scope?.brandName ?? "",
      enterpriseName: scope?.enterpriseName ?? "",
    },
    requestId,
  });
}

async function handleAccounts(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"], requestId);
  const rows = await callRpc<AccountRow[]>(env, "api_accounts", actorScope(actor, true));
  return json({
    items: rows.map((row) => ({
      id: row.id,
      type: row.account_type,
      balanceCents: Number(row.balance_cents),
      status: row.status,
      updatedAt: row.updated_at,
    })),
    requestId,
  });
}

async function handleAccountLedgers(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET"], requestId);
  const rows = await callRpc<Array<Record<string, unknown>>>(
    env,
    "api_account_ledgers",
    actorScope(actor, true)
  );
  return json({ items: rows, requestId });
}

async function handleAfterSales(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET", "POST"], requestId);
  if (!can(actor, "order:read:own")) {
    return apiError(403, "FORBIDDEN", "没有查看售后记录的权限", requestId);
  }
  const rows = await callRpc<Array<Record<string, unknown>>>(
    env,
    "api_after_sales",
    actorScope(actor, true)
  );
  return json({ items: rows, requestId });
}

async function handleCreateAfterSale(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (!can(actor, "order:create")) {
    return apiError(403, "FORBIDDEN", "没有提交售后的权限", requestId);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseCreateAfterSaleInput(body.value);
  if (!input) {
    return apiError(422, "INVALID_AFTER_SALE_INPUT", "售后申请信息不完整", requestId);
  }
  const response = await callRpc<Record<string, unknown>>(
    env,
    "api_create_after_sale",
    {
      ...actorScope(actor, true),
      p_order_id: input.orderId,
      p_type: input.type,
      p_reason: input.reason,
      p_requested_amount_cents: input.requestedAmountCents,
      p_request_id: requestId,
      p_user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
    }
  );
  return json(response, { status: 201 });
}

async function handleOrders(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed(["GET", "POST"], requestId);
  if (!can(actor, "order:read:own")) {
    return apiError(403, "FORBIDDEN", "没有查看订单的权限", requestId);
  }
  const rows = await callRpc<OrderRow[]>(env, "api_order_views", actorScope(actor, true));
  return json({
    items: rows,
    requestId,
  });
}

async function handleCreateOrder(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (!can(actor, "order:create")) {
    return apiError(403, "FORBIDDEN", "没有创建订单的权限", requestId);
  }
  if (!env.PII_ENCRYPTION_KEY) {
    return apiError(503, "PII_ENCRYPTION_NOT_CONFIGURED", "收货信息加密密钥尚未配置，系统已阻止订单写入", requestId);
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "创建订单必须提供 Idempotency-Key", requestId);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseCreateOrderInput(body.value);
  if (!input) return apiError(422, "INVALID_ORDER_INPUT", "订单商品或收货信息不完整", requestId);
  const response = await callRpc<Record<string, unknown>>(env, "api_create_order", {
    ...actorScope(actor, true),
    p_items: input.items,
    p_recipient_cipher: JSON.parse(await encryptJson(input.recipient, env.PII_ENCRYPTION_KEY)),
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256(JSON.stringify(input)),
    p_request_id: requestId,
    p_user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
  });
  return json(response, { status: 201 });
}

async function handleInternalPayment(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  orderId: string,
  requestId: string
): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(["POST"], requestId);
  if (!can(actor, "order:create")) {
    return apiError(403, "FORBIDDEN", "没有支付订单的权限", requestId);
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return apiError(400, "IDEMPOTENCY_KEY_REQUIRED", "支付必须提供 Idempotency-Key", requestId);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseInternalPaymentInput(body.value);
  if (!input) return apiError(422, "INVALID_PAYMENT_INPUT", "账户支付金额无效", requestId);
  const response = await callRpc<Record<string, unknown>>(env, "api_pay_internal", {
    ...actorScope(actor, true),
    p_order_id: orderId,
    p_welfare_cents: input.welfareCents,
    p_meal_cents: input.mealCents,
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256(JSON.stringify({ orderId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
  });
  return json(response, { status: 201 });
}

function actorScope(actor: Actor, includeUser = false): Record<string, string> {
  return {
    p_tenant_id: actor.tenantId,
    p_enterprise_id: actor.enterpriseId,
    p_mall_id: actor.mallId,
    ...(includeUser ? { p_user_id: actor.userId } : {}),
  };
}

function invalidBody(tooLarge: boolean, requestId: string): Response {
  return apiError(
    tooLarge ? 413 : 400,
    tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_JSON",
    tooLarge ? "请求内容超过允许大小" : "请求内容不是有效 JSON",
    requestId
  );
}

async function readJsonBody(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  const maximumBytes = 32 * 1024;
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (declaredLength > maximumBytes) return { ok: false, tooLarge: true };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    return { ok: false, tooLarge: true };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}
