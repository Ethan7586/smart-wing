import { can, resolveActor } from "./auth";
import { encryptJson, sha256 } from "./crypto";
import { apiError, json, methodNotAllowed } from "./http";
import type { Actor, WorkerEnv } from "./types";
import {
  parseCreateOrderInput,
  parseInternalPaymentInput,
  type CreateOrderInput,
  type InternalPaymentInput,
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

interface OrderSkuRow {
  sku_id: string;
  product_id: string;
  product_name: string;
  specs_json: string;
  unit_price_cents: number;
  supplier_id: string;
  available_stock: number;
}

interface ExistingIdempotencyRow {
  request_hash: string;
  response_json: string | null;
}

interface AccountRow {
  id: string;
  account_type: string;
  balance_cents: number;
  status: string;
  updated_at: string;
}

interface OrderListRow {
  id: string;
  order_no: string;
  status: string;
  goods_amount_cents: number;
  discount_cents: number;
  payable_cents: number;
  paid_cents: number;
  created_at: string;
  updated_at: string;
}

interface PayableOrderRow {
  id: string;
  order_no: string;
  payable_cents: number;
  paid_cents: number;
  status: string;
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
    if (url.pathname === "/api/health") {
      return handleHealth(request, env, requestId);
    }
    if (url.pathname === `${API_PREFIX}/products`) {
      return handleProducts(request, env, requestId);
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
    if (url.pathname === `${API_PREFIX}/accounts`) {
      return handleAccounts(request, env, actor, requestId);
    }
    if (url.pathname === `${API_PREFIX}/orders`) {
      return request.method === "POST"
        ? handleCreateOrder(request, env, actor, requestId)
        : handleOrders(request, env, actor, requestId);
    }
    const internalPaymentMatch = url.pathname.match(
      /^\/api\/v1\/orders\/([^/]+)\/payments\/internal$/
    );
    if (internalPaymentMatch) {
      return handleInternalPayment(
        request,
        env,
        actor,
        decodeURIComponent(internalPaymentMatch[1]),
        requestId
      );
    }

    return apiError(404, "API_NOT_FOUND", "接口不存在", requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(
      JSON.stringify({
        level: "error",
        event: "api_request_failed",
        requestId,
        path: url.pathname,
        message,
      })
    );

    if (message.includes("INSUFFICIENT_INVENTORY")) {
      return apiError(409, "INSUFFICIENT_INVENTORY", "部分商品库存不足", requestId);
    }
    if (message.includes("INSUFFICIENT_ACCOUNT_BALANCE")) {
      return apiError(409, "INSUFFICIENT_ACCOUNT_BALANCE", "账户余额不足", requestId);
    }
    if (message.includes("ORDER_PAYMENT_EXCEEDS_PAYABLE")) {
      return apiError(409, "ORDER_ALREADY_PAID", "订单已支付或正在支付", requestId);
    }
    if (message.includes("ORDER_NOT_PAYABLE")) {
      return apiError(409, "ORDER_NOT_PAYABLE", "订单当前状态不可支付", requestId);
    }
    if (message.includes("ACCOUNT_NOT_ACTIVE")) {
      return apiError(409, "ACCOUNT_NOT_ACTIVE", "账户当前不可用", requestId);
    }
    return apiError(500, "INTERNAL_ERROR", "服务暂时不可用", requestId);
  }
}

async function handleInternalPayment(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  orderId: string,
  requestId: string
): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"], requestId);
  }
  if (!can(actor, "order:create")) {
    return apiError(403, "FORBIDDEN", "没有支付订单的权限", requestId);
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return apiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "支付必须提供 Idempotency-Key",
      requestId
    );
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return apiError(
      bodyResult.tooLarge ? 413 : 400,
      bodyResult.tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_JSON",
      bodyResult.tooLarge ? "请求内容超过允许大小" : "请求内容不是有效 JSON",
      requestId
    );
  }
  const input = parseInternalPaymentInput(bodyResult.value);
  if (!input) {
    return apiError(422, "INVALID_PAYMENT_INPUT", "账户支付金额无效", requestId);
  }

  const requestHash = await sha256(JSON.stringify({ orderId, ...input }));
  const existing = await env.DB.prepare(
    `SELECT request_hash, response_json
     FROM idempotency_keys
     WHERE mall_id = ?
       AND scope = 'payment:internal'
       AND idempotency_key = ?
       AND expires_at > CURRENT_TIMESTAMP`
  )
    .bind(actor.mallId, idempotencyKey)
    .first<ExistingIdempotencyRow>();

  if (existing) {
    if (existing.request_hash !== requestHash) {
      return apiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "相同幂等键不能用于不同支付内容",
        requestId
      );
    }
    return json(
      existing.response_json ? JSON.parse(existing.response_json) : { requestId }
    );
  }

  return persistInternalPayment(
    env,
    actor,
    orderId,
    input,
    idempotencyKey,
    requestHash,
    requestId,
    request.headers.get("user-agent")
  );
}

async function persistInternalPayment(
  env: WorkerEnv,
  actor: Actor,
  orderId: string,
  input: InternalPaymentInput,
  idempotencyKey: string,
  requestHash: string,
  requestId: string,
  userAgent: string | null
): Promise<Response> {
  const [order, accountRows] = await Promise.all([
    env.DB.prepare(
      `SELECT id, order_no, payable_cents, paid_cents, status
       FROM orders
       WHERE tenant_id = ?
         AND enterprise_id = ?
         AND mall_id = ?
         AND user_id = ?
         AND id = ?
       LIMIT 1`
    )
      .bind(
        actor.tenantId,
        actor.enterpriseId,
        actor.mallId,
        actor.userId,
        orderId
      )
      .first<PayableOrderRow>(),
    env.DB.prepare(
      `SELECT id, account_type, balance_cents, status, updated_at
       FROM welfare_accounts
       WHERE tenant_id = ?
         AND enterprise_id = ?
         AND mall_id = ?
         AND user_id = ?
         AND account_type IN ('welfare', 'meal')`
    )
      .bind(actor.tenantId, actor.enterpriseId, actor.mallId, actor.userId)
      .all<AccountRow>(),
  ]);

  if (!order) {
    return apiError(404, "ORDER_NOT_FOUND", "订单不存在", requestId);
  }
  if (order.status !== "pending_payment" || order.paid_cents !== 0) {
    return apiError(409, "ORDER_NOT_PAYABLE", "订单当前状态不可支付", requestId);
  }

  const total = input.welfareCents + input.mealCents;
  if (total !== order.payable_cents) {
    return apiError(
      422,
      "PAYMENT_TOTAL_MISMATCH",
      "账户扣款合计必须等于订单应付金额",
      requestId
    );
  }

  const accounts = new Map(
    accountRows.results.map((account) => [account.account_type, account])
  );
  const allocations = [
    { channel: "welfare", amountCents: input.welfareCents },
    { channel: "meal", amountCents: input.mealCents },
  ].filter((allocation) => allocation.amountCents > 0);

  for (const allocation of allocations) {
    const account = accounts.get(allocation.channel);
    if (
      !account ||
      account.status !== "active" ||
      account.balance_cents < allocation.amountCents
    ) {
      return apiError(
        409,
        "INSUFFICIENT_ACCOUNT_BALANCE",
        `${allocation.channel === "welfare" ? "福利" : "餐"}卡余额不足`,
        requestId
      );
    }
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  const paymentNos: string[] = [];

  for (const allocation of allocations) {
    const account = accounts.get(allocation.channel)!;
    const paymentId = crypto.randomUUID();
    const paymentNo = createBusinessNo("PAY");
    paymentNos.push(paymentNo);
    statements.push(
      env.DB.prepare(
        `UPDATE welfare_accounts
         SET balance_cents = balance_cents - ?,
             version = version + 1,
             updated_at = ?
         WHERE tenant_id = ?
           AND mall_id = ?
           AND user_id = ?
           AND id = ?
           AND status = 'active'`
      ).bind(
        allocation.amountCents,
        now,
        actor.tenantId,
        actor.mallId,
        actor.userId,
        account.id
      ),
      env.DB.prepare(
        `INSERT INTO account_ledgers (
           id, tenant_id, mall_id, account_id, user_id, direction,
           amount_cents, balance_after_cents, business_type, business_id,
           idempotency_key, created_at
         )
         SELECT ?, ?, ?, ?, ?, 'debit', ?, balance_cents,
           'order_payment', ?, ?, ?
         FROM welfare_accounts
         WHERE tenant_id = ?
           AND mall_id = ?
           AND user_id = ?
           AND id = ?`
      ).bind(
        crypto.randomUUID(),
        actor.tenantId,
        actor.mallId,
        account.id,
        actor.userId,
        allocation.amountCents,
        orderId,
        `${idempotencyKey}:${allocation.channel}`,
        now,
        actor.tenantId,
        actor.mallId,
        actor.userId,
        account.id
      ),
      env.DB.prepare(
        `INSERT INTO payments (
           id, payment_no, tenant_id, mall_id, user_id, order_id, channel,
           status, amount_cents, idempotency_key, created_at, completed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?)`
      ).bind(
        paymentId,
        paymentNo,
        actor.tenantId,
        actor.mallId,
        actor.userId,
        orderId,
        allocation.channel,
        allocation.amountCents,
        `${idempotencyKey}:${allocation.channel}`,
        now,
        now
      ),
      env.DB.prepare(
        `INSERT INTO payment_allocations (
           id, tenant_id, mall_id, payment_id, order_id, account_id,
           channel, amount_cents
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        actor.tenantId,
        actor.mallId,
        paymentId,
        orderId,
        account.id,
        allocation.channel,
        allocation.amountCents
      )
    );
  }

  const responseBody = {
    payment: {
      orderId,
      orderNo: order.order_no,
      paymentNos,
      status: "succeeded",
      amountCents: total,
      completedAt: now,
    },
    requestId,
  };

  statements.push(
    env.DB.prepare(
      `UPDATE orders
       SET paid_cents = paid_cents + ?,
           status = 'paid',
           paid_at = ?,
           updated_at = ?
       WHERE tenant_id = ?
         AND mall_id = ?
         AND user_id = ?
         AND id = ?
         AND status = 'pending_payment'
         AND paid_cents = 0`
    ).bind(
      total,
      now,
      now,
      actor.tenantId,
      actor.mallId,
      actor.userId,
      orderId
    ),
    env.DB.prepare(
      `UPDATE sub_orders
       SET status = 'paid', updated_at = ?
       WHERE tenant_id = ?
         AND mall_id = ?
         AND parent_order_id = ?`
    ).bind(now, actor.tenantId, actor.mallId, orderId),
    env.DB.prepare(
      `INSERT INTO idempotency_keys (
         tenant_id, mall_id, scope, idempotency_key, request_hash,
         resource_id, response_json, created_at, expires_at
       ) VALUES (?, ?, 'payment:internal', ?, ?, ?, ?, ?, datetime(?, '+24 hours'))`
    ).bind(
      actor.tenantId,
      actor.mallId,
      idempotencyKey,
      requestHash,
      orderId,
      JSON.stringify(responseBody),
      now,
      now
    ),
    env.DB.prepare(
      `INSERT INTO audit_logs (
         id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type,
         action, resource_type, resource_id, request_id, user_agent, after_json,
         created_at
       ) VALUES (?, ?, ?, ?, ?, 'user', 'payment.internal.succeeded',
         'order', ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      actor.tenantId,
      actor.enterpriseId,
      actor.mallId,
      actor.userId,
      orderId,
      requestId,
      (userAgent ?? "").slice(0, 300),
      JSON.stringify({ amountCents: total, paymentNos }),
      now
    )
  );

  await env.DB.batch(statements);
  return json(responseBody, { status: 201 });
}

async function handleHealth(
  request: Request,
  env: WorkerEnv,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"], requestId);
  }

  const schema = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM sqlite_master
     WHERE type = 'table'
       AND name IN ('tenants', 'products', 'orders', 'audit_logs')`
  ).first<{ count: number }>();
  const databaseReady = schema?.count === 4;
  const authReady =
    env.APP_ENV === "development" && env.AUTH_MODE === "development";

  return json({
    service: "smart-wing-production-mvp",
    status: databaseReady ? "ok" : "degraded",
    checks: {
      database: databaseReady ? "ready" : "migration_required",
      authentication: authReady
        ? "development_only"
        : "awaiting_enterprise_provider",
      piiEncryption: env.PII_ENCRYPTION_KEY ? "configured" : "required_for_orders",
    },
    requestId,
  });
}

async function handleProducts(
  request: Request,
  env: WorkerEnv,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"], requestId);
  }

  const url = new URL(request.url);
  const mallSlug = (url.searchParams.get("mall") ?? DEFAULT_MALL_SLUG).slice(0, 80);
  const category = url.searchParams.get("category")?.slice(0, 80) ?? null;
  const limit = Math.min(
    Math.max(Number.parseInt(url.searchParams.get("limit") ?? "24", 10) || 24, 1),
    100
  );
  const cursor = Math.max(
    Number.parseInt(url.searchParams.get("cursor") ?? "0", 10) || 0,
    0
  );

  const query = category
    ? env.DB.prepare(
        `SELECT
           p.id,
           s.id AS sku_id,
           p.name,
           p.subtitle,
           p.category_code,
           p.cover_url,
           s.price_cents,
           s.market_price_cents,
           (i.available_qty - i.reserved_qty) AS available_stock,
           supplier.name AS supplier_name
         FROM products p
         JOIN malls m ON m.id = p.mall_id
         JOIN skus s ON s.product_id = p.id AND s.mall_id = p.mall_id
         JOIN inventory i ON i.sku_id = s.id AND i.mall_id = p.mall_id
         JOIN suppliers supplier ON supplier.id = p.supplier_id
         WHERE m.public_slug = ?
           AND p.category_code = ?
           AND p.status = 'active'
           AND s.status = 'active'
           AND m.status = 'active'
         ORDER BY p.created_at DESC, s.id
         LIMIT ? OFFSET ?`
      ).bind(mallSlug, category, limit, cursor)
    : env.DB.prepare(
        `SELECT
           p.id,
           s.id AS sku_id,
           p.name,
           p.subtitle,
           p.category_code,
           p.cover_url,
           s.price_cents,
           s.market_price_cents,
           (i.available_qty - i.reserved_qty) AS available_stock,
           supplier.name AS supplier_name
         FROM products p
         JOIN malls m ON m.id = p.mall_id
         JOIN skus s ON s.product_id = p.id AND s.mall_id = p.mall_id
         JOIN inventory i ON i.sku_id = s.id AND i.mall_id = p.mall_id
         JOIN suppliers supplier ON supplier.id = p.supplier_id
         WHERE m.public_slug = ?
           AND p.status = 'active'
           AND s.status = 'active'
           AND m.status = 'active'
         ORDER BY p.created_at DESC, s.id
         LIMIT ? OFFSET ?`
      ).bind(mallSlug, limit, cursor);

  const rows = await query.all<CatalogRow>();
  return json({
    items: rows.results.map((row) => ({
      id: row.id,
      skuId: row.sku_id,
      name: row.name,
      subtitle: row.subtitle,
      categoryCode: row.category_code,
      coverUrl: row.cover_url,
      priceCents: row.price_cents,
      marketPriceCents: row.market_price_cents,
      availableStock: row.available_stock,
      supplierName: row.supplier_name,
    })),
    pagination: {
      cursor,
      nextCursor: rows.results.length === limit ? cursor + limit : null,
      limit,
    },
    requestId,
  });
}

async function handleBootstrap(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"], requestId);
  }

  const mall = await env.DB.prepare(
    `SELECT m.name, m.brand_name, e.name AS enterprise_name
     FROM malls m
     JOIN enterprises e ON e.id = m.enterprise_id
     WHERE m.tenant_id = ?
       AND m.id = ?
       AND e.id = ?`
  )
    .bind(actor.tenantId, actor.mallId, actor.enterpriseId)
    .first<{ name: string; brand_name: string; enterprise_name: string }>();

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
      mallName: mall?.name ?? "",
      brandName: mall?.brand_name ?? "",
      enterpriseName: mall?.enterprise_name ?? "",
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
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"], requestId);
  }

  const rows = await env.DB.prepare(
    `SELECT id, account_type, balance_cents, status, updated_at
     FROM welfare_accounts
     WHERE tenant_id = ?
       AND enterprise_id = ?
       AND mall_id = ?
       AND user_id = ?
     ORDER BY account_type`
  )
    .bind(actor.tenantId, actor.enterpriseId, actor.mallId, actor.userId)
    .all<AccountRow>();

  return json({
    items: rows.results.map((row) => ({
      id: row.id,
      type: row.account_type,
      balanceCents: row.balance_cents,
      status: row.status,
      updatedAt: row.updated_at,
    })),
    requestId,
  });
}

async function handleOrders(
  request: Request,
  env: WorkerEnv,
  actor: Actor,
  requestId: string
): Promise<Response> {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET", "POST"], requestId);
  }
  if (!can(actor, "order:read:own")) {
    return apiError(403, "FORBIDDEN", "没有查看订单的权限", requestId);
  }

  const rows = await env.DB.prepare(
    `SELECT
       id, order_no, status, goods_amount_cents, discount_cents,
       payable_cents, paid_cents, created_at, updated_at
     FROM orders
     WHERE tenant_id = ?
       AND enterprise_id = ?
       AND mall_id = ?
       AND user_id = ?
     ORDER BY created_at DESC
     LIMIT 100`
  )
    .bind(actor.tenantId, actor.enterpriseId, actor.mallId, actor.userId)
    .all<OrderListRow>();

  return json({
    items: rows.results.map((row) => ({
      id: row.id,
      orderNo: row.order_no,
      status: row.status,
      goodsAmountCents: row.goods_amount_cents,
      discountCents: row.discount_cents,
      payableCents: row.payable_cents,
      paidCents: row.paid_cents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
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
    return apiError(
      503,
      "PII_ENCRYPTION_NOT_CONFIGURED",
      "收货信息加密密钥尚未配置，系统已阻止订单写入",
      requestId
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return apiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "创建订单必须提供 Idempotency-Key",
      requestId
    );
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return apiError(
      bodyResult.tooLarge ? 413 : 400,
      bodyResult.tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_JSON",
      bodyResult.tooLarge ? "请求内容超过允许大小" : "请求内容不是有效 JSON",
      requestId
    );
  }
  const input = parseCreateOrderInput(bodyResult.value);
  if (!input) {
    return apiError(422, "INVALID_ORDER_INPUT", "订单商品或收货信息不完整", requestId);
  }

  const requestHash = await sha256(JSON.stringify(input));
  const existing = await env.DB.prepare(
    `SELECT request_hash, response_json
     FROM idempotency_keys
     WHERE mall_id = ?
       AND scope = 'order:create'
       AND idempotency_key = ?
       AND expires_at > CURRENT_TIMESTAMP`
  )
    .bind(actor.mallId, idempotencyKey)
    .first<ExistingIdempotencyRow>();

  if (existing) {
    if (existing.request_hash !== requestHash) {
      return apiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "相同幂等键不能用于不同订单内容",
        requestId
      );
    }
    return json(
      existing.response_json ? JSON.parse(existing.response_json) : { requestId },
      { status: 200 }
    );
  }

  return persistOrder(
    env,
    actor,
    input,
    idempotencyKey,
    requestHash,
    requestId,
    request.headers.get("user-agent")
  );
}

async function persistOrder(
  env: WorkerEnv,
  actor: Actor,
  input: CreateOrderInput,
  idempotencyKey: string,
  requestHash: string,
  requestId: string,
  userAgent: string | null
): Promise<Response> {
  const skuRows = await Promise.all(
    input.items.map((item) =>
      env.DB.prepare(
        `SELECT
           s.id AS sku_id,
           p.id AS product_id,
           p.name AS product_name,
           s.specs_json,
           s.price_cents AS unit_price_cents,
           p.supplier_id,
           (i.available_qty - i.reserved_qty) AS available_stock
         FROM skus s
         JOIN products p ON p.id = s.product_id
         JOIN inventory i ON i.sku_id = s.id
         WHERE s.tenant_id = ?
           AND s.mall_id = ?
           AND s.id = ?
           AND s.status = 'active'
           AND p.status = 'active'
         LIMIT 1`
      )
        .bind(actor.tenantId, actor.mallId, item.skuId)
        .first<OrderSkuRow>()
    )
  );

  if (skuRows.some((row) => row === null)) {
    return apiError(422, "SKU_NOT_AVAILABLE", "订单中存在无效商品", requestId);
  }

  const catalog = new Map(skuRows.map((row) => [row!.sku_id, row!]));
  for (const item of input.items) {
    if (catalog.get(item.skuId)!.available_stock < item.quantity) {
      return apiError(409, "INSUFFICIENT_INVENTORY", "部分商品库存不足", requestId);
    }
  }

  const orderId = crypto.randomUUID();
  const orderNo = createBusinessNo("SW");
  const createdAt = new Date().toISOString();
  const recipientEncrypted = await encryptJson(
    input.recipient,
    env.PII_ENCRYPTION_KEY!
  );
  const goodsAmountCents = input.items.reduce(
    (total, item) =>
      total + catalog.get(item.skuId)!.unit_price_cents * item.quantity,
    0
  );

  const suppliers = new Map<string, typeof input.items>();
  for (const item of input.items) {
    const supplierId = catalog.get(item.skuId)!.supplier_id;
    const items = suppliers.get(supplierId) ?? [];
    items.push(item);
    suppliers.set(supplierId, items);
  }

  const responseBody = {
    order: {
      id: orderId,
      orderNo,
      status: "pending_payment",
      goodsAmountCents,
      discountCents: 0,
      payableCents: goodsAmountCents,
      paidCents: 0,
      createdAt,
    },
    requestId,
  };
  const statements: D1PreparedStatement[] = [];

  for (const item of input.items) {
    statements.push(
      env.DB.prepare(
        `UPDATE inventory
         SET reserved_qty = reserved_qty + ?,
             version = version + 1,
             updated_at = ?
         WHERE tenant_id = ?
           AND mall_id = ?
           AND sku_id = ?`
      ).bind(
        item.quantity,
        createdAt,
        actor.tenantId,
        actor.mallId,
        item.skuId
      )
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO orders (
         id, order_no, tenant_id, enterprise_id, mall_id, user_id, status,
         goods_amount_cents, discount_cents, payable_cents, paid_cents,
         recipient_snapshot_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', ?, 0, ?, 0, ?, ?, ?)`
    ).bind(
      orderId,
      orderNo,
      actor.tenantId,
      actor.enterpriseId,
      actor.mallId,
      actor.userId,
      goodsAmountCents,
      goodsAmountCents,
      recipientEncrypted,
      createdAt,
      createdAt
    )
  );

  let supplierIndex = 0;
  for (const [supplierId, items] of suppliers) {
    supplierIndex += 1;
    const subOrderId = crypto.randomUUID();
    const subOrderNo = `${orderNo}-${String(supplierIndex).padStart(2, "0")}`;
    const subOrderAmount = items.reduce(
      (total, item) =>
        total + catalog.get(item.skuId)!.unit_price_cents * item.quantity,
      0
    );
    statements.push(
      env.DB.prepare(
        `INSERT INTO sub_orders (
           id, sub_order_no, tenant_id, mall_id, parent_order_id, supplier_id,
           status, amount_cents, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?)`
      ).bind(
        subOrderId,
        subOrderNo,
        actor.tenantId,
        actor.mallId,
        orderId,
        supplierId,
        subOrderAmount,
        createdAt,
        createdAt
      )
    );

    for (const item of items) {
      const sku = catalog.get(item.skuId)!;
      statements.push(
        env.DB.prepare(
          `INSERT INTO order_items (
             id, tenant_id, mall_id, order_id, sub_order_id, product_id, sku_id,
             product_name_snapshot, specs_snapshot_json, unit_price_cents,
             quantity, line_amount_cents
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          actor.tenantId,
          actor.mallId,
          orderId,
          subOrderId,
          sku.product_id,
          sku.sku_id,
          sku.product_name,
          sku.specs_json,
          sku.unit_price_cents,
          item.quantity,
          sku.unit_price_cents * item.quantity
        )
      );
    }
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO idempotency_keys (
         tenant_id, mall_id, scope, idempotency_key, request_hash,
         resource_id, response_json, created_at, expires_at
       ) VALUES (?, ?, 'order:create', ?, ?, ?, ?, ?, datetime(?, '+24 hours'))`
    ).bind(
      actor.tenantId,
      actor.mallId,
      idempotencyKey,
      requestHash,
      orderId,
      JSON.stringify(responseBody),
      createdAt,
      createdAt
    ),
    env.DB.prepare(
      `INSERT INTO audit_logs (
         id, tenant_id, enterprise_id, mall_id, actor_user_id, actor_type,
         action, resource_type, resource_id, request_id, user_agent, after_json,
         created_at
       ) VALUES (?, ?, ?, ?, ?, 'user', 'order.create', 'order', ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      actor.tenantId,
      actor.enterpriseId,
      actor.mallId,
      actor.userId,
      orderId,
      requestId,
      (userAgent ?? "").slice(0, 300),
      JSON.stringify({
        orderNo,
        goodsAmountCents,
        itemCount: input.items.length,
      }),
      createdAt
    )
  );

  await env.DB.batch(statements);
  return json(responseBody, { status: 201 });
}

function createBusinessNo(prefix: string): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 17);
  const random = crypto.getRandomValues(new Uint32Array(1))[0]
    .toString(36)
    .toUpperCase()
    .padStart(6, "0")
    .slice(-6);
  return `${prefix}${timestamp}${random}`;
}

async function readJsonBody(
  request: Request
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; tooLarge: boolean }
> {
  const maximumBytes = 32 * 1024;
  const declaredLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10
  );
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    return { ok: false, tooLarge: true };
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maximumBytes) {
    return { ok: false, tooLarge: true };
  }
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false, tooLarge: false };
  }
}
