import { can } from './auth';
import { encryptJson, sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { actorScope, invalidBody, readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { Actor, WorkerEnv } from './types';
import { parseCreateAfterSaleInput, parseCreateOrderInput, parseExecuteRefundInput, parseInternalPaymentInput } from './validation';

export async function handleAfterSales(request: Request, env: WorkerEnv, actor: Actor, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET', 'POST'], requestId);
  if (!can(actor, 'order:read:own')) {
    return apiError(403, 'FORBIDDEN', '没有查看售后记录的权限', requestId);
  }
  const rows = await callRpc<Array<Record<string, unknown>>>(env, 'api_after_sales', actorScope(actor, true));
  return json({ items: rows, requestId });
}

export async function handleCreateAfterSale(request: Request, env: WorkerEnv, actor: Actor, requestId: string): Promise<Response> {
  if (!can(actor, 'order:create')) {
    return apiError(403, 'FORBIDDEN', '没有提交售后的权限', requestId);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseCreateAfterSaleInput(body.value);
  if (!input) {
    return apiError(422, 'INVALID_AFTER_SALE_INPUT', '售后申请信息不完整', requestId);
  }
  const response = await callRpc<Record<string, unknown>>(env, 'api_create_after_sale', {
    ...actorScope(actor, true),
    p_order_id: input.orderId,
    p_type: input.type,
    p_reason: input.reason,
    p_requested_amount_cents: input.requestedAmountCents,
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  return json(response, { status: 201 });
}

export async function handleOrders(request: Request, env: WorkerEnv, actor: Actor, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET', 'POST'], requestId);
  if (!can(actor, 'order:read:own')) {
    return apiError(403, 'FORBIDDEN', '没有查看订单的权限', requestId);
  }
  const rows = await callRpc<Array<Record<string, unknown>>>(env, 'api_order_views', actorScope(actor, true));
  return json({ items: rows, requestId });
}

export async function handleCreateOrder(request: Request, env: WorkerEnv, actor: Actor, requestId: string): Promise<Response> {
  if (!can(actor, 'order:create')) {
    return apiError(403, 'FORBIDDEN', '没有创建订单的权限', requestId);
  }
  if (!env.PII_ENCRYPTION_KEY) {
    return apiError(503, 'PII_ENCRYPTION_NOT_CONFIGURED', '收货信息加密密钥尚未配置，系统已阻止订单写入', requestId);
  }
  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '创建订单必须提供 Idempotency-Key', requestId);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseCreateOrderInput(body.value);
  if (!input) {
    return apiError(422, 'INVALID_ORDER_INPUT', '订单商品或收货信息不完整', requestId);
  }
  const recipientCipher = await encryptJson(input.recipient, env.PII_ENCRYPTION_KEY);
  const response = await callRpc<Record<string, unknown>>(env, 'api_create_order', {
    ...actorScope(actor, true),
    p_items: input.items,
    p_recipient_cipher: JSON.parse(recipientCipher),
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256(JSON.stringify(input)),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  return json(response, { status: 201 });
}

export async function handleInternalPayment(request: Request, env: WorkerEnv, actor: Actor, orderId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (!can(actor, 'order:create')) {
    return apiError(403, 'FORBIDDEN', '没有支付订单的权限', requestId);
  }
  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '支付必须提供 Idempotency-Key', requestId);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseInternalPaymentInput(body.value);
  if (!input) {
    return apiError(422, 'INVALID_PAYMENT_INPUT', '账户支付金额无效', requestId);
  }
  const response = await callRpc<Record<string, unknown>>(env, 'api_pay_internal', {
    ...actorScope(actor, true),
    p_order_id: orderId,
    p_welfare_cents: input.welfareCents,
    p_meal_cents: input.mealCents,
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256(JSON.stringify({ orderId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  return json(response, { status: 201 });
}

export async function handleExecuteRefund(request: Request, env: WorkerEnv, actor: Actor, afterSaleId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  if (!can(actor, 'finance:refund')) {
    return apiError(403, 'FORBIDDEN', '没有执行退款的权限', requestId);
  }
  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '退款必须提供 Idempotency-Key', requestId);
  }
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseExecuteRefundInput(body.value);
  if (!input) return apiError(422, 'INVALID_REFUND_INPUT', '退款金额无效', requestId);
  const response = await callRpc<Record<string, unknown>>(env, 'api_execute_internal_refund', {
    ...actorScope(actor),
    p_operator_user_id: actor.userId,
    p_after_sale_id: afterSaleId,
    p_refund_cents: input.refundCents,
    p_idempotency_key: idempotencyKey,
    p_request_hash: await sha256(JSON.stringify({ afterSaleId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  });
  return json(response, { status: 201 });
}

export async function handleFinanceReconciliation(request: Request, env: WorkerEnv, actor: Actor, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  if (!can(actor, 'finance:reconcile')) {
    return apiError(403, 'FORBIDDEN', '没有查看财务对账的权限', requestId);
  }
  const report = await callRpc<Record<string, unknown>>(env, 'api_finance_reconciliation', actorScope(actor));
  return json({ report, requestId });
}
