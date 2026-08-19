import { PERMISSIONS } from '@smart-wing/api-contract';
import { authorize } from './auth';
import { sha256 } from './crypto';
import { apiError, json, methodNotAllowed } from './http';
import { resourceScopeFromDatabaseRow } from './membershipContext';
import { authorizationEvidence, invalidBody, loadResourceScope, readJsonBody } from './routerSupport';
import { callRpc } from './supabase';
import type { AuthorizationContext, WorkerEnv } from './types';

const VOUCHER_STATUSES = new Set(['inactive', 'active', 'disabled', 'redeemed', 'expired', 'void']);

interface PageInput {
  limit: number;
  offset: number;
}

interface VoucherListInput extends PageInput {
  query: string | null;
  status: string | null;
}

function parseNonNegativeInteger(value: string | null, fallback: number, maximum: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

function parsePage(url: URL): PageInput | null {
  const limit = parseNonNegativeInteger(url.searchParams.get('limit'), 50, 100);
  const offset = parseNonNegativeInteger(url.searchParams.get('offset'), 0, 1_000_000);
  return limit === null || limit < 1 || offset === null ? null : { limit, offset };
}

function parseVoucherList(url: URL): VoucherListInput | null {
  const page = parsePage(url);
  if (!page) return null;
  const rawQuery = url.searchParams.get('q');
  const query = rawQuery?.trim() ?? null;
  const rawStatus = url.searchParams.get('status');
  const status = rawStatus?.trim() ?? null;
  if ((query && query.length > 100) || (status && !VOUCHER_STATUSES.has(status))) return null;
  return { ...page, query: query || null, status: status || null };
}

function requireVoucherRead(authorization: AuthorizationContext, requestId: string): Response | null {
  return authorize(authorization, PERMISSIONS.voucherRead).allowed ? null : apiError(403, 'FORBIDDEN', '没有查看卡券数据的权限', requestId);
}

function livePayload<T>(data: T, requestId: string) {
  return { dataSource: 'live' as const, data, requestId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: Record<string, unknown>, key: string, maximum: number): string | null {
  const candidate = value[key];
  if (typeof candidate !== 'string') return null;
  const normalized = candidate.trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}

function optionalString(value: Record<string, unknown>, key: string, maximum: number): string | null | undefined {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return null;
  if (typeof candidate !== 'string') return undefined;
  const normalized = candidate.trim();
  return normalized.length <= maximum ? normalized || null : undefined;
}

function idempotencyKey(request: Request, requestId: string): string | Response {
  const key = request.headers.get('idempotency-key');
  return key && key.length <= 120 ? key : apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', '卡券写操作必须提供 Idempotency-Key', requestId);
}

interface ReserveInput {
  voucherProgramId: string;
  quantity: number;
  reason: string;
}

interface ApprovalInput {
  decision: 'approved' | 'rejected';
  reason: string;
  evidence: string | null;
}

interface IssueInput {
  /** Electronic stored-value vouchers do not consume a physical card number. */
  cardPoolId: string | null;
}

interface StatusInput {
  operation: 'activate' | 'disable' | 'extend' | 'void';
  extensionDays: number;
  expectedVersion: number;
  reason: string;
  evidence: string | null;
}

interface RedemptionInput {
  voucherCode: string;
  amountCents: number;
  merchantReference: string;
}

interface ReversalInput {
  reason: string;
}

interface VoidHoldReconciliationInput {
  reconciliationReference: string;
  reconciliationNote: string;
}

function parseReserveInput(value: unknown): ReserveInput | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.quantity)) return null;
  const voucherProgramId = requiredString(value, 'voucherProgramId', 120);
  const reason = requiredString(value, 'reason', 500);
  const quantity = value.quantity as number;
  return voucherProgramId && reason && quantity >= 1 && quantity <= 1_000_000 ? { voucherProgramId, quantity, reason } : null;
}

function parseApprovalInput(value: unknown): ApprovalInput | null {
  if (!isRecord(value) || (value.decision !== 'approved' && value.decision !== 'rejected')) return null;
  const reason = requiredString(value, 'reason', 500);
  const evidence = optionalString(value, 'evidence', 2000);
  return reason && evidence !== undefined ? { decision: value.decision, reason, evidence } : null;
}

function parseIssueInput(value: unknown): IssueInput | null {
  if (!isRecord(value)) return null;
  const cardPoolId = optionalString(value, 'cardPoolId', 120);
  return cardPoolId === undefined ? null : { cardPoolId };
}

function parseStatusInput(value: unknown): StatusInput | null {
  if (!isRecord(value) || !['activate', 'disable', 'extend', 'void'].includes(String(value.operation)) || !Number.isSafeInteger(value.expectedVersion)) return null;
  const operation = value.operation as StatusInput['operation'];
  const extensionDays = operation === 'extend' ? value.extensionDays : 0;
  const reason = requiredString(value, 'reason', 500);
  const evidence = optionalString(value, 'evidence', 2000);
  if (!Number.isSafeInteger(extensionDays) || !reason || evidence === undefined || (operation === 'extend' && ((extensionDays as number) < 1 || (extensionDays as number) > 3650))) return null;
  const expectedVersion = value.expectedVersion as number;
  return expectedVersion > 0 ? { operation, extensionDays: extensionDays as number, expectedVersion, reason, evidence } : null;
}

function parseRedemptionInput(value: unknown): RedemptionInput | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.amountCents)) return null;
  const voucherCode = requiredString(value, 'voucherCode', 100)?.toUpperCase();
  const merchantReference = requiredString(value, 'merchantReference', 160);
  const amountCents = value.amountCents as number;
  return voucherCode && merchantReference && amountCents > 0 && amountCents <= 100_000_000 ? { voucherCode, amountCents, merchantReference } : null;
}

function parseReversalInput(value: unknown): ReversalInput | null {
  if (!isRecord(value)) return null;
  const reason = requiredString(value, 'reason', 500);
  return reason ? { reason } : null;
}

function parseVoidHoldReconciliationInput(value: unknown): VoidHoldReconciliationInput | null {
  if (!isRecord(value)) return null;
  const reconciliationReference = requiredString(value, 'reconciliationReference', 160);
  const reconciliationNote = requiredString(value, 'reconciliationNote', 500);
  return reconciliationReference && reconciliationNote ? { reconciliationReference, reconciliationNote } : null;
}

export async function handleAdminVoucherOverview(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const overview = await callRpc<Record<string, unknown>>(env, 'api_voucher_overview_scoped', { p_membership_id: authorization.membership.id });
  return json(livePayload(overview, requestId));
}

export async function handleAdminVoucherAudit(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  if (!authorize(authorization, PERMISSIONS.voucherAuditRead).allowed) return apiError(403, 'FORBIDDEN', '没有查看卡券审计记录的权限', requestId);
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_audit_scoped', {
    p_membership_id: authorization.membership.id,
    p_limit: page.limit,
    p_offset: page.offset,
  });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVoucherVoidHolds(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  // Reconciling is step-up protected; merely viewing the scoped finance worklist
  // is not. The membership is server-resolved and the RPC applies its scope.
  if (!authorization.membership.permissions.includes(PERMISSIONS.voucherReconcile)) return apiError(403, 'FORBIDDEN', '没有查看卡券作废余额对账的权限', requestId);
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_void_holds_scoped', {
    p_membership_id: authorization.membership.id,
    p_limit: page.limit,
    p_offset: page.offset,
  });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVoucherPrograms(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_programs_scoped', { p_membership_id: authorization.membership.id, p_limit: page.limit, p_offset: page.offset });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVoucherReserves(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_reserves_scoped', { p_membership_id: authorization.membership.id, p_limit: page.limit, p_offset: page.offset });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVoucherBatches(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_batches_scoped', { p_membership_id: authorization.membership.id, p_limit: page.limit, p_offset: page.offset });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleAdminVouchers(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const input = parseVoucherList(new URL(request.url));
  if (!input) return apiError(422, 'INVALID_VOUCHER_QUERY', '卡券查询参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_vouchers_scoped', {
    p_membership_id: authorization.membership.id,
    p_query: input.query,
    p_status: input.status,
    p_limit: input.limit,
    p_offset: input.offset,
  });
  return json(livePayload({ items, ...input }, requestId));
}

export async function handleAdminVoucherDetail(request: Request, env: WorkerEnv, authorization: AuthorizationContext, voucherId: string, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const scope = await loadResourceScope(env, 'api_voucher_authorization_scope', voucherId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherRead, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有查看该卡券的权限', requestId);
  const item = await callRpc<Record<string, unknown> | null>(env, 'api_voucher_detail_scoped', { p_membership_id: authorization.membership.id, p_voucher_id: voucherId });
  if (!item) return apiError(404, 'VOUCHER_NOT_FOUND', '卡券不存在或不在当前数据范围内', requestId);
  return json(livePayload(item, requestId));
}

export async function handleAdminVoucherRedemptions(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET'], requestId);
  const denied = requireVoucherRead(authorization, requestId);
  if (denied) return denied;
  const page = parsePage(new URL(request.url));
  if (!page) return apiError(422, 'INVALID_VOUCHER_QUERY', '分页参数无效', requestId);
  const items = await callRpc<Array<Record<string, unknown>>>(env, 'api_voucher_redemptions_scoped', { p_membership_id: authorization.membership.id, p_limit: page.limit, p_offset: page.offset });
  return json(livePayload({ items, ...page }, requestId));
}

export async function handleCreateAdminVoucherReserve(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherReserveCreate).allowed) return apiError(403, 'FORBIDDEN', '没有创建备券申请的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseReserveInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_RESERVE_INPUT', '备券申请参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_program_authorization_scope', input.voucherProgramId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherReserveCreate, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有为该卡券规则创建备券申请的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_create_voucher_reserve_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_voucher_program_id: input.voucherProgramId,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify(input)),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleDecideAdminVoucherReserve(request: Request, env: WorkerEnv, authorization: AuthorizationContext, reserveRequestId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherReserveApprove).allowed) return apiError(403, 'FORBIDDEN', '没有审批备券申请的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseApprovalInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_APPROVAL_INPUT', '备券审批参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_reserve_authorization_scope', reserveRequestId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherReserveApprove, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有审批该备券申请的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_decide_voucher_reserve_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_reserve_request_id: reserveRequestId,
    p_decision: input.decision,
    p_reason: input.reason,
    p_evidence: input.evidence,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ reserveRequestId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleIssueAdminVoucherBatch(request: Request, env: WorkerEnv, authorization: AuthorizationContext, reserveRequestId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherIssue).allowed) return apiError(403, 'FORBIDDEN', '没有发行卡券的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseIssueInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_ISSUE_INPUT', '卡券发行参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_reserve_authorization_scope', reserveRequestId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherIssue, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有为该备券申请发行卡券的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_issue_voucher_batch_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_reserve_request_id: reserveRequestId,
    p_card_pool_id: input.cardPoolId,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ reserveRequestId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleChangeAdminVoucherStatus(request: Request, env: WorkerEnv, authorization: AuthorizationContext, voucherId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherStatusManage).allowed) return apiError(403, 'FORBIDDEN', '没有变更卡券状态的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseStatusInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_STATUS_INPUT', '卡券状态操作参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_authorization_scope', voucherId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherStatusManage, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有变更该卡券状态的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_change_voucher_status_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_voucher_id: voucherId,
    p_operation: input.operation,
    p_extension_days: input.extensionDays,
    p_expected_version: input.expectedVersion,
    p_reason: input.reason,
    p_evidence: input.evidence,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ voucherId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleRedeemAdminVoucher(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherRedeem).allowed) return apiError(403, 'FORBIDDEN', '没有核销卡券的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseRedemptionInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_REDEMPTION_INPUT', '核销参数无效', requestId);
  const rawScope = await callRpc<Record<string, unknown> | null>(env, 'api_voucher_code_authorization_scope', { p_voucher_code: input.voucherCode });
  const voucherId = rawScope && typeof rawScope.id === 'string' ? rawScope.id : null;
  const scope = resourceScopeFromDatabaseRow(rawScope);
  const decision = voucherId && scope ? authorize(authorization, PERMISSIONS.voucherRedeem, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有核销该卡券的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_redeem_voucher_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_voucher_id: voucherId,
    p_amount_cents: input.amountCents,
    p_merchant_reference: input.merchantReference,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify(input)),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleReverseAdminVoucherRedemption(request: Request, env: WorkerEnv, authorization: AuthorizationContext, redemptionId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherRedemptionReverse).allowed) return apiError(403, 'FORBIDDEN', '没有冲正卡券核销的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseReversalInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_REVERSAL_INPUT', '核销冲正参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_redemption_authorization_scope', redemptionId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherRedemptionReverse, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有冲正该核销流水的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_reverse_voucher_redemption_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_redemption_id: redemptionId,
    p_reason: input.reason,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ redemptionId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}

export async function handleReconcileAdminVoucherVoidHold(request: Request, env: WorkerEnv, authorization: AuthorizationContext, voidHoldId: string, requestId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST'], requestId);
  const key = idempotencyKey(request, requestId);
  if (typeof key !== 'string') return key;
  if (!authorize(authorization, PERMISSIONS.voucherReconcile).allowed) return apiError(403, 'FORBIDDEN', '没有处理卡券作废余额对账的权限', requestId);
  const body = await readJsonBody(request);
  if (!body.ok) return invalidBody(body.tooLarge, requestId);
  const input = parseVoidHoldReconciliationInput(body.value);
  if (!input) return apiError(422, 'INVALID_VOUCHER_RECONCILIATION_INPUT', '作废余额对账参数无效', requestId);
  const scope = await loadResourceScope(env, 'api_voucher_void_hold_authorization_scope', voidHoldId);
  const decision = scope ? authorize(authorization, PERMISSIONS.voucherReconcile, scope) : null;
  if (!decision?.allowed) return apiError(403, 'FORBIDDEN', '没有处理该作废余额对账项的权限', requestId);
  const result = await callRpc<Record<string, unknown>>(env, 'api_reconcile_voucher_void_hold_authorized', {
    p_membership_id: authorization.membership.id,
    p_operator_user_id: authorization.userId,
    p_void_hold_id: voidHoldId,
    p_reconciliation_reference: input.reconciliationReference,
    p_reconciliation_note: input.reconciliationNote,
    p_idempotency_key: key,
    p_request_hash: await sha256(JSON.stringify({ voidHoldId, ...input })),
    p_request_id: requestId,
    p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 300),
    p_granted_via: authorizationEvidence(authorization, decision),
  });
  return json(result, { status: 201 });
}
